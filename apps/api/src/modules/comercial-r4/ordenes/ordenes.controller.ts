import { Controller, Get, UseGuards, Post, Body, Query } from '@nestjs/common';
import { OrdenesService } from './ordenes.service';

@Controller(['r4/ordenes-mensuales', 'r4/ordenes'])
export class OrdenesController {
    constructor(private readonly ordenesService: OrdenesService) {}

    @Get()
    async getAll(@Query('adc') adc?: string) {
        return {
            success: true,
            data: await this.ordenesService.obtenerOrdenes(adc)
        };
    }

    @Post()
    async registrarManual(@Body() dto: { renta_id: string, periodo: string, po: string, tarifa?: number, pedido_totvs?: string, fecha_pedido_totvs?: string }) {
        if (!dto.renta_id || !dto.periodo || !dto.po) {
            throw new Error('renta_id, periodo y po son requeridos');
        }
        return {
            success: true,
            data: await this.ordenesService.registrarOrdenManual(dto)
        };
    }

    @Post('asignar-masivo')
    async asignarMasivo(@Body() dto: { renta_ids: string[], periodo: string, po: string, pedido_totvs?: string, fecha_pedido_totvs?: string }) {
        return await this.ordenesService.asignarMasivo(dto);
    }

    @Post('copiar-mes-anterior')
    async copiarMesAnterior(@Body() dto: { periodo_origen: string, periodo_destino: string, cliente_id?: string, adc?: string }) {
        return await this.ordenesService.copiarMesAnterior(dto);
    }
}
