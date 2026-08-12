'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useConfigStore } from '@/store/config.store';
import PresupuestosDashboard from '@/components/r4/presupuestos/PresupuestosDashboard';
import PageLoader from '@/components/ui/PageLoader';
import dayjs from 'dayjs';

export default function PresupuestosPage() {
    const { accessToken, user } = useAuthStore();
    const { roleColors } = useConfigStore();
    const roleName = typeof user?.role === 'string' ? user.role : (user?.role as any)?.name || '';
    const currentColor = roleName ? (roleColors[roleName.toLowerCase()] || roleColors.administrador) : roleColors.administrador;
    const canEditFacturado = ['gerente', 'administrador', 'admin', 'superadmin'].includes(roleName.toLowerCase());
    const currentDate = dayjs();
    const initialFilters = {
        year: currentDate.year().toString(),
        month: [(currentDate.month() + 1).toString()], // Array for multi-select
        cliente_id: '',
        sitio_id: '',
        adc: '',
        moneda: 'MXN'
    };

    const [draftFilters, setDraftFilters] = useState(initialFilters);
    const [activeFilters, setActiveFilters] = useState(initialFilters);

    const { data: dashboardData, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ['presupuestos-dashboard', activeFilters],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (activeFilters.year) params.append('year', activeFilters.year);
            if (activeFilters.month && activeFilters.month.length > 0) params.append('month', activeFilters.month.join(','));
            if (activeFilters.cliente_id) params.append('cliente_id', activeFilters.cliente_id);
            if (activeFilters.sitio_id) params.append('sitio_id', activeFilters.sitio_id);
            if (activeFilters.adc) params.append('adc', activeFilters.adc);
            if (activeFilters.moneda) params.append('moneda', activeFilters.moneda);

            const res = await api.get(`/r4/presupuestos/dashboard?${params.toString()}`);
            return res.data?.data || res.data;
        },
        enabled: !!accessToken,
        placeholderData: (previousData) => previousData,
    });

    const handleSearch = () => {
        setActiveFilters({ ...draftFilters });
    };

    const handleReset = () => {
        setDraftFilters(initialFilters);
        setActiveFilters(initialFilters);
    };

    const showInitialLoader = isLoading && !dashboardData;

    return (
        <div className="w-full min-h-screen bg-[#F8FAFC] p-4 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Presupuestos</h1>
                    <p className="text-slate-500 mt-1">
                        Control presupuestal de rentas, acumulados y cumplimiento.
                    </p>
                </div>
            </div>

            {showInitialLoader ? (
                <PageLoader 
                    title="Cargando información presupuestal" 
                    subtitle="Calculando acumulados, rentas y cumplimiento de la plataforma..." 
                    color={currentColor}
                />
            ) : error && !dashboardData ? (
                <div className="w-full p-4 bg-red-50 text-red-600 rounded-lg">
                    Error cargando la información presupuestal.
                </div>
            ) : (
                <PresupuestosDashboard 
                    data={dashboardData} 
                    filters={draftFilters}
                    setFilters={setDraftFilters}
                    onSearch={handleSearch}
                    onReset={handleReset}
                    activeMoneda={activeFilters.moneda}
                    isSearching={isFetching}
                    canEditFacturado={canEditFacturado}
                    onFacturadoSaved={() => refetch()}
                />
            )}
        </div>
    );
}
