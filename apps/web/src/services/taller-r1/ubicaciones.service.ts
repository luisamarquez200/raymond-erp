import tallerApi from '@/lib/api-taller';
import { getErrorMessage } from '@/lib/utils';

const API_URL = '/taller-r1/ubicaciones';

export interface Ubicacion {
    id_ubicacion: string;
    nombre_ubicacion: string;
    maximo_stock: number;
    Clase?: string;
    occupiedSubs?: number;
}

export const ubicacionesApi = {
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
            console.error('[UbicacionesService] getAll failed:', getErrorMessage(error));
            return [];
        }
    },
    create: async (data: any) => {
        const response = await tallerApi.post<any>(API_URL, data);
        return response.data?.data || response.data;
    },
    update: async (id: string, data: any) => {
        const response = await tallerApi.put<any>(`${API_URL}/${id}`, data);
        return response.data?.data || response.data;
    },
    delete: async (id: string) => {
        const response = await tallerApi.delete(`${API_URL}/${id}`);
        return response.data?.data || response.data;
    },
    getNextSubLocation: async (id_ubicacion: string, entradaId: string, rack?: string) => {
        const queryParams = new URLSearchParams({ entradaId });
        if (rack) queryParams.append('rack', rack);

        const response = await tallerApi.get<any>(`${API_URL}/${id_ubicacion}/next-sub-location?${queryParams.toString()}`);
        return response.data?.data || response.data;
    },
    getSubLocations: async (id_ubicacion: string, rack?: string) => {
        const queryParams = new URLSearchParams();
        if (rack) queryParams.append('rack', rack);

        const response = await tallerApi.get<any>(`${API_URL}/${id_ubicacion}/sub-locations?${queryParams.toString()}`);
        const data = response.data?.data || response.data;
        return Array.isArray(data) ? data : [];
    },
    createSubLocation: async (id_ubicacion: string, nombre: string) => {
        const response = await tallerApi.post<any>(`${API_URL}/${id_ubicacion}/sub-locations`, { nombre });
        return response.data?.data || response.data;
    },
    deleteSubLocation: async (id_ubicacion: string, subId: string) => {
        const response = await tallerApi.delete<any>(`${API_URL}/${id_ubicacion}/sub-locations/${subId}`);
        return response.data?.data || response.data;
    },
};
