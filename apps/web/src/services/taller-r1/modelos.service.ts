import tallerApi from '@/lib/api-taller';
import { getErrorMessage } from '@/lib/utils';

const API_URL = '/taller-r1/modelos';

export interface Modelo {
    id_modelo: string;
    modelo: string;
    clase_id?: string;
}

export const modelosApi = {
    getAll: async (clase?: string) => {
        try {
            const url = clase ? `${API_URL}?clase=${clase}` : API_URL;
            const response = await tallerApi.get<any>(url);
            if (response.data && response.data.data && Array.isArray(response.data.data)) {
                return response.data.data;
            }
            if (Array.isArray(response.data)) {
                return response.data;
            }
            return [];
        } catch (error) {
            console.error('[ModelosService] getAll failed:', getErrorMessage(error));
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
};
