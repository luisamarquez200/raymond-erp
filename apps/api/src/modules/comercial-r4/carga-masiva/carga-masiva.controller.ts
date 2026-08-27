import { Controller, Post, UseInterceptors, UploadedFile, HttpException, HttpStatus, Req, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CargaMasivaService } from './carga-masiva.service';

@Controller('r4/carga-masiva')
@UseGuards(JwtAuthGuard)
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
        // Build the ADC name from the authenticated user (supports adc_asociado_name, first/last name, email)
        const userFirstName = req.user?.first_name || req.user?.firstName || '';
        const userLastName = req.user?.last_name || req.user?.lastName || '';
        const fullName = `${userFirstName} ${userLastName}`.trim();
        const adcNombre = req.user?.adc_asociado_name || req.user?.adcAsociadoName || fullName || userFirstName || req.user?.email || '';

        if (!adcNombre) {
            throw new HttpException('No se pudo determinar el nombre del ADC autenticado.', HttpStatus.BAD_REQUEST);
        }

        return this.cargaMasivaService.procesarArchivo(file, userId, adcNombre);
    }
}
