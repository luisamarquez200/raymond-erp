import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { toast } from "sonner";
import { useOrganizationStore } from "@/store/organization.store";
import { useAuthStore } from "@/store/auth.store";

export interface User {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string | null;
    role: {
        id: string;
        name: string;
    };
    ubicacion?: string;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
    adcAsociadoName?: string;
    supervisorId?: string;
    supervisorName?: string;
    auxiliarId?: string;
    auxiliarName?: string;
}

export interface CreateUserDto {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    roleId: string;
    ubicacion?: string;
    adcAsociadoName?: string;
    supervisorId?: string;
    supervisorName?: string;
    auxiliarId?: string;
    auxiliarName?: string;
}

export interface UpdateUserDto {
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    roleId?: string;
    isActive?: boolean;
    avatarUrl?: string;
    ubicacion?: string;
    adcAsociadoName?: string;
    supervisorId?: string;
    supervisorName?: string;
    auxiliarId?: string;
    auxiliarName?: string;
}

export function useUsers() {
    const { currentOrganization } = useOrganizationStore();
    // CRITICAL: Include organizationId in cache key to prevent cross-org cache pollution
    return useQuery<User[]>({
        queryKey: ["users", currentOrganization?.id],
        queryFn: async () => {
            const response = await api.get("/users");
            const body = response.data;

            // Handle different response structures
            let rawUsers: any[] = [];
            if (Array.isArray(body)) {
                rawUsers = body;
            } else if (body?.data && Array.isArray(body.data)) {
                rawUsers = body.data;
            } else if (body?.success && Array.isArray(body.data)) {
                rawUsers = body.data;
            }

            // Transform snake_case to camelCase
            return rawUsers.map((user: any) => ({
                id: user.id,
                email: user.email,
                firstName: user.first_name || user.firstName,
                lastName: user.last_name || user.lastName,
                avatarUrl: user.avatar_url || user.avatarUrl,
                role: user.roles || user.role,
                ubicacion: user.ubicacion,
                isActive: user.is_active !== undefined ? user.is_active : user.isActive,
                createdAt: user.created_at || user.createdAt,
                updatedAt: user.updated_at || user.updatedAt,
                adcAsociadoName: user.adc_asociado_name || user.adcAsociadoName,
                supervisorId: user.supervisor_id || user.supervisorId,
                supervisorName: user.supervisor_name || user.supervisorName,
                auxiliarId: user.auxiliar_id || user.auxiliarId,
                auxiliarName: user.auxiliar_name || user.auxiliarName,
            }));
        },
    });
}

export function useUser(id: string) {
    const { currentOrganization } = useOrganizationStore();
    const { user } = useAuthStore();
    // CRITICAL: Include organizationId in cache key to prevent cross-org cache pollution
    return useQuery<User>({
        queryKey: ["user", currentOrganization?.id, id],
        queryFn: async () => {
            const endpoint = id === user?.id ? `/users/me` : `/users/${id}`;
            const response = await api.get(endpoint);
            const rawUser = response.data?.data || response.data;

            // Transform snake_case to camelCase
            return {
                id: rawUser.id,
                email: rawUser.email,
                firstName: rawUser.first_name || rawUser.firstName,
                lastName: rawUser.last_name || rawUser.lastName,
                avatarUrl: rawUser.avatar_url || rawUser.avatarUrl,
                role: rawUser.roles || rawUser.role,
                ubicacion: rawUser.ubicacion,
                isActive: rawUser.is_active !== undefined ? rawUser.is_active : rawUser.isActive,
                createdAt: rawUser.created_at || rawUser.createdAt,
                updatedAt: rawUser.updated_at || rawUser.updatedAt,
                adcAsociadoName: rawUser.adc_asociado_name || rawUser.adcAsociadoName,
                supervisorId: rawUser.supervisor_id || rawUser.supervisorId,
                supervisorName: rawUser.supervisor_name || rawUser.supervisorName,
                auxiliarId: rawUser.auxiliar_id || rawUser.auxiliarId,
                auxiliarName: rawUser.auxiliar_name || rawUser.auxiliarName,
            };
        },
        enabled: !!id,
    });
}

export function useCreateUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreateUserDto) => {
            // Transform camelCase to snake_case for backend
            const payload = {
                email: data.email,
                password: data.password,
                first_name: data.firstName,
                last_name: data.lastName,
                role_id: data.roleId,
                ubicacion: data.ubicacion,
                adc_asociado_name: data.adcAsociadoName,
                supervisor_id: data.supervisorId,
                supervisor_name: data.supervisorName,
                auxiliar_id: data.auxiliarId,
                auxiliar_name: data.auxiliarName,
            };
            const response = await api.post("/users", payload);
            return response.data?.data || response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
            // CRITICAL: Also invalidate by orgId to ensure proper cache clearing
            const orgId = useOrganizationStore.getState().currentOrganization?.id;
            if (orgId) {
                queryClient.invalidateQueries({ queryKey: ["users", orgId] });
            }
            toast.success("Usuario creado exitosamente");
        },
        onError: (error: any) => {
            const message = error.response?.data?.message || "Error al crear usuario";
            toast.error(message);
        },
    });
}

export function useUpdateUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: UpdateUserDto }) => {
            // Transform camelCase to snake_case for backend
            const payload: any = {};
            if (data.email !== undefined) payload.email = data.email;
            if (data.password !== undefined) payload.password = data.password;
            if (data.firstName !== undefined) payload.first_name = data.firstName;
            if (data.lastName !== undefined) payload.last_name = data.lastName;
            if (data.roleId !== undefined) payload.role_id = data.roleId;
            if (data.isActive !== undefined) payload.is_active = data.isActive;
            if (data.avatarUrl !== undefined) payload.avatar_url = data.avatarUrl;
            if (data.ubicacion !== undefined) payload.ubicacion = data.ubicacion;
            if (data.adcAsociadoName !== undefined) payload.adc_asociado_name = data.adcAsociadoName;
            if (data.supervisorId !== undefined) payload.supervisor_id = data.supervisorId;
            if (data.supervisorName !== undefined) payload.supervisor_name = data.supervisorName;
            if (data.auxiliarId !== undefined) payload.auxiliar_id = data.auxiliarId;
            if (data.auxiliarName !== undefined) payload.auxiliar_name = data.auxiliarName;

            const response = await api.patch(`/users/${id}`, payload);
            return response.data?.data || response.data;
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
            queryClient.invalidateQueries({ queryKey: ["user", variables.id] });
            toast.success("Usuario actualizado exitosamente");
        },
        onError: (error: any) => {
            const message = error.response?.data?.message || "Error al actualizar usuario";
            toast.error(message);
        },
    });
}

export function useDeleteUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const response = await api.delete(`/users/${id}`);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
            toast.success("Usuario eliminado exitosamente");
        },
        onError: (error: any) => {
            const message = error.response?.data?.message || "Error al eliminar usuario";
            toast.error(message);
        },
    });
}
