import { Controller, Get, UseGuards, Post, Body } from '@nestjs/common';
import { OrdenesService } from './ordenes.service';

@Controller('r4/ordenes-mensuales')
export class OrdenesController {
    constructor(private readonly ordenesService: OrdenesService) {}

    @Get()
    async getAll() {
        return {
            success: true,
            data: await this.ordenesService.obtenerOrdenes()
        };
    }

    @Post()
    async registrarManual(@Body() dto: { renta_id: string, periodo: string, po: string }) {
        if (!dto.renta_id || !dto.periodo || !dto.po) {
            throw new Error('renta_id, periodo y po son requeridos');
        }
        return {
            success: true,
            data: await this.ordenesService.registrarOrdenManual(dto)
        };
    }
}
