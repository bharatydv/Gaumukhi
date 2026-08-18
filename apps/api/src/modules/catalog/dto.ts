import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, IsEnum } from 'class-validator';
import { ProductStatus } from '@prisma/client';

export class ProductQueryDto {
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) priceMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) priceMax?: number;
  @IsOptional() @IsString() mukhi?: string; // "1,3,5"
  @IsOptional() @IsString() sort?: 'featured' | 'best' | 'rating' | 'price_asc' | 'price_desc' | 'new';
  @IsOptional() @IsBoolean() @Type(() => Boolean) inStock?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() take?: number;
  @IsOptional() @IsString() cursor?: string;
}

export class UpsertProductDto {
  @IsOptional() @IsString() id?: string;
  @IsString() name: string;
  @IsString() categoryId: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() benefits?: string[];
  @IsOptional() @IsString() howToWear?: string;
  @IsOptional() @IsString() careNotes?: string;
  @IsInt() mrp: number;
  @IsInt() price: number;
  @IsOptional() gstRate?: number;
  @IsOptional() @IsInt() mukhi?: number;
  @IsOptional() @IsString() origin?: string;
  @IsOptional() @IsString() material?: string;
  @IsOptional() @IsInt() weightGrams?: number;
  @IsOptional() @IsString() artKind?: string;
  @IsOptional() @IsString() artTone?: string;
  @IsOptional() @IsString() badge?: string;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @IsBoolean() featured?: boolean;
  @IsOptional() @IsInt() stock?: number;
  @IsOptional() @IsString() metaTitle?: string;
  @IsOptional() @IsString() metaDescription?: string;
}

export class UpsertCategoryDto {
  @IsOptional() @IsString() id?: string;
  @IsString() name: string;
  @IsString() groupName: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() displayOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}
