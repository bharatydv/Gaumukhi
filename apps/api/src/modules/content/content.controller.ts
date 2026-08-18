import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ContentService } from './content.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles, Public } from '../../common/decorators';

@ApiTags('content')
@Controller('content')
export class ContentController {
  constructor(private content: ContentService) {}

  @Public() @Get('posts') posts(@Query('take') take?: string) { return this.content.listPosts(Number(take) || 12); }
  @Public() @Get('posts/:slug') post(@Param('slug') slug: string) { return this.content.getPost(slug); }
  @Public() @Get('pages/:slug') page(@Param('slug') slug: string) { return this.content.getPage(slug); }
  @Public() @Get('banners') banners(@Query('placement') placement?: string) { return this.content.banners(placement); }
  @Public() @Get('home-sections') home() { return this.content.homeSections(); }
  @Public() @Get('sitemap') sitemap() { return this.content.sitemapEntries(); }

  @Post('posts') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.CATALOGUE, Role.SUPER_ADMIN)
  upsertPost(@Body() b: any) { return this.content.upsertPost(b); }

  @Post('pages') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.CATALOGUE, Role.SUPER_ADMIN)
  upsertPage(@Body() b: any) { return this.content.upsertPage(b); }

  @Post('banners') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.CATALOGUE, Role.SUPER_ADMIN)
  upsertBanner(@Body() b: any) { return this.content.upsertBanner(b); }

  @Post('home-sections') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.CATALOGUE, Role.SUPER_ADMIN)
  reorder(@Body() b: { sections: any[] }) { return this.content.reorderHome(b.sections); }
}
