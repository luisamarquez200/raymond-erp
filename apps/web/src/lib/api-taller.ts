import axios from 'axios';
import { useAuthTallerStore } from '@/store/auth-taller.store';

const tallerApi = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

tallerApi.interceptors.request.use(config => {
    // 1. Get Taller state
    const tallerState = useAuthTallerStore.getState();
    const { useAuthStore } = require('@/store/auth.store');
    const authState = useAuthStore.getState();

    // 2. UNIFIED TOKEN: Priority to taller token, fallback to main ERP token
    const token = tallerState.token || authState.accessToken;

    // 3. UNIFIED USERNAME: Priority to taller username, fallback to main ERP firstName
    const username = tallerState.user?.username || authState.user?.firstName || authState.user?.email?.split('@')[0] || 'Sistema';

    const selectedSite = tallerState.selectedSite;

    console.log('[api-taller] Request to:', config.url);
    console.log('[api-taller] Final Token present:', !!token);
    console.log('[api-taller] Store selectedSite:', selectedSite);

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    if (selectedSite) {
        config.headers['x-site-id'] = selectedSite;
        console.log('[api-taller] Setting x-site-id header to:', selectedSite);
    } else {
        // For common modules like CargueMasivo, we default to R1 if no site selected
        console.log('[api-taller] No selectedSite, backend will default to r1');
    }

    config.headers['x-taller-username'] = username;

    return config;
});

tallerApi.interceptors.response.use(
    (response) => response,
    (error) => {
        const url = error.config?.url || 'unknown';
        const status = error.response?.status;
        const serverMsg = error.response?.data?.message || error.response?.data?.error;

        console.error(`[api-taller] ${status} on ${url}:`, serverMsg || error.message);

        return Promise.reject(error);
    }
);

export default tallerApi;
