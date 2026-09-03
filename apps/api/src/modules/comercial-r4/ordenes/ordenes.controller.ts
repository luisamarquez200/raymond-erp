import { Controller, Get, UseGuards, Post, Body, Query, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { OrdenesService, RegistrarBatchFichaOcDto } from './ordenes.service';

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

    @Post('batch-ficha-oc')
    async registrarBatchFichaOc(
        @Body() body: RegistrarBatchFichaOcDto,
        @Res() res: Response
    ) {
        try {
            const result = await this.ordenesService.registrarBatchFichaOc(body);
            return res.status(HttpStatus.CREATED).json({ success: true, ...result });
        } catch (error: any) {
            const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            return res.status(status).json({ success: false, message: error.message });
        }
    }
}
