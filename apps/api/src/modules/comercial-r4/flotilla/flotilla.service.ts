import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaDynamicService } from '../../../database/prisma-dynamic.service';

@Injectable()
export class FlotillaService {
    private readonly logger = new Logger(FlotillaService.name);

    constructor(private readonly prismaService: PrismaDynamicService) {}

    private getDb() {
        const db = PrismaDynamicService.clients.r4;
        if (!db) {
            throw new Error('Database client for R4 not initialized');
        }
        return db;
    }

    unificarEstatus(estatus: string): string {
        if (!estatus) return 'Activo';
        const e = estatus.trim().toUpperCase();
        if (e === 'ACTIVO' || e === 'VIGENTE' || e === 'OPERATIVO') return 'Activo';
        if (e === 'INACTIVO') return 'Inactivo';
        if (e === 'DISPONIBLE') return 'Disponible';
        if (e === 'BACK UP' || e === 'BACKUP' || e === 'BACK-UP') return 'Back Up';
        if (e === 'EN RENTA' || e === 'RENTADO') return 'En Renta';
        if (e === 'MANTENIMIENTO') return 'Mantenimiento';
        if (e === 'EN TALLER' || e === 'TALLER') return 'En Taller';
        if (e === 'INACTIVO CON CLIENTE' || e === 'INACTIVO_CLIENTE') return 'Inactivo con Cliente';
        return estatus;
    }

    async obtenerFlotilla(user?: any) {
        try {
            const db = this.getDb();
            
            let whereClause = {};
            if (user?.roles === 'ADC' && user?.first_name) {
                const fullName = `${user.first_name} ${user.last_name || ''}`.trim();
                whereClause = { adc: { contains: user.first_name } };
            }
            
            const activos = await db.activo.findMany({
                where: whereClause,
                include: {
                    cliente: true,
                    sitio: true,
                    rentas: {
                        include: {
                            detalles: true
                        }
                    },
                    ordenes: true
                }
            });

            return activos.map(activo => {
                const renta = activo.rentas?.[0];

                return {
                    id: activo.id,
                    serie: activo.serie,
                    tipo: activo.clase?.includes('III') ? 'Patín' : 'Montacargas',
                    clase: activo.clase,
                    modelo: activo.modelo,
                    estatus: this.unificarEstatus(activo.estatus_operativo),
                    estado_renta: activo.estado_renta,
                    cliente: activo.cliente?.razon_social || 'Sin Cliente',
                    cliente_id: activo.cliente_id,
                    sitio_id: activo.sitio_id,
                    site: activo.sitio?.nombre || 'Sin Sitio',
                    cuenta: activo.cuenta || '-',
                    adc: activo.adc || '-',
                    distribuidor: activo.distribuidor || '-',
                    fechaIngreso: renta?.fecha_inicio ? new Date(renta.fecha_inicio).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
                    fechaVencimiento: renta?.fecha_fin ? new Date(renta.fecha_fin).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
                    plazo: renta?.condiciones?.plazo_meses || renta?.condiciones?.plazo || '-',
                    fechaRecoleccion: '-',

                    // SMP
                    smp: 'Sin SMP',
                    proxSmp: '-',
                    responsable: activo.adc || '-',

                    // Campos adicionales de Póliza y Excel
                    renta_precio: renta?.detalles?.renta_base ?? renta?.tarifa ?? 0,
                    renta_moneda: renta?.detalles?.moneda ?? 'MXN',
                    tipo_poliza: (renta?.condiciones as any)?.tipo_poliza || 'SMP',
                    costo_poliza_distribuidor: (renta?.condiciones as any)?.costo_poliza_distribuidor ?? 0,
                    moneda_pago_distribuidor: (renta?.condiciones as any)?.moneda_pago_distribuidor ?? 'MXN'
                };
            });
        } catch (error: any) {
            this.logger.error(`Error en obtenerFlotilla: ${error.message}`);
            throw error;
        }
    }

    async obtenerCarnetEquipo(id: string) {
        const db = this.getDb();
        const activo = await db.activo.findUnique({
            where: { id },
            include: {
                cliente: true,
                sitio: true,
                rentas: {
                    include: {
                        detalles: true
                    },
                    orderBy: { created_at: 'desc' }
                },
                historial_sitios: {
                    orderBy: { fecha: 'desc' }
                }
            }
        });

        if (!activo) throw new NotFoundException(`Equipo con serie ${id} no encontrado`);

        // Fetch all sites to resolve names in the history
        const sitiosList = await db.sitio.findMany({ select: { id: true, nombre: true } });
        const mapSitios = Object.fromEntries(sitiosList.map(s => [s.id, s.nombre]));

        // Fetch user names from main DB (r1)
        const mainDb = PrismaDynamicService.clients.r1;
        const userIds = [...new Set(activo.historial_sitios.map(l => l.usuario_id).filter(Boolean))] as string[];
        let mapUsuarios: Record<string, string> = {};
        if (userIds.length > 0 && mainDb) {
            try {
                const usuarios = await mainDb.usuarios.findMany({ where: { IDUsuarios: { in: userIds } }, select: { IDUsuarios: true, Usuario: true, Correo: true } });
                mapUsuarios = Object.fromEntries(usuarios.map((u: any) => [u.IDUsuarios, u.Usuario || u.Correo?.split('@')[0]]));
            } catch (e) {
                this.logger.warn('Could not fetch user names for logs', e);
            }
        }

        // Get unique log records with parsed values if needed
        const logs = activo.historial_sitios.map(log => {
            let detail = log.motivo;
            let displaySitioId = null; // No longer return raw IDs
            const autor = log.usuario_id ? (mapUsuarios[log.usuario_id] || 'Usuario') : 'Sistema';

            try {
                if (log.motivo?.startsWith('{')) {
                    const parsed = JSON.parse(log.motivo);
                    if (parsed.tipo === 'EDICION') {
                        const keys = Object.keys(parsed.datos);
                        if (keys.length === 0) {
                             detail = 'Edición de información';
                        } else {
                             const dict: any = {
                               estatus_operativo: 'Estatus',
                               sitio_id: 'Sitio',
                               renta_precio: 'Precio de Renta',
                               renta_moneda: 'Moneda de Renta',
                               tipo_poliza: 'Tipo de Póliza',
                               costo_poliza_distribuidor: 'Costo Póliza',
                               moneda_pago_distribuidor: 'Moneda Pago',
                               distribuidor: 'Distribuidor',
                               adc: 'ADC',
                               cuenta: 'Cuenta',
                               modelo: 'Modelo',
                               clase: 'Clase'
                             };
                             
                             let summaryParts = keys.map(k => {
                               if (k === 'sitio_id') {
                                 const siteName = mapSitios[parsed.datos.sitio_id] || parsed.datos.sitio_id;
                                 return `Sitio a -> ${siteName}`;
                               }
                               if (k === 'estatus_operativo') return `Estatus a -> ${parsed.datos.estatus_operativo}`;
                               return dict[k] || k;
                             });

                             const mapped = summaryParts.join(', ');
                             detail = log.aprobado ? `Actualización por ${autor}: ${mapped}` : `Solicitud de ${autor}: ${mapped}`;
                        }
                    }
                } else if (log.motivo?.includes('Cambio de estatus')) {
                     detail = `${log.motivo} (Por: ${autor})`;
                } else if (!log.motivo?.includes('Por:')) {
                     detail = `${log.motivo} (Por: ${autor})`;
                }
            } catch (e) {}
            return {
                id: log.id,
                fecha: log.fecha,
                motivo: detail,
                aprobado: log.aprobado,
                sitioNuevoId: displaySitioId
            };
        });

        return {
            id: activo.id,
            serie: activo.serie,
            clase: activo.clase,
            modelo: activo.modelo,
            oach: activo.oach,
            altura: activo.altura,
            bc: activo.bc,
            info_tecnica: activo.info_tecnica,
            estatus: this.unificarEstatus(activo.estatus_operativo),
            cliente: activo.cliente?.razon_social || 'Sin Cliente',
            site: activo.sitio?.nombre || 'Sin Sitio',
            cuenta: activo.cuenta || '-',
            adc: activo.adc || '-',
            distribuidor: activo.distribuidor || '-',
            rentaActiva: activo.rentas.find(r => r.estado === 'VIGENTE' || r.estado === 'IMPORTADA') || null,
            historialCambios: logs
        };
    }

    async actualizarEstatus(id: string, nuevoEstatus: string, usuarioId: string) {
        const db = this.getDb();
        const activo = await db.activo.findUnique({ where: { id } });
        if (!activo) throw new NotFoundException(`Equipo con serie ${id} no encontrado`);

        const estatusAnterior = activo.estatus_operativo;
        const estatusLimpio = this.unificarEstatus(nuevoEstatus);

        const updated = await db.activo.update({
            where: { id },
            data: { estatus_operativo: estatusLimpio }
        });

        await db.cambioSitioLog.create({
            data: {
                activo_id: id,
                sitio_anterior_id: activo.sitio_id,
                sitio_nuevo_id: activo.sitio_id || 'sin_sitio',
                motivo: `Cambio de estatus: ${estatusAnterior} -> ${estatusLimpio}`,
                aprobado: true,
                usuario_id: usuarioId
            }
        });

        return updated;
    }

    async crearActivo(dto: any, usuarioId: string) {
        const db = this.getDb();
        const estatusLimpio = this.unificarEstatus(dto.estatus_operativo);

        const nuevoActivo = await db.activo.create({
            data: {
                serie: dto.serie,
                clase: dto.clase,
                modelo: dto.modelo,
                oach: dto.oach,
                altura: dto.altura,
                bc: dto.bc,
                estatus_operativo: estatusLimpio,
                cliente_id: dto.cliente_id,
                sitio_id: dto.sitio_id,
                adc: dto.adc,
                distribuidor: dto.distribuidor
            }
        });

        await db.cambioSitioLog.create({
            data: {
                activo_id: nuevoActivo.id,
                sitio_anterior_id: null,
                sitio_nuevo_id: dto.sitio_id || 'sin_sitio',
                motivo: 'Alta de equipo',
                aprobado: true,
                usuario_id: usuarioId
            }
        });

        return nuevoActivo;
    }

    async solicitarCambio(id: string, dto: any, usuarioId: string) {
        const db = this.getDb();
        const activo = await db.activo.findFirst({
            where: {
                OR: [
                    { id: id },
                    { serie: id }
                ]
            }
        });
        if (!activo) throw new NotFoundException(`Equipo con serie o ID ${id} no encontrado`);

        const log = await db.cambioSitioLog.create({
            data: {
                activo_id: activo.id,
                sitio_anterior_id: activo.sitio_id,
                sitio_nuevo_id: dto.sitio_id || activo.sitio_id || 'sin_sitio',
                motivo: JSON.stringify({
                    tipo: 'EDICION',
                    datos: dto
                }),
                aprobado: false,
                usuario_id: usuarioId
            }
        });

        return { success: true, message: 'Solicitud de cambio enviada para aprobación', logId: log.id };
    }

    async obtenerSolicitudesPendientes() {
        const db = this.getDb();
        const solicitudes = await db.cambioSitioLog.findMany({
            where: { aprobado: false },
            include: {
                activo: {
                    include: {
                        cliente: true,
                        sitio: true
                    }
                }
            },
            orderBy: { fecha: 'desc' }
        });

        return solicitudes.map(s => {
            let datosPropuestos = null;
            try {
                if (s.motivo?.startsWith('{')) {
                    datosPropuestos = JSON.parse(s.motivo);
                }
            } catch (e) {
                datosPropuestos = { tipo: 'TRANSFERENCIA', raw: s.motivo };
            }
            return {
                id: s.id,
                activoId: s.activo_id,
                activoSerie: s.activo.serie,
                activoModelo: s.activo.modelo,
                sitioAnteriorId: s.sitio_anterior_id,
                sitioNuevoId: s.sitio_nuevo_id,
                datosPropuestos,
                fecha: s.fecha,
                usuarioId: s.usuario_id
            };
        });
    }

    async aprobarSolicitud(id: string) {
        const db = this.getDb();
        const log = await db.cambioSitioLog.findUnique({ where: { id } });
        if (!log) throw new NotFoundException(`Solicitud ${id} no encontrada`);

        let datosPropuestos: any = null;
        try {
            if (log.motivo?.startsWith('{')) {
                datosPropuestos = JSON.parse(log.motivo);
            }
        } catch (e) {
            datosPropuestos = { tipo: 'TRANSFERENCIA', datos: { sitio_id: log.sitio_nuevo_id } };
        }

        if (datosPropuestos && datosPropuestos.tipo === 'EDICION') {
            const d = datosPropuestos.datos;
            const statusLimpio = d.estatus_operativo ? this.unificarEstatus(d.estatus_operativo) : undefined;
            
            await db.activo.update({
                where: { id: log.activo_id },
                data: {
                    ...(d.clase && { clase: d.clase }),
                    ...(d.modelo && { modelo: d.modelo }),
                    ...(d.cuenta && { cuenta: d.cuenta }),
                    ...(d.adc && { adc: d.adc }),
                    ...(d.distribuidor && { distribuidor: d.distribuidor }),
                    ...(d.sitio_id && { sitio_id: d.sitio_id }),
                    ...(statusLimpio && { estatus_operativo: statusLimpio }),
                }
            });

            if (d.renta_precio !== undefined || d.tipo_poliza !== undefined || d.costo_poliza_distribuidor !== undefined) {
                const rentas = await db.renta.findMany({
                    where: { activo_id: log.activo_id, estado: { in: ['VIGENTE', 'IMPORTADA'] } }
                });
                for (const renta of rentas) {
                    const condiciones = (renta.condiciones as any) || {};
                    const nuevasCondiciones = {
                        ...condiciones,
                        ...(d.tipo_poliza !== undefined && { tipo_poliza: d.tipo_poliza }),
                        ...(d.costo_poliza_distribuidor !== undefined && { costo_poliza_distribuidor: parseFloat(d.costo_poliza_distribuidor) }),
                        ...(d.moneda_pago_distribuidor !== undefined && { moneda_pago_distribuidor: d.moneda_pago_distribuidor }),
                    };

                    await db.renta.update({
                        where: { id: renta.id },
                        data: {
                            ...(d.renta_precio !== undefined && { tarifa: parseFloat(d.renta_precio) }),
                            condiciones: nuevasCondiciones
                        }
                    });

                    const detalles = await db.detallesRenta.findUnique({ where: { renta_id: renta.id } });
                    if (detalles) {
                        await db.detallesRenta.update({
                            where: { renta_id: renta.id },
                            data: {
                                ...(d.renta_precio !== undefined && { renta_base: parseFloat(d.renta_precio), renta_real: parseFloat(d.renta_precio) - detalles.descuento_dias_caidos }),
                                ...(d.renta_moneda !== undefined && { moneda: d.renta_moneda })
                            }
                        });
                    }
                }
            }
        } else {
            await db.activo.update({
                where: { id: log.activo_id },
                data: {
                    sitio_id: log.sitio_nuevo_id,
                    estatus_operativo: 'Activo'
                }
            });
        }

        await db.cambioSitioLog.update({
            where: { id },
            data: { aprobado: true }
        });

        return { success: true, message: 'Solicitud aprobada con éxito' };
    }

    async rechazarSolicitud(id: string) {
        const db = this.getDb();
        await db.cambioSitioLog.delete({ where: { id } });
        return { success: true, message: 'Solicitud rechazada y eliminada' };
    }
}

