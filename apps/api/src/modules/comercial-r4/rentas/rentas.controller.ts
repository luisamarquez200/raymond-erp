import {
    Controller, Get, Post, Patch, Delete,
    Body, Param, Res, HttpStatus,
    UseInterceptors, UploadedFile, UseGuards, Req, ForbiddenException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { RentasService } from './rentas.service';
import { CreateRentaDto } from './dto/create-renta.dto';
import { UpdateRentaDto, UpdateDetallesRentaDto } from './dto/update-renta.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PrismaDynamicService } from '../../../database/prisma-dynamic.service';

@Controller('r4/rentas')
export class RentasController {
    constructor(private readonly rentasService: RentasService) {}

    @Get()
    // @UseGuards(JwtAuthGuard)
    async getRentas(@Req() req: any, @Res() res: Response) {
        try {
            const role = req.user?.roles;
            let adcName = undefined;
            if (role?.toUpperCase() === 'ADMINISTRADOR') {
                const db = PrismaDynamicService.clients.r1;
                if (db && req.user?.id) {
                    try {
                        const userObj = await db.usuarios.findUnique({ where: { IDUsuarios: req.user.id } });
                        adcName = userObj?.Usuario || req.user.email?.split('@')[0];
                    } catch (e) {
                        console.error('Error fetching ADC user details', e);
                        adcName = req.user.email?.split('@')[0];
                    }
                } else {
                    adcName = req.user?.email?.split('@')[0];
                }
            }
            const data = await this.rentasService.obtenerRentas(role, adcName);
            return res.status(HttpStatus.OK).json({ success: true, data });
        } catch (error: any) {
            console.error('CRITICAL ERROR in getRentas:', error);
            console.error(error.stack);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
        }
    }

    @Get(':id')
    async getRentaById(@Param('id') id: string, @Res() res: Response) {
        try {
            const data = await this.rentasService.obtenerRentaPorId(id);
            return res.status(HttpStatus.OK).json({ success: true, data });
        } catch (error: any) {
            const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            return res.status(status).json({ success: false, message: error.message });
        }
    }

    @Post('preview')
    async previewRenta(@Body() body: CreateRentaDto, @Res() res: Response) {
        try {
            const data = await this.rentasService.previewRenta(body);
            return res.status(HttpStatus.OK).json({ success: true, data });
        } catch (error: any) {
            const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            return res.status(status).json({ success: false, message: error.message });
        }
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    async crearRenta(@Body() body: CreateRentaDto, @Req() req: any, @Res() res: Response) {
        try {
            const role = req.user?.roles;
            if (role?.toUpperCase() === 'ADMINISTRADOR') {
                throw new ForbiddenException('Los usuarios con rol Administrador no tienen permiso para realizar esta operación');
            }
            const data = await this.rentasService.crearRenta(body);
            return res.status(HttpStatus.CREATED).json({ success: true, data });
        } catch (error: any) {
            const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            return res.status(status).json({ success: false, message: error.message });
        }
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard)
    async actualizarRenta(@Param('id') id: string, @Body() body: UpdateRentaDto, @Req() req: any, @Res() res: Response) {
        try {
            const role = req.user?.roles;
            if (role?.toUpperCase() === 'ADMINISTRADOR') {
                throw new ForbiddenException('Los usuarios con rol Administrador no tienen permiso para realizar esta operación');
            }
            const data = await this.rentasService.actualizarRenta(id, body);
            return res.status(HttpStatus.OK).json({ success: true, data });
        } catch (error: any) {
            const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            return res.status(status).json({ success: false, message: error.message });
        }
    }

    @Patch(':id/detalles')
    @UseGuards(JwtAuthGuard)
    async actualizarDetalles(@Param('id') id: string, @Body() body: UpdateDetallesRentaDto, @Req() req: any, @Res() res: Response) {
        try {
            const role = req.user?.roles;
            if (role?.toUpperCase() === 'ADMINISTRADOR') {
                throw new ForbiddenException('Los usuarios con rol Administrador no tienen permiso para realizar esta operación');
            }
            const data = await this.rentasService.actualizarDetalles(id, body);
            return res.status(HttpStatus.OK).json({ success: true, data });
        } catch (error: any) {
            const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            return res.status(status).json({ success: false, message: error.message });
        }
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    async cancelarRenta(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
        try {
            const role = req.user?.roles;
            if (role?.toUpperCase() === 'ADMINISTRADOR') {
                throw new ForbiddenException('Los usuarios con rol Administrador no tienen permiso para realizar esta operación');
            }
            const data = await this.rentasService.cancelarRenta(id);
            return res.status(HttpStatus.OK).json({ success: true, data });
        } catch (error: any) {
            const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            return res.status(status).json({ success: false, message: error.message });
        }
    }

    @Post(':id/documentos')
    @UseInterceptors(FileInterceptor('file'))
    async subirDocumento(
        @Param('id') id: string,
        @UploadedFile() file: Express.Multer.File,
        @Res() res: Response,
    ) {
        try {
            if (!file) {
                return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'No se recibió archivo. Campo esperado: "file"' });
            }
            const data = await this.rentasService.subirDocumento(id, file);
            return res.status(HttpStatus.CREATED).json({ success: true, data });
        } catch (error: any) {
            const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            return res.status(status).json({ success: false, message: error.message });
        }
    }

    @Get(':id/documentos')
    async obtenerDocumentos(@Param('id') id: string, @Res() res: Response) {
        try {
            const data = await this.rentasService.obtenerDocumentos(id);
            return res.status(HttpStatus.OK).json({ success: true, data });
        } catch (error: any) {
            const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            return res.status(status).json({ success: false, message: error.message });
        }
    }
}
