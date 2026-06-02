import { Controller, Get, UseGuards, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { RentasService } from './rentas.service';

@Controller('r4/rentas')
export class RentasController {
    constructor(private readonly rentasService: RentasService) {}

    @Get()
    async getRentas(@Res() res: Response) {
        try {
            const data = await this.rentasService.obtenerRentas();
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
