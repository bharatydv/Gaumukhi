import { Body, Controller, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../common/guards';
import { Public } from '../../common/decorators';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @Post('intent')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a gateway order for an order or a booking' })
  intent(@Body() body: { orderId?: string; bookingId?: string; provider?: 'razorpay' | 'stripe' }) {
    return this.payments.createIntent(body);
  }

  @Public()
  @Post('razorpay/webhook')
  webhook(@Req() req: Request & { rawBody?: string }, @Headers('x-razorpay-signature') signature: string, @Body() body: any) {
    return this.payments.handleRazorpayWebhook(req.rawBody ?? JSON.stringify(body), signature, body);
  }

  @Post('sandbox/settle')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Dev-only: mark a payment captured without a gateway' })
  settle(@Body() body: { paymentId: string }) {
    return this.payments.simulateSuccess(body.paymentId);
  }
}
