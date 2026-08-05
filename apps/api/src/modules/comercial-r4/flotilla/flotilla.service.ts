import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaDynamicService } from '../../../database/prisma-dynamic.service';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class FlotillaService {
    private readonly logger = new Logger(FlotillaService.name);

    constructor(
        private readonly prismaDynamicService: PrismaDynamicService,
        private readonly prismaService: PrismaService
    ) {}

    private getDb() {
        const db = PrismaDynamicService.clients.r4;
        if (!db) {
            throw new Error('Database client for R4 not initialized');
        }
        return db;
    }

    private async obtenerDetalleUsuario(usuarioId: string): Promise<string> {
        if (!usuarioId || usuarioId === 'sistema') return 'sistema';
        try {
            const user = await this.prismaService.users.findUnique({
                where: { id: usuarioId },
                include: { roles: true }
            });
            if (!user) return usuarioId;
            
            let detalle = `${user.first_name} ${user.last_name}`.trim();
            if (user.roles?.name === 'AUXILIAR' || user.roles?.name === 'Auxiliar') {
                if (user.adc_asociado_name) {
                    detalle += ` (Auxiliar en representación del ADC: ${user.adc_asociado_name})`;
                }
            }
            return detalle;
        } catch (e) {
            return usuarioId;
        }
    }

    private async notificarAdmins(title: string, message: string) {
        try {
            const admins = await this.prismaService.users.findMany({
                where: {
                    roles: { name: { in: ['ADMIN', 'SUPERADMIN', 'Administrador', 'Superadmin', 'SuperAdmin'] } },
                    is_active: true
                }
            });
            
            for (const admin of admins) {
                await this.prismaService.notifications.create({
                    data: {
                        user_id: admin.id,
                        title,
                        message,
                        type: 'INFO'
                    }
                });
            }
        } catch (e: any) {
            this.logger.error(`Error enviando notificación a admins: ${e.message}`);
        }
    }

    private async notificarUsuario(usuarioId: string, title: string, message: string, type: 'INFO' | 'SUCCESS' | 'ERROR' | 'WARNING' = 'INFO') {
        if (!usuarioId || usuarioId === 'sistema') return;
        try {
            await this.prismaService.notifications.create({
                data: {
                    user_id: usuarioId,
                    title,
                    message,
                    type: type as any
                }
            });
        } catch (e: any) {
            this.logger.error(`Error enviando notificación al usuario ${usuarioId}: ${e.message}`);
        }
    }

    unificarEstatus(estatus: string): string {
        if (!estatus) return 'Activo';
        const e = estatus.trim().toUpperCase();
        if (e === 'ACTIVO' || e === 'VIGENTE' || e === 'OPERATIVO' || e === 'DISPONIBLE') return 'Activo';
        if (e === 'INACTIVO') return 'Inactivo';
        if (e === 'COMODATO' || e === 'BACK UP' || e === 'BACKUP' || e === 'BACK-UP') return 'Back Up';
        if (e === 'INACTIVO CON CLIENTE' || e === 'INACTIVO - CON CLIENTE' || e === 'INACTIVO_CLIENTE' || e === 'INACTIVO  ') return 'Inactivo con Cliente';
        if (e.includes('ENTREGAR')) return 'Por Entregar';
        if (e.includes('RETIRAR')) return 'Por Retirar';
        return estatus;
    }

    async obtenerFlotilla(user?: any) {
        try {
            const db = this.getDb();
            
            let whereClause = {};
            if ((user?.roles === 'ADC' || user?.roles === 'AUXILIAR') && (user?.first_name || user?.adc_asociado_name)) {
                const target = user?.adc_asociado_name || user?.first_name;
                whereClause = { adc: { contains: target } };
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
                    ordenes: true,
                    accesorios: {
                        include: { accesorio: true }
                    },
                    equipo_principal: {
                        include: { activo: true }
                    }
                }
            });

            return activos.map(activo => {
                const renta = activo.rentas?.[0];

                return {
                    id: activo.id,
                    serie: activo.serie,
                    tipo: activo.tipo || (activo.clase?.includes('III') ? 'Walkie' : 'Contrabalanceado'),
                    clase: activo.clase,
                    modelo: activo.modelo,
                    oach: activo.oach,
                    altura: activo.altura,
                    bc: activo.bc,
                    estatus: this.unificarEstatus(activo.estatus || activo.estatus_operativo),
                    estado_renta: activo.estado_renta,
                    cliente: activo.cliente?.razon_social || 'Sin Cliente',
                    cliente_id: activo.cliente_id,
                    sitio_id: activo.sitio_id,
                    site: activo.sitio?.nombre || 'Sin Sitio',
                    cuenta: activo.cuenta || '-',
                    adc: activo.adc || '-',
                    distribuidor: activo.distribuidor || '-',
                    propietario: activo.propietario || '-',
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
                    moneda_pago_distribuidor: (renta?.condiciones as any)?.moneda_pago_distribuidor ?? 'MXN',
                    
                    accesorios: activo.accesorios?.map((acc: any) => ({
                        id: acc.accesorio.id,
                        serie: acc.accesorio.serie,
                        tipo: acc.tipo_relacion,
                        modelo: acc.accesorio.modelo
                    })) || []
                };
            });
        } catch (error: any) {
            this.logger.error(`Error en obtenerFlotilla: ${error.message}`);
            throw error;
        }
    }

    async exportarExcel(user?: any) {
        const activos = await this.obtenerFlotilla(user);
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Flotilla');
        
        worksheet.columns = [
            { header: 'Serie', key: 'serie', width: 20 },
            { header: 'Cliente', key: 'cliente', width: 30 },
            { header: 'Sitio', key: 'site', width: 25 },
            { header: 'Clase', key: 'clase', width: 15 },
            { header: 'Modelo', key: 'modelo', width: 20 },
            { header: 'Estatus', key: 'estatus', width: 20 },
            { header: 'Propietario', key: 'propietario', width: 20 },
            { header: 'Renta Mensual', key: 'renta_precio', width: 15 },
            { header: 'Moneda', key: 'renta_moneda', width: 10 },
            { header: 'Tipo Póliza', key: 'tipo_poliza', width: 15 },
            { header: 'Costo Póliza', key: 'costo_poliza_distribuidor', width: 15 },
            { header: 'Moneda Pago Dist.', key: 'moneda_pago_distribuidor', width: 15 },
            { header: 'Cuenta', key: 'cuenta', width: 15 },
            { header: 'ADC', key: 'adc', width: 20 },
            { header: 'Distribuidor', key: 'distribuidor', width: 20 },
            { header: 'Fecha Ingreso', key: 'fechaIngreso', width: 15 },
            { header: 'Fecha Venc.', key: 'fechaVencimiento', width: 15 },
            { header: 'Plazo', key: 'plazo', width: 10 },
        ];

        worksheet.addRows(activos);

        // Styling headers
        worksheet.getRow(1).eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF000000' }
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        return workbook;
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
                },
                accesorios: {
                    include: { accesorio: true }
                },
                equipo_principal: {
                    include: { activo: true }
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
                               clase: 'Clase',
                               propietario: 'Propietario'
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
            estatus: this.unificarEstatus(activo.estatus || activo.estatus_operativo),
            tipo: activo.tipo,
            cliente: activo.cliente?.razon_social || 'Sin Cliente',
            site: activo.sitio?.nombre || 'Sin Sitio',
            cuenta: activo.cuenta || '-',
            adc: activo.adc || '-',
            distribuidor: activo.distribuidor || '-',
            propietario: activo.propietario || '-',
            rentaActiva: activo.rentas.find(r => r.estado === 'VIGENTE' || r.estado === 'IMPORTADA') || null,
            historialCambios: logs
        };
    }

    async actualizarEstatus(id: string, nuevoEstatus: string, usuarioId: string) {
        const db = this.getDb();
        const activo = await db.activo.findUnique({ where: { id } });
        if (!activo) throw new NotFoundException(`Equipo con serie ${id} no encontrado`);

        const estatusAnterior = activo.estatus || activo.estatus_operativo;
        const estatusLimpio = this.unificarEstatus(nuevoEstatus);

        const updated = await db.activo.update({
            where: { id },
            data: { 
              estatus: estatusLimpio,
              estatus_operativo: estatusLimpio  // keep legacy in sync
            }
        });

        const detalleAutor = await this.obtenerDetalleUsuario(usuarioId);

        // Auditoría completa con usuario
        await db.auditoria.create({
            data: {
                modulo: 'FLOTILLA',
                registro_id: id,
                accion: 'CAMBIO_ESTATUS',
                usuario_id: usuarioId,
                valor_anterior: { estatus: estatusAnterior },
                valor_nuevo: { estatus: estatusLimpio },
                observaciones: `Cambio de estatus: ${estatusAnterior} → ${estatusLimpio}. Realizado por: ${detalleAutor}`
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
                tipo: dto.tipo,
                clase: dto.clase,
                modelo: dto.modelo,
                oach: dto.oach,
                altura: dto.altura,
                bc: dto.bc,
                estatus: estatusLimpio,
                estatus_operativo: estatusLimpio, // keep legacy in sync
                cliente_id: dto.cliente_id,
                sitio_id: dto.sitio_id,
                cuenta: dto.cuenta,
                adc: dto.adc,
                distribuidor: dto.distribuidor,
                propietario: dto.propietario
            }
        });

        const detalleAutor = await this.obtenerDetalleUsuario(usuarioId);

        // Auditoría de creación
        await db.auditoria.create({
            data: {
                modulo: 'FLOTILLA',
                registro_id: nuevoActivo.id,
                accion: 'ALTA_DIRECTA',
                usuario_id: usuarioId,
                valor_anterior: null,
                valor_nuevo: { serie: dto.serie, tipo: dto.tipo, clase: dto.clase, estatus: estatusLimpio },
                observaciones: `Alta directa de equipo ${dto.serie}. Realizado por: ${detalleAutor}`
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

        // Crear Renta si el ADC incluyó datos de renta
        let rentaCreada = null;
        if (dto.renta && (dto.renta.renta_precio || dto.renta.tipo_poliza)) {
            const defaultFin = dto.renta.fecha_fin
                ? new Date(dto.renta.fecha_fin)
                : (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d; })();

            rentaCreada = await db.renta.create({
                data: {
                    activo_id: nuevoActivo.id,
                    cliente_id: nuevoActivo.cliente_id!,
                    sitio_id: nuevoActivo.sitio_id!,
                    tarifa: dto.renta.renta_precio ?? null,
                    cuenta: dto.cuenta,
                    adc: dto.adc,
                    distribuidor: dto.distribuidor,
                    estado: 'VIGENTE',
                    origen: 'MANUAL',
                    fecha_inicio: dto.renta.fecha_inicio ? new Date(dto.renta.fecha_inicio) : new Date(),
                    fecha_fin: defaultFin,
                    condiciones: {
                        moneda: dto.renta.renta_moneda || 'MXN',
                        tipo_poliza: dto.renta.tipo_poliza || 'SMP',
                        plazo_meses: dto.renta.plazo_meses,
                        costo_poliza_distribuidor: dto.renta.costo_poliza_distribuidor,
                        moneda_pago_distribuidor: dto.renta.moneda_pago_distribuidor || 'MXN',
                    },
                    detalles: {
                        create: {
                            renta_base: dto.renta.renta_precio ?? null,
                            renta_real: dto.renta.renta_precio ?? null,
                            moneda: dto.renta.renta_moneda || 'MXN',
                            tipo_renta: 'MENSUAL',
                        }
                    }
                }
            });

            // Auditoría de renta creada junto con el equipo
            await db.auditoria.create({
                data: {
                    modulo: 'RENTAS',
                    registro_id: rentaCreada.id,
                    accion: 'RENTA_DESDE_ALTA',
                    usuario_id: usuarioId,
                    valor_anterior: null,
                    valor_nuevo: { activo_id: nuevoActivo.id, tarifa: dto.renta.renta_precio, tipo_poliza: dto.renta.tipo_poliza },
                    observaciones: `Renta creada junto con el alta de equipo ${dto.serie}`
                }
            });
        }

        return { ...nuevoActivo, renta: rentaCreada };
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

        const detalleAutor = await this.obtenerDetalleUsuario(usuarioId);

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
        
        await this.notificarAdmins(
            'Nueva Solicitud de Cambio',
            `${detalleAutor} ha solicitado un cambio/transferencia para el equipo con serie ${activo.serie}.`
        );

        return { success: true, message: 'Solicitud de cambio enviada para aprobación', logId: log.id };
    }

    async solicitarAlta(dto: any, usuarioId: string) {
        const db = this.getDb();
        const estatusLimpio = this.unificarEstatus(dto.estatus_operativo);

        const nuevoActivo = await db.activo.create({
            data: {
                serie: dto.serie,
                tipo: dto.tipo,
                clase: dto.clase,
                modelo: dto.modelo,
                oach: dto.oach,
                altura: dto.altura,
                bc: dto.bc,
                estatus: 'Inactivo',         // En espera de aprobación
                estatus_operativo: 'Inactivo', // keep legacy in sync
                cliente_id: dto.cliente_id,
                sitio_id: dto.sitio_id,
                cuenta: dto.cuenta,
                adc: dto.adc,
                distribuidor: dto.distribuidor,
                propietario: dto.propietario
            }
        });

        const detalleAutor = await this.obtenerDetalleUsuario(usuarioId);

        // Auditoría de solicitud de alta
        await db.auditoria.create({
            data: {
                modulo: 'FLOTILLA',
                registro_id: nuevoActivo.id,
                accion: 'SOLICITUD_ALTA',
                usuario_id: usuarioId,
                valor_anterior: null,
                valor_nuevo: { serie: dto.serie, tipo: dto.tipo, clase: dto.clase },
                observaciones: `Solicitud de alta enviada por ${detalleAutor} para equipo ${dto.serie}`
            }
        });

        const log = await db.cambioSitioLog.create({
            data: {
                activo_id: nuevoActivo.id,
                sitio_anterior_id: null,
                sitio_nuevo_id: dto.sitio_id || 'sin_sitio',
                motivo: JSON.stringify({
                    tipo: 'ALTA',
                    datos: {
                        ...dto,
                        estatus_operativo: estatusLimpio
                    }
                }),
                aprobado: false,
                usuario_id: usuarioId
            }
        });
        
        await this.notificarAdmins(
            'Nueva Solicitud de Alta',
            `${detalleAutor} ha solicitado el alta del equipo con serie ${dto.serie} al sistema.`
        );

        return {
            success: true,
            message: 'Solicitud de alta enviada para aprobación del Administrador',
            data: nuevoActivo,
            logId: log.id
        };
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
                activoSerie: s.activo?.serie || 'Nuevo',
                activoModelo: s.activo?.modelo || 'Nuevo',
                sitioAnteriorId: s.sitio_anterior_id,
                sitioNuevoId: s.sitio_nuevo_id,
                datosPropuestos,
                fecha: s.fecha,
                usuarioId: s.usuario_id
            };
        });
    }

    async aprobarSolicitud(id: string, usuarioAprobador?: string) {
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

        const detalleAutor = await this.obtenerDetalleUsuario(usuarioAprobador || 'sistema');

        if (datosPropuestos && (datosPropuestos.tipo === 'EDICION' || datosPropuestos.tipo === 'ALTA')) {
            const d = datosPropuestos.datos;
            const statusLimpio = d.estatus_operativo ? this.unificarEstatus(d.estatus_operativo) : 'Activo';
            
            await db.activo.update({
                where: { id: log.activo_id },
                data: {
                    ...(d.tipo && { tipo: d.tipo }),
                    ...(d.clase && { clase: d.clase }),
                    ...(d.modelo && { modelo: d.modelo }),
                    ...(d.cuenta && { cuenta: d.cuenta }),
                    ...(d.adc && { adc: d.adc }),
                    ...(d.distribuidor && { distribuidor: d.distribuidor }),
                    ...(d.propietario && { propietario: d.propietario }),
                    ...(d.sitio_id && { sitio_id: d.sitio_id }),
                    ...(statusLimpio && { 
                        estatus: statusLimpio,
                        estatus_operativo: statusLimpio  // keep legacy in sync
                    }),
                }
            });

            // Registro de auditoría: quién aprobó
            await db.auditoria.create({
                data: {
                    modulo: 'FLOTILLA',
                    registro_id: log.activo_id,
                    accion: datosPropuestos.tipo === 'ALTA' ? 'APROBACION_ALTA' : 'APROBACION_EDICION',
                    usuario_id: usuarioAprobador || log.usuario_id,
                    valor_anterior: { estado: 'PENDIENTE' },
                    valor_nuevo: { ...d, estatus: statusLimpio },
                    observaciones: `Solicitud aprobada por ${detalleAutor}`
                }
            });

            // Si es un ALTA con datos de renta, creamos la renta
            if (datosPropuestos.tipo === 'ALTA' && d.renta) {
                const defaultFin = d.renta.fecha_fin
                    ? new Date(d.renta.fecha_fin)
                    : (() => { const date = new Date(); date.setFullYear(date.getFullYear() + 1); return date; })();
                
                const activoDB = await db.activo.findUnique({ where: { id: log.activo_id } });
                
                await db.renta.create({
                    data: {
                        activo_id: log.activo_id,
                        cliente_id: d.cliente_id || activoDB?.cliente_id || '',
                        sitio_id: d.sitio_id || log.sitio_nuevo_id || 'sin_sitio',
                        tarifa: d.renta.renta_precio ?? null,
                        cuenta: d.cuenta,
                        adc: d.adc,
                        distribuidor: d.distribuidor,
                        estado: 'VIGENTE',
                        origen: 'MANUAL',
                        fecha_inicio: d.renta.fecha_inicio ? new Date(d.renta.fecha_inicio) : new Date(),
                        fecha_fin: defaultFin,
                        condiciones: {
                            moneda: d.renta.renta_moneda || 'MXN',
                            tipo_poliza: d.renta.tipo_poliza || 'SMP',
                            plazo_meses: d.renta.plazo_meses,
                            costo_poliza_distribuidor: d.renta.costo_poliza_distribuidor,
                            moneda_pago_distribuidor: d.renta.moneda_pago_distribuidor || 'MXN',
                        },
                        detalles: {
                            create: {
                                renta_base: d.renta.renta_precio ?? null,
                                renta_real: d.renta.renta_precio ?? null,
                                moneda: d.renta.renta_moneda || 'MXN',
                                tipo_renta: 'MENSUAL',
                            }
                        }
                    }
                });
            } else if (d.renta_precio !== undefined || d.tipo_poliza !== undefined || d.costo_poliza_distribuidor !== undefined) {
                // Lógica existente de actualización de renta (EDICION)
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
                    estatus: 'Activo',
                    estatus_operativo: 'Activo'  // keep legacy in sync
                }
            });

            // Auditoría de aprobación de transferencia
            await db.auditoria.create({
                data: {
                    modulo: 'FLOTILLA',
                    registro_id: log.activo_id,
                    accion: 'APROBACION_TRANSFERENCIA',
                    usuario_id: usuarioAprobador || log.usuario_id,
                    valor_anterior: { sitio_id: log.sitio_anterior_id },
                    valor_nuevo: { sitio_id: log.sitio_nuevo_id, estatus: 'Activo' },
                    observaciones: `Transferencia aprobada por ${detalleAutor}`
                }
            });
        }

        await db.cambioSitioLog.update({
            where: { id },
            data: { aprobado: true }
        });
        
        const equipo = await db.activo.findUnique({ where: { id: log.activo_id } });
        await this.notificarUsuario(
            log.usuario_id,
            'Solicitud Aprobada',
            `Tu solicitud para el equipo con serie ${equipo?.serie || log.activo_id} ha sido aprobada por ${detalleAutor}.`,
            'SUCCESS'
        );

        return { success: true, message: 'Solicitud aprobada con éxito' };
    }

    async rechazarSolicitud(id: string, usuarioAprobador?: string) {
        const db = this.getDb();
        const log = await db.cambioSitioLog.findUnique({ where: { id } });
        
        if (log) {
            const detalleAutor = await this.obtenerDetalleUsuario(usuarioAprobador || 'sistema');
            
            // Auditoría del rechazo antes de borrar
            await db.auditoria.create({
                data: {
                    modulo: 'FLOTILLA',
                    registro_id: log.activo_id,
                    accion: 'RECHAZO_SOLICITUD',
                    usuario_id: usuarioAprobador || log.usuario_id,
                    valor_anterior: { motivo: log.motivo },
                    valor_nuevo: { estado: 'RECHAZADA' },
                    observaciones: `Solicitud rechazada por ${detalleAutor}`
                }
            });
            
            const equipo = await db.activo.findUnique({ where: { id: log.activo_id } });
            await this.notificarUsuario(
                log.usuario_id,
                'Solicitud Rechazada',
                `Tu solicitud para el equipo con serie ${equipo?.serie || log.activo_id} ha sido rechazada por ${detalleAutor}.`,
                'ERROR'
            );
        }

        await db.cambioSitioLog.delete({ where: { id } });
        return { success: true, message: 'Solicitud rechazada y eliminada' };
    }

    async vincularAccesorio(activoId: string, accesorioId: string, tipoRelacion: string, cantidad: number = 1, notas: string = '', usuarioId?: string) {
        const db = this.getDb();
        const principal = await db.activo.findUnique({ where: { id: activoId } });
        const accesorio = await db.activo.findUnique({ where: { id: accesorioId } });

        if (!principal || !accesorio) {
            throw new NotFoundException('El equipo principal o el accesorio no existen');
        }

        const vinculo = await db.activoAccesorio.create({
            data: {
                activo_id: activoId,
                accesorio_id: accesorioId,
                tipo_relacion: tipoRelacion.toUpperCase(),
                cantidad,
                notas
            }
        });

        await db.auditoria.create({
            data: {
                modulo: 'FLOTILLA',
                registro_id: activoId,
                accion: 'VINCULAR_ACCESORIO',
                usuario_id: usuarioId || 'sistema',
                valor_anterior: null,
                valor_nuevo: { accesorio_id: accesorioId, serie_accesorio: accesorio.id, tipo_relacion: tipoRelacion },
                observaciones: `Se vinculó el accesorio ${accesorio.id} al equipo ${principal.id}`
            }
        });

        return vinculo;
    }

    async desvincularAccesorio(activoId: string, accesorioId: string, usuarioId?: string) {
        const db = this.getDb();
        
        const vinculo = await db.activoAccesorio.findUnique({
            where: {
                activo_id_accesorio_id: {
                    activo_id: activoId,
                    accesorio_id: accesorioId
                }
            }
        });

        if (!vinculo) {
            throw new NotFoundException('No existe el vínculo entre estos equipos');
        }

        await db.activoAccesorio.delete({
            where: {
                activo_id_accesorio_id: {
                    activo_id: activoId,
                    accesorio_id: accesorioId
                }
            }
        });

        await db.auditoria.create({
            data: {
                modulo: 'FLOTILLA',
                registro_id: activoId,
                accion: 'DESVINCULAR_ACCESORIO',
                usuario_id: usuarioId || 'sistema',
                valor_anterior: { accesorio_id: accesorioId },
                valor_nuevo: null,
                observaciones: `Se desvinculó el accesorio ${accesorioId} del equipo ${activoId}`
            }
        });

        return { success: true, message: 'Accesorio desvinculado exitosamente' };
    }
}

