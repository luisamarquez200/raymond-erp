'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Layers, Check, Search, Loader2, AlertCircle, Building2, MapPin, ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import api from '@/lib/api';
import { toast } from 'sonner';

interface AsignarOcMasivoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialPeriod?: string;
  currentColor?: string;
}

export default function AsignarOcMasivoModal({
  isOpen,
  onClose,
  onSuccess,
  initialPeriod = '2026-09',
  currentColor = '#E5222D'
}: AsignarOcMasivoModalProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [clientes, setClientes] = useState<any[]>([]);
  const [rentas, setRentas] = useState<any[]>([]);

  // Form State
  const [selectedClienteId, setSelectedClienteId] = useState<string>('');
  const [selectedSitioId, setSelectedSitioId] = useState<string>('ALL');
  const [openClientePopover, setOpenClientePopover] = useState(false);
  const [clienteSearchTerm, setClienteSearchTerm] = useState('');
  const [openSitioPopover, setOpenSitioPopover] = useState(false);
  const [sitioSearchTerm, setSitioSearchTerm] = useState('');
  const [periodo, setPeriodo] = useState<string>(initialPeriod);
  const [po, setPo] = useState<string>('');
  const [pedidoTotvs, setPedidoTotvs] = useState<string>('');
  const [fechaPedidoTotvs, setFechaPedidoTotvs] = useState<string>('');
  const [selectedRentaIds, setSelectedRentaIds] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      setPeriodo(initialPeriod);
      setPo('');
      setPedidoTotvs('');
      setFechaPedidoTotvs('');
      setSelectedRentaIds(new Set());
    }
  }, [isOpen, initialPeriod]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [clientesRes, rentasRes] = await Promise.all([
        api.get('/r4/clientes'),
        api.get('/r4/rentas')
      ]);
      const clientList = clientesRes.data?.data || clientesRes.data || [];
      const rentasList = rentasRes.data?.data || rentasRes.data || [];
      setClientes(clientList);
      setRentas(rentasList);

      if (clientList.length > 0 && !selectedClienteId) {
        setSelectedClienteId(clientList[0].id);
      }
    } catch (e: any) {
      toast.error('Error al cargar datos de rentas');
    } finally {
      setLoading(false);
    }
  };

  // Filter rentas for selected client and site
  const availableRentas = useMemo(() => {
    if (!selectedClienteId) return [];
    return rentas.filter(r => {
      if (r.cliente_id !== selectedClienteId && r.cliente?.id !== selectedClienteId) return false;
      if (selectedSitioId !== 'ALL' && r.sitio_id !== selectedSitioId) return false;
      if (searchFilter) {
        const term = searchFilter.toLowerCase();
        const serie = (r.activo?.serie || '').toLowerCase();
        const modelo = (r.activo?.modelo || '').toLowerCase();
        const sitio = (r.sitio?.nombre || '').toLowerCase();
        if (!serie.includes(term) && !modelo.includes(term) && !sitio.includes(term)) return false;
      }
      return true;
    });
  }, [rentas, selectedClienteId, selectedSitioId, searchFilter]);

  // Unique sites for selected client
  const availableSites = useMemo(() => {
    const clientRentas = rentas.filter(r => r.cliente_id === selectedClienteId || r.cliente?.id === selectedClienteId);
    const sitesMap = new Map<string, string>();
    clientRentas.forEach(r => {
      if (r.sitio_id && r.sitio?.nombre) {
        sitesMap.set(r.sitio_id, r.sitio.nombre);
      }
    });
    return Array.from(sitesMap.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [rentas, selectedClienteId]);

  const toggleSelectAll = () => {
    if (selectedRentaIds.size === availableRentas.length && availableRentas.length > 0) {
      setSelectedRentaIds(new Set());
    } else {
      setSelectedRentaIds(new Set(availableRentas.map(r => r.id)));
    }
  };

  const toggleSelectRenta = (id: string) => {
    const next = new Set(selectedRentaIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRentaIds(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!po.trim()) {
      toast.error('Debe ingresar el número o folio de la Orden de Compra (OC)');
      return;
    }
    if (selectedRentaIds.size === 0) {
      toast.error('Seleccione al menos un equipo para asignar la OC');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/r4/ordenes/asignar-masivo', {
        renta_ids: Array.from(selectedRentaIds),
        periodo,
        po: po.trim(),
        pedido_totvs: pedidoTotvs.trim() || undefined,
        fecha_pedido_totvs: fechaPedidoTotvs || undefined
      });

      toast.success(res.data?.message || `Se asignaron ${selectedRentaIds.size} órdenes con éxito`);
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error al asignar órdenes masivas');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-red-50 text-red-600" style={{ backgroundColor: `${currentColor}15`, color: currentColor }}>
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Asignación Masiva de Orden de Compra</h2>
              <p className="text-xs font-medium text-slate-500">Asigna la misma OC y Pedido TOTVS a múltiples equipos simultáneamente</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: currentColor }} />
            <p className="text-sm font-semibold">Cargando cuentas y equipos...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Top Row: Cuenta, Sitio, Periodo */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Cliente Popover */}
              <div className="space-y-1.5 flex flex-col">
                <label className="text-xs font-black text-slate-700 uppercase tracking-widest">
                  Cliente / Cuenta *
                </label>
                <Popover open={openClientePopover} onOpenChange={setOpenClientePopover}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-full h-10 px-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 flex justify-between items-center focus:outline-none focus:border-red-500 transition-colors"
                    >
                      <span className="truncate">
                        {clientes.find((c: any) => c.id === selectedClienteId)?.razonSocial || clientes.find((c: any) => c.id === selectedClienteId)?.razon_social || "Seleccionar cliente..."}
                      </span>
                      <ChevronsUpDown className="ml-1.5 h-3.5 w-3.5 shrink-0 opacity-40 text-slate-500" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[340px] p-2 z-[99999] rounded-2xl shadow-xl border border-slate-100" align="start">
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar cliente..."
                        value={clienteSearchTerm}
                        onChange={(e) => setClienteSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-red-500"
                      />
                    </div>
                    <div className="max-h-[200px] overflow-y-auto space-y-1 custom-scrollbar pr-1">
                      {clientes
                        .filter((c: any) => (c.razonSocial || c.razon_social || '').toLowerCase().includes(clienteSearchTerm.toLowerCase()))
                        .sort((a: any, b: any) => (a.razonSocial || a.razon_social || '').localeCompare(b.razonSocial || b.razon_social || ''))
                        .map((c: any) => {
                          const isSelected = selectedClienteId === c.id;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setSelectedClienteId(c.id);
                                setSelectedSitioId('ALL');
                                setSelectedRentaIds(new Set());
                                setOpenClientePopover(false);
                                setClienteSearchTerm('');
                              }}
                              className={`w-full text-left px-3 py-2 text-xs rounded-xl transition-colors flex items-center justify-between font-medium ${
                                isSelected ? 'bg-red-50 text-red-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <span className="truncate">{c.razonSocial || c.razon_social}</span>
                              {isSelected && <Check className="w-4 h-4 text-red-600 shrink-0" />}
                            </button>
                          );
                        })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Sitio Popover */}
              <div className="space-y-1.5 flex flex-col">
                <label className="text-xs font-black text-slate-700 uppercase tracking-widest">
                  Sitio / Ubicación
                </label>
                <Popover open={openSitioPopover} onOpenChange={setOpenSitioPopover}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-full h-10 px-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 flex justify-between items-center focus:outline-none focus:border-red-500 transition-colors"
                    >
                      <span className="truncate">
                        {selectedSitioId === 'ALL' ? `Todos los sitios (${availableSites.length})` : (availableSites.find((s: any) => s.id === selectedSitioId)?.nombre || 'Sitio')}
                      </span>
                      <ChevronsUpDown className="ml-1.5 h-3.5 w-3.5 shrink-0 opacity-40 text-slate-500" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-2 z-[99999] rounded-2xl shadow-xl border border-slate-100" align="start">
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar sitio..."
                        value={sitioSearchTerm}
                        onChange={(e) => setSitioSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-red-500"
                      />
                    </div>
                    <div className="max-h-[200px] overflow-y-auto space-y-1 custom-scrollbar pr-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSitioId('ALL');
                          setSelectedRentaIds(new Set());
                          setOpenSitioPopover(false);
                          setSitioSearchTerm('');
                        }}
                        className={`w-full text-left px-3 py-2 text-xs rounded-xl transition-colors flex items-center justify-between font-bold ${
                          selectedSitioId === 'ALL' ? 'bg-red-50 text-red-700' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>Todos los sitios ({availableSites.length})</span>
                        {selectedSitioId === 'ALL' && <Check className="w-4 h-4 text-red-600 shrink-0" />}
                      </button>
                      {availableSites
                        .filter((s: any) => s.nombre.toLowerCase().includes(sitioSearchTerm.toLowerCase()))
                        .map((s: any) => {
                          const isSelected = selectedSitioId === s.id;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setSelectedSitioId(s.id);
                                setSelectedRentaIds(new Set());
                                setOpenSitioPopover(false);
                                setSitioSearchTerm('');
                              }}
                              className={`w-full text-left px-3 py-2 text-xs rounded-xl transition-colors flex items-center justify-between font-medium ${
                                isSelected ? 'bg-red-50 text-red-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <span className="truncate">{s.nombre}</span>
                              {isSelected && <Check className="w-4 h-4 text-red-600 shrink-0" />}
                            </button>
                          );
                        })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Periodo de Renta *
                </label>
                <input
                  type="month"
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-red-500"
                  required
                />
              </div>
            </div>

            {/* Middle Row: Datos de la OC a asignar */}
            <div className="p-4 bg-red-50/40 rounded-2xl border border-red-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-red-900 uppercase tracking-wider mb-1.5">
                  Folio OC / PO *
                </label>
                <input
                  type="text"
                  placeholder="Ej. OC-2026-AMZ-001"
                  value={po}
                  onChange={(e) => setPo(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-red-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Pedido TOTVS (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej. PED-88231"
                  value={pedidoTotvs}
                  onChange={(e) => setPedidoTotvs(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Fecha Pedido TOTVS
                </label>
                <input
                  type="date"
                  value={fechaPedidoTotvs}
                  onChange={(e) => setFechaPedidoTotvs(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            {/* Bottom Section: Selector de Equipos / Series */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Equipos Disponibles ({availableRentas.length})
                  </span>
                  <span className="text-xs font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {selectedRentaIds.size} seleccionados
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filtrar serie o modelo..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none w-48"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-xs font-bold text-red-600 hover:underline px-2 py-1"
                  >
                    {selectedRentaIds.size === availableRentas.length && availableRentas.length > 0 ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
                  </button>
                </div>
              </div>

              {/* Equipos List Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
                {availableRentas.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs font-medium">
                    No se encontraron equipos vigentes para los filtros seleccionados.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold sticky top-0">
                      <tr>
                        <th className="p-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={selectedRentaIds.size === availableRentas.length && availableRentas.length > 0}
                            onChange={toggleSelectAll}
                            className="rounded text-red-600 focus:ring-red-500 cursor-pointer"
                          />
                        </th>
                        <th className="p-3 font-bold">Serie Equipo</th>
                        <th className="p-3 font-bold">Modelo</th>
                        <th className="p-3 font-bold">Sitio</th>
                        <th className="p-3 font-bold text-right">Tarifa Renta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {availableRentas.map(r => {
                        const isSelected = selectedRentaIds.has(r.id);
                        const tarifa = Number(r.detalles?.renta_real || r.detalles?.renta_base || r.tarifa || 0);
                        const moneda = r.detalles?.moneda || 'MXN';
                        return (
                          <tr
                            key={r.id}
                            onClick={() => toggleSelectRenta(r.id)}
                            className={`hover:bg-slate-50 cursor-pointer transition-colors ${isSelected ? 'bg-red-50/30' : ''}`}
                          >
                            <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectRenta(r.id)}
                                className="rounded text-red-600 focus:ring-red-500 cursor-pointer"
                              />
                            </td>
                            <td className="p-3 font-black text-slate-900">{r.activo?.serie || r.activo_id}</td>
                            <td className="p-3 text-slate-600 font-medium">{r.activo?.modelo || '-'}</td>
                            <td className="p-3 text-slate-600 font-medium">{r.sitio?.nombre || 'Sin sitio'}</td>
                            <td className="p-3 text-right font-bold text-slate-900">
                              ${tarifa.toLocaleString('es-MX', { minimumFractionDigits: 2 })} {moneda}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">
                Se aplicará la OC <strong className="text-slate-900">{po || '(Sin folio)'}</strong> a <strong className="text-slate-900">{selectedRentaIds.size} equipos</strong> para el periodo <strong className="text-slate-900">{periodo}</strong>.
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || selectedRentaIds.size === 0 || !po.trim()}
                  className="px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
                  style={{ backgroundColor: currentColor }}
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Asignar {selectedRentaIds.size} Órdenes</span>
                </button>
              </div>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
