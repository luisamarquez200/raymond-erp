import { Controller, Post, UseInterceptors, UploadedFile, HttpException, HttpStatus, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CargaMasivaService } from './carga-masiva.service';

@Controller('r4/carga-masiva')
export class CargaMasivaController {
    constructor(private readonly cargaMasivaService: CargaMasivaService) {}

    /**
     * POST /api/r4/carga-masiva
     * Carga completa (Administrador/Gerente): procesa todos los registros del archivo sin restricción de ADC.
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

    /**
     * POST /api/r4/carga-masiva/parcial
     * Carga parcial (ADC): solo procesa registros cuya columna ADC coincida con el nombre del usuario autenticado.
     * Los registros de otros ADCs en el archivo serán ignorados.
     */
    @Post('parcial')
    @UseInterceptors(FileInterceptor('file'))
    async uploadParcial(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
        if (!file) {
            throw new HttpException('No se proporcionó un archivo', HttpStatus.BAD_REQUEST);
        }
        const userId = req.user?.id || 'sistema_importacion';
        // Build the ADC name from the authenticated user
        const userFirstName = req.user?.firstName || req.user?.first_name || '';
        const userLastName = req.user?.lastName || req.user?.last_name || '';
        const adcNombre = `${userFirstName} ${userLastName}`.trim() || req.user?.email || '';

        if (!adcNombre) {
            throw new HttpException('No se pudo determinar el nombre del ADC autenticado.', HttpStatus.BAD_REQUEST);
        }

        return this.cargaMasivaService.procesarArchivo(file, userId, adcNombre);
    }
}
