'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { modelosApi, Modelo } from '@/services/taller-r1/modelos.service';
import { toast } from 'sonner';
import { Plus, Search, Edit, Trash2, X, Filter, AlertCircle, Tag } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

export default function ModelosPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'SUPERADMIN' || user?.role === 'ADMINISTRADOR';

  const [data, setData] = useState<Modelo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('Todos');
  const [showModal, setShowModal] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [editingItem, setEditingItem] = useState<Modelo | null>(null);
  const [formData, setFormData] = useState({ modelo: '', clase_id: 'Clase I' });

  const CLASSES = ["Clase I", "Clase II", "Clase III", "Patin", "Bateria", "Accesorio", "Cargador", "Otros"];

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await modelosApi.getAll();
      setData(res);
    } catch (e) { toast.error('Error'); }
    finally { setLoading(false); }
  };

  const filteredData = data.filter(i => {
    const searchMatch = i.modelo?.toLowerCase().includes(searchTerm.toLowerCase());
    const tabMatch = activeTab === 'Todos' || i.clase_id === activeTab;
    return searchMatch && tabMatch;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await modelosApi.update(editingItem.id_modelo, formData);
        toast.success('Modelo actualizado correctamente');
      } else {
        await modelosApi.create(formData);
        toast.success('Modelo creado correctamente');
      }
      setShowModal(false);
      loadData();
    } catch (e: any) {
      if (e.response?.status === 409) {
        toast.error(e.response.data.message || 'El modelo ya existe');
      } else {
        toast.error('Error al guardar el modelo');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tighter font-brand">Modelos</h1>
            <p className="text-sm text-gray-400 font-medium font-brand">Catálogo de modelos Raymond disponibles</p>
          </div>
          <button
            onClick={() => { setEditingItem(null); setFormData({ modelo: '', clase_id: 'Clase I' }); setShowModal(true); }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-red-600 text-white rounded-xl shadow-lg shadow-red-500/20 hover:bg-red-700 transition-colors font-brand font-black tracking-tighter"
          >
            <Plus className="w-5 h-5" />
            Nuevo Modelo
          </button>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-wrap bg-white rounded-xl shadow-sm border border-gray-100 p-2 gap-1">
            {['Todos', ...CLASSES].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex-grow sm:flex-grow-0 text-center ${activeTab === tab
                  ? 'bg-red-50 text-red-600 shadow-sm border border-red-100'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50 border border-transparent'
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por modelo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-100 focus:border-red-400 outline-none transition-all font-medium text-sm"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredData.map(item => (
          <div key={item.id_modelo} className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100 hover:border-red-100 hover:shadow-md transition-all flex flex-col items-center sm:items-start text-center sm:text-left relative">
            <div className="flex flex-col sm:flex-row justify-between w-full h-full gap-4">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 flex-1 min-w-0">
                <div className="w-14 h-14 shrink-0 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 transition-colors shadow-inner">
                  <Tag className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-gray-900 tracking-tighter text-xl truncate w-full">{item.modelo}</h3>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black bg-gray-100 text-gray-600 uppercase tracking-widest mt-2 border border-gray-200">
                    {item.clase_id || 'Sin Clase'}
                  </span>
                </div>
              </div>

              <div className="flex flex-row justify-center sm:flex-col gap-2 shrink-0 border-t sm:border-t-0 sm:border-l border-gray-100 pt-4 sm:pt-0 sm:pl-4 mt-2 sm:mt-0 w-full sm:w-auto">
                <button
                  onClick={() => { setEditingItem(item); setFormData({ ...item, clase_id: item.clase_id || 'Clase I' }); setShowModal(true); }}
                  className="p-3 text-gray-400 hover:text-blue-600 hover:bg-blue-50 bg-gray-50 sm:bg-transparent rounded-xl transition-all flex items-center justify-center"
                  title="Editar"
                >
                  <Edit className="w-5 h-5" />
                </button>
                {isAdmin && (
                  <button
                    onClick={async () => { if (confirm('¿Eliminar de forma permanente?')) { await modelosApi.delete(item.id_modelo); loadData(); } }}
                    className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 bg-gray-50 sm:bg-transparent rounded-xl transition-all flex items-center justify-center"
                    title="Eliminar"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {filteredData.length === 0 && (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-center bg-white rounded-[32px] border border-dashed border-gray-200">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-gray-900 font-black text-lg mb-1 tracking-tighter">No se encontraron modelos</h3>
            <p className="text-sm font-medium text-gray-400">Intenta buscar con otros términos o cambia la clase seleccionada.</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white  rounded-2xl shadow-2xl max-w-md w-full p-8 font-brand">
            <h2 className="text-2xl font-black mb-6  tracking-tighter text-gray-900 ">Detalle Modelo</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-black text-gray-400 tracking-widest block mb-1">Nombre Modelo / ID</label>
                <input
                  type="text"
                  value={formData.modelo}
                  onChange={e => setFormData({ ...formData, modelo: e.target.value.toUpperCase() })}
                  disabled={!!editingItem}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-red-100 focus:bg-white transition-all font-bold disabled:opacity-50 uppercase"
                  required
                  placeholder="Ej. R30X"
                />
                {editingItem && <p className="text-[10px] uppercase text-gray-400 mt-1 font-bold">El modelo no se puede modificar.</p>}
              </div>
              <div>
                <label className="text-xs font-black text-gray-400 tracking-widest block mb-1">Clase de Equipo</label>
                <div className="grid grid-cols-3 gap-2">
                  {CLASSES.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormData({ ...formData, clase_id: c })}
                      className={`px-3 py-2 text-xs font-bold rounded-xl transition-all border ${formData.clase_id === c
                        ? 'bg-red-50 border-red-200 text-red-600 shadow-sm'
                        : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowConfirmCancel(true)}
                  className="px-6 py-2 text-gray-400 font-bold hover:text-red-500 transition-colors"
                >
                  Cancelar
                </button>
                <button type="submit" className="px-6 py-2 bg-red-600 text-white rounded-xl font-black transition-all hover:bg-black tracking-tighter shadow-lg shadow-red-500/20">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Cierre */}
      <Dialog open={showConfirmCancel} onOpenChange={setShowConfirmCancel}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-white border-none shadow-2xl rounded-[2rem]">
          <div className="p-8 space-y-6">
            <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="text-center space-y-2">
              <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">¿Descartar cambios?</DialogTitle>
              <DialogDescription className="text-sm text-slate-500 font-medium">
                Tienes datos que no han sido guardados. Si cancelas ahora, perderás estos cambios definitivamente.
              </DialogDescription>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmCancel(false)}
                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
              >
                Continuar
              </button>
              <button
                onClick={() => {
                  setShowConfirmCancel(false);
                  setShowModal(false);
                }}
                className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-200 transition-all"
              >
                Descartar
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
