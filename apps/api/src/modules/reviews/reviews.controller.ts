import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { CurrentUser, AuthUser, Roles, Public } from '../../common/decorators';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private reviews: ReviewsService) {}

  @Public() @Get('testimonials')
  testimonials(@Query('take') take?: string) { return this.reviews.testimonials(Number(take) || 6); }

  @Public() @Get('product/:productId')
  forProduct(@Param('productId') id: string) { return this.reviews.listForProduct(id); }

  @Post() @UseGuards(JwtAuthGuard)
  create(@CurrentUser() u: AuthUser, @Body() b: any) { return this.reviews.create(u.id, b); }

  @Public() @Get('questions/:productId')
  questions(@Param('productId') id: string) { return this.reviews.listQuestions(id); }

  @Public() @Post('questions/:productId')
  ask(@Param('productId') id: string, @Body() b: { body: string }) { return this.reviews.askQuestion(id, b.body); }

  @Get('admin/pending')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.SUPPORT, Role.SUPER_ADMIN)
  pending() { return this.reviews.pending(); }

  @Post('admin/:id/moderate')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.SUPPORT, Role.SUPER_ADMIN)
  moderate(@Param('id') id: string, @Body() b: { approve: boolean }) { return this.reviews.moderate(id, b.approve); }

  @Post('admin/questions/:id/answer')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.SUPPORT, Role.SUPER_ADMIN)
  answer(@Param('id') id: string, @Body() b: { answer: string }, @CurrentUser() u: AuthUser) {
    return this.reviews.answerQuestion(id, b.answer, u.id);
  }
}
