"use client";

import { 
  Search, Receipt, Calendar, CalendarDays, Plus, Filter, Download
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { useState, useEffect } from "react";
import api from "@/lib/api";
import { toast } from "sonner";

export default function R4RentasPage() {
  const [rentas, setRentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchRentas = async () => {
    try {
      setLoading(true);
      const res = await api.get('/r4/rentas');
      const dataArray = res.data?.data || res.data || [];
      setRentas(Array.isArray(dataArray) ? dataArray : []);
    } catch (error) {
      console.error('Error fetching rentas:', error);
      toast.error('Error al cargar rentas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRentas();
  }, []);

  const totalRentas = rentas.length;
  const activas = rentas.filter(r => r.estado?.toLowerCase().includes('activo') || r.estado?.toLowerCase().includes('vigente')).length;
  const porVencer = rentas.filter(r => r.estado?.toLowerCase().includes('vencer')).length;

  const filteredRentas = rentas.filter((renta: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      renta.identificador?.toLowerCase().includes(term) ||
      renta.cliente?.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredRentas.length / itemsPerPage);
  const paginatedRentas = filteredRentas.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="min-h-screen bg-[#F9FAFB] p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col -gap-1">
          <span className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] mb-1">RAYMOND</span>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Gestión de Rentas</h1>
          <p className="text-slate-500 font-medium mt-1">Administración de contratos de renta, vigencias y asignación de activos</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-amber-100">
            <Plus className="w-4 h-4" />
            Nueva Renta
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:border-amber-100 hover:shadow-md transition-all">
          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Receipt className="w-24 h-24 text-amber-600" />
          </div>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2 line-clamp-1">Total de Rentas</p>
          <h3 className="text-3xl font-black text-amber-600">{totalRentas}</h3>
        </div>
        
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-emerald-100 hover:shadow-md transition-all">
          <p className="text-emerald-600 text-[10px] font-black uppercase tracking-widest mb-2 line-clamp-1">Vigentes / Activas</p>
          <h3 className="text-3xl font-black text-slate-900">{activas}</h3>
        </div>
        
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-amber-100 hover:shadow-md transition-all">
          <p className="text-amber-600 text-[10px] font-black uppercase tracking-widest mb-2 line-clamp-1">Próximas a Vencer</p>
          <h3 className="text-3xl font-black text-slate-900">{porVencer}</h3>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative group flex-1 w-full max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-amber-500 transition-colors" />
          <input
            type="text"
            placeholder="Buscar por ID, Cliente..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // Reset page on search
            }}
            className="w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-medium focus:border-amber-500 focus:outline-none transition-all shadow-sm"
          />
        </div>
        <div className="flex gap-2">
            <button className="flex items-center justify-center p-3 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl border-2 border-slate-100 transition-all shadow-sm"><Filter className="w-4 h-4"/></button>
            <button className="flex items-center justify-center p-3 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl border-2 border-slate-100 transition-all shadow-sm"><Download className="w-4 h-4"/></button>
        </div>
      </div>

      <div className="bg-white border-2 border-slate-100 rounded-[2rem] shadow-sm overflow-hidden animate-in fade-in duration-300">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-widest border-b-2 border-slate-100">
              <tr>
                <th className="px-6 py-5 font-black">ID Renta</th>
                <th className="px-6 py-5 font-black">Cliente</th>
                <th className="px-6 py-5 font-black">Equipos Asignados</th>
                <th className="px-6 py-5 font-black">Fecha Inicio</th>
                <th className="px-6 py-5 font-black">Fin Vigencia</th>
                <th className="px-6 py-5 font-black">Tarifa Mensual</th>
                <th className="px-6 py-5 font-black">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-bold">Cargando rentas...</td></tr>
                ) : filteredRentas.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-bold">No se encontraron rentas.</td></tr>
                ) : paginatedRentas.map((renta) => (
                <tr key={renta.id} className="hover:bg-slate-50 transition-colors group cursor-pointer">
                  <td className="px-6 py-4 font-black text-slate-900 group-hover:text-amber-600 transition-colors">{renta.identificador}</td>
                  <td className="px-6 py-4 font-bold text-slate-700">{renta.cliente}</td>
                  <td className="px-6 py-4">
                    <span className="bg-slate-100 px-2 py-1.5 rounded-lg text-[10px] font-black uppercase text-slate-500 border border-slate-200">
                      {renta.activosCount} {renta.activosCount === 1 ? 'Activo' : 'Activos'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-500">{renta.fechaInicio}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-700">{renta.fechaFin}</td>
                  <td className="px-6 py-4 font-black text-slate-800">{renta.monto}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                      renta.estado?.toLowerCase() === 'activo' || renta.estado?.toLowerCase() === 'vigente'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                        : 'bg-amber-50 text-amber-700 border-amber-100'
                    }`}>
                      {renta.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Table Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t-2 border-slate-50 bg-slate-50/50">
            <span className="text-sm font-bold text-slate-500">
              Página {currentPage} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 disabled:opacity-50 hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 disabled:opacity-50 hover:bg-slate-50 hover:border-slate-300 transition-all"
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
