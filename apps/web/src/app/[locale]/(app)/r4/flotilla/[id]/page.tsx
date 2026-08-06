'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, Truck, HardDrive, ShieldCheck, MapPin, 
  User, Briefcase, Calendar, Clock, Edit, FileSpreadsheet, CheckCircle2, Wrench, Search, X, BatteryCharging, Link as LinkIcon, Unlink
} from 'lucide-react';
import { Link } from '@/i18n/routing';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';

export default function AssetCarnetPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { user } = useAuthStore();
  
  const [asset, setAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');

  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [accessorySearch, setAccessorySearch] = useState('');
  const [accessoryResults, setAccessoryResults] = useState<any[]>([]);
  const [searchingAccessories, setSearchingAccessories] = useState(false);
  const [linkingAccessory, setLinkingAccessory] = useState(false);

  const fetchAssetDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/r4/flotilla/${id}`);
      const data = res.data?.data || res.data;
      setAsset(data);
      setSelectedStatus(data?.estatus || '');
    } catch (error) {
      console.error('Error fetching asset details:', error);
      toast.error('Error al cargar los detalles del equipo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchAssetDetails();
  }, [id]);

  const handleStatusChange = async (newStatus: string) => {
    if (!newStatus) return;
    try {
      setUpdating(true);
      await api.put(`/r4/flotilla/${id}/estatus`, { estatus: newStatus });
      toast.success(`Estatus actualizado a ${newStatus}`);
      fetchAssetDetails(); // Refresh logs and data
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Error al actualizar el estatus');
    } finally {
      setUpdating(false);
    }
  };

  const handleSearchAccessory = async () => {
    if (!accessorySearch.trim()) return;
    try {
      setSearchingAccessories(true);
      // Busca en la flotilla equipos que sean Batería o Cargador, y que coincidan con la búsqueda
      const res = await api.get('/r4/flotilla');
      const allAssets = res.data?.data || [];
      const filtered = allAssets.filter((a: any) => 
        (a.tipo === 'Batería' || a.tipo === 'Cargador' || a.tipo?.toLowerCase().includes('bateria') || a.tipo?.toLowerCase().includes('cargador')) &&
        (a.serie.toLowerCase().includes(accessorySearch.toLowerCase()) || 
         a.oach?.toLowerCase().includes(accessorySearch.toLowerCase()))
      );
      setAccessoryResults(filtered);
    } catch (error) {
      toast.error('Error al buscar accesorios');
    } finally {
      setSearchingAccessories(false);
    }
  };

  const handleLinkAccessory = async (accesorioId: string, tipo: string) => {
    try {
      setLinkingAccessory(true);
      await api.post(`/r4/flotilla/${id}/accesorios`, {
        accesorio_id: accesorioId,
        tipo_relacion: tipo || 'ACCESORIO'
      });
      toast.success('Accesorio vinculado exitosamente');
      setLinkModalOpen(false);
      setAccessorySearch('');
      setAccessoryResults([]);
      fetchAssetDetails();
    } catch (error) {
      toast.error('Error al vincular el accesorio');
    } finally {
      setLinkingAccessory(false);
    }
  };

  const handleUnlinkAccessory = async (accesorioId: string) => {
    if (!confirm('¿Estás seguro de desvincular este accesorio?')) return;
    try {
      await api.delete(`/r4/flotilla/${id}/accesorios/${accesorioId}`);
      toast.success('Accesorio desvinculado');
      fetchAssetDetails();
    } catch (error) {
      toast.error('Error al desvincular el accesorio');
    }
  };

  const userRole = (typeof user?.role === 'string' ? user.role : (user?.role as any)?.name || '')?.toUpperCase();
  const isCoordinacionOrGerencia = 
    userRole === 'COORDINACION' || 
    userRole === 'COORDINADOR' || 
    userRole === 'GERENCIA' || 
    userRole === 'GERENTE' ||
    userRole === 'SUPERADMIN' ||
    userRole === 'ADMIN' ||
    userRole === 'ADMINISTRADOR';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col items-center gap-6 max-w-sm w-full animate-in fade-in zoom-in duration-500">
          <div className="relative w-24 h-24">
             <div className="absolute inset-0 border-4 border-red-50 rounded-full"></div>
             <div className="absolute inset-0 border-4 border-[#E1000F] rounded-full border-t-transparent animate-spin"></div>
             <Truck className="absolute inset-0 m-auto w-10 h-10 text-[#E1000F] animate-pulse" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Cargando detalles</h2>
            <p className="text-sm font-medium text-slate-500 mt-1">Obteniendo información del equipo...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] p-8">
        <div className="max-w-4xl mx-auto bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-4">
          <h2 className="text-xl font-black text-slate-900">Equipo no encontrado</h2>
          <p className="text-slate-500 font-medium">No se encontraron registros de la serie {id} en la plataforma.</p>
          <Link href="/r4/flotilla" className="inline-flex items-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">
            <ArrowLeft className="w-4 h-4" /> Volver a Flotilla
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-12">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-6 flex items-center gap-4 sticky top-0 z-20">
        <Link href="/r4/flotilla" className="p-2.5 hover:bg-slate-100 rounded-2xl transition-colors text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <span className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] mb-0.5 block">CARNET DE EQUIPO</span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            Serie: {asset.serie}
            <span className="text-xs font-bold text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg">
              Clase {asset.clase || '-'}
            </span>
          </h1>
        </div>
      </div>

      <div className="px-8 max-w-[1400px] mx-auto mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Technical Data and Status Control */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Estatus Actual */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Estatus del Equipo</h3>
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider border bg-slate-50 text-slate-800`}>
                {asset.estatus}
              </span>
            </div>
            
            {/* Control para cambiar estatus */}
            <div className="pt-4 border-t border-slate-100">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Modificar Estatus</label>
              <div className="flex gap-2">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  disabled={updating}
                  className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500 appearance-none cursor-pointer"
                >
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                  <option value="Comodato">Comodato</option>
                  <option value="Back Up">Back Up</option>
                  <option value="Inactivo con Cliente">Inactivo con Cliente</option>
                </select>
                <button
                  onClick={() => handleStatusChange(selectedStatus)}
                  disabled={updating || selectedStatus === asset.estatus}
                  className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-amber-100"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>

          {/* Ficha Técnica */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Especificaciones Técnicas</h3>
            <div className="grid grid-cols-2 gap-4 text-xs font-bold text-slate-600">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Modelo</p>
                <p className="text-slate-900 text-sm">{asset.modelo || '-'}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Clase</p>
                <p className="text-slate-900 text-sm">Clase {asset.clase || '-'}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">OACH</p>
                <p className="text-slate-900 text-sm">{asset.oach || '-'}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Altura</p>
                <p className="text-slate-900 text-sm">{asset.altura || '-'}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 col-span-2">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">BC</p>
                <p className="text-slate-900 text-sm">{asset.bc || '-'}</p>
              </div>
            </div>
          </div>

          {/* Accesorios Vinculados */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <BatteryCharging className="w-4 h-4 text-amber-500" />
                Accesorios
              </h3>
              {isCoordinacionOrGerencia && (
                <button
                  onClick={() => setLinkModalOpen(true)}
                  className="text-[10px] font-black uppercase tracking-widest bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <LinkIcon className="w-3 h-3" /> Vincular
                </button>
              )}
            </div>

            <div className="space-y-3">
              {(!asset.accesorios || asset.accesorios.length === 0) ? (
                <div className="text-center py-6 bg-slate-50 border border-slate-100 rounded-2xl border-dashed">
                  <p className="text-xs font-bold text-slate-400">Sin accesorios vinculados</p>
                </div>
              ) : (
                asset.accesorios.map((acc: any) => (
                  <div key={acc.accesorio_id} className="flex items-center justify-between bg-white border border-slate-100 p-3 rounded-2xl shadow-sm">
                    <div>
                      <p className="text-xs font-black text-slate-800">{acc.accesorio?.tipo || 'Accesorio'}</p>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">Serie: {acc.accesorio?.serie || '-'}</p>
                    </div>
                    {isCoordinacionOrGerencia && (
                      <button 
                        onClick={() => handleUnlinkAccessory(acc.accesorio_id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Desvincular"
                      >
                        <Unlink className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Columns: Current Rent & Timeline */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Ubicación y Contrato Vigente */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Ubicación y Contrato Vigente</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Ubicación */}
              <div className="space-y-3">
                <div className="flex gap-3 items-start">
                  <div className="p-2.5 bg-slate-100 rounded-xl text-slate-500 shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Cliente / Sitio</p>
                    <p className="text-sm font-black text-slate-900 mt-0.5">{asset.cliente}</p>
                    <p className="text-xs font-bold text-slate-500 mt-1">{asset.site}</p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="p-2.5 bg-slate-100 rounded-xl text-slate-500 shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Administrador (ADC)</p>
                    <p className="text-sm font-black text-slate-900 mt-0.5">{asset.adc}</p>
                  </div>
                </div>
                <div className="flex gap-3 items-start mt-3">
                  <div className="p-2.5 bg-slate-100 rounded-xl text-slate-500 shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Propietario</p>
                    <p className="text-sm font-black text-slate-900 mt-0.5">{asset.propietario || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Renta activa */}
              <div className="space-y-3 border-t md:border-t-0 md:border-l border-slate-100 md:pl-6 pt-3 md:pt-0">
                {asset.rentaActiva ? (
                  <>
                    <div className="flex justify-between items-center bg-emerald-50 border border-emerald-100 px-3.5 py-2.5 rounded-2xl">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-black text-emerald-800">Contrato Activo</span>
                      </div>
                      <span className="text-[10px] font-black text-emerald-700 bg-white px-2 py-0.5 rounded-lg border border-emerald-200">
                        {asset.rentaActiva.origen}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs font-bold text-slate-600">
                      <div>
                        <p className="text-[9px] text-slate-400 uppercase tracking-wider">Tarifa Renta</p>
                        <p className="text-slate-900 text-sm">${(asset.rentaActiva.tarifa || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400 uppercase tracking-wider">Moneda</p>
                        <p className="text-slate-900 text-sm">{(asset.rentaActiva.condiciones?.moneda || 'MXN').toUpperCase()}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400 uppercase tracking-wider">Inicio</p>
                        <p className="text-slate-900 text-sm">{new Date(asset.rentaActiva.fecha_inicio).toLocaleDateString('es-ES')}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400 uppercase tracking-wider">Fin</p>
                        <p className="text-slate-900 text-sm">{new Date(asset.rentaActiva.fecha_fin).toLocaleDateString('es-ES')}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center text-slate-400 font-bold text-xs">
                    Sin contrato de renta activo en el sistema.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Timeline Tracking */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Historial de Cambios y Tracking</h3>
              <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Historial completo de transferencias, cambios de sitio y estatus</p>
            </div>
            
            <div className="relative border-l border-slate-100 pl-6 ml-3 space-y-6">
              {asset.historialCambios?.length === 0 ? (
                <p className="text-xs font-bold text-slate-400 py-4">No hay registros de movimientos previos.</p>
              ) : (
                asset.historialCambios?.map((log: any, idx: number) => (
                  <div key={log.id || idx} className="relative group">
                    <div className="absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full bg-slate-200 border-2 border-white group-hover:bg-amber-500 transition-colors" />
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                      <div>
                        <p className="text-xs font-black text-slate-900">{log.motivo}</p>
                        {log.sitioNuevoId && (
                          <p className="text-[10px] font-bold text-slate-400 mt-0.5">Ubicación destino: {log.sitioNuevoId}</p>
                        )}
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        {new Date(log.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Modal para Vincular Accesorio */}
      {linkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-amber-500" />
                Vincular Accesorio
              </h3>
              <button onClick={() => { setLinkModalOpen(false); setAccessorySearch(''); setAccessoryResults([]); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Buscar Batería o Cargador</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="w-4 h-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      value={accessorySearch}
                      onChange={(e) => setAccessorySearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchAccessory()}
                      placeholder="Buscar por Serie o OACH..."
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <button
                    onClick={handleSearchAccessory}
                    disabled={searchingAccessories || !accessorySearch.trim()}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
                  >
                    {searchingAccessories ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
              </div>

              {accessoryResults.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Resultados ({accessoryResults.length})</h4>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                    {accessoryResults.map((acc: any) => (
                      <div key={acc.id} className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 hover:border-amber-200 hover:bg-amber-50/50 transition-colors">
                        <div>
                          <p className="text-sm font-black text-slate-800">{acc.serie}</p>
                          <p className="text-xs font-bold text-slate-500">{acc.tipo} {acc.oach ? `- OACH: ${acc.oach}` : ''}</p>
                        </div>
                        <button
                          onClick={() => handleLinkAccessory(acc.id, acc.tipo?.toUpperCase() === 'CARGADOR' ? 'CARGADOR' : 'BATERIA')}
                          disabled={linkingAccessory || asset.accesorios?.some((a: any) => a.accesorio_id === acc.id)}
                          className="text-[10px] px-3 py-1.5 bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-lg font-black uppercase tracking-widest transition-colors disabled:opacity-50"
                        >
                          {asset.accesorios?.some((a: any) => a.accesorio_id === acc.id) ? 'Vinculado' : 'Vincular'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
