import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes } from '@nestjs/swagger';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CatalogService } from './catalog.service';
import { ProductQueryDto, UpsertProductDto, PatchProductDto, UpdateMediaDto, UpsertCategoryDto } from './dto';
import { MAX_UPLOAD_BYTES, UploadedFile as StoredFile } from '../../common/storage.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles, Public, CurrentUser, AuthUser } from '../../common/decorators';
import { AuditService } from '../../common/audit.service';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private catalog: CatalogService, private audit: AuditService) {}

  @Public() @Get('categories')
  @ApiOperation({ summary: 'Category tree grouped for the mega-menu' })
  categories() {
    return this.catalog.listCategories();
  }

  @Public() @Get('products')
  products(@Query() q: ProductQueryDto) {
    return this.catalog.listProducts(q);
  }

  @Public() @Get('products/:slug')
  product(@Param('slug') slug: string) {
    return this.catalog.getProduct(slug);
  }

  @Public() @Get('verify/:number')
  @ApiOperation({ summary: 'Public authenticity/lab certificate lookup' })
  verify(@Param('number') number: string) {
    return this.catalog.verifyCertificate(number);
  }

  // ── admin ──────────────────────────────────────────────────────

  @Get('admin/products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CATALOGUE, Role.SUPPORT, Role.SUPER_ADMIN)
  adminProducts(@Query('q') q?: string) {
    return this.catalog.adminList(q);
  }

  @Post('products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CATALOGUE, Role.SUPER_ADMIN)
  async upsert(@Body() dto: UpsertProductDto, @CurrentUser() user: AuthUser) {
    const p = await this.catalog.upsertProduct(dto);
    await this.audit.record({
      actorId: user.id, actorRole: user.role,
      action: dto.id ? 'product.update' : 'product.create',
      entity: 'Product', entityId: p.id, diff: dto,
    });
    return p;
  }

  @Patch('products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CATALOGUE, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Change some fields of a product — price, stock, badge — without resending the rest' })
  async patch(@Param('id') id: string, @Body() dto: PatchProductDto, @CurrentUser() user: AuthUser) {
    const p = await this.catalog.patchProduct(id, dto);
    await this.audit.record({
      actorId: user.id, actorRole: user.role,
      action: 'product.update', entity: 'Product', entityId: id, diff: dto,
    });
    return p;
  }

  @Delete('products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CATALOGUE, Role.SUPER_ADMIN)
  async archive(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const r = await this.catalog.archiveProduct(id);
    await this.audit.record({ actorId: user.id, actorRole: user.role, action: 'product.archive', entity: 'Product', entityId: id });
    return r;
  }

  /* ── product images ────────────────────────────────────────────
     Uploaded from the admin console and stored as Media rows, so the photography
     is data like the price is — changing it needs no deploy. */

  @Public() @Get('products/:id/media')
  media(@Param('id') id: string) {
    return this.catalog.listMedia(id);
  }

  @Post('products/:id/media')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CATALOGUE, Role.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a product photo (field name: file)' })
  async addMedia(
    @Param('id') id: string,
    @UploadedFile() file: StoredFile,
    @Body('alt') alt: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    const m = await this.catalog.addMedia(id, file, alt);
    await this.audit.record({
      actorId: user.id, actorRole: user.role,
      action: 'product.media.add', entity: 'Product', entityId: id, diff: { mediaId: m.id },
    });
    return m;
  }

  @Patch('media/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CATALOGUE, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Rename or reorder an image — position 0 is the one shoppers see first' })
  updateMedia(@Param('id') id: string, @Body() dto: UpdateMediaDto) {
    return this.catalog.updateMedia(id, dto);
  }

  @Delete('media/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CATALOGUE, Role.SUPER_ADMIN)
  async removeMedia(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const r = await this.catalog.removeMedia(id);
    await this.audit.record({
      actorId: user.id, actorRole: user.role,
      action: 'product.media.remove', entity: 'Media', entityId: id,
    });
    return r;
  }

  @Post('categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CATALOGUE, Role.SUPER_ADMIN)
  upsertCategory(@Body() dto: UpsertCategoryDto) {
    return this.catalog.upsertCategory(dto);
  }
}
