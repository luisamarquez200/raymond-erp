import tallerApi from '@/lib/api-taller';
import { getErrorMessage } from '@/lib/utils';

const API_URL = '/taller-r1/entradas';

export interface Entrada {
    // ... (rest of the interface stays as is)
    id_entrada: string;
    folio: string;
    fecha_creacion: Date;
    usuario_asignado?: string;
    comentario?: string;
    evidencia_1?: string;
    evidencia_2?: string;
    evidencia_3?: string;
    firma_entrega?: string;
    firma_recibo?: string;
    nombre_entrega?: string;
    estado: string;
    fecha_cierre?: Date;
    prioridad?: string;
    fecha_asignacion?: Date;
    usuario_encargado?: string;
    cliente?: string;
    elemento?: string;
    factura?: string;
    distribuidor?: string;
    cliente_origen?: string;
    adc?: string;
    rel_cliente?: {
        id_cliente: string;
        nombre_cliente: string;
    };
    _count?: {
        entrada_detalle: number;
        entrada_accesorios: number;
    };
}

export interface CreateEntradaDto {
    folio: string;
    distribuidor?: string;
    factura?: string;
    cliente_origen?: string;
    adc?: string;
    cliente?: string;
    fecha_creacion: Date;
    elemento?: string;
    comentario?: string;
    comentario_1?: string;
    comentario_2?: string;
    comentario_3?: string;
    evidencia_1?: string;
    evidencia_2?: string;
    evidencia_3?: string;
    usuario_asignado?: string;
    estado: string;
    prioridad?: string;
    firma_entrega?: string;
    firma_recibo?: string;
    nombre_entrega?: string;
}

export interface UpdateEntradaDto {
    usuario_asignado?: string;
    comentario?: string;
    evidencia_1?: string;
    evidencia_2?: string;
    estado?: string;
    fecha_cierre?: Date;
    prioridad?: string;
    fecha_asignacion?: Date;
    usuario_encargado?: string;
    cliente?: string;
}

export const entradasApi = {
    // Obtener todas las entradas
    getAll: async (estado?: string) => {
        const params = estado ? { estado } : {};
        try {
            const response = await tallerApi.get<any>(API_URL, { params });
            // Handle both wrapped and direct responses
            if (response.data && response.data.data && Array.isArray(response.data.data)) {
                return response.data.data;
            }
            if (Array.isArray(response.data)) {
                return response.data;
            }
            return [];
        } catch (error) {
            console.error('[EntradasService] getAll failed:', getErrorMessage(error));
            return [];
        }
    },

    // Obtener conteos de equipos y accesorios para todas las entradas
    getCounts: async (): Promise<Record<string, { equipos: number; accesorios: number }>> => {
        try {
            const response = await tallerApi.get<any>(`${API_URL}/counts/all`);
            return response.data?.data || response.data || {};
        } catch (error) {
            console.error('[EntradasService] getCounts failed:', getErrorMessage(error));
            return {};
        }
    },

    // Obtener una entrada por ID
    getById: async (id: string) => {
        const response = await tallerApi.get<any>(`${API_URL}/${id}`);
        return response.data?.data || response.data;
    },

    // Obtener detalles de una entrada
    getDetalles: async (id: string) => {
        const response = await tallerApi.get<any>(`${API_URL}/${id}/detalles`);
        return response.data?.data || response.data;
    },

    // Obtener accesorios de una entrada
    getAccesorios: async (id: string) => {
        const response = await tallerApi.get<any>(`${API_URL}/${id}/accesorios`);
        return response.data?.data || response.data;
    },

    // Crear una nueva entrada
    create: async (data: CreateEntradaDto) => {
        const response = await tallerApi.post<any>(API_URL, data);
        return response.data?.data || response.data;
    },

    // Actualizar una entrada
    update: async (id: string, data: UpdateEntradaDto) => {
        const response = await tallerApi.put<any>(`${API_URL}/${id}`, data);
        return response.data?.data || response.data;
    },

    // Obtener el siguiente folio
    getNextFolio: async () => {
        const response = await tallerApi.get<any>(`${API_URL}/get-last-folio/last`);
        return response.data?.data?.folio || response.data?.folio;
    },

    // Eliminar una entrada
    delete: async (id: string) => {
        const response = await tallerApi.delete(`${API_URL}/${id}`);
        return response.data?.data || response.data;
    },

    // Crear detalle de entrada
    createDetalle: async (id_entrada: string, data: any) => {
        const response = await tallerApi.post<any>(`${API_URL}/${id_entrada}/detalles`, data);
        return response.data?.data || response.data;
    },

    // Crear accesorio de entrada
    createAccesorio: async (id_entrada: string, data: any) => {
        const response = await tallerApi.post<any>(`${API_URL}/${id_entrada}/accesorios`, data);
        return response.data?.data || response.data;
    },

    updateAccesorio: async (id_accesorio: string, data: any) => {
        const response = await tallerApi.put<any>(`${API_URL}/accesorios/${id_accesorio}`, data);
        return response.data?.data || response.data;
    },

    // Actualizar detalle de entrada
    updateDetalle: async (id_detalle: string, data: any) => {
        const response = await tallerApi.put<any>(`${API_URL}/detalles/${id_detalle}`, data);
        return response.data?.data || response.data;
    },

    // Ubicar todos los equipos de la entrada
    ubicarEquipos: async (id_entrada: string, usuario: string) => {
        const response = await tallerApi.post<any>(`${API_URL}/${id_entrada}/ubicar`, { usuario });
        return response.data?.data || response.data;
    },

    // Enviar correos
    sendMail: async (data: { tipo: 'Entrada' | 'Salida', folio: string, fecha: string, site?: string, pdfBase64?: string, excelBase64?: string }) => {
        const response = await tallerApi.post<any>('/taller-r1/mail/entradas-salidas', data);
        return response.data?.data || response.data;
    },

    // Validar serial cross-site (R1, R2, R3)
    validateCrossSiteSerial: async (serial: string, tipo: 'Equipo' | 'Accesorio') => {
        const response = await tallerApi.get<any>(`${API_URL}/validation/serial/${serial}?tipo=${tipo}`);
        return response.data;
    }
};
