import tallerApi from '@/lib/api-taller';
import { getErrorMessage } from '@/lib/utils';

const API_URL = '/taller-r1/clientes';

export interface Cliente {
    id_cliente: string;
    id_documento?: string;
    nombre_cliente: string;
    rfc?: string;
    persona_contacto?: string;
    telefono?: number;
    razon_social?: string;
    calle?: string;
    numero_calle?: string;
    ciudad?: string;
    cp?: string;
}

export interface CreateClienteDto {
    id_documento?: string;
    nombre_cliente: string;
    rfc?: string;
    persona_contacto?: string;
    telefono?: number;
    razon_social?: string;
    calle?: string;
    numero_calle?: string;
    ciudad?: string;
    cp?: string;
}

export const clientesApi = {
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
            console.error('[ClientesService] getAll failed:', getErrorMessage(error));
            return [];
        }
    },

    getById: async (id: string) => {
        const response = await tallerApi.get<any>(`${API_URL}/${id}`);
        return response.data?.data || response.data;
    },

    create: async (data: CreateClienteDto) => {
        const response = await tallerApi.post<Cliente>(API_URL, data);
        return response.data;
    },

    update: async (id: string, data: Partial<CreateClienteDto>) => {
        const response = await tallerApi.put<Cliente>(`${API_URL}/${id}`, data);
        return response.data;
    },

    delete: async (id: string) => {
        const response = await tallerApi.delete(`${API_URL}/${id}`);
        return response.data;
    },
};
