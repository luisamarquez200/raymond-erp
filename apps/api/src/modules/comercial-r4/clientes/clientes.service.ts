import { Injectable, Logger } from '@nestjs/common';
import { PrismaDynamicService } from '../../../database/prisma-dynamic.service';

@Injectable()
export class ClientesService {
    private readonly logger = new Logger(ClientesService.name);

    constructor(private readonly prismaService: PrismaDynamicService) {}

    async obtenerClientes() {
        try {
            const db = PrismaDynamicService.clients.r4;
            if (!db) {
                throw new Error('Database client for R4 not initialized');
            }

            const clientes = await db.cliente.findMany({
                include: {
                    sitios: {
                        include: {
                            activos: true
                        }
                    },
                    activos: true
                }
            });

            return clientes.map(cliente => {
                return {
                    id: cliente.id,
                    razonSocial: cliente.razon_social,
                    rfc: cliente.rfc || '-',
                    estatus: cliente.estatus || 'Activo',
                    sitiosCount: cliente.sitios?.length || 0,
                    activosCount: cliente.activos?.length || 0,
                    sitios: cliente.sitios?.map(s => ({
                        id: s.id,
                        nombre: s.nombre,
                        ciudad: s.ciudad,
                        activosCount: s.activos?.length || 0
                    }))
                };
            });
        } catch (error: any) {
            this.logger.error(`Error en obtenerClientes: ${error.message}`);
            throw error;
        }
    }
}
