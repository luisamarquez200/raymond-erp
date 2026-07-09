'use client';

import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, Plus, MapPin, Building2, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

export default function OrdenesMensualesPage() {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
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
      (o.cliente || '').toLowerCase().includes(term) ||
      (o.activo || '').toLowerCase().includes(term) ||
      (o.periodo || '').toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredOrdenes.length / itemsPerPage);
  const paginatedOrdenes = filteredOrdenes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="min-h-screen bg-[#F9FAFB] p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col -gap-1">
          <span className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] mb-1">FACTURACIÓN</span>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Órdenes Mensuales</h1>
          <p className="text-slate-500 font-medium mt-1">Control detallado de órdenes de compra (POs) y facturación por periodo</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative group flex-1 w-full max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-amber-500 transition-colors" />
          <input
            type="text"
            placeholder="Buscar por PO, Cliente, Serie o Periodo"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-medium focus:border-amber-500 focus:outline-none transition-all shadow-sm"
          />
        </div>
        <div className="flex gap-2">
          <button className="flex items-center justify-center p-3 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl border-2 border-slate-100 transition-all shadow-sm"><Filter className="w-4 h-4" /></button>
          <button className="flex items-center justify-center p-3 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl border-2 border-slate-100 transition-all shadow-sm"><Download className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="bg-white border-2 border-slate-100 rounded-[2rem] shadow-sm overflow-hidden animate-in fade-in duration-300">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-widest border-b-2 border-slate-100">
              <tr>
                <th className="px-6 py-5 font-black">Periodo</th>
                <th className="px-6 py-5 font-black">PO (Orden Compra)</th>
                <th className="px-6 py-5 font-black">Cliente</th>
                <th className="px-6 py-5 font-black">Activo (Serie)</th>
                <th className="px-6 py-5 font-black text-right">Tarifa Facturable</th>
                <th className="px-6 py-5 font-black">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold">Cargando órdenes...</td></tr>
              ) : filteredOrdenes.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold">No se encontraron órdenes.</td></tr>
              ) : paginatedOrdenes.map((orden) => (
                <tr key={orden.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <span className="font-black text-slate-900 group-hover:text-amber-600 transition-colors">
                      {orden.periodo}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold border border-slate-200 shadow-sm text-xs group-hover:bg-amber-100 group-hover:text-amber-800 group-hover:border-amber-200 transition-all">
                      {orden.po || 'NO REGISTRADO'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-slate-600 font-bold">{orden.cliente}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{orden.activo}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-black text-slate-900 text-base">
                      ${orden.tarifa ? orden.tarifa.toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '0.00'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 ml-1">{orden.moneda || 'MXN'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-widest border shadow-sm",
                      orden.estado === 'IMPORTADA' || orden.estado === 'VIGENTE' || orden.estado === 'GENERADA'
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-slate-50 text-slate-600 border-slate-200"
                    )}>
                      {orden.estado === 'IMPORTADA' || orden.estado === 'VIGENTE' || orden.estado === 'GENERADA' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                      {orden.estado || 'IMPORTADA'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="bg-slate-50 border-t-2 border-slate-100 px-6 py-4 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              Mostrando <span className="text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="text-slate-900">{Math.min(currentPage * itemsPerPage, filteredOrdenes.length)}</span> de <span className="text-slate-900">{filteredOrdenes.length}</span> órdenes
            </span>
            <div className="flex gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 transition-all shadow-sm"
              >
                Anterior
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 transition-all shadow-sm"
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
