'use client';

import { useState, useEffect } from 'react';
import { equipoUbicacionApi } from '@/services/taller-r1/equipo-ubicacion.service';
import { toast } from 'sonner';
import { Plus, Search, Box, Loader2, Wrench, Edit2, RefreshCw } from 'lucide-react';

interface RefaccionCatalogo {
  id_refaccion: number;
  refaccion: string;
  descripcion: string;
  precio: number;
  creado_en: string;
}

export default function RefaccionesPage() {
  const [data, setData] = useState<RefaccionCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // States
  const [formData, setFormData] = useState({
    refaccion: '',
    descripcion: '',
    precio: '' as number | '',
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await equipoUbicacionApi.getRefaccionesCatalogo();
      setData(res || []);
    } catch (e) {
      toast.error('Error al cargar catálogo de refacciones');
    } finally {
      setLoading(false);
    }
  };

  const filteredData = data.filter(i =>
    i.refaccion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.descripcion?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        refaccion: formData.refaccion,
        descripcion: formData.descripcion || 'Sin descripción',
        precio: Number(formData.precio) || 0
      };

      if (isEditing && selectedId) {
        await equipoUbicacionApi.updateRefaccionCatalogo(selectedId, payload);
        toast.success('Refacción actualizada exitosamente');
      } else {
        await equipoUbicacionApi.createRefaccionCatalogo(payload);
        toast.success('Refacción creada exitosamente');
      }
      
      setShowModal(false);
      setIsEditing(false);
      setSelectedId(null);
      loadData();
    } catch (e: any) { 
        toast.error(e?.response?.data?.message || 'Error al procesar la refacción'); 
    }
  };

  const handleEdit = (item: RefaccionCatalogo) => {
    setFormData({
      refaccion: item.refaccion,
      descripcion: item.descripcion,
      precio: item.precio,
    });
    setSelectedId(item.id_refaccion);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleSyncTotvs = async () => {
    try {
      setSyncing(true);
      const result = await equipoUbicacionApi.syncRefaccionesTotvs();
      toast.success(`Sincronización completada: ${result.creados} creados, ${result.actualizados} actualizados`);
      await loadData();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Error al sincronizar con TOTVS');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tighter font-brand">Refacciones</h1>
            <p className="text-sm text-gray-400 font-medium font-brand">Catálogo base de refacciones y precios</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSyncTotvs}
              disabled={syncing}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors font-brand font-black tracking-tighter disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sincronizar TOTVS'}
            </button>
            <button
              onClick={() => { setFormData({ refaccion: '', descripcion: '', precio: '' }); setIsEditing(false); setShowModal(true); }}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-red-600 text-white rounded-xl shadow-lg shadow-red-500/20 hover:bg-red-700 transition-colors font-brand font-black tracking-tighter"
            >
              <Plus className="w-5 h-5" />
              Nueva Refacción
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center gap-2 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por código o descripción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-100 focus:border-red-400 outline-none transition-all font-medium text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
          <div className="flex justify-center p-12">
              <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
          </div>
      ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredData.map(item => (
              <div
                key={item.id_refaccion}
                className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100 hover:border-red-100 hover:shadow-md transition-all flex flex-col items-center sm:items-start text-center sm:text-left relative group/card"
              >
                <button 
                  onClick={() => handleEdit(item)}
                  className="absolute bottom-4 right-4 p-2 bg-white text-gray-400 rounded-xl opacity-0 group-hover/card:opacity-100 transition-all hover:bg-red-50 hover:text-red-600 shadow-sm border border-gray-100"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <div className="flex items-start justify-between w-full gap-4 mb-4">
                  <div className="shrink-0 bg-red-50 rounded-2xl flex items-center justify-center p-3">
                    <Wrench className="w-8 h-8 text-red-500" />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Precio Estandar</p>
                    <p className="text-xl font-black text-slate-900">${Number(item.precio).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
                <div className="w-full flex justify-between flex-col">
                    <h3 className="font-black text-gray-900 tracking-tighter text-xl mb-1 uppercase break-words">{item.refaccion}</h3>
                    <p className="text-sm font-medium text-gray-400 line-clamp-2">{item.descripcion}</p>
                </div>
              </div>
            ))}
            {filteredData.length === 0 && (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-center bg-white rounded-[32px] border border-dashed border-gray-200">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-gray-300" />
                </div>
                <h3 className="text-gray-900 font-black text-lg mb-1 tracking-tighter">No se encontraron refacciones</h3>
                <p className="text-sm font-medium text-gray-400">Intenta buscar con otros términos.</p>
              </div>
            )}
          </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full p-8 font-brand relative border border-slate-100">
            <h2 className="text-2xl font-black mb-6 tracking-tighter text-gray-900">{isEditing ? 'Editar Refacción' : 'Agregar Refacción'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-black text-gray-400 tracking-widest block mb-1">Nombre / No. Parte</label>
                <input
                  type="text"
                  value={formData.refaccion}
                  onChange={e => setFormData({ ...formData, refaccion: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-red-100 focus:bg-white transition-all font-bold uppercase"
                  required
                  placeholder="Ej. BALERO, KIT DE SELLOS..."
                />
              </div>
              <div>
                <label className="text-xs font-black text-gray-400 tracking-widest block mb-1">Descripción</label>
                <textarea
                  value={formData.descripcion}
                  onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-red-100 focus:bg-white transition-all font-bold resize-none"
                  rows={2}
                  placeholder="Descripción de la pieza"
                />
              </div>
              <div>
                <label className="text-xs font-black text-gray-400 tracking-widest block mb-1">Precio Unitario ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.precio}
                  onChange={e => {
                    const val = parseFloat(e.target.value);
                    setFormData({ ...formData, precio: isNaN(val) ? '' : val });
                  }}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-red-100 focus:bg-white transition-all font-bold"
                  required
                  placeholder="0.00"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 text-gray-400 font-bold hover:text-red-500 transition-colors"
                >
                  Cancelar
                </button>
                <button type="submit" className="px-6 py-2 bg-red-600 text-white rounded-xl font-black transition-all hover:bg-black tracking-tighter shadow-lg shadow-red-500/20">
                  {isEditing ? 'Guardar Cambios' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
