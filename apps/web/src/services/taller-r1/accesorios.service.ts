import tallerApi from '@/lib/api-taller';
import { getErrorMessage } from '@/lib/utils';

const API_URL = '/taller-r1/accesorios';

export interface Accesorio {
    id_accesorio: string;
    tipo?: string;
    modelo?: string;
    serial?: string;
    rack?: string;
    estado_acc?: string;
    fecha_ingreso?: Date;
    fecha_ultima_carga?: Date | string;
    evidencia?: string;
    estado?: string;
    ubicacion?: string;
    sub_ubicacion?: string;
    rel_ubicacion?: { nombre_ubicacion: string };
    rel_sub_ubicacion?: { nombre: string };
}

export const accesoriosApi = {
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
            console.error('[AccesoriosService] getAll failed:', getErrorMessage(error));
            return [];
        }
    },
    getAlertasBaterias: async () => {
        try {
            const response = await tallerApi.get<any>(`${API_URL}/alertas-baterias`);
            if (response.data && response.data.data && Array.isArray(response.data.data)) {
                return response.data.data;
            }
            if (Array.isArray(response.data)) {
                return response.data;
            }
            return [];
        } catch (error) {
            console.error('[AccesoriosService] getAlertasBaterias failed:', getErrorMessage(error));
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
    checkExists: async (serial: string) => {
        const response = await tallerApi.get<{ exists: boolean, data?: any }>(`${API_URL}/exists/${serial}`);
        return response.data;
    },
};
