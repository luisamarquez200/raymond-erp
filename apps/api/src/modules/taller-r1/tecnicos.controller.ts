import { Controller, Get, Param, Put, Body, Post, Delete } from '@nestjs/common';
import { TecnicosService } from './tecnicos.service';
import { Public } from '../../common/decorators/public.decorator';

@Public()
@Controller('taller-r1/tecnicos')
export class TecnicosController {
    constructor(private readonly tecnicosService: TecnicosService) {}

    @Get()
    async findAll() {
        return this.tecnicosService.findAll();
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.tecnicosService.findOne(id);
    }

    @Post()
    async create(@Body() data: { nombre: string; nivel_certificacion: string }) {
        return this.tecnicosService.create(data);
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() data: { nombre?: string; nivel_certificacion?: string }) {
        return this.tecnicosService.update(id, data);
    }

    @Delete(':id')
    async remove(@Param('id') id: string) {
        return this.tecnicosService.remove(id);
    }
}
