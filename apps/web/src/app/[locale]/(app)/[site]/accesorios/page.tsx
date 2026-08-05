'use client';

import React, { useState, useEffect } from 'react';
import { accesoriosApi, Accesorio } from '@/services/taller-r1/accesorios.service';
import { TableList } from '@/components/shared/TableList';
import { DataTableColumnHeader } from '@/components/ui/data-table/data-table-column-header';
import { toast } from 'sonner';
import {
  Plus, Search, Edit, Trash2, Download, LayoutGrid,
  MapPin, Tag, CheckCircle2, AlertCircle, Battery, X
} from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

const TABS = ['Todo', 'Ingresado', 'Retirado'];

const estadoColor = (estado?: string) => {
  if (!estado) return 'bg-gray-50 text-gray-500 border-gray-200';
  if (estado === 'Ingresado') return 'bg-green-50 text-green-700 border-green-100';
  if (estado === 'Retirado') return 'bg-red-50 text-red-700 border-red-100';
  return 'bg-amber-50 text-amber-700 border-amber-100';
};

const estadoAccColor = (e?: string) => {
  if (e === 'Bueno') return 'text-green-600 bg-green-50 border-green-100';
  if (e === 'Regular') return 'text-amber-600 bg-amber-50 border-amber-100';
  if (e === 'Malo') return 'text-red-600 bg-red-50 border-red-100';
  return 'text-gray-500 bg-gray-50 border-gray-100';
};

const BLANK_FORM = {
  tipo: '', modelo: '', serial: '', estado_acc: 'Bueno', rack: '', ubicacion: '', fecha_ultima_carga: ''
};

export default function AccesoriosPage() {
  const [data, setData] = useState<Accesorio[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('Todo');

  // Detail dialog
  const [selectedItem, setSelectedItem] = useState<Accesorio | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Create / Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Accesorio | null>(null);
  const [formData, setFormData] = useState({ ...BLANK_FORM });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await accesoriosApi.getAll();
      setData(res);
    } catch { toast.error('Error al cargar accesorios'); }
    finally { setLoading(false); }
  };

  const filteredData = data.filter(i => {
    const matchesTab = activeTab === 'Todo' || i.estado === activeTab;
    const matchesSearch =
      i.modelo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.serial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.tipo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.ubicacion?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await accesoriosApi.update(editingItem.id_accesorio, formData);
        toast.success('Accesorio actualizado');
      } else {
        await accesoriosApi.create(formData);
        toast.success('Accesorio creado');
      }
      setShowModal(false);
      loadData();
    } catch { toast.error('Error al guardar'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este accesorio?')) return;
    try {
      await accesoriosApi.delete(id);
      toast.success('Eliminado');
      loadData();
    } catch { toast.error('Error al eliminar'); }
  };

  const handleExport = () => {
    const exportData = filteredData.map(i => ({
      Tipo: i.tipo,
      Modelo: i.modelo,
      Serial: i.serial,
      Estado: i.estado,
      'Estado Acc': i.estado_acc,
      Ubicación: i.ubicacion,
      'Sub Ubicación': i.sub_ubicacion,
      Rack: i.rack,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Accesorios');
    XLSX.writeFile(wb, 'Accesorios_Taller.xlsx');
  };

  const openEdit = (item: Accesorio) => {
    setEditingItem(item);
    setFormData({ ...BLANK_FORM, ...item as any, fecha_ultima_carga: item.fecha_ultima_carga ? String(item.fecha_ultima_carga) : '' });
    setShowModal(true);
  };

  const columns: ColumnDef<Accesorio>[] = [
    {
      accessorKey: 'tipo',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" />,
      size: 120,
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase border bg-gray-50 text-gray-700 border-gray-200">
          <Tag className="w-3 h-3" />
          {row.original.tipo || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'modelo',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Modelo / Serial" />,
      size: 200,
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-black text-slate-800 text-sm">{row.original.serial || '-'}</span>
          <span className="text-[10px] font-mono text-gray-400 mt-0.5">Modelo: {row.original.modelo || ''}</span>
        </div>
      ),
    },
    {
      accessorKey: 'estado_acc',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Cond." />,
      size: 100,
      cell: ({ row }) => (
        <span className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase border',
          estadoAccColor(row.original.estado_acc)
        )}>
          {row.original.estado_acc === 'Bueno' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
          {row.original.estado_acc || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'estado',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
      size: 110,
      cell: ({ row }) => (
        <span className={cn(
          'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase border',
          estadoColor(row.original.estado)
        )}>
          {row.original.estado || 'N/A'}
        </span>
      ),
    },
    {
      accessorKey: 'ubicacion',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Ubicación" />,
      size: 180,
      cell: ({ row }) => (
        <div className="flex flex-col space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
            <MapPin className="w-3.5 h-3.5 text-gray-400" />
            {row.original.rel_ubicacion?.nombre_ubicacion || row.original.ubicacion || '-'}
          </div>
          {(row.original.rel_sub_ubicacion?.nombre || row.original.sub_ubicacion) && (
            <span className="text-[10px] text-gray-400 font-medium pl-5">
              {row.original.rel_sub_ubicacion?.nombre || row.original.sub_ubicacion}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'acciones',
      header: 'Acciones',
      size: 100,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); openEdit(row.original); }}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
            title="Editar"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(row.original.id_accesorio); }}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
            title="Eliminar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const searchFilteredData = data.filter(i =>
    !searchTerm ? true : (
      i.modelo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.serial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.tipo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.ubicacion?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">

      {/* Header Bar */}
      <div className="sticky top-16 lg:top-0 z-20 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Accesorios</h1>
              <p className="text-gray-500 mt-1 font-medium">Inventario de baterías, cargadores y periféricos</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Quick stats */}
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm">
                <div className="flex items-center gap-1.5 border-r border-gray-200 pr-3">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-xs font-bold text-gray-600">
                    IN: {searchFilteredData.filter(i => i.estado === 'Ingresado').length}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 pl-1">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-xs font-bold text-gray-600">
                    OUT: {searchFilteredData.filter(i => i.estado === 'Retirado').length}
                  </span>
                </div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                <p className="text-red-800 font-bold text-sm">{filteredData.length} Reg.</p>
              </div>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-bold shadow-sm transition-all border border-green-700/50"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Excel</span>
              </button>
              <button
                onClick={() => { setEditingItem(null); setFormData({ ...BLANK_FORM }); setShowModal(true); }}
                className="flex items-center gap-2 px-5 py-2 bg-slate-900 hover:bg-red-600 text-white rounded-xl font-bold shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Nuevo</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-6">

        {/* Filters */}
        <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-center justify-between">
          <div className="flex flex-wrap bg-white rounded-xl shadow-sm border border-gray-100 p-2 gap-1">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-4 py-2 text-sm font-bold rounded-lg transition-all flex-grow sm:flex-grow-0 text-center',
                  activeTab === tab
                    ? 'bg-red-50 text-red-600 shadow-sm border border-red-100'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50 border border-transparent'
                )}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por tipo, modelo, serial o ubicación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all font-medium text-sm text-gray-900"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
          <TableList<Accesorio, any>
            isLoading={loading}
            data={filteredData}
            columns={columns}
            hideToolbar={true}
            initialPageSize={50}
            hidePageSizeSelector={true}
            onRowClick={(row) => { setSelectedItem(row); setDetailOpen(true); }}
            renderMobileItem={(row) => (
              <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm flex items-center justify-between hover:border-red-200 transition-colors cursor-pointer">
                <div className="flex flex-col">
                  <span className="font-black text-slate-800">{row.serial}</span>
                  <span className="text-xs text-gray-400 font-mono">Modelo: {row.modelo}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); openEdit(row); }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
            emptyMessage={
              <div className="py-16 text-center">
                <LayoutGrid className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-xl font-bold text-gray-700 mb-2">No hay accesorios</h3>
                <p className="text-gray-500">No se encontraron accesorios con los filtros actuales.</p>
              </div>
            }
          />
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md p-6 bg-white sm:rounded-2xl shadow-2xl border border-gray-200">
          <VisuallyHidden>
            <DialogHeader>
              <DialogTitle>Detalle del Accesorio</DialogTitle>
              <DialogDescription>Información detallada del accesorio seleccionado.</DialogDescription>
            </DialogHeader>
          </VisuallyHidden>
          {selectedItem && (
            <div className="space-y-4 font-sans max-h-[80vh] overflow-y-auto">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{selectedItem.tipo}</p>
                  <h2 className="font-black text-slate-800 text-lg tracking-tight">Serial: {selectedItem.serial}</h2>
                  <p className="text-[10px] font-mono font-bold text-slate-400">Modelo: {selectedItem.modelo}</p>
                </div>
                <span className={cn(
                  'px-3 py-1 rounded-full text-[10px] font-black uppercase border',
                  estadoColor(selectedItem.estado)
                )}>
                  {selectedItem.estado || 'N/A'}
                </span>
              </div>

              {[
                { label: 'Tipo', value: selectedItem.tipo },
                { label: 'Condición', value: selectedItem.estado_acc },
                { label: 'Ubicación', value: selectedItem.rel_ubicacion?.nombre_ubicacion || selectedItem.ubicacion },
                { label: 'Sub Ubicación', value: selectedItem.rel_sub_ubicacion?.nombre || selectedItem.sub_ubicacion },
                { label: 'Rack', value: selectedItem.rack },
                {
                  label: 'Fecha Ingreso',
                  value: selectedItem.fecha_ingreso ? new Date(selectedItem.fecha_ingreso).toLocaleDateString() : '-'
                },
                {
                  label: 'Última Carga',
                  value: selectedItem.fecha_ultima_carga ? new Date(String(selectedItem.fecha_ultima_carga)).toLocaleDateString() : '-'
                },
              ].map(({ label, value }) => value ? (
                <div key={label} className="flex flex-col">
                  <span className="uppercase text-gray-400 font-normal text-xs mb-0.5">{label}</span>
                  <span className="text-gray-900 font-semibold text-sm">{value}</span>
                </div>
              ) : null)}

              <div className="pt-4 border-t border-gray-100 flex gap-3">
                <button
                  onClick={() => { setDetailOpen(false); openEdit(selectedItem); }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-red-600 text-white rounded-xl font-bold text-sm transition-all"
                >
                  <Edit className="w-4 h-4" /> Editar
                </button>
                <button
                  onClick={() => { setDetailOpen(false); handleDelete(selectedItem.id_accesorio); }}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl font-bold text-sm border border-red-100 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black tracking-tighter text-gray-900">
                {editingItem ? 'Editar Accesorio' : 'Nuevo Accesorio'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-700 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
              <div className="col-span-1">
                <label className="text-xs font-black text-gray-400 tracking-widest block mb-1">Tipo</label>
                <select
                  value={formData.tipo}
                  onChange={e => setFormData({ ...formData, tipo: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-red-100 focus:bg-white transition-all font-bold"
                >
                  <option value="">Seleccionar</option>
                  <option value="Batería">Batería</option>
                  <option value="Cargador">Cargador</option>
                  <option value="Manual">Manual</option>
                </select>
              </div>
              <div className="col-span-1">
                <label className="text-xs font-black text-gray-400 tracking-widest block mb-1">Modelo</label>
                <input
                  type="text"
                  value={formData.modelo}
                  onChange={e => setFormData({ ...formData, modelo: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-red-100 focus:bg-white transition-all font-bold"
                />
              </div>
              <div className="col-span-1">
                <label className="text-xs font-black text-gray-400 tracking-widest block mb-1">Serial</label>
                <input
                  type="text"
                  value={formData.serial}
                  onChange={e => setFormData({ ...formData, serial: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-red-100 focus:bg-white transition-all font-bold"
                />
              </div>
              <div className="col-span-1">
                <label className="text-xs font-black text-gray-400 tracking-widest block mb-1">Condición</label>
                <select
                  value={formData.estado_acc}
                  onChange={e => setFormData({ ...formData, estado_acc: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-red-100 focus:bg-white transition-all font-bold"
                >
                  <option value="Bueno">Bueno</option>
                  <option value="Regular">Regular</option>
                  <option value="Malo">Malo</option>
                </select>
              </div>
              <div className="col-span-1">
                <label className="text-xs font-black text-gray-400 tracking-widest block mb-1">Ubicación</label>
                <input
                  type="text"
                  value={formData.ubicacion}
                  onChange={e => setFormData({ ...formData, ubicacion: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-red-100 focus:bg-white transition-all font-bold"
                />
              </div>
              <div className="col-span-1">
                <label className="text-xs font-black text-gray-400 tracking-widest block mb-1">Rack</label>
                <input
                  type="text"
                  value={formData.rack}
                  onChange={e => setFormData({ ...formData, rack: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-red-100 focus:bg-white transition-all font-bold"
                />
              </div>
              <div className="col-span-2 flex justify-end gap-3 pt-4 border-t border-gray-100 mt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 text-gray-400 font-bold hover:text-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black transition-all tracking-tighter shadow-xl shadow-red-100"
                >
                  {editingItem ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
