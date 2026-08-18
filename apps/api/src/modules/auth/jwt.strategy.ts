import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private prisma: PrismaService) {
    super({
      // Cookie first (browser), Bearer second (mobile / server-to-server).
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.dv_access || null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET || 'change-me-access',
    });
  }

  async validate(payload: { sub: string; role: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, email: true, phone: true, blocked: true },
    });
    if (!user || user.blocked) throw new UnauthorizedException('Account unavailable');
    return { id: user.id, role: user.role, email: user.email, phone: user.phone };
  }
}
