import { IsString, IsOptional, IsNumber, IsBoolean, IsDateString, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDetallesRentaDto {
    @IsString()
    @IsOptional()
    periodo_cobro?: string;

    @IsString()
    @IsOptional()
    mes_cobro?: string;

    @IsString()
    @IsOptional()
    oc_cliente?: string;

    @IsString()
    @IsOptional()
    tipo_renta?: string;

    @IsString()
    @IsOptional()
    moneda?: string;

    @IsNumber()
    @IsOptional()
    @Min(0)
    renta_base?: number;

    @IsNumber()
    @IsOptional()
    @Min(0)
    renta_real?: number;

    @IsString()
    @IsOptional()
    comentarios?: string;

    @IsBoolean()
    @IsOptional()
    mantenimiento?: boolean;

    @IsNumber()
    @IsOptional()
    @Min(0)
    pago_mantenimiento?: number;

    @IsNumber()
    @IsOptional()
    @Min(0)
    descuento_dias_caidos?: number;

    @IsNumber()
    @IsOptional()
    @Min(0)
    importe_recuperado?: number;
}

export class CreateRentaDto {
    @IsString()
    cliente_id: string;

    @IsString()
    sitio_id: string;

    @IsString()
    activo_id: string;

    @IsString()
    @IsOptional()
    contrato_id?: string;

    @IsString()
    @IsOptional()
    cuenta?: string;

    @IsString()
    @IsOptional()
    adc?: string;

    @IsString()
    @IsOptional()
    distribuidor?: string;

    @IsString()
    @IsOptional()
    no_registro_totvs?: string;

    @IsDateString()
    @IsOptional()
    fecha_recepcion?: string;

    @IsDateString()
    @IsOptional()
    fecha_pedido_totvs?: string;

    @IsDateString()
    fecha_inicio: string;

    @IsDateString()
    fecha_fin: string;

    @IsOptional()
    plazo_meses?: any;

    @ValidateNested()
    @Type(() => CreateDetallesRentaDto)
    @IsOptional()
    detalles?: CreateDetallesRentaDto;

    @IsOptional()
    condiciones?: any;
}
