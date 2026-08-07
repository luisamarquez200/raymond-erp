import { PartialType } from '@nestjs/mapped-types';
import { IsEmail, IsString, IsOptional, IsBoolean, MinLength, IsUUID } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
    @IsEmail()
    @IsOptional()
    email?: string;

    @IsString()
    @MinLength(8)
    @IsOptional()
    password?: string;

    @IsString()
    @IsOptional()
    first_name?: string;

    @IsString()
    @IsOptional()
    last_name?: string;

    @IsUUID()
    @IsOptional()
    role_id?: string;

    @IsBoolean()
    @IsOptional()
    is_active?: boolean;

    @IsString()
    @IsOptional()
    avatar_url?: string;

    @IsString()
    @IsOptional()
    ubicacion?: string;

    @IsString()
    @IsOptional()
    adc_asociado_name?: string;
}

