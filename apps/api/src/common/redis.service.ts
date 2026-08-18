import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Thin wrapper over ioredis. Used for response caching, OTP throttling,
 * cart sessions and slot-hold expiry notifications.
 * Falls back to an in-memory map when REDIS_URL is absent so the API
 * still boots in a bare local environment.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private memory = new Map<string, { v: string; exp: number }>();

  constructor() {
    if (process.env.REDIS_URL) {
      this.client = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: false });
      this.client.on('error', (e) => this.logger.warn(`Redis: ${e.message}`));
    } else {
      this.logger.warn('REDIS_URL not set — using in-process cache');
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    if (this.client) {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    }
    const hit = this.memory.get(key);
    if (!hit || hit.exp < Date.now()) return null;
    return JSON.parse(hit.v) as T;
  }

  async set(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    const raw = JSON.stringify(value);
    if (this.client) {
      await this.client.set(key, raw, 'EX', ttlSeconds);
      return;
    }
    this.memory.set(key, { v: raw, exp: Date.now() + ttlSeconds * 1000 });
  }

  async del(pattern: string): Promise<void> {
    if (this.client) {
      const keys = await this.client.keys(pattern);
      if (keys.length) await this.client.del(...keys);
      return;
    }
    for (const k of [...this.memory.keys()]) {
      if (k.startsWith(pattern.replace('*', ''))) this.memory.delete(k);
    }
  }

  /** Fixed-window counter used for OTP and coupon endpoints. */
  async incrWindow(key: string, windowSeconds: number): Promise<number> {
    if (this.client) {
      const n = await this.client.incr(key);
      if (n === 1) await this.client.expire(key, windowSeconds);
      return n;
    }
    const hit = this.memory.get(key);
    const n = hit && hit.exp > Date.now() ? Number(hit.v) + 1 : 1;
    this.memory.set(key, { v: String(n), exp: Date.now() + windowSeconds * 1000 });
    return n;
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }
}
