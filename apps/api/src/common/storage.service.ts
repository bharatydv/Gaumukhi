import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { randomBytes } from 'crypto';

/**
 * Where uploaded media actually lives.
 *
 * One adapter with two drivers. Locally files land on disk under UPLOAD_DIR and are
 * served by the API at /uploads/*; when real S3 credentials are present the same call
 * puts them in the bucket instead. Callers only ever see the storage key, and the URL
 * is derived at read time — so moving to S3, or later to a CDN, changes this file and
 * nothing else. Keys are never rewritten in the database.
 */

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/pjpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/gif': '.gif',
};

export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 5 * 1024 * 1024);

/** True only when a bucket AND credentials are configured — a half-set env stays local. */
const usingS3 = () =>
  !!(process.env.S3_BUCKET && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

/**
 * Absolute, browser-usable URL for a stored key. Standalone so response shapers can
 * call it without holding the service; the DB only ever stores the key.
 */
export function mediaUrl(key: string): string {
  if (!key) return '';
  if (/^https?:\/\//i.test(key)) return key; // already absolute — an externally hosted image
  if (usingS3()) {
    const region = process.env.S3_REGION || 'ap-south-1';
    return `https://${process.env.S3_BUCKET}.s3.${region}.amazonaws.com/${key}`;
  }
  const base = (process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');
  return `${base}/uploads/${key}`;
}

/** The slice of multer's file object we use, declared here so @types/multer is not required. */
export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  /** Absolute path of the local upload root, also used by main.ts to serve it. */
  static localRoot(): string {
    return resolve(process.env.UPLOAD_DIR || join(process.cwd(), 'uploads'));
  }

  get driver(): 'local' | 's3' {
    return usingS3() ? 's3' : 'local';
  }

  publicUrl(key: string): string {
    return mediaUrl(key);
  }

  async save(file: UploadedFile, folder = 'products'): Promise<{ key: string; url: string }> {
    const ext = EXTENSIONS[file.mimetype];
    if (!ext) {
      throw new BadRequestException('Upload a JPEG, PNG, WebP, AVIF or GIF image.');
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(`Images must be under ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`);
    }

    // The stored name is ours, never the client's: an uploaded filename is untrusted
    // input and is the usual way a path traversal or an executable extension gets in.
    const key = `${folder}/${randomBytes(16).toString('hex')}${ext}`;

    if (this.driver === 's3') {
      await this.putToS3(key, file);
    } else {
      const target = join(StorageService.localRoot(), key);
      await fs.mkdir(join(target, '..'), { recursive: true });
      await fs.writeFile(target, file.buffer);
    }

    return { key, url: this.publicUrl(key) };
  }

  async remove(key: string): Promise<void> {
    if (!key || /^https?:\/\//i.test(key)) return;
    try {
      if (this.driver === 's3') {
        const { S3Client, DeleteObjectCommand } = await this.s3sdk();
        const client = new S3Client({ region: process.env.S3_REGION || 'ap-south-1' });
        await client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
        return;
      }
      await fs.unlink(join(StorageService.localRoot(), key));
    } catch (e: any) {
      // A missing file must not stop the row from being deleted — the record is what the shop reads.
      this.logger.warn(`Could not delete ${key}: ${e.message}`);
    }
  }

  private async putToS3(key: string, file: UploadedFile) {
    const { S3Client, PutObjectCommand } = await this.s3sdk();
    const client = new S3Client({ region: process.env.S3_REGION || 'ap-south-1' });
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  /**
   * Loaded on demand so the SDK is only a dependency for deployments that use S3.
   * The specifier is held in a variable on purpose: it keeps the compiler from
   * insisting the package be installed for a local-disk build.
   */
  private async s3sdk(): Promise<any> {
    const specifier = '@aws-sdk/client-s3';
    try {
      return await import(specifier);
    } catch {
      throw new BadRequestException(
        'S3 credentials are set but @aws-sdk/client-s3 is not installed. Run `npm i @aws-sdk/client-s3` in apps/api, or clear AWS_ACCESS_KEY_ID to store uploads on disk.',
      );
    }
  }
}
