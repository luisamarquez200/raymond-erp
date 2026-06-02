import { Controller, Get, UseGuards, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ClientesService } from './clientes.service';

@Controller('r4/clientes')
export class ClientesController {
    constructor(private readonly clientesService: ClientesService) {}

    @Get()
    async getClientes(@Res() res: Response) {
        try {
            const data = await this.clientesService.obtenerClientes();
            return res.status(HttpStatus.OK).json({
                success: true,
                data
            });
        } catch (error: any) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: error.message
            });
        }
    }
}
