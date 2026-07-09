'use client';

import { useState, useEffect } from 'react';
import { entradasApi, Entrada } from '@/services/taller-r1/entradas.service';
import { clientesApi } from '@/services/taller-r1/clientes.service';
import { toast } from 'sonner';
import {
  Plus, Download, Search, Edit, FileText, Eye, Calendar,
  Package, Wrench, LayoutDashboard, Clock, CheckCircle2, Flame, RefreshCcw
} from 'lucide-react';
import { EntradaDetailsModal } from './EntradaDetailsModal';
import { EntradaDetalleModal } from '@/components/taller-r1/entradas/EntradaDetalleModal';
import { NuevaEntradaModal } from '@/components/taller-r1/entradas/NuevaEntradaModal';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { useAuthTallerStore } from '@/store/auth-taller.store';

export default function EntradasPage() {
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [filteredEntradas, setFilteredEntradas] = useState<Entrada[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'todo' | 'por-ubicar' | 'cerrado' | 'all'>('todo');
  const [clientMap, setClientMap] = useState<Record<string, string>>({});
  const [countsMap, setCountsMap] = useState<Record<string, { equipos: number; accesorios: number }>>({});

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [viewingEntradaId, setViewingEntradaId] = useState<string | null>(null);
  const [editingEntrada, setEditingEntrada] = useState<Entrada | null>(null);
  const { selectedSite, user: currentTallerUser } = useAuthTallerStore();
  const isVisitante = currentTallerUser?.role === 'Visitante';

  const siteNames: Record<string, string> = {
    'r1': 'Taller R1',
    'r2': 'R2',
    'r3': 'R3',
  };
  const currentSiteName = selectedSite ? siteNames[selectedSite] || selectedSite.toUpperCase() : 'Taller';

  useEffect(() => {
    loadEntradas();
    const intervalId = setInterval(() => {
      loadEntradas(true); // pass true to indicate silent background refresh
    }, 30000); // 30 seconds polling

    return () => clearInterval(intervalId);
  }, []);
  useEffect(() => { filterEntradas(); }, [entradas, activeTab, searchTerm, clientMap]);

  // If site is not R1, default to por-ubicar instead of 'todo' which is 'en espera'
  useEffect(() => {
    if (selectedSite && selectedSite !== 'r1') {
      setActiveTab('por-ubicar');
    } else {
      setActiveTab('todo');
    }
  }, [selectedSite]);

  const loadEntradas = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [data, clients, counts] = await Promise.all([
        entradasApi.getAll(),
        clientesApi.getAll(),
        entradasApi.getCounts(),
      ]);
      const map: Record<string, string> = {};
      if (Array.isArray(clients)) {
        clients.forEach((c: any) => {
          if (c?.id_cliente) map[c.id_cliente] = c.nombre_cliente || c.id_cliente;
        });
      }
      setClientMap(map);
      setCountsMap(counts || {});
      setEntradas(data);
    } catch {
      if (!silent) toast.error('Error al cargar las entradas');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const filterEntradas = () => {
    let filtered = [...entradas];
    if (activeTab === 'todo') {
      // In R1, 'todo' meant 'En espera'. If R1, keep behavior. If R2/R3, 'todo' doesn't exist anymore, replaced by 'all'.
      if (selectedSite === 'r1') {
        filtered = filtered.filter(e => e.estado === 'Recibido – En espera evaluación');
      }
    } else if (activeTab === 'por-ubicar') {
      filtered = filtered.filter(e => e.estado === 'Por Ubicar');
    } else if (activeTab === 'cerrado') {
      filtered = filtered.filter(e => e.estado === 'Cerrado' || e.estado === 'Finalizadas');
    } else if (activeTab === 'all') {
      // 'all' means no estado filter wrapper
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(e => {
        const clientName = (e.cliente && clientMap[e.cliente]) || e.rel_cliente?.nombre_cliente || '';
        return (
          e.folio.toLowerCase().includes(lower) ||
          (e.usuario_asignado && e.usuario_asignado.toLowerCase().includes(lower)) ||
          clientName.toLowerCase().includes(lower)
        );
      });
    }
    filtered.sort((a, b) => new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime());
    setFilteredEntradas(filtered);
  };

  const getFolioNumber = (folio: string) => {
    const match = folio.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  const handleExport = () => {
    try {
      const exportData = filteredEntradas.map(e => ({
        Folio: e.folio,
        Estado: e.estado,
        Cliente: (e.cliente && clientMap[e.cliente]) || e.rel_cliente?.nombre_cliente || e.cliente || '',
        Equipos: countsMap[e.id_entrada]?.equipos ?? 0,
        Accesorios: countsMap[e.id_entrada]?.accesorios ?? 0,
      }));
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Entradas');
      XLSX.writeFile(workbook, `entradas_taller_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Archivo exportado correctamente');
    } catch {
      toast.error('Error al exportar');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col -gap-1">
          <span className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] mb-1">RAYMOND</span>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Entradas {(selectedSite || 'R1').toUpperCase()}</h1>
          <p className="text-slate-500 font-medium mt-1">Gestión de ingresos y recepción de equipos</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest border-2 border-slate-100 transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
          {!isVisitante && (
            <button
              onClick={() => { setEditingEntrada(null); setShowModal(true); }}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-red-100"
            >
              <Plus className="w-4 h-4" />
              Nueva Entrada
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className={cn("grid gap-4", selectedSite === 'r1' ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2")}>
        {selectedSite === 'r1' && (
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-4">
              <LayoutDashboard className="w-6 h-6" />
            </div>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest whitespace-nowrap overflow-hidden text-ellipsis">Recibido – En espera evaluación</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">
              {entradas.filter(e => e.estado === 'Recibido – En espera evaluación').length}
            </h3>
          </div>
        )}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mb-4">
            <Clock className="w-6 h-6" />
          </div>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Por Ubicar</p>
          <h3 className="text-2xl font-black text-slate-900 mt-1">
            {entradas.filter(e => e.estado === 'Por Ubicar').length}
          </h3>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-4">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Cerrado</p>
          <h3 className="text-2xl font-black text-slate-900 mt-1">
            {entradas.filter(e => e.estado === 'Cerrado' || e.estado === 'Finalizadas').length}
          </h3>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 sm:flex sm:flex-nowrap bg-white rounded-xl shadow-sm border border-gray-100 p-1.5 gap-1.5">
          {[
            ...(selectedSite === 'r1' ? [{ id: 'todo', label: 'En espera evaluación' }] : []),
            { id: 'por-ubicar', label: 'Por Ubicar' },
            { id: 'cerrado', label: 'Cerrado' },
            { id: 'all', label: 'Todos' },
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
            placeholder="Buscar folio, cliente o usuario..."
            className="w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-medium focus:border-red-500 focus:outline-none transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-gray-400 font-bold tracking-tighter">Cargando entradas...</p>
        </div>
      ) : filteredEntradas.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-[32px] border border-dashed border-gray-200">
          <LayoutDashboard className="w-16 h-16 mx-auto mb-4 text-gray-200" />
          <h3 className="text-xl font-black text-gray-900 mb-1 tracking-tighter">No hay registros</h3>
          <p className="text-gray-400 font-medium text-sm">No se encontraron entradas con los filtros actuales.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEntradas.map((entrada) => (
            <div
              key={entrada.id_entrada}
              onClick={() => setViewingEntradaId(entrada.id_entrada)}
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
                        entrada.estado === 'Por Ubicar'
                          ? 'bg-amber-50 text-amber-700 border-amber-100'
                          : entrada.estado === 'Cerrado' || entrada.estado === 'Finalizadas'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-gray-50 text-gray-600 border-gray-200'
                      )}>
                        {entrada.estado}
                      </span>
                    </div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tighter group-hover:text-red-600 transition-colors">
                      #{entrada.folio}
                    </h3>
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="space-y-3 flex-1">
                <div>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-0.5">Cliente</span>
                  <p className="text-sm font-bold text-gray-700 line-clamp-1">
                    {entrada.rel_cliente?.nombre_cliente
                      || (entrada.cliente && clientMap[entrada.cliente])
                      || '-'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Package className="w-3 h-3 text-slate-400" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Equipos</span>
                    </div>
                    <p className="text-sm font-black text-slate-700">
                      {countsMap[entrada.id_entrada]?.equipos ?? entrada._count?.entrada_detalle ?? 0}
                    </p>
                  </div>
                  <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Wrench className="w-3 h-3 text-slate-400" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Accesorios</span>
                    </div>
                    <p className="text-sm font-black text-slate-700">
                      {countsMap[entrada.id_entrada]?.accesorios ?? entrada._count?.entrada_accesorios ?? 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-gray-400">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold">
                    {new Date(entrada.fecha_creacion).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); setViewingEntradaId(entrada.id_entrada); }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {entrada.estado === 'Por Ubicar' && !isVisitante && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewingEntradaId(null);
                        setEditingEntrada(entrada);
                        setShowModal(true);
                      }}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Hover bottom bar */}
              <div className="absolute bottom-0 left-0 h-1 bg-red-500 transition-all duration-500 w-0 group-hover:w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <NuevaEntradaModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditingEntrada(null); }}
        onSuccess={() => { loadEntradas(); setEditingEntrada(null); }}
        editingEntrada={editingEntrada}
      />

      <EntradaDetalleModal
        entradaId={editingEntrada ? editingEntrada.id_entrada : null}
        open={showDetalleModal}
        onClose={() => { setShowDetalleModal(false); setEditingEntrada(null); }}
        onSuccess={loadEntradas}
      />

      <EntradaDetailsModal
        entradaId={viewingEntradaId}
        open={!!viewingEntradaId}
        onClose={() => setViewingEntradaId(null)}
        onEdit={(id: string) => {
          const ent = entradas.find(e => e.id_entrada === id);
          if (ent) { setViewingEntradaId(null); setEditingEntrada(ent); setShowModal(true); }
        }}
        onDeleteSuccess={() => { setViewingEntradaId(null); loadEntradas(); }}
        onSuccess={() => loadEntradas()}
      />
    </div>
  );
}
