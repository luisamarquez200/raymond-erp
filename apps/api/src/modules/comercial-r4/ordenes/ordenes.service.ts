import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
                    activo: true, 
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
                cliente: o.cliente?.razon_social || 'Desconocido',
                activo: o.activo?.serie || o.activo_id,
                renta_id: o.renta_id
            }));
        } catch (error: any) {
            this.logger.error(`Error en obtenerOrdenes: ${error.message}`);
            throw error;
        }
    }

    async registrarOrdenManual(dto: { renta_id: string, periodo: string, po: string }) {
        const db = this.getDb();
        try {
            // First verify the renta exists
            const renta = await db.renta.findUnique({
                where: { id: dto.renta_id },
                include: { activo: true, cliente: true }
            });

            if (!renta) {
                throw new NotFoundException('Renta no encontrada');
            }

            // Check if order already exists for this active + period + PO
            const existing = await db.ordenMensual.findFirst({
                where: {
                    activo_id: renta.activo_id,
                    periodo: dto.periodo,
                    po: dto.po
                }
            });

            if (existing) {
                throw new Error('Ya existe una orden de compra para este equipo, periodo y PO.');
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
                    tarifa: renta.renta_base,
                    moneda: renta.moneda || 'MXN',
                    estado: 'GENERADA'
                }
            });

            return nuevaOrden;
        } catch (error: any) {
            this.logger.error(`Error en registrarOrdenManual: ${error.message}`);
            throw error;
        }
    }
}
