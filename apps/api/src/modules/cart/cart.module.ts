import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { CouponsModule } from '../coupons/coupons.module';

@Module({ imports: [CouponsModule], providers: [CartService], controllers: [CartController], exports: [CartService] })
export class CartModule {}
