import { Controller, Get, Query, Patch, Body } from '@nestjs/common';
import { PresupuestosService } from './presupuestos.service';

@Controller('r4/presupuestos')
export class PresupuestosController {
    constructor(private readonly presupuestosService: PresupuestosService) {}

    @Get('dashboard')
    async getDashboardStats(
        @Query('year') year: string,
        @Query('month') month: string, // '1,2,3'
        @Query('cliente_id') cliente_id?: string,
        @Query('sitio_id') sitio_id?: string,
        @Query('moneda') moneda?: string,
        @Query('adc') adc?: string
    ) {
        // Parse month which can be "8" or "8,9,10"
        const months = month ? month.split(',').map(m => parseInt(m.trim())).filter(m => !isNaN(m)) : [];

        return this.presupuestosService.getDashboardStats({
            year: parseInt(year),
            months: months, // Send as months array
            cliente_id,
            sitio_id,
            moneda,
            adc,
        });
    }

    @Patch('facturado')
    async updateFacturado(
        @Body() body: { periodo: string; moneda: string; monto: number; updated_by_id?: string; updated_by_name?: string }
    ) {
        return this.presupuestosService.updateFacturado(body);
    }
}
