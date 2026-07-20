'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { ubicacionesApi, Ubicacion } from '@/services/taller-r1/ubicaciones.service';
import { toast } from 'sonner';
import { Plus, Search, Edit, Trash2, Tag, Box, Loader2, AlertCircle, X, ExternalLink, Move, Package, Wrench } from 'lucide-react';
import { QrScannerButton } from '@/components/ui/qr-scanner-button';
import { useAuthStore } from '@/store/auth.store';
import QRCode from 'qrcode';
import { equipoUbicacionApi, EquipoUbicacion } from '@/services/taller-r1/equipo-ubicacion.service';
import { accesoriosApi, Accesorio } from '@/services/taller-r1/accesorios.service';
import { EquipoUbicacionDetailsModal } from '@/components/taller-r1/equipo-ubicacion/EquipoUbicacionDetailsModal';
import { MovilizacionModal } from '../equipo-ubicacion/MovilizacionModal';
import { generateQRLabel } from '@/lib/generateQRLabel';

interface SubUbicacion {
  id_sub_ubicacion: string;
  nombre: string;
  id_ubicacion: string;
  ubicacion_ocupada: boolean;
}

export default function UbicacionesPage() {
  const { user } = useAuthStore();
  const rawRole = typeof user?.role === 'string' ? user.role : ((user?.role as any)?.name || '');
  const isAdmin = rawRole.toUpperCase() === 'SUPERADMIN' || rawRole.toUpperCase() === 'ADMINISTRADOR';

  const [data, setData] = useState<Ubicacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [deleteConfirmLocation, setDeleteConfirmLocation] = useState<Ubicacion | null>(null);
  const [deleteConfirmSubLocation, setDeleteConfirmSubLocation] = useState<SubUbicacion | null>(null);

  // States
  const [editingItem, setEditingItem] = useState<Ubicacion | null>(null);
  const [formData, setFormData] = useState({
    nombre_ubicacion: '',
    maximo_stock: '' as number | '',
    Clase: '',
  });

  // Details State
  const [selectedLocation, setSelectedLocation] = useState<Ubicacion | null>(null);
  const [subLocations, setSubLocations] = useState<SubUbicacion[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

  // Detalles de equipo
  const [equipos, setEquipos] = useState<EquipoUbicacion[]>([]);
  const [selectedEquipo, setSelectedEquipo] = useState<EquipoUbicacion | null>(null);
  
  // Accesorios
  const [accesorios, setAccesorios] = useState<Accesorio[]>([]);

  // Movilización
  const [movilizarModalOpen, setMovilizarModalOpen] = useState(false);
  const [itemToMovilizar, setItemToMovilizar] = useState<EquipoUbicacion | null>(null);

  // Modal de contenido de sub-ubicación
  const [showSubContentModal, setShowSubContentModal] = useState(false);
  const [subContentData, setSubContentData] = useState<{ sub: SubUbicacion; equipos: EquipoUbicacion[]; accesorios: Accesorio[] } | null>(null);

  // QR Caching
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [res, equiposRes, accesoriosRes] = await Promise.all([
        ubicacionesApi.getAll(),
        equipoUbicacionApi.getAll(),
        accesoriosApi.getAll()
      ]);
      setData(res);
      setEquipos(equiposRes);
      setAccesorios(accesoriosRes);
      generateQRCodes(res);
    } catch (e) {
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const generateQRCodes = async (ubicaciones: Ubicacion[]) => {
    const codes: Record<string, string> = {};
    for (const ubi of ubicaciones) {
      try {
        codes[ubi.id_ubicacion] = await QRCode.toDataURL(ubi.nombre_ubicacion, {
          margin: 1,
          width: 80,
          color: { dark: '#000000', light: '#FFFFFF' }
        });
      } catch (err) {
        console.error('Error generating QR:', err);
      }
    }
    setQrCodes(codes);
  };

  const filteredData = data.filter(i =>
    i.nombre_ubicacion?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        maximo_stock: Number(formData.maximo_stock) || 0
      };

      if (editingItem) {
        await ubicacionesApi.update(editingItem.id_ubicacion, payload);
        toast.success('Actualizado');
      } else {
        await ubicacionesApi.create(payload);
        toast.success('Creado');
      }
      setShowModal(false);
      loadData();
    } catch (e: any) { 
        toast.error(e?.response?.data?.message || 'Error al guardar'); 
    }
  };

  // Sub-locations Logic
  const handleViewDetails = async (ubicacion: Ubicacion) => {
    setSelectedLocation(ubicacion);
    setLoadingSubs(true);
    setShowDetailModal(true);

    try {
      const subs = await ubicacionesApi.getSubLocations(ubicacion.id_ubicacion);
      setSubLocations(subs);
    } catch (e) {
      toast.error('Error al cargar sub-ubicaciones');
    } finally {
      setLoadingSubs(false);
    }
  };

  const handleDeleteSubLocation = async (sub: SubUbicacion) => {
    if (!selectedLocation) return;
    setDeleteConfirmSubLocation(sub);
    setShowDetailModal(false);
  };

  const handleOpenEquipo = (subId: string) => {
    const equipo = equipos.find(e => e.id_sub_ubicacion === subId);
    if (equipo) {
        setSelectedEquipo(equipo);
    } else {
        toast.error('No se encontró el detalle del equipo para esta sub-ubicación.');
    }
  };

  const handleGenerateQREquipo = async (item: EquipoUbicacion) => {
    try {
      await generateQRLabel({
        serial: item.serial_equipo || 'SN-UNKNOWN',
        site: 'r1'
      });
      toast.success('Etiqueta generada correctamente');
    } catch (error) {
      console.error('Error generating QR:', error);
      toast.error('Error al generar la etiqueta');
    }
  };



  const freeSubs = subLocations.filter(s => !s.ubicacion_ocupada);
  const occupiedSubs = subLocations.filter(s => s.ubicacion_ocupada);

  const getItemsInSub = (subId: string) => {
    const eqs = equipos.filter(e => e.id_sub_ubicacion === subId && e.estado !== 'Retirado');
    const accs = accesorios.filter(a => a.sub_ubicacion === subId && a.estado !== 'Retirado');
    return { equipos: eqs, accesorios: accs };
  };

  const handleOpenSubContent = (sub: SubUbicacion) => {
    const { equipos: eqs, accesorios: accs } = getItemsInSub(sub.id_sub_ubicacion);
    setSubContentData({ sub, equipos: eqs, accesorios: accs });
    setShowSubContentModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tighter font-brand">Ubicaciones</h1>
            <p className="text-sm text-gray-400 font-medium font-brand">Gestión de espacios en almacén y generación de QRs</p>
          </div>
          <button
            onClick={() => { setEditingItem(null); setFormData({ nombre_ubicacion: '', maximo_stock: '', Clase: '' }); setShowModal(true); }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-red-600 text-white rounded-xl shadow-lg shadow-red-500/20 hover:bg-red-700 transition-colors font-brand font-black tracking-tighter"
          >
            <Plus className="w-5 h-5" />
            Nueva Ubicación
          </button>
        </div>

        {/* Search */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center gap-2 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por cuadrante..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-100 focus:border-red-400 outline-none transition-all font-medium text-sm"
              />
            </div>
            <QrScannerButton onScan={(value) => setSearchTerm(value)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredData.map(item => (
          <div
            key={item.id_ubicacion}
            className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100 hover:border-red-100 hover:shadow-md transition-all flex flex-col items-center sm:items-start text-center sm:text-left relative cursor-pointer"
            onClick={() => handleViewDetails(item)}
          >
            <div className="flex flex-col items-center justify-between w-full h-full gap-4">
              <div className="shrink-0 bg-white rounded-2xl flex items-center justify-center pt-2">
                {qrCodes[item.id_ubicacion] ? (
                  <img src={qrCodes[item.id_ubicacion]} alt="QR Code" className="w-[100px] h-[100px] object-cover" />
                ) : (
                  <div className="w-[100px] h-[100px] bg-gray-100 rounded-xl flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 w-full flex flex-col items-center justify-center pb-2">
                <h3 className="font-black text-gray-900 tracking-tighter text-xl text-center w-full uppercase leading-tight px-2 break-words">{item.nombre_ubicacion}</h3>
                <span className="inline-flex items-center text-xs font-bold text-gray-400 uppercase tracking-widest mt-2 bg-gray-50 px-3 py-1 rounded-lg">
                  {item.Clase || 'Sin Clase'}
                </span>
              </div>

            </div>
          </div>
        ))}
        {filteredData.length === 0 && (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-center bg-white rounded-[32px] border border-dashed border-gray-200">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-gray-900 font-black text-lg mb-1 tracking-tighter">No se encontraron ubicaciones</h3>
            <p className="text-sm font-medium text-gray-400">Intenta buscar con otros términos.</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full p-8 font-brand relative border border-slate-100">
            <button 
              onClick={() => setShowConfirmCancel(true)} 
              className="absolute right-6 top-6 p-2 bg-white/80 backdrop-blur-sm border border-slate-200 text-slate-500 rounded-full hover:bg-slate-100 hover:text-red-600 transition-all shadow-sm z-50"
            >
              <X className="w-5 h-5 stroke-[3px]" />
            </button>
            <h2 className="text-2xl font-black mb-6 tracking-tighter text-gray-900">Detalle Ubicación</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-black text-gray-400 tracking-widest block mb-1">Cuadrante</label>
                <input
                  type="text"
                  value={formData.nombre_ubicacion}
                  onChange={e => setFormData({ ...formData, nombre_ubicacion: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-red-100 focus:bg-white transition-all font-bold uppercase"
                  required
                  placeholder="Ej. BLOQUE A1"
                />
              </div>
              <div>
                <label className="text-xs font-black text-gray-400 tracking-widest block mb-1">Stock Máximo por cuadrante</label>
                <input
                  type="number"
                  value={formData.maximo_stock}
                  onChange={e => {
                    const val = parseInt(e.target.value);
                    setFormData({ ...formData, maximo_stock: isNaN(val) ? '' : val });
                  }}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-red-100 focus:bg-white transition-all font-bold"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-black text-gray-400 tracking-widest block mb-1">Clase Permitida</label>
                <select
                  value={formData.Clase}
                  onChange={e => setFormData({ ...formData, Clase: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-red-100 focus:bg-white transition-all font-bold appearance-none"
                  required
                >
                  <option value="" disabled>Seleccione una clase...</option>
                  <option value="Clase I">Clase I</option>
                  <option value="Clase II">Clase II</option>
                  <option value="Clase III">Clase III</option>
                  <option value="Accesorio">Accesorio</option>
                  <option value="Patin">Patin</option>
                  <option value="Todas las clases">Todas las clases</option>
                </select>
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

      {/* Sub-locations Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-gray-50 border-none shadow-2xl rounded-[2rem]">
          <VisuallyHidden.Root>
            <DialogTitle>Detalles de Sub-ubicaciones</DialogTitle>
          </VisuallyHidden.Root>
          {selectedLocation && (
            <div className="flex flex-col h-[80vh] font-brand">
              <div className="flex items-center justify-between p-6 bg-white border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-6">
                  <div className="shrink-0 bg-white rounded-2xl flex items-center justify-center p-2 shadow-sm border border-gray-100">
                    {qrCodes[selectedLocation.id_ubicacion] ? (
                      <img src={qrCodes[selectedLocation.id_ubicacion]} alt="QR" className="w-[60px] h-[60px]" />
                    ) : <Box className="w-[60px] h-[60px] text-gray-300" />}
                  </div>
                  <div>
                    <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Cuadrante</h2>
                    <p className="text-3xl font-black text-gray-900 tracking-tighter">{selectedLocation.nombre_ubicacion}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <button
                      disabled={occupiedSubs.length > 0}
                      onClick={() => {
                        setShowDetailModal(false);
                        setTimeout(() => setDeleteConfirmLocation(selectedLocation), 150);
                      }}
                      className={`p-3 rounded-2xl transition-all flex items-center gap-2 font-bold text-sm ${occupiedSubs.length > 0 ? 'bg-gray-50 text-gray-300 cursor-not-allowed' : 'bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700'}`}
                      title={occupiedSubs.length > 0 ? 'Existen sub-ubicaciones en uso' : 'Eliminar Cuadrante completo'}
                    >
                      <Trash2 className="w-5 h-5" />
                      <span className="hidden sm:inline">Eliminar</span>
                    </button>
                  )}
                  <button
                    onClick={() => { setEditingItem(selectedLocation); setFormData({ ...selectedLocation, Clase: selectedLocation.Clase || '' }); setShowModal(true); setShowDetailModal(false); }}
                    className="p-3 bg-gray-50 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-2xl transition-all flex items-center gap-2 font-bold text-sm"
                  >
                    <Edit className="w-5 h-5" />
                    <span className="hidden sm:inline">Editar</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
                    <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Stock Máximo por Cuadrante</h2>
                    <p className="text-4xl font-black text-gray-900 tracking-tighter">{selectedLocation.maximo_stock}</p>
                  </div>
                  <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
                    <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Sub Ubicaciones Creadas</h2>
                    <p className="text-4xl font-black text-gray-900 tracking-tighter flex items-center gap-3">
                      {subLocations.length}
                      <span className="text-sm text-gray-400 tracking-normal font-medium">
                        / {selectedLocation.maximo_stock} disponibles
                      </span>
                    </p>
                  </div>
                </div>



                {loadingSubs ? (
                  <div className="flex justify-center p-12">
                    <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Libres Column */}
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Libres</h3>
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">{freeSubs.length}</span>
                      </div>
                      <div className="bg-white rounded-[24px] border border-gray-100 overflow-hidden shadow-sm">
                        {freeSubs.length === 0 ? (
                          <div className="p-8 text-center text-gray-400 text-sm font-medium">No hay sub-ubicaciones libres</div>
                        ) : (
                          <div className="divide-y divide-gray-50">
                            {freeSubs.map(sub => (
                              <div key={sub.id_sub_ubicacion} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group">
                                <span className="font-black text-green-600 tracking-tighter">{sub.nombre}</span>
                                 {isAdmin && (
                                   <button 
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       handleDeleteSubLocation(sub);
                                     }}
                                     className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                     title="Eliminar sub-ubicación"
                                   >
                                     <Trash2 className="w-4 h-4" />
                                   </button>
                                 )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Ocupadas Column */}
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Ocupadas</h3>
                        <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold">{occupiedSubs.length}</span>
                      </div>
                      <div className="bg-white rounded-[24px] border border-gray-100 overflow-hidden shadow-sm">
                        {occupiedSubs.length === 0 ? (
                          <div className="p-8 text-center text-gray-400 text-sm font-medium">No hay sub-ubicaciones ocupadas</div>
                        ) : (
                          <div className="divide-y divide-gray-50">
                            {occupiedSubs.map(sub => {
                              const { equipos: eqs, accesorios: accs } = getItemsInSub(sub.id_sub_ubicacion);
                              const totalItems = eqs.length + accs.length;
                              const equipoEnSub = eqs[0];
                              return (
                                <div 
                                  key={sub.id_sub_ubicacion} 
                                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
                                >
                                  <span 
                                    className="font-black text-red-600 tracking-tighter flex items-center gap-2 cursor-pointer flex-1"
                                    onClick={() => handleOpenEquipo(sub.id_sub_ubicacion)}
                                  >
                                    {sub.nombre}
                                    <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-red-500 transition-colors" />
                                  </span>
                                  <div className="flex items-center gap-2">
                                    {totalItems > 0 && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenSubContent(sub);
                                        }}
                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition-colors text-xs font-bold"
                                        title="Ver contenido"
                                      >
                                        <Package className="w-3 h-3" />
                                        {eqs.length > 0 && <span>{eqs.length} {eqs.length === 1 ? 'equipo' : 'equipos'}</span>}
                                        {eqs.length > 0 && accs.length > 0 && <span className="text-amber-400">·</span>}
                                        {accs.length > 0 && <span>{accs.length} {accs.length === 1 ? 'accesorio' : 'accesorios'}</span>}
                                      </button>
                                    )}
                                    {totalItems === 0 && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenSubContent(sub);
                                        }}
                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 hover:bg-gray-100 text-gray-400 rounded-lg transition-colors text-xs font-bold"
                                        title="Ver contenido"
                                      >
                                        <Package className="w-3 h-3" />
                                        Vacía
                                      </button>
                                    )}
                                    {equipoEnSub && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setItemToMovilizar(equipoEnSub);
                                          setMovilizarModalOpen(true);
                                        }}
                                        className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Trasladar equipo"
                                      >
                                        <Move className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Confirm Dialog for editing locations */}
      {showConfirmCancel && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md p-8 bg-white shadow-2xl rounded-[2rem] animate-in zoom-in-95 duration-200">
            <div className="p-2 space-y-6">
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-[#D8262F] mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">¿Descartar cambios?</h2>
                <p className="text-sm text-slate-500 font-medium">
                  Tienes datos que no han sido guardados.
                </p>
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
                  className="flex-1 py-4 bg-[#D8262F] hover:bg-[#b91c24] border border-transparent shadow-lg text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                >
                  Descartar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Styled Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirmLocation} onOpenChange={(open) => {
        if (!open) {
          setDeleteConfirmLocation(null);
          setTimeout(() => setShowDetailModal(true), 150);
        }
      }}>
        <DialogContent className="max-w-sm p-6 bg-white sm:rounded-[2rem] shadow-2xl border border-red-100/50">
          <VisuallyHidden.Root>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
          </VisuallyHidden.Root>
          
          <div className="flex flex-col items-center text-center space-y-4 pt-4">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-2 shadow-sm border border-red-100/30">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            
            <h3 className="text-xl font-black text-slate-800 tracking-tight">¿Eliminar Ubicación?</h3>
            <p className="text-slate-500 text-sm font-medium leading-relaxed px-4">
              Estás a punto de eliminar el cuadrante <strong className="text-slate-800 font-bold">{deleteConfirmLocation?.nombre_ubicacion}</strong> y todas sus posiciones asociadas.<br/><br/>
              Esta acción no se puede deshacer.
            </p>
            
            <div className="flex w-full gap-3 mt-8">
              <button
                onClick={() => {
                  setDeleteConfirmLocation(null);
                  setTimeout(() => setShowDetailModal(true), 150);
                }}
                className="flex-1 px-4 py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  try {
                    await ubicacionesApi.delete(deleteConfirmLocation!.id_ubicacion);
                    toast.success('Cuadrante eliminado correctamente');
                    setDeleteConfirmLocation(null);
                    setShowDetailModal(false);     
                    loadData();
                  } catch (e: any) {
                    toast.error(e?.response?.data?.message || 'Error al eliminar la ubicación');
                  }
                }}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-200 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4"/>
                Eliminar
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Styled Delete Confirm Dialog for Sub-locations */}
      <Dialog open={!!deleteConfirmSubLocation} onOpenChange={(open) => {
        if (!open) {
          setDeleteConfirmSubLocation(null);
          setTimeout(() => setShowDetailModal(true), 150);
        }
      }}>
        <DialogContent className="max-w-sm p-6 bg-white sm:rounded-[2rem] shadow-2xl border border-red-100/50">
          <VisuallyHidden.Root>
            <DialogTitle>Confirmar Eliminación Sub-ubicación</DialogTitle>
          </VisuallyHidden.Root>
          
          <div className="flex flex-col items-center text-center space-y-4 pt-4">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-2 shadow-sm border border-red-100/30">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            
            <h3 className="text-xl font-black text-slate-800 tracking-tight">¿Eliminar Posición?</h3>
            <p className="text-slate-500 text-sm font-medium leading-relaxed px-4">
              Estás a punto de eliminar la sub-ubicación <strong className="text-slate-800 font-bold">{deleteConfirmSubLocation?.nombre}</strong> del cuadrante {selectedLocation?.nombre_ubicacion}.<br/><br/>
              Esta acción no se puede deshacer.
            </p>
            
            <div className="flex w-full gap-3 mt-8">
              <button
                onClick={() => {
                  setDeleteConfirmSubLocation(null);
                  setTimeout(() => setShowDetailModal(true), 150);
                }}
                className="flex-1 px-4 py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  try {
                    await ubicacionesApi.deleteSubLocation(selectedLocation!.id_ubicacion, deleteConfirmSubLocation!.id_sub_ubicacion);
                    toast.success('Sub-ubicación eliminada');
                    setDeleteConfirmSubLocation(null);
                    
                    // Refresh sub-locations list
                    const subs = await ubicacionesApi.getSubLocations(selectedLocation!.id_ubicacion);
                    setSubLocations(subs);
                    loadData();
                    
                    setTimeout(() => setShowDetailModal(true), 150);
                  } catch (e: any) {
                    toast.error(e?.response?.data?.message || 'Error al eliminar sub-ubicación');
                  }
                }}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-200 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4"/>
                Eliminar
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <EquipoUbicacionDetailsModal
        isOpen={!!selectedEquipo}
        onClose={() => setSelectedEquipo(null)}
        selectedItem={selectedEquipo}
        onGenerateQR={handleGenerateQREquipo}
        onMovilizar={(item) => {
          setItemToMovilizar(item);
          setMovilizarModalOpen(true);
        }}
      />

      <MovilizacionModal
        open={movilizarModalOpen}
        onOpenChange={setMovilizarModalOpen}
        equipo={itemToMovilizar}
        onSuccess={loadData}
      />

      {/* Sub-ubicación Content Modal */}
      <Dialog open={showSubContentModal} onOpenChange={setShowSubContentModal}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden bg-gray-50 border-none shadow-2xl rounded-[2rem]">
          <VisuallyHidden.Root>
            <DialogTitle>Contenido de Sub-ubicación</DialogTitle>
          </VisuallyHidden.Root>
          {subContentData && (
            <div className="flex flex-col max-h-[80vh] font-brand">
              <div className="flex items-center justify-between p-6 bg-white border-b border-gray-100 shrink-0">
                <div>
                  <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Contenido de</h2>
                  <p className="text-2xl font-black text-gray-900 tracking-tighter">{subContentData.sub.nombre}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {subContentData.equipos.length} {subContentData.equipos.length === 1 ? 'equipo' : 'equipos'} · {subContentData.accesorios.length} {subContentData.accesorios.length === 1 ? 'accesorio' : 'accesorios'}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {subContentData.equipos.length === 0 && subContentData.accesorios.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    <Package className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                    <p className="font-bold">Esta sub-ubicación está vacía</p>
                  </div>
                )}

                {subContentData.equipos.length > 0 && (
                  <div>
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Wrench className="w-4 h-4" />
                      Equipos ({subContentData.equipos.length})
                    </h3>
                    <div className="space-y-2">
                      {subContentData.equipos.map(eq => (
                        <div key={eq.id_equipo_ubicacion} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-4">
                          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                            <Wrench className="w-5 h-5 text-blue-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-gray-900 tracking-tight text-sm truncate">{eq.serial_equipo || 'Sin serial'}</p>
                            <p className="text-xs text-gray-400 font-medium">{eq.modelo} · {eq.clase}</p>
                          </div>
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg shrink-0 ${
                            eq.estado === 'Ubicado' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-500'
                          }`}>
                            {eq.estado}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {subContentData.accesorios.length > 0 && (
                  <div>
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Accesorios ({subContentData.accesorios.length})
                    </h3>
                    <div className="space-y-2">
                      {subContentData.accesorios.map(acc => (
                        <div key={acc.id_accesorio} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-4">
                          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
                            <Package className="w-5 h-5 text-amber-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-gray-900 tracking-tight text-sm truncate">{acc.serial || 'Sin serial'}</p>
                            <p className="text-xs text-gray-400 font-medium">{acc.modelo} · {acc.tipo}</p>
                          </div>
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg shrink-0 ${
                            acc.estado === 'Ingresado' || acc.estado === 'Ubicado' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-500'
                          }`}>
                            {acc.estado}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
