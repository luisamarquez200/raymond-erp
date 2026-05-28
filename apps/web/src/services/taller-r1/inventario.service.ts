import tallerApi from '@/lib/api-taller';
import { getErrorMessage } from '@/lib/utils';

const API_URL = '/taller-r1/inventario';

export interface InventarioItem {
    id_equipo_ubicacion: string;
    serial_equipo: string;
    marca: string;
    modelo: string;
    clase: string;
    ubicacion: string;
    sub_ubicacion: string;
    estado: string;
    fecha_ingreso: string;
    folio: string;
    sitio: string;
    dias_permanencia: number;
    semanas_permanencia: number;
    tipo_registro?: string;
    statusWMS?: string;
    orden_renovado?: string;
}

export const inventarioApi = {
    getAll: async (): Promise<InventarioItem[]> => {
        try {
            const response = await tallerApi.get<any>(API_URL);
            if (response.data && response.data.data && Array.isArray(response.data.data)) {
                return response.data.data;
            }
            if (Array.isArray(response.data)) {
                return response.data;
            }
            return [];
        } catch (error) {
            console.error('[InventarioService] getAll failed:', getErrorMessage(error));
            return [];
        }
    }
};
