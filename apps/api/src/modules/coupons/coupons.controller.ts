import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CouponsService } from './coupons.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';

@ApiTags('coupons')
@Controller('coupons')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPPORT, Role.CATALOGUE, Role.SUPER_ADMIN)
export class CouponsController {
  constructor(private coupons: CouponsService) {}

  @Get() list() { return this.coupons.list(); }
  @Post() create(@Body() body: any) { return this.coupons.create(body); }
  @Patch(':id') update(@Param('id') id: string, @Body() body: any) { return this.coupons.update(id, body); }
}
