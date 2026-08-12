import { Controller, Get, Post, Body, Query, Request } from '@nestjs/common';
import { TipoCambioService } from './tipo-cambio.service';
import { UpsertTipoCambioDto } from './dto/tipo-cambio.dto';

@Controller('r4/tipo-cambio')
export class TipoCambioController {
    constructor(private readonly tipoCambioService: TipoCambioService) {}

    @Get()
    async findAll(@Query('year') year?: string) {
        return this.tipoCambioService.findAll(year ? Number(year) : undefined);
    }

    @Get('periodo')
    async getRateForPeriod(@Query('year') year: string, @Query('month') month: string) {
        const rate = await this.tipoCambioService.getRateForPeriod(Number(year), Number(month));
        return { year: Number(year), month: Number(month), tipo_cambio: rate };
    }

    @Post()
    async upsertRate(@Body() dto: UpsertTipoCambioDto, @Request() req: any) {
        const userId = req.user?.id || req.user?.sub;
        const userName = req.user?.name || req.user?.nombre || req.user?.email;
        return this.tipoCambioService.upsertRate(dto, userId, userName);
    }

    @Get('historial')
    async getHistorial(@Query('year') year?: string, @Query('month') month?: string) {
        return this.tipoCambioService.getHistorial(
            year ? Number(year) : undefined,
            month ? Number(month) : undefined
        );
    }
}
