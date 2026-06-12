import { Controller, Get, Post, Patch, Delete, Body, Param, Res, HttpStatus, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { Response } from 'express';
import { ClientesService } from './clientes.service';
import { CreateClienteDto, UpdateClienteDto } from './dto/create-cliente.dto';
import { CreateSitioDto } from './dto/create-sitio.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

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

    @Get('exportar/excel')
    async exportarExcel(@Res() res: Response) {
        try {
            const workbook = await this.clientesService.exportarExcel();
            res.setHeader(
                'Content-Type',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            );
            res.setHeader(
                'Content-Disposition',
                'attachment; filename=' + 'Directorio_Clientes_y_Distribuidores.xlsx',
            );
            await workbook.xlsx.write(res);
            res.end();
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
    @UseGuards(JwtAuthGuard)
    async crearCliente(@Body() body: CreateClienteDto, @Req() req: any, @Res() res: Response) {
        try {
            const role = req.user?.roles;
            if (role?.toUpperCase() === 'ADMINISTRADOR') {
                throw new ForbiddenException('Los usuarios con rol Administrador no tienen permiso para realizar esta operación');
            }
            const data = await this.clientesService.crearCliente(body);
            return res.status(HttpStatus.CREATED).json({ success: true, data });
        } catch (error: any) {
            const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            return res.status(status).json({ success: false, message: error.message });
        }
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard)
    async actualizarCliente(@Param('id') id: string, @Body() body: UpdateClienteDto, @Req() req: any, @Res() res: Response) {
        try {
            const role = req.user?.roles;
            if (role?.toUpperCase() === 'ADMINISTRADOR') {
                throw new ForbiddenException('Los usuarios con rol Administrador no tienen permiso para realizar esta operación');
            }
            const data = await this.clientesService.actualizarCliente(id, body);
            return res.status(HttpStatus.OK).json({ success: true, data });
        } catch (error: any) {
            const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            return res.status(status).json({ success: false, message: error.message });
        }
    }

    @Post(':clienteId/sitios')
    @UseGuards(JwtAuthGuard)
    async agregarSitio(@Param('clienteId') clienteId: string, @Body() body: CreateSitioDto, @Req() req: any, @Res() res: Response) {
        try {
            const role = req.user?.roles;
            if (role?.toUpperCase() === 'ADMINISTRADOR') {
                throw new ForbiddenException('Los usuarios con rol Administrador no tienen permiso para realizar esta operación');
            }
            const data = await this.clientesService.agregarSitio(clienteId, body);
            return res.status(HttpStatus.CREATED).json({ success: true, data });
        } catch (error: any) {
            const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            return res.status(status).json({ success: false, message: error.message });
        }
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    async eliminarCliente(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
        try {
            const role = req.user?.roles;
            if (role?.toUpperCase() === 'ADMINISTRADOR') {
                throw new ForbiddenException('Los usuarios con rol Administrador no tienen permiso para realizar esta operación');
            }
            await this.clientesService.eliminarCliente(id);
            return res.status(HttpStatus.OK).json({ success: true, message: 'Cliente eliminado exitosamente' });
        } catch (error: any) {
            const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            return res.status(status).json({ success: false, message: error.message });
        }
    }
}
