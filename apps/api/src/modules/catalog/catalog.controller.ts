import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CatalogService } from './catalog.service';
import { ProductQueryDto, UpsertProductDto, UpsertCategoryDto } from './dto';
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

  @Delete('products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CATALOGUE, Role.SUPER_ADMIN)
  async archive(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const r = await this.catalog.archiveProduct(id);
    await this.audit.record({ actorId: user.id, actorRole: user.role, action: 'product.archive', entity: 'Product', entityId: id });
    return r;
  }

  @Post('categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CATALOGUE, Role.SUPER_ADMIN)
  upsertCategory(@Body() dto: UpsertCategoryDto) {
    return this.catalog.upsertCategory(dto);
  }
}
