import { Controller, Get, Post, Put, Patch, Delete, Body, Param } from '@nestjs/common';
import { EquipoUbicacionService, CreateEquipoUbicacionDto, MoverEquipoDto } from './equipo-ubicacion.service';
import { Public } from '../../common/decorators/public.decorator';

@Public()
@Controller('taller-r1/equipo-ubicacion')
export class EquipoUbicacionController {
    constructor(private readonly service: EquipoUbicacionService) { }

    @Get()
    async findAll() {
        return this.service.findAll();
    }

    @Post()
    async create(@Body() data: CreateEquipoUbicacionDto) {
        return this.service.create(data);
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() data: Partial<CreateEquipoUbicacionDto>) {
        return this.service.update(id, data);
    }

    @Delete(':id')
    async remove(@Param('id') id: string) {
        return this.service.remove(id);
    }

    @Post('movilizar')
    async movilizarEquipo(@Body() data: MoverEquipoDto) {
        return this.service.movilizarEquipo(data);
    }

    @Get(':id/movilizaciones')
    async getMovilizaciones(@Param('id') id_equipo_ubicacion: string) {
        return this.service.getMovilizaciones(id_equipo_ubicacion);
    }

    @Get('detail/:detailId')
    async getByDetailId(@Param('detailId') detailId: string) {
        return this.service.findByDetailId(detailId);
    }

    @Get('refacciones/catalogo')
    async getRefaccionesCatalogo() {
        return this.service.getRefaccionesCatalogo();
    }

    @Post('refacciones/catalogo')
    async createRefaccionCatalogo(@Body() data: { refaccion: string, descripcion: string, precio: number }) {
        return this.service.createRefaccionCatalogo(data);
    }

    @Put('refacciones/catalogo/:id')
    async updateRefaccionCatalogo(@Param('id') id: string, @Body() data: { refaccion?: string, descripcion?: string, precio?: number }) {
        return this.service.updateRefaccionCatalogo(Number(id), data);
    }

    @Get(':id/costos-refacciones')
    async getCostosRefacciones(@Param('id') id_equipo_ubicacion: string) {
        return this.service.getCostosRefacciones(id_equipo_ubicacion);
    }

    @Post(':id/costos-refacciones')
    async addCostoRefaccion(
        @Param('id') id_equipo_ubicacion: string, 
        @Body() data: { id_refaccion?: number, precio: number, descripcion?: string, tipo?: string, observaciones?: string }
    ) {
        return this.service.addCostoRefaccion(id_equipo_ubicacion, data);
    }

    @Delete('costos-refacciones/:costoId')
    async deleteCostoRefaccion(@Param('costoId') costoId: string) {
        return this.service.deleteCostoRefaccion(Number(costoId));
    }

    @Patch(':serial/update-estado')
    async updateEntradaDetalleEstado(@Param('serial') serial: string, @Body() data: { estado: string }) {
        return this.service.updateEntradaDetalleEstado(serial, data.estado);
    }

    @Patch(':serial/update-status-totvs')
    async updateEntradaDetalleStatusTotvs(@Param('serial') serial: string, @Body() data: { status_totvs: string }) {
        return this.service.updateEntradaDetalleStatusTotvs(serial, data.status_totvs);
    }
}
