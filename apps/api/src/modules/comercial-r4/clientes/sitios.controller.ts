import { Controller, Patch, Body, Param, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ClientesService } from './clientes.service';
import { CreateSitioDto } from './dto/create-sitio.dto';

@Controller('r4/sitios')
export class SitiosController {
    constructor(private readonly clientesService: ClientesService) {}

    @Patch(':sitioId')
    async actualizarSitio(@Param('sitioId') sitioId: string, @Body() body: CreateSitioDto, @Res() res: Response) {
        try {
            const data = await this.clientesService.actualizarSitio(sitioId, body);
            return res.status(HttpStatus.OK).json({ success: true, data });
        } catch (error: any) {
            const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            return res.status(status).json({ success: false, message: error.message });
        }
    }
}
