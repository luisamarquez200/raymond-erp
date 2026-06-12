'use client';

import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar, AreaChart, Area
} from 'recharts';
import { 
  Calendar, CircleDollarSign,
  TrendingUp, DollarSign, Truck, Receipt,
  User, Briefcase, Percent, CheckCircle2, Clock, ShieldCheck, ArrowUpRight
} from 'lucide-react';
import api from '@/lib/api';

// --- FALLBACK MOCK DATA ---
const donutChartData = [
  { name: 'Activos Rentados', value: 165, color: '#dc2626' },
  { name: 'Activos Inactivos', value: 15, color: '#525252' },
  { name: 'Back Up', value: 8, color: '#f59e0b' },
  { name: 'Inactivo con cliente', value: 2, color: '#171717' },
];

const barChartData = [
  { month: 'Ene', facturado: 28000, presupuesto: 25000 },
  { month: 'Feb', facturado: 31000, presupuesto: 30000 },
  { month: 'Mar', facturado: 34000, presupuesto: 34000 },
  { month: 'Abr', facturado: 37000, presupuesto: 36000 },
  { month: 'May', facturado: 34000, presupuesto: 36000 },
  { month: 'Jun', facturado: 40000, presupuesto: 38000 },
];

export default function R4DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        setApiError(null);
        const res = await api.get('/r4/dashboard/metrics');
        console.log('[Dashboard] Raw API response:', res.data);
        const data = res.data?.data || res.data;
        console.log('[Dashboard] Parsed metrics:', data);
        setMetrics(data);
      } catch (error: any) {
        console.error('[Dashboard] Error fetching metrics:', error?.response?.data || error?.message || error);
        setApiError(error?.response?.data?.message || error?.message || 'Error al cargar métricas');
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  // Derived values from metrics
  const totalActivos = Number(
    metrics?.flotillaStatus
      ? Object.values(metrics.flotillaStatus as Record<string, number>)
          .reduce((a, b) => a + b, 0)
      : 0
  );

  const dynamicDonutData = [
    { name: 'En Renta / Activo', value: metrics?.flotillaStatus?.activosRentados || 0, color: '#dc2626' },
    { name: 'Mantenimiento / Inactivo c/ Cliente', value: metrics?.flotillaStatus?.mantenimiento || 0, color: '#f59e0b' },
    { name: 'Disponibles / Back Up', value: metrics?.flotillaStatus?.backUp || 0, color: '#3b82f6' },
    { name: 'Inactivos', value: metrics?.flotillaStatus?.inactivos || 0, color: '#525252' },
  ].filter(d => d.value > 0);

  const displayDonutData = totalActivos > 0 ? dynamicDonutData : donutChartData;
  const barChartRealData = metrics?.historialFacturacion?.length > 0 ? metrics.historialFacturacion : barChartData;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col items-center gap-6 max-w-sm w-full animate-in fade-in zoom-in duration-500">
          <div className="relative w-24 h-24">
             <div className="absolute inset-0 border-4 border-red-50 rounded-full"></div>
             <div className="absolute inset-0 border-4 border-[#E1000F] rounded-full border-t-transparent animate-spin"></div>
             <Truck className="absolute inset-0 m-auto w-10 h-10 text-[#E1000F] animate-pulse" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Procesando datos</h2>
            <p className="text-sm font-medium text-slate-500 mt-1">Calculando métricas de tu flotilla...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-12">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sticky top-0 z-20">
        <div>
          <span className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] mb-1 block">RAYMOND</span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Dashboard Ejecutivo</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Vista estratégica y desempeño de flotilla</p>
        </div>
      </div>

      <div className="px-8 max-w-[1600px] mx-auto mt-6 space-y-6">

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Total activos */}
          <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-lg hover:-translate-y-1 transition-all">
            <div className="absolute top-0 right-0 p-6 opacity-10 text-slate-900 group-hover:scale-110 transition-transform">
              <Truck className="w-20 h-20 text-slate-400" />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-slate-50 text-slate-600 rounded-2xl group-hover:bg-slate-100 transition-colors">
                <Truck className="w-6 h-6" />
              </div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total de Activos</p>
            </div>
            <h3 className="text-4xl font-black text-slate-900 mt-2 relative z-10">{totalActivos || '--'}</h3>
            <p className="text-[11px] text-slate-400 font-semibold mt-3">Equipos registrados en el módulo</p>
          </div>

          {/* Card 2: Pedidos Generados (Totvs) */}
          <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 shadow-sm hover:border-amber-500/30 hover:shadow-lg hover:-translate-y-1 transition-all group relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all">
              <Receipt className="w-24 h-24 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl group-hover:bg-amber-100 group-hover:text-amber-700 transition-colors">
                  <Receipt className="w-6 h-6" />
                </div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pedidos Generados</p>
              </div>
              <h3 className="text-3xl sm:text-4xl font-black text-slate-900 group-hover:text-amber-600 transition-colors">
                {metrics?.pedidosGenerados ?? '--'}
              </h3>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-1 text-[11px] font-bold text-slate-500">
              <div className="flex justify-between items-center">
                <span>Total MXN:</span>
                <span className="text-slate-900 font-black">${metrics?.importePedidosTotvs?.mxn ? metrics.importePedidosTotvs.mxn.toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '0.00'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Total USD:</span>
                <span className="text-emerald-600 font-black">${metrics?.importePedidosTotvs?.usd ? metrics.importePedidosTotvs.usd.toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '0.00'}</span>
              </div>
            </div>
          </div>
          </div>
        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
          {/* Donut Chart */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
            <h3 className="text-lg font-black text-slate-900 mb-6">Distribución por estado de renta</h3>
            <div className="flex-1 relative flex items-center justify-center min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={displayDonutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {displayDonutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-black text-slate-900">{totalActivos}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Activos Totales</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-6">
              {displayDonutData.map((item, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-[11px] font-bold text-slate-600 truncate">{item.name}</span>
                  </div>
                  <span className="text-xs font-black text-slate-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Resumen Órdenes */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
            <h3 className="text-lg font-black text-slate-900 mb-6">Resumen Órdenes</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
              <div className="flex flex-col justify-between p-5 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-100/50 shadow-sm">
                <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider">OCs Registradas</span>
                <span className="text-3xl font-black text-amber-600 mt-2">{metrics?.resumenOrdenes?.totalOc ?? '--'}</span>
                <p className="text-[10px] text-amber-600/70 font-semibold mt-2">Órdenes de Compra únicas en plataforma</p>
              </div>
              <div className="flex flex-col justify-between p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100/50 shadow-sm">
                <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider">Pedidos Totvs</span>
                <span className="text-3xl font-black text-blue-600 mt-2">{metrics?.resumenOrdenes?.totalPedidosTotvs ?? '--'}</span>
                <p className="text-[10px] text-blue-600/70 font-semibold mt-2">Registros de renta en Totvs consolidados</p>
              </div>
            </div>
          </div>

          {/* Presupuesto por ADC por Cliente */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm col-span-1 lg:col-span-2 flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-900">Resumen de Presupuesto por ADC por Cliente</h3>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">Monto de renta correspondiente a equipos con estatus operativo "Activo"</p>
            </div>
            <div className="mt-4 overflow-x-auto overflow-y-auto max-h-[200px] border border-slate-100 rounded-2xl">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 text-[9px] text-slate-500 uppercase tracking-widest border-b border-slate-100 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 font-black">ADC</th>
                    <th className="px-4 py-3 font-black">Cliente</th>
                    <th className="px-4 py-3 font-black text-center">Equipos</th>
                    <th className="px-4 py-3 font-black text-right">Presupuesto MXN</th>
                    <th className="px-4 py-3 font-black text-right">Presupuesto USD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                  {metrics?.presupuestoAdcCliente?.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">No hay equipos activos registrados.</td>
                    </tr>
                  ) : (
                    metrics?.presupuestoAdcCliente?.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-2.5">
                          <span className="text-slate-900 font-black">{item.adc}</span>
                        </td>
                        <td className="px-4 py-2.5 max-w-[150px] truncate">{item.cliente}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md text-[10px]">
                            {item.equiposCount}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-900">
                          ${item.mxn.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-right text-emerald-600">
                          ${item.usd.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Cumplimiento de Cobro de Rentas */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-900">Cumplimiento de Cobro de Rentas</h3>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">Monto de renta facturada/esperada vs. importe recuperado por periodo</p>
            </div>
            <div className="h-[250px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics?.cumplimientoCobro} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} tickFormatter={(val) => "$" + (val / 1000).toFixed(0) + "k"} />
                  <RechartsTooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="esperadoMXN" name="Facturado MXN" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  <Bar dataKey="recuperadoMXN" name="Cobrado MXN" fill="#dc2626" radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-6 pt-6 lg:pt-0">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Desglose de Cobros (MXN)</h4>
            <div className="overflow-y-auto max-h-[250px] space-y-3 pr-2 scrollbar-thin flex-1">
              {metrics?.cumplimientoCobro?.length === 0 ? (
                <p className="text-xs font-bold text-slate-400 py-8 text-center">No hay registros de cobros.</p>
              ) : (
                metrics?.cumplimientoCobro?.map((item: any, idx: number) => (
                  <div key={idx} className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 flex flex-col gap-2 shadow-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-slate-950">{item.mes} {item.periodo.split('-')[0]}</span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${item.porcentajeMXN >= 90 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                        {item.porcentajeMXN.toFixed(1)}% Cobrado
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10.5px] font-bold text-slate-500">
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-slate-400">Esperado</p>
                        <p className="text-slate-800">${item.esperadoMXN.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-slate-400">Cobrado</p>
                        <p className="text-slate-800">${item.recuperadoMXN.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Recuperación de Rentas de Meses Anteriores */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm grid grid-cols-1 lg:grid-cols-3 gap-6 pb-6">
          <div className="lg:col-span-2 flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-900">Recuperación de Rentas de Meses Anteriores</h3>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">Recuperación e importe cobrado de rentas vencidas de periodos pasados</p>
            </div>
            <div className="h-[250px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics?.recuperacionMesesAnteriores} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorRecup" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ea580c" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#ea580c" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} tickFormatter={(val) => "$" + (val / 1000).toFixed(0) + "k"} />
                  <RechartsTooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Area type="monotone" dataKey="recuperadoMXN" name="Recuperado MXN" stroke="#ea580c" fillOpacity={1} fill="url(#colorRecup)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-6 pt-6 lg:pt-0">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Histórico de Recuperación (MXN)</h4>
            <div className="overflow-y-auto max-h-[250px] space-y-3 pr-2 scrollbar-thin flex-1">
              {metrics?.recuperacionMesesAnteriores?.length === 0 ? (
                <p className="text-xs font-bold text-slate-400 py-8 text-center">No hay cartera vencida recuperada registrada.</p>
              ) : (
                metrics?.recuperacionMesesAnteriores?.map((item: any, idx: number) => (
                  <div key={idx} className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 flex flex-col gap-2 shadow-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-slate-950">{item.mes} {item.periodo.split('-')[0]}</span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-100`}>
                        {item.porcentajeMXN.toFixed(1)}% Recup.
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10.5px] font-bold text-slate-500">
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-slate-400">Total Facturado</p>
                        <p className="text-slate-800">${item.esperadoMXN.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-slate-400">Total Recuperado</p>
                        <p className="text-slate-800">${item.recuperadoMXN.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

