import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaDynamicService } from '../../database/prisma-dynamic.service';
import { v4 as uuidv4 } from 'uuid';

export interface CreateAuditoriaDto {
    fecha_auditoria: Date;
    usuario_auditor: string;
    comentarios?: string;
    id_ubicacion?: string;
}

@Injectable()
export class AuditoriaService {
    constructor(private prisma: PrismaDynamicService) { }

    private get db(): any {
        return this.prisma.client;
    }

    async findAll() {
        try {
            if (!this.db.auditoria) {
                throw new InternalServerErrorException('Prisma client outdated. Por favor reinicia el backend.');
            }
            return await this.db.auditoria.findMany({
                orderBy: { fecha_auditoria: 'desc' }
            });
        } catch (error: any) {
            console.error('[AuditoriaService] findAll error:', error);
            throw error;
        }
    }

    async findById(id: string) {
        const auditoria = await this.db.auditoria.findUnique({
            where: { id_auditoria: id }
        });
        if (!auditoria) throw new NotFoundException('Auditoría no encontrada');
        return auditoria;
    }

    async create(data: CreateAuditoriaDto) {
        try {
            if (!this.db.auditoria) {
                throw new InternalServerErrorException('Prisma client outdated. Por favor reinicia el backend.');
            }
            return await this.db.auditoria.create({
                data: {
                    id_auditoria: uuidv4(),
                    fecha_auditoria: data.fecha_auditoria || new Date(),
                    usuario_auditor: data.usuario_auditor || 'Auditor',
                    comentarios: data.comentarios,
                    id_ubicacion: data.id_ubicacion,
                }
            });
        } catch (error: any) {
            console.error('[AuditoriaService] create error:', error);
            throw new InternalServerErrorException(`Error al crear auditoria: ${error?.message || error}`);
        }
    }

    async scanEquipo(id_auditoria: string, serial: string) {
        await this.findById(id_auditoria);

        const serialClean = serial.trim();

        // Verificar si ya fue escaneado en esta auditoría
        const alreadyScanned = await this.db.auditoria_detalle.findFirst({
            where: { id_auditoria, serial_equipo: serialClean }
        });

        if (alreadyScanned) {
            throw new BadRequestException('Este serial ya fue escaneado en esta auditoría');
        }

        // Registrar en el detalle
        const auditoriaDetalle = await this.db.auditoria_detalle.create({
            data: {
                id_auditoria_detalle: uuidv4(),
                id_auditoria,
                serial_equipo: serialClean,
            }
        });

        // 1) Buscar en equipo_ubicacion
        const equipoInfo = await this.db.equipo_ubicacion.findFirst({
            where: { serial_equipo: serialClean },
            include: {
                ubicacion: { select: { nombre_ubicacion: true } },
                equipos: { select: { modelo: true, clase: true } }
            }
        });

        if (equipoInfo) {
            const validStates = ['ingresado', 'reservado'];
            const isStateValid = equipoInfo.estado && validStates.includes(equipoInfo.estado.toLowerCase());

            if (!isStateValid) {
                return {
                    status: 'INVALID_STATE',
                    tipo_item: 'equipo',
                    message: `Equipo encontrado pero en estado inválido (${equipoInfo.estado})`,
                    itemInfo: {
                        modelo: equipoInfo.equipos?.modelo || 'N/A',
                        ubicacion: equipoInfo.ubicacion?.nombre_ubicacion || 'Sin ubicación',
                        estado: equipoInfo.estado,
                        clase: equipoInfo.equipos?.clase || 'N/A',
                    },
                    serial: serialClean,
                    auditoria_detalle: auditoriaDetalle
                };
            }

            return {
                status: 'FOUND',
                tipo_item: 'equipo',
                message: 'Equipo validado correctamente',
                itemInfo: {
                    modelo: equipoInfo.equipos?.modelo || 'N/A',
                    ubicacion: equipoInfo.ubicacion?.nombre_ubicacion || 'Sin ubicación',
                    estado: equipoInfo.estado,
                    clase: equipoInfo.equipos?.clase || 'N/A',
                },
                serial: serialClean,
                auditoria_detalle: auditoriaDetalle
            };
        }

        // 2) Buscar en entrada_accesorios
        const accesorioInfo = await this.db.entrada_accesorios.findFirst({
            where: { serial: serialClean },
            include: {
                rel_ubicacion: { select: { nombre_ubicacion: true } },
            }
        });

        if (accesorioInfo) {
            const validStates = ['ingresado'];
            const isStateValid = accesorioInfo.estado && validStates.includes(accesorioInfo.estado.toLowerCase());

            if (!isStateValid) {
                return {
                    status: 'INVALID_STATE',
                    tipo_item: 'accesorio',
                    message: `Accesorio encontrado pero en estado inválido (${accesorioInfo.estado})`,
                    itemInfo: {
                        modelo: accesorioInfo.modelo || 'N/A',
                        ubicacion: accesorioInfo.rel_ubicacion?.nombre_ubicacion || 'Sin ubicación',
                        estado: accesorioInfo.estado,
                        clase: accesorioInfo.tipo || 'Accesorio',
                    },
                    serial: serialClean,
                    auditoria_detalle: auditoriaDetalle
                };
            }

            return {
                status: 'FOUND',
                tipo_item: 'accesorio',
                message: 'Accesorio validado correctamente',
                itemInfo: {
                    modelo: accesorioInfo.modelo || 'N/A',
                    ubicacion: accesorioInfo.rel_ubicacion?.nombre_ubicacion || 'Sin ubicación',
                    estado: accesorioInfo.estado,
                    clase: accesorioInfo.tipo || 'Accesorio',
                },
                serial: serialClean,
                auditoria_detalle: auditoriaDetalle
            };
        }

        // 3) No encontrado en ninguna tabla
        return {
            status: 'NOT_FOUND',
            tipo_item: null,
            message: 'Serial no existe en la base de datos',
            serial: serialClean,
            auditoria_detalle: auditoriaDetalle
        };
    }

    async getReport(id_auditoria: string) {
        const auditoria = await this.findById(id_auditoria);

        // Obtener todos los escaneados
        const detalles = await this.db.auditoria_detalle.findMany({
            where: { id_auditoria }
        });
        const scannedSerials = detalles
            .filter((d: any) => d.serial_equipo)
            .map((d: any) => d.serial_equipo.toLowerCase());

        const scannedDetails = [] as any[];

        // Batch query equipos escaneados
        const equiposInfo = await this.db.equipo_ubicacion.findMany({
            where: { serial_equipo: { in: scannedSerials } },
            include: {
                ubicacion: { select: { nombre_ubicacion: true } },
                equipos: { select: { modelo: true, clase: true } }
            }
        });

        const equipoInfoMap = new Map();
        equiposInfo.forEach((eq: any) => {
            if (eq.serial_equipo) {
                equipoInfoMap.set(eq.serial_equipo.toLowerCase(), eq);
            }
        });

        // Batch query accesorios escaneados
        const accesoriosInfo = await this.db.entrada_accesorios.findMany({
            where: { serial: { in: scannedSerials } },
            include: {
                rel_ubicacion: { select: { nombre_ubicacion: true } },
            }
        });

        const accesorioInfoMap = new Map();
        accesoriosInfo.forEach((acc: any) => {
            if (acc.serial) {
                accesorioInfoMap.set(acc.serial.toLowerCase(), acc);
            }
        });

        for (const detalle of detalles) {
            const serialLower = detalle.serial_equipo ? detalle.serial_equipo.toLowerCase() : '';
            const equipoInfo = equipoInfoMap.get(serialLower);
            const accesorioInfo = accesorioInfoMap.get(serialLower);

            let statusText = 'No existe / Otra ubicación';
            let tipoItem = 'Desconocido';
            let modelo = 'N/A';
            let ubicacion = 'N/A';
            let clase = 'N/A';
            let estadoActual = 'N/A';

            if (equipoInfo) {
                tipoItem = 'Equipo';
                modelo = equipoInfo.equipos?.modelo || 'N/A';
                ubicacion = equipoInfo.ubicacion?.nombre_ubicacion || 'N/A';
                clase = equipoInfo.equipos?.clase || 'N/A';
                estadoActual = equipoInfo.estado || 'N/A';
                const isStateValid = equipoInfo.estado && ['ingresado', 'reservado'].includes(equipoInfo.estado.toLowerCase());
                statusText = isStateValid ? 'Encontrado Correctamente' : `Entrado incorrecto (${equipoInfo.estado})`;
            } else if (accesorioInfo) {
                tipoItem = 'Accesorio';
                modelo = accesorioInfo.modelo || 'N/A';
                ubicacion = accesorioInfo.rel_ubicacion?.nombre_ubicacion || 'N/A';
                clase = accesorioInfo.tipo || 'Accesorio';
                estadoActual = accesorioInfo.estado || 'N/A';
                const isStateValid = accesorioInfo.estado && ['ingresado'].includes(accesorioInfo.estado.toLowerCase());
                statusText = isStateValid ? 'Encontrado Correctamente' : `Entrado incorrecto (${accesorioInfo.estado})`;
            }

            scannedDetails.push({
                serial: detalle.serial_equipo,
                tipo_item: tipoItem,
                estado_actual: estadoActual,
                ubicacion_actual: ubicacion,
                modelo,
                clase,
                status_auditoria: statusText
            });
        }

        // ── FALTANTES: Equipos ──
        const whereCondition: any = {
            estado: { in: ['Ingresado', 'Reservado', 'ingresado', 'reservado'] }
        };
        if (auditoria.id_ubicacion) {
            whereCondition.id_ubicacion = auditoria.id_ubicacion;
        }

        const expectedEquipos = await this.db.equipo_ubicacion.findMany({
            where: whereCondition,
            include: {
                ubicacion: { select: { nombre_ubicacion: true } },
                equipos: { select: { modelo: true, clase: true } }
            }
        });

        const missingEquipos = expectedEquipos
            .filter((eq: any) => eq.serial_equipo && !scannedSerials.includes(eq.serial_equipo.toLowerCase()))
            .map((eq: any) => ({
                serial: eq.serial_equipo,
                tipo_item: 'Equipo',
                estado_actual: eq.estado,
                ubicacion_actual: eq.ubicacion?.nombre_ubicacion || 'N/A',
                modelo: eq.equipos?.modelo || 'N/A',
                clase: eq.equipos?.clase || 'N/A',
                status_auditoria: 'Faltante (No escaneado)'
            }));

        // ── FALTANTES: Accesorios ──
        const whereAccesorios: any = {
            estado: { in: ['Ingresado', 'ingresado'] }
        };
        if (auditoria.id_ubicacion) {
            whereAccesorios.ubicacion = auditoria.id_ubicacion;
        }

        const expectedAccesorios = await this.db.entrada_accesorios.findMany({
            where: whereAccesorios,
            include: {
                rel_ubicacion: { select: { nombre_ubicacion: true } },
            }
        });

        const missingAccesorios = expectedAccesorios
            .filter((acc: any) => acc.serial && !scannedSerials.includes(acc.serial.toLowerCase()))
            .map((acc: any) => ({
                serial: acc.serial,
                tipo_item: 'Accesorio',
                estado_actual: acc.estado,
                ubicacion_actual: acc.rel_ubicacion?.nombre_ubicacion || 'N/A',
                modelo: acc.modelo || 'N/A',
                clase: acc.tipo || 'Accesorio',
                status_auditoria: 'Faltante (No escaneado)'
            }));

        return {
            auditoria,
            scanned: scannedDetails,
            missing: [...missingEquipos, ...missingAccesorios]
        };
    }
}
