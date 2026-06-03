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
}
