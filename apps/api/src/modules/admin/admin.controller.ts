import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BookingStatus, PanditStatus, Role } from '@prisma/client';
import { AdminService } from './admin.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles, CurrentUser, AuthUser } from '../../common/decorators';
import { AuditService } from '../../common/audit.service';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.SUPPORT, Role.CATALOGUE, Role.PUJA_COORDINATOR)
export class AdminController {
  constructor(private admin: AdminService, private audit: AuditService) {}

  @Get('dashboard') dashboard() { return this.admin.dashboard(); }

  @Get('customers') @Roles(Role.SUPPORT, Role.SUPER_ADMIN)
  customers(@Query('q') q?: string) { return this.admin.customers(q); }

  @Patch('customers/:id/block') @Roles(Role.SUPPORT, Role.SUPER_ADMIN)
  async block(@Param('id') id: string, @Body() b: { blocked: boolean }, @CurrentUser() u: AuthUser) {
    const r = await this.admin.blockCustomer(id, b.blocked);
    await this.audit.record({ actorId: u.id, actorRole: u.role, action: b.blocked ? 'customer.block' : 'customer.unblock', entity: 'User', entityId: id });
    return r;
  }

  @Get('inventory') @Roles(Role.CATALOGUE, Role.SUPER_ADMIN)
  inventory() { return this.admin.inventory(); }

  @Patch('inventory/:id') @Roles(Role.CATALOGUE, Role.SUPER_ADMIN)
  async adjust(@Param('id') id: string, @Body() b: { onHand: number }, @CurrentUser() u: AuthUser) {
    const r = await this.admin.adjustStock(id, b.onHand);
    await this.audit.record({ actorId: u.id, actorRole: u.role, action: 'inventory.adjust', entity: 'Inventory', entityId: id, diff: b });
    return r;
  }

  @Get('bookings') @Roles(Role.PUJA_COORDINATOR, Role.SUPER_ADMIN)
  bookings(@Query('status') status?: BookingStatus) { return this.admin.bookings(status); }

  @Post('bookings/:id/assign') @Roles(Role.PUJA_COORDINATOR, Role.SUPER_ADMIN)
  async assign(@Param('id') id: string, @Body() b: { panditId: string }, @CurrentUser() u: AuthUser) {
    const r = await this.admin.assignPandit(id, b.panditId);
    await this.audit.record({ actorId: u.id, actorRole: u.role, action: 'booking.assign', entity: 'Booking', entityId: id, diff: b });
    return r;
  }

  @Get('pandits') @Roles(Role.PUJA_COORDINATOR, Role.SUPER_ADMIN)
  pandits(@Query('status') status?: PanditStatus) { return this.admin.pandits(status); }

  @Post('pandits/:id/approve') @Roles(Role.PUJA_COORDINATOR, Role.SUPER_ADMIN)
  async approve(@Param('id') id: string, @Body() b: { approve: boolean }, @CurrentUser() u: AuthUser) {
    const r = await this.admin.approvePandit(id, b.approve);
    await this.audit.record({ actorId: u.id, actorRole: u.role, action: 'pandit.approve', entity: 'Pandit', entityId: id, diff: b });
    return r;
  }

  @Patch('pandits/:id/commission') @Roles(Role.SUPER_ADMIN)
  commission(@Param('id') id: string, @Body() b: { commissionPct: number }) {
    return this.admin.setCommission(id, b.commissionPct);
  }

  @Get('audit') @Roles(Role.SUPER_ADMIN)
  audits(@Query('take') take?: string) { return this.admin.auditLog(Number(take) || 50); }

  @Get('settings') @Roles(Role.SUPER_ADMIN)
  settings() { return this.admin.settings(); }

  @Post('settings') @Roles(Role.SUPER_ADMIN)
  setSetting(@Body() b: { key: string; value: unknown }, @CurrentUser() u: AuthUser) {
    this.audit.record({ actorId: u.id, actorRole: u.role, action: 'setting.update', entity: 'Setting', entityId: b.key, diff: b });
    return this.admin.setSetting(b.key, b.value);
  }
}
