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
            // Órdenes mensuales totales
            const ordenesGeneradas = await db.ordenMensual.count();
            
            // PO Activas (Distintas PO que no sean null/vacías en las órdenes)
            // Ya que Prisma no soporta COUNT DISTINCT fácilmente, lo agrupamos
            const poGroup = await db.ordenMensual.groupBy({
                by: ['po'],
                where: { po: { not: null, notIn: [''] } }
            });
            const poActivas = poGroup.length;

            // Órdenes del mes actual (usaremos el mes más reciente registrado o el mes actual)
            const currentYearMonth = new Date().toISOString().substring(0, 7); // e.g. "2026-06"
            
            // Para asegurar que mostramos datos si el mes actual no tiene (por datos viejos),
            // buscamos el último periodo registrado si el actual es 0.
            let ordenesMesActualCount = await db.ordenMensual.count({ where: { periodo: currentYearMonth } });
            let montoMesActual = 0;
            let targetPeriod = currentYearMonth;

            if (ordenesMesActualCount === 0 && ordenesGeneradas > 0) {
                const lastOrder = await db.ordenMensual.findFirst({
                    orderBy: { periodo: 'desc' }
                });
                if (lastOrder) {
                    targetPeriod = lastOrder.periodo;
                    ordenesMesActualCount = await db.ordenMensual.count({ where: { periodo: targetPeriod } });
                }
            }

            const ordenesDelMes = await db.ordenMensual.findMany({ where: { periodo: targetPeriod } });
            montoMesActual = ordenesDelMes.reduce((sum, ord) => sum + (ord.tarifa || 0), 0);

            // Historial de Facturación para el BarChart / LineChart
            const historialAgrupado = await db.ordenMensual.groupBy({
                by: ['periodo'],
                _sum: { tarifa: true },
                orderBy: { periodo: 'asc' }
            });

            const historialFacturacion = historialAgrupado
                .map(h => ({
                    month: this.formatMonthName(h.periodo),
                    periodo: h.periodo,
                    facturado: h._sum.tarifa ?? 0,
                    presupuesto: (h._sum.tarifa ?? 0) * 0.95
                }))
                .filter(h => h.facturado > 0); // Only show months with data

            // Stats adicionales de flotilla para la dona
            const activosRentados = await db.activo.count({ where: { estatus_operativo: { in: ['ACTIVO', 'EN RENTA'] } } });
            const inactivos = await db.activo.count({ where: { estatus_operativo: 'INACTIVO' } });
            const backUp = await db.activo.count({ where: { estatus_operativo: { in: ['DISPONIBLE', 'BACK UP'] } } });
            const mantenimiento = await db.activo.count({ where: { estatus_operativo: { in: ['MANTENIMIENTO', 'EN TALLER', 'INACTIVO CON CLIENTE'] } } });

            // Si todos son cero porque el excel puso "OPERATIVO", contamos todo como "ACTIVO" si tiene renta
            const totalActivos = await db.activo.count();
            const fallBackRentados = totalActivos > 0 && activosRentados === 0 ? totalActivos : activosRentados;

            return {
                ordenesGeneradas,
                poActivas,
                ordenesMesActual: ordenesMesActualCount,
                montoMesActual,
                periodoActual: targetPeriod,
                historialFacturacion,
                flotillaStatus: {
                    activosRentados: fallBackRentados,
                    inactivos,
                    backUp,
                    mantenimiento
                }
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
