import { PrismaClient as PrismaR1 } from '@prisma/client-taller-r1';

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaDynamicService } from '../../database/prisma-dynamic.service';
import { StorageService } from './storage.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class EvaluacionesService {
    private readonly logger = new Logger(EvaluacionesService.name);

    constructor(
        private prisma: PrismaDynamicService,
        private storageService: StorageService
    ) { }

    private get db(): PrismaR1 {
        return this.prisma.client;
    }

    /**
     * Helper to process objects containing multiple base64 images
     */
    private async processEvaluationPhotos(photosObj: any, folderPath: string, prefix: string): Promise<any> {
        if (!photosObj || typeof photosObj !== 'object') return photosObj;

        const processed: any = { ...photosObj };
        for (const [key, value] of Object.entries(processed)) {
            if (typeof value === 'string' && value.startsWith('data:image')) {
                try {
                    const url = await this.storageService.uploadBase64Image(value, folderPath, `${prefix}_${key}`);
                    if (url) processed[key] = url;
                } catch (error: any) {
                    this.logger.error(`Error uploading evaluation photo ${key}: ${error.message}`);
                }
            }
        }
        return processed;
    }

    // --- EQUIPOS ---

    async saveEquipoEvaluation(data: {
        id_detalle: string;
        puntajes: any;
        fotos: any;
        porcentaje_total?: number;
        semanas_renovacion?: number;
        estado_montacargas?: string;
        notas?: string;
        horometro?: number;
        anio_fabricacion?: number;
        faltante_piezas?: string;
        fotos_faltantes?: any;
        observaciones?: any;
        usuario_evaluador?: string;
    }) {
        try {
            // Get detail to have a good folder name
            const detail = await this.db.entrada_detalle.findUnique({
                where: { id_detalles: data.id_detalle },
                select: { id_entrada: true, serial_equipo: true }
            });

            const site = this.prisma.currentSite?.toUpperCase() || 'R1';
            const folderPath = `${site}/Evaluaciones/${detail?.id_entrada || 'unknown'}-${detail?.serial_equipo || 'unknown'}`;

            // Process photos objects
            const processedFotos = await this.processEvaluationPhotos(data.fotos, folderPath, 'main');
            const processedFotosFaltantes = await this.processEvaluationPhotos(data.fotos_faltantes, folderPath, 'faltantes');

            // Check if evaluation exists for this detail
            const existing = await this.db.evaluaciones_checklist.findFirst({
                where: { id_detalle: data.id_detalle }
            });

            let evaluation;
            if (existing) {
                evaluation = await this.db.evaluaciones_checklist.update({
                    where: { id_evaluacion: existing.id_evaluacion },
                    data: {
                        puntajes: data.puntajes,
                        fotos: processedFotos,
                        porcentaje_total: data.porcentaje_total,
                        semanas_renovacion: data.semanas_renovacion,
                        estado_montacargas: data.estado_montacargas,
                        notas: data.notas,
                        horometro: data.horometro,
                        anio_fabricacion: data.anio_fabricacion,
                        faltante_piezas: data.faltante_piezas,
                        fotos_faltantes: processedFotosFaltantes,
                        observaciones: data.observaciones,
                        usuario_evaluador: data.usuario_evaluador
                    }
                });
            } else {
                evaluation = await this.db.evaluaciones_checklist.create({
                    data: {
                        id_evaluacion: uuidv4(),
                        id_detalle: data.id_detalle,
                        puntajes: data.puntajes,
                        fotos: processedFotos,
                        porcentaje_total: data.porcentaje_total,
                        semanas_renovacion: data.semanas_renovacion,
                        estado_montacargas: data.estado_montacargas,
                        notas: data.notas,
                        horometro: data.horometro,
                        anio_fabricacion: data.anio_fabricacion,
                        faltante_piezas: data.faltante_piezas,
                        fotos_faltantes: processedFotosFaltantes,
                        observaciones: data.observaciones,
                        usuario_evaluador: data.usuario_evaluador
                    }
                });
            }

            // Update the Detail (Equipment) to reflect the new Qualification
            let calificacionText = 'Evaluado';
            if (data.estado_montacargas) {
                calificacionText = data.estado_montacargas;
            } else if (data.porcentaje_total !== undefined) {
                calificacionText = `${data.porcentaje_total}%`;
            }

            await this.db.entrada_detalle.update({
                where: { id_detalles: data.id_detalle },
                data: {
                    calificacion: calificacionText.trim(),
                    semanas_renovacion: data.semanas_renovacion !== undefined ? String(data.semanas_renovacion) : null,
                }
            });

            // Trigger Entry state check
            const freshDetail = await this.db.entrada_detalle.findUnique({
                where: { id_detalles: data.id_detalle },
                select: { id_entrada: true, serial_equipo: true }
            });

            if (freshDetail?.id_entrada) {
                await this.checkEntryCompletion(freshDetail.id_entrada);
            }

            // [NUEVO] Vincular la evaluación con el registro de ubicación del equipo
            if (detail?.serial_equipo) {
                const equipoUbc = await this.db.equipo_ubicacion.findFirst({
                    where: { 
                        serial_equipo: detail.serial_equipo,
                        estado: { notIn: ['Retirado', 'Reservado', 'En mantenimiento'] }
                    },
                    orderBy: {
                        fecha_entrada: 'desc'
                    }
                });

                if (equipoUbc) {
                    await this.db.equipo_ubicacion.update({
                        where: { id_equipo_ubicacion: equipoUbc.id_equipo_ubicacion },
                        data: { id_evaluacion: evaluation.id_evaluacion }
                    });
                }
            }

            return evaluation;
        } catch (error: any) {
            this.logger.error(`Error saving equipment evaluation: ${error.message}`, error.stack);
            throw error;
        }
    }

    async getEquipoEvaluation(id_detalle: string) {
        try {
            const evaluation = await this.db.evaluaciones_checklist.findFirst({
                where: { id_detalle: id_detalle }
            });
            return evaluation;
        } catch (error: any) {
            this.logger.error(`Error getting equipment evaluation: ${error.message}`, error.stack);
            throw error;
        }
    }

    // --- ACCESORIOS ---

    async saveAccesorioEvaluation(data: {
        id_accesorio: string;
        voltaje?: number;
        condiciones?: string;
        parametros?: any;
        nivel_electrolitos?: string;
        fugas?: boolean;
        danos_fisicos?: string;
        prueba_carga?: any;
        celdas_buen_estado?: number;
        fecha_ultima_carga?: Date | string;
        notas?: string;
        usuario_evaluador?: string;
    }) {
        try {
            const existing = await this.db.evaluaciones_accesorios.findFirst({
                where: { id_accesorio: data.id_accesorio }
            });

            const evaluation = existing
                ? await this.db.evaluaciones_accesorios.update({
                    where: { id_evaluacion_acc: existing.id_evaluacion_acc },
                    data: {
                        voltaje: data.voltaje,
                        condiciones: data.condiciones,
                        parametros: data.parametros,
                        nivel_electrolitos: data.nivel_electrolitos,
                        fugas: data.fugas,
                        danos_fisicos: data.danos_fisicos,
                        prueba_carga: data.prueba_carga,
                        celdas_buen_estado: data.celdas_buen_estado,
                        fecha_ultima_carga: data.fecha_ultima_carga ? new Date(data.fecha_ultima_carga) : null,
                        notas: data.notas,
                        usuario_evaluador: data.usuario_evaluador
                    }
                })
                : await this.db.evaluaciones_accesorios.create({
                    data: {
                        id_evaluacion_acc: uuidv4(),
                        id_accesorio: data.id_accesorio,
                        voltaje: data.voltaje,
                        condiciones: data.condiciones,
                        parametros: data.parametros,
                        nivel_electrolitos: data.nivel_electrolitos,
                        fugas: data.fugas,
                        danos_fisicos: data.danos_fisicos,
                        prueba_carga: data.prueba_carga,
                        celdas_buen_estado: data.celdas_buen_estado,
                        fecha_ultima_carga: data.fecha_ultima_carga ? new Date(data.fecha_ultima_carga) : null,
                        notas: data.notas,
                        usuario_evaluador: data.usuario_evaluador
                    }
                });

            // Update the accessory status to reflect it has been evaluated
            // Note: We use updateMany if there's any chance of composite key issues, 
            // but findUnique above used only id_accesorio, so update should work.
            const acc = await this.db.entrada_accesorios.update({
                where: { id_accesorio: data.id_accesorio },
                data: { estado_acc: 'Evaluado' },
                select: { id_entrada: true }
            });

            if (acc?.id_entrada) {
                await this.checkEntryCompletion(acc.id_entrada);
            }

            return evaluation;
        } catch (error: any) {
            this.logger.error(`Error saving accessory evaluation: ${error.message}`, error.stack);
            throw error;
        }
    }

    async getAccesorioEvaluation(id_accesorio: string) {
        try {
            const evaluation = await this.db.evaluaciones_accesorios.findFirst({
                where: { id_accesorio: id_accesorio }
            });
            return evaluation;
        } catch (error: any) {
            this.logger.error(`Error getting accessory evaluation: ${error.message}`, error.stack);
            throw error;
        }
    }

    async getEvaluationById(id: string) {
        try {
            return await this.db.evaluaciones_checklist.findUnique({
                where: { id_evaluacion: id },
                include: {
                    entrada_detalle: {
                        include: {
                            entradas: true
                        }
                    }
                }
            });
        } catch (error: any) {
            this.logger.error(`Error getting evaluation by id: ${error.message}`, error.stack);
            throw error;
        }
    }

    async getHistoryBySerial(serial: string) {
        try {
            const cleanSerial = serial.trim();
            console.log(`[EvaluacionesService] Searching history for serial: "${cleanSerial}"`);

            const results = await this.db.evaluaciones_checklist.findMany({
                where: {
                    entrada_detalle: {
                        OR: [
                            { serial_equipo: { contains: cleanSerial } },
                            { rel_equipo: { numero_serie: { contains: cleanSerial } } }
                        ]
                    }
                },
                include: {
                    entrada_detalle: {
                        include: {
                            entradas: true
                        }
                    }
                }
            });

            // Ordenar en memoria en vez de la base de datos para evitar MySQL error 1038 (Out of sort memory)
            results.sort((a: any, b: any) => {
                const dateA = a.fecha_creacion || (a.entrada_detalle && a.entrada_detalle.entradas ? a.entrada_detalle.entradas.fecha_creacion : 0);
                const dateB = b.fecha_creacion || (b.entrada_detalle && b.entrada_detalle.entradas ? b.entrada_detalle.entradas.fecha_creacion : 0);
                return new Date(dateB).getTime() - new Date(dateA).getTime();
            });

            console.log(`[EvaluacionesService] History found for "${cleanSerial}": ${results.length} records`);
            return results;
        } catch (error: any) {
            this.logger.error(`Error getting history by serial: ${error.message}`, error.stack);
            throw error;
        }
    }

    async getAllEquiposEvaluations() {
        try {
            // Primero obtenemos los IDs recientes para que la base de datos no tenga que hacer un JOIN masivo antes de ordenar
            const recientes = await this.db.evaluaciones_checklist.findMany({
                select: { id_evaluacion: true, fecha_creacion: true },
                orderBy: { fecha_creacion: 'desc' },
                take: 100
            });

            const ids = recientes.map(r => r.id_evaluacion);

            if (ids.length === 0) return [];

            const records = await this.db.evaluaciones_checklist.findMany({
                where: { 
                    id_evaluacion: { in: ids },
                    // Filtro de seguridad: al ser una relación obligatoria, forzamos un filtro en un campo del hijo 
                    // para que MySQL haga el join y descarte huérfanos antes de que Prisma valide.
                    entrada_detalle: {
                        id_detalles: { not: "" }
                    }
                },
                include: {
                    entrada_detalle: {
                        include: {
                            entradas: {
                                include: {
                                    rel_cliente: {
                                        select: {
                                            nombre_cliente: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            // Extract serials to fetch their real-time states
            const serials = records.map(r => r.entrada_detalle?.serial_equipo).filter(Boolean) as string[];
            const eqUbis = await this.db.equipo_ubicacion.findMany({
                where: { serial_equipo: { in: serials } },
                orderBy: { fecha_entrada: 'desc' }
            });

            // Ordenar en memoria según el orden de los IDs recientes
            const orderMap = new Map(recientes.map((r, i) => [r.id_evaluacion, i]));
            const sortedRecords = records.sort((a, b) => (orderMap.get(a.id_evaluacion) ?? 0) - (orderMap.get(b.id_evaluacion) ?? 0));

            return sortedRecords.map(record => {
                const serial = record.entrada_detalle?.serial_equipo;
                const eqUbi = eqUbis.find(e => e.serial_equipo === serial);
                
                // Attach estado from equipo_ubicacion if available, else fallback to entrada_detalle
                const estado = eqUbi ? eqUbi.estado : record.entrada_detalle?.estado;

                return {
                    ...record,
                    estado_real: estado || 'En proceso'
                };
            });
        } catch (error: any) {
             this.logger.error(`Error getting all equipment evaluations: ${error.message}`, error.stack);
             throw error;
        }
    }

    // --- CARGAS ---

    async registerCharge(id_accesorio: string, comentarios?: string, fecha_carga?: string | Date) {
        this.logger.log(`[EvaluacionesService] Registering charge for ${id_accesorio}. Date provided: ${fecha_carga}`);
        try {
            let dateToUse: Date;

            if (fecha_carga) {
                if (typeof fecha_carga === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha_carga)) {
                    // It's a YYYY-MM-DD string, use noon local to avoid TZ shifts
                    dateToUse = new Date(`${fecha_carga}T12:00:00`);
                } else {
                    dateToUse = new Date(fecha_carga);
                }
            } else {
                dateToUse = new Date();
            }

            this.logger.log(`[EvaluacionesService] Resolved dateToUse: ${dateToUse.toISOString()}`);

            // Calculate next charge (e.g., 7 days from now)
            const nextCharge = new Date(dateToUse);
            nextCharge.setDate(nextCharge.getDate() + 7);

            // 1. Create charge history record
            const charge = await this.db.historial_cargas.create({
                data: {
                    id_carga: uuidv4(),
                    id_accesorio: id_accesorio,
                    fecha_carga: dateToUse,
                    proxima_carga: nextCharge,
                    comentarios: comentarios
                }
            });

            // 2. Update the last charge date in the accessory evaluations table
            // This ensures that the alerts list (which uses this field) stays updated
            const existingEval = await this.db.evaluaciones_accesorios.findFirst({
                where: { id_accesorio }
            });

            if (existingEval) {
                await this.db.evaluaciones_accesorios.update({
                    where: { id_evaluacion_acc: existingEval.id_evaluacion_acc },
                    data: { fecha_ultima_carga: dateToUse }
                });
            } else {
                // If it doesn't have an evaluation, create a basic one
                await this.db.evaluaciones_accesorios.create({
                    data: {
                        id_evaluacion_acc: uuidv4(),
                        id_accesorio,
                        fecha_ultima_carga: dateToUse,
                        usuario_evaluador: 'Sistema (Carga Manual)'
                    }
                });
            }

            return charge;
        } catch (error: any) {
            this.logger.error(`Error registering charge: ${error.message}`, error.stack);
            throw error;
        }
    }

    async getChargeHistory(id_accesorio: string) {
        try {
            return await this.db.historial_cargas.findMany({
                where: { id_accesorio: id_accesorio },
                orderBy: { fecha_carga: 'desc' }
            });
        } catch (error: any) {
            this.logger.error(`Error getting charge history: ${error.message}`, error.stack);
            throw error;
        }
    }

    private async checkEntryCompletion(id_entrada: string) {
        try {
            console.log(`[EvaluacionesService] Checking completion for entry: ${id_entrada}`);

            const [detalles, accesorios] = await Promise.all([
                this.db.entrada_detalle.findMany({
                    where: { id_entrada }
                }),
                this.db.entrada_accesorios.findMany({
                    where: { id_entrada },
                    include: { evaluaciones: true }
                })
            ]);

            // All equipment must have a grade (calificacion)
            const allEquiposEvaluated = detalles.every(d => !!d.calificacion);

            console.log(`[EvaluacionesService] Entry ${id_entrada} results: Equipos=${allEquiposEvaluated}`);

            if (allEquiposEvaluated && detalles.length > 0) {
                console.log(`[EvaluacionesService] All equipment evaluated. Transitioning Entry ${id_entrada} to "Por Ubicar"`);
                await this.db.entradas.update({
                    where: { id_entrada },
                    data: { estado: 'Por Ubicar' }
                });
            } else if (detalles.length === 0 && accesorios.length > 0) {
                // Si solo hay accesorios, pasa directamente a Por Ubicar para evitar bloqueo
                console.log(`[EvaluacionesService] Entry has only accessories. Transitioning Entry ${id_entrada} to "Por Ubicar"`);
                await this.db.entradas.update({
                    where: { id_entrada },
                    data: { estado: 'Por Ubicar' }
                });
            }
        } catch (error: any) {
            this.logger.error(`Error in checkEntryCompletion: ${error.message}`, error.stack);
        }
    }

    async bulkGenericEvaluationR1() {
        if (this.prisma.currentSite?.toLowerCase() !== 'r1') {
            return { message: 'Este proceso solo está disponible en R1', count: 0 };
        }

        try {
            // 1. Buscar equipos en entrada_detalle con estado "Renovar" (o similar)
            const detalles = await this.db.entrada_detalle.findMany({
                where: {
                    OR: [
                        { estado: { contains: 'Renovar' } },
                        { estado: { contains: 'RENOVAR' } }
                    ]
                }
            });

            const results = [];
            let updatedCount = 0;

            for (const detalle of detalles) {
                // 2. Verificar si está ingresado en equipo_ubicacion
                const equipoUbc = await this.db.equipo_ubicacion.findFirst({
                    where: {
                        serial_equipo: detalle.serial_equipo,
                        estado: 'Ingresado'
                    }
                });

                if (equipoUbc) {
                    // Verificar si ya tiene evaluación para no sobreescribir
                    const existingEval = await this.db.evaluaciones_checklist.findFirst({
                        where: { id_detalle: detalle.id_detalles }
                    });

                    if (existingEval) {
                        continue;
                    }

                    // 3. Crear evaluación genérica al 70%
                    // 16 ítems a 7 puntos cada uno = 112/160 = 70%
                    const genericScores: Record<string, string> = {};
                    for (let i = 1; i <= 16; i++) {
                        genericScores[String(i)] = "7";
                    }

                    const evaluationData = {
                        id_detalle: detalle.id_detalles,
                        puntajes: genericScores,
                        fotos: {},
                        porcentaje_total: 70,
                        semanas_renovacion: 3,
                        estado_montacargas: '70% - Renovación',
                        notas: 'Evaluación rápida genérica aplicada por el sistema.',
                        usuario_evaluador: 'Sistema (Evaluación Rápida)'
                    };

                    await this.saveEquipoEvaluation(evaluationData);
                    updatedCount++;
                    results.push({ serial: detalle.serial_equipo, id_detalle: detalle.id_detalles });
                }
            }

            return {
                message: `Se procesaron ${detalles.length} equipos, se evaluaron ${updatedCount} exitosamente.`,
                count: updatedCount,
                results
            };
        } catch (error: any) {
            this.logger.error(`Error in bulkGenericEvaluationR1: ${error.message}`, error.stack);
            throw error;
        }
    }
}
