import { IsNumber, IsOptional, IsBoolean, IsString, Min, Max } from 'class-validator';

export class UpsertTipoCambioDto {
    @IsNumber()
    @Min(2000)
    @Max(2100)
    year: number;

    @IsNumber()
    @Min(1)
    @Max(12)
    month: number;

    @IsNumber()
    @Min(0.01)
    tipo_cambio: number;

    @IsOptional()
    @IsBoolean()
    activo?: boolean;

    @IsOptional()
    @IsString()
    motivo?: string;

    @IsOptional()
    @IsString()
    usuario_nombre?: string;
}
