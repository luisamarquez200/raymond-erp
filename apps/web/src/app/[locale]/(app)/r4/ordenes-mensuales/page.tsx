'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Download, Plus, MapPin, Building2, Clock, CheckCircle2, AlertCircle, 
  Layers, List, ChevronDown, ChevronRight, FileSpreadsheet, Truck, Receipt, Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

export default function OrdenesMensualesPage() {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'totalizado' | 'detalle'>('totalizado');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await api.get('/r4/ordenes-mensuales');
        const dataArray = res.data?.data || res.data || [];
        setOrdenes(Array.isArray(dataArray) ? dataArray : []);
      } catch (error) {
        console.error('Error fetching ordenes:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredOrdenes = ordenes.filter((o) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (o.po || '').toLowerCase().includes(term) ||
      (o.pedido_totvs || '').toLowerCase().includes(term) ||
      (o.cliente || '').toLowerCase().includes(term) ||
      (o.activo || '').toLowerCase().includes(term) ||
      (o.periodo || '').toLowerCase().includes(term)
    );
  });

  // Grouped by Periodo + PO + Cliente for the Totalized View
  const groupedOrders = React.useMemo(() => {
    const groups: { [key: string]: any } = {};

    filteredOrdenes.forEach((o) => {
      const groupKey = `${o.periodo}::${o.po || 'SIN_PO'}::${o.cliente || 'Desconocido'}`;
      if (!groups[groupKey]) {
        groups[groupKey] = {
          id: groupKey,
          periodo: o.periodo,
          po: o.po || 'NO REGISTRADO',
          pedido_totvs: o.pedido_totvs || (o.condiciones as any)?.pedido_totvs || (o.condiciones as any)?.pedido || (o.condiciones as any)?.pedido_tovts || '-',
          fecha_pedido_totvs: o.fecha_pedido_totvs || (o.condiciones as any)?.fecha_pedido_totvs || (o.condiciones as any)?.fecha_ped || null,
          cliente: o.cliente,
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
  const totalFacturadoMXN = filteredOrdenes
    .filter(o => (o.moneda || 'MXN') === 'MXN')
    .reduce((sum, o) => sum + (Number(o.tarifa) || 0), 0);
  const totalFacturadoUSD = filteredOrdenes
    .filter(o => (o.moneda || 'MXN') === 'USD')
    .reduce((sum, o) => sum + (Number(o.tarifa) || 0), 0);
  const totalSeriesAmparadas = filteredOrdenes.length;
  const totalPosUnicos = new Set(filteredOrdenes.map(o => `${o.periodo}::${o.po}`).filter(Boolean)).size;

  const currentDataset = viewMode === 'totalizado' ? groupedOrders : filteredOrdenes;
  const totalPages = Math.ceil(currentDataset.length / itemsPerPage);
  const paginatedData = currentDataset.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const exportToCSV = () => {
    const headers = viewMode === 'totalizado'
      ? ['Periodo', 'Folio OC / PO', 'Pedido TOTVS', 'Cliente', 'Cantidad Equipos', 'Total Facturable', 'Moneda', 'Estado']
      : ['Periodo', 'Folio OC / PO', 'Pedido TOTVS', 'Cliente', 'Serie Equipo', 'Modelo', 'Tarifa Facturable', 'Moneda', 'Estado'];

    const rows = viewMode === 'totalizado'
      ? groupedOrders.map(g => [
          g.periodo,
          g.po,
          g.pedido_totvs,
          g.cliente,
          g.series.length,
          g.totalTarifa.toFixed(2),
          g.moneda,
          g.estado
        ])
      : filteredOrdenes.map(o => [
          o.periodo,
          o.po || 'NO REGISTRADO',
          o.pedido_totvs || '-',
          o.cliente,
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
    <div className="min-h-screen bg-[#F9FAFB] p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col -gap-1">
          <span className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] mb-1">FACTURACIÓN Y COBRANZA</span>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Órdenes Mensuales y Pedidos TOTVS</h1>
          <p className="text-slate-500 font-medium mt-1">Control consolidado y por serie de órdenes de compra (POs) emitidas por periodo</p>
        </div>

        {/* View Mode Selector */}
        <div className="flex items-center bg-slate-200/70 p-1.5 rounded-2xl border border-slate-200 shadow-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => { setViewMode('totalizado'); setCurrentPage(1); }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
              viewMode === 'totalizado'
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Layers className="w-4 h-4 text-amber-600" />
            <span>Totalizado por PO / Pedido</span>
          </button>
          <button
            type="button"
            onClick={() => { setViewMode('detalle'); setCurrentPage(1); }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
              viewMode === 'detalle'
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <List className="w-4 h-4 text-slate-600" />
            <span>Detalle por Serie</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border-2 border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Facturado MXN</p>
            <p className="text-xl font-black text-slate-900 mt-1">${totalFacturadoMXN.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="p-3 bg-amber-50 rounded-2xl text-amber-600">
            <Receipt className="w-5 h-5" />
          </div>
        </div>

        {totalFacturadoUSD > 0 && (
          <div className="bg-white p-5 rounded-2xl border-2 border-slate-100 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Facturado USD</p>
              <p className="text-xl font-black text-slate-900 mt-1">${totalFacturadoUSD.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
        )}

        <div className="bg-white p-5 rounded-2xl border-2 border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Folios OC / Pedidos Únicos</p>
            <p className="text-xl font-black text-slate-900 mt-1">{totalPosUnicos}</p>
          </div>
          <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border-2 border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Series Amparadas</p>
            <p className="text-xl font-black text-slate-900 mt-1">{totalSeriesAmparadas} equipos</p>
          </div>
          <div className="p-3 bg-slate-100 rounded-2xl text-slate-700">
            <Truck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative group flex-1 w-full max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-amber-500 transition-colors" />
          <input
            type="text"
            placeholder="Buscar por PO, Pedido TOTVS, Cliente o Serie..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:outline-none transition-all shadow-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-3 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl border-2 border-slate-100 text-xs font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white border-2 border-slate-100 rounded-[2rem] shadow-sm overflow-hidden animate-in fade-in duration-300">
        <div className="overflow-x-auto">
          {viewMode === 'totalizado' ? (
            /* VISTA TOTALIZADA / CONSOLIDADA POR PEDIDO Y FOLIO OC */
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-widest border-b-2 border-slate-100">
                <tr>
                  <th className="w-10 px-4 py-5"></th>
                  <th className="px-6 py-5 font-black">Periodo</th>
                  <th className="px-6 py-5 font-black">Folio OC / PO</th>
                  <th className="px-6 py-5 font-black">No. Pedido TOTVS</th>
                  <th className="px-6 py-5 font-black">Cliente</th>
                  <th className="px-6 py-5 font-black text-center">Equipos Amparados</th>
                  <th className="px-6 py-5 font-black text-right">Monto Total Facturable</th>
                  <th className="px-6 py-5 font-black text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-bold">Cargando órdenes consolidadas...</td></tr>
                ) : paginatedData.length === 0 ? (
                  <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-bold">No se encontraron órdenes para este criterio.</td></tr>
                ) : paginatedData.map((group: any) => {
                  const isExpanded = expandedGroups.has(group.id);
                  return (
                    <React.Fragment key={group.id}>
                      <tr 
                        onClick={() => toggleGroup(group.id)}
                        className="hover:bg-slate-50 transition-colors cursor-pointer group"
                      >
                        <td className="px-4 py-4 text-center">
                          <button 
                            type="button"
                            className="p-1 hover:bg-slate-200/60 rounded-lg transition-colors text-slate-400 group-hover:text-slate-700"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg text-xs">
                            {group.periodo}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-red-50 text-[#E5222D] font-black border border-red-200 text-xs shadow-xs">
                            {group.po}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold",
                            group.pedido_totvs !== '-' ? "bg-blue-50 text-blue-800 border border-blue-200" : "text-slate-400"
                          )}>
                            {group.pedido_totvs}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-slate-800 font-bold">{group.cliente}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 font-bold border border-slate-200 text-xs">
                            <Truck className="w-3.5 h-3.5 text-slate-500" />
                            {group.series.length} equipo{group.series.length > 1 ? 's' : ''}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-black text-slate-900 text-base">
                            ${group.totalTarifa.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 ml-1">{group.moneda}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-widest border shadow-xs",
                            group.estado === 'IMPORTADA' || group.estado === 'VIGENTE' || group.estado === 'GENERADA'
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-50 text-slate-600 border-slate-200"
                          )}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {group.estado || 'REGISTRADA'}
                          </span>
                        </td>
                      </tr>

                      {/* Desglose de series amparadas por el Pedido / Folio OC */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 border-y border-slate-100">
                          <td colSpan={8} className="p-4 pl-14">
                            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
                              <p className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <Truck className="w-4 h-4 text-amber-600" />
                                Detalle de equipos amparados bajo la OC <strong className="text-slate-900 font-bold">{group.po}</strong> ({group.series.length} equipos):
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {group.series.map((s: any, idx: number) => (
                                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between">
                                    <div className="flex items-center justify-between">
                                      <span className="font-mono font-bold text-slate-900 text-xs">{s.activo}</span>
                                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                        ${(Number(s.tarifa) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                    {s.activo_modelo && <span className="text-[10px] text-slate-400 font-medium mt-1">{s.activo_modelo}</span>}
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
            /* VISTA DETALLADA POR SERIE */
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-widest border-b-2 border-slate-100">
                <tr>
                  <th className="px-6 py-5 font-black">Periodo</th>
                  <th className="px-6 py-5 font-black">PO (Orden Compra)</th>
                  <th className="px-6 py-5 font-black">No. Pedido TOTVS</th>
                  <th className="px-6 py-5 font-black">Cliente</th>
                  <th className="px-6 py-5 font-black">Activo (Serie)</th>
                  <th className="px-6 py-5 font-black">Accesorios Vinculados</th>
                  <th className="px-6 py-5 font-black text-right">Tarifa Facturable</th>
                  <th className="px-6 py-5 font-black text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-bold">Cargando órdenes...</td></tr>
                ) : paginatedData.length === 0 ? (
                  <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-bold">No se encontraron órdenes.</td></tr>
                ) : paginatedData.map((orden: any) => (
                  <tr key={orden.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg text-xs">
                        {orden.periodo}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 text-[#E5222D] font-bold border border-red-200 shadow-xs text-xs">
                        {orden.po || 'NO REGISTRADO'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold",
                        orden.pedido_totvs && orden.pedido_totvs !== '-' ? "bg-blue-50 text-blue-800 border border-blue-200" : "text-slate-400"
                      )}>
                        {orden.pedido_totvs || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-800 font-bold">{orden.cliente}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded-md">{orden.activo}</span>
                        {orden.activo_modelo && <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{orden.activo_modelo}</p>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {(!orden.accesorios || orden.accesorios.length === 0) ? (
                        <span className="text-[10px] font-semibold text-slate-400 italic">Sin accesorios</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {orden.accesorios.map((acc: any, i: number) => (
                            <div key={i} className="inline-flex items-center gap-1.5 text-[11px]">
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200">
                                {acc.tipo || 'ACC'}
                              </span>
                              <span className="font-mono font-bold text-slate-700">{acc.serie || acc.id}</span>
                              {acc.modelo && <span className="text-slate-400 text-[10px]">({acc.modelo})</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-black text-slate-900 text-base">
                        ${orden.tarifa ? orden.tarifa.toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '0.00'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 ml-1">{orden.moneda || 'MXN'}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-widest border shadow-xs",
                        orden.estado === 'IMPORTADA' || orden.estado === 'VIGENTE' || orden.estado === 'GENERADA'
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-50 text-slate-600 border-slate-200"
                      )}>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {orden.estado || 'IMPORTADA'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="bg-slate-50 border-t-2 border-slate-100 px-6 py-4 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              Mostrando <span className="text-slate-900 font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="text-slate-900 font-bold">{Math.min(currentPage * itemsPerPage, currentDataset.length)}</span> de <span className="text-slate-900 font-bold">{currentDataset.length}</span> registros
            </span>
            <div className="flex gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 transition-all shadow-xs cursor-pointer"
              >
                Anterior
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 transition-all shadow-xs cursor-pointer"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
