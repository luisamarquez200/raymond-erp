'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, Truck, HardDrive, ShieldCheck, MapPin, 
  User, Briefcase, Calendar, Clock, Edit, FileSpreadsheet, CheckCircle2, XCircle, ArrowRight, Wrench, Search, X, BatteryCharging, Link as LinkIcon, Unlink
} from 'lucide-react';
import { Link } from '@/i18n/routing';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';
import { useConfigStore } from '@/store/config.store';
import PageLoader from '@/components/ui/PageLoader';
import RegistrarMantenimientoModal from '@/components/r4/flotilla/RegistrarMantenimientoModal';

export default function AssetCarnetPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { user } = useAuthStore();
  const { roleColors } = useConfigStore();
  const currentColor = user?.role ? (roleColors[(typeof user.role === 'string' ? user.role : (user.role as any)?.name || '').toLowerCase()] || roleColors.administrador) : roleColors.administrador;
  const [asset, setAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');

  const [mantenimientoModalOpen, setMantenimientoModalOpen] = useState(false);
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
      if (isAdc) {
        await api.post(`/r4/flotilla/${id}/solicitar-cambio`, {
          estatus: newStatus,
          estatus_operativo: newStatus
        });
        toast.success(`Solicitud enviada: Cambio de estatus a "${newStatus}" enviado para aprobación de Gerencia`);
      } else {
        await api.put(`/r4/flotilla/${id}/estatus`, { estatus: newStatus });
        toast.success(`Estatus actualizado a ${newStatus}`);
      }
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
      const res = await api.get('/r4/flotilla');
      const allAssets = res.data?.data || res.data || [];
      const query = accessorySearch.toLowerCase().trim();
      const filtered = (Array.isArray(allAssets) ? allAssets : []).filter((a: any) => {
        if (!a) return false;
        if (a.id === asset?.id || a.serie === asset?.serie) return false;

        const serie = (a.serie || '').toLowerCase();
        const oach = (a.oach || '').toLowerCase();
        const modelo = (a.modelo || '').toLowerCase();
        const tipo = (a.tipo || '').toLowerCase();
        const clase = (a.clase || '').toLowerCase();
        const idStr = (a.id || '').toLowerCase();

        return (
          serie.includes(query) ||
          oach.includes(query) ||
          modelo.includes(query) ||
          tipo.includes(query) ||
          clase.includes(query) ||
          idStr.includes(query)
        );
      });
      if (isAdc && loggedInAdcName) {
        filtered.sort((a: any, b: any) => {
          const aMatch = (a.adc || '').toLowerCase() === loggedInAdcName.toLowerCase() ? 1 : 0;
          const bMatch = (b.adc || '').toLowerCase() === loggedInAdcName.toLowerCase() ? 1 : 0;
          return bMatch - aMatch;
        });
      }
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
      const targetId = id || params.id;
      if (isAdc) {
        await api.post(`/r4/flotilla/${targetId}/solicitar-accesorios`, {
          accesorio_id: accesorioId,
          tipo_relacion: tipo || 'ACCESORIO'
        });
        toast.success('Solicitud de vinculación enviada a Administración/Gerencia para su aprobación');
      } else {
        await api.post(`/r4/flotilla/${targetId}/accesorios`, {
          accesorio_id: accesorioId,
          tipo_relacion: tipo || 'ACCESORIO'
        });
        toast.success('Accesorio vinculado exitosamente');
      }
      setLinkModalOpen(false);
      setAccessorySearch('');
      setAccessoryResults([]);
      fetchAssetDetails();
    } catch (error) {
      toast.error('Error al solicitar la vinculación del accesorio');
    } finally {
      setLinkingAccessory(false);
    }
  };

  const handleUnlinkAccessory = async (accesorioId: string) => {
    if (!confirm('¿Estás seguro de desvincular este accesorio?')) return;
    try {
      const targetId = id || params.id;
      if (isAdc) {
        await api.post(`/r4/flotilla/${targetId}/solicitar-desvincular-accesorios/${accesorioId}`);
        toast.success('Solicitud de desvinculación enviada a Administración/Gerencia');
      } else {
        await api.delete(`/r4/flotilla/${targetId}/accesorios/${accesorioId}`);
        toast.success('Accesorio desvinculado');
      }
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

  const isAdc = !isCoordinacionOrGerencia;
  const loggedInAdcName = user 
    ? (userRole === 'AUXILIAR' ? (user.adc_asociado_name || '') : `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || '')
    : '';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <PageLoader title="Cargando detalles" subtitle="Obteniendo información del equipo..." heightClassName="min-h-screen" color={currentColor} />
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

          {/* Estado de Mantenimiento (Imagen 4) */}
          <div className="bg-white rounded-3xl border border-emerald-100 shadow-sm overflow-hidden">
            <div className="p-5 bg-emerald-50/60 border-b border-emerald-100">
              <p className="text-[10px] font-black text-emerald-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ESTADO DE MANTENIMIENTO
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-slate-900">Al Día</span>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-emerald-200/60 text-xs">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Último SMP Realizado</p>
                  <p className="font-bold text-slate-800 mt-0.5">15 Abr 2026</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Próximo SMP</p>
                  <p className="font-bold text-rose-600 mt-0.5">15 May 2026</p>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-emerald-200/40 text-xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Distribuidor a Cargo</p>
                <p className="font-extrabold text-slate-800 flex items-center gap-1 mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />
                  {asset.propietario || 'Raymond MTY'}
                </p>
              </div>
            </div>

            <div className="p-4 bg-white">
              <button
                onClick={() => setMantenimientoModalOpen(true)}
                className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-xs"
              >
                <Wrench className="w-4 h-4 text-rose-600" />
                Registrar Mantenimiento
              </button>
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
                Baterías y Cargadores Vinculados
              </h3>
              <button
                onClick={() => setLinkModalOpen(true)}
                className="text-[10px] font-black uppercase tracking-widest bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-xl flex items-center gap-1 transition-all shadow-xs"
              >
                <LinkIcon className="w-3 h-3" /> Vincular
              </button>
            </div>

            <div className="space-y-3">
              {(!asset.accesorios || asset.accesorios.length === 0) ? (
                <div className="text-center py-6 bg-slate-50 border border-slate-200/60 rounded-2xl border-dashed">
                  <p className="text-xs font-bold text-slate-400">Sin accesorios vinculados a este equipo</p>
                </div>
              ) : (
                asset.accesorios.map((acc: any, index: number) => (
                  <div key={acc.id || acc.serie || index} className="flex items-center justify-between bg-slate-50/80 border border-slate-200/80 p-3.5 rounded-2xl shadow-xs hover:bg-white transition-all">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                          {acc.tipo_relacion || acc.tipo || 'ACCESORIO'}
                        </span>
                        <p className="text-xs font-black text-slate-900">{acc.serie || acc.id || '-'}</p>
                      </div>
                      <p className="text-[11px] font-semibold text-slate-500">
                        Modelo: <strong className="text-slate-700">{acc.modelo || '-'}</strong> {acc.oach ? `| OACH: ${acc.oach}` : ''}
                      </p>
                      {acc.cantidad > 1 && (
                        <p className="text-[10px] font-black text-amber-600">Cantidad: {acc.cantidad}</p>
                      )}
                    </div>
                    <button 
                      onClick={() => handleUnlinkAccessory(acc.id || acc.serie)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      title="Desvincular accesorio"
                    >
                      <Unlink className="w-4 h-4" />
                    </button>
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
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6 overflow-hidden max-w-full">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Historial de Cambios y Tracking</h3>
              <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Historial completo de transferencias, cambios de sitio y estatus con trazabilidad de usuarios</p>
            </div>
            
            <div className="relative border-l border-slate-200 pl-6 ml-3 space-y-6 max-w-full">
              {asset.historialCambios?.length === 0 ? (
                <p className="text-xs font-bold text-slate-400 py-4">No hay registros de movimientos previos.</p>
              ) : (
                asset.historialCambios?.map((log: any, idx: number) => {
                  let parsedJson: any = log.rawParsed || null;
                  let motivoText = log.motivo || '';

                  if (!parsedJson && typeof motivoText === 'string' && motivoText.trim().startsWith('{')) {
                    try { parsedJson = JSON.parse(motivoText); } catch (e) {}
                  }

                  const tipo = log.tipo || parsedJson?.tipo || (motivoText.toLowerCase().includes('transferencia') ? 'TRANSFERENCIA' : 'MOVIMIENTO');
                  const estado = log.estado || parsedJson?.estado || (log.aprobado ? 'APROBADA' : 'REGISTRADA');
                  
                  const rawSol = log.solicitante || parsedJson?.solicitante;
                  const rawAprob = log.aprobadoPor || parsedJson?.aprobado_por;
                  const rawRech = log.rechazadoPor || parsedJson?.rechazado_por;

                  const solicitante = (rawSol && rawSol !== 'Usuario' && rawSol !== 'sistema') ? rawSol : 'ADC / Solicitante';
                  const aprobadoPor = (rawAprob && rawAprob !== 'Sistema' && rawAprob !== 'sistema') ? rawAprob : (log.aprobado ? 'Administración' : null);
                  const rechazadoPor = (rawRech && rawRech !== 'Sistema' && rawRech !== 'sistema') ? rawRech : (estado === 'RECHAZADA' ? 'Administración' : null);

                  const sitioAnterior = log.sitioAnterior || parsedJson?.sitio_anterior_nombre || null;
                  const sitioNuevo = log.sitioNuevo || parsedJson?.sitio_nuevo_nombre || log.sitioNuevoId || null;

                  if (typeof motivoText === 'string' && motivoText.trim().startsWith('{')) {
                    if (tipo === 'TRANSFERENCIA' || parsedJson?.accion_nombre?.includes('Transferencia')) {
                      const orig = sitioAnterior || 'Sin sitio anterior';
                      const dest = sitioNuevo || 'Sin sitio nuevo';
                      if (estado === 'RECHAZADA') {
                        motivoText = `Transferencia Rechazada: ${orig} → ${dest}`;
                      } else if (estado === 'APROBADA' || log.aprobado) {
                        motivoText = `Transferencia Aprobada: ${orig} → ${dest}`;
                      } else {
                        motivoText = `Solicitud de Transferencia: ${orig} → ${dest}`;
                      }
                    } else if (parsedJson?.datos) {
                      const keys = Object.keys(parsedJson.datos);
                      const changes = keys.map(k => `${k}: ${parsedJson.datos[k]}`).join(', ');
                      motivoText = `Modificación de equipo: ${changes}`;
                    } else {
                      motivoText = parsedJson?.accion_nombre || 'Registro de movimiento';
                    }
                  }

                  if (typeof motivoText === 'string') {
                    motivoText = motivoText
                      .replace('por Sistema:', 'por Administración:')
                      .replace('por Sistema (', 'por Administración (')
                      .replace('(Solicitó: Usuario)', `(Solicitó: ${solicitante})`)
                      .replace('(Solicitó: sistema)', `(Solicitó: ${solicitante})`);
                  }

                  return (
                    <div key={log.id || idx} className="relative group bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 hover:border-amber-400/60 hover:bg-white transition-all space-y-3 max-w-full overflow-hidden shadow-xs">
                      <div className="absolute -left-[31px] top-4 w-3 h-3 rounded-full bg-slate-300 border-2 border-white group-hover:bg-amber-500 transition-colors shadow-xs" />
                      
                      {/* Header row: Badges and timestamp */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-200/80 text-slate-700">
                            {tipo}
                          </span>
                          
                          {estado === 'APROBADA' || log.aprobado ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> Aprobada
                            </span>
                          ) : estado === 'RECHAZADA' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                              <XCircle className="w-3 h-3" /> Rechazada
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3" /> Pendiente
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0">
                          {new Date(log.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Main description text with explicit line wrapping */}
                      <p className="text-xs font-bold text-slate-800 leading-relaxed break-words whitespace-normal max-w-full">
                        {motivoText}
                      </p>

                      {/* Transfer Route Box if sites exist */}
                      {(sitioAnterior || sitioNuevo) && (
                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200/80 text-xs font-semibold text-slate-700 max-w-full overflow-hidden">
                          <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <div className="flex flex-wrap items-center gap-1.5 min-w-0 max-w-full">
                            <span className="truncate max-w-[200px] text-slate-600">{sitioAnterior || 'Sitio Origen'}</span>
                            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="font-bold text-slate-900 truncate max-w-[200px]">{sitioNuevo || 'Sitio Destino'}</span>
                          </div>
                        </div>
                      )}

                      {/* User Traceability Footer */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1.5 text-[11px] text-slate-500 border-t border-slate-200/50">
                        <div className="flex items-center gap-1.5 min-w-0 max-w-full">
                          <User className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="truncate">
                            <strong className="text-slate-700">Solicitó (ADC/Usuario):</strong> {solicitante}
                          </span>
                        </div>

                        {(aprobadoPor || rechazadoPor) && (
                          <div className="flex items-center gap-1.5 min-w-0 max-w-full">
                            <ShieldCheck className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                            <span className="truncate">
                              <strong className="text-slate-700">
                                {rechazadoPor ? 'Rechazó (Admin):' : 'Aprobó (Admin):'}
                              </strong>{' '}
                              {rechazadoPor || aprobadoPor}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
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
                      <div key={acc.id} className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 hover:border-amber-300 hover:bg-amber-50/40 transition-colors">
                        <div>
                          <p className="text-sm font-black text-slate-900">{acc.serie || acc.id}</p>
                          <p className="text-xs font-bold text-slate-500">{acc.tipo || acc.clase || 'Accesorio'} {acc.modelo ? `- Modelo: ${acc.modelo}` : ''} {acc.oach ? `- OACH: ${acc.oach}` : ''}</p>
                        </div>
                        <button
                          onClick={() => handleLinkAccessory(acc.id || acc.serie, (acc.tipo?.toUpperCase().includes('CARGADOR') || acc.clase?.toUpperCase().includes('CARGADOR')) ? 'CARGADOR' : 'BATERIA')}
                          disabled={linkingAccessory || asset.accesorios?.some((a: any) => a.id === acc.id || a.serie === acc.serie)}
                          className="text-[10px] px-3.5 py-2 bg-amber-500 text-white hover:bg-amber-600 rounded-xl font-black uppercase tracking-widest transition-colors shadow-xs disabled:opacity-50"
                        >
                          {asset.accesorios?.some((a: any) => a.id === acc.id || a.serie === acc.serie) ? 'Vinculado' : 'Vincular'}
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

      {/* Modal para Registrar Mantenimiento */}
      <RegistrarMantenimientoModal 
        open={mantenimientoModalOpen} 
        onOpenChange={setMantenimientoModalOpen}
        equipoId={asset.id}
        serie={asset.serie}
        distribuidorActual={asset.propietario || 'Raymond MTY'}
        onSuccess={() => fetchAssetDetails()}
      />
    </div>
  );
}
