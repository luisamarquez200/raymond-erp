import tallerApi from '@/lib/api-taller';

const API_URL = '/taller-r1/evaluaciones';

export const evaluacionesApi = {
    saveEquipoEvaluation: async (data: any) => {
        const response = await tallerApi.post(`${API_URL}/equipo`, data);
        return response.data;
    },
    getEquipoEvaluation: async (id_detalle: string) => {
        const response = await tallerApi.get(`${API_URL}/equipo/${id_detalle}`);
        return response.data?.data;
    },
    saveAccesorioEvaluation: async (data: any) => {
        const response = await tallerApi.post(`${API_URL}/accesorio`, data);
        return response.data;
    },
    getAccesorioEvaluation: async (id_accesorio: string) => {
        const response = await tallerApi.get(`${API_URL}/accesorio/${id_accesorio}`);
        return response.data?.data;
    },
    registerCharge: async (id_accesorio: string, comentarios?: string, fecha_carga?: string) => {
        const response = await tallerApi.post(`${API_URL}/accesorio/${id_accesorio}/carga`, { comentarios, fecha_carga });
        return response.data;
    },
    getChargeHistory: async (id_accesorio: string) => {
        const response = await tallerApi.get(`${API_URL}/accesorio/${id_accesorio}/historial-cargas`);
        return response.data?.data || [];
    },
    getEvaluationById: async (id: string) => {
        const response = await tallerApi.get(`/taller-r1/evaluaciones/detalle/${id}`);
        return response.data?.data || response.data;
    },

    getHistoryBySerial: async (serial: string) => {
        if (!serial) return [];
        const encodedSerial = encodeURIComponent(serial);
        const response = await tallerApi.get(`/taller-r1/evaluaciones/historial-equipo/${encodedSerial}`);
        return response.data?.data || response.data || [];
    },


    getAllEquiposEvaluations: async () => {
        const response = await tallerApi.get('/taller-r1/evaluaciones/todos-equipos');
        return response.data?.data || response.data || [];
    },

    getPendingEquipos: async () => {
        const response = await tallerApi.get('/taller-r1/evaluaciones/equipos-pendientes');
        return response.data?.data || response.data || [];
    },

    bulkGenericR1: async () => {
        const response = await tallerApi.post(`${API_URL}/bulk-generic-r1`);
        return response.data;
    }
};

export const mantenimientoApi = {
    getAlertas: async () => {
        const response = await tallerApi.get('/taller-r1/mantenimiento/alertas');
        return response.data;
    }
};
