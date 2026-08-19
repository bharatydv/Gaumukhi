import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { ROLES_KEY, PUBLIC_KEY } from './decorators';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;
    return super.canActivate(ctx);
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required?.length) return true;

    const { user } = ctx.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Authentication required');
    if (user.role === Role.SUPER_ADMIN) return true;
    if (!required.includes(user.role)) throw new ForbiddenException('Your role cannot perform this action');
    return true;
  }
}

/**
 * Populates req.user when a valid token is present and stays quiet when it is not.
 * Routes that serve both guests and signed-in shoppers — the cart, above all — need
 * the identity to bind the row to an account, but must never reject an anonymous
 * visitor. Plain JwtAuthGuard throws on a missing token, so it cannot be used here.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(ctx: ExecutionContext) {
    try {
      await super.canActivate(ctx);
    } catch {
      // anonymous — carry on with req.user undefined
    }
    return true;
  }

  handleRequest(_err: any, user: any) {
    return user || undefined;
  }
}
