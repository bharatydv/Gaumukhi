import { Injectable, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { referralCode } from '../../common/ids';

const OTP_TTL_SECONDS = 300;
const OTP_MAX_PER_HOUR = 5;
const MAX_OTP_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private redis: RedisService,
    private notify: NotificationsService,
  ) {}

  // ── OTP ────────────────────────────────────────────────────────

  async requestOtp(phone: string, ip?: string) {
    const count = await this.redis.incrWindow(`otp:rate:${phone}`, 3600);
    if (count > OTP_MAX_PER_HOUR) {
      throw new BadRequestException('Too many codes requested. Try again in an hour.');
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await this.prisma.otpChallenge.create({
      data: {
        phone,
        codeHash: await bcrypt.hash(code, 8),
        expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
      },
    });

    await this.notify.sendSms(phone, `${code} is your Divyaloka verification code. Valid for 5 minutes.`);

    // Never returned in production; convenient in dev so you can log in without an SMS gateway.
    return {
      sent: true,
      expiresIn: OTP_TTL_SECONDS,
      ...(process.env.NODE_ENV !== 'production' ? { devCode: code } : {}),
    };
  }

  async verifyOtp(phone: string, code: string, refCode?: string) {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { phone, consumed: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge) throw new UnauthorizedException('That code has expired. Request a new one.');
    if (challenge.attempts >= MAX_OTP_ATTEMPTS) throw new UnauthorizedException('Too many attempts on this code.');

    const ok = await bcrypt.compare(code, challenge.codeHash);
    if (!ok) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('That code is not correct.');
    }

    await this.prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumed: true } });

    let user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) user = await this.createUser({ phone }, refCode);

    return this.issueTokens(user.id, user.role);
  }

  // ── email / password ───────────────────────────────────────────

  async register(email: string, password: string, name?: string, refCode?: string) {
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new BadRequestException('An account already uses this email.');

    const user = await this.createUser({ email, name, passwordHash: await bcrypt.hash(password, 12) }, refCode);
    await this.notify.sendEmail(email, 'welcome', { name: name || 'sadhak' });
    return this.issueTokens(user.id, user.role);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Email or password is incorrect.');
    }
    if (user.blocked) throw new UnauthorizedException('This account has been suspended.');
    return this.issueTokens(user.id, user.role);
  }

  /**
   * Google sign-in. In production the idToken is verified against Google's JWKS;
   * the verified payload gives us sub/email/name.
   */
  async googleLogin(profile: { googleId: string; email: string; name?: string }) {
    let user = await this.prisma.user.findFirst({
      where: { OR: [{ googleId: profile.googleId }, { email: profile.email }] },
    });
    if (!user) {
      user = await this.createUser({ email: profile.email, name: profile.name, googleId: profile.googleId });
    } else if (!user.googleId) {
      user = await this.prisma.user.update({ where: { id: user.id }, data: { googleId: profile.googleId } });
    }
    return this.issueTokens(user.id, user.role);
  }

  // ── tokens ─────────────────────────────────────────────────────

  private async createUser(
    data: { email?: string; phone?: string; name?: string; passwordHash?: string; googleId?: string },
    refCode?: string,
  ) {
    const referrer = refCode
      ? await this.prisma.user.findUnique({ where: { referralCode: refCode.toUpperCase() } })
      : null;

    const user = await this.prisma.user.create({
      data: { ...data, referralCode: referralCode(data.name), referredById: referrer?.id },
    });

    if (referrer) {
      // Points land only once the referred user's first order ships; this records intent.
      await this.prisma.pointsEntry.create({
        data: { userId: referrer.id, delta: 0, reason: 'REFERRAL_PENDING', refId: user.id },
      });
    }
    return user;
  }

  async issueTokens(userId: string, role: Role, family?: string) {
    const accessTtl = Number(process.env.JWT_ACCESS_TTL || 900);
    const refreshTtl = Number(process.env.JWT_REFRESH_TTL || 2592000);

    const accessToken = await this.jwt.signAsync(
      { sub: userId, role },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: accessTtl },
    );

    const refreshRaw = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: createHash('sha256').update(refreshRaw).digest('hex'),
        family: family || randomBytes(12).toString('hex'),
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
      },
    });

    await this.prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });

    return { userId, accessToken, refreshToken: refreshRaw, accessTtl, refreshTtl };
  }

  /**
   * Rotating refresh tokens. Presenting a token that was already rotated means
   * it leaked — we revoke the whole family rather than just that token.
   */
  async refresh(rawToken: string) {
    const hash = createHash('sha256').update(rawToken).digest('hex');
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
      include: { user: true },
    });
    if (!stored) throw new UnauthorizedException('Session not recognised. Please sign in again.');

    if (stored.revoked) {
      await this.prisma.refreshToken.updateMany({
        where: { family: stored.family },
        data: { revoked: true },
      });
      this.logger.warn(`Refresh token reuse detected for user ${stored.userId}; family revoked`);
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }

    if (stored.expiresAt < new Date()) throw new UnauthorizedException('Session expired.');

    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
    return this.issueTokens(stored.userId, stored.user.role, stored.family);
  }

  async logout(rawToken?: string) {
    if (!rawToken) return { ok: true };
    const hash = createHash('sha256').update(rawToken).digest('hex');
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
    if (stored) {
      await this.prisma.refreshToken.updateMany({ where: { family: stored.family }, data: { revoked: true } });
    }
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, phone: true, role: true, points: true,
        referralCode: true, createdAt: true,
        addresses: true,
        pandit: { select: { id: true, displayName: true, status: true } },
        _count: { select: { orders: true, bookings: true, wishlist: true } },
      },
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
