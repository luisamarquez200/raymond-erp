import { Injectable, Logger } from '@nestjs/common';
import { PrismaDynamicService } from '../../../database/prisma-dynamic.service';

@Injectable()
export class RentasService {
    private readonly logger = new Logger(RentasService.name);

    constructor(private readonly prismaService: PrismaDynamicService) {}

    async obtenerRentas() {
        try {
            const db = PrismaDynamicService.clients.r4;
            if (!db) {
                throw new Error('Database client for R4 not initialized');
            }

            const rentas = await db.renta.findMany({
                include: {
                    cliente: true,
                    activo: true
                }
            });

            const grouped = new Map<string, any>();

            for (const renta of rentas) {
                const cod = (renta.condiciones as any)?.codigo_renta_cli || renta.identificador || renta.id;
                
                if (!grouped.has(cod)) {
                    grouped.set(cod, {
                        id: cod, // Use code as ID for the frontend table
                        identificador: cod,
                        cliente: renta.cliente?.razon_social || 'Desconocido',
                        estado: renta.estado || 'Activo',
                        fechaInicio: renta.fecha_inicio ? new Date(renta.fecha_inicio).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
                        fechaFin: renta.fecha_fin ? new Date(renta.fecha_fin).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
                        monto: 0, 
                        moneda: (renta.condiciones as any)?.moneda || 'MXN',
                        activos: []
                    });
                }
                
                const group = grouped.get(cod);
                if (renta.activo) {
                    group.activos.push({ serie: renta.activo.serie, modelo: renta.activo.modelo });
                }
            }

            return Array.from(grouped.values()).map(g => ({
                id: g.id,
                identificador: g.identificador,
                cliente: g.cliente,
                estado: g.estado,
                fechaInicio: g.fechaInicio,
                fechaFin: g.fechaFin,
                monto: 'Variable', // or sum if available
                activosCount: g.activos.length,
                activos: g.activos
            }));
        } catch (error: any) {
            this.logger.error(`Error en obtenerRentas: ${error.message}`);
            throw error;
        }
    }
}
