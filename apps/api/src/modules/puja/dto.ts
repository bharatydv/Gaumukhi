import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, Length } from 'class-validator';
import { BookingMode } from '@prisma/client';

export class CreateBookingDto {
  @IsString() pujaId: string;
  @IsOptional() @IsString() panditId?: string;
  @IsEnum(BookingMode) mode: BookingMode;
  @IsISO8601() date: string;          // "2026-08-10"
  @IsString() @Length(4, 5) slot: string; // "06:30"
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() addressId?: string;
  @IsOptional() @IsString() sankalpNotes?: string;
  @IsOptional() attachments?: string[];
  @IsOptional() @IsString() couponCode?: string;
}

export class AvailabilityQueryDto {
  @IsOptional() @IsISO8601() date?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() pujaId?: string;
}

export class RescheduleDto {
  @IsISO8601() date: string;
  @IsString() slot: string;
}
