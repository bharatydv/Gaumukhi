import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { CatalogModule } from '../catalog/catalog.module';

@Module({ imports: [NotificationsModule, CatalogModule], providers: [AdminService], controllers: [AdminController] })
export class AdminModule {}
