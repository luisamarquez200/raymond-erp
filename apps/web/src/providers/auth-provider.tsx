'use client';

import { useEffect } from 'react';
import { useAuthStore } from '../store/auth.store';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const restoreSession = useAuthStore((state) => state.restoreSession);

    useEffect(() => {
        // Restore session on mount
        restoreSession();
    }, [restoreSession]);

    return <>{children}</>;
}
