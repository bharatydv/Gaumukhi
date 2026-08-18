import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BookingMode } from '@prisma/client';
import { PujaService } from './puja.service';
import { CreateBookingDto, AvailabilityQueryDto, RescheduleDto } from './dto';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser, AuthUser, Public } from '../../common/decorators';

@ApiTags('puja')
@Controller('puja')
export class PujaController {
  constructor(private puja: PujaService) {}

  @Public() @Get('pujas')
  list() {
    return this.puja.listPujas();
  }

  @Public() @Get('pandits')
  @ApiOperation({ summary: 'Pandits filtered by date, language, city and puja' })
  pandits(@Query() q: AvailabilityQueryDto) {
    return this.puja.findPandits(q);
  }

  @Public() @Get('quote')
  @ApiOperation({ summary: 'Itemised cost before any commitment' })
  quote(
    @Query('pujaId') pujaId: string,
    @Query('mode') mode: BookingMode,
    @Query('panditId') panditId?: string,
    @Query('couponCode') couponCode?: string,
  ) {
    return this.puja.quote(pujaId, mode, panditId, couponCode);
  }

  @Post('bookings')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Hold a muhurat and create a pending booking' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBookingDto) {
    return this.puja.createBooking(user.id, dto);
  }

  @Get('bookings')
  @UseGuards(JwtAuthGuard)
  mine(@CurrentUser() user: AuthUser) {
    return this.puja.listMine(user.id);
  }

  @Get('bookings/:reference')
  @UseGuards(JwtAuthGuard)
  one(@CurrentUser() user: AuthUser, @Param('reference') reference: string) {
    return this.puja.getByReference(user.id, reference);
  }

  @Post('bookings/:reference/reschedule')
  @UseGuards(JwtAuthGuard)
  reschedule(@CurrentUser() user: AuthUser, @Param('reference') reference: string, @Body() dto: RescheduleDto) {
    return this.puja.reschedule(user.id, reference, dto);
  }

  @Post('bookings/:reference/cancel')
  @UseGuards(JwtAuthGuard)
  cancel(@CurrentUser() user: AuthUser, @Param('reference') reference: string, @Body() body: { reason?: string }) {
    return this.puja.cancel(user.id, reference, body.reason ?? 'Cancelled by customer');
  }
}
