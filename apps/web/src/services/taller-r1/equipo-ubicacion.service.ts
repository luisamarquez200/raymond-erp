import tallerApi from '@/lib/api-taller';
import { getErrorMessage } from '@/lib/utils';

const API_URL = '/taller-r1/equipo-ubicacion';

export interface EquipoUbicacion {
    id_equipo_ubicacion: string;
    id_equipo?: string;
    id_ubicacion?: string;
    id_sub_ubicacion?: string;
    estado: string;

    // Datos enriquecidos (Master View)
    serial_equipo?: string;
    marca?: string;
    modelo: string;
    clase: string;
    ubicacion: string;
    sub_ubicacion: string;
    ubicacion_ocupada: boolean;
    fecha_entrada: string;
    fecha_salida: string;
    cliente: string;
    unidad_venta: string;
    folio: string;
}

export interface MoverEquipoDto {
    id_equipo_ubicacion: string;
    id_ubicacion_destino: string;
    id_sub_ubicacion_destino: string;
    usuario_movilizacion: string;
}

export interface MovilizacionHistory {
    id_movilizacion: string;
    fecha_movilizacion: string;
    usuario_movilizacion: string;
    nombre_ubicacion_origen: string;
    nombre_sub_ubicacion_origen: string;
    nombre_ubicacion_destino: string;
    nombre_sub_ubicacion_destino: string;
}

export const equipoUbicacionApi = {
    getAll: async () => {
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
            console.error('[EquipoUbicacionService] getAll failed:', getErrorMessage(error));
            return [];
        }
    },
    create: async (data: any) => {
        const response = await tallerApi.post(API_URL, data);
        return response.data;
    },
    update: async (id: string, data: any) => {
        const response = await tallerApi.put(`${API_URL}/${id}`, data);
        return response.data;
    },
    delete: async (id: string) => {
        const response = await tallerApi.delete(`${API_URL}/${id}`);
        return response.data;
    },
    movilizarEquipo: async (data: MoverEquipoDto) => {
        const response = await tallerApi.post(`${API_URL}/movilizar`, data);
        return response.data;
    },
    getMovilizaciones: async (id_equipo_ubicacion: string): Promise<MovilizacionHistory[]> => {
        const response = await tallerApi.get<any>(`${API_URL}/${id_equipo_ubicacion}/movilizaciones`);
        return response.data?.data || response.data;
    },
    findByDetailId: async (id_detalle: string): Promise<EquipoUbicacion | null> => {
        const response = await tallerApi.get<any>(`${API_URL}/detail/${id_detalle}`);
        return response.data?.data || response.data;
    }
};
