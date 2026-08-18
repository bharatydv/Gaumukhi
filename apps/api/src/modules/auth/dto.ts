import { IsEmail, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

export class RequestOtpDto {
  @Matches(/^[6-9]\d{9}$/, { message: 'Enter a valid 10-digit Indian mobile number' })
  phone: string;
}

export class VerifyOtpDto {
  @Matches(/^[6-9]\d{9}$/)
  phone: string;

  @Length(6, 6, { message: 'The code is 6 digits' })
  code: string;

  @IsOptional() @IsString()
  referralCode?: string;
}

export class EmailRegisterDto {
  @IsEmail() email: string;
  @MinLength(8, { message: 'Use at least 8 characters' }) password: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() referralCode?: string;
}

export class EmailLoginDto {
  @IsEmail() email: string;
  @IsString() password: string;
}

export class GoogleLoginDto {
  @IsString() idToken: string;
}
