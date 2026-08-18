import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { OrderStatus, Role } from '@prisma/client';
import { OrdersService } from './orders.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { CurrentUser, AuthUser, Roles, Public } from '../../common/decorators';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create an order from the current cart (reserves stock)' })
  create(@CurrentUser() user: AuthUser, @Body() body: { addressId: string; pointsToUse?: number }) {
    return this.orders.create(user.id, body.addressId, body.pointsToUse ?? 0);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  mine(@CurrentUser() user: AuthUser) {
    return this.orders.listMine(user.id);
  }

  @Get(':number')
  @UseGuards(JwtAuthGuard)
  one(@CurrentUser() user: AuthUser, @Param('number') number: string) {
    return this.orders.getMine(user.id, number);
  }

  @Public()
  @Get(':number/track')
  track(@Param('number') number: string) {
    return this.orders.track(number);
  }

  @Post(':number/return')
  @UseGuards(JwtAuthGuard)
  requestReturn(@CurrentUser() user: AuthUser, @Param('number') number: string, @Body() body: { reason: string }) {
    return this.orders.requestReturn(user.id, number, body.reason);
  }

  // ── ops ────────────────────────────────────────────────────────

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPPORT, Role.SUPER_ADMIN)
  adminList(@Query('status') status?: OrderStatus, @Query('q') q?: string) {
    return this.orders.adminList(status, q);
  }

  @Patch('admin/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPPORT, Role.SUPER_ADMIN)
  setStatus(@Param('id') id: string, @Body() body: { status: OrderStatus }) {
    return this.orders.setStatus(id, body.status);
  }

  @Post('admin/refunds/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPPORT, Role.SUPER_ADMIN)
  approveRefund(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orders.approveRefund(id, user.id, user.role);
  }
}
