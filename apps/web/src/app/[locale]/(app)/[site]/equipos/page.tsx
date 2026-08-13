'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { equiposApi, Equipo } from '@/services/taller-r1/equipos.service';
import { modelosApi, Modelo } from '@/services/taller-r1/modelos.service';
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/SearchableSelect';
import { toast } from 'sonner';
import { Plus, Search, Edit, Trash2, Tag, Info, AlertCircle, Hash, Layers } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useAuthTallerStore } from '@/store/auth-taller.store';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function EquiposPage() {
  const { user } = useAuthStore();
  const { user: currentTallerUser } = useAuthTallerStore();
  const isVisitante = currentTallerUser?.role === 'Visitante';
  const isAdmin = user?.role === 'SUPERADMIN' || user?.role === 'ADMINISTRADOR';

  const [data, setData] = useState<Equipo[]>([]);
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('Todos');
  const [showModal, setShowModal] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [editingItem, setEditingItem] = useState<Equipo | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<Equipo | null>(null);

  const CLASSES = ["Clase I", "Clase II", "Clase III"];
  const ESTADOS = ["Por Ubicar", "Ubicado", "En Reparación", "Baja", "Disponible"];

  const initialFormState: Partial<Equipo> = {
    marca: 'Raymond',
    clase: 'Clase I',
    modelo: '',
    numero_serie: '',
    descripcion: '',
    estado: 'Por Ubicar'
  };

  const [formData, setFormData] = useState<Partial<Equipo>>(initialFormState);

  useEffect(() => {
    loadData();
    loadModelos();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await equiposApi.getAll();
      setData(res);
    } catch (e) { toast.error('Error al cargar equipos'); }
    finally { setLoading(false); }
  };

  const loadModelos = async () => {
    try {
      const res = await modelosApi.getAll();
      setModelos(res);
    } catch (e) {
      console.error('Error loading models', e);
    }
  };

  const filteredData = data.filter(i => {
    const term = searchTerm.toLowerCase();
    const searchMatch =
      (i.modelo || '').toLowerCase().includes(term) ||
      (i.numero_serie || '').toLowerCase().includes(term) ||
      (i.marca || '').toLowerCase().includes(term) ||
      (i.clase || '').toLowerCase().includes(term);
    const tabMatch = activeTab === 'Todos' || i.clase === activeTab;
    return searchMatch && tabMatch;
  });

  // Filter models by selected class. If no class is selected or no models exist for that class, show all models.
  const classModels = modelos.filter(m => !formData.clase || m.clase_id === formData.clase);
  const displayModels = classModels.length > 0 ? classModels : modelos;

  const modelOptions: SearchableSelectOption[] = displayModels.map(m => ({
    label: m.modelo || '',
    value: m.modelo || '',
    description: m.clase_id ? `Clase: ${m.clase_id}` : undefined
  }));

  // Auto-select first model only when creating a new equipment (not editing existing)
  useEffect(() => {
    if (formData.clase && showModal && !editingItem) {
      const validModels = modelos.filter(m => m.clase_id === formData.clase);
      if (validModels.length > 0) {
        if (!validModels.find(m => m.modelo === formData.modelo)) {
          setFormData(prev => ({ ...prev, modelo: validModels[0].modelo || '' }));
        }
      }
    }
  }, [formData.clase, modelos, showModal, editingItem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await equiposApi.update(editingItem.id_equipos, formData);
        toast.success('Equipo actualizado correctamente');
      } else {
        await equiposApi.create(formData);
        toast.success('Equipo creado correctamente');
      }
      setShowModal(false);
      loadData();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error al guardar el equipo');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmItem) return;
    try {
      await equiposApi.delete(deleteConfirmItem.id_equipos);
      toast.success('Equipo eliminado correctamente');
      loadData();
    } catch (error) {
      toast.error('Error al eliminar el equipo');
    } finally {
      setDeleteConfirmItem(null);
    }
  };

  const handleOpenEdit = (item: Equipo) => {
    setEditingItem(item);
    setFormData({
      id_equipos: item.id_equipos,
      marca: item.marca || 'Raymond',
      clase: item.clase || 'Clase I',
      modelo: item.modelo || '',
      numero_serie: item.numero_serie || '',
      descripcion: item.descripcion || '',
      estado: item.estado || 'Por Ubicar',
    });
    setShowModal(true);
  };

  const handleOpenNew = () => {
    setEditingItem(null);
    setFormData(initialFormState);
    setShowModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tighter font-brand">Equipos</h1>
            <p className="text-sm text-gray-400 font-medium font-brand">Catálogo de equipos y montacargas en planta</p>
          </div>
          {!isVisitante && (
            <button
              onClick={handleOpenNew}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-red-600 text-white rounded-xl shadow-lg shadow-red-500/20 hover:bg-red-700 transition-colors font-brand font-black tracking-tighter"
            >
              <Plus className="w-5 h-5" />
              Nuevo Equipo
            </button>
          )}
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-wrap bg-white rounded-xl shadow-sm border border-gray-100 p-2 gap-1 overflow-x-auto">
            {['Todos', ...CLASSES].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex-grow sm:flex-grow-0 whitespace-nowrap text-center ${activeTab === tab
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
              placeholder="Buscar por Modelo, Serie, Marca o Clase..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-100 focus:border-red-400 outline-none transition-all font-medium text-sm"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredData.map(item => (
          <div key={item.id_equipos} className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100 hover:border-red-100 hover:shadow-md transition-all flex flex-col relative">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 shrink-0 bg-red-50 rounded-xl flex items-center justify-center text-red-600 shadow-inner font-bold">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-gray-900 tracking-tighter text-lg">{item.modelo || 'Sin Modelo'}</h3>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{item.marca || 'Raymond'}</p>
                </div>
              </div>
              {item.estado && (
                <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg bg-gray-100 text-gray-600 border border-gray-200">
                  {item.estado}
                </span>
              )}
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400 font-medium flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-gray-400" /> Clase:
                </span>
                <span className="font-bold text-gray-900">{item.clase}</span>
              </div>
              {item.numero_serie && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400 font-medium flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-gray-400" /> Nº Serie:
                  </span>
                  <span className="font-bold text-gray-900">{item.numero_serie}</span>
                </div>
              )}
              {item.descripcion && (
                <p className="text-xs text-gray-500 line-clamp-2 pt-1 border-t border-gray-50">
                  {item.descripcion}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 mt-auto pt-4 border-t border-gray-100">
              {!isVisitante && (
                <button
                  onClick={() => handleOpenEdit(item)}
                  className="flex-1 py-2 text-sm font-bold text-gray-600 bg-gray-50 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Edit className="w-4 h-4" /> Editar
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => setDeleteConfirmItem(item)}
                  className="px-3 py-2 text-red-400 bg-red-50 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors flex items-center justify-center"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
        {filteredData.length === 0 && (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-center bg-white rounded-[32px] border border-dashed border-gray-200">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-gray-900 font-black text-lg mb-1 tracking-tighter">No se encontraron equipos</h3>
            <p className="text-sm font-medium text-gray-400">Intenta buscar con otros términos o cambia la clase seleccionada.</p>
          </div>
        )}
      </div>

      <Dialog open={showModal} onOpenChange={(open) => {
        if (!open) {
          setShowConfirmCancel(true);
        } else {
          setShowModal(true);
        }
      }}>
        <DialogContent className="max-w-md bg-white border-none shadow-2xl rounded-[2rem] p-6 font-brand overflow-hidden">
          <VisuallyHidden.Root><DialogTitle>Detalles del Equipo</DialogTitle></VisuallyHidden.Root>

          <h2 className="text-2xl font-black mb-6 tracking-tighter text-gray-900">
            {editingItem ? 'Editar Equipo' : 'Nuevo Equipo'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-gray-400 tracking-widest block mb-1 uppercase">Marca</label>
                <input
                  type="text"
                  value={formData.marca || ''}
                  onChange={e => setFormData({ ...formData, marca: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-red-100 focus:bg-white transition-all font-bold text-gray-900 text-sm"
                  placeholder="Raymond"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 tracking-widest block mb-1 uppercase">Nº de Serie</label>
                <input
                  type="text"
                  value={formData.numero_serie || ''}
                  onChange={e => setFormData({ ...formData, numero_serie: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-red-100 focus:bg-white transition-all font-bold text-gray-900 text-sm"
                  placeholder="SN-12345"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 tracking-widest block mb-2 uppercase">Clase de Equipo</label>
              <div className="grid grid-cols-3 gap-2">
                {CLASSES.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFormData({ ...formData, clase: c })}
                    className={`px-2 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all border ${formData.clase === c
                      ? 'bg-red-50 border-red-200 text-red-600 shadow-sm'
                      : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200 hover:bg-gray-50'
                      }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 tracking-widest block mb-1 uppercase flex items-center justify-between">
                <span>Modelo</span>
                {classModels.length === 0 && formData.clase && (
                  <span className="text-amber-500 font-bold normal-case tracking-normal flex items-center gap-1 text-[10px]">
                    <AlertCircle className="w-3 h-3" /> Mostrando todos los modelos
                  </span>
                )}
              </label>

              <SearchableSelect
                options={modelOptions}
                value={formData.modelo || ''}
                onChange={(val) => setFormData({ ...formData, modelo: val })}
                placeholder="Buscar o seleccionar modelo..."
                searchPlaceholder="Escribe el modelo para buscar..."
                emptyMessage="No se encontraron modelos"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 tracking-widest block mb-1 uppercase">Estado</label>
              <select
                value={formData.estado || 'Por Ubicar'}
                onChange={e => setFormData({ ...formData, estado: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-red-100 focus:bg-white transition-all font-bold text-gray-900 text-sm"
              >
                {ESTADOS.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 tracking-widest block mb-1 uppercase">Descripción (Opcional)</label>
              <textarea
                value={formData.descripcion || ''}
                onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                rows={2}
                className="w-full px-4 py-2 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-red-100 focus:bg-white transition-all font-medium text-gray-900 text-xs resize-none"
                placeholder="Detalles adicionales del equipo..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowConfirmCancel(true)}
                className="px-6 py-2 text-gray-400 font-bold hover:text-red-500 transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-red-600 text-white rounded-xl font-black transition-all hover:bg-black tracking-tighter shadow-lg shadow-red-500/20 text-sm"
              >
                {editingItem ? 'Guardar Cambios' : 'Guardar Equipo'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmItem} onOpenChange={(open) => !open && setDeleteConfirmItem(null)}>
        <AlertDialogContent className="font-brand rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black text-slate-900">¿Eliminar Equipo?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 font-medium">
              Esta acción no se puede deshacer. Se eliminará permanentemente el equipo
              <strong className="text-slate-900 ml-1 block mt-2 text-lg">"{deleteConfirmItem?.modelo || 'Sin Modelo'}"</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel className="rounded-xl font-bold bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:text-gray-900">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20"
            >
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Confirmación de Cierre */}
      <Dialog open={showConfirmCancel} onOpenChange={setShowConfirmCancel}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-white border-none shadow-2xl rounded-[2rem]">
          <div className="p-8 space-y-6">
            <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="text-center space-y-2">
              <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">¿Descartar cambios?</DialogTitle>
              <VisuallyHidden.Root><DialogDescription>Advertencia de descarte de cambios</DialogDescription></VisuallyHidden.Root>
              <p className="text-sm text-slate-500 font-medium">
                Tienes datos que no han sido guardados. Si cancelas ahora, perderás estos cambios definitivamente.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmCancel(false)}
                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
              >
                Continuar Editando
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
