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
}

export default function PresupuestosDashboard({ data, filters, setFilters }: PresupuestosDashboardProps) {
    if (!data || !data.stats) return null;

    const currentStats = filters.moneda === 'MXN' ? data.stats.MXN : data.stats.USD;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <PresupuestosFilters filters={filters} setFilters={setFilters} />

            <SummaryCards stats={currentStats} moneda={filters.moneda} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <div className="space-y-6">
                    <AdcComplianceTable data={data.cumplimiento_por_adc} />
                    <PendingAccumulatedTable data={data.pendiente_acumulado} moneda={filters.moneda} />
                </div>
                <div className="space-y-6">
                    <TotalPorClienteTable data={data.total_por_cliente} moneda={filters.moneda} />
                    <PedidosDelMesTable 
                        title="Pedidos Enviados del Mes"
                        data={data.pedidos_del_mes} 
                        moneda={filters.moneda} 
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <PedidosDelMesTable 
                    title="Recuperación de Meses Anteriores"
                    data={data.recuperacion_meses_anteriores} 
                    moneda={filters.moneda} 
                />
                <ObservacionesSection observaciones={data.observaciones} />
            </div>
        </div>
    );
}
