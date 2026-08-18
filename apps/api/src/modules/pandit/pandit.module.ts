import { Module } from '@nestjs/common';
import { PanditService } from './pandit.service';
import { PanditController } from './pandit.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({ imports: [NotificationsModule], providers: [PanditService], controllers: [PanditController] })
export class PanditModule {}
