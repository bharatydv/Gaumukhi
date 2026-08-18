import { Module } from '@nestjs/common';
import { PujaService } from './puja.service';
import { PujaController } from './puja.controller';
import { PujaScheduler } from './puja.scheduler';
import { CouponsModule } from '../coupons/coupons.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [CouponsModule, NotificationsModule],
  providers: [PujaService, PujaScheduler],
  controllers: [PujaController],
  exports: [PujaService],
})
export class PujaModule {}
