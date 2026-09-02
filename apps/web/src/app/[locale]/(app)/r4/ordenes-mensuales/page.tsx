'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, Filter, Download, Plus, MapPin, Building2, Clock, CheckCircle2, AlertCircle, 
  Layers, List, ChevronDown, ChevronRight, FileSpreadsheet, Truck, Receipt, Calendar, 
  RotateCcw, Sparkles, DollarSign, UserCheck, ShieldCheck, X, FileText, CheckCircle, ArrowUpDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { useConfigStore } from '@/store/config.store';
import { useAuthStore } from '@/store/auth.store';
import { useUser } from '@/hooks/useUsers';
import TooltipInfo from '@/components/ui/TooltipInfo';
import PageLoader from '@/components/ui/PageLoader';
import AsignarOcMasivoModal from '@/components/r4/ordenes/AsignarOcMasivoModal';
import CopiarMesAnteriorModal from '@/components/r4/ordenes/CopiarMesAnteriorModal';

export default function OrdenesMensualesPage() {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('2026-08');
  const [selectedMoneda, setSelectedMoneda] = useState('ALL');
  const [selectedCliente, setSelectedCliente] = useState('ALL');
  const [selectedAdcFilter, setSelectedAdcFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'totalizado' | 'detalle'>('totalizado');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const [adminAdcScope, setAdminAdcScope] = useState<'todos' | 'mis_adcs'>('todos');
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);

  const { user } = useAuthStore();
  const { data: freshUserProfile } = useUser(user?.id || '');
  let rawRole: any = user?.role;
  if (Array.isArray(rawRole)) rawRole = rawRole[0]?.name || rawRole[0]?.rol || rawRole[0];
  if (typeof rawRole === 'object' && rawRole !== null) rawRole = rawRole?.name || rawRole?.rol;
  const userRole = String(rawRole || '').toLowerCase();

  const isAdministrator = ['administrador', 'admin', 'superadmin', 'gerente', 'coordinacion', 'coordinador', 'director'].some(r => userRole.includes(r));
  const rawAdcAsociado = 
    freshUserProfile?.adcAsociadoName ||
    (user as any)?.adc_asociado_name || 
    (user as any)?.adcAsociadoName || '';
  const resolvedAdcName = rawAdcAsociado && rawAdcAsociado !== 'ninguno'
    ? rawAdcAsociado
    : `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || (user as any)?.name || '';

  const { roleColors } = useConfigStore();
  const currentColor = roleColors[userRole] || roleColors.administrador || '#E5222D';

  const formatPeriodLabel = (p: string) => {
    if (!p) return '-';
    const [year, month] = p.split('-');
    const months: Record<string, string> = {
      '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
      '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
      '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre'
    };
    return `${months[month] || month} ${year}`;
  };

  const sanitizePedidoTotvs = (val: any) => {
    if (!val) return '-';
    const s = String(val).trim();
    const invalid = ['USD', 'MXN', 'NA', 'N/A', 'NO', '-', 'NULL', 'UNDEFINED'];
    if (invalid.includes(s.toUpperCase())) return '-';
    return s;
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (!isAdministrator) {
        // Strict ADC scope: only fetch their assigned ADC orders
        params.append('adc', resolvedAdcName || 'SIN_ADC_ASIGNADO');
      } else if (adminAdcScope === 'mis_adcs') {
        const myAdc = rawAdcAsociado && rawAdcAsociado !== 'ninguno' ? rawAdcAsociado : resolvedAdcName;
        params.append('adc', myAdc || 'SIN_ADC_ASIGNADO');
      }

      const queryUrl = params.toString() ? `/r4/ordenes-mensuales?${params.toString()}` : '/r4/ordenes-mensuales';
      const res = await api.get(queryUrl);
      const dataArray = res.data?.data || res.data || [];
      setOrdenes(Array.isArray(dataArray) ? dataArray : []);
    } catch (error) {
      console.error('Error fetching ordenes:', error);
    } finally {
      setLoading(false);
    }
  }, [isAdministrator, adminAdcScope, resolvedAdcName, rawAdcAsociado]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Available Filter Options
  const uniquePeriods = useMemo(() => {
    const set = new Set<string>();
    ordenes.forEach(o => { if (o.periodo) set.add(o.periodo); });
    return Array.from(set).sort().reverse();
  }, [ordenes]);

  const uniqueClientes = useMemo(() => {
    const set = new Set<string>();
    ordenes.forEach(o => { if (o.cliente) set.add(o.cliente); });
    return Array.from(set).sort();
  }, [ordenes]);

  const uniqueADCs = useMemo(() => {
    const set = new Set<string>();
    ordenes.forEach(o => { if (o.adc && o.adc !== 'Sin ADC') set.add(o.adc); });
    return Array.from(set).sort();
  }, [ordenes]);

  const filteredOrdenes = useMemo(() => {
    return ordenes.filter((o) => {
      // Period filter
      if (selectedPeriod !== 'ALL' && o.periodo !== selectedPeriod) return false;
      // Moneda filter
      if (selectedMoneda !== 'ALL' && (o.moneda || 'MXN').toUpperCase() !== selectedMoneda) return false;
      // Cliente filter
      if (selectedCliente !== 'ALL' && o.cliente !== selectedCliente) return false;
      // ADC filter
      if (selectedAdcFilter !== 'ALL' && o.adc !== selectedAdcFilter) return false;

      // Search term
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const condiciones = (o.condiciones as any) || {};
      const rawPedidoTotvs = o.pedido_totvs || condiciones.pedido_totvs || condiciones.pedido || condiciones.pedido_tovts || '';
      const pedidoTotvs = sanitizePedidoTotvs(rawPedidoTotvs);
      return (
        (o.po || '').toLowerCase().includes(term) ||
        (pedidoTotvs !== '-' && pedidoTotvs.toLowerCase().includes(term)) ||
        (o.cliente || '').toLowerCase().includes(term) ||
        (o.activo || '').toLowerCase().includes(term) ||
        (o.periodo || '').toLowerCase().includes(term) ||
        (o.adc || '').toLowerCase().includes(term)
      );
    });
  }, [ordenes, selectedPeriod, selectedMoneda, selectedCliente, selectedAdcFilter, searchTerm]);

  // Grouped by Periodo + PO + Cliente for the Totalized View
  const groupedOrders = useMemo(() => {
    const groups: { [key: string]: any } = {};

    filteredOrdenes.forEach((o) => {
      const groupKey = `${o.periodo}::${o.po || 'SIN_PO'}::${o.cliente || 'Desconocido'}`;
      if (!groups[groupKey]) {
        const rawTotvs = o.pedido_totvs || (o.condiciones as any)?.pedido_totvs || (o.condiciones as any)?.pedido || (o.condiciones as any)?.pedido_tovts || null;
        groups[groupKey] = {
          id: groupKey,
          periodo: o.periodo,
          po: o.po || 'NO REGISTRADO',
          pedido_totvs: sanitizePedidoTotvs(rawTotvs),
          fecha_pedido_totvs: o.fecha_pedido_totvs || (o.condiciones as any)?.fecha_pedido_totvs || (o.condiciones as any)?.fecha_ped || null,
          fecha_oc: (o.condiciones as any)?.fecha_oc || null,
          cliente: o.cliente,
          adc: o.adc || 'Sin ADC',
          moneda: o.moneda || 'MXN',
          estado: o.estado || 'IMPORTADA',
          totalTarifa: 0,
          series: []
        };
      }

      groups[groupKey].totalTarifa += Number(o.tarifa) || 0;
      groups[groupKey].series.push({
        id: o.id,
        activo: o.activo,
        activo_modelo: o.activo_modelo,
        accesorios: o.accesorios,
        tarifa: o.tarifa,
        estado: o.estado
      });
    });

    return Object.values(groups);
  }, [filteredOrdenes]);

  const toggleGroup = (groupId: string) => {
    const next = new Set(expandedGroups);
    if (next.has(groupId)) {
      next.delete(groupId);
    } else {
      next.add(groupId);
    }
    setExpandedGroups(next);
  };

  // KPIs
  const totalFacturadoMXN = useMemo(() => {
    return filteredOrdenes
      .filter(o => (o.moneda || 'MXN').toUpperCase() === 'MXN')
      .reduce((sum, o) => sum + (Number(o.tarifa) || 0), 0);
  }, [filteredOrdenes]);

  const totalFacturadoUSD = useMemo(() => {
    return filteredOrdenes
      .filter(o => (o.moneda || 'MXN').toUpperCase() === 'USD')
      .reduce((sum, o) => sum + (Number(o.tarifa) || 0), 0);
  }, [filteredOrdenes]);

  const totalSeriesAmparadas = filteredOrdenes.length;
  const totalPosUnicos = useMemo(() => {
    return new Set(filteredOrdenes.map(o => `${o.periodo}::${o.po}`).filter(Boolean)).size;
  }, [filteredOrdenes]);

  const currentDataset = viewMode === 'totalizado' ? groupedOrders : filteredOrdenes;
  const totalPages = Math.ceil(currentDataset.length / itemsPerPage);
  const paginatedData = currentDataset.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const resetFilters = () => {
    setSelectedPeriod('2026-08');
    setSelectedMoneda('ALL');
    setSelectedCliente('ALL');
    setSelectedAdcFilter('ALL');
    setSearchTerm('');
    setCurrentPage(1);
  };

  const hasActiveFilters = selectedPeriod !== '2026-08' || selectedMoneda !== 'ALL' || selectedCliente !== 'ALL' || selectedAdcFilter !== 'ALL' || !!searchTerm;

  const exportToCSV = () => {
    const headers = viewMode === 'totalizado'
      ? ['Periodo', 'Folio OC / PO', 'Pedido TOTVS', 'Fecha Pedido', 'Fecha OC', 'Cliente', 'ADC Responsable', 'Cantidad Equipos', 'Total Facturable', 'Moneda', 'Estado']
      : ['Periodo', 'Folio OC / PO', 'Pedido TOTVS', 'Cliente', 'ADC Responsable', 'Serie Equipo', 'Modelo', 'Tarifa Facturable', 'Moneda', 'Estado'];

    const rows = viewMode === 'totalizado'
      ? groupedOrders.map(g => [
          formatPeriodLabel(g.periodo),
          g.po,
          g.pedido_totvs,
          g.fecha_pedido_totvs || '-',
          g.fecha_oc || '-',
          g.cliente,
          g.adc,
          g.series.length,
          g.totalTarifa.toFixed(2),
          g.moneda,
          g.estado
        ])
      : filteredOrdenes.map(o => [
          formatPeriodLabel(o.periodo),
          o.po || 'NO REGISTRADO',
          sanitizePedidoTotvs(o.pedido_totvs || (o.condiciones as any)?.pedido),
          o.cliente,
          o.adc || 'Sin ADC',
          o.activo,
          o.activo_modelo || '-',
          (o.tarifa || 0).toFixed(2),
          o.moneda || 'MXN',
          o.estado
        ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.map((val: any) => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Ordenes_Mensuales_${viewMode}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col relative">
      {/* TABS NAVIGATION BAR MATCHING FLOTILLA STANDARD */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 pt-3 pb-0 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Clean Tab Switcher */}
        <div className="flex items-end gap-6">
          <button
            onClick={() => { setViewMode('totalizado'); setCurrentPage(1); }}
            className={`pb-3 px-2 flex items-center gap-2 font-bold text-sm transition-colors border-b-2 ${
              viewMode === 'totalizado' 
                ? 'text-slate-900 border-b-2' 
                : 'text-slate-400 border-transparent hover:text-slate-600'
            }`}
            style={viewMode === 'totalizado' ? { borderBottomColor: currentColor } : {}}
          >
            <Layers className={`w-4 h-4 ${viewMode === 'totalizado' ? '' : 'opacity-70'}`} style={viewMode === 'totalizado' ? { color: currentColor } : {}} />
            Consolidado por PO
          </button>

          <button
            onClick={() => { setViewMode('detalle'); setCurrentPage(1); }}
            className={`pb-3 px-2 flex items-center gap-2 font-bold text-sm transition-colors border-b-2 ${
              viewMode === 'detalle' 
                ? 'text-slate-900 border-b-2' 
                : 'text-slate-400 border-transparent hover:text-slate-600'
            }`}
            style={viewMode === 'detalle' ? { borderBottomColor: currentColor } : {}}
          >
            <List className={`w-4 h-4 ${viewMode === 'detalle' ? '' : 'opacity-70'}`} style={viewMode === 'detalle' ? { color: currentColor } : {}} />
            Detalle por Equipo
          </button>
        </div>

        {/* Right: Scope toggle for Admins / Badge for ADC */}
        {isAdministrator ? (
          <div className="mb-2 self-end sm:self-auto flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200 shadow-inner">
            <button
              type="button"
              onClick={() => setAdminAdcScope('todos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                adminAdcScope === 'todos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Todos los ADC
            </button>
            <button
              type="button"
              onClick={() => setAdminAdcScope('mis_adcs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                adminAdcScope === 'mis_adcs' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Solo mis ADC
            </button>
          </div>
        ) : (
          <div className="mb-2 self-end sm:self-auto flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ejecutivo:</span>
            <span className="text-xs font-black text-slate-800">{resolvedAdcName || user?.email || 'Mi Usuario'}</span>
          </div>
        )}
      </div>

      {/* BODY CONTENT */}
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 flex-1">
        {/* Header Title & Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.25em] mb-1" style={{ color: currentColor }}>
              RAYMOND
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Órdenes Mensuales
            </h1>
            <p className="text-slate-500 font-medium mt-1 text-sm">
              Control de órdenes de compra (PO) y pedidos registrados en TOTVS
            </p>
          </div>

          {/* Action Buttons: Carga Masiva y Replicar Mes Anterior */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setIsCopyModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl font-bold text-xs shadow-xs transition-all hover:scale-102"
            >
              <RotateCcw className="w-4 h-4 text-blue-600" />
              <span>Copiar Mes Anterior</span>
            </button>

            <button
              onClick={() => setIsBulkModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-white rounded-xl font-bold text-xs shadow-md transition-all hover:opacity-95 hover:scale-102"
              style={{ backgroundColor: currentColor }}
            >
              <Layers className="w-4 h-4" />
              <span>Asignación Masiva de OC</span>
            </button>
          </div>
        </div>

      {/* Indicators Row (Matching FlotillaTab Indicator Cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        {/* GROUP 1: Facturación (3 Columns) */}
        <div className="lg:col-span-3 bg-white/60 p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center gap-1.5 px-1">
            <Receipt className="w-3.5 h-3.5 text-red-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">Indicadores de Facturación</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Facturado MXN */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 hover:border-emerald-300 hover:shadow-xs transition-all flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1 mb-0.5">
                  <p className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">Facturado MXN</p>
                  <TooltipInfo text="Monto total facturado en moneda nacional (MXN) para el periodo seleccionado." />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                  ${totalFacturadoMXN.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </h3>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>

            {/* Facturado USD */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 hover:border-blue-300 hover:shadow-xs transition-all flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1 mb-0.5">
                  <p className="text-[10px] font-black text-blue-700 uppercase tracking-wider">Facturado USD</p>
                  <TooltipInfo text="Monto total facturado en dólares (USD) para el periodo seleccionado." />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                  ${totalFacturadoUSD.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </h3>
              </div>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>

        {/* GROUP 2: Folios y Series (2 Columns) */}
        <div className="lg:col-span-2 bg-slate-50/80 p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center gap-1.5 px-1">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">Folios y Cobertura</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Folios Únicos */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 hover:border-purple-300 hover:shadow-xs transition-all flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1 mb-0.5">
                  <p className="text-[10px] font-black text-purple-700 uppercase tracking-wider">Órdenes / POs</p>
                  <TooltipInfo text="Cantidad de órdenes de compra únicas registradas en este periodo." />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                  {totalPosUnicos}
                </h3>
              </div>
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
            </div>

            {/* Series Amparadas */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 hover:border-slate-300 hover:shadow-xs transition-all flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1 mb-0.5">
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Equipos Facturados</p>
                  <TooltipInfo text="Total de equipos/series con orden de compra registrada." />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                  {totalSeriesAmparadas}
                </h3>
              </div>
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated Controls & Search Toolbar (Matching FlotillaTab Toolbar) */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border-2 border-slate-100 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
        {/* Left: Search Bar & Clear Filters */}
        <div className="flex items-center gap-3 flex-1 w-full lg:w-auto">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 focus-within:text-red-500 transition-colors" />
            <input
              type="text"
              placeholder="Buscar por PO, Pedido TOTVS, Cliente, ADC o Serie..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-9 py-2 bg-slate-50 hover:bg-slate-100/60 focus:bg-white border-2 border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:border-red-500 focus:outline-none transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {hasActiveFilters && (
            <button 
              onClick={resetFilters} 
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl border-2 border-red-200 text-xs font-bold transition-all shadow-sm shrink-0" 
              title="Restablecer filtros"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Limpiar filtros</span>
            </button>
          )}
        </div>

        {/* Right: Dropdowns & Export */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 shrink-0 justify-between lg:justify-end w-full lg:w-auto">
          {/* Period Select */}
          <select
            value={selectedPeriod}
            onChange={(e) => { setSelectedPeriod(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Todos los Meses</option>
            {uniquePeriods.map(p => (
              <option key={p} value={p}>{formatPeriodLabel(p)}</option>
            ))}
          </select>

          {/* Client Select */}
          <select
            value={selectedCliente}
            onChange={(e) => { setSelectedCliente(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer max-w-[200px]"
          >
            <option value="ALL">Todos los Clientes ({uniqueClientes.length})</option>
            {uniqueClientes.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* ADC Select (For Admins in "todos" mode) */}
          {isAdministrator && adminAdcScope === 'todos' && uniqueADCs.length > 0 && (
            <select
              value={selectedAdcFilter}
              onChange={(e) => { setSelectedAdcFilter(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer max-w-[180px]"
            >
              <option value="ALL">Todos los ADC ({uniqueADCs.length})</option>
              {uniqueADCs.map(adc => (
                <option key={adc} value={adc}>{adc}</option>
              ))}
            </select>
          )}

          {/* Currency Select */}
          <select
            value={selectedMoneda}
            onChange={(e) => { setSelectedMoneda(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Moneda (Todas)</option>
            <option value="MXN">MXN</option>
            <option value="USD">USD</option>
          </select>

          {/* Export Button */}
          <button
            onClick={exportToCSV}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-all whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Exportar</span>
          </button>
        </div>
      </div>

      {/* Main Table Container (Matching FlotillaTab Style) */}
      <div className="bg-white border-2 border-slate-100 rounded-[2rem] shadow-sm overflow-hidden animate-in fade-in duration-300">
        <div className="overflow-x-auto">
          {viewMode === 'totalizado' ? (
            /* VISTA TOTALIZADA */
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-widest border-b-2 border-slate-100">
                <tr>
                  <th className="w-8 px-3 py-3.5"></th>
                  <th className="px-4 py-3.5 font-black">Periodo</th>
                  <th className="px-4 py-3.5 font-black">Folio OC / PO</th>
                  <th className="px-4 py-3.5 font-black"># Pedido TOTVS</th>
                  <th className="px-4 py-3.5 font-black">Cliente</th>
                  {isAdministrator && <th className="px-4 py-3.5 font-black">ADC</th>}
                  <th className="px-4 py-3.5 font-black text-center">Equipos Amparados</th>
                  <th className="px-4 py-3.5 font-black text-right">Monto Total Facturable</th>
                  <th className="px-4 py-3.5 font-black text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr><td colSpan={isAdministrator ? 9 : 8} className="px-6 py-12 text-center text-slate-400 font-bold">Cargando órdenes...</td></tr>
                ) : paginatedData.length === 0 ? (
                  <tr><td colSpan={isAdministrator ? 9 : 8} className="px-6 py-12 text-center text-slate-400 font-bold">No se encontraron órdenes para el criterio seleccionado.</td></tr>
                ) : paginatedData.map((group: any) => {
                  const isExpanded = expandedGroups.has(group.id);
                  const isPendingNote = group.pedido_totvs && group.pedido_totvs.toUpperCase().includes('PORTAL');

                  return (
                    <React.Fragment key={group.id}>
                      <tr 
                        onClick={() => toggleGroup(group.id)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      >
                        <td className="px-3 py-3 text-center">
                          <button 
                            type="button"
                            className="p-1 hover:bg-slate-200/60 rounded-md transition-colors text-slate-400"
                          >
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-red-600" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-600">
                          {formatPeriodLabel(group.periodo)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-red-50 text-red-700 font-bold border border-red-200 text-xs">
                            {group.po}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {isPendingNote ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-medium">
                              {group.pedido_totvs}
                            </span>
                          ) : group.pedido_totvs !== '-' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 text-xs font-semibold">
                              {group.pedido_totvs}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {group.cliente}
                        </td>
                        {isAdministrator && (
                          <td className="px-4 py-3 text-slate-600 text-xs font-medium">
                            {group.adc}
                          </td>
                        )}
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-xs">
                            <Truck className="w-3 h-3 text-slate-400" />
                            {group.series.length} equipo{group.series.length > 1 ? 's' : ''}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold text-slate-900">
                            ${group.totalTarifa.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-1 font-medium">{group.moneda}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="w-2.5 h-2.5" />
                            {group.estado || 'IMPORTADA'}
                          </span>
                        </td>
                      </tr>

                      {/* Expanded Subtable */}
                      {isExpanded && (
                        <tr className="bg-slate-50/50 border-y border-slate-100">
                          <td colSpan={isAdministrator ? 9 : 8} className="p-3 pl-10">
                            <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                              <p className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                                <Truck className="w-3.5 h-3.5 text-red-600" />
                                Equipos amparados bajo la OC <span className="text-slate-900 font-black">{group.po}</span> ({group.series.length} equipos):
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                {group.series.map((s: any, idx: number) => (
                                  <div key={idx} className="bg-slate-50 border border-slate-200/70 rounded-lg p-2.5 flex items-center justify-between text-xs">
                                    <div>
                                      <p className="font-bold text-slate-900 font-mono text-[11px]">{s.activo}</p>
                                      {s.activo_modelo && <p className="text-[10px] text-slate-400">{s.activo_modelo}</p>}
                                    </div>
                                    <span className="font-bold text-emerald-700 text-xs">
                                      ${(Number(s.tarifa) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          ) : (
            /* VISTA DETALLADA */
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-widest border-b-2 border-slate-100">
                <tr>
                  <th className="px-4 py-3.5 font-black">Periodo</th>
                  <th className="px-4 py-3.5 font-black">PO (Orden Compra)</th>
                  <th className="px-4 py-3.5 font-black"># Pedido TOTVS</th>
                  <th className="px-4 py-3.5 font-black">Cliente</th>
                  {isAdministrator && <th className="px-4 py-3.5 font-black">ADC</th>}
                  <th className="px-4 py-3.5 font-black">Activo (Serie)</th>
                  <th className="px-4 py-3.5 font-black">Accesorios</th>
                  <th className="px-4 py-3.5 font-black text-right">Tarifa Facturable</th>
                  <th className="px-4 py-3.5 font-black text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr><td colSpan={isAdministrator ? 9 : 8} className="px-6 py-12 text-center text-slate-400 font-bold">Cargando órdenes...</td></tr>
                ) : paginatedData.length === 0 ? (
                  <tr><td colSpan={isAdministrator ? 9 : 8} className="px-6 py-12 text-center text-slate-400 font-bold">No se encontraron órdenes.</td></tr>
                ) : paginatedData.map((orden: any) => {
                  const condiciones = (orden.condiciones as any) || {};
                  const pedidoTotvs = sanitizePedidoTotvs(orden.pedido_totvs || condiciones.pedido_totvs || condiciones.pedido || condiciones.pedido_tovts);
                  const isPendingNote = pedidoTotvs && pedidoTotvs.toUpperCase().includes('PORTAL');

                  return (
                    <tr key={orden.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-600">
                        {formatPeriodLabel(orden.periodo)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-red-50 text-red-700 font-bold border border-red-200 text-xs">
                          {orden.po || 'NO REGISTRADO'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isPendingNote ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-medium">
                            {pedidoTotvs}
                          </span>
                        ) : pedidoTotvs !== '-' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 text-xs font-semibold">
                            {pedidoTotvs}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {orden.cliente}
                      </td>
                      {isAdministrator && (
                        <td className="px-4 py-3 text-slate-600 text-xs font-medium">
                          {orden.adc || 'Sin ADC'}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span className="font-mono text-[11px] font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                          {orden.activo}
                        </span>
                        {orden.activo_modelo && <p className="text-[10px] text-slate-400">{orden.activo_modelo}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {(!orden.accesorios || orden.accesorios.length === 0) ? (
                          <span className="text-[10px] text-slate-400 italic">Sin accesorios</span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {orden.accesorios.map((acc: any, i: number) => (
                              <div key={i} className="inline-flex items-center gap-1 text-[10px]">
                                <span className="px-1 py-0.2 rounded font-bold bg-amber-100 text-amber-800">
                                  {acc.tipo || 'ACC'}
                                </span>
                                <span className="font-mono text-slate-700">{acc.serie || acc.id}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-slate-900">
                          ${orden.tarifa ? Number(orden.tarifa).toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '0.00'}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1 font-medium">{orden.moneda || 'MXN'}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle className="w-2.5 h-2.5" />
                          {orden.estado || 'IMPORTADA'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="bg-slate-50/80 border-t-2 border-slate-100 px-6 py-3 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">
              Mostrando <span className="text-slate-900 font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="text-slate-900 font-bold">{Math.min(currentPage * itemsPerPage, currentDataset.length)}</span> de <span className="text-slate-900 font-bold">{currentDataset.length}</span> registros
            </span>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-all shadow-2xs cursor-pointer"
              >
                Anterior
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-all shadow-2xs cursor-pointer"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
      {/* Modales de Asignación Masiva y Copia */}
      <AsignarOcMasivoModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onSuccess={() => fetchData()}
        initialPeriod={selectedPeriod !== 'ALL' ? selectedPeriod : '2026-09'}
        currentColor={currentColor}
      />

      <CopiarMesAnteriorModal
        isOpen={isCopyModalOpen}
        onClose={() => setIsCopyModalOpen(false)}
        onSuccess={() => fetchData()}
        currentPeriod={selectedPeriod !== 'ALL' ? selectedPeriod : '2026-09'}
        currentColor={currentColor}
      />
    </div>
  );
}
