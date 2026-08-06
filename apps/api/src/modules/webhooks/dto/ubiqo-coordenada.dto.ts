import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional } from 'class-validator';

export class UbiqoCoordenadaDto {
    @ApiProperty({ example: 19.727404999999997, description: 'Latitud de la ubicación' })
    @IsNumber()
    Latitud: number;

    @ApiProperty({ example: -99.208863333333341, description: 'Longitud de la ubicación' })
    @IsNumber()
    Longitud: number;

    @ApiProperty({ example: '99', description: 'Nivel de batería', required: false })
    @IsString()
    @IsOptional()
    Bateria?: string;

    @ApiProperty({ example: '2018-01-09T22:21:23', description: 'Fecha y hora del dispositivo', required: false })
    @IsString()
    @IsOptional()
    FechaDispositivo?: string;

    @ApiProperty({ example: 2274.0, description: 'Altitud', required: false })
    @IsNumber()
    @IsOptional()
    Altitud?: number;

    @ApiProperty({ example: 0.0, description: 'Velocidad', required: false })
    @IsNumber()
    @IsOptional()
    Velocidad?: number;

    @ApiProperty({ example: 0.0, description: 'Orientación', required: false })
    @IsNumber()
    @IsOptional()
    Orientacion?: number;

    @ApiProperty({ example: '16', description: 'Nivel de GSM', required: false })
    @IsString()
    @IsOptional()
    NivelGsm?: string;

    @ApiProperty({ example: 1.0, description: 'Margen de error del GPS en metros', required: false })
    @IsNumber()
    @IsOptional()
    ErrorMtsGps?: number;

    @ApiProperty({ example: 'Dispositivo', description: 'Alias o nombre del dispositivo', required: false })
    @IsString()
    @IsOptional()
    Alias?: string;
}
