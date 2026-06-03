import api from '@/lib/api-taller';

export interface Adc {
    id: number;
    nombre: string;
}

export const adcApi = {
    getAll: async () => {
        const response = await api.get<any>('/taller-r1/adc');
        return response.data?.data || response.data || [];
    },
    create: async (nombre: string) => {
        const response = await api.post<Adc>('/taller-r1/adc', { nombre });
        return response.data;
    },
    remove: async (id: number) => {
        const response = await api.delete(`/taller-r1/adc/${id}`);
        return response.data;
    }
};
