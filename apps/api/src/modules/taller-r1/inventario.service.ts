import { Injectable } from '@nestjs/common';
import { PrismaClient as PrismaR1 } from '@prisma/client-taller-r1';
import { PrismaDynamicService } from '../../database/prisma-dynamic.service';

@Injectable()
export class InventarioService {
    constructor(private prisma: PrismaDynamicService) { }

    private get db(): PrismaR1 {
        return this.prisma.client;
    }

    async getInventario() {
        // Query the Inventario view directly
        const inventarioRaw = await this.db.$queryRawUnsafe<any[]>('SELECT * FROM Inventario');

        // Extract IDs for mapping
        const ubicacionIds = [...new Set(inventarioRaw.map((e) => e.ubicacion).filter(Boolean))] as string[];
        const subUbicacionIds = [...new Set(inventarioRaw.map((e) => e.sub_ubicacion).filter(Boolean))] as string[];
        const equipoIds = [...new Set(inventarioRaw.map((e) => e.id_equipo).filter(Boolean))] as string[];
        const entradaIds = [...new Set(inventarioRaw.map((e) => e.id_entrada).filter(Boolean))] as string[];

        // Fetch master data in parallel
        const [
            equipos,
            ubicaciones,
            subUbicaciones,
            entradas
        ] = await Promise.all([
            this.db.equipos.findMany({ where: { id_equipos: { in: equipoIds } } }),
            this.db.ubicacion.findMany({ where: { id_ubicacion: { in: ubicacionIds } } }),
            this.db.sub_ubicaciones.findMany({ where: { id_sub_ubicacion: { in: subUbicacionIds } } }),
            this.db.entradas.findMany({ where: { id_entrada: { in: entradaIds } } })
        ]);

        // Lookup maps
        const equiposMap = new Map(equipos.map(e => [e.id_equipos, e]));
        const ubicacionesMap = new Map(ubicaciones.map(e => [e.id_ubicacion, e.nombre_ubicacion]));
        const subUbicacionesMap = new Map(subUbicaciones.map(e => [e.id_sub_ubicacion, e.nombre]));
        const entradasMap = new Map(entradas.map(e => [e.id_entrada, e.folio]));

        const now = new Date();
        const currentSite = this.prisma.currentSite.toUpperCase();

        return inventarioRaw.map((row) => {
            const eq = row.id_equipo ? equiposMap.get(row.id_equipo) : null;
            const folio = row.id_entrada ? entradasMap.get(row.id_entrada) : 'N/D';

            // Calculate permanency
            let diasPermanencia = 0;
            let semanasPermanencia = 0;

            if (row.fecha_ingreso) {
                const diffTime = Math.abs(now.getTime() - new Date(row.fecha_ingreso).getTime());
                diasPermanencia = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                semanasPermanencia = parseFloat((diasPermanencia / 7).toFixed(1));
            }

            return {
                id_equipo_ubicacion: row.id,
                serial_equipo: row.serial || 'S/N',
                marca: eq?.marca || 'N/D',
                modelo: row.modelo || 'N/D',
                clase: eq?.clase || row.tipo || 'N/D',
                ubicacion: row.ubicacion ? ubicacionesMap.get(row.ubicacion) || 'N/D' : 'N/D',
                sub_ubicacion: row.sub_ubicacion ? subUbicacionesMap.get(row.sub_ubicacion) || 'N/D' : 'N/D',
                estado: row.estado || 'N/D',
                fecha_ingreso: row.fecha_ingreso || 'N/D',
                folio: folio,
                sitio: currentSite,
                dias_permanencia: diasPermanencia,
                semanas_permanencia: semanasPermanencia,
                // Nuevos campos para los filtros:
                tipo_registro: row.tipo_registro || 'N/D',
                statusWMS: row.statusWMS || 'N/D',
                orden_renovado: row.orden_renovado || 'No'
            };
        });
    }
}
