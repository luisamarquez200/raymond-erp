import api from '@/lib/api';

export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    organizationId: string | null; // CRITICAL: Nullable for global SuperAdmin
    isSuperadmin?: boolean; // CRITICAL: Flag for SuperAdmin global users
    avatarUrl?: string;
    sitio?: string;
}

export interface AuthResponse {
    user: User;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

// Helper to transform backend user data (snake_case) to frontend format (camelCase)
const transformUserData = (backendUser: any): User => {
    return {
        id: backendUser.id,
        email: backendUser.email,
        firstName: backendUser.first_name || backendUser.firstName,
        lastName: backendUser.last_name || backendUser.lastName,
        role: backendUser.roles || backendUser.role, // Backend uses 'roles', frontend expects 'role'
        organizationId: backendUser.organization_id || backendUser.organizationId,
        isSuperadmin: backendUser.isSuperadmin,
        avatarUrl: backendUser.avatarUrl,
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
