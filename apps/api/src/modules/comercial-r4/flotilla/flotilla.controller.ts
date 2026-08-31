import { Controller, Get, Post, Put, Delete, Body, Param, Request, Res, HttpStatus, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { FlotillaService } from './flotilla.service';
import { PrismaDynamicService } from '../../../database/prisma-dynamic.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('r4/flotilla')
export class FlotillaController {
    constructor(private readonly flotillaService: FlotillaService) {}

    private getUserId(req: any): string {
        return req.user?.id || req.user?.sub || req.user?.userId || 'sistema';
    }

    @Get()
    async getFlotilla(@Request() req: any) {
        return {
            success: true,
            data: await this.flotillaService.obtenerFlotilla(req.user)
        };
    }

    @Post()
    async crearActivo(@Body() dto: any, @Request() req: any) {
        const userId = this.getUserId(req);
        return {
            success: true,
            data: await this.flotillaService.crearActivo(dto, userId)
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
    async aprobar(@Param('id') id: string, @Request() req: any) {
        const usuarioId = this.getUserId(req);
        return await this.flotillaService.aprobarSolicitud(id, usuarioId);
    }

    @Post('solicitudes/:id/rechazar')
    async rechazar(@Param('id') id: string, @Request() req: any) {
        const usuarioId = this.getUserId(req);
        return await this.flotillaService.rechazarSolicitud(id, usuarioId);
    }

    @Get('exportar/excel')
    async exportarExcel(@Request() req: any, @Res() res: Response) {
        try {
            const workbook = await this.flotillaService.exportarExcel(req.user);
            res.setHeader(
                'Content-Type',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            );
            res.setHeader(
                'Content-Disposition',
                `attachment; filename=Flotilla_${new Date().toISOString().split('T')[0]}.xlsx`,
            );
            await workbook.xlsx.write(res);
            res.end();
        } catch (error: any) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
        }
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
        
        const activoAnterior = await db.activo.findFirst({ where: { OR: [{ id }, { serie: id }] } });
        const targetId = activoAnterior?.id || id;

        const updated = await db.activo.update({
            where: { id: targetId },
            data: {
                ...(dto.clase !== undefined && { clase: dto.clase }),
                ...(dto.modelo !== undefined && { modelo: dto.modelo }),
                ...(dto.serie !== undefined && { serie: dto.serie }),
                ...(dto.tipo !== undefined && { tipo: dto.tipo }),
                ...(dto.tipo_equipo !== undefined && { tipo_equipo: dto.tipo_equipo }),
                ...(dto.cuenta !== undefined && { cuenta: dto.cuenta }),
                ...(dto.propietario !== undefined && { propietario: dto.propietario }),
                ...(dto.oach !== undefined && { oach: dto.oach }),
                ...(dto.altura !== undefined && { altura: dto.altura }),
                ...(dto.bc !== undefined && { bc: dto.bc }),
                ...(dto.marca !== undefined && { marca: dto.marca }),
                ...(dto.capacidad !== undefined && { capacidad: dto.capacidad }),
                ...(dto.capacidad_lb !== undefined && { capacidad_lb: dto.capacidad_lb }),
                ...(dto.adc !== undefined && { adc: dto.adc }),
                ...(dto.distribuidor !== undefined && { distribuidor: dto.distribuidor }),
                ...(dto.sitio_id !== undefined && { sitio_id: dto.sitio_id }),
                ...(statusLimpio && { estatus: statusLimpio, estatus_operativo: statusLimpio }),
            }
        });

        // Also check if any rent terms are edited (like tarifa, tipo_poliza etc.)
        if (dto.renta_precio !== undefined || dto.tipo_poliza !== undefined || dto.costo_poliza_distribuidor !== undefined) {
            const rentas = await db.renta.findMany({
                where: { activo_id: targetId, estado: { in: ['VIGENTE', 'IMPORTADA'] } }
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

        const userId = this.getUserId(req);
        const detalleUsuario = await this.flotillaService['obtenerDetalleUsuario'](userId);
        const sitioAnteriorObj = activoAnterior?.sitio_id ? await db.sitio.findUnique({ where: { id: activoAnterior.sitio_id } }) : null;
        const sitioNuevoObj = dto.sitio_id ? await db.sitio.findUnique({ where: { id: dto.sitio_id } }) : sitioAnteriorObj;

        await db.cambioSitioLog.create({
            data: {
                activo_id: targetId,
                sitio_anterior_id: activoAnterior?.sitio_id || null,
                sitio_nuevo_id: dto.sitio_id || activoAnterior?.sitio_id || 'sin_sitio',
                motivo: JSON.stringify({
                    tipo: 'EDICION',
                    accion_nombre: 'Edición de Equipo',
                    solicitante: detalleUsuario,
                    solicitante_id: userId,
                    aprobado_por: detalleUsuario,
                    estado: 'APROBADA',
                    sitio_anterior_nombre: sitioAnteriorObj?.nombre || 'Sin sitio anterior',
                    sitio_nuevo_nombre: sitioNuevoObj?.nombre || 'Sin sitio nuevo',
                    datos: dto
                }),
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
        @Body() body: any,
        @Request() req: any
    ) {
        const userId = this.getUserId(req);
        const estatus = typeof body === 'string' ? body : (body?.estatus || body?.estatus_operativo);
        const fechaEfectiva = body?.fecha_efectiva;
        const motivo = body?.motivo || body?.motivo_cambio;
        return {
            success: true,
            data: await this.flotillaService.actualizarEstatus(id, estatus, userId, fechaEfectiva, motivo)
        };
    }

    @Post(':id/solicitar-cambio')
    async solicitarCambio(
        @Param('id') id: string,
        @Body() dto: any,
        @Request() req: any
    ) {
        const userId = this.getUserId(req);
        return await this.flotillaService.solicitarCambio(id, dto, userId);
    }

    @Post('solicitar-alta')
    async solicitarAlta(
        @Body() dto: any,
        @Request() req: any
    ) {
        const userId = this.getUserId(req);
        return await this.flotillaService.solicitarAlta(dto, userId);
    }

    @Post(':id/solicitar-accesorios')
    async solicitarVinculoAccesorio(
        @Param('id') id: string,
        @Body() dto: { accesorio_id: string, tipo_relacion: string },
        @Request() req: any
    ) {
        const userId = this.getUserId(req);
        return await this.flotillaService.solicitarVinculoAccesorio(
            id,
            dto.accesorio_id,
            dto.tipo_relacion,
            userId
        );
    }

    @Post(':id/solicitar-desvincular-accesorios/:accesorioId')
    async solicitarDesvinculoAccesorio(
        @Param('id') id: string,
        @Param('accesorioId') accesorioId: string,
        @Request() req: any
    ) {
        const userId = this.getUserId(req);
        return await this.flotillaService.solicitarDesvinculoAccesorio(
            id,
            accesorioId,
            userId
        );
    }

    @Post(':id/accesorios')
    async vincularAccesorio(
        @Param('id') id: string,
        @Body() dto: { accesorio_id: string, tipo_relacion: string, cantidad?: number, notas?: string },
        @Request() req: any
    ) {
        const userId = this.getUserId(req);
        return {
            success: true,
            data: await this.flotillaService.vincularAccesorio(
                id,
                dto.accesorio_id,
                dto.tipo_relacion,
                dto.cantidad,
                dto.notas,
                userId
            )
        };
    }

    @Delete(':id/accesorios/:accesorioId')
    async desvincularAccesorio(
        @Param('id') id: string,
        @Param('accesorioId') accesorioId: string,
        @Request() req: any
    ) {
        const userId = this.getUserId(req);
        return await this.flotillaService.desvincularAccesorio(id, accesorioId, userId);
    }

    @Delete(':id')
    async eliminarActivo(
        @Param('id') id: string,
        @Request() req: any
    ) {
        const userId = this.getUserId(req);
        return await this.flotillaService.eliminarActivo(id, userId);
    }
}

