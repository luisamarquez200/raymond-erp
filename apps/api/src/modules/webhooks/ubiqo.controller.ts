import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { UbiqoCoordenadaDto } from './dto/ubiqo-coordenada.dto';
import { PrismaService } from '../../database/prisma.service';

@ApiTags('Webhooks Ubiqo')
@Controller('webhooks/ubiqo')
export class UbiqoController {
    private readonly logger = new Logger(UbiqoController.name);

    constructor(private readonly prisma: PrismaService) {}

    @Public()
    @Post('v1/Redireccion')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Recibir coordenadas GPS desde UBIQO' })
    async handleUbiqoWebhook(@Body() coordenada: UbiqoCoordenadaDto) {
        this.logger.log(`Coordenada UBIQO recibida: ${JSON.stringify(coordenada)}`);
        
        // Guardar la coordenada en la base de datos
        await this.prisma.ubiqo_coordinates.create({
            data: {
                latitud: coordenada.Latitud,
                longitud: coordenada.Longitud,
                bateria: coordenada.Bateria,
                fecha_dispositivo: coordenada.FechaDispositivo ? new Date(coordenada.FechaDispositivo) : null,
                altitud: coordenada.Altitud,
                velocidad: coordenada.Velocidad,
                orientacion: coordenada.Orientacion,
                nivel_gsm: coordenada.NivelGsm,
                error_mts_gps: coordenada.ErrorMtsGps,
                alias: coordenada.Alias,
            }
        });
        
        return { success: true, message: 'Coordenada recibida y guardada correctamente' };
    }
}
