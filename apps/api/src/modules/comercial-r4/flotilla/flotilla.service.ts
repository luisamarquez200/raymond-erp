import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaDynamicService } from '../../../database/prisma-dynamic.service';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

const flotillaCache = new Map<string, { timestamp: number, data: any }>();
const FLOTILLA_CACHE_TTL = 60 * 1000; // 60 seconds

@Injectable()
export class FlotillaService {
    private readonly logger = new Logger(FlotillaService.name);
    private transporter: nodemailer.Transporter;

    constructor(
        private readonly prismaDynamicService: PrismaDynamicService,
        private readonly prismaService: PrismaService,
        private readonly configService: ConfigService
    ) {
        const host = this.configService.get<string>('SMTP_HOST');
        const port = this.configService.get<number>('SMTP_PORT');
        const user = this.configService.get<string>('SMTP_USER');
        const pass = this.configService.get<string>('SMTP_PASS');

        if (host && user && pass) {
            this.transporter = nodemailer.createTransport({
                host,
                port,
                secure: Number(port) === 465,
                auth: { user, pass },
                tls: { rejectUnauthorized: false }
            });
        }
    }

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
                    roles: { name: { in: ['ADMIN', 'SUPERADMIN', 'Administrador', 'Superadmin', 'SuperAdmin', 'GERENTE', 'Gerente', 'COORDINADOR', 'Coordinador', 'gerente', 'coordinador'] } },
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

                if (this.transporter && admin.email) {
                    try {
                        await this.transporter.sendMail({
                            from: '"Raymond ERP" <no-reply@raymond.com>',
                            to: admin.email,
                            subject: `[Raymond ERP] ${title}`,
                            text: message
                        });
                    } catch (e: any) {
                        this.logger.error(`Error enviando email a admin ${admin.email}: ${e.message}`);
                    }
                }
            }
        } catch (e: any) {
            this.logger.error(`Error enviando notificación a admins: ${e.message}`);
        }
    }

    private async notificarUsuario(
        usuarioIdOrName: string | (string | null | undefined)[],
        title: string,
        message: string,
        type: 'INFO' | 'SUCCESS' | 'ERROR' | 'WARNING' = 'INFO',
        extraNames?: (string | null | undefined)[]
    ) {
        try {
            const candidates = Array.isArray(usuarioIdOrName) ? usuarioIdOrName : [usuarioIdOrName];
            if (extraNames && Array.isArray(extraNames)) {
                candidates.push(...extraNames);
            }

            const validCandidates = candidates
                .filter(Boolean)
                .map(c => String(c).trim())
                .filter(c => c && c.toLowerCase() !== 'sistema');

            if (validCandidates.length === 0) return;

            const allUsers = await this.prismaService.users.findMany({ where: { is_active: true } });
            const targetUserIds = new Set<string>();

            for (const item of validCandidates) {
                // Direct ID match
                const directUser = allUsers.find(u => u.id === item);
                if (directUser) {
                    targetUserIds.add(directUser.id);
                    continue;
                }

                // Name / Email / ADC Name match
                const normItem = item.toLowerCase();
                for (const u of allUsers) {
                    const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase();
                    const email = (u.email || '').trim().toLowerCase();
                    const adcName = ((u as any).adc_asociado_name || '').trim().toLowerCase();

                    if (
                        (fullName && (fullName.includes(normItem) || normItem.includes(fullName))) ||
                        (email && email === normItem) ||
                        (adcName && normItem.includes(adcName))
                    ) {
                        targetUserIds.add(u.id);
                    }
                }
            }

            for (const targetId of targetUserIds) {
                await this.prismaService.notifications.create({
                    data: {
                        user_id: targetId,
                        title,
                        message,
                        type: type as any
                    }
                });

                if (this.transporter) {
                    const user = allUsers.find(u => u.id === targetId);
                    if (user?.email) {
                        try {
                            await this.transporter.sendMail({
                                from: '"Raymond ERP" <no-reply@raymond.com>',
                                to: user.email,
                                subject: `[Raymond ERP] ${title}`,
                                text: message
                            });
                        } catch (e: any) {}
                    }
                }
            }
        } catch (e: any) {
            this.logger.error(`Error enviando notificación al usuario: ${e.message}`);
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
            const roleStr = String(user?.roles || user?.role || '').toLowerCase();
            const isAdministrator = ['administrador', 'admin', 'superadmin', 'gerente', 'coordinacion', 'coordinador'].some(r => roleStr.includes(r));
            const isAdc = !isAdministrator && !!user;

            const cacheKey = user ? JSON.stringify({ r: roleStr, n: user.adc_asociado_name || user.adcAsociadoName, f: user.first_name || user.firstName }) : 'all';
            const cached = flotillaCache.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp < FLOTILLA_CACHE_TTL)) {
                return cached.data;
            }

            const db = this.getDb();
            
            const activos = await db.activo.findMany({
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

            let mappedActivos = activos;
            if (isAdc) {
                const rawTarget = (user?.adc_asociado_name || user?.adcAsociadoName || `${user?.first_name || user?.firstName || ''} ${user?.last_name || user?.lastName || ''}`.trim() || user?.first_name || user?.firstName || user?.email || '').toLowerCase();
                const adcKeywords = rawTarget.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
                const firstName = (user?.first_name || user?.firstName || '').toLowerCase().trim();

                mappedActivos = activos.filter(activo => {
                    const aAdc = (activo.adc || '').toLowerCase();
                    const sAdc = (activo.sitio?.adc || '').toLowerCase();
                    const clientComercial = (activo.cliente?.datos_comerciales as any) || {};
                    const cAdc = (clientComercial.adc || '').toLowerCase();
                    return adcKeywords.some(kw => 
                        aAdc === kw || aAdc.includes(kw) || kw.includes(aAdc) ||
                        sAdc === kw || sAdc.includes(kw) || kw.includes(sAdc) ||
                        cAdc === kw || cAdc.includes(kw) || kw.includes(cAdc)
                    ) || (firstName && (aAdc.includes(firstName) || sAdc.includes(firstName) || cAdc.includes(firstName)));
                });
            }

            const result = mappedActivos.map(activo => {
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
                    iwarehouse: (activo.info_tecnica as any)?.iwarehouse || '-',

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

            flotillaCache.set(cacheKey, { timestamp: Date.now(), data: result });
            return result;
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
        const activo = await db.activo.findFirst({
            where: {
                OR: [
                    { id: id },
                    { serie: id }
                ]
            },
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

        // Fetch user names from current system DB and fallback to legacy DB if needed
        const mainDb = PrismaDynamicService.clients.r1;
        const userIds = [...new Set(activo.historial_sitios.map(l => l.usuario_id).filter(Boolean))] as string[];
        let mapUsuarios: Record<string, string> = {};
        if (userIds.length > 0) {
            try {
                const sysUsers = await this.prismaService.users.findMany({
                    where: { id: { in: userIds } },
                    include: { roles: true }
                });
                for (const u of sysUsers) {
                    let name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;
                    if (u.roles?.name) name += ` (${u.roles.name})`;
                    mapUsuarios[u.id] = name;
                }
            } catch (e) {
                this.logger.warn('Could not fetch system users for logs', e);
            }

            if (mainDb) {
                try {
                    const usuarios = await mainDb.usuarios.findMany({ where: { IDUsuarios: { in: userIds } }, select: { IDUsuarios: true, Usuario: true, Correo: true } });
                    usuarios.forEach((u: any) => {
                        if (!mapUsuarios[u.IDUsuarios]) {
                            mapUsuarios[u.IDUsuarios] = u.Usuario || u.Correo?.split('@')[0];
                        }
                    });
                } catch (e) {
                    // Ignore fallback errors
                }
            }
        }

        // Get unique log records with parsed values if needed
        const logs = activo.historial_sitios.map(log => {
            let detail = log.motivo;
            let displaySitioId = null;
            const autor = log.usuario_id ? (mapUsuarios[log.usuario_id] || 'Usuario') : 'Sistema';
            const hasValidAutor = autor !== 'Sistema' && autor !== 'Usuario';
            let parsed: any = null;

            try {
                if (log.motivo?.startsWith('{')) {
                    parsed = JSON.parse(log.motivo);
                    const rawSol = parsed.solicitante;
                    const rawAprob = parsed.aprobado_por;
                    const rawRech = parsed.rechazado_por;

                    const isGenericSol = !rawSol || rawSol === 'sistema' || rawSol === 'Usuario' || rawSol === 'ADC / Solicitante';
                    const isGenericAprob = !rawAprob || rawAprob === 'sistema' || rawAprob === 'Sistema' || rawAprob === 'Administración';

                    const solicitanteStr = !isGenericSol
                        ? rawSol
                        : (hasValidAutor ? autor : (rawSol || 'Solicitante'));

                    const aprobadoStr = !isGenericAprob
                        ? rawAprob
                        : (log.aprobado ? (hasValidAutor ? autor : 'Administración / Gerencia') : null);

                    const rechazadoStr = (rawRech && rawRech !== 'sistema' && rawRech !== 'Sistema')
                        ? rawRech
                        : (parsed.estado === 'RECHAZADA' ? (hasValidAutor ? autor : 'Administración / Gerencia') : null);

                    const sitioAntName = parsed.sitio_anterior_nombre || (log.sitio_anterior_id ? mapSitios[log.sitio_anterior_id] : null);
                    const sitioNvoName = parsed.sitio_nuevo_nombre || (log.sitio_nuevo_id ? mapSitios[log.sitio_nuevo_id] : null);

                    if (parsed.tipo === 'TRANSFERENCIA' || parsed.accion_nombre?.includes('Transferencia')) {
                        const orig = sitioAntName || 'Sin sitio anterior';
                        const dest = sitioNvoName || 'Sin sitio nuevo';
                        if (parsed.estado === 'RECHAZADA') {
                            detail = `Transferencia Rechazada por ${rechazadoStr}: ${orig} → ${dest} (Solicitó: ${solicitanteStr})`;
                        } else if (parsed.estado === 'APROBADA' || log.aprobado) {
                            if (solicitanteStr && aprobadoStr && solicitanteStr !== aprobadoStr) {
                                detail = `Transferencia Aprobada por ${aprobadoStr}: ${orig} → ${dest} (Solicitó: ${solicitanteStr})`;
                            } else {
                                detail = `Transferencia Realizada por ${aprobadoStr || solicitanteStr}: ${orig} → ${dest}`;
                            }
                        } else {
                            detail = `Solicitud de Transferencia: ${orig} → ${dest} (Solicitó: ${solicitanteStr})`;
                        }
                    } else if (parsed.tipo === 'EDICION' || parsed.tipo === 'VINCULAR_ACCESORIO' || parsed.tipo === 'DESVINCULAR_ACCESORIO') {
                        const keys = parsed.datos ? Object.keys(parsed.datos) : [];
                        if (keys.length === 0) {
                             detail = `Edición de información por ${solicitanteStr}`;
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
                                propietario: 'Propietario',
                                accesorio_serie: 'Serie de Accesorio',
                                accesorio_modelo: 'Modelo de Accesorio',
                                tipo_relacion: 'Tipo de Relación',
                                cantidad: 'Cantidad'
                             };
                             
                             let summaryParts = keys.map(k => {
                               if (k === 'sitio_id') {
                                 const siteName = mapSitios[parsed.datos.sitio_id] || parsed.datos.sitio_id;
                                 return `Sitio: ${siteName}`;
                               }
                               if (k === 'estatus_operativo') return `Estatus: ${parsed.datos.estatus_operativo}`;
                               return `${dict[k] || k}: ${parsed.datos[k]}`;
                             });

                             const mapped = summaryParts.join(', ');
                             const actionLabel = parsed.accion_nombre || 'Actualización';
                             
                             if (parsed.estado === 'RECHAZADA') {
                                 detail = `${actionLabel} Rechazada por ${rechazadoStr}: ${mapped} (Solicitó: ${solicitanteStr})`;
                             } else if (parsed.estado === 'APROBADA' || log.aprobado) {
                                 if (rawSol && rawAprob && rawSol !== rawAprob && rawSol !== 'ADC / Solicitante') {
                                     detail = `${actionLabel} Aprobada por ${aprobadoStr}: ${mapped} (Solicitó: ${solicitanteStr})`;
                                 } else {
                                     const actor = (aprobadoStr && aprobadoStr !== 'Administración') ? aprobadoStr : (solicitanteStr || autor);
                                     detail = `${actionLabel} realizada por ${actor}: ${mapped}`;
                                 }
                             } else {
                                 detail = `Solicitud de ${actionLabel}: ${mapped} (Solicitó: ${solicitanteStr})`;
                             }
                        }
                    } else if (parsed.tipo === 'ALTA') {
                        if (parsed.estado === 'RECHAZADA') {
                            detail = `Alta rechazada por ${rechazadoStr} (Solicitó: ${solicitanteStr})`;
                        } else if (log.aprobado) {
                            if (solicitanteStr && aprobadoStr && solicitanteStr !== aprobadoStr) {
                                detail = `Alta aprobada por ${aprobadoStr} (Solicitó: ${solicitanteStr})`;
                            } else {
                                detail = `Alta de equipo realizada por ${aprobadoStr || solicitanteStr}`;
                            }
                        } else {
                            detail = `Solicitud de Alta por ${solicitanteStr}`;
                        }
                    }
                } else if (log.motivo?.includes('Cambio de estatus')) {
                     detail = `${log.motivo} (Por: ${autor})`;
                } else if (!log.motivo?.includes('Por:')) {
                     detail = `${log.motivo} (Por: ${autor})`;
                }
            } catch (e) {}

            const rawSol = parsed?.solicitante;
            const rawAprob = parsed?.aprobado_por;
            const rawRech = parsed?.rechazado_por;

            const finalSolicitante = (rawSol && rawSol !== 'sistema' && rawSol !== 'Usuario')
                ? rawSol
                : (hasValidAutor ? autor : (rawSol || 'ADC / Solicitante'));

            const finalAprobadoPor = (rawAprob && rawAprob !== 'sistema' && rawAprob !== 'Sistema')
                ? rawAprob
                : (log.aprobado ? (hasValidAutor ? autor : 'Administración') : null);

            const finalRechazadoPor = (rawRech && rawRech !== 'sistema' && rawRech !== 'Sistema')
                ? rawRech
                : (parsed?.estado === 'RECHAZADA' ? (hasValidAutor ? autor : 'Administración') : null);

            return {
                id: log.id,
                fecha: log.fecha,
                motivo: detail,
                aprobado: log.aprobado,
                sitioNuevoId: displaySitioId,
                tipo: parsed?.tipo || (log.motivo?.includes('Transferencia') ? 'TRANSFERENCIA' : 'MOVIMIENTO'),
                estado: parsed?.estado || (log.aprobado ? 'APROBADA' : 'REGISTRADA'),
                solicitante: finalSolicitante,
                aprobadoPor: finalAprobadoPor,
                rechazadoPor: finalRechazadoPor,
                sitioAnterior: parsed?.sitio_anterior_nombre || (log.sitio_anterior_id ? mapSitios[log.sitio_anterior_id] : null),
                sitioNuevo: parsed?.sitio_nuevo_nombre || (log.sitio_nuevo_id ? mapSitios[log.sitio_nuevo_id] : null),
                rawParsed: parsed
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
            accesorios: activo.accesorios?.map((acc: any) => ({
                id: acc.accesorio.id,
                serie: acc.accesorio.serie,
                modelo: acc.accesorio.modelo,
                oach: acc.accesorio.oach,
                clase: acc.accesorio.clase,
                tipo: acc.accesorio.tipo,
                tipo_relacion: acc.tipo_relacion,
                cantidad: acc.cantidad || 1,
                notas: acc.notas || ''
            })) || [],
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

    private formatFechaLarga(dateInput?: Date | string | null): string {
        if (!dateInput) return '-';
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return '-';
        
        const pad = (n: number) => n.toString().padStart(2, '0');
        const day = pad(d.getDate());
        const month = pad(d.getMonth() + 1);
        const year = d.getFullYear();
        
        let hours = d.getHours();
        const minutes = pad(d.getMinutes());
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const formattedHours = pad(hours);
        
        return `${day}/${month}/${year} ${formattedHours}:${minutes} ${ampm}`;
    }

    async solicitarCambio(id: string, dto: any, usuarioId: string) {
        const db = this.getDb();
        const activo = await db.activo.findFirst({
            where: {
                OR: [
                    { id: id },
                    { serie: id }
                ]
            },
            include: { cliente: true, sitio: true }
        });
        if (!activo) throw new NotFoundException(`Equipo con serie o ID ${id} no encontrado`);

        const detalleAutor = await this.obtenerDetalleUsuario(usuarioId);
        const sitioAnterior = await db.sitio.findUnique({ where: { id: activo.sitio_id } });
        const sitioNuevo = dto.sitio_id ? await db.sitio.findUnique({ where: { id: dto.sitio_id } }) : sitioAnterior;
        const clienteObj = activo.cliente || (dto.cliente_id ? await db.cliente.findUnique({ where: { id: dto.cliente_id } }) : null);

        const isTransfer = Boolean(dto.sitio_id && dto.sitio_id !== activo.sitio_id);
        const accionNombre = isTransfer ? 'Transferencia de Sitio' : 'Edición de Equipo';
        const fechaEnvio = new Date();
        const fechaEnvioFormatted = this.formatFechaLarga(fechaEnvio);

        const motivoData = {
            tipo: isTransfer ? 'TRANSFERENCIA' : 'EDICION',
            accion_nombre: accionNombre,
            solicitante: detalleAutor,
            solicitante_id: usuarioId,
            equipo_serie: activo.serie,
            equipo_modelo: activo.modelo || '-',
            cliente_nombre: clienteObj?.razon_social || '-',
            sitio_anterior_nombre: sitioAnterior?.nombre || 'Sin sitio anterior',
            sitio_nuevo_nombre: sitioNuevo?.nombre || 'Sin sitio nuevo',
            fecha_envio: fechaEnvio.toISOString(),
            fecha_envio_formatted: fechaEnvioFormatted,
            datos: dto
        };

        const log = await db.cambioSitioLog.create({
            data: {
                activo_id: activo.id,
                sitio_anterior_id: activo.sitio_id,
                sitio_nuevo_id: dto.sitio_id || activo.sitio_id || 'sin_sitio',
                motivo: JSON.stringify(motivoData),
                aprobado: false,
                usuario_id: usuarioId
            }
        });

        await this.notificarAdmins(
            `📋 Nueva Solicitud: ${accionNombre} - Serie: ${activo.serie}`,
            `📋 NUEVA SOLICITUD PENDIENTE DE APROBACIÓN\n` +
            `• Acción: ${accionNombre}\n` +
            `• Solicitante / ADC: ${detalleAutor}\n` +
            `• Equipo: Serie ${activo.serie} (Modelo: ${activo.modelo || '-'})\n` +
            `• Cliente: ${clienteObj?.razon_social || '-'}\n` +
            `• Sitio Anterior: ${sitioAnterior?.nombre || 'Sin sitio anterior'}\n` +
            `• Sitio Propuesto (Nuevo): ${sitioNuevo?.nombre || 'Sin sitio nuevo'}\n` +
            `• Fecha y Hora de Envío: ${fechaEnvioFormatted}`
        );

        return { success: true, message: `Solicitud de ${accionNombre.toLowerCase()} enviada para aprobación`, logId: log.id };
    }

    async solicitarAlta(dto: any, usuarioId: string) {
        // Altas de equipo son directas para todos los roles (ADC y Admin) sin requerir aprobación ni notificar a administradores
        const activo = await this.crearActivo(dto, usuarioId);
        return {
            success: true,
            message: 'Equipo registrado con éxito',
            data: activo
        };
    }

    async obtenerSolicitudesPendientes() {
        const db = this.getDb();
        const solicitudes = await db.cambioSitioLog.findMany({
            where: { 
                aprobado: false,
                motivo: { not: { contains: '"estado":"RECHAZADA"' } }
            },
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

        const result = [];
        for (const s of solicitudes) {
            let datosPropuestos: any = null;
            try {
                if (s.motivo?.startsWith('{')) {
                    datosPropuestos = JSON.parse(s.motivo);
                }
            } catch (e) {
                datosPropuestos = { tipo: 'TRANSFERENCIA', raw: s.motivo };
            }

            let solicitanteDetalle = (datosPropuestos?.solicitante && datosPropuestos.solicitante !== 'sistema' && datosPropuestos.solicitante !== 'Usuario' && datosPropuestos.solicitante !== 'ADC / Solicitante')
                ? datosPropuestos.solicitante
                : await this.obtenerDetalleUsuario(s.usuario_id);

            if (!solicitanteDetalle || solicitanteDetalle === 'sistema' || solicitanteDetalle === 'Usuario' || solicitanteDetalle === 'ADC / Solicitante') {
                solicitanteDetalle = s.activo?.adc || datosPropuestos?.datos?.adc || 'Sin especificar';
            }
            const sitioAnterior = s.sitio_anterior_id ? await db.sitio.findUnique({ where: { id: s.sitio_anterior_id } }) : null;
            const sitioNuevo = s.sitio_nuevo_id ? await db.sitio.findUnique({ where: { id: s.sitio_nuevo_id } }) : null;
            const fechaEnvioFormatted = datosPropuestos?.fecha_envio_formatted || this.formatFechaLarga(s.fecha);

            result.push({
                id: s.id,
                activoId: s.activo_id,
                activoSerie: s.activo?.serie || datosPropuestos?.equipo_serie || 'Nuevo',
                activoModelo: s.activo?.modelo || datosPropuestos?.equipo_modelo || 'Nuevo',
                solicitante: solicitanteDetalle,
                accionNombre: datosPropuestos?.accion_nombre || (datosPropuestos?.tipo === 'ALTA' ? 'Alta de Equipo' : datosPropuestos?.tipo === 'EDICION' ? 'Edición de Equipo' : 'Transferencia de Sitio'),
                sitioAnteriorId: s.sitio_anterior_id,
                sitioAnteriorNombre: datosPropuestos?.sitio_anterior_nombre || sitioAnterior?.nombre || 'Sin sitio anterior',
                sitioNuevoId: s.sitio_nuevo_id,
                sitioNuevoNombre: datosPropuestos?.sitio_nuevo_nombre || sitioNuevo?.nombre || 'Sin sitio nuevo',
                datosPropuestos,
                fecha: s.fecha,
                fechaEnvioFormatted,
                usuarioId: s.usuario_id
            });
        }
        return result;
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

        const detalleAprobador = await this.obtenerDetalleUsuario(usuarioAprobador || 'sistema');
        const fechaRespuesta = new Date();
        const fechaRespuestaFormatted = this.formatFechaLarga(fechaRespuesta);

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
                    observaciones: `Solicitud aprobada por ${detalleAprobador}. Solicitado originalmente por ${datosPropuestos.solicitante || log.usuario_id} el ${datosPropuestos.fecha_envio_formatted || this.formatFechaLarga(log.fecha)}.`
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
                // Lógica de actualización de renta (EDICION)
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
        } else if (datosPropuestos && datosPropuestos.tipo === 'VINCULAR_ACCESORIO') {
            const d = datosPropuestos.datos;
            await this.vincularAccesorio(
                log.activo_id,
                d.accesorio_id,
                d.tipo_relacion || 'ACCESORIO',
                d.cantidad || 1,
                d.notas || '',
                usuarioAprobador
            );
        } else if (datosPropuestos && datosPropuestos.tipo === 'DESVINCULAR_ACCESORIO') {
            const d = datosPropuestos.datos;
            await this.desvincularAccesorio(
                log.activo_id,
                d.accesorio_id,
                usuarioAprobador
            );
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
                    observaciones: `Transferencia aprobada por ${detalleAprobador}. Solicitado por ${datosPropuestos?.solicitante || log.usuario_id}`
                }
            });
        }

        const equipo = await db.activo.findUnique({ where: { id: log.activo_id } });
        const sitioAnteriorObj = log.sitio_anterior_id ? await db.sitio.findUnique({ where: { id: log.sitio_anterior_id } }) : null;
        const sitioNuevoObj = log.sitio_nuevo_id ? await db.sitio.findUnique({ where: { id: log.sitio_nuevo_id } }) : null;

        const accionNombre = datosPropuestos?.accion_nombre || (datosPropuestos?.tipo === 'ALTA' ? 'Alta de Equipo' : datosPropuestos?.tipo === 'EDICION' ? 'Edición de Equipo' : 'Transferencia de Sitio');
        const solicitanteNombre = datosPropuestos?.solicitante || await this.obtenerDetalleUsuario(log.usuario_id);
        const fechaEnvioFormatted = datosPropuestos?.fecha_envio_formatted || this.formatFechaLarga(log.fecha);
        const sitioAnteriorNombre = datosPropuestos?.sitio_anterior_nombre || sitioAnteriorObj?.nombre || 'Sin sitio anterior';
        const sitioNuevoNombre = datosPropuestos?.sitio_nuevo_nombre || sitioNuevoObj?.nombre || 'Sin sitio nuevo';

        // Actualizar log en la BD con todos los metadatos de respuesta
        const motivoActualizado = {
            ...datosPropuestos,
            estado: 'APROBADA',
            aprobado_por: detalleAprobador,
            aprobado_id: usuarioAprobador,
            fecha_respuesta: fechaRespuesta.toISOString(),
            fecha_respuesta_formatted: fechaRespuestaFormatted,
            sitio_anterior_nombre: sitioAnteriorNombre,
            sitio_nuevo_nombre: sitioNuevoNombre,
            solicitante: solicitanteNombre
        };

        await db.cambioSitioLog.update({
            where: { id },
            data: { 
                aprobado: true,
                motivo: JSON.stringify(motivoActualizado)
            }
        });

        // Notificar al Solicitante (ADC) con todos los detalles completos
        const candidateUserTargets = [
            log.usuario_id,
            datosPropuestos?.solicitante_id,
            solicitanteNombre,
            equipo?.adc
        ];

        await this.notificarUsuario(
            candidateUserTargets,
            `✅ Solicitud Aprobada: ${accionNombre} - Serie: ${equipo?.serie || log.activo_id}`,
            `✅ TU SOLICITUD HA SIDO APROBADA\n` +
            `• Acción: ${accionNombre}\n` +
            `• Equipo: Serie ${equipo?.serie || log.activo_id} (Modelo: ${equipo?.modelo || datosPropuestos?.equipo_modelo || '-'})\n` +
            `• Solicitante / ADC: ${solicitanteNombre}\n` +
            `• Sitio Anterior: ${sitioAnteriorNombre}\n` +
            `• Sitio Propuesto (Nuevo): ${sitioNuevoNombre}\n` +
            `• Fecha y Hora de Envío: ${fechaEnvioFormatted}\n` +
            `• Aprobado Por: ${detalleAprobador}\n` +
            `• Fecha y Hora de Aprobación: ${fechaRespuestaFormatted}\n` +
            `• Estatus Final: APROBADA`,
            'SUCCESS',
            [solicitanteNombre, equipo?.adc]
        );

        return { success: true, message: 'Solicitud aprobada con éxito' };
    }

    async rechazarSolicitud(id: string, usuarioAprobador?: string) {
        const db = this.getDb();
        const log = await db.cambioSitioLog.findUnique({ where: { id } });
        
        if (log) {
            const detalleRechazador = await this.obtenerDetalleUsuario(usuarioAprobador || 'sistema');
            const fechaRespuesta = new Date();
            const fechaRespuestaFormatted = this.formatFechaLarga(fechaRespuesta);

            let datosPropuestos: any = {};
            try { datosPropuestos = JSON.parse(log.motivo || '{}'); } catch(e) {}

            const equipo = await db.activo.findUnique({ where: { id: log.activo_id } });
            const sitioAnteriorObj = log.sitio_anterior_id ? await db.sitio.findUnique({ where: { id: log.sitio_anterior_id } }) : null;
            const sitioNuevoObj = log.sitio_nuevo_id ? await db.sitio.findUnique({ where: { id: log.sitio_nuevo_id } }) : null;

            const accionNombre = datosPropuestos?.accion_nombre || (datosPropuestos?.tipo === 'ALTA' ? 'Alta de Equipo' : datosPropuestos?.tipo === 'EDICION' ? 'Edición de Equipo' : 'Transferencia de Sitio');
            const solicitanteNombre = datosPropuestos?.solicitante || await this.obtenerDetalleUsuario(log.usuario_id);
            const fechaEnvioFormatted = datosPropuestos?.fecha_envio_formatted || this.formatFechaLarga(log.fecha);
            const sitioAnteriorNombre = datosPropuestos?.sitio_anterior_nombre || sitioAnteriorObj?.nombre || 'Sin sitio anterior';
            const sitioNuevoNombre = datosPropuestos?.sitio_nuevo_nombre || sitioNuevoObj?.nombre || 'Sin sitio nuevo';

            // Auditoría del rechazo
            await db.auditoria.create({
                data: {
                    modulo: 'FLOTILLA',
                    registro_id: log.activo_id,
                    accion: 'RECHAZO_SOLICITUD',
                    usuario_id: usuarioAprobador || log.usuario_id,
                    valor_anterior: { motivo: log.motivo },
                    valor_nuevo: { estado: 'RECHAZADA' },
                    observaciones: `Solicitud de ${accionNombre} rechazada por ${detalleRechazador}. Solicitada por ${solicitanteNombre} el ${fechaEnvioFormatted}.`
                }
            });
            
            // Notificar al Solicitante (ADC) con todos los detalles completos
            await this.notificarUsuario(
                [log.usuario_id, datosPropuestos?.solicitante_id, solicitanteNombre, equipo?.adc],
                `❌ Solicitud Rechazada: ${accionNombre} - Serie: ${equipo?.serie || log.activo_id}`,
                `❌ TU SOLICITUD HA SIDO RECHAZADA\n` +
                `• Acción: ${accionNombre}\n` +
                `• Equipo: Serie ${equipo?.serie || log.activo_id} (Modelo: ${equipo?.modelo || datosPropuestos?.equipo_modelo || '-'})\n` +
                `• Solicitante / ADC: ${solicitanteNombre}\n` +
                `• Sitio Anterior: ${sitioAnteriorNombre}\n` +
                `• Sitio Propuesto (Nuevo): ${sitioNuevoNombre}\n` +
                `• Fecha y Hora de Envío: ${fechaEnvioFormatted}\n` +
                `• Rechazado Por: ${detalleRechazador}\n` +
                `• Fecha y Hora de Rechazo: ${fechaRespuestaFormatted}\n` +
                `• Estatus Final: RECHAZADA`,
                'ERROR',
                [solicitanteNombre, equipo?.adc]
            );

            const motivoActualizado = {
                ...datosPropuestos,
                estado: 'RECHAZADA',
                rechazado_por: detalleRechazador,
                rechazado_id: usuarioAprobador,
                fecha_respuesta: fechaRespuesta.toISOString(),
                fecha_respuesta_formatted: fechaRespuestaFormatted,
                sitio_anterior_nombre: sitioAnteriorNombre,
                sitio_nuevo_nombre: sitioNuevoNombre,
                solicitante: solicitanteNombre
            };

            await db.cambioSitioLog.update({
                where: { id },
                data: { motivo: JSON.stringify(motivoActualizado) }
            });
        }

        return { success: true, message: 'Solicitud rechazada y registrada en historial' };
    }

    async solicitarVinculoAccesorio(activoId: string, accesorioId: string, tipoRelacion: string, usuarioId: string) {
        const db = this.getDb();
        const principal = await db.activo.findFirst({
            where: { OR: [{ id: activoId }, { serie: activoId }] },
            include: { cliente: true, sitio: true }
        });
        const accesorio = await db.activo.findFirst({
            where: { OR: [{ id: accesorioId }, { serie: accesorioId }] }
        });

        if (!principal || !accesorio) {
            throw new NotFoundException('El equipo principal o el accesorio no existen');
        }

        const detalleAutor = await this.obtenerDetalleUsuario(usuarioId);
        const fechaEnvio = new Date();
        const fechaEnvioFormatted = this.formatFechaLarga(fechaEnvio);
        const accionNombre = `Vincular ${tipoRelacion || 'Accesorio'}`;

        const motivoData = {
            tipo: 'VINCULAR_ACCESORIO',
            accion_nombre: accionNombre,
            solicitante: detalleAutor,
            solicitante_id: usuarioId,
            equipo_serie: principal.serie,
            equipo_modelo: principal.modelo || '-',
            cliente_nombre: principal.cliente?.razon_social || '-',
            sitio_anterior_nombre: principal.sitio?.nombre || 'Sin sitio',
            sitio_nuevo_nombre: principal.sitio?.nombre || 'Sin sitio',
            fecha_envio: fechaEnvio.toISOString(),
            fecha_envio_formatted: fechaEnvioFormatted,
            datos: {
                accesorio_id: accesorio.id,
                accesorio_serie: accesorio.serie,
                accesorio_modelo: accesorio.modelo || '-',
                tipo_relacion: tipoRelacion,
                cantidad: 1
            }
        };

        await db.auditoria.create({
            data: {
                modulo: 'FLOTILLA',
                registro_id: principal.id,
                accion: 'SOLICITUD_VINCULO_ACCESORIO',
                usuario_id: usuarioId,
                valor_anterior: null,
                valor_nuevo: { accesorio_id: accesorio.id, serie: accesorio.serie, tipo_relacion: tipoRelacion },
                observaciones: `Solicitud de vinculación de ${accesorio.serie} a equipo ${principal.serie} enviada por ${detalleAutor}`
            }
        });

        const log = await db.cambioSitioLog.create({
            data: {
                activo_id: principal.id,
                sitio_anterior_id: principal.sitio_id || null,
                sitio_nuevo_id: principal.sitio_id || 'sin_sitio',
                motivo: JSON.stringify(motivoData),
                aprobado: false,
                usuario_id: usuarioId
            }
        });

        await this.notificarAdmins(
            `📋 Nueva Solicitud: ${accionNombre} - Serie: ${principal.serie}`,
            `📋 NUEVA SOLICITUD PENDIENTE DE APROBACIÓN\n` +
            `• Acción: ${accionNombre}\n` +
            `• Solicitante / ADC: ${detalleAutor}\n` +
            `• Equipo Principal: Serie ${principal.serie} (${principal.modelo || '-'})\n` +
            `• Accesorio: Serie ${accesorio.serie} (${accesorio.modelo || '-'})\n` +
            `• Fecha y Hora de Envío: ${fechaEnvioFormatted}`
        );

        return {
            success: true,
            message: 'Solicitud de vinculación enviada para aprobación de Administración/Gerencia',
            logId: log.id
        };
    }

    async solicitarDesvinculoAccesorio(activoId: string, accesorioId: string, usuarioId: string) {
        const db = this.getDb();
        const principal = await db.activo.findFirst({
            where: { OR: [{ id: activoId }, { serie: activoId }] },
            include: { cliente: true, sitio: true }
        });
        const accesorio = await db.activo.findFirst({
            where: { OR: [{ id: accesorioId }, { serie: accesorioId }] }
        });

        if (!principal || !accesorio) {
            throw new NotFoundException('El equipo principal o el accesorio no existen');
        }

        const detalleAutor = await this.obtenerDetalleUsuario(usuarioId);
        const fechaEnvio = new Date();
        const fechaEnvioFormatted = this.formatFechaLarga(fechaEnvio);
        const accionNombre = 'Desvincular Accesorio';

        const motivoData = {
            tipo: 'DESVINCULAR_ACCESORIO',
            accion_nombre: accionNombre,
            solicitante: detalleAutor,
            solicitante_id: usuarioId,
            equipo_serie: principal.serie,
            equipo_modelo: principal.modelo || '-',
            cliente_nombre: principal.cliente?.razon_social || '-',
            sitio_anterior_nombre: principal.sitio?.nombre || 'Sin sitio',
            sitio_nuevo_nombre: principal.sitio?.nombre || 'Sin sitio',
            fecha_envio: fechaEnvio.toISOString(),
            fecha_envio_formatted: fechaEnvioFormatted,
            datos: {
                accesorio_id: accesorio.id,
                accesorio_serie: accesorio.serie,
                accesorio_modelo: accesorio.modelo || '-'
            }
        };

        await db.auditoria.create({
            data: {
                modulo: 'FLOTILLA',
                registro_id: principal.id,
                accion: 'SOLICITUD_DESVINCULO_ACCESORIO',
                usuario_id: usuarioId,
                valor_anterior: null,
                valor_nuevo: { accesorio_id: accesorio.id, serie: accesorio.serie },
                observaciones: `Solicitud de desvinculación de ${accesorio.serie} enviada por ${detalleAutor}`
            }
        });

        const log = await db.cambioSitioLog.create({
            data: {
                activo_id: principal.id,
                sitio_anterior_id: principal.sitio_id || null,
                sitio_nuevo_id: principal.sitio_id || 'sin_sitio',
                motivo: JSON.stringify(motivoData),
                aprobado: false,
                usuario_id: usuarioId
            }
        });

        await this.notificarAdmins(
            `📋 Nueva Solicitud: ${accionNombre} - Serie: ${principal.serie}`,
            `📋 NUEVA SOLICITUD PENDIENTE DE APROBACIÓN\n` +
            `• Acción: ${accionNombre}\n` +
            `• Solicitante / ADC: ${detalleAutor}\n` +
            `• Equipo Principal: Serie ${principal.serie}\n` +
            `• Accesorio a Desvincular: Serie ${accesorio.serie}\n` +
            `• Fecha y Hora de Envío: ${fechaEnvioFormatted}`
        );

        return {
            success: true,
            message: 'Solicitud de desvinculación enviada para aprobación de Administración/Gerencia',
            logId: log.id
        };
    }

    async vincularAccesorio(activoId: string, accesorioId: string, tipoRelacion: string, cantidad: number = 1, notas: string = '', usuarioId?: string) {
        const db = this.getDb();
        const principal = await db.activo.findFirst({
            where: { OR: [{ id: activoId }, { serie: activoId }] }
        });
        const accesorio = await db.activo.findFirst({
            where: { OR: [{ id: accesorioId }, { serie: accesorioId }] }
        });

        if (!principal || !accesorio) {
            throw new NotFoundException('El equipo principal o el accesorio no existen');
        }

        const vinculo = await db.activoAccesorio.upsert({
            where: {
                activo_id_accesorio_id: {
                    activo_id: principal.id,
                    accesorio_id: accesorio.id
                }
            },
            update: {
                tipo_relacion: tipoRelacion.toUpperCase(),
                cantidad,
                notas
            },
            create: {
                activo_id: principal.id,
                accesorio_id: accesorio.id,
                tipo_relacion: tipoRelacion.toUpperCase(),
                cantidad,
                notas
            }
        });

        const detalleUsuario = await this.obtenerDetalleUsuario(usuarioId || 'sistema');

        await db.auditoria.create({
            data: {
                modulo: 'FLOTILLA',
                registro_id: principal.id,
                accion: 'VINCULAR_ACCESORIO',
                usuario_id: usuarioId || 'sistema',
                valor_anterior: null,
                valor_nuevo: { accesorio_id: accesorio.id, serie_accesorio: accesorio.serie, modelo: accesorio.modelo, tipo_relacion: tipoRelacion, cantidad },
                observaciones: `Se vinculó el accesorio ${accesorio.tipo || 'ACCESORIO'} (Serie: ${accesorio.serie}, Modelo: ${accesorio.modelo || '-'}) al equipo (Serie: ${principal.serie}). Realizado por: ${detalleUsuario}`
            }
        });

        await db.cambioSitioLog.create({
            data: {
                activo_id: principal.id,
                sitio_anterior_id: principal.sitio_id || null,
                sitio_nuevo_id: principal.sitio_id || 'sin_sitio',
                motivo: JSON.stringify({
                    tipo: 'EDICION',
                    accion_nombre: 'Vincular Accesorio',
                    solicitante: detalleUsuario,
                    solicitante_id: usuarioId || 'sistema',
                    estado: 'APROBADA',
                    aprobado_por: detalleUsuario,
                    datos: {
                        accesorio_serie: accesorio.serie,
                        accesorio_modelo: accesorio.modelo || '-',
                        tipo_relacion: tipoRelacion,
                        cantidad
                    }
                }),
                aprobado: true,
                usuario_id: usuarioId || 'sistema'
            }
        });

        return vinculo;
    }

    async desvincularAccesorio(activoId: string, accesorioId: string, usuarioId?: string) {
        const db = this.getDb();
        const principal = await db.activo.findFirst({
            where: { OR: [{ id: activoId }, { serie: activoId }] }
        });
        const accesorio = await db.activo.findFirst({
            where: { OR: [{ id: accesorioId }, { serie: accesorioId }] }
        });

        if (!principal || !accesorio) {
            throw new NotFoundException('El equipo principal o el accesorio no existen');
        }

        const vinculo = await db.activoAccesorio.findUnique({
            where: {
                activo_id_accesorio_id: {
                    activo_id: principal.id,
                    accesorio_id: accesorio.id
                }
            }
        });

        if (!vinculo) {
            throw new NotFoundException('No existe el vínculo entre estos equipos');
        }

        await db.activoAccesorio.delete({
            where: {
                activo_id_accesorio_id: {
                    activo_id: principal.id,
                    accesorio_id: accesorio.id
                }
            }
        });

        const detalleUsuario = await this.obtenerDetalleUsuario(usuarioId || 'sistema');

        await db.auditoria.create({
            data: {
                modulo: 'FLOTILLA',
                registro_id: principal.id,
                accion: 'DESVINCULAR_ACCESORIO',
                usuario_id: usuarioId || 'sistema',
                valor_anterior: { accesorio_id: accesorio.id, serie: accesorio.serie },
                valor_nuevo: null,
                observaciones: `Se desvinculó el accesorio (Serie: ${accesorio.serie}) del equipo (Serie: ${principal.serie}). Realizado por: ${detalleUsuario}`
            }
        });

        await db.cambioSitioLog.create({
            data: {
                activo_id: principal.id,
                sitio_anterior_id: principal.sitio_id || null,
                sitio_nuevo_id: principal.sitio_id || 'sin_sitio',
                motivo: JSON.stringify({
                    tipo: 'EDICION',
                    accion_nombre: 'Desvincular Accesorio',
                    solicitante: detalleUsuario,
                    solicitante_id: usuarioId || 'sistema',
                    estado: 'APROBADA',
                    aprobado_por: detalleUsuario,
                    datos: {
                        accesorio_desvinculado: accesorio.serie
                    }
                }),
                aprobado: true,
                usuario_id: usuarioId || 'sistema'
            }
        });

        return { success: true, message: 'Accesorio desvinculado exitosamente' };
    }

    async eliminarActivo(id: string, usuarioId: string) {
        const db = this.getDb();
        const activo = await db.activo.findFirst({
            where: {
                OR: [
                    { id },
                    { serie: id }
                ]
            },
            include: { rentas: true }
        });

        if (!activo) {
            throw new NotFoundException(`Equipo con identificador o serie "${id}" no encontrado`);
        }

        const detalleUsuario = await this.obtenerDetalleUsuario(usuarioId);

        // Borrar dependencias en cascada segura
        await db.$transaction(async (tx) => {
            // 1. Accesorios vinculados
            await tx.activoAccesorio.deleteMany({ where: { OR: [{ activo_id: activo.id }, { accesorio_id: activo.id }] } });
            
            // 2. Ordenes mensuales
            await tx.ordenMensual.deleteMany({ where: { activo_id: activo.id } });

            // 3. Detalles de renta & Rentas
            const rentaIds = activo.rentas.map(r => r.id);
            if (rentaIds.length > 0) {
                await tx.detallesRenta.deleteMany({ where: { renta_id: { in: rentaIds } } });
                await tx.renta.deleteMany({ where: { id: { in: rentaIds } } });
            }

            // 4. Logs de cambio de sitio y solicitudes
            await tx.cambioSitioLog.deleteMany({ where: { activo_id: activo.id } });
            await tx.solicitudCambio.deleteMany({ where: { activo_id: activo.id } });

            // 5. Borrar el Activo
            await tx.activo.delete({ where: { id: activo.id } });

            // 6. Auditoría
            await tx.auditoria.create({
                data: {
                    modulo: 'FLOTILLA',
                    registro_id: activo.id,
                    accion: 'BAJA_DIRECTA',
                    usuario_id: usuarioId || 'sistema',
                    valor_anterior: {
                        serie: activo.serie,
                        modelo: activo.modelo,
                        cliente_id: activo.cliente_id,
                        sitio_id: activo.sitio_id,
                        cuenta: activo.cuenta
                    },
                    valor_nuevo: null,
                    observaciones: `Eliminación de equipo (Serie: ${activo.serie}). Realizado por: ${detalleUsuario}`
                }
            });
        });

        return { success: true, message: `Equipo ${activo.serie} eliminado correctamente` };
    }
}

