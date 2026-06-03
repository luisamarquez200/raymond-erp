import { Injectable, Logger } from '@nestjs/common';
import { PrismaDynamicService } from '../../../database/prisma-dynamic.service';

@Injectable()
export class FlotillaService {
    private readonly logger = new Logger(FlotillaService.name);

    constructor(private readonly prismaService: PrismaDynamicService) {}

    async obtenerFlotilla() {
        try {
            const db = PrismaDynamicService.clients.r4;
            if (!db) {
                throw new Error('Database client for R4 not initialized');
            }

            const activos = await db.activo.findMany({
                include: {
                    cliente: true,
                    sitio: true,
                    rentas: true,
                    ordenes: true
                }
            });

            // Mapeamos los datos para que el frontend los pueda consumir fácilmente
            return activos.map(activo => {
                const renta = activo.rentas?.[0];

                return {
                    id: activo.id,
                    serie: activo.serie,
                    tipo: activo.clase?.includes('III') ? 'Patín' : 'Montacargas', // Estimación básica basada en clase
                    clase: activo.clase,
                    modelo: activo.modelo,
                    estatus: activo.estatus_operativo || 'Activo',
                    cliente: activo.cliente?.razon_social || 'Sin Cliente',
                    site: activo.sitio?.nombre || 'Sin Sitio',
                    cuenta: activo.cuenta || '-',
                    adc: activo.adc || '-',
                    distribuidor: activo.distribuidor || '-',
                    // Fechas
                    fechaIngreso: renta?.fecha_inicio ? new Date(renta.fecha_inicio).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
                    fechaVencimiento: renta?.fecha_fin ? new Date(renta.fecha_fin).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
                    plazo: renta?.condiciones?.plazo || '-',
                    fechaRecoleccion: '-',
                    // SMP
                    smp: 'Sin SMP', // Esto vendría de otra lógica de taller en el futuro
                    proxSmp: '-',
                    responsable: activo.adc || '-',
                };
            });
        } catch (error: any) {
            this.logger.error(`Error en obtenerFlotilla: ${error.message}`);
            throw error;
        }
    }
}
