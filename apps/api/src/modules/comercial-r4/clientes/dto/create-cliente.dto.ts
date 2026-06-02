import { IsString, IsOptional, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSitioDto } from './create-sitio.dto';

export class DatosFiscalesDto {
    @IsString()
    @IsOptional()
    calle?: string;

    @IsString()
    @IsOptional()
    numero?: string;

    @IsString()
    @IsOptional()
    cp?: string;

    @IsString()
    @IsOptional()
    ciudad?: string;

    @IsString()
    @IsOptional()
    estado?: string;
}

export class CreateClienteDto {
    @IsString()
    razon_social: string;

    @IsString()
    rfc: string;

    @IsString()
    @IsOptional()
    adc?: string;

    @IsString()
    @IsOptional()
    moneda?: string;

    @ValidateNested()
    @Type(() => DatosFiscalesDto)
    @IsOptional()
    datos_fiscales?: DatosFiscalesDto;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateSitioDto)
    @IsOptional()
    sitios?: CreateSitioDto[];
}

export class UpdateClienteDto {
    @IsString()
    @IsOptional()
    razon_social?: string;

    @IsString()
    @IsOptional()
    rfc?: string;

    @IsString()
    @IsOptional()
    adc?: string;

    @IsString()
    @IsOptional()
    moneda?: string;

    @ValidateNested()
    @Type(() => DatosFiscalesDto)
    @IsOptional()
    datos_fiscales?: DatosFiscalesDto;

    @IsString()
    @IsOptional()
    estado?: string;
}
