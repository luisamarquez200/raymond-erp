'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import PresupuestosDashboard from '@/components/r4/presupuestos/PresupuestosDashboard';
import { Loader2 } from 'lucide-react';
import dayjs from 'dayjs';

export default function PresupuestosPage() {
    const { accessToken } = useAuthStore();
    const currentDate = dayjs();
    const [filters, setFilters] = useState({
        year: currentDate.year().toString(),
        month: (currentDate.month() + 1).toString(),
        cliente_id: '',
        sitio_id: '',
        adc: '',
        moneda: 'MXN' // Default view
    });

    const { data: dashboardData, isLoading, error } = useQuery({
        queryKey: ['presupuestos-dashboard', filters],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters.year) params.append('year', filters.year);
            if (filters.month) params.append('month', filters.month);
            if (filters.cliente_id) params.append('cliente_id', filters.cliente_id);
            if (filters.sitio_id) params.append('sitio_id', filters.sitio_id);
            if (filters.adc) params.append('adc', filters.adc);
            if (filters.moneda) params.append('moneda', filters.moneda);

            const res = await api.get(`/r4/presupuestos/dashboard?${params.toString()}`);
            return res.data?.data || res.data;
        },
        enabled: !!accessToken,
    });

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

            {isLoading ? (
                <div className="w-full h-64 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
                </div>
            ) : error ? (
                <div className="w-full p-4 bg-red-50 text-red-600 rounded-lg">
                    Error cargando la información presupuestal.
                </div>
            ) : (
                <PresupuestosDashboard 
                    data={dashboardData} 
                    filters={filters}
                    setFilters={setFilters}
                />
            )}
        </div>
    );
}
