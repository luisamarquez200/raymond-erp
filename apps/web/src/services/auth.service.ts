import api from '@/lib/api';

export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    organizationId: string | null; // CRITICAL: Nullable for global SuperAdmin
    isSuperadmin: boolean;
    avatarUrl?: string;
    sitio?: string;
    adc_asociado_id?: string;
    adc_asociado_name?: string;
}

export interface AuthResponse {
    user: User;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

// Helper to transform backend user data (snake_case) to frontend format (camelCase)
const transformUserData = (rawUser: any): User => {
    return {
        id: rawUser.id,
        email: rawUser.email,
        firstName: rawUser.first_name || rawUser.firstName,
        lastName: rawUser.last_name || rawUser.lastName,
        role: rawUser.roles || rawUser.role, // Backend uses 'roles', frontend expects 'role'
        organizationId: rawUser.organization_id || rawUser.organizationId,
        isSuperadmin: rawUser.isSuperadmin,
        avatarUrl: rawUser.avatarUrl || rawUser.avatar_url,
        sitio: rawUser.sitio,
        adc_asociado_id: rawUser.adc_asociado_id,
        adc_asociado_name: rawUser.adc_asociado_name,
    };
};

export const AuthService = {
    login: async (credentials: any): Promise<AuthResponse> => {
        const response = await api.post<{ success: boolean, data: any }>('/auth/login', credentials);
        const backendData = response.data.data;
        return {
            user: transformUserData(backendData.user),
            accessToken: backendData.accessToken,
            refreshToken: backendData.refreshToken,
            expiresIn: backendData.expiresIn,
        };
    },

    register: async (data: any): Promise<AuthResponse> => {
        const response = await api.post<{ success: boolean, data: any }>('/auth/register', data);
        const backendData = response.data.data;
        return {
            user: transformUserData(backendData.user),
            accessToken: backendData.accessToken,
            refreshToken: backendData.refreshToken,
            expiresIn: backendData.expiresIn,
        };
    },

    refreshToken: async (refreshToken: string): Promise<AuthResponse> => {
        const response = await api.post<{ success: boolean, data: any }>('/auth/refresh', { refreshToken });
        const backendData = response.data.data;
        return {
            user: transformUserData(backendData.user),
            accessToken: backendData.accessToken,
            refreshToken: backendData.refreshToken,
            expiresIn: backendData.expiresIn,
        };
    },

    logout: async (refreshToken: string): Promise<void> => {
        await api.post('/auth/logout', { refreshToken });
    },
};
