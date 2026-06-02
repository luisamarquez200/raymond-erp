import { Controller, Post, UseInterceptors, UploadedFile, HttpException, HttpStatus, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CargaMasivaService } from './carga-masiva.service';

@Controller('r4/carga-masiva')
export class CargaMasivaController {
    constructor(private readonly cargaMasivaService: CargaMasivaService) {}

    /**
     * POST /api/r4/carga-masiva
     * Recibe un archivo Excel (.xlsx) con el inventario de Flotilla y Rentas.
     * Crea/actualiza: Clientes, Sitios, Activos y Órdenes Mensuales (por mes).
     * Todas las rentas generadas quedan con estado = IMPORTADA y pueden
     * editarse/renovarse posteriormente desde el módulo de Rentas.
     */
    @Post()
    @UseInterceptors(FileInterceptor('file'))
    async uploadFlotillaRentas(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
        if (!file) {
            throw new HttpException('No se proporcionó un archivo', HttpStatus.BAD_REQUEST);
        }

        const userId = req.user?.id || 'sistema_importacion';
        return this.cargaMasivaService.procesarArchivo(file, userId);
    }
}
