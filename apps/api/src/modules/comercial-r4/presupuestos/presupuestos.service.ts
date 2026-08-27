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

    // Expand keywords with aliases and normalized forms
    const cleanKeywords = new Set<string>();
    for (const kw of keywords) {
        if (!kw) continue;
        const norm = stripAccents(kw.trim().toLowerCase());
        if (!norm) continue;
        cleanKeywords.add(norm);

        // Check single tokens
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
            if (norm === kw || norm.includes(kw) || kw.includes(norm)) {
                return true;
            }
        }
    }
    return false;
}

const dashboardCache = new Map<string, { timestamp: number, data: any }>();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

@Injectable()
export class PresupuestosService {
    private readonly logger = new Logger(PresupuestosService.name);

    constructor(private readonly prismaService: PrismaDynamicService) {}

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
        let ordersWhere: any = {};
        if (cliente_id) ordersWhere.cliente_id = cliente_id;
        
        const allOrders = await db.ordenMensual.findMany({
            where: ordersWhere,
            include: {
                cliente: true,
                renta: {
                    include: {
                        sitio: true,
                        activo: true,
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

        for (const r of allRentas) {
            // Apply ADC and Sitio filters manually
            if (adcKeywords.length > 0) {
                const adcCandidates = [r.adc, r.activo?.adc, r.sitio?.adc, (r.cliente as any)?.adc, (r.cliente as any)?.datos_comerciales?.adc];
                if (!matchAdcKeywords(adcCandidates, adcKeywords)) {
                    continue;
                }
            }
            
            const rMoneda = r.detalles?.moneda?.toUpperCase() || 'MXN';
            if (moneda && moneda !== rMoneda) continue;

            const currencyStat = stats[rMoneda as keyof typeof stats];
            if (!currencyStat) continue;

            // Monthly Budget Contribution: VIGENTE, IMPORTADA, ACTIVA, ACTIVO
            const estadoNorm = (r.estado || '').toUpperCase().trim();
            const isRentaActiva = estadoNorm === 'VIGENTE' || estadoNorm === 'IMPORTADA' || estadoNorm === 'ACTIVA' || estadoNorm === 'ACTIVO';

            if (isRentaActiva) {
                const budgetAmount = Number(r.detalles?.renta_real || r.detalles?.renta_base || r.tarifa || 0);

                // Equipos Detenidos: exclude ALL inactive variants (Inactivo, Inactivo con Cliente, Inactivo - Con Cliente)
                const estatusNorm = (r.activo?.estatus || '').trim().toUpperCase();
                const isInactive = estatusNorm.startsWith('INACTIVO');

                if (isInactive) {
                    currencyStat.equipos_detenidos += budgetAmount * months.length;
                } else {
                    currencyStat.presupuesto_mes += budgetAmount * months.length;

                    // ADC Compliance tracking
                    const adcName = r.adc || r.activo?.adc || r.sitio?.adc || (r.cliente as any)?.adc || (r.cliente as any)?.datos_comerciales?.adc || 'Sin ADC';
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
        }

        // Processing Orders
        for (const r of allRentas) {
            if (adcKeywords.length > 0) {
                const adcCandidates = [r.adc, r.activo?.adc, r.sitio?.adc, (r.cliente as any)?.adc, (r.cliente as any)?.datos_comerciales?.adc];
                if (!matchAdcKeywords(adcCandidates, adcKeywords)) {
                    continue;
                }
            }

            const rMoneda = r.detalles?.moneda?.toUpperCase() || 'MXN';
            if (moneda && moneda !== rMoneda) continue;
            const currencyStat = stats[rMoneda as keyof typeof stats];
            if (!currencyStat) continue;

            // Skip inactive equipment (all variants) from accumulated calculation
            const estatusNormAcc = (r.activo?.estatus || '').trim().toUpperCase();
            if (estatusNormAcc.startsWith('INACTIVO')) continue;

            const startM = dayjs(r.fecha_inicio).startOf('month');
            const endM = dayjs(`${earliestPeriodStr}-01`).startOf('month');
            let monthsActive = endM.diff(startM, 'month');
            if (monthsActive < 0) monthsActive = 0;
            
            const budgetAmount = Number(r.detalles?.renta_real || r.detalles?.renta_base || r.tarifa || 0);
            const expectedPast = budgetAmount * monthsActive;
            
            // Find past orders for this renta (before the earliest month in selection)
            const pastOrders = allOrders.filter(o => o.renta_id === r.id && o.periodo < earliestPeriodStr);
            const pastSent = pastOrders.reduce((sum, o) => sum + (o.tarifa || 0), 0);
            
            const pending = expectedPast - pastSent;
            if (pending > 0) {
                currencyStat.acumulado += pending;
                
                const clientName = r.cliente.razon_social;
                const adcName = r.adc || r.activo?.adc || r.sitio?.adc || (r.cliente as any)?.adc || (r.cliente as any)?.datos_comerciales?.adc || 'Sin ADC';
                
                pendingByClientAdc.push({
                    cliente: clientName,
                    adc: adcName,
                    moneda: rMoneda,
                    pendiente: pending
                });

                if (!clientTotals.has(clientName)) clientTotals.set(clientName, { presupuesto: 0, pendiente: 0 });
                clientTotals.get(clientName)!.pendiente += pending;
            }
        }

        // Sent POs in current month
        const currentMonthOrders = allOrders.filter(o => currentPeriodStrs.includes(o.periodo));
        const pedidos_del_mes: any[] = [];

        for (const o of currentMonthOrders) {
            // Check filters
            if (sitio_id && o.renta?.sitio_id !== sitio_id) continue;

            const adcName = o.renta?.adc || o.renta?.sitio?.adc || (o.cliente as any)?.datos_comerciales?.adc || 'Sin ADC';
            if (adcKeywords.length > 0) {
                if (!matchAdcKeywords([adcName, o.renta?.adc, o.renta?.sitio?.adc, (o.cliente as any)?.datos_comerciales?.adc], adcKeywords)) {
                    continue;
                }
            }

            const oMoneda = o.moneda?.toUpperCase() || o.renta?.detalles?.moneda?.toUpperCase() || 'MXN';
            if (moneda && moneda !== oMoneda) continue;

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
                pedidos_del_mes.push({
                    cliente: o.cliente.razon_social,
                    moneda: oMoneda,
                    importe: amount,
                    po: o.po,
                    pedido_totvs: condicionesObj.pedido_totvs || condicionesObj.pedido_tovts || o.renta?.no_registro_totvs || '-'
                });
            }
        }

        // Calculate totals according to business rule: (Presupuesto + Pendiente acumulado) - Equipos Detenidos = Total a facturar
        const isAdcFiltered = adcKeywords.length > 0;
        for (const key of ['MXN', 'USD'] as const) {
            const s = stats[key];
            s.total_a_facturar = (s.presupuesto_mes + s.acumulado) - s.equipos_detenidos;
            // Use manually entered facturado value from Gerente when not filtered by ADC; fallback to pedidos_enviados
            s.facturado = (!isAdcFiltered && facturadoByMoneda[key] > 0) ? facturadoByMoneda[key] : s.pedidos_enviados;
            s.faltante = s.total_a_facturar - s.pedidos_enviados;
            s.cumplimiento_general = s.total_a_facturar > 0 ? (s.pedidos_enviados / s.total_a_facturar) * 100 : (s.presupuesto_mes > 0 ? (s.pedidos_enviados / s.presupuesto_mes) * 100 : 0);
        }

        const adcs = Array.from(adcsMap.values()).map((data) => {
            const totalFacturar = data.budget; // Base budget for this ADC
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
        }).map(o => ({
            adc: o.renta?.adc || o.renta?.activo?.adc || o.renta?.sitio?.adc || (o.cliente as any)?.adc || (o.cliente as any)?.datos_comerciales?.adc || 'Sin ADC',
            cliente: o.cliente.razon_social,
            periodo_original: o.periodo,
            po: o.po,
            importe: o.tarifa || 0,
            moneda: o.moneda || 'MXN'
        }));

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

        // Master Consolidated Table
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
            if (adcKeywords.length > 0) {
                const adcCandidates = [r.adc, r.activo?.adc, r.sitio?.adc, (r.cliente as any)?.adc, (r.cliente as any)?.datos_comerciales?.adc];
                if (!matchAdcKeywords(adcCandidates, adcKeywords)) {
                    continue;
                }
            }
            const rMoneda = r.detalles?.moneda?.toUpperCase() || 'MXN';
            if (moneda && moneda !== rMoneda) continue;

            const adcName = r.adc || r.activo?.adc || r.sitio?.adc || (r.cliente as any)?.adc || (r.cliente as any)?.datos_comerciales?.adc || 'Sin ADC';
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
            const budgetAmount = Number(r.detalles?.renta_real || r.detalles?.renta_base || r.tarifa || 0);

            const estadoNorm = (r.estado || '').toUpperCase().trim();
            const isRentaActiva = estadoNorm === 'VIGENTE' || estadoNorm === 'IMPORTADA' || estadoNorm === 'ACTIVA' || estadoNorm === 'ACTIVO';
            const estatusNorm = (r.activo?.estatus || '').trim().toUpperCase();
            const isInactive = estatusNorm.startsWith('INACTIVO');

            if (isRentaActiva) {
                if (isInactive) {
                    item.equipos_detenidos += budgetAmount;
                } else {
                    item.presupuesto += budgetAmount;
                }
            }

            // Pending accumulation for past months
            if (!isInactive) {
                const startM = dayjs(r.fecha_inicio).startOf('month');
                const endM = dayjs(`${earliestPeriodStr}-01`).startOf('month');
                let monthsActive = endM.diff(startM, 'month');
                if (monthsActive < 0) monthsActive = 0;

                const expectedPast = budgetAmount * monthsActive;
                const pastOrders = allOrders.filter(o => o.renta_id === r.id && o.periodo < earliestPeriodStr);
                const pastSent = pastOrders.reduce((sum, o) => sum + (o.tarifa || 0), 0);
                const pending = expectedPast - pastSent;
                if (pending > 0) {
                    item.pendiente_acumulado += pending;
                }
            }
        }

        for (const o of currentMonthOrders) {
            if (sitio_id && o.renta?.sitio_id !== sitio_id) continue;
            const oMoneda = o.moneda?.toUpperCase() || o.renta?.detalles?.moneda?.toUpperCase() || 'MXN';
            if (moneda && moneda !== oMoneda) continue;

            const adcName = o.renta?.adc || o.renta?.activo?.adc || o.renta?.sitio?.adc || (o.cliente as any)?.adc || (o.cliente as any)?.datos_comerciales?.adc || 'Sin ADC';
            if (adcKeywords.length > 0) {
                const adcCandidates = [adcName, o.renta?.adc, o.renta?.activo?.adc, o.renta?.sitio?.adc, (o.cliente as any)?.adc, (o.cliente as any)?.datos_comerciales?.adc];
                if (!matchAdcKeywords(adcCandidates, adcKeywords)) {
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
                    if (item.moneda === oMoneda && item.cliente.trim().toUpperCase() === clientName.trim().toUpperCase()) {
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
            const total_facturar = (item.presupuesto + item.pendiente_acumulado) - item.equipos_detenidos;
            const cumplimiento = total_facturar > 0 ? (item.enviado / total_facturar) * 100 : (item.presupuesto > 0 ? (item.enviado / item.presupuesto) * 100 : 0);
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
            if (adcKeywords.length > 0) {
                return matchAdcKeywords([r.adc, r.sitio?.adc, (r.cliente as any)?.datos_comerciales?.adc], adcKeywords);
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
}
