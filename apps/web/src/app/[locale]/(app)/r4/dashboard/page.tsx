'use client';

import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar
} from 'recharts';
import { 
  Calendar, CircleDollarSign,
  TrendingUp, DollarSign, Truck, Receipt
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
  { month: 'Ene', facturado: 2.8, presupuesto: 2.5 },
  { month: 'Feb', facturado: 3.1, presupuesto: 3.0 },
  { month: 'Mar', facturado: 3.4, presupuesto: 3.4 },
  { month: 'Abr', facturado: 3.7, presupuesto: 3.6 },
  { month: 'May', facturado: 3.4, presupuesto: 3.6 },
  { month: 'Jun', facturado: 4.0, presupuesto: 3.8 },
];

const lineChartData = [
  { month: 'Ene', facturado: 2.8 },
  { month: 'Feb', facturado: 3.1 },
  { month: 'Mar', facturado: 3.4 },
  { month: 'Abr', facturado: 3.7 },
  { month: 'May', facturado: 3.4 },
  { month: 'Jun', facturado: 4.0 },
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
  const totalActivos = metrics?.flotillaStatus
    ? Object.values(metrics.flotillaStatus).reduce((a: any, b: any) => a + b, 0)
    : 0;

  const dynamicDonutData = [
    { name: 'En Renta / Activo', value: metrics?.flotillaStatus?.activosRentados || 0, color: '#dc2626' },
    { name: 'Mantenimiento / Inactivo c/ Cliente', value: metrics?.flotillaStatus?.mantenimiento || 0, color: '#f59e0b' },
    { name: 'Disponibles / Back Up', value: metrics?.flotillaStatus?.backUp || 0, color: '#3b82f6' },
    { name: 'Inactivos', value: metrics?.flotillaStatus?.inactivos || 0, color: '#525252' },
  ].filter(d => d.value > 0);

  const displayDonutData = totalActivos > 0 ? dynamicDonutData : donutChartData;
  const barChartRealData = metrics?.historialFacturacion?.length > 0 ? metrics.historialFacturacion : barChartData;
  const lineChartRealData = metrics?.historialFacturacion?.length > 0 ? metrics.historialFacturacion : lineChartData;

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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {/* Card 1: Total activos */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 p-6 opacity-10 text-slate-900 group-hover:scale-110 transition-transform">
              <Truck className="w-20 h-20" />
            </div>
            <p className="text-sm font-bold text-[#64748B] relative z-10">Total de Activos</p>
            <h3 className="text-4xl font-black text-slate-900 mt-2 relative z-10">{totalActivos || '--'}</h3>
          </div>

          {/* Card 2: Órdenes generadas */}
          <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 shadow-sm hover:border-amber-500/30 hover:shadow-lg hover:-translate-y-1 transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all">
              <CircleDollarSign className="w-24 h-24 text-amber-600" />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl group-hover:bg-amber-100 group-hover:text-amber-700 transition-colors">
                <Receipt className="w-6 h-6" />
              </div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Órdenes Generadas</p>
            </div>
            <h3 className="text-3xl sm:text-4xl font-black text-slate-900 group-hover:text-amber-600 transition-colors">
              {metrics?.ordenesGeneradas ?? '--'}
            </h3>
          </div>

          {/* Card 3: Monto facturado */}
          <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 shadow-sm hover:border-blue-500/30 hover:shadow-lg hover:-translate-y-1 transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all">
              <DollarSign className="w-24 h-24 text-blue-600" />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
                <TrendingUp className="w-6 h-6" />
              </div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-tight">
                Monto Facturado<br />
                <span className="text-amber-500">{metrics?.periodoActual || 'Mes Actual'}</span>
              </p>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">
              ${metrics?.montoMesActual
                ? metrics.montoMesActual.toLocaleString('es-MX', { minimumFractionDigits: 2 })
                : '0.00'}
            </h3>
          </div>

          {/* Card 4: Órdenes del mes */}
          <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 shadow-sm hover:border-emerald-500/30 hover:shadow-lg hover:-translate-y-1 transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all">
              <Calendar className="w-24 h-24 text-emerald-600" />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors">
                <Calendar className="w-6 h-6" />
              </div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-tight">
                Órdenes del Mes<br />
                <span className="text-amber-500">{metrics?.periodoActual || 'Mes Actual'}</span>
              </p>
            </div>
            <h3 className="text-3xl sm:text-4xl font-black text-slate-900 group-hover:text-emerald-600 transition-colors">
              {metrics?.ordenesMesActual ?? '--'}
            </h3>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Historial de Facturación */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm col-span-1 lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-slate-900">Historial de Facturación por Periodo</h3>
              <div className="flex items-center gap-4 text-sm font-bold">
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-orange-600"></div> Facturado</div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div> Presupuesto</div>
              </div>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartRealData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`} />
                  <RechartsTooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="facturado" name="Facturado" fill="#ea580c" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="presupuesto" name="Presupuesto" fill="#cbd5e1" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
          {/* Activos por ADC */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-slate-900">Activos por Ejecutivo de Cuenta (ADC)</h3>
            </div>
            <div className="flex-1 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartRealData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`} />
                  <RechartsTooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="facturado" name="Facturado" fill="#ea580c" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="presupuesto" name="Presupuesto" fill="#cbd5e1" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* POs Activas */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
            <h3 className="text-lg font-black text-slate-900 mb-6">Resumen Órdenes</h3>
            <div className="space-y-4 mt-2">
              <div className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <span className="text-sm font-bold text-amber-700">POs Activas</span>
                <span className="text-2xl font-black text-amber-600">{metrics?.poActivas ?? '--'}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                <span className="text-sm font-bold text-emerald-700">Órdenes Totales</span>
                <span className="text-2xl font-black text-emerald-600">{metrics?.ordenesGeneradas ?? '--'}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <span className="text-sm font-bold text-blue-700">Órdenes del Periodo</span>
                <span className="text-2xl font-black text-blue-600">{metrics?.ordenesMesActual ?? '--'}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
