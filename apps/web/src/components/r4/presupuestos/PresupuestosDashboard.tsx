import React from 'react';
import PresupuestosFilters from './PresupuestosFilters';
import SummaryCards from './SummaryCards';
import AdcComplianceTable from './AdcComplianceTable';
import PendingAccumulatedTable from './PendingAccumulatedTable';
import PedidosDelMesTable from './PedidosDelMesTable';
import TotalPorClienteTable from './TotalPorClienteTable';
import ObservacionesSection from './ObservacionesSection';

interface PresupuestosDashboardProps {
    data: any;
    filters: any;
    setFilters: (filters: any) => void;
    onSearch: () => void;
    onReset?: () => void;
    activeMoneda: string;
    isSearching?: boolean;
}

export default function PresupuestosDashboard({ data, filters, setFilters, onSearch, onReset, activeMoneda, isSearching }: PresupuestosDashboardProps) {
    if (!data || !data.stats) return null;

    const currentMoneda = activeMoneda || filters.moneda;
    const currentStats = currentMoneda === 'MXN' ? data.stats.MXN : data.stats.USD;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <PresupuestosFilters filters={filters} setFilters={setFilters} onSearch={onSearch} onReset={onReset} isSearching={isSearching} />

            <SummaryCards stats={currentStats} moneda={currentMoneda} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <div className="space-y-6">
                    <AdcComplianceTable data={data.cumplimiento_por_adc} />
                    <PendingAccumulatedTable data={data.pendiente_acumulado} moneda={currentMoneda} />
                </div>
                <div className="space-y-6">
                    <TotalPorClienteTable data={data.total_por_cliente} moneda={currentMoneda} />
                    <PedidosDelMesTable 
                        title="Pedidos Enviados del Mes"
                        data={data.pedidos_del_mes} 
                        moneda={currentMoneda} 
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <PedidosDelMesTable 
                    title="Recuperación de Meses Anteriores"
                    data={data.recuperacion_meses_anteriores} 
                    moneda={currentMoneda} 
                />
                <ObservacionesSection observaciones={data.observaciones} />
            </div>
        </div>
    );
}
