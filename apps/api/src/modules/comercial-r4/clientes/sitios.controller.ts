import { Controller, Post, Patch, Delete, Body, Param, Res, HttpStatus, UseGuards, Req, ForbiddenException } from '@nestjs/common';
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
            const data = await this.clientesService.actualizarSitio(sitioId, body);
            return res.status(HttpStatus.OK).json({ success: true, data });
        } catch (error: any) {
            const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            return res.status(status).json({ success: false, message: error.message });
        }
    }

    @Post(':sitioId/fusionar/:targetId')
    @UseGuards(JwtAuthGuard)
    async fusionarSitios(@Param('sitioId') sitioId: string, @Param('targetId') targetId: string, @Req() req: any, @Res() res: Response) {
        try {
            const data = await this.clientesService.fusionarSitios(sitioId, targetId);
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
            await this.clientesService.eliminarSitio(sitioId);
            return res.status(HttpStatus.OK).json({ success: true, message: 'Sitio eliminado exitosamente' });
        } catch (error: any) {
            const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            return res.status(status).json({ success: false, message: error.message });
        }
    }
}
