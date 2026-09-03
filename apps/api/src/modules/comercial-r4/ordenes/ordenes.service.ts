import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaDynamicService } from '../../../database/prisma-dynamic.service';
import { clearPresupuestosCache } from '../presupuestos/presupuestos.service';

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

export interface FichaOcItemDto {
    assetId: string;
    rentaId?: string;
    sitioId?: string;
    cuenta?: string;
    renta_base: number;
    dias_caidos?: number;
    descuento?: number;
    renta_final: number;
    pedido_totvs?: string;
}

export interface RegistrarBatchFichaOcDto {
    cliente_id: string;
    sitio_id?: string;
    cuenta?: string;
    po: string;
    pedido_totvs?: string;
    fecha_pedido_totvs?: string;
    periodos: string[];
    items: FichaOcItemDto[];
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
                const cond = (o.condiciones as any) || {};
                let rawTotvs = cond.pedido_totvs || cond.pedido || cond.pedido_tovts || (o.renta as any)?.no_registro_totvs || null;
                if (rawTotvs && ['USD', 'MXN', 'NA', 'N/A', 'NO', '-', 'NULL', 'UNDEFINED'].includes(String(rawTotvs).toUpperCase().trim())) {
                    rawTotvs = null;
                }
                let rawFecha = cond.fecha_pedido_totvs || cond.fecha_ped || (o.renta as any)?.fecha_pedido_totvs || null;
                if (rawFecha && ['NA', 'N/A', 'NO', '-', 'NULL', 'UNDEFINED', 'INVALID DATE'].includes(String(rawFecha).toUpperCase().trim())) {
                    rawFecha = null;
                }
                const mon = (o.moneda && !['NA', 'N/A', 'NO', '-'].includes(String(o.moneda).toUpperCase().trim())) ? o.moneda : (o.renta?.detalles?.moneda || 'MXN');

                return {
                    id: o.id,
                    periodo: o.periodo,
                    po: o.po,
                    tarifa: o.tarifa,
                    moneda: mon,
                    estado: o.estado,
                    condiciones: o.condiciones,
                    pedido_totvs: rawTotvs,
                    fecha_pedido_totvs: rawFecha,
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
                ...(dto.fecha_pedido_totvs ? { fecha_pedido_totvs: dto.fecha_pedido_totvs } : {})
            };

            if (dto.pedido_totvs || dto.fecha_pedido_totvs) {
                await db.renta.update({
                    where: { id: renta.id },
                    data: {
                        ...(dto.pedido_totvs ? { no_registro_totvs: dto.pedido_totvs } : {}),
                        ...(dto.fecha_pedido_totvs ? { fecha_pedido_totvs: new Date(dto.fecha_pedido_totvs) } : {})
                    }
                }).catch((e: any) => this.logger.warn(`Could not sync renta totvs: ${e.message}`));
            }

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

            clearPresupuestosCache();
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

            // Execute in parallel
            await Promise.all([
                ...updates,
                toCreate.length > 0 ? db.ordenMensual.createMany({ data: toCreate, skipDuplicates: true }) : Promise.resolve(),
                (dto.pedido_totvs || dto.fecha_pedido_totvs) ? db.renta.updateMany({
                    where: { id: { in: dto.renta_ids } },
                    data: {
                        ...(dto.pedido_totvs ? { no_registro_totvs: dto.pedido_totvs } : {}),
                        ...(dto.fecha_pedido_totvs ? { fecha_pedido_totvs: new Date(dto.fecha_pedido_totvs) } : {})
                    }
                }) : Promise.resolve()
            ]);

            clearPresupuestosCache();

            return {
                success: true,
                message: `Se asignó la OC ${dto.po} a ${rentas.length} series para el periodo ${dto.periodo}.`,
                count: rentas.length
            };
        } catch (error: any) {
            this.logger.error(`Error en asignarMasivo: ${error.message}`);
            throw error;
        }
    }

    async copiarMesAnterior(dto: { periodo_origen: string, periodo_destino: string, cliente_id?: string, adc?: string, pedido_totvs?: string, fecha_pedido_totvs?: string }) {
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
                select: { id: true, activo_id: true, condiciones: true }
            });
            const existingMap = new Map<string, any>(existingDestino.map(e => [e.activo_id!, e]));

            let yaExistian = 0;
            const toCreate: any[] = [];
            const toUpdate: { id: string, condiciones: any }[] = [];
            const rentaUpdatesMap = new Map<string, { no_registro_totvs?: string, fecha_pedido_totvs?: Date }>();

            for (const o of ordenesFiltradas) {
                if (!o.activo_id) continue;

                // Resolve origin TOTVS and date from all possible representations
                const originTotvs = (o.condiciones as any)?.pedido_totvs || 
                                    (o.condiciones as any)?.pedido || 
                                    (o.condiciones as any)?.pedido_tovts || 
                                    o.renta?.no_registro_totvs || 
                                    undefined;

                const originFechaTotvs = (o.condiciones as any)?.fecha_pedido_totvs || 
                                         (o.condiciones as any)?.fecha_ped || 
                                         (o.renta?.fecha_pedido_totvs ? new Date(o.renta.fecha_pedido_totvs).toISOString().split('T')[0] : undefined) || 
                                         undefined;

                const finalTotvs = (dto.pedido_totvs && dto.pedido_totvs.trim()) ? dto.pedido_totvs.trim() : originTotvs;
                const finalFechaTotvs = (dto.fecha_pedido_totvs && dto.fecha_pedido_totvs.trim()) ? dto.fecha_pedido_totvs.trim() : originFechaTotvs;

                if (existingMap.has(o.activo_id)) {
                    yaExistian++;
                    const existing = existingMap.get(o.activo_id)!;
                    const existingCond = (existing.condiciones as any) || {};
                    const currentTotvs = existingCond.pedido_totvs || existingCond.pedido || existingCond.pedido_tovts;

                    // If existing destination order lacks TOTVS or a new TOTVS was explicitly provided in DTO:
                    if ((!currentTotvs && finalTotvs) || (dto.pedido_totvs && dto.pedido_totvs.trim())) {
                        const updatedCond = {
                            ...existingCond,
                            ...(finalTotvs ? { pedido_totvs: finalTotvs } : {}),
                            ...(finalFechaTotvs ? { fecha_pedido_totvs: finalFechaTotvs } : {})
                        };
                        toUpdate.push({
                            id: existing.id,
                            condiciones: updatedCond
                        });
                    }

                    if (o.renta_id && (dto.pedido_totvs || finalTotvs)) {
                        rentaUpdatesMap.set(o.renta_id, {
                            no_registro_totvs: dto.pedido_totvs?.trim() || finalTotvs,
                            ...(finalFechaTotvs ? { fecha_pedido_totvs: new Date(finalFechaTotvs) } : {})
                        });
                    }
                    continue;
                }

                const tarifaFinal = Number(o.renta?.detalles?.renta_real || o.renta?.detalles?.renta_base || o.tarifa || 0);
                const condiciones = {
                    ...((o.condiciones as any) || {}),
                    ...(finalTotvs ? { pedido_totvs: finalTotvs } : {}),
                    ...(finalFechaTotvs ? { fecha_pedido_totvs: finalFechaTotvs } : {})
                };

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
                    condiciones
                });

                if (o.renta_id && (dto.pedido_totvs || finalTotvs)) {
                    rentaUpdatesMap.set(o.renta_id, {
                        no_registro_totvs: dto.pedido_totvs?.trim() || finalTotvs,
                        ...(finalFechaTotvs ? { fecha_pedido_totvs: new Date(finalFechaTotvs) } : {})
                    });
                }
            }

            // 4. Inserción y actualización masiva
            if (toUpdate.length > 0) {
                await Promise.all(
                    toUpdate.map(u => db.ordenMensual.update({
                        where: { id: u.id },
                        data: { condiciones: u.condiciones }
                    }))
                );
            }

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

            // 5. Sincronizar renta si aplica
            if (dto.pedido_totvs && rentaUpdatesMap.size > 0) {
                const rentaIds = Array.from(rentaUpdatesMap.keys());
                await db.renta.updateMany({
                    where: { id: { in: rentaIds } },
                    data: {
                        no_registro_totvs: dto.pedido_totvs.trim(),
                        ...(dto.fecha_pedido_totvs ? { fecha_pedido_totvs: new Date(dto.fecha_pedido_totvs) } : {})
                    }
                }).catch((e: any) => this.logger.warn(`Could not sync rentas totvs: ${e.message}`));
            }

            clearPresupuestosCache();

            return {
                success: true,
                message: `Se copiaron ${toCreate.length} órdenes de ${dto.periodo_origen} a ${dto.periodo_destino} (${yaExistian} ya existían${toUpdate.length > 0 ? `, ${toUpdate.length} actualizadas con No. TOTVS` : ''}).`,
                copiadas: toCreate.length,
                yaExistian,
                actualizadas: toUpdate.length,
                totalOrigen: ordenesFiltradas.length
            };
        } catch (error: any) {
            this.logger.error(`Error en copiarMesAnterior: ${error.message}`);
            throw error;
        }
    }

    async registrarBatchFichaOc(dto: RegistrarBatchFichaOcDto) {
        const db = this.getDb();
        try {
            if (!dto.cliente_id) throw new Error('cliente_id es requerido');
            if (!dto.po || !dto.po.trim()) throw new Error('Folio OC Cliente es requerido');
            if (!dto.periodos || dto.periodos.length === 0) throw new Error('Debe especificar al menos un periodo');
            if (!dto.items || dto.items.length === 0) throw new Error('Debe seleccionar al menos una serie');

            const cliente = await db.cliente.findUnique({
                where: { id: dto.cliente_id },
                include: { sitios: true }
            });
            if (!cliente) throw new NotFoundException('Cliente no encontrado');

            const defaultSitioId = dto.sitio_id || cliente.sitios[0]?.id;

            // 1. Identify existing rentas vs new rentas to create
            const processedRentaIds: string[] = [];
            const activoToRentaMap = new Map<string, { id: string; contrato_id?: string | null; moneda?: string }>();

            const existingRentaIds = dto.items.map(i => i.rentaId).filter(Boolean) as string[];
            const existingRentas = existingRentaIds.length > 0 
                ? await db.renta.findMany({
                    where: { id: { in: existingRentaIds } },
                    include: { detalles: true }
                })
                : [];
            const existingRentasMap = new Map<string, any>(existingRentas.map(r => [r.id, r]));

            const rentaUpdates: Promise<any>[] = [];

            for (const item of dto.items) {
                const itemTotvs = item.pedido_totvs?.trim() || dto.pedido_totvs?.trim() || undefined;
                const targetSitioId = item.sitioId || dto.sitio_id || defaultSitioId;
                const targetCuenta = item.cuenta || dto.cuenta || undefined;

                if (item.rentaId && existingRentasMap.has(item.rentaId)) {
                    const r = existingRentasMap.get(item.rentaId)!;
                    processedRentaIds.push(r.id);
                    activoToRentaMap.set(item.assetId, { id: r.id, contrato_id: r.contrato_id, moneda: r.detalles?.moneda || 'MXN' });

                    rentaUpdates.push(
                        db.renta.update({
                            where: { id: r.id },
                            data: {
                                ...(itemTotvs ? { no_registro_totvs: itemTotvs } : {}),
                                ...(dto.fecha_pedido_totvs ? { fecha_pedido_totvs: new Date(dto.fecha_pedido_totvs) } : {}),
                            }
                        })
                    );

                    if (r.detalles) {
                        rentaUpdates.push(
                            db.detallesRenta.update({
                                where: { id: r.detalles.id },
                                data: {
                                    oc_cliente: dto.po.trim(),
                                    mes_cobro: dto.periodos[0],
                                    descuento_dias_caidos: item.descuento ?? 0,
                                    renta_base: item.renta_base,
                                    renta_real: item.renta_final
                                }
                            })
                        );
                    } else {
                        rentaUpdates.push(
                            db.detallesRenta.create({
                                data: {
                                    renta_id: r.id,
                                    oc_cliente: dto.po.trim(),
                                    mes_cobro: dto.periodos[0],
                                    descuento_dias_caidos: item.descuento ?? 0,
                                    renta_base: item.renta_base,
                                    renta_real: item.renta_final,
                                    moneda: 'MXN'
                                }
                            })
                        );
                    }
                } else {
                    const existingActive = await db.renta.findFirst({
                        where: {
                            activo_id: item.assetId,
                            cliente_id: dto.cliente_id,
                            estado: { notIn: ['CANCELADA', 'TERMINADA'] }
                        },
                        include: { detalles: true }
                    });

                    if (existingActive) {
                        processedRentaIds.push(existingActive.id);
                        activoToRentaMap.set(item.assetId, { id: existingActive.id, contrato_id: existingActive.contrato_id, moneda: existingActive.detalles?.moneda || 'MXN' });

                        rentaUpdates.push(
                            db.renta.update({
                                where: { id: existingActive.id },
                                data: {
                                    ...(itemTotvs ? { no_registro_totvs: itemTotvs } : {}),
                                    ...(dto.fecha_pedido_totvs ? { fecha_pedido_totvs: new Date(dto.fecha_pedido_totvs) } : {}),
                                }
                            })
                        );

                        if (existingActive.detalles) {
                            rentaUpdates.push(
                                db.detallesRenta.update({
                                    where: { id: existingActive.detalles.id },
                                    data: {
                                        oc_cliente: dto.po.trim(),
                                        mes_cobro: dto.periodos[0],
                                        descuento_dias_caidos: item.descuento ?? 0,
                                        renta_base: item.renta_base,
                                        renta_real: item.renta_final
                                    }
                                })
                            );
                        } else {
                            rentaUpdates.push(
                                db.detallesRenta.create({
                                    data: {
                                        renta_id: existingActive.id,
                                        oc_cliente: dto.po.trim(),
                                        mes_cobro: dto.periodos[0],
                                        descuento_dias_caidos: item.descuento ?? 0,
                                        renta_base: item.renta_base,
                                        renta_real: item.renta_final,
                                        moneda: 'MXN'
                                    }
                                })
                            );
                        }
                    } else {
                        const createdRenta = await db.renta.create({
                            data: {
                                cliente_id: dto.cliente_id,
                                sitio_id: targetSitioId,
                                activo_id: item.assetId,
                                cuenta: targetCuenta,
                                fecha_inicio: new Date(`${dto.periodos[0]}-01`),
                                fecha_fin: dto.periodos.length > 1
                                    ? new Date(`${dto.periodos[dto.periodos.length - 1]}-28`)
                                    : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                                no_registro_totvs: itemTotvs,
                                fecha_pedido_totvs: dto.fecha_pedido_totvs ? new Date(dto.fecha_pedido_totvs) : undefined,
                                detalles: {
                                    create: {
                                        oc_cliente: dto.po.trim(),
                                        mes_cobro: dto.periodos[0],
                                        descuento_dias_caidos: item.descuento ?? 0,
                                        renta_base: item.renta_base,
                                        renta_real: item.renta_final,
                                        moneda: 'MXN'
                                    }
                                }
                            }
                        });
                        processedRentaIds.push(createdRenta.id);
                        activoToRentaMap.set(item.assetId, { id: createdRenta.id, contrato_id: null, moneda: 'MXN' });
                    }
                }
            }

            await Promise.all(rentaUpdates);

            // 2. Batch process ordenesMensuales for all periodos
            const assetIds = dto.items.map(i => i.assetId);
            const existingOrders = await db.ordenMensual.findMany({
                where: {
                    activo_id: { in: assetIds },
                    periodo: { in: dto.periodos }
                }
            });
            const existingOrdersMap = new Map<string, any>(
                existingOrders.map(o => [`${o.activo_id}___${o.periodo}`, o])
            );

            const ordersToCreate: any[] = [];
            const ordersToUpdate: Promise<any>[] = [];

            for (const item of dto.items) {
                const rentaInfo = activoToRentaMap.get(item.assetId);
                const itemTotvs = item.pedido_totvs?.trim() || dto.pedido_totvs?.trim() || undefined;

                for (const periodo of dto.periodos) {
                    const key = `${item.assetId}___${periodo}`;
                    const existingOrder = existingOrdersMap.get(key);

                    const condiciones = {
                        ...((existingOrder?.condiciones as any) || {}),
                        ...(itemTotvs ? { pedido_totvs: itemTotvs } : {}),
                        ...(dto.fecha_pedido_totvs ? { fecha_pedido_totvs: dto.fecha_pedido_totvs } : {})
                    };

                    if (existingOrder) {
                        ordersToUpdate.push(
                            db.ordenMensual.update({
                                where: { id: existingOrder.id },
                                data: {
                                    po: dto.po.trim(),
                                    tarifa: item.renta_final,
                                    moneda: rentaInfo?.moneda || 'MXN',
                                    estado: 'GENERADA',
                                    condiciones
                                }
                            })
                        );
                    } else {
                        ordersToCreate.push({
                            cliente_id: dto.cliente_id,
                            renta_id: rentaInfo?.id || null,
                            activo_id: item.assetId,
                            contrato_id: rentaInfo?.contrato_id || null,
                            periodo: periodo,
                            po: dto.po.trim(),
                            tarifa: item.renta_final,
                            moneda: rentaInfo?.moneda || 'MXN',
                            estado: 'GENERADA',
                            condiciones
                        });
                    }
                }
            }

            await Promise.all([
                ...ordersToUpdate,
                ordersToCreate.length > 0
                    ? db.ordenMensual.createMany({ data: ordersToCreate, skipDuplicates: true })
                    : Promise.resolve()
            ]);

            clearPresupuestosCache();

            return {
                message: `Se registró con éxito la OC ${dto.po} para ${dto.items.length} series en ${dto.periodos.length} periodo(s).`,
                seriesCount: dto.items.length,
                periodosCount: dto.periodos.length,
                totalOrdenes: dto.items.length * dto.periodos.length
            };
        } catch (error: any) {
            this.logger.error(`Error en registrarBatchFichaOc: ${error.message}`);
            throw error;
        }
    }
}
