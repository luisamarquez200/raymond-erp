import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaDynamicService } from '../../../database/prisma-dynamic.service';

@Injectable()
export class OrdenesService {
    private readonly logger = new Logger(OrdenesService.name);

    private getDb() {
        const db = PrismaDynamicService.clients.r4;
        if (!db) throw new Error('Database client for R4 not initialized');
        return db;
    }

    async obtenerOrdenes() {
        const db = this.getDb();
        try {
            const ordenes = await db.ordenMensual.findMany({
                include: { 
                    cliente: true, 
                    renta: true,
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
            return ordenes.map((o: any) => ({
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
                renta_id: o.renta_id
            }));
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
}
