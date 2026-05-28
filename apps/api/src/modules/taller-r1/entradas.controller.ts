import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { EntradasService, CreateEntradaDto, UpdateEntradaDto } from './entradas.service';
import { Public } from '../../common/decorators/public.decorator';

@Public()
@Controller('taller-r1/entradas')
export class EntradasController {
    constructor(private readonly entradasService: EntradasService) { }

    @Get()
    async findAll(@Query('estado') estado?: string) {
        return this.entradasService.findAll(estado);
    }

    // IMPORTANT: Specific routes must come BEFORE parameterized routes
    @Get('get-last-folio/last')
    async getLastFolio() {
        return { folio: await this.entradasService.getLastFolio() };
    }

    @Get('counts/all')
    async getCounts() {
        return this.entradasService.getCounts();
    }

    @Get('validation/serial/:serial')
    async validateSerial(@Param('serial') serial: string, @Query('tipo') tipo: string) {
        return this.entradasService.validateCrossSiteSerial(serial, tipo);
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.entradasService.findOne(id);
    }

    @Get(':id/detalles')
    async getDetalles(@Param('id') id: string) {
        return this.entradasService.getDetalles(id);
    }

    @Get(':id/accesorios')
    async getAccesorios(@Param('id') id: string) {
        return this.entradasService.getAccesorios(id);
    }

    @Post('rapida')
    async createRapida(@Body() data: any) {
        return this.entradasService.createRapida(data);
    }

    @Post()
    async create(@Body() createEntradaDto: CreateEntradaDto) {
        return this.entradasService.create(createEntradaDto);
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() updateEntradaDto: UpdateEntradaDto) {
        return this.entradasService.update(id, updateEntradaDto);
    }

    @Delete(':id')
    async remove(@Param('id') id: string) {
        return this.entradasService.remove(id);
    }

    @Post(':id/detalles')
    async createDetalle(@Param('id') id: string, @Body() data: any) {
        return this.entradasService.createDetalle(id, data);
    }

    @Put('detalles/:id')
    async updateDetalle(@Param('id') id: string, @Body() data: any) {
        return this.entradasService.updateDetalle(id, data);
    }

    @Post(':id/accesorios')
    async createAccesorio(@Param('id') id: string, @Body() data: any) {
        return this.entradasService.createAccesorio(id, data);
    }

    @Put('accesorios/:id')
    async updateAccesorio(@Param('id') id: string, @Body() data: any) {
        return this.entradasService.updateAccesorio(id, data);
    }

    @Post(':id/ubicar')
    async ubicarEquipos(@Param('id') id: string, @Body('usuario') usuario: string) {
        return this.entradasService.ubicarEquipos(id, usuario);
    }
}
