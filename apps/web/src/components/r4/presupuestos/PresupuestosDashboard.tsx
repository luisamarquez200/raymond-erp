import React, { useState } from 'react';
import PresupuestosFilters from './PresupuestosFilters';
import SummaryCards from './SummaryCards';
import PresupuestosMasterTable from './PresupuestosMasterTable';
import PedidosDelMesTable from './PedidosDelMesTable';
import ObservacionesSection from './ObservacionesSection';
import EgresosDashboard from './EgresosDashboard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowDownRight, ArrowUpRight, ShieldCheck, DollarSign } from 'lucide-react';

interface PresupuestosDashboardProps {
    data: any;
    filters: any;
    setFilters: (filters: any) => void;
    onSearch: () => void;
    onReset?: () => void;
    activeMoneda: string;
    isSearching?: boolean;
    canEditFacturado?: boolean;
    onFacturadoSaved?: () => void;
}

export default function PresupuestosDashboard({ 
    data, 
    filters, 
    setFilters, 
    onSearch, 
    onReset, 
    activeMoneda, 
    isSearching,
    canEditFacturado,
    onFacturadoSaved,
}: PresupuestosDashboardProps) {
    const [activeTab, setActiveTab] = useState<'ingresos' | 'egresos'>('ingresos');

    if (!data || !data.stats) return null;

    const currentMoneda = activeMoneda || filters.moneda;
    const currentStats = currentMoneda === 'MXN' ? data.stats.MXN : data.stats.USD;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-full">
            
            {/* Filters Bar */}
            <PresupuestosFilters 
                filters={filters} 
                setFilters={setFilters} 
                onSearch={onSearch} 
                onReset={onReset} 
                isSearching={isSearching} 
            />

            {/* Main Module Tabs Switcher: Ingresos vs Egresos */}
            <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'ingresos' | 'egresos')} className="w-full">
                <TabsList className="bg-slate-100 p-1 rounded-2xl h-12 w-full max-w-md grid grid-cols-2 mb-6 shadow-2xs">
                    <TabsTrigger 
                        value="ingresos" 
                        className="rounded-xl font-bold text-xs flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all"
                    >
                        <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                        Ingresos (Facturación)
                    </TabsTrigger>
                    <TabsTrigger 
                        value="egresos" 
                        className="rounded-xl font-bold text-xs flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all"
                    >
                        <ArrowDownRight className="w-4 h-4 text-rose-600" />
                        Egresos (Pago a Terceros)
                    </TabsTrigger>
                </TabsList>

                {/* Tab 1: Ingresos (Facturación & Rentas) */}
                <TabsContent value="ingresos" className="space-y-6 m-0">
                    <SummaryCards 
                        stats={currentStats} 
                        moneda={currentMoneda} 
                        tipoCambio={data.tipo_cambio}
                        canEditFacturado={canEditFacturado}
                        activeFilters={filters}
                        onFacturadoSaved={onFacturadoSaved}
                    />

                    {/* Master Consolidated Table */}
                    <PresupuestosMasterTable data={data.tabla_maestra || []} moneda={currentMoneda} />

                    {/* Secondary Row: Orders sent this month & Observaciones */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                        <PedidosDelMesTable 
                            title="Pedidos Enviados del Mes"
                            data={data.pedidos_del_mes} 
                            moneda={currentMoneda} 
                        />
                        <ObservacionesSection observaciones={data.observaciones} />
                    </div>
                </TabsContent>

                {/* Tab 2: Egresos (Pago a Terceros & SMP) */}
                <TabsContent value="egresos" className="m-0">
                    <EgresosDashboard data={data.egresos} moneda={currentMoneda} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
