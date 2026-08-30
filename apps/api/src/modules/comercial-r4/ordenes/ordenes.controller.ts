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
}
