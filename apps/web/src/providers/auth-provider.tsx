'use client';

import { useEffect } from 'react';
import { useAuthStore } from '../store/auth.store';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const restoreSession = useAuthStore((state) => state.restoreSession);
    const signOut = useAuthStore((state) => state.signOut);

    useEffect(() => {
        // Restore session on mount
        restoreSession();

        // Add confirmation dialog before reload/close
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            // Standard confirmation message
            e.preventDefault();
            e.returnValue = '';
            return '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [restoreSession]);

    return <>{children}</>;
}
