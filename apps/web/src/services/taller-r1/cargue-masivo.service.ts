import tallerApi from '@/lib/api-taller';

export interface OrdenBaseCargue {
    id: number;
    estatus?: string;
    entering_dealer?: number;
    receiving_dealer?: number;
    model?: string;
    sales_order2?: string;
    dealer_po?: string;
    quote_number?: string;
    qty_on_order?: number;
    ord_entry_date?: string;
    curr_ship_date?: string;
    serial_numbers_raw?: string;
    serial_number?: string;
    operacion?: string;
    razon_social_registro?: string;
    unidad_venta?: string;
    cliente_final?: string;
    qty?: number;
    modelo?: string;
    mastil?: string;
    clase?: string;
    tipo?: string;
    po_number?: string;
    so_number?: string;
    quote?: string;
    serial_lot?: string;
    valor_factura?: string; // Decimal strings
    end_production?: string;
    endofprod_year?: number;
    endofprod_month?: number;
    dia_recibo?: string;
    dias_inventario?: number;
    antiguedad?: number;
    fecha_liberacion?: string;
    folio_liberacion?: string;
    destino?: string;
    folio_factura?: string;
    bol_number?: string;
    semana_importacion?: number;
    mes_importacion?: number;
    anio_importacion?: number;
    destino_importacion?: string;
    referencia_arribo_laredo?: string;
    fecha_arribo_laredo?: string;
    referencia_proforma?: string;
    pedimento?: string;
    fecha_pedimento?: string;
    condicion?: string;
    acondicionado?: string;
    lugar_entrada_piso?: string;
    fecha_entrada_piso?: string;
    fecha_salida_piso?: string;
    ubicacion?: string;
    estatus_operacion?: string;
    operacion2?: string;
    oc?: string;
    responsable?: string;
    comentarios?: string;
    created_at?: string;
}

export const cargueMasivoApi = {
    // Obtener todos los registros
    getAll: async () => {
        const response = await tallerApi.get<any>('/taller-r1/cargue-masivo');
        // La API devuelve { success, data: {...}, timestamp, path }
        // Pero data contiene OTRO objeto { data: [...] }
        console.log('🔍 Servicio - response.data:', response.data);

        let result = response.data?.data || response.data || [];
        console.log('🔍 Servicio - primer nivel:', result);

        // Si result todavía es un objeto con data, extraer una vez más
        if (result && typeof result === 'object' && !Array.isArray(result) && result.data) {
            result = result.data;
            console.log('🔍 Servicio - segundo nivel (array final):', result);
        }

        return Array.isArray(result) ? result : [];
    },

    // Cargar datos (batch)
    uploadData: async (data: any[]) => {
        const response = await tallerApi.post('/taller-r1/cargue-masivo/batch', { data });
        return response.data;
    },

    // Actualizar un registro (inline edit)
    update: async (id: number, data: Partial<OrdenBaseCargue>) => {
        const response = await tallerApi.put<OrdenBaseCargue>(`/taller-r1/cargue-masivo/${id}`, data);
        return response.data;
    },

    // Crear un registro (add row)
    create: async (data: Partial<OrdenBaseCargue>) => {
        const response = await tallerApi.post<OrdenBaseCargue>(`/taller-r1/cargue-masivo`, data);
        return response.data;
    },

    // Eliminar un registro
    delete: async (id: number) => {
        const response = await tallerApi.delete(`/taller-r1/cargue-masivo/${id}`);
        return response.data;
    },

    // Eliminar todos los registros
    deleteAll: async () => {
        const response = await tallerApi.delete('/taller-r1/cargue-masivo/all');
        return response.data;
    },

    // Obtener por número de serie
    getBySerial: async (serial: string) => {
        const response = await tallerApi.get<any>(`/taller-r1/cargue-masivo/serial/${serial}`);
        return response.data?.data || response.data;
    }
};
