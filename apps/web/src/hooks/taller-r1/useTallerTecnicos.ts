import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api-taller';
import { toast } from 'sonner';

export interface TallerTecnico {
    id_tecnico: string;
    nombre: string;
    nivel_certificacion: string; // Junior, Tech primer certificado, Senior, Externo
    created_at?: string;
    updated_at?: string;
}

export const useTallerTecnicos = () => {
    return useQuery<TallerTecnico[]>({
        queryKey: ['taller-tecnicos'],
        queryFn: async () => {
            const response = await api.get('/taller-r1/tecnicos');
            const body = response.data;
            if (Array.isArray(body)) return body;
            if (body?.data && Array.isArray(body.data)) return body.data;
            return [];
        },
    });
};

export const useCreateTallerTecnico = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: Partial<TallerTecnico>) => {
            const response = await api.post('/taller-r1/tecnicos', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['taller-tecnicos'] });
            toast.success('Técnico creado exitosamente');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Error al crear técnico');
        },
    });
};

export const useUpdateTallerTecnico = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<TallerTecnico> }) => {
            const response = await api.put(`/taller-r1/tecnicos/${id}`, data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['taller-tecnicos'] });
            toast.success('Técnico actualizado exitosamente');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Error al actualizar técnico');
        },
    });
};

export const useDeleteTallerTecnico = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const response = await api.delete(`/taller-r1/tecnicos/${id}`);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['taller-tecnicos'] });
            toast.success('Técnico eliminado exitosamente');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Error al eliminar técnico');
        },
    });
};
