import { Controller, Get, Post, Put, Body, Param, Request } from '@nestjs/common';
import { FlotillaService } from './flotilla.service';
import { PrismaDynamicService } from '../../../database/prisma-dynamic.service';

@Controller('r4/flotilla')
export class FlotillaController {
    constructor(private readonly flotillaService: FlotillaService) {}

    @Get()
    async getFlotilla() {
        return {
            success: true,
            data: await this.flotillaService.obtenerFlotilla()
        };
    }

    @Get('solicitudes')
    async getSolicitudes() {
        return {
            success: true,
            data: await this.flotillaService.obtenerSolicitudesPendientes()
        };
    }

    @Post('solicitudes/:id/aprobar')
    async aprobar(@Param('id') id: string) {
        return await this.flotillaService.aprobarSolicitud(id);
    }

    @Post('solicitudes/:id/rechazar')
    async rechazar(@Param('id') id: string) {
        return await this.flotillaService.rechazarSolicitud(id);
    }

    @Get(':id')
    async getCarnet(@Param('id') id: string) {
        return {
            success: true,
            data: await this.flotillaService.obtenerCarnetEquipo(id)
        };
    }

    @Put(':id')
    async actualizarDirecto(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
        const db = PrismaDynamicService.clients.r4;
        if (!db) throw new Error('Database client for R4 not initialized');
        const statusLimpio = dto.estatus_operativo ? this.flotillaService.unificarEstatus(dto.estatus_operativo) : undefined;
        
        const activoAnterior = await db.activo.findUnique({ where: { id } });

        const updated = await db.activo.update({
            where: { id },
            data: {
                ...(dto.clase !== undefined && { clase: dto.clase }),
                ...(dto.modelo !== undefined && { modelo: dto.modelo }),
                ...(dto.cuenta !== undefined && { cuenta: dto.cuenta }),
                ...(dto.adc !== undefined && { adc: dto.adc }),
                ...(dto.distribuidor !== undefined && { distribuidor: dto.distribuidor }),
                ...(dto.sitio_id !== undefined && { sitio_id: dto.sitio_id }),
                ...(statusLimpio && { estatus_operativo: statusLimpio }),
            }
        });

        // Also check if any rent terms are edited (like tarifa, tipo_poliza etc.)
        if (dto.renta_precio !== undefined || dto.tipo_poliza !== undefined || dto.costo_poliza_distribuidor !== undefined) {
            const rentas = await db.renta.findMany({
                where: { activo_id: id, estado: { in: ['VIGENTE', 'IMPORTADA'] } }
            });
            for (const renta of rentas) {
                const condiciones = (renta.condiciones as any) || {};
                const nuevasCondiciones = {
                    ...condiciones,
                    ...(dto.tipo_poliza !== undefined && { tipo_poliza: dto.tipo_poliza }),
                    ...(dto.costo_poliza_distribuidor !== undefined && { costo_poliza_distribuidor: parseFloat(dto.costo_poliza_distribuidor) }),
                    ...(dto.moneda_pago_distribuidor !== undefined && { moneda_pago_distribuidor: dto.moneda_pago_distribuidor }),
                };

                await db.renta.update({
                    where: { id: renta.id },
                    data: {
                        ...(dto.renta_precio !== undefined && { tarifa: parseFloat(dto.renta_precio) }),
                        condiciones: nuevasCondiciones
                    }
                });

                const detalles = await db.detallesRenta.findUnique({ where: { renta_id: renta.id } });
                if (detalles) {
                    await db.detallesRenta.update({
                        where: { renta_id: renta.id },
                        data: {
                            ...(dto.renta_precio !== undefined && { renta_base: parseFloat(dto.renta_precio), renta_real: parseFloat(dto.renta_precio) - detalles.descuento_dias_caidos }),
                            ...(dto.renta_moneda !== undefined && { moneda: dto.renta_moneda })
                        }
                    });
                }
            }
        }

        const userId = req.user?.id || 'sistema';
        await db.cambioSitioLog.create({
            data: {
                activo_id: id,
                sitio_anterior_id: activoAnterior?.sitio_id || null,
                sitio_nuevo_id: dto.sitio_id || activoAnterior?.sitio_id || 'sin_sitio',
                motivo: dto.motivo || JSON.stringify({ tipo: 'EDICION', datos: dto }),
                aprobado: true,
                usuario_id: userId
            }
        });

        return {
            success: true,
            data: updated
        };
    }

    @Put(':id/estatus')
    async actualizarEstatus(
        @Param('id') id: string,
        @Body('estatus') estatus: string,
        @Request() req: any
    ) {
        const userId = req.user?.id || 'sistema';
        return {
            success: true,
            data: await this.flotillaService.actualizarEstatus(id, estatus, userId)
        };
    }

    @Post(':id/solicitar-cambio')
    async solicitarCambio(
        @Param('id') id: string,
        @Body() dto: any,
        @Request() req: any
    ) {
        const userId = req.user?.id || 'sistema';
        return await this.flotillaService.solicitarCambio(id, dto, userId);
    }
}

