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
            // 1. (Eliminado: Órdenes mensuales totales)

            // 2. Pedidos Generados (Totvs)
            const rentasConTotvs = await db.renta.findMany({
                where: {
                    no_registro_totvs: { not: null, notIn: [''] }
                },
                include: {
                    detalles: true,
                    activo: true
                }
            });
            
            const validRentasTotvs = rentasConTotvs.filter(r => {
                const estRenta = r.estado?.toUpperCase() || '';
                const estActivo = r.activo?.estatus?.toUpperCase() || '';
                return !estRenta.includes('INACTIV') && !estActivo.includes('INACTIV');
            });
            
            const pedidosGeneradosCount = validRentasTotvs.length;

            let importePedidosTotvsMXN = 0;
            let importePedidosTotvsUSD = 0;
            for (const renta of validRentasTotvs) {
                const moneda = renta.detalles?.moneda || 'MXN';
                const monto = renta.detalles?.renta_base ?? renta.tarifa ?? 0;
                if (moneda.toUpperCase() === 'USD') {
                    importePedidosTotvsUSD += monto;
                } else {
                    importePedidosTotvsMXN += monto;
                }
            }

            // 3. Resumen de Órdenes (total de OC registradas y pedidos Totvs registrados)
            const ocGroup = await db.renta.groupBy({
                by: ['orden_compra'],
                where: { orden_compra: { not: null, notIn: [''] } }
            });
            const totalOcRegistradas = ocGroup.length;

            const totvsGroup = await db.renta.groupBy({
                by: ['no_registro_totvs'],
                where: { no_registro_totvs: { not: null, notIn: [''] } }
            });
            const totalPedidosTotvsRegistrados = totvsGroup.length;

            // 4. Resumen de presupuesto por ADC por cliente, en MXN y USD (Equipos activos)
            const activosActivos = await db.activo.findMany({
                where: {
                    estatus: { notIn: ['Inactivo', 'Inactivo con Cliente'] }
                },
                include: {
                    cliente: true,
                    sitio: true,
                    rentas: {
                        where: {
                            estado: { in: ['VIGENTE', 'IMPORTADA'] }
                        },
                        include: {
                            detalles: true
                        }
                    }
                }
            });

            const presupuestoPorAdcClienteMap: Record<string, {
                adc: string;
                cliente: string;
                mxn: number;
                usd: number;
                equiposCount: number;
            }> = {};

            for (const activo of activosActivos) {
                const rentaActiva = activo.rentas?.[0];
                const adc = activo.adc || rentaActiva?.adc || activo.sitio?.adc || 'Sin ADC';
                const clienteNombre = activo.cliente?.razon_social || rentaActiva?.cliente?.razon_social || 'Sin Cliente';
                const key = `${adc}||${clienteNombre}`;

                if (!presupuestoPorAdcClienteMap[key]) {
                    presupuestoPorAdcClienteMap[key] = {
                        adc,
                        cliente: clienteNombre,
                        mxn: 0,
                        usd: 0,
                        equiposCount: 0
                    };
                }

                const claseLimpia = (activo.clase || '').trim().toUpperCase();
                const esClaseValida = ['I', 'II', 'III', 'IV', 'V', 'CLASE I', 'CLASE II', 'CLASE III', 'CLASE IV', 'CLASE V', 'CLASE_I', 'CLASE_II', 'CLASE_III', 'CLASE_IV', 'CLASE_V'].some(c => claseLimpia.includes(c));
                if (esClaseValida) {
                    presupuestoPorAdcClienteMap[key].equiposCount += 1;
                }

                if (rentaActiva) {
                    const moneda = rentaActiva.detalles?.moneda || 'MXN';
                    const monto = rentaActiva.detalles?.renta_base ?? rentaActiva.tarifa ?? 0;
                    if (moneda.toUpperCase() === 'USD') {
                        presupuestoPorAdcClienteMap[key].usd += monto;
                    } else {
                        presupuestoPorAdcClienteMap[key].mxn += monto;
                    }
                }
            }
            const presupuestoAdcCliente = Object.values(presupuestoPorAdcClienteMap);

            // 5. Avance de cumplimiento de cobro de rentas
            const rentasParaCobro = await db.renta.findMany({
                where: {
                    estado: { not: 'CANCELADA' }
                },
                include: {
                    detalles: true,
                    cliente: true,
                    activo: true
                }
            });
            
            const validRentasParaCobro = rentasParaCobro.filter(r => {
                const estRenta = r.estado?.toUpperCase() || '';
                const estActivo = r.activo?.estatus?.toUpperCase() || '';
                return !estRenta.includes('INACTIV') && !estActivo.includes('INACTIV');
            });

            const cumplimientoMap: Record<string, {
                periodo: string;
                mes: string;
                esperadoMXN: number;
                recuperadoMXN: number;
                esperadoUSD: number;
                recuperadoUSD: number;
            }> = {};

            for (const renta of validRentasParaCobro) {
                const period = renta.fecha_inicio ? renta.fecha_inicio.toISOString().substring(0, 7) : 'Sin Periodo';
                if (period === 'Sin Periodo') continue;

                if (!cumplimientoMap[period]) {
                    cumplimientoMap[period] = {
                        periodo: period,
                        mes: this.formatMonthName(period),
                        esperadoMXN: 0,
                        recuperadoMXN: 0,
                        esperadoUSD: 0,
                        recuperadoUSD: 0
                    };
                }

                const moneda = renta.detalles?.moneda || 'MXN';
                const esperado = renta.detalles?.renta_real ?? renta.tarifa ?? 0;
                const recuperado = renta.detalles?.importe_recuperado ?? 0;

                if (moneda.toUpperCase() === 'USD') {
                    cumplimientoMap[period].esperadoUSD += esperado;
                    cumplimientoMap[period].recuperadoUSD += recuperado;
                } else {
                    cumplimientoMap[period].esperadoMXN += esperado;
                    cumplimientoMap[period].recuperadoMXN += recuperado;
                }
            }

            const cumplimientoCobro = Object.values(cumplimientoMap)
                .sort((a, b) => a.periodo.localeCompare(b.periodo))
                .map(c => ({
                    ...c,
                    porcentajeMXN: c.esperadoMXN > 0 ? (c.recuperadoMXN / c.esperadoMXN) * 100 : 0,
                    porcentajeUSD: c.esperadoUSD > 0 ? (c.recuperadoUSD / c.esperadoUSD) * 100 : 0
                }));

            // 6. Recuperación de rentas de meses anteriores (meses menores al mes actual)
            const currentPeriod = new Date().toISOString().substring(0, 7); // e.g. "2026-06"
            const recuperacionAnteriorMap: Record<string, {
                periodo: string;
                mes: string;
                esperadoMXN: number;
                recuperadoMXN: number;
                esperadoUSD: number;
                recuperadoUSD: number;
            }> = {};

            for (const renta of validRentasParaCobro) {
                const period = renta.fecha_inicio ? renta.fecha_inicio.toISOString().substring(0, 7) : 'Sin Periodo';
                if (period === 'Sin Periodo' || period >= currentPeriod) continue;

                if (!recuperacionAnteriorMap[period]) {
                    recuperacionAnteriorMap[period] = {
                        periodo: period,
                        mes: this.formatMonthName(period),
                        esperadoMXN: 0,
                        recuperadoMXN: 0,
                        esperadoUSD: 0,
                        recuperadoUSD: 0
                    };
                }

                const moneda = renta.detalles?.moneda || 'MXN';
                const esperado = renta.detalles?.renta_real ?? renta.tarifa ?? 0;
                const recuperado = renta.detalles?.importe_recuperado ?? 0;

                if (moneda.toUpperCase() === 'USD') {
                    recuperacionAnteriorMap[period].esperadoUSD += esperado;
                    recuperacionAnteriorMap[period].recuperadoUSD += recuperado;
                } else {
                    recuperacionAnteriorMap[period].esperadoMXN += esperado;
                    recuperacionAnteriorMap[period].recuperadoMXN += recuperado;
                }
            }

            const recuperacionMesesAnteriores = Object.values(recuperacionAnteriorMap)
                .sort((a, b) => a.periodo.localeCompare(b.periodo))
                .map(c => ({
                    ...c,
                    porcentajeMXN: c.esperadoMXN > 0 ? (c.recuperadoMXN / c.esperadoMXN) * 100 : 0,
                    porcentajeUSD: c.esperadoUSD > 0 ? (c.recuperadoUSD / c.esperadoUSD) * 100 : 0
                }));

            // (Eliminados: PO Activas, ordenesMesActual, historialFacturacion)

            // Stats adicionales de flotilla para la dona (mantenidas por compatibilidad)
            const activosRentados = await db.activo.count({ where: { estatus_operativo: { in: ['ACTIVO', 'EN RENTA'] } } });
            const inactivos = await db.activo.count({ where: { estatus_operativo: 'INACTIVO' } });
            const backUp = await db.activo.count({ where: { estatus_operativo: { in: ['DISPONIBLE', 'BACK UP'] } } });
            const mantenimiento = await db.activo.count({ where: { estatus_operativo: { in: ['MANTENIMIENTO', 'EN TALLER', 'INACTIVO CON CLIENTE'] } } });

            const totalActivos = await db.activo.count();
            const fallBackRentados = totalActivos > 0 && activosRentados === 0 ? totalActivos : activosRentados;

            return {
                // Se removieron: ordenesGeneradas, poActivas, ordenesMesActual, montoMesActual, periodoActual, historialFacturacion
                flotillaStatus: {
                    activosRentados: fallBackRentados,
                    inactivos,
                    backUp,
                    mantenimiento
                },
                // Nuevas métricas
                pedidosGenerados: pedidosGeneradosCount,
                importePedidosTotvs: {
                    mxn: importePedidosTotvsMXN,
                    usd: importePedidosTotvsUSD
                },
                resumenOrdenes: {
                    totalOc: totalOcRegistradas,
                    totalPedidosTotvs: totalPedidosTotvsRegistrados
                },
                presupuestoAdcCliente,
                cumplimientoCobro,
                recuperacionMesesAnteriores
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
