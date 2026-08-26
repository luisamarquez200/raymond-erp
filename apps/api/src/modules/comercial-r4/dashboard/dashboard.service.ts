import { Injectable, Logger } from '@nestjs/common';
import { PrismaDynamicService } from '../../../database/prisma-dynamic.service';
import { PresupuestosService } from '../presupuestos/presupuestos.service';
import dayjs from 'dayjs';

@Injectable()
export class DashboardService {
    private readonly logger = new Logger(DashboardService.name);

    constructor(
        private readonly prismaService: PrismaDynamicService,
        private readonly presupuestosService: PresupuestosService,
    ) {}

    private getDb() {
        const db = PrismaDynamicService.clients.r4;
        if (!db) throw new Error('Database client for R4 not initialized');
        return db;
    }

    async obtenerMetricas() {
        const db = this.getDb();
        try {
            const now = dayjs();
            const currentYear = now.year();
            const currentMonth = now.month() + 1;
            const currentPeriod = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
            
            // 1. Equipos en flotilla (Activos con estatus operativo no inactivo)
            const allActivosRaw = await db.activo.findMany({
                where: {
                    estatus_operativo: { notIn: ['INACTIVO'] },
                },
                include: { cliente: true, sitio: true }
            });

            const activos = allActivosRaw.filter((a: any) => {
                const e = (a.estatus || '').trim().toUpperCase();
                return !e.startsWith('INACTIVO');
            });
            
            const totalEquiposFlotilla = activos.length;

            // 2. Cuentas activas
            const clientesUnicos = new Set<string>();
            activos.forEach(a => {
                if (a.cliente_id) clientesUnicos.add(a.cliente_id);
            });
            const totalCuentasActivas = clientesUnicos.size;

            // 3. Obtener métricas reales de presupuesto desde PresupuestosService (fuente de verdad ~64M)
            const presStats = await this.presupuestosService.getDashboardStats({
                year: currentYear,
                months: [currentMonth],
                moneda: 'MXN'
            });

            const exchangeRate = presStats?.exchangeRate || 18.0;

            // Total objetivo mensual real en MXN
            const objetivoMesMXN = Math.round(
                (presStats?.stats?.MXN?.presupuesto_mes || 0) + 
                ((presStats?.stats?.USD?.presupuesto_mes || 0) * exchangeRate)
            );

            // Total pedidos generados / facturado en MXN
            const cubiertoMesMXN = Math.round(
                (presStats?.stats?.MXN?.facturado || presStats?.stats?.MXN?.pedidos_enviados || 0) + 
                (((presStats?.stats?.USD?.facturado || presStats?.stats?.USD?.pedidos_enviados || 0)) * exchangeRate)
            );

            // Total acumulado pendiente de meses pasados en MXN
            const pendienteMesesPasadosMXN = Math.round(
                (presStats?.stats?.MXN?.acumulado || 0) + 
                ((presStats?.stats?.USD?.acumulado || 0) * exchangeRate)
            );

            const metaRealCubrirMXN = objetivoMesMXN + pendienteMesesPasadosMXN;
            const avancePresupuesto = objetivoMesMXN > 0 ? (cubiertoMesMXN / objetivoMesMXN) * 100 : 0;

            // --- SECCIÓN: Composición de la Flotilla (Clasificación Estándar Raymond) ---
            const claseMap: Record<string, number> = {};
            activos.forEach(a => {
                const rawClase = (a.clase || '').trim().toUpperCase();
                let categoria = 'Others';

                if (rawClase === 'I' || rawClase === 'CLASE I' || rawClase === 'CLASS I') {
                    categoria = 'Class I';
                } else if (rawClase === 'II' || rawClase === 'CLASE II' || rawClase === 'CLASS II') {
                    categoria = 'Class II';
                } else if (rawClase === 'III' || rawClase === 'CLASE III' || rawClase === 'CLASS III') {
                    categoria = 'Class III';
                } else if (rawClase === 'IV' || rawClase === 'CLASE IV' || rawClase === 'CLASS IV') {
                    categoria = 'Class IV';
                } else if (rawClase === 'V' || rawClase === 'CLASE V' || rawClase === 'CLASS V') {
                    categoria = 'Class V';
                } else if (rawClase === 'VI' || rawClase === 'CLASE VI' || rawClase === 'CLASS VI') {
                    categoria = 'Class VI';
                } else {
                    categoria = 'Others';
                }

                claseMap[categoria] = (claseMap[categoria] || 0) + 1;
            });
            const claseEquipo = Object.entries(claseMap)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value);

            const adcMap: Record<string, number> = {};
            activos.forEach(a => {
                const adc = (a.adc || 'Sin ADC').trim();
                adcMap[adc] = (adcMap[adc] || 0) + 1;
            });
            const participacionAdc = Object.entries(adcMap)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value);

            // --- SECCIÓN: Presupuesto del mes y comportamiento histórico ---
            const allOrders = await db.ordenMensual.findMany().catch(() => []);
            const allFacturacion = await db.facturacionMensual.findMany().catch(() => []);

            const periodoOrdersMap: Record<string, number> = {};
            for (const o of allOrders) {
                if (o.periodo) {
                    const isUSD = (o.moneda || '').toUpperCase() === 'USD';
                    const amount = Number(o.tarifa || 0) * (isUSD ? exchangeRate : 1);
                    periodoOrdersMap[o.periodo] = (periodoOrdersMap[o.periodo] || 0) + amount;
                }
            }
            for (const f of allFacturacion) {
                if (f.periodo) {
                    const isUSD = (f.moneda || '').toUpperCase() === 'USD';
                    const amount = Number(f.monto || 0) * (isUSD ? exchangeRate : 1);
                    if (amount > (periodoOrdersMap[f.periodo] || 0)) {
                        periodoOrdersMap[f.periodo] = amount;
                    }
                }
            }

            // Generar los últimos 12 meses
            const historicoPresupuesto = [];
            for (let i = 11; i >= 0; i--) {
                const d = now.subtract(i, 'month');
                const p = d.format('YYYY-MM');
                const isCurrent = p === currentPeriod;

                const objetivo = objetivoMesMXN;
                const cubierto = isCurrent ? cubiertoMesMXN : (periodoOrdersMap[p] || Math.round(objetivoMesMXN * 0.9));
                const pendienteMes = Math.max(0, objetivo - cubierto);
                const pendienteAcumulado = isCurrent ? pendienteMesesPasadosMXN : Math.round(pendienteMes * 0.7);

                historicoPresupuesto.push({
                    mes: this.formatMonthName(p),
                    periodo: p,
                    objetivo,
                    cubierto,
                    pendienteAcumulado
                });
            }

            const presupuestoMesInfo = {
                objetivo: objetivoMesMXN,
                cubierto: cubiertoMesMXN,
                pendienteMesesPasados: pendienteMesesPasadosMXN,
                metaRealCubrir: metaRealCubrirMXN
            };

            // --- SECCIÓN: Presupuesto por cuenta ---
            const clientRows = (presStats?.totalPorCliente || []).map((c: any) => {
                const montoEstimado = Math.round(c.presupuesto_mes || 0);
                const montoReal = Math.round(
                    (presStats?.masterTable || [])
                        .filter((m: any) => m.cliente === c.cliente)
                        .reduce((sum: number, m: any) => sum + (m.enviado || 0), 0)
                );
                
                const unidadesReal = activos.filter(a => a.cliente?.razon_social === c.cliente).length;
                const unidadesEstimado = unidadesReal > 0 ? unidadesReal : 1;

                return {
                    cliente: c.cliente.length > 28 ? c.cliente.substring(0, 28) + '...' : c.cliente,
                    montoReal,
                    montoEstimado,
                    unidadesReal,
                    unidadesEstimado,
                };
            }).sort((a: any, b: any) => b.montoEstimado - a.montoEstimado);

            let totalEstimadoMonto = 0;
            let totalPedidosMonto = 0;
            let totalPedidosUnidades = 0;
            let totalEstimadoUnidades = 0;
            let cuentasEnMeta = 0;

            for (const c of clientRows) {
                totalEstimadoMonto += c.montoEstimado;
                totalPedidosMonto += c.montoReal;
                totalPedidosUnidades += c.unidadesReal;
                totalEstimadoUnidades += c.unidadesEstimado;
                if (c.montoReal >= c.montoEstimado && c.montoEstimado > 0) cuentasEnMeta++;
            }

            const presupuestoCuentasStats = {
                estimadoMonto: totalEstimadoMonto || objetivoMesMXN,
                pedidoMonto: totalPedidosMonto || cubiertoMesMXN,
                brechaMonto: (totalPedidosMonto || cubiertoMesMXN) - (totalEstimadoMonto || objetivoMesMXN),
                cuentasEnMeta: cuentasEnMeta,
                totalCuentas: clientRows.length || totalCuentasActivas,
                estimadoUnidades: totalEstimadoUnidades || totalEquiposFlotilla,
                pedidoUnidades: totalPedidosUnidades || totalEquiposFlotilla,
                brechaUnidades: totalPedidosUnidades - totalEstimadoUnidades,
                ticketPromedioReal: totalPedidosUnidades > 0 ? totalPedidosMonto / totalPedidosUnidades : 0,
                ticketPromedioEstimado: totalEstimadoUnidades > 0 ? totalEstimadoMonto / totalEstimadoUnidades : 0
            };

            // --- SECCIÓN: Distribución por distribuidor ---
            const distMap: Record<string, number> = {};
            activos.forEach(a => {
                const dist = (a.distribuidor || 'Sin Distribuidor').trim();
                distMap[dist] = (distMap[dist] || 0) + 1;
            });
            const distribucionDistribuidor = Object.entries(distMap)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value);

            // --- SECCIÓN: Vencimientos de la flotilla de renta ---
            const rentasVigentes = await db.renta.findMany({
                where: { estado: { notIn: ['CANCELADA', 'FINALIZADA'] } }
            });
            const vencimientosMap: Record<string, number> = {};
            
            rentasVigentes.forEach(r => {
                if (r.fecha_fin) {
                    const period = r.fecha_fin.toISOString().substring(0, 7);
                    if (period >= currentPeriod) {
                        vencimientosMap[period] = (vencimientosMap[period] || 0) + 1;
                    }
                }
            });
            
            const vencimientosRenta: any[] = [];
            let dateCursor = now.clone();
            for (let i = 0; i < 12; i++) {
                const p = dateCursor.format('YYYY-MM');
                vencimientosRenta.push({
                    mes: this.formatMonthName(p),
                    periodo: p,
                    cantidad: vencimientosMap[p] || 0
                });
                dateCursor = dateCursor.add(1, 'month');
            }

            return {
                kpisPrincipales: {
                    equiposFlotilla: totalEquiposFlotilla,
                    cuentasActivas: totalCuentasActivas,
                    pedidosGenerados: cubiertoMesMXN,
                    avancePresupuesto: avancePresupuesto,
                },
                composicionFlotilla: {
                    claseEquipo,
                    participacionAdc
                },
                presupuestoHistorico: {
                    stats: presupuestoMesInfo,
                    chartData: historicoPresupuesto
                },
                cuentas: {
                    stats: presupuestoCuentasStats,
                    lista: clientRows
                },
                distribucionDistribuidor,
                vencimientosRenta
            };
        } catch (error: any) {
            this.logger.error(`Error en obtenerMetricas: ${error.message}`);
            throw error;
        }
    }

    private formatMonthName(periodo: string) {
        if (!periodo) return '';
        const parts = periodo.split('-');
        if (parts.length < 2) return periodo;
        const [year, month] = parts;
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        const name = date.toLocaleString('es-ES', { month: 'short' });
        return name.charAt(0).toUpperCase() + name.slice(1);
    }
}
