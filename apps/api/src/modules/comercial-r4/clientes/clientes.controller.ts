import { Controller, Get, Post, Patch, Delete, Body, Param, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ClientesService } from './clientes.service';
import { CreateClienteDto, UpdateClienteDto } from './dto/create-cliente.dto';
import { CreateSitioDto } from './dto/create-sitio.dto';

@Controller('r4/clientes')
export class ClientesController {
    constructor(private readonly clientesService: ClientesService) {}

    @Get()
    async getClientes(@Res() res: Response) {
        try {
            const data = await this.clientesService.obtenerClientes();
            return res.status(HttpStatus.OK).json({ success: true, data });
        } catch (error: any) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
        }
    }

    @Get(':id')
    async getClienteById(@Param('id') id: string, @Res() res: Response) {
        try {
            const data = await this.clientesService.obtenerClientePorId(id);
            return res.status(HttpStatus.OK).json({ success: true, data });
        } catch (error: any) {
            const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            return res.status(status).json({ success: false, message: error.message });
        }
    }

    @Post()
    async crearCliente(@Body() body: CreateClienteDto, @Res() res: Response) {
        try {
            const data = await this.clientesService.crearCliente(body);
            return res.status(HttpStatus.CREATED).json({ success: true, data });
        } catch (error: any) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
        }
    }

    @Patch(':id')
    async actualizarCliente(@Param('id') id: string, @Body() body: UpdateClienteDto, @Res() res: Response) {
        try {
            const data = await this.clientesService.actualizarCliente(id, body);
            return res.status(HttpStatus.OK).json({ success: true, data });
        } catch (error: any) {
            const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            return res.status(status).json({ success: false, message: error.message });
        }
    }

    @Post(':clienteId/sitios')
    async agregarSitio(@Param('clienteId') clienteId: string, @Body() body: CreateSitioDto, @Res() res: Response) {
        try {
            const data = await this.clientesService.agregarSitio(clienteId, body);
            return res.status(HttpStatus.CREATED).json({ success: true, data });
        } catch (error: any) {
            const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            return res.status(status).json({ success: false, message: error.message });
        }
    }

    @Delete(':id')
    async eliminarCliente(@Param('id') id: string, @Res() res: Response) {
        try {
            await this.clientesService.eliminarCliente(id);
            return res.status(HttpStatus.OK).json({ success: true, message: 'Cliente eliminado exitosamente' });
        } catch (error: any) {
            const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            return res.status(status).json({ success: false, message: error.message });
        }
    }
}
