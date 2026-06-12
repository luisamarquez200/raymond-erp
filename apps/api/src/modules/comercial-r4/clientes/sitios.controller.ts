import { Controller, Patch, Delete, Body, Param, Res, HttpStatus, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { Response } from 'express';
import { ClientesService } from './clientes.service';
import { CreateSitioDto } from './dto/create-sitio.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@Controller('r4/sitios')
export class SitiosController {
    constructor(private readonly clientesService: ClientesService) {}

    @Patch(':sitioId')
    @UseGuards(JwtAuthGuard)
    async actualizarSitio(@Param('sitioId') sitioId: string, @Body() body: CreateSitioDto, @Req() req: any, @Res() res: Response) {
        try {
            const role = req.user?.roles;
            if (role?.toUpperCase() === 'ADMINISTRADOR') {
                throw new ForbiddenException('Los usuarios con rol Administrador no tienen permiso para realizar esta operación');
            }
            const data = await this.clientesService.actualizarSitio(sitioId, body);
            return res.status(HttpStatus.OK).json({ success: true, data });
        } catch (error: any) {
            const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            return res.status(status).json({ success: false, message: error.message });
        }
    }

    @Delete(':sitioId')
    @UseGuards(JwtAuthGuard)
    async eliminarSitio(@Param('sitioId') sitioId: string, @Req() req: any, @Res() res: Response) {
        try {
            const role = req.user?.roles;
            if (role?.toUpperCase() === 'ADMINISTRADOR') {
                throw new ForbiddenException('Los usuarios con rol Administrador no tienen permiso para realizar esta operación');
            }
            await this.clientesService.eliminarSitio(sitioId);
            return res.status(HttpStatus.OK).json({ success: true, message: 'Sitio eliminado exitosamente' });
        } catch (error: any) {
            const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            return res.status(status).json({ success: false, message: error.message });
        }
    }
}
