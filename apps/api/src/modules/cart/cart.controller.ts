import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CartService } from './cart.service';
import { Public, SessionId } from '../../common/decorators';
import { OptionalJwtAuthGuard } from '../../common/guards';

/**
 * Cart works signed-in or anonymous. Guests are keyed by the `x-session-id`
 * header the web client sends (or a `dv_session` cookie); on login the guest
 * cart is merged into the user's.
 *
 * OptionalJwtAuthGuard is what makes the signed-in half work: these routes are
 * public, so without it Passport never runs and req.user is always undefined —
 * every cart would be filed under the anonymous session even after login.
 */
@ApiTags('cart')
@UseGuards(OptionalJwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private cart: CartService) {}

  private uid(req: Request) {
    return (req as any).user?.id as string | undefined;
  }

  @Public() @Get()
  get(@Req() req: Request, @SessionId() sid: string) {
    return this.cart.get(this.uid(req), sid);
  }

  @Public() @Post('items')
  add(@Req() req: Request, @SessionId() sid: string, @Body() body: { productId: string; variantId?: string; qty?: number }) {
    return this.cart.addItem(body.productId, body.variantId ?? null, body.qty ?? 1, this.uid(req), sid);
  }

  @Public() @Patch('items/:id')
  setQty(@Req() req: Request, @SessionId() sid: string, @Param('id') id: string, @Body() body: { qty: number }) {
    return this.cart.setQty(id, body.qty, this.uid(req), sid);
  }

  @Public() @Delete('items/:id')
  remove(@Req() req: Request, @SessionId() sid: string, @Param('id') id: string) {
    return this.cart.setQty(id, 0, this.uid(req), sid);
  }

  @Public() @Post('coupon')
  applyCoupon(@Req() req: Request, @SessionId() sid: string, @Body() body: { code: string }) {
    return this.cart.applyCoupon(body.code, this.uid(req), sid);
  }

  @Public() @Delete('coupon')
  removeCoupon(@Req() req: Request, @SessionId() sid: string) {
    return this.cart.removeCoupon(this.uid(req), sid);
  }

  @Public() @Post('gift-wrap')
  giftWrap(@Req() req: Request, @SessionId() sid: string, @Body() body: { enabled: boolean }) {
    return this.cart.setGiftWrap(body.enabled, this.uid(req), sid);
  }
}
