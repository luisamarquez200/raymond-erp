import { Controller, Get, Post, Body, Res, HttpStatus, UseGuards, Req, ForbiddenException, Param } from '@nestjs/common';
import { Response } from 'express';
import { AdcsService } from './adcs.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@Controller('r4/adcs')
export class AdcsController {
    constructor(private readonly adcsService: AdcsService) {}

    @Get()
    @UseGuards(JwtAuthGuard)
    async getAdcs(@Req() req: any, @Res() res: Response) {
        try {
            const role = req.user?.roles;
            const userRole = typeof role === 'string' ? role.toUpperCase() : '';
            if (userRole !== 'ADMINISTRADOR' && userRole !== 'SUPERADMIN') {
                throw new ForbiddenException('Solo los administradores pueden ver la lista de ADCs');
            }
            const data = await this.adcsService.obtenerTodos();
            return res.status(HttpStatus.OK).json({ success: true, data });
        } catch (error: any) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
        }
    }

    @Get(':name/summary')
    @UseGuards(JwtAuthGuard)
    async getAdcSummary(@Param('name') name: string, @Req() req: any, @Res() res: Response) {
        try {
            const role = req.user?.roles;
            const userRole = typeof role === 'string' ? role.toUpperCase() : '';
            if (userRole !== 'ADMINISTRADOR' && userRole !== 'SUPERADMIN') {
                throw new ForbiddenException('Solo los administradores pueden ver el resumen del ADC');
            }
            const data = await this.adcsService.obtenerResumenAdc(name);
            return res.status(HttpStatus.OK).json({ success: true, data });
        } catch (error: any) {
            return res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
        }
    }

    @Post('crear-usuario')
    @UseGuards(JwtAuthGuard)
    async crearUsuarioAdc(@Body() body: any, @Req() req: any, @Res() res: Response) {
        try {
            const role = req.user?.roles;
            const userRole = typeof role === 'string' ? role.toUpperCase() : '';
            if (userRole !== 'ADMINISTRADOR' && userRole !== 'SUPERADMIN') {
                throw new ForbiddenException('Solo los administradores pueden crear usuarios ADC');
            }
            if (!body.name || !body.email || !body.password) {
                return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Faltan campos requeridos (name, email, password)' });
            }
            
            // Assume the user is creating the ADC in their own organization
            const organizationId = req.user.organization_id;
            if (!organizationId) {
                throw new ForbiddenException('No se encontró la organización del administrador');
            }

            const data = await this.adcsService.crearUsuarioAdc(body, organizationId);
            return res.status(HttpStatus.CREATED).json({ success: true, data });
        } catch (error: any) {
            const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            return res.status(status).json({ success: false, message: error.message });
        }
    }
}
