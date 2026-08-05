'use client';

import { useState, useEffect } from 'react';
import { salidasApi, Salida } from '@/services/taller-r1/salidas.service';
import { clientesApi } from '@/services/taller-r1/clientes.service';
import { toast } from 'sonner';
import {
  Plus, Download, Search, FileText, Eye, Calendar,
  Package, Wrench, LayoutDashboard, Clock, CheckCircle2,
  AlertCircle, Hash
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import NuevaSalidaModal from '@/components/taller-r1/salidas/NuevaSalidaModal';
import SalidaDetailsModal from '@/components/taller-r1/salidas/SalidaDetailsModal';
import { useAuthTallerStore } from '@/store/auth-taller.store';

export default function SalidasPage() {
  const [salidas, setSalidas] = useState<Salida[]>([]);
  const [filteredSalidas, setFilteredSalidas] = useState<Salida[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'todo' | 'por-entregar' | 'espera-remision' | 'entregado'>('todo');
  const [clientMap, setClientMap] = useState<Record<string, string>>({});

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSalidaId, setSelectedSalidaId] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const { selectedSite, user: currentTallerUser } = useAuthTallerStore();
  const isVisitante = currentTallerUser?.role === 'Visitante';

  const siteNames: Record<string, string> = {
    'r1': 'Taller R1',
    'r2': 'R2',
    'r3': 'R3',
  };
  const currentSiteName = selectedSite ? siteNames[selectedSite] || selectedSite.toUpperCase() : 'Taller';

  useEffect(() => {
    loadSalidas();
  }, []);

  useEffect(() => {
    filterSalidas();
  }, [salidas, activeTab, searchTerm, clientMap]);

  const loadSalidas = async () => {
    try {
      setLoading(true);
      const [data, clients] = await Promise.all([
        salidasApi.getAll(),
        clientesApi.getAll(),
      ]);
      const map: Record<string, string> = {};
      if (Array.isArray(clients)) {
        clients.forEach((c: any) => {
          if (c?.id_cliente) map[c.id_cliente] = c.nombre_cliente || c.id_cliente;
        });
      }
      setClientMap(map);
      setSalidas(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Error al cargar las salidas');
      setSalidas([]);
    } finally {
      setLoading(false);
    }
  };

  const resolveClientName = (salida: Salida) => {
    if (!salida.cliente) return '-';
    return clientMap[salida.cliente] || salida.cliente;
  };

  const filterSalidas = () => {
    if (!Array.isArray(salidas)) { setFilteredSalidas([]); return; }
    let filtered = [...salidas];

    if (activeTab === 'entregado') {
      filtered = filtered.filter(s => s.estado === 'Entregado');
    } else if (activeTab === 'por-entregar') {
      filtered = filtered.filter(s => s.estado === 'Por Entregar');
    } else if (activeTab === 'espera-remision') {
      filtered = filtered.filter(s => s.estado?.toLowerCase() === 'en espera de remisión');
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        s.folio.toLowerCase().includes(lower) ||
        resolveClientName(s).toLowerCase().includes(lower) ||
        (s.cliente && s.cliente.toLowerCase().includes(lower)) ||
        (s.remision && s.remision.toLowerCase().includes(lower))
      );
    }

    filtered.sort((a, b) => {
      const dateA = a.fecha_creacion ? new Date(a.fecha_creacion).getTime() : 0;
      const dateB = b.fecha_creacion ? new Date(b.fecha_creacion).getTime() : 0;
      return dateB - dateA;
    });

    setFilteredSalidas(filtered);
  };

  const handleExport = () => {
    try {
      const exportData = filteredSalidas.map(s => ({
        Folio: s.folio,
        Estado: s.estado,
        Cliente: resolveClientName(s),
        Remisión: s.remision || 'N/A',
        Transporte: s.numero_transporte || '',
        Fecha: s.fecha_creacion ? new Date(s.fecha_creacion).toLocaleDateString() : '',
        Elemento: s.elemento || '',
      }));
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Salidas');
      XLSX.writeFile(workbook, `salidas_taller_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Excel exportado correctamente');
    } catch {
      toast.error('Error al exportar');
    }
  };

  const estadoStyle = (estado: string) => {
    if (estado === 'Entregado') return 'bg-emerald-50 text-emerald-600';
    if (estado?.toLowerCase() === 'en espera de remisión') return 'bg-red-50 text-red-600';
    return 'bg-amber-50 text-amber-600';
  };

  const searchFilteredSalidas = (Array.isArray(salidas) ? salidas : []).filter(s => {
    if (!searchTerm) return true;
    const lower = searchTerm.toLowerCase();
    return (
      s.folio.toLowerCase().includes(lower) ||
      resolveClientName(s).toLowerCase().includes(lower) ||
      (s.cliente && s.cliente.toLowerCase().includes(lower)) ||
      (s.remision && s.remision.toLowerCase().includes(lower))
    );
  });

  const stats = {
    total: searchFilteredSalidas.length,
    porEntregar: searchFilteredSalidas.filter(s => s.estado === 'Por Entregar').length,
    esperaRemision: searchFilteredSalidas.filter(s => s.estado?.toLowerCase() === 'en espera de remisión').length,
    entregados: searchFilteredSalidas.filter(s => s.estado === 'Entregado').length,
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col -gap-1">
          <span className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] mb-1">RAYMOND</span>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Salidas {(selectedSite || 'R1').toUpperCase()}</h1>
          <p className="text-slate-500 font-medium mt-1">Gestión de despacho y salida de equipos</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExport}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest border-2 border-slate-100 transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
          {!isVisitante && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all shadow-lg shadow-red-100"
            >
              <Plus className="w-4 h-4" />
              Nueva Salida
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="sticky top-16 lg:top-0 z-20 bg-gray-50/95 backdrop-blur-md py-3 -my-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-4">
              <LayoutDashboard className="w-6 h-6" />
            </div>
            <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Total</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.total}</h3>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mb-4">
              <Clock className="w-6 h-6" />
            </div>
            <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Por Entregar</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.porEntregar}</h3>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Espera Remisión</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.esperaRemision}</h3>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-4">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Entregados</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.entregados}</h3>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 sm:flex sm:flex-nowrap bg-white rounded-xl shadow-sm border border-gray-100 p-1.5 gap-1.5">
          {[
            { id: 'todo', label: 'Todo' },
            { id: 'espera-remision', label: 'En Espera' },
            { id: 'por-entregar', label: 'Por Entregar' },
            { id: 'entregado', label: 'Entregado' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'px-3 py-2 text-[11px] sm:text-sm font-bold rounded-lg transition-all text-center flex-1',
                activeTab === tab.id
                  ? 'bg-red-50 text-red-600 shadow-sm border border-red-100'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50 border border-transparent'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-red-500 transition-colors" />
          <input
            type="text"
            placeholder="Buscar folio, cliente o remisión..."
            className="w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-medium focus:border-red-500 focus:outline-none transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Card Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-gray-400 font-bold tracking-tighter">Cargando salidas...</p>
        </div>
      ) : filteredSalidas.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-[32px] border border-dashed border-gray-200">
          <LayoutDashboard className="w-16 h-16 mx-auto mb-4 text-gray-200" />
          <h3 className="text-xl font-black text-gray-900 mb-1 tracking-tighter">No hay registros</h3>
          <p className="text-gray-400 font-medium text-sm">No se encontraron salidas con los filtros actuales.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSalidas.map((salida) => (
            <div
              key={salida.id_salida}
              onClick={() => { setSelectedSalidaId(salida.id_salida); setShowDetailsModal(true); }}
              className="group cursor-pointer bg-white rounded-[24px] p-5 shadow-sm border border-gray-100 hover:border-red-100 hover:shadow-md transition-all flex flex-col relative overflow-hidden"
            >
              {/* Card Header */}
              <div className="flex justify-between items-start mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center shrink-0 shadow-inner group-hover:bg-red-50 transition-colors">
                    <FileText className="w-6 h-6 text-gray-400 group-hover:text-red-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Folio</span>
                      <span className={cn(
                        'px-2 py-0.5 text-[9px] font-black uppercase rounded border tracking-wider',
                        estadoStyle(salida.estado),
                        'border-current/20'
                      )}>
                        {salida.estado}
                      </span>
                    </div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tighter group-hover:text-red-600 transition-colors">
                      #{salida.folio}
                    </h3>
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="space-y-3 flex-1">
                {/* Client */}
                <div>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-0.5">Cliente</span>
                  <p className="text-sm font-bold text-gray-700 line-clamp-1">{resolveClientName(salida)}</p>
                </div>

                {/* Remision */}
                <div>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-0.5">Remisión</span>
                  <div className="flex items-center gap-1.5">
                    <Hash className="w-3 h-3 text-gray-300" />
                    <p className={cn(
                      'text-sm font-black',
                      salida.remision ? 'text-gray-800' : 'text-gray-300 italic font-bold text-xs'
                    )}>
                      {salida.remision || 'Pendiente'}
                    </p>
                  </div>
                </div>

                {/* Equipos / Accesorios type */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Package className="w-3 h-3 text-slate-400" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tipo</span>
                    </div>
                    <p className="text-xs font-black text-slate-700">{salida.elemento || 'General'}</p>
                  </div>
                  <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Wrench className="w-3 h-3 text-slate-400" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Transporte</span>
                    </div>
                    <p className="text-xs font-black text-slate-700 truncate">{salida.numero_transporte || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-gray-400">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold">
                    {salida.fecha_creacion
                      ? new Date(salida.fecha_creacion).toLocaleDateString()
                      : '-'}
                  </span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSalidaId(salida.id_salida);
                      setShowDetailsModal(true);
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Hover bottom bar */}
              <div className="absolute bottom-0 left-0 h-1 bg-red-500 transition-all duration-500 w-0 group-hover:w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <NuevaSalidaModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={loadSalidas}
      />

      <SalidaDetailsModal
        id={selectedSalidaId}
        isOpen={showDetailsModal}
        onClose={() => { setShowDetailsModal(false); setSelectedSalidaId(null); }}
        onRefresh={loadSalidas}
      />
    </div>
  );
}
