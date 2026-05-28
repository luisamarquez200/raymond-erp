import tallerApi from '@/lib/api-taller';
import { getErrorMessage } from '@/lib/utils';

const API_URL = '/taller-r1/salidas';

export interface Salida {
    id_salida: string;
    folio: string;
    fecha_transporte: Date;
    numero_transporte?: string;
    estado: string;
    cliente?: string;
    firma?: string;
    evidencia?: string;
    usuario_asignado?: string;
    firma_usuario?: string;
    comentario?: string;
    nombre_recibe?: string;
    pdf?: boolean;
    fecha_creacion?: Date;
    elemento?: string;
    carta_instruccion?: string;
    pedido?: string;
    razon_social?: string;
    direccion_cliente?: string;
    rfc?: string;
    contacto?: string;
    telefono?: string;
    remision?: string;
    adc?: string;
    oc?: string;
    observaciones?: string;
    PDF_Carta?: string;
    remision_confirmacion?: number;
    destino?: string;
    tipo_documento?: string;
    detalles?: any[];
    accesorios?: any[];
}

export interface CreateSalidaDto {
    tiene_remision: boolean;
    numero_remision?: string;
    numero_transporte?: string;
    pedido_venta?: string;
    cliente?: string;
    tipo_elemento: 'Equipos' | 'Accesorios';
    observaciones?: string;
    evidencia?: string;
    razon_social?: string;
    direccion_cliente?: string;
    rfc?: string;
    contacto?: string;
    telefono?: string;
    destino?: string;
    tipo_documento?: string;
    firma?: string;
    firma_usuario?: string;
    nombre_recibe?: string;
}

export interface UpdateSalidaDto {
    fecha_transporte?: Date;
    numero_transporte?: string;
    estado?: string;
    cliente?: string;
    firma?: string;
    evidencia?: string;
    usuario_asignado?: string;
    firma_usuario?: string;
    comentario?: string;
    nombre_recibe?: string;
    elemento?: string;
    carta_instruccion?: string;
    pedido?: string;
    razon_social?: string;
    direccion_cliente?: string;
    rfc?: string;
    contacto?: string;
    telefono?: string;
    remision?: string;
    adc?: string;
    oc?: string;
    observaciones?: string;
    remision_confirmacion?: number;
    destino?: string;
    tipo_documento?: string;
}

export interface CreateDetalleDto {
    id_equipo: string;
    id_equipo_ubicacion?: string;
    tipo_salida: 'Renta' | 'Venta' | 'Embarque';
    serial_equipos?: string;
    id_ubicacion?: string;
    id_sub_ubicacion?: string;
    aditamentos?: string;
    foto_llave?: string;
    foto_kit_tapon?: string;
    foto_compartimento_baterias?: string;
    foto_lineas_vida?: string;
    foto_compartimento_operador?: string;
    foto_pernos_horquillas?: string;
    foto_clamp_opc?: string;
    foto_frente_equipo?: string;
    foto_posterior_equipo?: string;
    foto_kit_aceite?: string;
    checklist_entrega?: any;
}

export interface CreateAccesorioDto {
    id_accesorio: string;
    modelo?: string;
    serial?: string;
    voltaje?: number;
    aditamentos?: string;
}

export const salidasApi = {
    // Obtener todas las salidas
    getAll: async (estado?: string) => {
        const params = estado ? { estado } : {};
        try {
            const response = await tallerApi.get<any>(API_URL, { params });
            if (response.data && response.data.data && Array.isArray(response.data.data)) {
                return response.data.data;
            }
            if (Array.isArray(response.data)) {
                return response.data;
            }
            return [];
        } catch (error) {
            console.error('[SalidasService] getAll failed:', getErrorMessage(error));
            return [];
        }
    },

    // Obtener una salida por ID con detalles y accesorios
    getById: async (id: string) => {
        const response = await tallerApi.get<any>(`${API_URL}/${id}`);
        return response.data?.data || response.data;
    },

    // Obtener equipos disponibles (estado = Ingresado)
    getAvailableEquipos: async () => {
        const response = await tallerApi.get<any>(`${API_URL}/available-equipos`);
        return response.data?.data || response.data || [];
    },

    // Obtener accesorios disponibles (estado_acc = Ingresado)
    getAvailableAccesorios: async () => {
        const response = await tallerApi.get<any>(`${API_URL}/available-accesorios`);
        return response.data?.data || response.data || [];
    },

    // Escanear QR - buscar por serial
    scanSerial: async (serial: string) => {
        const response = await tallerApi.get<any>(`${API_URL}/scan/${serial}`);
        return response.data?.data || response.data;
    },

    // Obtener siguiente folio
    getNextFolio: async () => {
        const response = await tallerApi.get<any>(`${API_URL}/next-folio/generate`);
        return response.data?.data || response.data;
    },

    // Crear una nueva salida
    create: async (data: CreateSalidaDto) => {
        const response = await tallerApi.post<any>(API_URL, data);
        return response.data?.data || response.data;
    },

    // Agregar equipo a la salida
    addDetalle: async (id_salida: string, data: CreateDetalleDto) => {
        const response = await tallerApi.post<any>(`${API_URL}/${id_salida}/detalles`, data);
        return response.data?.data || response.data;
    },

    // Agregar accesorio a la salida
    addAccesorio: async (id_salida: string, data: CreateAccesorioDto) => {
        const response = await tallerApi.post<any>(`${API_URL}/${id_salida}/accesorios`, data);
        return response.data?.data || response.data;
    },

    // Quitar equipo de la salida
    removeDetalle: async (id_salida: string, id_detalle: string) => {
        const response = await tallerApi.delete<any>(`${API_URL}/${id_salida}/detalles/${id_detalle}`);
        return response.data?.data || response.data;
    },

    // Quitar accesorio de la salida
    removeAccesorio: async (id_salida: string, id_accesorio: string) => {
        const response = await tallerApi.delete<any>(`${API_URL}/${id_salida}/accesorios/${id_accesorio}`);
        return response.data?.data || response.data;
    },

    // Actualizar remisión y cambiar estado
    updateRemision: async (id: string, remision: string) => {
        const response = await tallerApi.patch<any>(`${API_URL}/${id}/remision`, { remision });
        return response.data?.data || response.data;
    },

    // Cerrar folio
    cerrarFolio: async (id: string) => {
        const response = await tallerApi.patch<any>(`${API_URL}/${id}/cerrar`);
        return response.data?.data || response.data;
    },

    // Actualizar una salida (patch)
    update: async (id: string, data: UpdateSalidaDto) => {
        const response = await tallerApi.patch<any>(`${API_URL}/${id}`, data);
        return response.data?.data || response.data;
    },

    // Eliminar una salida
    delete: async (id: string) => {
        const response = await tallerApi.delete<any>(`${API_URL}/${id}`);
        return response.data?.data || response.data;
    },

    // Obtener detalles de una salida (legacy support if needed)
    getDetalles: async (id: string) => {
        const response = await tallerApi.get<any>(`${API_URL}/${id}/detalles`);
        return response.data?.data || response.data || [];
    },

    // Salida rápida (crea salida + detalle + retira equipo + libera sub-ubicación en una sola llamada)
    createRapida: async (data: {
        folio?: string;
        fecha: string;
        cliente?: string;
        destino?: string;
        numero_serie: string;
        remision?: string;
    }) => {
        const response = await tallerApi.post<any>(`${API_URL}/rapida`, data);
        return response.data?.data || response.data;
    },

    // Enviar correos
    sendMail: async (data: { tipo: 'Entrada' | 'Salida', folio: string, fecha: string, site?: string, pdfBase64?: string, excelBase64?: string, remision?: string }) => {
        const response = await tallerApi.post<any>('/taller-r1/mail/entradas-salidas', data);
        return response.data?.data || response.data;
    },

    // Cancelar equipo de salida cerrada
    cancelarDetalle: async (id_salida: string, id_detalle: string, id_ubicacion_nueva: string, id_sub_ubicacion_nueva: string, usuario: string) => {
        const response = await tallerApi.post<any>(`${API_URL}/${id_salida}/detalles/${id_detalle}/cancelar`, {
            id_ubicacion: id_ubicacion_nueva,
            id_sub_ubicacion: id_sub_ubicacion_nueva,
            usuario
        });
        return response.data?.data || response.data;
    }
};
