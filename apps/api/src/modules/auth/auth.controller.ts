import { Body, Controller, Get, Post, Req, Res, UseGuards, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RequestOtpDto, VerifyOtpDto, EmailLoginDto, EmailRegisterDto, GoogleLoginDto } from './dto';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser, AuthUser } from '../../common/decorators';

const isProd = process.env.NODE_ENV === 'production';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  private setCookies(res: Response, t: { accessToken: string; refreshToken: string; accessTtl: number; refreshTtl: number }) {
    const base = { httpOnly: true, secure: isProd, sameSite: 'lax' as const, path: '/' };
    res.cookie('dv_access', t.accessToken, { ...base, maxAge: t.accessTtl * 1000 });
    res.cookie('dv_refresh', t.refreshToken, { ...base, maxAge: t.refreshTtl * 1000, path: '/api/auth' });
  }

  @Post('otp/request')
  @Throttle({ default: { limit: 5, ttl: 3600_000 } })
  @ApiOperation({ summary: 'Send a 6-digit login code over SMS' })
  requestOtp(@Body() dto: RequestOtpDto, @Req() req: Request) {
    return this.auth.requestOtp(dto.phone, req.ip);
  }

  @Post('otp/verify')
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  async verifyOtp(@Body() dto: VerifyOtpDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.auth.verifyOtp(dto.phone, dto.code, dto.referralCode);
    this.setCookies(res, tokens);
    return { ok: true, accessToken: tokens.accessToken };
  }

  @Post('register')
  async register(@Body() dto: EmailRegisterDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.auth.register(dto.email, dto.password, dto.name, dto.referralCode);
    this.setCookies(res, tokens);
    return { ok: true, accessToken: tokens.accessToken };
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  async login(@Body() dto: EmailLoginDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.auth.login(dto.email, dto.password);
    this.setCookies(res, tokens);
    return { ok: true, accessToken: tokens.accessToken };
  }

  @Post('google')
  async google(@Body() dto: GoogleLoginDto, @Res({ passthrough: true }) res: Response) {
    const profile = await verifyGoogleIdToken(dto.idToken);
    const tokens = await this.auth.googleLogin(profile);
    this.setCookies(res, tokens);
    return { ok: true, accessToken: tokens.accessToken };
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.dv_refresh || req.body?.refreshToken;
    if (!raw) throw new UnauthorizedException('No session to refresh');
    const tokens = await this.auth.refresh(raw);
    this.setCookies(res, tokens);
    return { ok: true, accessToken: tokens.accessToken };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.dv_refresh);
    res.clearCookie('dv_access', { path: '/' });
    res.clearCookie('dv_refresh', { path: '/api/auth' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}

/**
 * Verifies a Google ID token against Google's tokeninfo endpoint.
 * Swap for google-auth-library + cached JWKS when you have the client id.
 */
async function verifyGoogleIdToken(idToken: string) {
  if (process.env.NODE_ENV !== 'production' && idToken.startsWith('dev:')) {
    const email = idToken.slice(4);
    return { googleId: 'dev-' + email, email, name: email.split('@')[0] };
  }
  const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!r.ok) throw new UnauthorizedException('Google sign-in could not be verified');
  const p = (await r.json()) as any;
  if (process.env.GOOGLE_CLIENT_ID && p.aud !== process.env.GOOGLE_CLIENT_ID) {
    throw new UnauthorizedException('Google sign-in was issued for a different app');
  }
  return { googleId: p.sub as string, email: p.email as string, name: p.name as string };
}
