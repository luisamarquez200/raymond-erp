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

const dashboardCache = new Map<string, { timestamp: number, data: any }>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

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
        const cacheKey = JSON.stringify(filters);
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
        if (adcKeywords.length > 0) {
            rentasWhere.OR = [
                { adc: { in: adcKeywords.map(k => k) } }, // Fallback to memory filter if exact doesn't match perfectly
            ];
            // We'll rely primarily on the robust manual memory filter since the schema data could be nested
        }

        const allRentas = await db.renta.findMany({
            where: rentasWhere,
            include: {
                detalles: true,
                activo: true,
                cliente: true,
            }
        });

        // 2. Fetch all orders (OrdenMensual)
        let ordersWhere: any = {};
        if (cliente_id) ordersWhere.cliente_id = cliente_id;
        // OrdenMensual does not have sitio_id, adc directly, we might need to filter them in memory based on the renta.
        
        const allOrders = await db.ordenMensual.findMany({
            where: ordersWhere,
            include: {
                cliente: true,
                renta: {
                    include: {
                        sitio: true
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
            // Apply ADC and Sitio filters manually if they were not fully applied
            if (adcKeywords.length > 0) {
                const rAdc = (r.adc || '').toLowerCase();
                const sAdc = (r.sitio?.adc || '').toLowerCase();
                const matches = adcKeywords.some(kw => rAdc.includes(kw) || sAdc.includes(kw));
                if (!matches) continue;
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
                    const adcName = r.adc || r.sitio?.adc || 'Sin ADC';
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
                const adcName = r.adc || r.sitio?.adc || 'Sin ADC';
                
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

            const oMoneda = o.moneda?.toUpperCase() || o.renta?.detalles?.moneda?.toUpperCase() || 'MXN';
            if (moneda && moneda !== oMoneda) continue;

            const currencyStat = stats[oMoneda as keyof typeof stats];
            if (currencyStat) {
                const amount = o.tarifa || 0;
                currencyStat.pedidos_enviados += amount;
                
                // Add to ADC compliance
                const adcName = o.renta?.adc || o.renta?.sitio?.adc || (o.cliente as any)?.datos_comerciales?.adc || 'Sin ADC';
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
                    pedido_tovts: condicionesObj.pedido_tovts || o.po || '-'
                });
            }
        }

        // Calculate totals
        for (const key of ['MXN', 'USD'] as const) {
            const s = stats[key];
            s.total_a_facturar = s.presupuesto_mes + s.acumulado;
            // Use manually entered facturado value from Gerente; fallback to pedidos_enviados if not set
            s.facturado = facturadoByMoneda[key] > 0 ? facturadoByMoneda[key] : s.pedidos_enviados;
            s.faltante = s.total_a_facturar - s.pedidos_enviados;
            s.cumplimiento_general = s.presupuesto_mes > 0 ? (s.pedidos_enviados / s.presupuesto_mes) * 100 : 0;
        }

        const adcs = Array.from(adcsMap.values()).map((data) => ({
            adc: data.adc,
            cliente: data.cliente,
            moneda: data.moneda,
            presupuesto: data.budget,
            enviado: data.sentPOs,
            cumplimiento: data.budget > 0 ? (data.sentPOs / data.budget) * 100 : 0
        }));

        const totalPorCliente = Array.from(clientTotals.entries()).map(([cliente, data]) => ({
            cliente,
            presupuesto_mes: data.presupuesto,
            pendiente_acumulado: data.pendiente,
            total_facturar: data.presupuesto + data.pendiente
        }));

        // Recuperacion de meses anteriores (orders in current month but belong to previous periods?)
        // The user says "Órdenes de compra recuperadas de meses anteriores".
        // In our model `OrdenMensual` has `periodo` (the period it belongs to) and `created_at` (when it was added).
        // If `created_at` is in any of the selected months, but `periodo < earliestPeriodStr`, it's a recovery!
        const recuperados = allOrders.filter(o => {
            if (o.periodo >= earliestPeriodStr) return false;
            const createdM = dayjs(o.created_at).format('YYYY-MM');
            return currentPeriodStrs.includes(createdM);
        }).map(o => ({
            adc: o.renta?.adc || o.renta?.sitio?.adc || (o.cliente as any)?.datos_comerciales?.adc || 'Sin ADC',
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

        // Master Consolidated Table (Matching Excel columns: % CUMPLIMIENTO | ADC | CLIENTE | PRESUPUESTO | EQUIPOS DETENIDOS | PENDIENTE ACUMULADO | TOTAL A FACTURAR)
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
                const rAdc = (r.adc || '').toLowerCase();
                const sAdc = (r.sitio?.adc || '').toLowerCase();
                const matches = adcKeywords.some(kw => rAdc.includes(kw) || sAdc.includes(kw));
                if (!matches) continue;
            }
            const rMoneda = r.detalles?.moneda?.toUpperCase() || 'MXN';
            if (moneda && moneda !== rMoneda) continue;

            const adcName = r.adc || r.sitio?.adc || (r.cliente as any)?.datos_comerciales?.adc || 'Sin ADC';
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

            const adcName = o.renta?.adc || o.renta?.sitio?.adc || (o.cliente as any)?.datos_comerciales?.adc || 'Sin ADC';
            const clientName = o.cliente?.razon_social || '';
            const key = `${adcName}___${clientName}___${oMoneda}`;

            if (masterMap.has(key)) {
                masterMap.get(key)!.enviado += (o.tarifa || 0);
            } else {
                let found = false;
                for (const item of masterMap.values()) {
                    if (item.moneda === oMoneda && item.cliente.trim().toUpperCase() === clientName.trim().toUpperCase()) {
                        item.enviado += (o.tarifa || 0);
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
                        enviado: o.tarifa || 0,
                        equipos_detenidos: 0,
                        pendiente_acumulado: 0
                    });
                }
            }
        }

        const tabla_maestra = Array.from(masterMap.values()).map(item => {
            const cumplimiento = item.presupuesto > 0 ? (item.enviado / item.presupuesto) * 100 : 0;
            const total_facturar = item.presupuesto + item.pendiente_acumulado;
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

        const egresos = {
            lectura_ejecutiva: "El cumplimiento consolidado de SMP es 91.7%, con 2,904 servicios ejecutados de 3,168 aplicables y una brecha de 264. El equipo PS alcanza 94.1% y CS 89.4%. La prioridad es recuperar cumplimiento en los distribuidores por debajo de 90%, especialmente MOTSA, JV, MOBINSA y SIMAC.",
            indicadores_clave: {
                consolidado: 91.7,
                equipo_ps: 94.1,
                equipo_cs: 89.4,
                ejecutados: 2904,
                aplicables: 3168,
                brecha: 264
            },
            cumplimiento_distribuidores: [
                { distribuidor: 'MOBINSA', aplica_smp: 8, ejecutados: 6, brecha: 2, cumplimiento: 75.0, estatus: 'CRÍTICO' },
                { distribuidor: 'SIMAC', aplica_smp: 8, ejecutados: 6, brecha: 2, cumplimiento: 75.0, estatus: 'CRÍTICO' },
                { distribuidor: 'JV', aplica_smp: 20, ejecutados: 16, brecha: 4, cumplimiento: 80.0, estatus: 'CRÍTICO' },
                { distribuidor: 'MOTSA', aplica_smp: 412, ejecutados: 342, brecha: 70, cumplimiento: 83.0, estatus: 'CRÍTICO' },
                { distribuidor: 'MMH', aplica_smp: 72, ejecutados: 62, brecha: 10, cumplimiento: 86.1, estatus: 'CRÍTICO' },
                { distribuidor: 'DIMCSA', aplica_smp: 1068, ejecutados: 962, brecha: 106, cumplimiento: 90.1, estatus: 'ATENCIÓN' },
                { distribuidor: 'DIMOSA', aplica_smp: 624, ejecutados: 590, brecha: 34, cumplimiento: 94.6, estatus: 'ATENCIÓN' },
                { distribuidor: 'M.COM', aplica_smp: 298, ejecutados: 284, brecha: 14, cumplimiento: 95.3, estatus: 'EN META' },
                { distribuidor: 'MAC', aplica_smp: 646, ejecutados: 624, brecha: 22, cumplimiento: 96.6, estatus: 'EN META' },
                { distribuidor: 'RAYMOND WEST', aplica_smp: 12, ejecutados: 12, brecha: 0, cumplimiento: 100.0, estatus: 'EN META' },
            ],
            pagos_usd: [
                { distribuidor: 'MOTSA INDUSTRIAL', preventivos: 8822.00, renta_terceros: 163600.00, total: 172422.00, porcentaje: 45.2 },
                { distribuidor: 'MONTACARGAS AC', preventivos: 49865.36, renta_terceros: 3010.00, total: 52875.36, porcentaje: 13.9 },
                { distribuidor: 'J.V. ABASTECEDORA DE MONTACARGAS', preventivos: 705.28, renta_terceros: 61242.00, total: 61947.28, porcentaje: 16.3 },
                { distribuidor: 'MONTACARGAS.COM', preventivos: 5640.00, renta_terceros: 7518.00, total: 13158.00, porcentaje: 3.5 },
                { distribuidor: 'DISTRIBUIDORA DE MONTACARGAS DEL CENTRO', preventivos: 15546.03, renta_terceros: 2734.30, total: 18280.33, porcentaje: 4.8 },
                { distribuidor: 'MEX MATERIAL HANDLING', preventivos: 11314.80, renta_terceros: 6200.00, total: 17514.80, porcentaje: 4.6 },
                { distribuidor: 'ENERSYS DE MEXICO II S DE RL DE CV', preventivos: 0.00, renta_terceros: 37866.00, total: 37866.00, porcentaje: 9.9 },
                { distribuidor: 'DISTRIBUCIONES MOLINA', preventivos: 3370.00, renta_terceros: 1586.50, total: 4956.50, porcentaje: 1.3 },
                { distribuidor: 'RW BAJA', preventivos: 2100.00, renta_terceros: 0.00, total: 2100.00, porcentaje: 0.6 }
            ],
            pagos_mxn: [
                { distribuidor: 'MOTSA INDUSTRIAL', preventivos: 266760.00, renta_terceros: 0.00, total: 266760.00, porcentaje: 3.9 },
                { distribuidor: 'DISTRIBUIDORA DE MONTACARGAS DEL CENTRO', preventivos: 1723714.88, renta_terceros: 168379.87, total: 1892094.75, porcentaje: 27.8 },
                { distribuidor: 'DISTRIBUCIONES MOLINA', preventivos: 2499291.00, renta_terceros: 0.00, total: 2499291.00, porcentaje: 36.7 },
                { distribuidor: 'MONTACARGAS AC', preventivos: 1203495.86, renta_terceros: 0.00, total: 1203495.86, porcentaje: 17.7 },
                { distribuidor: 'MONTACARGAS.COM', preventivos: 581457.70, renta_terceros: 0.00, total: 581457.70, porcentaje: 8.5 },
                { distribuidor: 'ENCINAS LIFT', preventivos: 0.00, renta_terceros: 228500.00, total: 228500.00, porcentaje: 3.4 },
                { distribuidor: 'SISTEMAS INTEGRALES PARA EL MANEJO DE CARGA', preventivos: 14380.00, renta_terceros: 22360.00, total: 36740.00, porcentaje: 0.5 },
                { distribuidor: 'MEX MATERIAL HANDLING', preventivos: 2400.00, renta_terceros: 81000.00, total: 83400.00, porcentaje: 1.2 }
            ]
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

        const cacheKey = JSON.stringify(filters);
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
