import { Controller, Get, UseGuards } from '@nestjs/common';
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
}
