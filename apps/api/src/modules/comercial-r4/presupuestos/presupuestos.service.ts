import { Injectable, Logger } from '@nestjs/common';
import { PrismaDynamicService } from '../../../database/prisma-dynamic.service';
import dayjs from 'dayjs';

interface DashboardFilters {
    year: number;
    months: number[];
    cliente_id?: string;
    sitio_id?: string;
    moneda?: string;
    adc?: string;
}

function stripAccents(str: string): string {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function cleanAdcName(name: string | null | undefined): string {
    if (!name) return '';
    return stripAccents(name)
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function isSameAdc(adcCandidate: string | null | undefined, targetAdc: string): boolean {
    const c = cleanAdcName(adcCandidate);
    const t = cleanAdcName(targetAdc);
    if (!c || !t) return false;

    // 1. Exact normalized match
    if (c === t) return true;

    // 2. Token based match: all significant words (>2 chars)
    const cTokens = c.split(' ').filter(w => w.length > 2);
    const tTokens = t.split(' ').filter(w => w.length > 2);

    if (cTokens.length === 0 || tTokens.length === 0) return false;

    // If both have multiple words (e.g. "Simalu Leon" vs "Simalu Leon" or "Juan Perez" vs "Juan Perez Gonzalez")
    const allTargetInCandidate = tTokens.every(token => cTokens.includes(token));
    const allCandidateInTarget = cTokens.every(token => tTokens.includes(token));

    if (allTargetInCandidate || allCandidateInTarget) return true;

    // If one is a single significant distinctive name (>= 4 chars), like searching by last name or first name
    if (tTokens.length === 1 && cTokens.includes(tTokens[0]) && tTokens[0].length >= 4) {
        return true;
    }
    if (cTokens.length === 1 && tTokens.includes(cTokens[0]) && cTokens[0].length >= 4) {
        return true;
    }

    return false;
}

export function getEffectiveAdc(r: any): string {
    if (!r) return 'Sin ADC';
    const raw = r.adc || r.activo?.adc || r.sitio?.adc || r.cliente?.adc || (r.cliente as any)?.datos_comerciales?.adc;
    return raw?.trim() || 'Sin ADC';
}

export function getEffectiveOrderAdc(o: any): string {
    if (!o) return 'Sin ADC';
    const raw = o.renta?.adc || o.activo?.adc || o.renta?.activo?.adc || o.renta?.sitio?.adc || o.cliente?.adc || (o.cliente as any)?.datos_comerciales?.adc;
    return raw?.trim() || 'Sin ADC';
}

function matchAdcKeywords(entity: any, keywords: string[]): boolean {
    if (!keywords || keywords.length === 0) return true;
    const effective = typeof entity === 'string' 
        ? entity 
        : (entity && (entity.renta !== undefined || entity.activo !== undefined && entity.periodo !== undefined) 
            ? getEffectiveOrderAdc(entity) 
            : getEffectiveAdc(entity));
    return keywords.some(kw => isSameAdc(effective, kw));
}

export function isBackupOrInactive(r: {
    estado?: string | null;
    activo?: { estatus?: string | null; estatus_operativo?: string | null; situacion?: string | null } | null;
    condiciones?: any;
    detalles?: { moneda?: string | null } | null;
}): boolean {
    if (!r) return true;
    
    // Si la moneda es "NA", no es una renta monetaria presupuestable
    const moneda = (r.detalles?.moneda || '').toUpperCase().trim();
    if (moneda === 'NA' || moneda === 'N/A') return true;

    const estadoRenta = (r.estado || '').toUpperCase().trim();
    if (
        estadoRenta.includes('INACTIV') ||
        estadoRenta.includes('BACK') ||
        estadoRenta.includes('COMODATO') ||
        estadoRenta.includes('BAJA') ||
        estadoRenta.includes('CANCELAD') ||
        estadoRenta.includes('TALLER')
    ) {
        return true;
    }

    const estatusActivo = (r.activo?.estatus || '').toUpperCase().trim();
    const estatusOp = (r.activo?.estatus_operativo || '').toUpperCase().trim();
    const situacion = (r.activo?.situacion || '').toUpperCase().trim();

    for (const st of [estatusActivo, estatusOp, situacion]) {
        if (!st) continue;
        if (
            st.includes('INACTIV') ||
            st.includes('BACK') ||
            st.includes('COMODATO') ||
            st.includes('BAJA') ||
            st.includes('TALLER') ||
            st.includes('POR RETIRAR') ||
            st.includes('RETIRAD')
        ) {
            return true;
        }
    }

    const cond = (r.condiciones as any) || {};
    const condStr = JSON.stringify(cond).toUpperCase();
    if (
        condStr.includes('"ES_BACKUP":TRUE') ||
        condStr.includes('"TIPO":"BACKUP"') ||
        condStr.includes('"ESTATUS":"BACK UP"') ||
        condStr.includes('"ESTATUS":"BACKUP"')
    ) {
        return true;
    }

    return false;
}

export function isRentaActivaVigente(r: {
    estado?: string | null;
    activo?: { estatus?: string | null; estatus_operativo?: string | null; situacion?: string | null } | null;
    condiciones?: any;
    detalles?: { moneda?: string | null } | null;
}): boolean {
    if (isBackupOrInactive(r)) return false;
    const estadoRenta = (r.estado || '').toUpperCase().trim();
    return estadoRenta === 'VIGENTE' || estadoRenta === 'IMPORTADA' || estadoRenta === 'ACTIVA' || estadoRenta === 'ACTIVO' || estadoRenta === 'RENOVADA';
}

export function hasValidPO(po: string | null | undefined): boolean {
    if (!po) return false;
    const clean = String(po).trim().toUpperCase();
    return clean !== '' && clean !== '-' && !['PENDIENTE', 'NULL', 'UNDEFINED', 'SIN OC', 'SIN PO', 'N/A', 'NA'].includes(clean);
}

export function hasValidTotvs(totvs: string | null | undefined): boolean {
    if (!totvs) return false;
    const clean = String(totvs).trim().toUpperCase();
    return clean !== '' && clean !== '-' && !['PENDIENTE', 'NA', 'N/A', 'NO', 'NULL', 'UNDEFINED', 'SIN TOTVS', 'INVALID DATE'].includes(clean);
}

export function isPedidoEnviado(o: any): boolean {
    if (!o) return false;
    // Ignorar órdenes asociadas a equipos en Back Up o Inactivos
    if (o.renta && isBackupOrInactive(o.renta)) return false;
    if (o.activo) {
        const st = (o.activo.estatus || '').toUpperCase().trim();
        const stOp = (o.activo.estatus_operativo || '').toUpperCase().trim();
        if (st.includes('BACK') || st.includes('INACTIV') || st.includes('COMODATO') || stOp.includes('BACK') || stOp.includes('INACTIV')) {
            return false;
        }
    }
    if (o.estado === 'FACTURADA') return true;
    const hasPo = hasValidPO(o.po);
    const cond = (o.condiciones as any) || {};
    const rawTotvs = cond.pedido_totvs || cond.pedido || cond.pedido_tovts || o.renta?.no_registro_totvs;
    const hasTotvs = hasValidTotvs(rawTotvs);
    // Para considerarse "Pedido Enviado" debe tener OC válida y No. Registro TOTVS asignado/emitido
    return hasPo && hasTotvs;
}

const dashboardCache = new Map<string, { timestamp: number, data: any }>();
const CACHE_TTL_MS = 1 * 1000; // 1 second

export function clearPresupuestosCache() {
    dashboardCache.clear();
}

@Injectable()
export class PresupuestosService {
    private readonly logger = new Logger(PresupuestosService.name);

    constructor(private readonly prismaService: PrismaDynamicService) { }

    private getDb() {
        const db = PrismaDynamicService.clients.r4;
        if (!db) throw new Error('Database client for R4 not initialized');
        return db;
    }

    async getDashboardStats(filters: DashboardFilters) {
        const cacheKey = JSON.stringify({
            year: filters.year,
            months: filters.months,
            cliente_id: filters.cliente_id || null,
            sitio_id: filters.sitio_id || null,
            moneda: filters.moneda || null,
            adc: filters.adc ? filters.adc.trim().toLowerCase() : null,
        });
        const cached = dashboardCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
            return cached.data;
        }

        const db = this.getDb();
        const { year, months = [], cliente_id, sitio_id, moneda, adc } = filters;

        if (months.length === 0) {
            // Default to current month if nothing provided to avoid errors
            months.push(dayjs().month() + 1);
        }

        // Sort months ascending
        months.sort((a, b) => a - b);

        const earliestMonth = months[0];
        const earliestPeriodStr = `${year}-${String(earliestMonth).padStart(2, '0')}`;

        const currentPeriodStrs = months.map(m => `${year}-${String(m).padStart(2, '0')}`);

        // Fetch dynamic exchange rate for the requested period (year, latest month)
        const latestMonth = months[months.length - 1];
        let rateConfig = await db.tipoCambioMensual.findUnique({
            where: { year_month: { year: Number(year), month: Number(latestMonth) } }
        }).catch(() => null);

        if (!rateConfig || !rateConfig.activo) {
            rateConfig = await db.tipoCambioMensual.findFirst({
                where: { activo: true },
                orderBy: [{ year: 'desc' }, { month: 'desc' }]
            }).catch(() => null);
        }
        const exchangeRate = rateConfig?.tipo_cambio || 18.0;

        // 1. Fetch all rentas (filtering by dimensions if provided)
        let rentasWhere: any = {};
        if (cliente_id) rentasWhere.cliente_id = cliente_id;
        if (sitio_id) rentasWhere.sitio_id = sitio_id;

        const adcKeywords = adc ? adc.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];

        const allRentas = await db.renta.findMany({
            where: rentasWhere,
            include: {
                detalles: true,
                activo: true,
                cliente: true,
                sitio: true,
            }
        });

        // 2. Fetch all orders (OrdenMensual)
        let ordersWhere: any = { activo_id: { not: null } };
        if (cliente_id) ordersWhere.cliente_id = cliente_id;

        const allOrders = await db.ordenMensual.findMany({
            where: ordersWhere,
            include: {
                cliente: true,
                activo: {
                    include: { sitio: true }
                },
                renta: {
                    include: {
                        sitio: true,
                        activo: {
                            include: { sitio: true }
                        },
                        detalles: true,
                    }
                }
            }
        });

        // 3. Fetch facturación manual (ingresada por el Gerente) for selected periods
        const facturacionMensual = await db.facturacionMensual.findMany({
            where: { periodo: { in: currentPeriodStrs } }
        }).catch(() => []);

        // We will process the data in memory to group by Currency (MXN / USD) and calculate the metrics.
        const stats = {
            MXN: this.initCurrencyStats(),
            USD: this.initCurrencyStats()
        };

        // Map facturado by moneda (sum across selected months)
        const facturadoByMoneda: Record<string, number> = { MXN: 0, USD: 0 };
        for (const f of facturacionMensual) {
            const key = f.moneda.toUpperCase();
            if (key in facturadoByMoneda) {
                facturadoByMoneda[key] += f.monto;
            }
        }

        const adcsMap = new Map<string, { adc: string; cliente: string; moneda: string; budget: number; sentPOs: number }>();
        const pendingByClientAdc: any[] = [];
        const clientTotals = new Map<string, { presupuesto: number, pendiente: number }>();
        const masterMap = new Map<string, {
            adc: string;
            cliente: string;
            moneda: string;
            presupuesto: number;
            enviado: number;
            equipos_detenidos: number;
            pendiente_acumulado: number;
        }>();

        for (const r of allRentas) {
            // Apply ADC and Sitio filters manually
            if (adcKeywords.length > 0) {
                if (!matchAdcKeywords(r, adcKeywords)) {
                    continue;
                }
            }

            const rMoneda = r.detalles?.moneda?.toUpperCase() || 'MXN';
            if (moneda && moneda !== rMoneda) continue;

            const currencyStat = stats[rMoneda as keyof typeof stats];
            if (!currencyStat) continue;

            // Monthly Budget Contribution: Estatus = Activo (excluye Back Up e Inactivos)
            if (!isRentaActivaVigente(r)) continue;

            const estatusNorm = (r.activo?.estatus || r.activo?.estatus_operativo || '').trim().toUpperCase();
            const isDetenido = estatusNorm.includes('DETENIDO');
            const budgetAmount = Number(r.detalles?.renta_real || r.detalles?.renta_base || r.tarifa || 0);

            if (isDetenido) {
                currencyStat.equipos_detenidos += budgetAmount * months.length;
            } else {
                currencyStat.presupuesto_mes += budgetAmount * months.length;
                // ADC Compliance tracking
                const adcName = getEffectiveAdc(r);
                const clientName = r.cliente.razon_social;
                const adcKey = `${adcName}___${clientName}___${rMoneda}`;
                if (!adcsMap.has(adcKey)) {
                    adcsMap.set(adcKey, { adc: adcName, cliente: clientName, moneda: rMoneda, budget: 0, sentPOs: 0 });
                }
                adcsMap.get(adcKey)!.budget += budgetAmount;

                // Client Total Tracking
                if (!clientTotals.has(clientName)) clientTotals.set(clientName, { presupuesto: 0, pendiente: 0 });
                clientTotals.get(clientName)!.presupuesto += budgetAmount * months.length;
            }
        }

        // PENDIENTE ACUMULADO AL MES ANTERIOR:
        // Fuente oficial: campo importe_recuperado de DetallesRenta (cargado desde el Excel/sistema).
        // Si no tiene importe_recuperado registrado, el pendiente acumulado es 0 (-).
        for (const r of allRentas) {
            if (adcKeywords.length > 0) {
                if (!matchAdcKeywords(r, adcKeywords)) continue;
            }

            const rMoneda = (r.detalles?.moneda || 'MXN').toUpperCase();
            if (moneda && moneda !== rMoneda) continue;
            const currencyStat = stats[rMoneda as keyof typeof stats];
            if (!currencyStat) continue;

            const estadoNormAcc = (r.estado || '').toUpperCase().trim();
            const isRentaVigente = estadoNormAcc === 'VIGENTE' || estadoNormAcc === 'IMPORTADA' || estadoNormAcc === 'ACTIVA' || estadoNormAcc === 'ACTIVO';
            if (!isRentaVigente) continue;

            const importeRecuperado = Number(r.detalles?.importe_recuperado || 0);
            if (importeRecuperado <= 0) continue;

            const clientName = r.cliente.razon_social;
            const adcName = getEffectiveAdc(r);

            currencyStat.acumulado += importeRecuperado;

            pendingByClientAdc.push({
                cliente: clientName,
                adc: adcName,
                moneda: rMoneda,
                pendiente: importeRecuperado
            });

            if (!clientTotals.has(clientName)) clientTotals.set(clientName, { presupuesto: 0, pendiente: 0 });
            clientTotals.get(clientName)!.pendiente += importeRecuperado;
        }


        // Sent POs in current month - Consolidated by OC / Sitio / Cliente
        const currentMonthOrders = allOrders.filter(o => currentPeriodStrs.includes(o.periodo));
        const consolidatedOrdersMap = new Map<string, {
            cliente: string;
            cuenta?: string;
            po: string;
            sitio: string;
            pedido_totvs: string;
            moneda: string;
            importe: number;
            cantidad_equipos: number;
        }>();

        for (const o of currentMonthOrders) {
            // Check filters
            if (sitio_id && o.renta?.sitio_id !== sitio_id) continue;

            const adcName = getEffectiveOrderAdc(o);
            if (adcKeywords.length > 0) {
                if (!matchAdcKeywords(o, adcKeywords)) {
                    continue;
                }
            }

            const oMoneda = o.moneda?.toUpperCase() || o.renta?.detalles?.moneda?.toUpperCase() || 'MXN';
            if (moneda && moneda !== oMoneda) continue;

            // Solo sumar como "Enviado" si la orden tiene OC válida Y No. Registro TOTVS emitido (o ya está facturada)
            const isValidSent = isPedidoEnviado(o);
            if (!isValidSent) continue;

            const currencyStat = stats[oMoneda as keyof typeof stats];
            if (currencyStat) {
                const rentaTarifa = Number(o.renta?.detalles?.renta_real || o.renta?.detalles?.renta_base || o.renta?.tarifa || 0);
                const amount = (o.tarifa && o.tarifa > 0 && o.tarifa <= (rentaTarifa * 3 || 300000)) ? o.tarifa : (rentaTarifa || o.tarifa || 0);
                currencyStat.pedidos_enviados += amount;

                // Add to ADC compliance
                const clientName = o.cliente?.razon_social || '';
                const adcKey = `${adcName}___${clientName}___${oMoneda}`;

                if (adcsMap.has(adcKey)) {
                    adcsMap.get(adcKey)!.sentPOs += amount;
                } else {
                    // Try case/spacing-insensitive match
                    for (const entry of adcsMap.values()) {
                        if (
                            entry.moneda === oMoneda &&
                            entry.adc.trim().toUpperCase() === adcName.trim().toUpperCase() &&
                            entry.cliente.trim().toUpperCase() === clientName.trim().toUpperCase()
                        ) {
                            entry.sentPOs += amount;
                            break;
                        }
                    }
                }

                const condicionesObj = (o.condiciones as any) || {};
                const poNum = (o.po || '-').trim();
                const rawCuenta = o.renta?.cuenta || o.activo?.cuenta || o.renta?.sitio?.cuenta || o.activo?.sitio?.cuenta || o.renta?.sitio?.nombre || o.activo?.sitio?.nombre || '';
                const cuentaNombre = (rawCuenta && rawCuenta.trim() !== '' && rawCuenta.trim() !== '-') ? rawCuenta.trim() : '-';
                const sitioNombre = (o.renta?.sitio?.nombre || o.activo?.sitio?.nombre || o.renta?.activo?.sitio?.nombre || (o.renta?.sitio as any)?.ciudad || (o.activo?.sitio as any)?.ciudad || '-').trim();
                const totvsNum = (condicionesObj.pedido_totvs || condicionesObj.pedido || condicionesObj.pedido_tovts || o.renta?.no_registro_totvs || '-').trim();

                const groupKey = `${clientName}___${cuentaNombre}___${poNum}___${sitioNombre}___${oMoneda}`;
                if (!consolidatedOrdersMap.has(groupKey)) {
                    consolidatedOrdersMap.set(groupKey, {
                        cliente: clientName,
                        cuenta: cuentaNombre,
                        po: poNum,
                        sitio: sitioNombre,
                        pedido_totvs: totvsNum,
                        moneda: oMoneda,
                        importe: 0,
                        cantidad_equipos: 0
                    });
                }
                const group = consolidatedOrdersMap.get(groupKey)!;
                group.importe += amount;
                group.cantidad_equipos += 1;
                if ((group.pedido_totvs === '-' || group.pedido_totvs.toUpperCase() === 'PENDIENTE') && totvsNum && totvsNum !== '-' && totvsNum.toUpperCase() !== 'PENDIENTE') {
                    group.pedido_totvs = totvsNum;
                }
            }
        }

        // Sort: Alphabetical by client name, then secondary by sitio
        const pedidos_del_mes = Array.from(consolidatedOrdersMap.values()).sort((a, b) => {
            const comp = (a.cliente || '').localeCompare(b.cliente || '', 'es', { sensitivity: 'base' });
            if (comp !== 0) return comp;
            const compSitio = (a.sitio || '').localeCompare(b.sitio || '', 'es', { sensitivity: 'base' });
            if (compSitio !== 0) return compSitio;
            return b.importe - a.importe;
        });

        const isAdcFiltered = adcKeywords.length > 0;
        for (const key of ['MXN', 'USD'] as const) {
            const s = stats[key];
            s.total_a_facturar = s.presupuesto_mes + s.acumulado;
            // Use manually entered facturado value from Gerente when not filtered by ADC; fallback to pedidos_enviados
            s.facturado = (!isAdcFiltered && facturadoByMoneda[key] > 0) ? facturadoByMoneda[key] : s.pedidos_enviados;
            // Faltante measures the remaining gap to meet the month's budget goal
            s.faltante = Math.max(0, s.presupuesto_mes - s.pedidos_enviados);
            // Cumplimiento General measures month's goal achievement (Pedidos Enviados / Presupuesto Mes)
            s.cumplimiento_general = s.presupuesto_mes > 0 ? (s.pedidos_enviados / s.presupuesto_mes) * 100 : 0;
        }

        const adcs = Array.from(adcsMap.values()).map((data) => {
            return {
                adc: data.adc,
                cliente: data.cliente,
                moneda: data.moneda,
                presupuesto: data.budget,
                enviado: data.sentPOs,
                cumplimiento: data.budget > 0 ? (data.sentPOs / data.budget) * 100 : 0
            };
        });

        const totalPorCliente = Array.from(clientTotals.entries()).map(([cliente, data]) => ({
            cliente,
            presupuesto_mes: data.presupuesto,
            pendiente_acumulado: data.pendiente,
            total_facturar: data.presupuesto + data.pendiente
        }));

        // Recuperacion de meses anteriores
        const recuperados = allOrders.filter(o => {
            if (o.periodo >= earliestPeriodStr) return false;
            const createdM = dayjs(o.created_at).format('YYYY-MM');
            if (!currentPeriodStrs.includes(createdM)) return false;
            if (adcKeywords.length > 0) {
                const adcCandidates = [o.renta?.adc, o.renta?.activo?.adc, o.renta?.sitio?.adc, (o.cliente as any)?.adc, (o.cliente as any)?.datos_comerciales?.adc];
                if (!matchAdcKeywords(adcCandidates, adcKeywords)) {
                    return false;
                }
            }
            return true;
        }).map(o => {
            const rawAdc = o.renta?.adc || o.renta?.activo?.adc || o.renta?.sitio?.adc || (o.cliente as any)?.adc || (o.cliente as any)?.datos_comerciales?.adc;
            return {
                adc: rawAdc?.trim() || 'Sin ADC',
                cliente: o.cliente.razon_social,
                periodo_original: o.periodo,
                po: o.po,
                importe: o.tarifa || 0,
                moneda: o.moneda || 'MXN'
            };
        });

        const observaciones: any[] = [];

        const adcsBajoCumplimiento = adcs.filter(a => a.cumplimiento < 50);
        if (adcsBajoCumplimiento.length > 0) {
            const names = Array.from(new Set(adcsBajoCumplimiento.map(a => a.adc))).join(', ');
            observaciones.push({
                tipo: 'Alerta',
                mensaje: `Atención: Los ADCs (${names}) tienen un cumplimiento menor al 50%.`
            });
        }

        if (stats.MXN.equipos_detenidos > 0 || stats.USD.equipos_detenidos > 0) {
            observaciones.push({
                tipo: 'Warning',
                mensaje: `Existen equipos inactivos con clientes que continúan afectando el presupuesto del mes.`
            });
        }

        if (pendingByClientAdc.length > 0) {
            observaciones.push({
                tipo: 'Info',
                mensaje: `Existen ${pendingByClientAdc.length} registros de clientes con montos pendientes de facturar acumulados.`
            });
        }

        if (observaciones.length === 0) {
            observaciones.push({ tipo: 'Info', mensaje: 'Reporte generado automáticamente. Todos los indicadores en orden.' });
        }

        for (const r of allRentas) {
            if (!isRentaActivaVigente(r)) continue;

            if (adcKeywords.length > 0) {
                if (!matchAdcKeywords(r, adcKeywords)) {
                    continue;
                }
            }
            const rMoneda = r.detalles?.moneda?.toUpperCase() || 'MXN';
            if (moneda && moneda !== rMoneda) continue;

            const adcName = getEffectiveAdc(r);
            const clientName = r.cliente.razon_social;
            const key = `${adcName}___${clientName}___${rMoneda}`;

            if (!masterMap.has(key)) {
                masterMap.set(key, {
                    adc: adcName,
                    cliente: clientName,
                    moneda: rMoneda,
                    presupuesto: 0,
                    enviado: 0,
                    equipos_detenidos: 0,
                    pendiente_acumulado: 0
                });
            }

            const item = masterMap.get(key)!;
            const estatusNorm = (r.activo?.estatus || r.activo?.estatus_operativo || '').trim().toUpperCase();
            const isDetenido = estatusNorm.includes('DETENIDO');
            const budgetAmount = Number(r.detalles?.renta_real || r.detalles?.renta_base || r.tarifa || 0);

            if (isDetenido) {
                item.equipos_detenidos += budgetAmount;
            } else {
                item.presupuesto += budgetAmount;
            }

            // Pendiente Acumulado al Mes Anterior (tabla maestra):
            // Fuente: importe_recuperado en DetallesRenta (aplica a la cuenta del cliente)
            const totalPendiente = Number(r.detalles?.importe_recuperado || 0);
            if (totalPendiente > 0) {
                item.pendiente_acumulado += totalPendiente;
            }
        }

        for (const o of currentMonthOrders) {
            if (sitio_id && o.renta?.sitio_id !== sitio_id) continue;
            const oMoneda = o.moneda?.toUpperCase() || o.renta?.detalles?.moneda?.toUpperCase() || 'MXN';
            if (moneda && moneda !== oMoneda) continue;

            // Solo sumar a Enviado si la orden tiene OC válida Y No. Registro TOTVS emitido (o ya está facturada)
            const isValidSent = isPedidoEnviado(o);
            if (!isValidSent) continue;

            const adcName = getEffectiveOrderAdc(o);
            if (adcKeywords.length > 0) {
                if (!matchAdcKeywords(o, adcKeywords)) {
                    continue;
                }
            }

            const clientName = o.cliente?.razon_social || '';
            const key = `${adcName}___${clientName}___${oMoneda}`;
            const rentaTarifa = Number(o.renta?.detalles?.renta_real || o.renta?.detalles?.renta_base || o.renta?.tarifa || 0);
            const orderAmount = (o.tarifa && o.tarifa > 0 && o.tarifa <= (rentaTarifa * 3 || 300000)) ? o.tarifa : (rentaTarifa || o.tarifa || 0);

            if (masterMap.has(key)) {
                masterMap.get(key)!.enviado += orderAmount;
            } else {
                let found = false;
                for (const item of masterMap.values()) {
                    if (
                        item.moneda === oMoneda &&
                        item.cliente.trim().toUpperCase() === clientName.trim().toUpperCase() &&
                        isSameAdc(item.adc, adcName)
                    ) {
                        item.enviado += orderAmount;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    masterMap.set(key, {
                        adc: adcName,
                        cliente: clientName,
                        moneda: oMoneda,
                        presupuesto: 0,
                        enviado: orderAmount,
                        equipos_detenidos: 0,
                        pendiente_acumulado: 0
                    });
                }
            }
        }

        const tabla_maestra = Array.from(masterMap.values()).map(item => {
            const baseFacturar = Math.max(0, item.presupuesto - item.equipos_detenidos);
            const total_facturar = baseFacturar + item.pendiente_acumulado;
            // % Cumplimiento del presupuesto del periodo
            const metaPresupuesto = baseFacturar > 0 ? baseFacturar : item.presupuesto;
            const cumplimiento = metaPresupuesto > 0
                ? (item.enviado / metaPresupuesto) * 100
                : (item.enviado > 0 ? 100 : 0);
            return {
                ...item,
                cumplimiento,
                total_facturar
            };
        }).sort((a, b) => {
            const adcCompare = (a.adc || '').localeCompare(b.adc || '', 'es', { sensitivity: 'base' });
            if (adcCompare !== 0) return adcCompare;
            return b.total_facturar - a.total_facturar;
        });

        // Dynamically compute Egresos & SMP based on the scoped rentas for this ADC / filter
        const scopedRentas = allRentas.filter(r => {
            if (isBackupOrInactive(r)) return false;
            if (adcKeywords.length > 0) {
                return matchAdcKeywords(r, adcKeywords);
            }
            return true;
        });

        const pagos_renta_terceros = scopedRentas
            .filter(r => {
                const prop = (r.propietario || r.activo?.propietario || '').toUpperCase();
                const cond = (r.condiciones as any) || {};
                return prop.includes('TERCERO') || cond.renta_terceros === true || (r.distribuidor && r.distribuidor !== '-');
            })
            .map(r => {
                const cond = (r.condiciones as any) || {};
                const distName = r.distribuidor || r.activo?.distribuidor || 'Distribuidor';
                const clientName = r.cliente?.razon_social || 'Cliente';
                const cur = r.detalles?.moneda?.toUpperCase() || cond.moneda || 'MXN';
                const amount = Number(cond.renta_terceros_monto || r.detalles?.renta_base || r.tarifa || 0);
                return {
                    distribuidor: distName,
                    cliente: clientName,
                    activo_serie: r.activo?.serie || '-',
                    activo_modelo: r.activo?.modelo || '-',
                    importe: amount,
                    moneda: cur,
                    estatus: r.estado || 'VIGENTE'
                };
            });

        const pagos_mantenimiento_preventivo = scopedRentas
            .filter(r => {
                const cond = (r.condiciones as any) || {};
                const cost = Number(cond.costo_poliza_distribuidor || 0);
                const polType = (cond.tipo_poliza || '').toUpperCase();
                return cost > 0 || polType.includes('SMP') || polType.includes('PREVENTIVO');
            })
            .map(r => {
                const cond = (r.condiciones as any) || {};
                const distName = r.distribuidor || r.activo?.distribuidor || 'Distribuidor';
                const clientName = r.cliente?.razon_social || 'Cliente';
                const cost = Number(cond.costo_poliza_distribuidor || 0);
                const cur = cond.moneda_pago_distribuidor?.toUpperCase() || r.detalles?.moneda?.toUpperCase() || 'MXN';
                return {
                    distribuidor: distName,
                    cliente: clientName,
                    equipo_serie: r.activo?.serie || '-',
                    equipo_modelo: r.activo?.modelo || '-',
                    servicio: cond.tipo_poliza || 'SMP Preventivo',
                    costo_poliza: cost,
                    moneda: cur,
                    estatus: 'EJECUTADO'
                };
            });

        const distMap = new Map<string, { distribuidor: string; aplica_smp: number; ejecutados: number }>();
        for (const r of scopedRentas) {
            const dist = (r.distribuidor || r.activo?.distribuidor || 'SIN DISTRIBUIDOR').trim().toUpperCase();
            if (dist === '-' || dist === 'SIN DISTRIBUIDOR') continue;
            if (!distMap.has(dist)) {
                distMap.set(dist, { distribuidor: dist, aplica_smp: 0, ejecutados: 0 });
            }
            const dObj = distMap.get(dist)!;
            dObj.aplica_smp += 1;
            const isDetenido = (r.activo?.estatus || '').toUpperCase().includes('DETENIDO');
            if (!isDetenido) {
                dObj.ejecutados += 1;
            }
        }

        const cumplimiento_distribuidores = Array.from(distMap.values()).map(d => {
            const brecha = Math.max(0, d.aplica_smp - d.ejecutados);
            const cumplimiento = d.aplica_smp > 0 ? (d.ejecutados / d.aplica_smp) * 100 : 100;
            let estatus = 'EN META';
            if (cumplimiento < 80) estatus = 'CRÍTICO';
            else if (cumplimiento < 90) estatus = 'ATENCIÓN';
            return {
                distribuidor: d.distribuidor,
                aplica_smp: d.aplica_smp,
                ejecutados: d.ejecutados,
                brecha,
                cumplimiento: Math.round(cumplimiento * 10) / 10,
                estatus
            };
        }).sort((a, b) => a.cumplimiento - b.cumplimiento);

        const buildPagosSummary = (targetCur: 'USD' | 'MXN') => {
            const pMap = new Map<string, { distribuidor: string; preventivos: number; renta_terceros: number }>();
            for (const p of pagos_mantenimiento_preventivo.filter(x => x.moneda === targetCur)) {
                const key = p.distribuidor.toUpperCase();
                if (!pMap.has(key)) pMap.set(key, { distribuidor: p.distribuidor, preventivos: 0, renta_terceros: 0 });
                pMap.get(key)!.preventivos += p.costo_poliza;
            }
            for (const p of pagos_renta_terceros.filter(x => x.moneda === targetCur)) {
                const key = p.distribuidor.toUpperCase();
                if (!pMap.has(key)) pMap.set(key, { distribuidor: p.distribuidor, preventivos: 0, renta_terceros: 0 });
                pMap.get(key)!.renta_terceros += p.importe;
            }
            const list = Array.from(pMap.values()).map(item => {
                const total = item.preventivos + item.renta_terceros;
                return {
                    ...item,
                    total
                };
            });
            const grandTotal = list.reduce((sum, i) => sum + i.total, 0);
            return list.map(i => ({
                ...i,
                porcentaje: grandTotal > 0 ? Math.round((i.total / grandTotal) * 1000) / 10 : 0
            })).sort((a, b) => b.total - a.total);
        };

        const totalAplicables = cumplimiento_distribuidores.reduce((sum, d) => sum + d.aplica_smp, 0);
        const totalEjecutados = cumplimiento_distribuidores.reduce((sum, d) => sum + d.ejecutados, 0);
        const totalBrecha = Math.max(0, totalAplicables - totalEjecutados);
        const consolidado = totalAplicables > 0 ? Math.round((totalEjecutados / totalAplicables) * 1000) / 10 : 100;

        const lectura_ejecutiva = totalAplicables > 0
            ? `Cumplimiento de servicios SMP en equipos de la cartera: ${consolidado}%, con ${totalEjecutados} servicios ejecutados de ${totalAplicables} aplicables (brecha de ${totalBrecha}).`
            : `Sin registros de egresos/SMP asignados para la cartera del asesor en el periodo seleccionado.`;

        const egresos = {
            lectura_ejecutiva,
            indicadores_clave: {
                consolidado,
                equipo_ps: consolidado,
                equipo_cs: consolidado,
                ejecutados: totalEjecutados,
                aplicables: totalAplicables,
                brecha: totalBrecha
            },
            cumplimiento_distribuidores,
            pagos_usd: buildPagosSummary('USD'),
            pagos_mxn: buildPagosSummary('MXN'),
            pagos_renta_terceros,
            pagos_mantenimiento_preventivo
        };

        const finalResult = {
            tipo_cambio: exchangeRate,
            stats,
            tabla_maestra,
            cumplimiento_por_adc: adcs,
            pendiente_acumulado: pendingByClientAdc,
            total_por_cliente: totalPorCliente,
            pedidos_del_mes: pedidos_del_mes,
            recuperacion_meses_anteriores: recuperados,
            observaciones,
            egresos,
            // Send the raw facturacion_mensual records so the frontend knows what's stored
            facturado_registros: facturacionMensual,
        };
        dashboardCache.set(cacheKey, { timestamp: Date.now(), data: finalResult });
        return finalResult;
    }

    private initCurrencyStats() {
        return {
            presupuesto_mes: 0,
            acumulado: 0,
            total_a_facturar: 0,
            pedidos_enviados: 0,
            facturado: 0,
            faltante: 0,
            cumplimiento_general: 0,
            equipos_detenidos: 0,
        };
    }

    async updateFacturado(data: { periodo: string; moneda: string; monto: number; updated_by_id?: string; updated_by_name?: string }) {
        const db = this.getDb();
        const result = await db.facturacionMensual.upsert({
            where: { periodo_moneda: { periodo: data.periodo, moneda: data.moneda.toUpperCase() } },
            update: {
                monto: data.monto,
                updated_by_id: data.updated_by_id || null,
                updated_by_name: data.updated_by_name || null,
            },
            create: {
                periodo: data.periodo,
                moneda: data.moneda.toUpperCase(),
                monto: data.monto,
                updated_by_id: data.updated_by_id || null,
                updated_by_name: data.updated_by_name || null,
            },
        });
        return { success: true, data: result };
    }
    /**
     * Carga masiva del Pendiente Acumulado Inicial.
     * 
     * Recibe una lista de entradas {razon_social, moneda, importe} — los valores del Excel de julio
     * (o cualquier mes base) — y los guarda en importe_recuperado de las rentas correspondientes.
     *
     * Lógica de distribución:
     *   - Para cada cliente+moneda, busca TODAS las rentas VIGENTE/ACTIVA del cliente.
     *   - Pone importe_recuperado=0 en todas excepto la de mayor tarifa,
     *     donde coloca el importe completo.
     *   - Así la suma que aparece en el dashboard = el importe deseado.
     */
    async setPendienteInicial(entries: { razon_social: string; moneda: string; importe: number }[]) {
        const db = this.getDb();
        const results: { razon_social: string; moneda: string; importe: number; rentas_actualizadas: number }[] = [];

        for (const entry of entries) {
            const { razon_social, moneda, importe } = entry;
            if (!razon_social || !moneda || importe == null) continue;

            // Buscar el cliente por razon_social (case-insensitive)
            const cliente = await db.cliente.findFirst({
                where: {
                    razon_social: { contains: razon_social.trim(), mode: 'insensitive' }
                },
                select: { id: true, razon_social: true }
            });

            if (!cliente) {
                results.push({ razon_social, moneda, importe, rentas_actualizadas: 0 });
                continue;
            }

            // Obtener todas las rentas activas del cliente en la moneda indicada
            const rentas = await db.renta.findMany({
                where: {
                    cliente_id: cliente.id,
                    estado: { in: ['VIGENTE', 'IMPORTADA', 'ACTIVA', 'ACTIVO'] },
                    detalles: { moneda: { equals: moneda.toUpperCase(), mode: 'insensitive' } }
                },
                include: { detalles: true },
                orderBy: { detalles: { renta_real: 'desc' } }  // Mayor tarifa primero
            });

            if (rentas.length === 0) {
                results.push({ razon_social: cliente.razon_social, moneda, importe, rentas_actualizadas: 0 });
                continue;
            }

            // Poner 0 en todas, excepto la primera (mayor tarifa) que lleva el importe completo
            let updated = 0;
            for (let i = 0; i < rentas.length; i++) {
                const renta = rentas[i];
                const newImporte = i === 0 ? importe : 0;
                if (renta.detalles) {
                    await db.detallesRenta.update({
                        where: { id: renta.detalles.id },
                        data: { importe_recuperado: newImporte }
                    });
                    updated++;
                }
            }

            results.push({ razon_social: cliente.razon_social, moneda, importe, rentas_actualizadas: updated });
        }

        return { success: true, procesados: results.length, detalles: results };
    }
}
