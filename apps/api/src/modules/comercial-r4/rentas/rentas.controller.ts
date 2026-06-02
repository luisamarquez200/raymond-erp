import {
    Controller, Get, Post, Patch, Delete,
    Body, Param, Res, HttpStatus,
    UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { RentasService } from './rentas.service';
import { CreateRentaDto } from './dto/create-renta.dto';
import { UpdateRentaDto, UpdateDetallesRentaDto } from './dto/update-renta.dto';

@Controller('r4/rentas')
export class RentasController {
    constructor(private readonly rentasService: RentasService) {}

    @Get()
    async getRentas(@Res() res: Response) {
        try {
            const data = await this.rentasService.obtenerRentas();
            return res.status(HttpStatus.OK).json({ success: true, data });
        } catch (error: any) {
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
    async crearRenta(@Body() body: CreateRentaDto, @Res() res: Response) {
        try {
            const data = await this.rentasService.crearRenta(body);
            return res.status(HttpStatus.CREATED).json({ success: true, data });
        } catch (error: any) {
            const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            return res.status(status).json({ success: false, message: error.message });
        }
    }

    @Patch(':id')
    async actualizarRenta(@Param('id') id: string, @Body() body: UpdateRentaDto, @Res() res: Response) {
        try {
            const data = await this.rentasService.actualizarRenta(id, body);
            return res.status(HttpStatus.OK).json({ success: true, data });
        } catch (error: any) {
            const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            return res.status(status).json({ success: false, message: error.message });
        }
    }

    @Patch(':id/detalles')
    async actualizarDetalles(@Param('id') id: string, @Body() body: UpdateDetallesRentaDto, @Res() res: Response) {
        try {
            const data = await this.rentasService.actualizarDetalles(id, body);
            return res.status(HttpStatus.OK).json({ success: true, data });
        } catch (error: any) {
            const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            return res.status(status).json({ success: false, message: error.message });
        }
    }

    @Delete(':id')
    async cancelarRenta(@Param('id') id: string, @Res() res: Response) {
        try {
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
