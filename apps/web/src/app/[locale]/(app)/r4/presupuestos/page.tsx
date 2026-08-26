'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useConfigStore } from '@/store/config.store';
import { useUser } from '@/hooks/useUsers';
import PresupuestosDashboard from '@/components/r4/presupuestos/PresupuestosDashboard';
import PageLoader from '@/components/ui/PageLoader';
import dayjs from 'dayjs';

export default function PresupuestosPage() {
    const { accessToken, user } = useAuthStore();
    // Cargar perfil fresco del usuario logueado desde la API (para tener adc_asociado_name actualizado)
    const { data: freshUserProfile } = useUser(user?.id || '');
    const { roleColors } = useConfigStore();
    const roleName = typeof user?.role === 'string' ? user.role : (user?.role as any)?.name || '';
    const currentColor = roleName ? (roleColors[roleName.toLowerCase()] || roleColors.administrador) : roleColors.administrador;
    const canEditFacturado = ['gerente', 'administrador', 'admin', 'superadmin'].includes(roleName.toLowerCase());
    const isAdministrator = ['administrador', 'admin', 'superadmin', 'gerente', 'coordinacion', 'coordinador'].some(r => roleName.toLowerCase().includes(r));
    
    // Resolve logged in ADC's assigned/profile name
    const rawAdcAsoc = 
        (freshUserProfile?.adcAsociadoName && freshUserProfile.adcAsociadoName.toLowerCase() !== 'ninguno' ? freshUserProfile.adcAsociadoName : '') ||
        ((user as any)?.adc_asociado_name && (user as any).adc_asociado_name.toLowerCase() !== 'ninguno' ? (user as any).adc_asociado_name : '') || 
        ((user as any)?.adcAsociadoName && (user as any).adcAsociadoName.toLowerCase() !== 'ninguno' ? (user as any).adcAsociadoName : '');

    const userFullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || (user as any)?.name || (user?.email ? user.email.split('@')[0] : '') || '';
    
    const resolvedAdcName = rawAdcAsoc || userFullName;

    const [adminAdcScope, setAdminAdcScope] = useState<'todos' | 'mis_adcs'>('todos');

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
        queryKey: ['presupuestos-dashboard', activeFilters, adminAdcScope, isAdministrator, resolvedAdcName],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (activeFilters.year) params.append('year', activeFilters.year);
            if (activeFilters.month && activeFilters.month.length > 0) params.append('month', activeFilters.month.join(','));
            if (activeFilters.cliente_id) params.append('cliente_id', activeFilters.cliente_id);
            if (activeFilters.sitio_id) params.append('sitio_id', activeFilters.sitio_id);
            if (activeFilters.moneda) params.append('moneda', activeFilters.moneda);

            let adcFilter = activeFilters.adc;

            if (!isAdministrator) {
                // Restricted ADC user: ONLY view information for their own assigned ADC
                adcFilter = resolvedAdcName || 'SIN_ADC_ASIGNADO';
            } else if (adminAdcScope === 'mis_adcs') {
                const rawAdcAsociado = 
                    (freshUserProfile?.adcAsociadoName && freshUserProfile.adcAsociadoName.toLowerCase() !== 'ninguno' ? freshUserProfile.adcAsociadoName : '') ||
                    ((user as any)?.adc_asociado_name && (user as any).adc_asociado_name.toLowerCase() !== 'ninguno' ? (user as any).adc_asociado_name : '') || 
                    ((user as any)?.adcAsociadoName && (user as any).adcAsociadoName.toLowerCase() !== 'ninguno' ? (user as any).adcAsociadoName : '');

                if (rawAdcAsociado) {
                    adcFilter = rawAdcAsociado;
                } else {
                    adcFilter = 'SIN_ADC_ASIGNADO';
                }
            }

            if (adcFilter) params.append('adc', adcFilter);

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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Presupuestos</h1>
                    <p className="text-slate-500 mt-1">
                        Control presupuestal de rentas, acumulados y cumplimiento.
                    </p>
                </div>

                {/* Scope selector for Admins / Badge for ADC */}
                {isAdministrator ? (
                    <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200 shadow-inner">
                        <button
                            type="button"
                            onClick={() => setAdminAdcScope('todos')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                adminAdcScope === 'todos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            Todos los ADC
                        </button>
                        <button
                            type="button"
                            onClick={() => setAdminAdcScope('mis_adcs')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                adminAdcScope === 'mis_adcs' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            Solo mis ADC
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ejecutivo:</span>
                        <span className="text-xs font-black text-slate-800">{resolvedAdcName || user?.email || 'Mi Usuario'}</span>
                    </div>
                )}
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
                    adminAdcScope={adminAdcScope}
                    setAdminAdcScope={setAdminAdcScope}
                />
            )}
        </div>
    );
}
