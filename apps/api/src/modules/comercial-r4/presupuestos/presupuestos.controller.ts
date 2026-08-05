import { Controller, Get, Query } from '@nestjs/common';
import { PresupuestosService } from './presupuestos.service';

@Controller('r4/presupuestos')
export class PresupuestosController {
    constructor(private readonly presupuestosService: PresupuestosService) {}

    @Get('dashboard')
    async getDashboardStats(
        @Query('year') year: string,
        @Query('month') month: string, // 1-12
        @Query('cliente_id') cliente_id?: string,
        @Query('sitio_id') sitio_id?: string,
        @Query('moneda') moneda?: string,
        @Query('adc') adc?: string
    ) {
        return this.presupuestosService.getDashboardStats({
            year: parseInt(year),
            month: parseInt(month),
            cliente_id,
            sitio_id,
            moneda,
            adc,
        });
    }
}
