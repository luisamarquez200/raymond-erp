import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { SalidasService, CreateSalidaDto, UpdateSalidaDto, CreateDetalleDto, CreateAccesorioDto } from './salidas.service';
import { Public } from '../../common/decorators/public.decorator';

@Public()
@Controller('taller-r1/salidas')
export class SalidasController {
    constructor(private readonly salidasService: SalidasService) { }

    @Get()
    async findAll(@Query('estado') estado?: string) {
        return this.salidasService.findAll(estado);
    }

    @Get('available-equipos')
    async getAvailableEquipos() {
        return this.salidasService.getAvailableEquipos();
    }

    @Get('available-accesorios')
    async getAvailableAccesorios() {
        return this.salidasService.getAvailableAccesorios();
    }

    @Get('scan/:serial')
    async scanSerial(@Param('serial') serial: string) {
        return this.salidasService.scanSerial(serial);
    }

    @Get('next-folio/generate')
    async getNextFolio() {
        const folio = await this.salidasService.generateFolio();
        return { folio };
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.salidasService.findOne(id);
    }

    @Get(':id/detalles')
    async getDetalles(@Param('id') id: string) {
        return this.salidasService.getDetalles(id);
    }

    @Post()
    async create(@Body() createSalidaDto: CreateSalidaDto) {
        console.log('[SalidasController] POST / createSalidaDto:', JSON.stringify(createSalidaDto));
        return this.salidasService.create(createSalidaDto);
    }

    @Post(':id/detalles')
    async createDetalle(@Param('id') id: string, @Body() data: CreateDetalleDto) {
        return this.salidasService.createDetalle(id, data);
    }

    @Post(':id/accesorios')
    async createAccesorio(@Param('id') id: string, @Body() data: CreateAccesorioDto) {
        return this.salidasService.createAccesorio(id, data);
    }

    @Delete(':id/detalles/:id_detalle')
    async removeDetalle(@Param('id') id: string, @Param('id_detalle') id_detalle: string) {
        return this.salidasService.removeDetalle(id, id_detalle);
    }

    @Post(':id/detalles/:id_detalle/cancelar')
    async cancelarDetalle(
        @Param('id') id: string, 
        @Param('id_detalle') id_detalle: string, 
        @Body('id_ubicacion') id_ubicacion: string, 
        @Body('id_sub_ubicacion') id_sub_ubicacion: string, 
        @Body('usuario') usuario: string
    ) {
        return this.salidasService.cancelarDetalle(id, id_detalle, id_ubicacion, id_sub_ubicacion, usuario);
    }

    @Delete(':id/accesorios/:id_accesorio')
    async removeAccesorio(@Param('id') id: string, @Param('id_accesorio') id_accesorio: string) {
        return this.salidasService.removeAccesorio(id, id_accesorio);
    }

    @Patch(':id')
    async update(@Param('id') id: string, @Body() updateSalidaDto: UpdateSalidaDto) {
        return this.salidasService.update(id, updateSalidaDto);
    }

    @Patch(':id/remision')
    async updateRemision(@Param('id') id: string, @Body('remision') remision: string) {
        return this.salidasService.updateRemision(id, remision);
    }

    @Patch(':id/cerrar')
    async cerrarFolio(@Param('id') id: string) {
        return this.salidasService.cerrarFolio(id);
    }

    @Post('rapida')
    async createRapida(@Body() data: any) {
        console.log('[SalidasController] POST rapida:', JSON.stringify(data));
        return this.salidasService.createRapida(data);
    }

    @Delete(':id')
    async remove(@Param('id') id: string) {
        return this.salidasService.remove(id);
    }
}
