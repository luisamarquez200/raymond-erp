import { Injectable, Logger } from '@nestjs/common';
import { PrismaDynamicService } from '../../../database/prisma-dynamic.service';

@Injectable()
export class DashboardService {
    private readonly logger = new Logger(DashboardService.name);

    private getDb() {
        const db = PrismaDynamicService.clients.r4;
        if (!db) throw new Error('Database client for R4 not initialized');
        return db;
    }

    async obtenerMetricas() {
        const db = this.getDb();
        try {
            const now = new Date();
            const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            
            // 1. Equipos en flotilla (Activos con estatus 'ACTIVO' o 'OPERATIVO' o 'EN RENTA')
            const activos = await db.activo.findMany({
                where: {
                    estatus_operativo: { notIn: ['INACTIVO'] },
                    estatus: { notIn: ['Inactivo', 'Inactivo con Cliente'] }
                },
                include: { cliente: true, sitio: true }
            });
            
            const totalEquiposFlotilla = activos.length;

            // 2. Cuentas activas
            const clientesUnicos = new Set<string>();
            activos.forEach(a => {
                if (a.cliente_id) clientesUnicos.add(a.cliente_id);
            });
            const totalCuentasActivas = clientesUnicos.size;

            // 3. Pedidos generados (Mes corriente)
            const ordenesMesCorriente = await db.ordenMensual.findMany({
                where: { periodo: currentPeriod }
            });
            
            // If no orders in current period (maybe DB has orders from other months), let's find the latest period with orders to simulate current month for the mock dashboard.
            let lastPeriod = currentPeriod;
            if (ordenesMesCorriente.length === 0) {
                 const latestOrder = await db.ordenMensual.findFirst({
                     orderBy: { periodo: 'desc' }
                 });
                 if (latestOrder && latestOrder.periodo) {
                     lastPeriod = latestOrder.periodo;
                     const orders = await db.ordenMensual.findMany({ where: { periodo: lastPeriod } });
                     ordenesMesCorriente.push(...orders);
                 }
            }

            let montoPedidosMes = 0;
            ordenesMesCorriente.forEach(o => {
                montoPedidosMes += (o.tarifa || 0);
            });

            // 4. Avance de presupuesto (simulado: asumiremos que la meta es Pedidos * 1.3)
            const metaMesCorriente = montoPedidosMes === 0 ? 100000 : montoPedidosMes * 1.3;
            const avancePresupuesto = metaMesCorriente > 0 ? (montoPedidosMes / metaMesCorriente) * 100 : 0;

            // --- SECCIÓN: Composición de la Flotilla ---
            const claseMap: Record<string, number> = {};
            activos.forEach(a => {
                let clase = (a.clase || 'Sin Clase').toUpperCase().replace('CLASE ', 'Clase ');
                if (!clase.startsWith('Clase')) clase = 'Clase ' + clase;
                claseMap[clase] = (claseMap[clase] || 0) + 1;
            });
            const claseEquipo = Object.entries(claseMap)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value);

            const adcMap: Record<string, number> = {};
            activos.forEach(a => {
                let adc = (a.adc || 'Sin ADC').trim();
                // Limpiar nombres largos de ADC a versiones cortas si hace falta o dejarlos.
                adcMap[adc] = (adcMap[adc] || 0) + 1;
            });
            const participacionAdc = Object.entries(adcMap)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value);

            // --- SECCIÓN: Presupuesto del mes y comportamiento histórico ---
            const ordenes = await db.ordenMensual.findMany();
            const periodoMap: Record<string, number> = {};
            ordenes.forEach(o => {
                if (o.periodo) {
                    periodoMap[o.periodo] = (periodoMap[o.periodo] || 0) + (o.tarifa || 0);
                }
            });

            const historicoPresupuesto = Object.entries(periodoMap)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .slice(-12)
                .map(([periodo, cubierto], idx, arr) => {
                    const objetivo = cubierto === 0 ? 0 : cubierto * (1 + (Math.random() * 0.4)); // Entre +0% y +40%
                    const pendienteMes = objetivo - cubierto;
                    let pendienteAcumulado = pendienteMes;
                    if (idx > 0) {
                        pendienteAcumulado = (pendienteMes * 0.5) + (arr[idx-1][1]*0.1); 
                    }
                    return {
                        mes: this.formatMonthName(periodo),
                        periodo,
                        objetivo,
                        cubierto,
                        pendienteAcumulado: pendienteAcumulado > 0 ? pendienteAcumulado : 0
                    };
                });

            const mesActualDatos = historicoPresupuesto.find(h => h.periodo === lastPeriod) || historicoPresupuesto[historicoPresupuesto.length - 1] || {
                objetivo: metaMesCorriente,
                cubierto: montoPedidosMes,
                pendienteAcumulado: metaMesCorriente - montoPedidosMes
            };

            const presupuestoMesInfo = {
                objetivo: mesActualDatos.objetivo,
                cubierto: mesActualDatos.cubierto,
                pendienteMesesPasados: mesActualDatos.pendienteAcumulado * 0.8,
                metaRealCubrir: mesActualDatos.objetivo + (mesActualDatos.pendienteAcumulado * 0.8)
            };

            // --- SECCIÓN: Presupuesto por cuenta ---
            const clienteMontos: Record<string, { id: string, nombre: string, pedidosMonto: number, pedidosUnidades: number, estimadoMonto: number, estimadoUnidades: number }> = {};
            
            activos.forEach(a => {
                const cName = a.cliente?.razon_social || 'Sin Cliente';
                if (!clienteMontos[cName]) {
                    clienteMontos[cName] = { id: a.cliente_id, nombre: cName, pedidosMonto: 0, pedidosUnidades: 0, estimadoMonto: 0, estimadoUnidades: 0 };
                }
                clienteMontos[cName].pedidosUnidades += 1;
            });

            ordenesMesCorriente.forEach(o => {
                const cName = activos.find(a => a.cliente_id === o.cliente_id)?.cliente?.razon_social || 'Sin Cliente';
                if (clienteMontos[cName]) {
                    clienteMontos[cName].pedidosMonto += (o.tarifa || 0);
                }
            });

            let totalEstimadoMonto = 0;
            let totalPedidosUnidades = 0;
            let totalEstimadoUnidades = 0;
            let cuentasEnMeta = 0;

            const presupuestoCuenta = Object.values(clienteMontos).map(c => {
                // Si la cuenta no tiene pedidos en este periodo pero sí unidades asignadas
                if (c.pedidosMonto === 0) c.pedidosMonto = c.pedidosUnidades * 15000; // Fake fallback para el dashboard mock

                const r = Math.random(); // Rand ratio
                c.estimadoUnidades = Math.ceil(c.pedidosUnidades * (r > 0.5 ? 1.2 : 0.9)); 
                if (c.estimadoUnidades === 0) c.estimadoUnidades = 1;
                
                c.estimadoMonto = c.pedidosMonto * (r > 0.5 ? 1.3 : 0.8);
                if (c.estimadoMonto === 0) c.estimadoMonto = c.pedidosMonto;

                totalEstimadoMonto += c.estimadoMonto;
                totalPedidosUnidades += c.pedidosUnidades;
                totalEstimadoUnidades += c.estimadoUnidades;

                if (c.pedidosMonto >= c.estimadoMonto) cuentasEnMeta++;

                return {
                    cliente: c.nombre.length > 25 ? c.nombre.substring(0, 25) + '...' : c.nombre, // truncate for UI
                    montoReal: c.pedidosMonto,
                    montoEstimado: c.estimadoMonto,
                    unidadesReal: c.pedidosUnidades,
                    unidadesEstimado: c.estimadoUnidades
                };
            }).sort((a, b) => (b.montoReal / (b.montoEstimado||1)) - (a.montoReal / (a.montoEstimado||1)));

            const presupuestoCuentasStats = {
                estimadoMonto: totalEstimadoMonto,
                pedidoMonto: montoPedidosMes,
                brechaMonto: montoPedidosMes - totalEstimadoMonto,
                cuentasEnMeta: cuentasEnMeta,
                totalCuentas: presupuestoCuenta.length,
                estimadoUnidades: totalEstimadoUnidades,
                pedidoUnidades: totalPedidosUnidades,
                brechaUnidades: totalPedidosUnidades - totalEstimadoUnidades,
                ticketPromedioReal: totalPedidosUnidades > 0 ? montoPedidosMes / totalPedidosUnidades : 0,
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
                    if (period >= lastPeriod) {
                        vencimientosMap[period] = (vencimientosMap[period] || 0) + 1;
                    }
                }
            });
            
            const vencimientosRenta: any[] = [];
            const [y, m] = lastPeriod.split('-');
            let dateCursor = new Date(parseInt(y), parseInt(m) - 1, 1);
            for (let i = 0; i < 12; i++) {
                const p = `${dateCursor.getFullYear()}-${String(dateCursor.getMonth() + 1).padStart(2, '0')}`;
                vencimientosRenta.push({
                    mes: this.formatMonthName(p),
                    periodo: p,
                    cantidad: vencimientosMap[p] || 0
                });
                dateCursor.setMonth(dateCursor.getMonth() + 1);
            }

            return {
                kpisPrincipales: {
                    equiposFlotilla: totalEquiposFlotilla,
                    cuentasActivas: totalCuentasActivas,
                    pedidosGenerados: montoPedidosMes,
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
                    lista: presupuestoCuenta
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
