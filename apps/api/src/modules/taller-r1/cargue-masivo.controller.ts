import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { CargueMasivoService } from './cargue-masivo.service';

@Controller('taller-r1/cargue-masivo')
export class CargueMasivoController {
    constructor(private readonly service: CargueMasivoService) { }

    @Get()
    async getAll() {
        return this.service.getAll();
    }

    @Post('batch')
    async createBatch(@Body() body: { data: any[] }) {
        await this.service.createBatch(body.data);
        return { success: true };
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() body: any) {
        return this.service.update(Number(id), body);
    }

    @Post()
    async create(@Body() body: any) {
        return this.service.create(body);
    }

    @Delete('all')
    async deleteAll() {
        return this.service.deleteAll();
    }

    @Delete(':id')
    async delete(@Param('id') id: string) {
        return this.service.delete(Number(id));
    }

    @Get('serial/:serial')
    async getBySerial(@Param('serial') serial: string) {
        return this.service.getBySerial(serial);
    }
}
