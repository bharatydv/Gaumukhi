import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser, AuthUser } from '../../common/decorators';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get() profile(@CurrentUser() u: AuthUser) { return this.users.profile(u.id); }
  @Patch() update(@CurrentUser() u: AuthUser, @Body() b: any) { return this.users.updateProfile(u.id, b); }

  @Get('addresses') addresses(@CurrentUser() u: AuthUser) { return this.users.addresses(u.id); }
  @Post('addresses') addAddress(@CurrentUser() u: AuthUser, @Body() b: any) { return this.users.addAddress(u.id, b); }
  @Patch('addresses/:id') updateAddress(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: any) {
    return this.users.updateAddress(u.id, id, b);
  }
  @Delete('addresses/:id') removeAddress(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.users.removeAddress(u.id, id);
  }

  @Get('wishlist') wishlist(@CurrentUser() u: AuthUser) { return this.users.wishlist(u.id); }
  @Post('wishlist') toggleWishlist(@CurrentUser() u: AuthUser, @Body() b: { productId: string }) {
    return this.users.toggleWishlist(u.id, b.productId);
  }

  @Get('points') points(@CurrentUser() u: AuthUser) { return this.users.points(u.id); }
  @Get('referrals') referrals(@CurrentUser() u: AuthUser) { return this.users.referrals(u.id); }

  @Get('tickets') tickets(@CurrentUser() u: AuthUser) { return this.users.tickets(u.id); }
  @Post('tickets') createTicket(@CurrentUser() u: AuthUser, @Body() b: any) { return this.users.createTicket(u.id, b); }

  @Get('notifications') notifications(@CurrentUser() u: AuthUser) { return this.users.notifications(u.id); }
  @Post('notifications/read') read(@CurrentUser() u: AuthUser) { return this.users.markNotificationsRead(u.id); }
}
