import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaDynamicService } from '../../../database/prisma-dynamic.service';

const ADC_ALIASES: Record<string, string[]> = {
    'daniel': ['daniel', 'daniel romero', 'romero'],
    'romero': ['daniel', 'daniel romero', 'romero'],
    'alejandra': ['alejandra', 'alejandra arellanes', 'arellanes'],
    'arellanes': ['alejandra', 'alejandra arellanes', 'arellanes'],
    'andrea': ['andrea', 'andrea esquivel', 'esquivel'],
    'esquivel': ['andrea', 'andrea esquivel', 'esquivel'],
    'montserrat': ['montserrat', 'montserrat covarrubias', 'covarrubias', 'montse'],
    'covarrubias': ['montserrat', 'montserrat covarrubias', 'covarrubias', 'montse'],
    'simalu': ['simalu', 'simalú', 'simalu leon', 'simalú león', 'leon', 'león'],
    'simalú': ['simalu', 'simalú', 'simalu leon', 'simalú león', 'leon', 'león'],
    'leon': ['simalu', 'simalú', 'simalu leon', 'simalú león', 'leon', 'león'],
    'león': ['simalu', 'simalú', 'simalu leon', 'simalú león', 'leon', 'león'],
};

function stripAccents(str: string): string {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function matchAdcKeywords(candidates: (string | null | undefined)[], keywords: string[]): boolean {
    if (keywords.length === 0) return true;

    const cleanKeywords = new Set<string>();
    for (const kw of keywords) {
        if (!kw) continue;
        const norm = stripAccents(kw.trim().toLowerCase());
        if (!norm) continue;
        cleanKeywords.add(norm);

        const parts = norm.split(/\s+/).filter(p => p.length >= 3);
        for (const p of parts) {
            cleanKeywords.add(p);
            if (ADC_ALIASES[p]) {
                ADC_ALIASES[p].forEach(a => cleanKeywords.add(stripAccents(a.toLowerCase())));
            }
        }
        if (ADC_ALIASES[norm]) {
            ADC_ALIASES[norm].forEach(a => cleanKeywords.add(stripAccents(a.toLowerCase())));
        }
    }

    const keywordList = Array.from(cleanKeywords);

    for (const raw of candidates) {
        if (!raw) continue;
        const norm = stripAccents(raw.trim().toLowerCase());
        if (!norm) continue;

        for (const kw of keywordList) {
            if (!kw) continue;
            if (norm.includes(kw) || kw.includes(norm)) {
                return true;
            }
        }
    }

    return false;
}

@Injectable()
export class OrdenesService {
    private readonly logger = new Logger(OrdenesService.name);

    private getDb() {
        const db = PrismaDynamicService.clients.r4;
        if (!db) throw new Error('Database client for R4 not initialized');
        return db;
    }

    async obtenerOrdenes(adc?: string) {
        const db = this.getDb();
        try {
            const adcKeywords = adc ? adc.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];

            const ordenes = await db.ordenMensual.findMany({
                where: {
                    activo_id: { not: null }
                },
                include: { 
                    cliente: true, 
                    renta: {
                        include: {
                            sitio: true
                        }
                    },
                    activo: {
                        include: {
                            accesorios: {
                                include: { accesorio: true }
                            }
                        }
                    }, 
                },
                orderBy: { periodo: 'desc' },
            });

            const filtered = ordenes.filter((o: any) => {
                if (adcKeywords.length === 0) return true;
                const candidates = [
                    o.renta?.adc,
                    o.activo?.adc,
                    o.renta?.sitio?.adc,
                    (o.cliente as any)?.adc,
                    (o.cliente as any)?.datos_comerciales?.adc
                ];
                return matchAdcKeywords(candidates, adcKeywords);
            });

            return filtered.map((o: any) => {
                const adcName = o.renta?.adc || o.activo?.adc || o.renta?.sitio?.adc || (o.cliente as any)?.adc || (o.cliente as any)?.datos_comerciales?.adc || 'Sin ADC';
                return {
                    id: o.id,
                    periodo: o.periodo,
                    po: o.po,
                    tarifa: o.tarifa,
                    moneda: o.moneda,
                    estado: o.estado,
                    condiciones: o.condiciones,
                    pedido_totvs: (o.condiciones as any)?.pedido_totvs || (o.condiciones as any)?.pedido || (o.condiciones as any)?.pedido_tovts || (o.renta as any)?.no_registro_totvs || null,
                    fecha_pedido_totvs: (o.condiciones as any)?.fecha_pedido_totvs || (o.condiciones as any)?.fecha_ped || (o.renta as any)?.fecha_pedido_totvs || null,
                    cliente: o.cliente?.razon_social || 'Desconocido',
                    activo: o.activo?.serie || o.activo_id,
                    activo_modelo: o.activo?.modelo || '-',
                    accesorios: o.activo?.accesorios?.map((acc: any) => ({
                        id: acc.accesorio?.id,
                        serie: acc.accesorio?.serie,
                        modelo: acc.accesorio?.modelo,
                        tipo: acc.tipo_relacion,
                        cantidad: acc.cantidad || 1
                    })) || [],
                    adc: adcName,
                    renta_id: o.renta_id
                };
            });
        } catch (error: any) {
            this.logger.error(`Error en obtenerOrdenes: ${error.message}`);
            throw error;
        }
    }

    async registrarOrdenManual(dto: { renta_id: string, periodo: string, po: string, tarifa?: number, pedido_totvs?: string, fecha_pedido_totvs?: string }) {
        const db = this.getDb();
        try {
            // First verify the renta exists
            const renta = await db.renta.findUnique({
                where: { id: dto.renta_id },
                include: { activo: true, cliente: true, detalles: true }
            });

            if (!renta) {
                throw new NotFoundException('Renta no encontrada');
            }

            const tarifaFinal = dto.tarifa ?? Number(renta.detalles?.renta_real || renta.detalles?.renta_base || renta.tarifa || 0);

            // Check if order already exists for this active + period
            const existing = await db.ordenMensual.findFirst({
                where: {
                    activo_id: renta.activo_id,
                    periodo: dto.periodo,
                }
            });

            const condiciones = {
                ...((existing?.condiciones as any) || {}),
                ...(dto.pedido_totvs ? { pedido_totvs: dto.pedido_totvs } : {}),
                ...(dto.fecha_pedido_totvs ? { fecha_pedido_totvs: dto.fecha_pedido_totvs } : {}),
            };

            if (existing) {
                const updated = await db.ordenMensual.update({
                    where: { id: existing.id },
                    data: {
                        po: dto.po,
                        tarifa: tarifaFinal,
                        moneda: renta.detalles?.moneda || renta.moneda || 'MXN',
                        estado: 'GENERADA',
                        condiciones
                    }
                });
                return updated;
            }

            // Create new order inheriting properties from Renta
            const nuevaOrden = await db.ordenMensual.create({
                data: {
                    cliente_id: renta.cliente_id,
                    renta_id: renta.id,
                    activo_id: renta.activo_id,
                    contrato_id: renta.contrato_id,
                    periodo: dto.periodo,
                    po: dto.po,
                    tarifa: tarifaFinal,
                    moneda: renta.detalles?.moneda || renta.moneda || 'MXN',
                    estado: 'GENERADA',
                    condiciones
                }
            });

            return nuevaOrden;
        } catch (error: any) {
            this.logger.error(`Error en registrarOrdenManual: ${error.message}`);
            throw error;
        }
    }

    async asignarMasivo(dto: { renta_ids: string[], periodo: string, po: string, pedido_totvs?: string, fecha_pedido_totvs?: string }) {
        const db = this.getDb();
        try {
            if (!dto.renta_ids || dto.renta_ids.length === 0) {
                throw new Error('Debe proporcionar al menos una renta');
            }

            const rentas = await db.renta.findMany({
                where: { id: { in: dto.renta_ids } },
                include: { activo: true, cliente: true, detalles: true }
            });

            const activoIds = rentas.map(r => r.activo_id).filter(Boolean) as string[];

            // 1. Obtener órdenes existentes en 1 sola consulta
            const existingOrders = await db.ordenMensual.findMany({
                where: {
                    activo_id: { in: activoIds },
                    periodo: dto.periodo
                }
            });
            const existingMap = new Map<string, any>(existingOrders.map(o => [o.activo_id!, o]));

            const toCreate: any[] = [];
            const updates: Promise<any>[] = [];

            for (const renta of rentas) {
                if (!renta.activo_id) continue;
                const tarifaFinal = Number(renta.detalles?.renta_real || renta.detalles?.renta_base || renta.tarifa || 0);
                const existing = existingMap.get(renta.activo_id);

                const condiciones = {
                    ...((existing?.condiciones as any) || {}),
                    ...(dto.pedido_totvs ? { pedido_totvs: dto.pedido_totvs } : {}),
                    ...(dto.fecha_pedido_totvs ? { fecha_pedido_totvs: dto.fecha_pedido_totvs } : {}),
                };

                if (existing) {
                    updates.push(
                        db.ordenMensual.update({
                            where: { id: existing.id },
                            data: {
                                po: dto.po,
                                tarifa: tarifaFinal,
                                moneda: renta.detalles?.moneda || renta.moneda || 'MXN',
                                estado: 'GENERADA',
                                condiciones
                            }
                        })
                    );
                } else {
                    toCreate.push({
                        cliente_id: renta.cliente_id,
                        renta_id: renta.id,
                        activo_id: renta.activo_id,
                        contrato_id: renta.contrato_id,
                        periodo: dto.periodo,
                        po: dto.po,
                        tarifa: tarifaFinal,
                        moneda: renta.detalles?.moneda || renta.moneda || 'MXN',
                        estado: 'GENERADA',
                        condiciones
                    });
                }
            }

            if (updates.length > 0) {
                const updateChunk = 50;
                for (let i = 0; i < updates.length; i += updateChunk) {
                    await Promise.all(updates.slice(i, i + updateChunk));
                }
            }

            if (toCreate.length > 0) {
                const chunkSize = 200;
                for (let i = 0; i < toCreate.length; i += chunkSize) {
                    await db.ordenMensual.createMany({
                        data: toCreate.slice(i, i + chunkSize),
                        skipDuplicates: true
                    });
                }
            }

            return {
                success: true,
                message: `Se asignaron ${rentas.length} órdenes correctamente con la OC: ${dto.po}`,
                procesadas: rentas.length
            };
        } catch (error: any) {
            this.logger.error(`Error en asignarMasivo: ${error.message}`);
            throw error;
        }
    }

    async copiarMesAnterior(dto: { periodo_origen: string, periodo_destino: string, cliente_id?: string, adc?: string }) {
        const db = this.getDb();
        try {
            if (!dto.periodo_origen || !dto.periodo_destino) {
                throw new Error('periodo_origen y periodo_destino son requeridos');
            }

            const adcKeywords = dto.adc ? dto.adc.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];

            // 1. Buscar todas las órdenes del periodo origen en 1 sola consulta
            const ordenesOrigen = await db.ordenMensual.findMany({
                where: {
                    periodo: dto.periodo_origen,
                    ...(dto.cliente_id ? { cliente_id: dto.cliente_id } : {}),
                    activo_id: { not: null }
                },
                include: {
                    renta: {
                        include: {
                            detalles: true,
                            activo: true,
                            sitio: true
                        }
                    },
                    cliente: true
                }
            });

            // 2. Filtrar por ADC si aplica
            const ordenesFiltradas = ordenesOrigen.filter((o: any) => {
                if (adcKeywords.length === 0) return true;
                const candidates = [
                    o.renta?.adc,
                    o.renta?.activo?.adc,
                    o.renta?.sitio?.adc,
                    (o.cliente as any)?.adc,
                    (o.cliente as any)?.datos_comerciales?.adc
                ];
                return matchAdcKeywords(candidates, adcKeywords);
            });

            if (ordenesFiltradas.length === 0) {
                return {
                    success: true,
                    message: `No se encontraron órdenes en ${dto.periodo_origen} para replicar.`,
                    copiadas: 0,
                    yaExistian: 0,
                    totalOrigen: 0
                };
            }

            // 3. Obtener todas las órdenes existentes del periodo destino en 1 sola consulta rápida
            const existingDestino = await db.ordenMensual.findMany({
                where: {
                    periodo: dto.periodo_destino,
                    ...(dto.cliente_id ? { cliente_id: dto.cliente_id } : {}),
                    activo_id: { not: null }
                },
                select: { activo_id: true }
            });
            const existingActivoIds = new Set(existingDestino.map(e => e.activo_id).filter(Boolean));

            let yaExistian = 0;
            const toCreate: any[] = [];

            for (const o of ordenesFiltradas) {
                if (!o.activo_id) continue;
                if (existingActivoIds.has(o.activo_id)) {
                    yaExistian++;
                    continue;
                }

                const tarifaFinal = Number(o.renta?.detalles?.renta_real || o.renta?.detalles?.renta_base || o.tarifa || 0);
                toCreate.push({
                    cliente_id: o.cliente_id,
                    renta_id: o.renta_id,
                    activo_id: o.activo_id,
                    contrato_id: o.contrato_id,
                    periodo: dto.periodo_destino,
                    po: o.po,
                    tarifa: tarifaFinal,
                    moneda: o.moneda || o.renta?.detalles?.moneda || 'MXN',
                    estado: 'GENERADA',
                    condiciones: o.condiciones || {}
                });
                existingActivoIds.add(o.activo_id);
            }

            // 4. Inserción masiva en chunks ultra rápida (1-2 queries en total)
            if (toCreate.length > 0) {
                const chunkSize = 200;
                for (let i = 0; i < toCreate.length; i += chunkSize) {
                    const chunk = toCreate.slice(i, i + chunkSize);
                    await db.ordenMensual.createMany({
                        data: chunk,
                        skipDuplicates: true
                    });
                }
            }

            return {
                success: true,
                message: `Se copiaron ${toCreate.length} órdenes de ${dto.periodo_origen} a ${dto.periodo_destino} (${yaExistian} ya existían).`,
                copiadas: toCreate.length,
                yaExistian,
                totalOrigen: ordenesFiltradas.length
            };
        } catch (error: any) {
            this.logger.error(`Error en copiarMesAnterior: ${error.message}`);
            throw error;
        }
    }
}
