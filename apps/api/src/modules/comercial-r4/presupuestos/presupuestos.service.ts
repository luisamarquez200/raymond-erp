import { Injectable, Logger } from '@nestjs/common';
import { PrismaDynamicService } from '../../../database/prisma-dynamic.service';
import dayjs from 'dayjs';

interface DashboardFilters {
    year: number;
    month: number;
    cliente_id?: string;
    sitio_id?: string;
    moneda?: string;
    adc?: string;
}

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
        const db = this.getDb();
        const { year, month, cliente_id, sitio_id, moneda, adc } = filters;

        const currentPeriodStr = `${year}-${String(month).padStart(2, '0')}`;
        
        // Date boundaries for the month
        const startOfMonth = dayjs(`${currentPeriodStr}-01`).startOf('month').toDate();
        const endOfMonth = dayjs(`${currentPeriodStr}-01`).endOf('month').toDate();

        // 1. Fetch all rentas (filtering by dimensions if provided)
        let rentasWhere: any = {};
        if (cliente_id) rentasWhere.cliente_id = cliente_id;
        if (sitio_id) rentasWhere.sitio_id = sitio_id;
        if (adc) rentasWhere.adc = { contains: adc }; // or exact match? let's do exact if it's from a dropdown, but contains is safer for text fields. Let's just use exact match for now if we can, or contains. We'll use contains for flexibility.

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

        // We will process the data in memory to group by Currency (MXN / USD) and calculate the metrics.
        const stats = {
            MXN: this.initCurrencyStats(),
            USD: this.initCurrencyStats()
        };

        const adcsMap = new Map<string, { cliente: string, budget: number, sentPOs: number }>();
        const pendingByClientAdc: any[] = [];
        const clientTotals = new Map<string, { presupuesto: number, pendiente: number }>();

        // We will consider a Renta "active" for the current month if it started before/during the month and is either VIGENTE or ended after the start of the month.
        // But the schema just says `estado: VIGENTE`. Let's use `estado === 'VIGENTE'` for simplicity as standard active rent.

        for (const r of allRentas) {
            // Apply ADC and Sitio filters manually if they were not fully applied
            if (adc && r.adc !== adc && r.sitio?.adc !== adc) continue;
            
            const rMoneda = r.detalles?.moneda?.toUpperCase() || 'MXN';
            if (moneda && moneda !== rMoneda) continue;

            const currencyStat = stats[rMoneda as keyof typeof stats];
            if (!currencyStat) continue;

            // Monthly Budget Contribution
            // We assume if it's VIGENTE or IMPORTADA, it contributes to the monthly budget.
            if (r.estado === 'VIGENTE' || r.estado === 'IMPORTADA') {
                const budgetAmount = r.detalles?.renta_real || r.tarifa || 0;

                // Equipos Detenidos
                if (r.activo.estatus === 'Inactivo' || r.activo.estatus === 'Inactivo con Cliente') {
                    currencyStat.equipos_detenidos += budgetAmount;
                } else {
                    currencyStat.presupuesto_mes += budgetAmount;

                    // ADC Compliance tracking
                    const adcName = r.adc || r.sitio?.adc || 'Sin ADC';
                    const clientName = r.cliente.razon_social;
                    const adcKey = `${adcName}_${clientName}_${rMoneda}`;
                    if (!adcsMap.has(adcKey)) adcsMap.set(adcKey, { cliente: clientName, budget: 0, sentPOs: 0 });
                    adcsMap.get(adcKey)!.budget += budgetAmount;

                    // Client Total Tracking
                    if (!clientTotals.has(clientName)) clientTotals.set(clientName, { presupuesto: 0, pendiente: 0 });
                    clientTotals.get(clientName)!.presupuesto += budgetAmount;
                }
            }
        }

        // Processing Orders
        // orders are grouped by periodo. 
        // past orders vs past budget? The user said: "iterate past rents - past orders" for accumulated.
        // Actually, to get past budget, we should look at active rentas in those past months.
        // Since we don't have historical snapshots of `estado`, we might just sum all orders < currentPeriod and compare to... wait.
        // A simple way to do "Acumulado" is just to look at all past Orders that have an amount, and subtract from what *should* have been billed. 
        // This can be complex. Let's simplify: 
        // We calculate "Expected Historical Budget" = Sum of (Renta Real * Months Active before current month).
        // Months Active = from `fecha_inicio` to `current period` (capped).
        
        for (const r of allRentas) {
            const rMoneda = r.detalles?.moneda?.toUpperCase() || 'MXN';
            if (moneda && moneda !== rMoneda) continue;
            const currencyStat = stats[rMoneda as keyof typeof stats];
            if (!currencyStat) continue;

            const startM = dayjs(r.fecha_inicio).startOf('month');
            const endM = dayjs(`${currentPeriodStr}-01`).startOf('month');
            let monthsActive = endM.diff(startM, 'month');
            if (monthsActive < 0) monthsActive = 0;
            
            const budgetAmount = r.detalles?.renta_real || r.tarifa || 0;
            const expectedPast = budgetAmount * monthsActive;
            
            // Find past orders for this renta
            const pastOrders = allOrders.filter(o => o.renta_id === r.id && o.periodo < currentPeriodStr);
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
        const currentMonthOrders = allOrders.filter(o => o.periodo === currentPeriodStr);
        const pedidos_del_mes: any[] = [];

        for (const o of currentMonthOrders) {
            // Check filters
            if (sitio_id && o.renta?.sitio_id !== sitio_id) continue;
            // if (adc && o.renta?.adc !== adc) continue; // simplistic

            const oMoneda = o.moneda?.toUpperCase() || o.renta?.detalles?.moneda?.toUpperCase() || 'MXN';
            if (moneda && moneda !== oMoneda) continue;

            const currencyStat = stats[oMoneda as keyof typeof stats];
            if (currencyStat) {
                const amount = o.tarifa || 0;
                currencyStat.pedidos_enviados += amount;
                
                // Add to ADC compliance
                if (o.renta) {
                    const adcName = o.renta.adc || o.renta.sitio?.adc || 'Sin ADC';
                    const clientName = o.cliente.razon_social;
                    const adcKey = `${adcName}_${clientName}_${oMoneda}`;
                    if (adcsMap.has(adcKey)) {
                        adcsMap.get(adcKey)!.sentPOs += amount;
                    }
                }

                pedidos_del_mes.push({
                    cliente: o.cliente.razon_social,
                    moneda: oMoneda,
                    importe: amount,
                    po: o.po
                });
            }
        }

        // Calculate totals
        for (const key of ['MXN', 'USD'] as const) {
            const s = stats[key];
            s.total_a_facturar = s.presupuesto_mes + s.acumulado;
            s.facturado = s.pedidos_enviados; // As assumed
            s.faltante = s.total_a_facturar - s.pedidos_enviados;
            s.cumplimiento_general = s.presupuesto_mes > 0 ? (s.pedidos_enviados / s.presupuesto_mes) * 100 : 0;
        }

        const adcs = Array.from(adcsMap.entries()).map(([key, data]) => {
            const [adc, cliente, mnd] = key.split('_');
            return {
                adc,
                cliente,
                moneda: mnd,
                cumplimiento: data.budget > 0 ? (data.sentPOs / data.budget) * 100 : 0
            };
        });

        const totalPorCliente = Array.from(clientTotals.entries()).map(([cliente, data]) => ({
            cliente,
            presupuesto_mes: data.presupuesto,
            pendiente_acumulado: data.pendiente,
            total_facturar: data.presupuesto + data.pendiente
        }));

        // Recuperacion de meses anteriores (orders in current month but belong to previous periods?)
        // The user says "Órdenes de compra recuperadas de meses anteriores".
        // In our model `OrdenMensual` has `periodo` (the period it belongs to) and `created_at` (when it was added).
        // If `created_at` is in current month, but `periodo < currentPeriodStr`, it's a recovery!
        const recuperados = allOrders.filter(o => {
            if (o.periodo >= currentPeriodStr) return false;
            const createdM = dayjs(o.created_at).format('YYYY-MM');
            return createdM === currentPeriodStr;
        }).map(o => ({
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

        return {
            stats,
            cumplimiento_por_adc: adcs,
            pendiente_acumulado: pendingByClientAdc,
            total_por_cliente: totalPorCliente,
            pedidos_del_mes: pedidos_del_mes,
            recuperacion_meses_anteriores: recuperados,
            observaciones
        };
    }

    private initCurrencyStats() {
        return {
            presupuesto_mes: 0,
            acumulado: 0,
            total_a_facturar: 0,
            pedidos_enviados: 0,
            facturado: 0, // Equal to pedidos_enviados
            faltante: 0,
            cumplimiento_general: 0,
            equipos_detenidos: 0,
        };
    }
}
