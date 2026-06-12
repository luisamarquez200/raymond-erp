import { IsString, IsOptional } from 'class-validator';

export class CreateSitioDto {
    @IsString()
    nombre: string;

    @IsString()
    @IsOptional()
    direccion?: string;

    @IsString()
    @IsOptional()
    region?: string;

    @IsString()
    @IsOptional()
    no_totvs?: string;

    @IsString()
    @IsOptional()
    responsable?: string;

    @IsString()
    @IsOptional()
    distribuidor?: string;

    @IsString()
    @IsOptional()
    distribuidor_contacto_nombre?: string;

    @IsString()
    @IsOptional()
    distribuidor_contacto_telefono?: string;

    @IsString()
    @IsOptional()
    distribuidor_contacto_correo?: string;
}
