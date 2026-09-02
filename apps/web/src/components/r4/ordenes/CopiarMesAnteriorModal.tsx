'use client';

import React, { useState, useEffect } from 'react';
import { X, RotateCcw, Loader2, AlertCircle, Calendar, ArrowRight, Building2, Search, Check, ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';

interface CopiarMesAnteriorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentPeriod?: string;
  currentColor?: string;
}

export default function CopiarMesAnteriorModal({
  isOpen,
  onClose,
  onSuccess,
  currentPeriod = '2026-09',
  currentColor = '#E5222D'
}: CopiarMesAnteriorModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [periodoOrigen, setPeriodoOrigen] = useState('2026-08');
  const [periodoDestino, setPeriodoDestino] = useState(currentPeriod);
  const [clientes, setClientes] = useState<any[]>([]);
  const [selectedClienteId, setSelectedClienteId] = useState<string>('ALL');
  const [openClientePopover, setOpenClientePopover] = useState(false);
  const [clienteSearchTerm, setClienteSearchTerm] = useState('');
  const [nuevoPedidoTotvs, setNuevoPedidoTotvs] = useState('');
  const [fechaPedidoTotvs, setFechaPedidoTotvs] = useState('');

  useEffect(() => {
    if (isOpen) {
      setNuevoPedidoTotvs('');
      setFechaPedidoTotvs('');
      setPeriodoDestino(currentPeriod);
      // Auto-compute 1 month before
      const parts = currentPeriod.split('-');
      if (parts.length === 2) {
        let y = parseInt(parts[0], 10);
        let m = parseInt(parts[1], 10) - 1;
        if (m === 0) {
          m = 12;
          y -= 1;
        }
        setPeriodoOrigen(`${y}-${String(m).padStart(2, '0')}`);
      }
      loadClientes();
    }
  }, [isOpen, currentPeriod]);

  const loadClientes = async () => {
    try {
      const res = await api.get('/r4/clientes');
      setClientes(res.data?.data || res.data || []);
    } catch (e) {}
  };

  const selectedClienteObj = clientes.find((c: any) => c.id === selectedClienteId);
  const selectedLabel = selectedClienteId === 'ALL'
    ? `Todas las cuentas con órdenes activas (${clientes.length})`
    : (selectedClienteObj?.razonSocial || selectedClienteObj?.razon_social || 'Cliente seleccionado');

  const filteredClientes = clientes.filter((c: any) => {
    const name = (c.razonSocial || c.razon_social || '').toLowerCase();
    return name.includes(clienteSearchTerm.toLowerCase());
  }).sort((a: any, b: any) => (a.razonSocial || a.razon_social || '').localeCompare(b.razonSocial || b.razon_social || ''));

  const handleCopy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodoOrigen || !periodoDestino) {
      toast.error('Debe seleccionar los periodos origen y destino');
      return;
    }
    if (periodoOrigen === periodoDestino) {
      toast.error('El periodo origen y destino no pueden ser iguales');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/r4/ordenes/copiar-mes-anterior', {
        periodo_origen: periodoOrigen,
        periodo_destino: periodoDestino,
        cliente_id: selectedClienteId !== 'ALL' ? selectedClienteId : undefined,
        pedido_totvs: nuevoPedidoTotvs.trim() || undefined,
        fecha_pedido_totvs: fechaPedidoTotvs || undefined
      });

      toast.success(res.data?.message || 'Órdenes copiadas con éxito');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error al copiar órdenes del mes anterior');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Replicar OCs del Mes Anterior</h2>
              <p className="text-xs font-medium text-slate-500">Clona las órdenes de compra activas al nuevo periodo</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleCopy} className="p-6 space-y-5">
          
          {/* Periods Comparison Box */}
          <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl flex items-center justify-between">
            <div className="text-center flex-1">
              <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block mb-1">Periodo Origen</span>
              <input
                type="month"
                value={periodoOrigen}
                onChange={(e) => setPeriodoOrigen(e.target.value)}
                className="px-3 py-1.5 bg-white border border-blue-200 rounded-xl text-xs font-black text-slate-800 focus:outline-none text-center shadow-xs"
                required
              />
            </div>

            <div className="p-2 bg-white rounded-full shadow-xs text-blue-600">
              <ArrowRight className="w-4 h-4" />
            </div>

            <div className="text-center flex-1">
              <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block mb-1">Periodo Destino</span>
              <input
                type="month"
                value={periodoDestino}
                onChange={(e) => setPeriodoDestino(e.target.value)}
                className="px-3 py-1.5 bg-white border border-blue-200 rounded-xl text-xs font-black text-slate-800 focus:outline-none text-center shadow-xs"
                required
              />
            </div>
          </div>

          {/* Scope: Styled Cliente Popover */}
          <div className="space-y-1.5 flex flex-col">
            <label className="text-xs font-black text-slate-700 uppercase tracking-widest">
              Aplicar a Cuenta / Cliente
            </label>
            <Popover open={openClientePopover} onOpenChange={setOpenClientePopover}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full h-11 px-4 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 flex justify-between items-center focus:outline-none focus:border-red-500 transition-colors shadow-2xs"
                >
                  <span className="truncate">{selectedLabel}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-40 text-slate-500" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[420px] p-2 z-[99999] rounded-2xl shadow-xl border border-slate-100" align="start">
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar cliente..."
                    value={clienteSearchTerm}
                    onChange={(e) => setClienteSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-red-500"
                  />
                </div>
                <div className="max-h-[220px] overflow-y-auto space-y-1 custom-scrollbar pr-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClienteId('ALL');
                      setOpenClientePopover(false);
                      setClienteSearchTerm('');
                    }}
                    className={`w-full text-left px-3 py-2 text-xs rounded-xl transition-colors flex items-center justify-between font-bold ${
                      selectedClienteId === 'ALL' ? 'bg-red-50 text-red-700' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>Todas las cuentas ({clientes.length})</span>
                    {selectedClienteId === 'ALL' && <Check className="w-4 h-4 text-red-600 shrink-0" />}
                  </button>
                  {filteredClientes.map((c: any) => {
                    const isSelected = selectedClienteId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedClienteId(c.id);
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

          {/* Nuevo Pedido TOTVS (Opcional) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1">
                Nuevo Pedido TOTVS <span className="text-[10px] text-slate-400 font-normal">(Opcional)</span>
              </label>
              <input
                type="text"
                value={nuevoPedidoTotvs}
                onChange={e => setNuevoPedidoTotvs(e.target.value)}
                placeholder="Ej. PED-2026-09 (dejar vacío para copiar el anterior)"
                className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-red-500 transition-all placeholder:text-slate-400 placeholder:font-normal"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1">
                Fecha Registro TOTVS <span className="text-[10px] text-slate-400 font-normal">(Opcional)</span>
              </label>
              <input
                type="date"
                value={fechaPedidoTotvs}
                onChange={e => setFechaPedidoTotvs(e.target.value)}
                className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-red-500 transition-all"
              />
            </div>
          </div>

          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900 font-medium">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Las órdenes ya existentes en el periodo destino <strong>no se sobreescribirán</strong>. Si ingresas un nuevo Pedido TOTVS, se asignará a todas las órdenes replicadas.
            </span>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
              style={{ backgroundColor: currentColor }}
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Replicar Órdenes</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
