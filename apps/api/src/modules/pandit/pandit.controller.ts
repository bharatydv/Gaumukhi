import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PanditService } from './pandit.service';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser, AuthUser } from '../../common/decorators';

@ApiTags('pandit')
@Controller('pandit')
@UseGuards(JwtAuthGuard)
export class PanditController {
  constructor(private pandit: PanditService) {}

  @Get('profile') profile(@CurrentUser() u: AuthUser) { return this.pandit.profile(u.id); }
  @Patch('profile') update(@CurrentUser() u: AuthUser, @Body() b: any) { return this.pandit.updateProfile(u.id, b); }
  @Post('services') services(@CurrentUser() u: AuthUser, @Body() b: { pujaIds: string[] }) { return this.pandit.setServices(u.id, b.pujaIds); }

  @Get('availability')
  availability(@CurrentUser() u: AuthUser, @Query('from') from: string, @Query('to') to: string) {
    return this.pandit.availability(u.id, from, to);
  }

  @Post('availability')
  setAvailability(@CurrentUser() u: AuthUser, @Body() b: { entries: Array<{ date: string; slots: string[]; open: boolean }> }) {
    return this.pandit.setAvailability(u.id, b.entries);
  }

  @Get('schedule')
  schedule(@CurrentUser() u: AuthUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.pandit.schedule(u.id, from, to);
  }

  @Get('requests') requests(@CurrentUser() u: AuthUser) { return this.pandit.requests(u.id); }

  @Post('requests/:id/accept')
  accept(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.pandit.respond(u.id, id, true); }

  @Post('requests/:id/decline')
  decline(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: { reason?: string }) {
    return this.pandit.respond(u.id, id, false, b.reason);
  }

  @Get('income') income(@CurrentUser() u: AuthUser) { return this.pandit.income(u.id); }
  @Post('payouts') payout(@CurrentUser() u: AuthUser) { return this.pandit.requestPayout(u.id); }
}
