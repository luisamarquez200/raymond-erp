import tallerApi from '@/lib/api-taller';
import { getErrorMessage } from '@/lib/utils';

const API_URL = '/taller-r1/equipos';

export interface Equipo {
    id_equipos: string;
    clase: string;
    modelo?: string;
    marca?: string;
}

export const equiposApi = {
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
            console.error('[EquiposService] getAll failed:', getErrorMessage(error));
            return [];
        }
    },

    create: async (data: Partial<Equipo>) => {
        const response = await tallerApi.post<Equipo>(API_URL, data);
        return response.data;
    },

    update: async (id: string, data: Partial<Equipo>) => {
        const response = await tallerApi.put<Equipo>(`${API_URL}/${id}`, data);
        return response.data;
    },

    delete: async (id: string) => {
        const response = await tallerApi.delete(`${API_URL}/${id}`);
        return response.data;
    }
};
