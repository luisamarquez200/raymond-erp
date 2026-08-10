'use client';

import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, ComposedChart,
} from 'recharts';
import api from '@/lib/api';
import { useConfigStore } from '@/store/config.store';
import { useAuthStore } from '@/store/auth.store';
import { Loader2, Truck, Users, Receipt, TrendingUp, BarChart3, PieChart, Activity } from 'lucide-react';
import TooltipInfo from '@/components/ui/TooltipInfo';

export default function R4DashboardPage() {
  const { user } = useAuthStore();
  const { roleColors } = useConfigStore();
  const currentColor = user?.role ? (roleColors[user.role.toLowerCase()] || roleColors.administrador) : roleColors.administrador;

  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        setApiError(null);
        const res = await api.get('/r4/dashboard/metrics');
        setMetrics(res.data?.data || res.data);
      } catch (error: any) {
        setApiError(error?.response?.data?.message || error?.message || 'Error al cargar métricas');
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col items-center gap-6 max-w-sm w-full animate-in fade-in zoom-in duration-500">
          <div className="relative w-24 h-24">
             <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
             <div className="absolute inset-0 border-4 rounded-full border-t-transparent animate-spin" style={{ borderColor: `${currentColor} transparent` }}></div>
             <Loader2 className="absolute inset-0 m-auto w-10 h-10 animate-pulse" style={{ color: currentColor }} />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Procesando datos</h2>
            <p className="text-sm font-medium text-slate-500 mt-1">Calculando métricas ejecutivas...</p>
          </div>
        </div>
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 text-red-600 font-bold">
        {apiError}
      </div>
    );
  }

  const {
    kpisPrincipales,
    composicionFlotilla,
    presupuestoHistorico,
    cuentas,
    distribucionDistribuidor,
    vencimientosRenta
  } = metrics || {};

  // Helpers
  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)} M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(1)} k`;
    return `$${val.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
  };
  
  const formatCurrencyFull = (val: number) => `$${val.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  // Max values for horizontal bars
  const totalClase = composicionFlotilla?.claseEquipo?.reduce((acc: number, curr: any) => acc + curr.value, 0) || 1;
  const maxClase = Math.max(...(composicionFlotilla?.claseEquipo?.map((c: any) => c.value) || [1]));
  
  const totalAdc = composicionFlotilla?.participacionAdc?.reduce((acc: number, curr: any) => acc + curr.value, 0) || 1;
  const maxAdc = Math.max(...(composicionFlotilla?.participacionAdc?.map((c: any) => c.value) || [1]));

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-12 text-slate-900 font-sans">
      
      {/* Header Estilo ERP */}
      <div className="bg-white border-b border-slate-200 px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sticky top-0 z-20">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 block" style={{ color: currentColor }}>RAYMOND</span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Ejecutivo</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Vista estratégica y datos ejecutivos de flotilla</p>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-8 pt-8">

        {/* SECTION 1: KPIs Principales (4 Tarjetas) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
            {/* Tarjeta 1 */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-lg hover:-translate-y-1 transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-slate-50 text-slate-600 rounded-2xl">
                    <Truck className="w-5 h-5" />
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                    Equipos en flotilla
                    <TooltipInfo text="Inventario total de equipos y montacargas registrados en la flotilla." />
                  </p>
                </div>
                <h3 className="text-3xl font-bold text-slate-900 mt-2">{kpisPrincipales?.equiposFlotilla?.toLocaleString() || 0}</h3>
                <p className="text-[11px] text-slate-400 font-semibold mt-2">Total asignado</p>
            </div>
            
            {/* Tarjeta 2 */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-lg hover:-translate-y-1 transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-slate-50 text-slate-600 rounded-2xl">
                    <Users className="w-5 h-5" />
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                    Cuentas activas
                    <TooltipInfo text="Total de clientes con al menos un contrato o equipo activo en operación." />
                  </p>
                </div>
                <h3 className="text-3xl font-bold text-slate-900 mt-2">{kpisPrincipales?.cuentasActivas?.toLocaleString() || 0}</h3>
                <p className="text-[11px] text-slate-400 font-semibold mt-2">Con equipo o contrato vigente</p>
            </div>

            {/* Tarjeta 3 */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-lg hover:-translate-y-1 transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-slate-50 text-slate-600 rounded-2xl">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                    Pedidos generados
                    <TooltipInfo text="Suma monetaria total de las órdenes colocadas durante el mes corriente." />
                  </p>
                </div>
                <h3 className="text-3xl font-bold text-slate-900 mt-2">{formatCurrency(kpisPrincipales?.pedidosGenerados || 0)}</h3>
                <p className="text-[11px] text-slate-400 font-semibold mt-2">Mes corriente</p>
            </div>

            {/* Tarjeta 4 */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-lg hover:-translate-y-1 transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-slate-50 text-slate-600 rounded-2xl">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                    Avance presupuesto
                    <TooltipInfo text="Porcentaje global de facturación logrado respecto a la meta del mes." />
                  </p>
                </div>
                <h3 className="text-3xl font-bold text-slate-900 mt-2">{(kpisPrincipales?.avancePresupuesto || 0).toFixed(0)}%</h3>
                <p className="text-[11px] text-slate-400 font-semibold mt-2">Mes corriente</p>
            </div>
        </div>

        {/* SECTION 2: Composición de la flotilla (2 Tarjetas anchas) */}
        <div className="mb-10 bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <PieChart className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  Composición de la flotilla
                  <TooltipInfo text="Desglose por tipo/clase de equipos y la cuota de participación por Ejecutivo (ADC)." />
                </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                {/* Clase de equipo */}
                <div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-1">
                      Clase de equipo
                      <TooltipInfo text="Porcentaje de la flotilla dividida por sus distintas categorías y clases operativas." />
                    </h3>
                    <div className="space-y-5">
                        {composicionFlotilla?.claseEquipo?.map((item: any, idx: number) => {
                            const pctTotal = (item.value / totalClase) * 100;
                            const pctWidth = Math.max((item.value / maxClase) * 100, 5); 
                            return (
                                <div key={idx} className="relative">
                                    <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-2">
                                        <span>{item.name}</span>
                                        <span className="text-slate-500">{item.value.toLocaleString()} · {pctTotal.toFixed(0)}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                        <div className="bg-indigo-500 h-full rounded-full transition-all duration-1000" style={{ width: `${pctWidth}%` }}></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Participación por ADC */}
                <div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-1">
                      Participación en volumen por ADC
                      <TooltipInfo text="Proporción del volumen de flotilla administrado por cada Ejecutivo comercial." />
                    </h3>
                    <div className="space-y-5 overflow-y-auto max-h-[300px] pr-4 scrollbar-thin">
                        {composicionFlotilla?.participacionAdc?.map((item: any, idx: number) => {
                            const pctTotal = (item.value / totalAdc) * 100;
                            const pctWidth = Math.max((item.value / maxAdc) * 100, 5);
                            return (
                                <div key={idx} className="relative">
                                    <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-2">
                                        <span>{item.name}</span>
                                        <span className="text-slate-500">{pctTotal.toFixed(0)}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                        <div className="bg-emerald-500 h-full rounded-full transition-all duration-1000" style={{ width: `${pctWidth}%` }}></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>

        {/* SECTION 3: Presupuesto del mes y comportamiento histórico */}
        <div className="mb-10 bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <Activity className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  Presupuesto del mes y comportamiento histórico
                  <TooltipInfo text="Evolución mensual comparativa del objetivo presupuestal frente a lo cubierto y pendientes." />
                </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                      Objetivo del mes
                      <TooltipInfo text="Meta presupuestal fijada para el mes en curso." />
                    </p>
                    <h3 className="text-2xl font-bold text-slate-900">{formatCurrency(presupuestoHistorico?.stats?.objetivo || 0)}</h3>
                </div>
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                      Cubierto del mes
                      <TooltipInfo text="Monto de facturación efectivamente cubierto en el mes." />
                    </p>
                    <h3 className="text-2xl font-bold text-slate-900">{formatCurrency(presupuestoHistorico?.stats?.cubierto || 0)}</h3>
                </div>
                <div className="bg-red-50 p-5 rounded-2xl border border-red-100">
                    <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                      Pendiente meses pasados
                      <TooltipInfo text="Acumulado por recuperar derivado de meses anteriores no cubiertos." />
                    </p>
                    <h3 className="text-2xl font-bold text-red-600">{formatCurrency(presupuestoHistorico?.stats?.pendienteMesesPasados || 0)}</h3>
                </div>
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                      Meta real por cubrir
                      <TooltipInfo text="Meta total a alcanzar sumando el objetivo actual y el pendiente acumulado." />
                    </p>
                    <h3 className="text-2xl font-bold text-slate-900">{formatCurrency(presupuestoHistorico?.stats?.metaRealCubrir || 0)}</h3>
                </div>
            </div>

            {/* Composed Chart */}
            <div className="h-[400px] w-full relative">
                <div className="absolute top-0 right-0 flex justify-end gap-6 text-[11px] font-bold text-slate-600 mb-4 z-10">
                    <div className="flex items-center gap-2"><div className="w-6 h-0.5 bg-slate-800 rounded-full"></div> Pendiente acumulado</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-slate-300 rounded-sm"></div> Objetivo</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-600 rounded-sm"></div> Cubierto</div>
                </div>
                <ResponsiveContainer width="100%" height="100%" className="pt-8">
                    <ComposedChart data={presupuestoHistorico?.chartData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} tickFormatter={(val) => `$${(val / 1000000).toFixed(0)}M`} />
                        <RechartsTooltip formatter={(val: number) => formatCurrencyFull(val)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="objetivo" fill="#cbd5e1" barSize={35} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="cubierto" fill="#2563eb" barSize={35} radius={[4, 4, 0, 0]} />
                        <Line type="monotone" dataKey="pendienteAcumulado" stroke="#1e293b" strokeWidth={3} dot={{ r: 4, fill: '#1e293b', strokeWidth: 2, stroke: '#fff' }} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
        
        {/* SECTION 4: Presupuesto por cuenta */}
        <div className="mb-10 bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                    <BarChart3 className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Presupuesto por cuenta — monto y volumen vs. estimado</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-4">
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Monto estimado</p>
                    <h3 className="text-2xl font-bold text-slate-900 mb-1">{formatCurrency(cuentas?.stats?.estimadoMonto || 0)}</h3>
                    <p className="text-[10px] font-semibold text-slate-400">Meta del mes</p>
                </div>
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Monto pedido</p>
                    <h3 className="text-2xl font-bold text-slate-900 mb-1">{formatCurrency(cuentas?.stats?.pedidoMonto || 0)}</h3>
                    <p className="text-[10px] font-semibold text-slate-400">{((cuentas?.stats?.pedidoMonto / (cuentas?.stats?.estimadoMonto||1)) * 100).toFixed(0)}% de avance</p>
                </div>
                <div className={`${cuentas?.stats?.brechaMonto < 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'} p-5 rounded-2xl border flex flex-col justify-between`}>
                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${cuentas?.stats?.brechaMonto < 0 ? 'text-red-600' : 'text-emerald-700'}`}>Brecha en monto</p>
                    <h3 className={`text-2xl font-bold mb-1 ${cuentas?.stats?.brechaMonto < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatCurrency(cuentas?.stats?.brechaMonto || 0)}</h3>
                    <p className={`text-[10px] font-semibold ${cuentas?.stats?.brechaMonto < 0 ? 'text-red-500' : 'text-emerald-600'}`}>Por cerrar</p>
                </div>
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Cuentas en meta (monto)</p>
                    <h3 className="text-2xl font-bold text-slate-900 mb-1">{cuentas?.stats?.cuentasEnMeta || 0} de {cuentas?.stats?.totalCuentas || 0}</h3>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Unidades estimadas</p>
                    <h3 className="text-2xl font-bold text-slate-900 mb-1">{cuentas?.stats?.estimadoUnidades || 0} eq</h3>
                    <p className="text-[10px] font-semibold text-slate-400">Meta del mes</p>
                </div>
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Unidades pedidas</p>
                    <h3 className="text-2xl font-bold text-slate-900 mb-1">{cuentas?.stats?.pedidoUnidades || 0} eq</h3>
                    <p className="text-[10px] font-semibold text-slate-400">{((cuentas?.stats?.pedidoUnidades / (cuentas?.stats?.estimadoUnidades||1)) * 100).toFixed(0)}% de avance</p>
                </div>
                <div className={`${cuentas?.stats?.brechaUnidades < 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'} p-5 rounded-2xl border flex flex-col justify-between`}>
                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${cuentas?.stats?.brechaUnidades < 0 ? 'text-red-600' : 'text-emerald-700'}`}>Brecha en unidades</p>
                    <h3 className={`text-2xl font-bold mb-1 ${cuentas?.stats?.brechaUnidades < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{cuentas?.stats?.brechaUnidades || 0} eq</h3>
                    <p className={`text-[10px] font-semibold ${cuentas?.stats?.brechaUnidades < 0 ? 'text-red-500' : 'text-emerald-600'}`}>Por cerrar</p>
                </div>
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Ticket promedio</p>
                    <h3 className="text-2xl font-bold text-slate-900 mb-1">{formatCurrency(cuentas?.stats?.ticketPromedioReal || 0)}</h3>
                    <p className="text-[10px] font-semibold text-slate-400">Estimado: {formatCurrency(cuentas?.stats?.ticketPromedioEstimado || 0)} por eq</p>
                </div>
            </div>

            {/* Dual Bars List */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                <div className="flex items-center gap-6 text-[10px] font-bold text-slate-600 mb-6 bg-white p-3 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-500 rounded-[3px]"></div> En meta (≥100%)</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-rose-500 rounded-[3px]"></div> Por debajo</div>
                    <div className="flex items-center gap-2"><div className="w-1 h-3 bg-slate-800 rounded-full"></div> Estimado = 100%</div>
                    <div className="ml-auto text-slate-500">Barra superior: monto · barra inferior: unidades</div>
                </div>

                <div className="space-y-6 overflow-y-auto max-h-[500px] pr-4 scrollbar-thin">
                    {cuentas?.lista?.map((cuenta: any, idx: number) => {
                        const pctMonto = (cuenta.montoReal / (cuenta.montoEstimado || 1)) * 100;
                        const pctUnidades = (cuenta.unidadesReal / (cuenta.unidadesEstimado || 1)) * 100;
                        
                        const maxValMonto = Math.max(cuenta.montoReal, cuenta.montoEstimado);
                        const posEstimadoMonto = (cuenta.montoEstimado / maxValMonto) * 100;
                        const posRealMonto = (cuenta.montoReal / maxValMonto) * 100;
                        
                        const maxValUnid = Math.max(cuenta.unidadesReal, cuenta.unidadesEstimado);
                        const posEstimadoUnid = (cuenta.unidadesEstimado / maxValUnid) * 100;
                        const posRealUnid = (cuenta.unidadesReal / maxValUnid) * 100;

                        return (
                            <div key={idx} className="relative pb-3 border-b border-slate-200 last:border-0 bg-white p-4 rounded-xl shadow-sm">
                                <h4 className="text-[12px] font-black text-slate-800 mb-3">Cuenta {idx + 1} <span className="font-semibold text-slate-400 ml-2">· {cuenta.cliente}</span></h4>
                                
                                {/* Monto Bar */}
                                <div className="mb-3">
                                    <div className="flex justify-between text-[11px] font-semibold text-slate-500 mb-1.5">
                                        <span>Monto</span>
                                        <span>{formatCurrency(cuenta.montoReal)} de {formatCurrency(cuenta.montoEstimado)} · <span className="font-black text-slate-700">{pctMonto.toFixed(0)}%</span></span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-2.5 rounded-full relative overflow-hidden">
                                        <div className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ${pctMonto >= 100 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${posRealMonto}%` }}></div>
                                        <div className="absolute top-0 bottom-0 w-1 bg-slate-800 rounded-full z-10" style={{ left: `calc(${posEstimadoMonto}% - 2px)` }}></div>
                                    </div>
                                </div>
                                
                                {/* Unidades Bar */}
                                <div>
                                    <div className="flex justify-between text-[11px] font-semibold text-slate-500 mb-1.5">
                                        <span>Unidades</span>
                                        <span>{cuenta.unidadesReal} de {cuenta.unidadesEstimado} eq · <span className="font-black text-slate-700">{pctUnidades.toFixed(0)}%</span></span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-2.5 rounded-full relative overflow-hidden">
                                        <div className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ${pctUnidades >= 100 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${posRealUnid}%` }}></div>
                                        <div className="absolute top-0 bottom-0 w-1 bg-slate-800 rounded-full z-10" style={{ left: `calc(${posEstimadoUnid}% - 2px)` }}></div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>

        {/* SECTION 5: Distribuidor y Vencimientos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
            
            <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm">
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6">Distribución por distribuidor</h2>
                <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={distribucionDistribuidor} margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} />
                            <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} width={100} />
                            <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                            <Bar dataKey="value" fill="#8b5cf6" barSize={20} radius={[0, 4, 4, 0]} label={{ position: 'right', fill: '#64748b', fontSize: 11, fontWeight: 700 }} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm">
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6">Vencimientos de flotilla próximos 12 meses</h2>
                <div className="h-[280px] w-full mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={vencimientosRenta} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} width={40} />
                            <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                            <Bar dataKey="cantidad" fill="#f43f5e" barSize={35} radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#1e293b', fontSize: 11, fontWeight: 700 }} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <p className="text-[11px] font-semibold text-slate-500 leading-relaxed text-center">
                        Equipos con contrato por vencer en el horizonte de 12 meses. Los meses pico deben gestionarse con anticipación para la renovación.
                    </p>
                </div>
            </div>
            
        </div>

      </div>
    </div>
  );
}
