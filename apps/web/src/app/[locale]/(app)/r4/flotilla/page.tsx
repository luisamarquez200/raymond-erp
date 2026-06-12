'use client';

import { 
  Search, Filter, Download, Grid3x3, List, Plus, Eye, Edit, 
  FileText, Clock, CheckCircle, Upload, X, FileSpreadsheet, 
  Wrench, Activity, CheckCircle2, AlertTriangle, ChevronRight, ShieldCheck, MapPin, Truck, HardDrive, Info
} from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';

const statusColors = {
  'Activo': 'bg-emerald-50 text-emerald-700 border-emerald-100',
  'En Renta': 'bg-blue-50 text-blue-700 border-blue-100',
  'Inactivo': 'bg-gray-50 text-gray-600 border-gray-200',
  'Disponible': 'bg-blue-50 text-blue-700 border-blue-100',
  'Back Up': 'bg-blue-50 text-blue-700 border-blue-100',
  'Inactivo con Cliente': 'bg-amber-50 text-amber-700 border-amber-100',
  'En Taller': 'bg-amber-50 text-amber-700 border-amber-100',
  'Mantenimiento': 'bg-amber-50 text-amber-700 border-amber-100',
};

const formatFilterText = (str: string) => {
  if (!str) return '-';
  if (str === str.toUpperCase() && str.length > 3) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export default function Fleet() {
  const { user } = useAuthStore();
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [fleetAssets, setFleetAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [showApprovalsTab, setShowApprovalsTab] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [selectedADC, setSelectedADC] = useState<string>('Todos');
  const [selectedCliente, setSelectedCliente] = useState<string>('Todos');
  const [selectedEstatus, setSelectedEstatus] = useState<string>('Todos');
  const [selectedTipo, setSelectedTipo] = useState<string>('Todos');
  const [selectedModelo, setSelectedModelo] = useState<string>('Todos');
  const [selectedClase, setSelectedClase] = useState<string>('Todos');
  const [selectedDistribuidor, setSelectedDistribuidor] = useState<string>('Todos');

  // New Asset Form State
  const [isNewAssetModalOpen, setIsNewAssetModalOpen] = useState(false);
  const [newAssetTipo, setNewAssetTipo] = useState('Montacargas');
  const [newAssetSerie, setNewAssetSerie] = useState('');
  const [newAssetModelo, setNewAssetModelo] = useState('');
  const [newAssetClase, setNewAssetClase] = useState('Clase I');
  const [newAssetEstatus, setNewAssetEstatus] = useState('Activo');
  const [newAssetOach, setNewAssetOach] = useState('');
  const [newAssetAltura, setNewAssetAltura] = useState('');
  const [newAssetBc, setNewAssetBc] = useState('');
  const [newAssetCliente, setNewAssetCliente] = useState('');
  const [newAssetSitio, setNewAssetSitio] = useState('');
  const [newAssetDistribuidor, setNewAssetDistribuidor] = useState('');
  const [newAssetAdc, setNewAssetAdc] = useState('');

  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<any>({});
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Transfer Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedAssetForTransfer, setSelectedAssetForTransfer] = useState<any>(null);
  const [transferDestinationSite, setTransferDestinationSite] = useState('');
  const [allSites, setAllSites] = useState<any[]>([]);

  // User Profile Identification
  const userRole = user?.role?.toLowerCase() || 'administrador';
  const isAdc = userRole === 'administrador';
  const loggedInAdcName = user ? `${user.firstName} ${user.lastName || ''}`.trim() : '';

  const fetchFlotilla = async () => {
    try {
      setLoading(true);
      const res = await api.get('/r4/flotilla');
      const dataArray = res.data?.data || res.data || [];
      setFleetAssets(Array.isArray(dataArray) ? dataArray : []);
    } catch (error) {
      console.error('Error fetching flotilla:', error);
      toast.error('Error al cargar la flotilla');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingApprovals = async () => {
    if (isAdc) return;
    try {
      const res = await api.get('/r4/flotilla/solicitudes');
      setPendingApprovals(res.data?.data || []);
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
    }
  };

  const fetchSites = async () => {
    try {
      const res = await api.get('/r4/clientes');
      const clientes = res.data?.data || res.data || [];
      const sites = clientes.flatMap((c: any) => c.sitios || []);
      setAllSites(sites);
    } catch (error) {
      console.error('Error fetching sites:', error);
    }
  };

  useEffect(() => {
    fetchFlotilla();
    fetchPendingApprovals();
    fetchSites();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await api.post(`/r4/flotilla/solicitudes/${id}/aprobar`);
      toast.success('Cambio aprobado con éxito');
      fetchPendingApprovals();
      fetchFlotilla();
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('Error al aprobar el cambio');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.post(`/r4/flotilla/solicitudes/${id}/rechazar`);
      toast.success('Cambio rechazado');
      fetchPendingApprovals();
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Error al rechazar el cambio');
    }
  };

  const startEditing = (e: React.MouseEvent, asset: any) => {
    e.stopPropagation();
    setEditingRowId(asset.serie);
    // Deep clone to avoid mutating the original
    setEditingData(JSON.parse(JSON.stringify(asset)));
    setIsEditModalOpen(true);
  };

  const cancelEditing = () => {
    setEditingRowId(null);
    setEditingData({});
    setIsEditModalOpen(false);
  };

  const saveEditing = async () => {
    try {
      // Compute only the fields that actually changed
      const originalAsset = fleetAssets.find(a => a.serie === editingRowId) || {};
      const changedFields: any = {};
      Object.keys(editingData).forEach(key => {
        if (editingData[key] !== originalAsset[key]) {
          changedFields[key] = editingData[key];
        }
      });

      if (Object.keys(changedFields).length === 0) {
        toast.info('No se detectaron cambios');
        cancelEditing();
        return;
      }

      if (isAdc) {
        // Requires approval
        await api.post(`/r4/flotilla/${editingRowId}/solicitar-cambio`, changedFields);
        toast.info('Solicitud de cambio enviada para aprobación de Coordinación.');
      } else {
        // Direct save
        await api.put(`/r4/flotilla/${editingRowId}`, changedFields);
        toast.success('Activo actualizado directamente');
      }
      fetchFlotilla();
      cancelEditing();
    } catch (error) {
      console.error(error);
      toast.error('Error al actualizar el activo');
    }
  };

  const openTransferModal = (e: React.MouseEvent, asset: any) => {
    e.stopPropagation();
    setSelectedAssetForTransfer(asset);
    setTransferDestinationSite('');
    setIsTransferModalOpen(true);
  };

  const handleTransfer = async () => {
    if (!transferDestinationSite) {
      toast.error('Selecciona un sitio de destino.');
      return;
    }

    const selectedSiteObj = allSites.find(s => s.id === transferDestinationSite);
    if (!selectedSiteObj) return;

    const destAdc = selectedSiteObj.adc || '';

    // Check Cross-ADC Transfer Constraint
    if (isAdc && destAdc.toLowerCase() !== loggedInAdcName.toLowerCase()) {
      // Must set status to INACTIVO first and notify
      toast.error(`Las transferencias entre diferentes ADCs deben ser autorizadas por Coordinación. Por favor cambie el estatus del equipo a "Inactivo" primero.`);
      return;
    }

    try {
      const payload = {
        sitio_id: transferDestinationSite,
        estatus_operativo: 'Activo'
      };

      if (isAdc) {
        // Requires approval
        await api.post(`/r4/flotilla/${selectedAssetForTransfer.serie}/solicitar-cambio`, payload);
        toast.info('Solicitud de transferencia enviada a Coordinación para aprobación.');
      } else {
        // Direct transfer
        await api.put(`/r4/flotilla/${selectedAssetForTransfer.serie}`, payload);
        toast.success('Transferencia realizada con éxito.');
      }

      setIsTransferModalOpen(false);
      fetchFlotilla();
    } catch (error) {
      console.error('Error in transfer:', error);
      toast.error('Error al realizar la transferencia');
    }
  };

  const handleCreateAsset = async () => {
    if (!newAssetSerie || !newAssetModelo) {
      toast.error('Faltan campos obligatorios.');
      return;
    }

    // 1. DUPLICATE SERIAL CHECK
    const duplicate = fleetAssets.find(
      a => a.serie?.toLowerCase().trim() === newAssetSerie.toLowerCase().trim()
    );
    if (duplicate) {
      toast.error(
        `Alerta: El número de serie "${newAssetSerie}" ya existe registrado en la flotilla. Ubicación actual: ${duplicate.cliente} - ${duplicate.site} (${duplicate.estatus}).`,
        { duration: 6000 }
      );
      return;
    }

    try {
      const payload = {
        serie: newAssetSerie,
        clase: newAssetClase,
        modelo: newAssetModelo,
        oach: newAssetOach,
        altura: newAssetAltura,
        bc: newAssetBc,
        estatus_operativo: newAssetEstatus,
        cliente_id: newAssetCliente,
        sitio_id: newAssetSitio,
        adc: newAssetAdc || loggedInAdcName,
        distribuidor: newAssetDistribuidor
      };

      // Direct creation (only allowed for admins/coordinators)
      await api.post('/r4/activos', payload); // Or direct creation API
      toast.success('Equipo registrado con éxito');
      setIsNewAssetModalOpen(false);
      fetchFlotilla();
    } catch (error) {
      console.error('Error creating asset:', error);
      toast.error('Error al dar de alta el equipo');
    }
  };

  // ADC Visual Filtering Logic
  // Bypass filter for the generic "comercial.admin2" testing account
  const isTestingAdmin = user?.email === 'comercial.admin2@run.com' || (user as any)?.username === 'Administrador';
  
  const baseAssets = (isAdc && !isTestingAdmin)
    ? fleetAssets.filter(a => {
        const adcLower = a.adc?.toLowerCase() || '';
        const userLower = loggedInAdcName.toLowerCase();
        const usernameLower = (user as any)?.username?.toLowerCase() || '';
        const emailLower = user?.email?.toLowerCase() || '';
        return adcLower === userLower || 
               userLower.includes(adcLower) || 
               (user?.firstName && adcLower.includes(user.firstName.toLowerCase())) ||
               usernameLower.includes(adcLower) ||
               emailLower.includes(adcLower);
      })
    : fleetAssets;

  const normalizedAssets = baseAssets.map(a => {
    let estatus = a.estatus;
    if (typeof estatus === 'string' && estatus.toUpperCase().includes('INACTIVO')) {
      estatus = 'Inactivo';
    }
    return { ...a, estatus };
  });

  const getValidString = (val: any) => typeof val === 'string' && val !== '[object Object]' ? val : null;
  const uniqueADCs = Array.from(new Set(normalizedAssets.map(a => getValidString(a.adc)).filter((v): v is string => !!v))).sort();
  const uniqueClientes = Array.from(new Set(normalizedAssets.map(a => getValidString(a.cliente)).filter((v): v is string => !!v))).sort();
  const uniqueSites = Array.from(new Set(normalizedAssets.map(a => getValidString(a.site)).filter((v): v is string => !!v))).sort();
  const uniqueDistribuidores = Array.from(new Set(normalizedAssets.map(a => getValidString(a.distribuidor)).filter((v): v is string => !!v))).sort();
  const uniqueEstatus = Array.from(new Set(normalizedAssets.map(a => getValidString(a.estatus)).filter((v): v is string => !!v))).sort();
  const uniqueTipos = Array.from(new Set(normalizedAssets.map(a => getValidString(a.tipo)).filter((v): v is string => !!v))).sort();
  const uniqueModelos = Array.from(new Set(normalizedAssets.map(a => getValidString(a.modelo)).filter((v): v is string => !!v))).sort();
  const uniqueClases = Array.from(new Set(normalizedAssets.map(a => getValidString(a.clase)).filter((v): v is string => !!v))).sort();

  const filteredAssets = normalizedAssets.filter((asset: any) => {
    if (selectedADC !== 'Todos' && asset.adc !== selectedADC) return false;
    if (selectedCliente !== 'Todos' && asset.cliente !== selectedCliente) return false;
    if (selectedEstatus !== 'Todos' && asset.estatus !== selectedEstatus) return false;
    if (selectedTipo !== 'Todos' && asset.tipo !== selectedTipo) return false;
    if (selectedModelo !== 'Todos' && asset.modelo !== selectedModelo) return false;
    if (selectedClase !== 'Todos' && asset.clase !== selectedClase) return false;
    if (selectedDistribuidor !== 'Todos' && asset.distribuidor !== selectedDistribuidor) return false;
    
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      asset.serie?.toLowerCase().includes(term) ||
      asset.cliente?.toLowerCase().includes(term) ||
      asset.modelo?.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredAssets.length / itemsPerPage);
  const paginatedAssets = filteredAssets.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getEstatusCount = (statusList: string[]) => 
    filteredAssets.filter(a => a && a.estatus && statusList.includes(a.estatus.toUpperCase())).length;

  const statusCounts = {
    totalActivos: filteredAssets.length,
    enRenta: getEstatusCount(['ACTIVO', 'EN RENTA']),
    disponibles: getEstatusCount(['DISPONIBLE', 'BACK UP']),
    inactivos: getEstatusCount(['INACTIVO'])
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) {
          const currentFile = droppedFiles[0];
          if (currentFile.name.endsWith('.xlsx') || currentFile.name.endsWith('.csv') || currentFile.name.endsWith('.xls')) {
              setFile(currentFile);
          } else {
              toast.error('Formato no soportado. Sube un archivo Excel.');
          }
      }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          setFile(e.target.files[0]);
      }
  };

  const handleUpload = async () => {
      if (!file) {
          toast.error('Por favor, selecciona un archivo primero.');
          return;
      }
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      try {
          const res = await api.post('/r4/carga-masiva', formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
          });
          toast.success(res.data.message || 'Carga completada con éxito');
          setFile(null);
          setIsUploadModalOpen(false);
          fetchFlotilla();
      } catch (err: any) {
          console.error('Upload Error:', err);
          toast.error(err.response?.data?.message || 'Error al subir el archivo');
      } finally {
          setIsUploading(false);
      }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col -gap-1">
          <span className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] mb-1">RAYMOND</span>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Flotilla y Activos</h1>
          <p className="text-slate-500 font-medium mt-1">Gestión y control de inventario de equipos y accesorios</p>
        </div>
        <div className="flex items-center gap-3">
          {!isAdc && pendingApprovals.length > 0 && (
            <button
              onClick={() => setShowApprovalsTab(!showApprovalsTab)}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-sm border-2 ${showApprovalsTab ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-600 border-red-100 hover:bg-red-50'}`}
            >
              <AlertTriangle className="w-4 h-4" />
              Aprobaciones ({pendingApprovals.length})
            </button>
          )}
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest border-2 border-slate-100 transition-all shadow-sm"
          >
            <Upload className="w-4 h-4" />
            Carga Masiva
          </button>
          <button className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest border-2 border-slate-100 transition-all shadow-sm">
            <Download className="w-4 h-4" />
            Exportar
          </button>
          {!isAdc && (
            <button onClick={() => setIsNewAssetModalOpen(true)} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-amber-100">
              <Plus className="w-4 h-4" />
              Alta de Equipo
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards (Mantenimiento, Movimientos and Docs removed) */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <div className="bg-white p-4 sm:p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:border-amber-100 hover:shadow-md transition-all">
          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Truck className="w-24 h-24 text-amber-600" />
          </div>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2 line-clamp-1">Total Activos</p>
          <h3 className="text-2xl sm:text-3xl font-black text-amber-600">{statusCounts.totalActivos}</h3>
        </div>
        
        <div className="bg-white p-4 sm:p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-emerald-100 hover:shadow-md transition-all">
          <p className="text-emerald-600 text-[10px] font-black uppercase tracking-widest mb-2 line-clamp-1">En Renta</p>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900">{statusCounts.enRenta}</h3>
        </div>
        
        <div className="bg-white p-4 sm:p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-blue-100 hover:shadow-md transition-all">
          <p className="text-blue-600 text-[10px] font-black uppercase tracking-widest mb-2 line-clamp-1">Disponibles</p>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900">{statusCounts.disponibles}</h3>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-red-100 hover:shadow-md transition-all">
          <p className="text-red-600 text-[10px] font-black uppercase tracking-widest mb-2 line-clamp-1">Inactivos</p>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900">{statusCounts.inactivos}</h3>
        </div>
      </div>

      {/* Coordinator Approval Drawer */}
      {showApprovalsTab && !isAdc && pendingApprovals.length > 0 && (
        <div className="bg-red-50/50 p-6 border-2 border-red-100 rounded-[2rem] space-y-4 animate-in slide-in-from-top duration-300">
          <h2 className="text-lg font-black text-red-800 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Solicitudes de Cambio Pendientes de Aprobación
          </h2>
          <div className="overflow-x-auto bg-white rounded-2xl border border-red-100">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-red-50 text-[9px] text-red-700 uppercase tracking-widest border-b border-red-100">
                <tr>
                  <th className="px-4 py-3 font-black">Equipo (Serie)</th>
                  <th className="px-4 py-3 font-black">Sitio Propuesto</th>
                  <th className="px-4 py-3 font-black">Detalles Propuestos</th>
                  <th className="px-4 py-3 font-black">Fecha</th>
                  <th className="px-4 py-3 font-black text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-50 text-slate-700 font-bold">
                {pendingApprovals.map((sol: any) => (
                  <tr key={sol.id}>
                    <td className="px-4 py-3 text-slate-900 font-black">{sol.activoSerie} ({sol.activoModelo})</td>
                    <td className="px-4 py-3">{allSites.find(s => s.id === sol.sitioNuevoId)?.nombre || sol.sitioNuevoId}</td>
                    <td className="px-4 py-3">
                      {sol.datosPropuestos?.tipo === 'EDICION' ? (
                        <div className="space-y-0.5 text-[10px]">
                          {Object.entries(sol.datosPropuestos.datos).map(([k, v]: any) => (
                            <div key={k}><span className="text-slate-400">{k}:</span> {v}</div>
                          ))}
                        </div>
                      ) : 'Transferencia directa'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{new Date(sol.fecha).toLocaleDateString('es-MX')}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => handleApprove(sol.id)} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider">Aprobar</button>
                        <button onClick={() => handleReject(sol.id)} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider">Rechazar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filters (Excel layout fields) */}
      <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative group flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-amber-500 transition-colors" />
            <input
              type="text"
              placeholder="Buscar por Serie, Cliente o Modelo"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:border-amber-500 focus:outline-none transition-all"
            />
          </div>

          {!isAdc && (
            <div className="relative group flex-1 min-w-[160px]">
              <Select value={selectedADC} onValueChange={(val) => { setSelectedADC(val); setCurrentPage(1); }}>
                <SelectTrigger className="w-full bg-slate-50 border-slate-200 rounded-xl text-xs font-bold text-slate-700 h-[42px] focus:ring-0 focus:border-amber-500 transition-all shadow-sm hover:border-slate-300">
                  <SelectValue placeholder="Ejecutivo (ADC): Todos" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100 shadow-xl bg-white z-50">
                  <SelectItem value="Todos" className="text-xs font-bold">Ejecutivo (ADC): Todos</SelectItem>
                  {uniqueADCs.map(adc => <SelectItem key={adc} value={adc} className="text-xs">{formatFilterText(adc)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="relative group flex-1 min-w-[160px]">
            <Select value={selectedCliente} onValueChange={(val) => { setSelectedCliente(val); setCurrentPage(1); }}>
              <SelectTrigger className="w-full bg-slate-50 border-slate-200 rounded-xl text-xs font-bold text-slate-700 h-[42px] focus:ring-0 focus:border-amber-500 transition-all shadow-sm hover:border-slate-300">
                <SelectValue placeholder="Cliente: Todos" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-100 shadow-xl bg-white z-50 max-h-[300px]">
                <SelectItem value="Todos" className="text-xs font-bold">Cliente: Todos</SelectItem>
                {uniqueClientes.map(c => <SelectItem key={c} value={c} className="text-xs">{formatFilterText(c)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="relative group flex-1 min-w-[160px]">
            <Select value={selectedEstatus} onValueChange={(val) => { setSelectedEstatus(val); setCurrentPage(1); }}>
              <SelectTrigger className="w-full bg-slate-50 border-slate-200 rounded-xl text-xs font-bold text-slate-700 h-[42px] focus:ring-0 focus:border-amber-500 transition-all shadow-sm hover:border-slate-300">
                <SelectValue placeholder="Estatus: Todos" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-100 shadow-xl bg-white z-50">
                <SelectItem value="Todos" className="text-xs font-bold">Estatus: Todos</SelectItem>
                {uniqueEstatus.map(e => <SelectItem key={e} value={e} className="text-xs">{formatFilterText(e)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="relative group flex-1 min-w-[160px]">
            <Select value={selectedModelo} onValueChange={(val) => { setSelectedModelo(val); setCurrentPage(1); }}>
              <SelectTrigger className="w-full bg-slate-50 border-slate-200 rounded-xl text-xs font-bold text-slate-700 h-[42px] focus:ring-0 focus:border-amber-500 transition-all shadow-sm hover:border-slate-300">
                <SelectValue placeholder="Modelo: Todos" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-100 shadow-xl bg-white z-50 max-h-[300px]">
                <SelectItem value="Todos" className="text-xs font-bold">Modelo: Todos</SelectItem>
                {uniqueModelos.map(m => <SelectItem key={m} value={m} className="text-xs">{formatFilterText(m)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="relative group flex-1 min-w-[160px]">
            <Select value={selectedClase} onValueChange={(val) => { setSelectedClase(val); setCurrentPage(1); }}>
              <SelectTrigger className="w-full bg-slate-50 border-slate-200 rounded-xl text-xs font-bold text-slate-700 h-[42px] focus:ring-0 focus:border-amber-500 transition-all shadow-sm hover:border-slate-300">
                <SelectValue placeholder="Clase: Todas" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-100 shadow-xl bg-white z-50">
                <SelectItem value="Todos" className="text-xs font-bold">Clase: Todas</SelectItem>
                {uniqueClases.map(c => <SelectItem key={c} value={c} className="text-xs">{formatFilterText(c)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="relative group flex-1 min-w-[160px]">
            <Select value={selectedDistribuidor} onValueChange={(val) => { setSelectedDistribuidor(val); setCurrentPage(1); }}>
              <SelectTrigger className="w-full bg-slate-50 border-slate-200 rounded-xl text-xs font-bold text-slate-700 h-[42px] focus:ring-0 focus:border-amber-500 transition-all shadow-sm hover:border-slate-300">
                <SelectValue placeholder="Distribuidor: Todos" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-100 shadow-xl bg-white z-50 max-h-[300px]">
                <SelectItem value="Todos" className="text-xs font-bold">Distribuidor: Todos</SelectItem>
                {uniqueDistribuidores.map(d => <SelectItem key={d} value={d} className="text-xs">{formatFilterText(d)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setViewMode(viewMode === 'table' ? 'cards' : 'table')} className="flex-1 p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 flex items-center justify-center transition-colors">
              {viewMode === 'table' ? <Grid3x3 className="w-4 h-4" /> : <List className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      {viewMode === 'table' && (
        <div className="bg-white border-2 border-slate-100 rounded-[2rem] shadow-sm overflow-hidden animate-in fade-in duration-300">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-widest border-b-2 border-slate-100">
                <tr>
                  <th className="px-4 py-4 font-black">Cuenta</th>
                  <th className="px-4 py-4 font-black">Site</th>
                  <th className="px-4 py-4 font-black">Tipo</th>
                  <th className="px-4 py-4 font-black">Clase</th>
                  <th className="px-4 py-4 font-black">Modelo</th>
                  <th className="px-4 py-4 font-black">Serie</th>
                  <th className="px-4 py-4 font-black text-right">Precio Renta</th>
                  <th className="px-4 py-4 font-black">Moneda</th>
                  <th className="px-4 py-4 font-black">Tipo Póliza</th>
                  <th className="px-4 py-4 font-black">Distribuidor</th>
                  <th className="px-4 py-4 font-black text-right">Costo Póliza</th>
                  <th className="px-4 py-4 font-black">Moneda Pago</th>
                  <th className="px-4 py-4 font-black">Estatus</th>
                  {!isAdc && <th className="px-4 py-4 font-black">ADC</th>}
                  <th className="px-4 py-4 font-black text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={15} className="px-6 py-12 text-center text-slate-400 font-bold">Cargando flotilla...</td></tr>
                ) : filteredAssets.length === 0 ? (
                  <tr><td colSpan={15} className="px-6 py-12 text-center text-slate-400 font-bold">No se encontraron activos.</td></tr>
                ) : paginatedAssets.map((asset) => (
                  <tr key={asset.serie} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={(e) => startEditing(e, asset)}>
                    <td className="px-4 py-3.5 text-slate-800 font-bold">{asset.cuenta}</td>
                    <td className="px-4 py-3.5">{asset.site}</td>
                    <td className="px-4 py-3.5">{asset.tipo}</td>
                    <td className="px-4 py-3.5 font-mono text-[11px]">{asset.clase}</td>
                    <td className="px-4 py-3.5 font-bold text-slate-800">{asset.modelo}</td>
                    <td className="px-4 py-3.5">
                      <Link href={`/r4/flotilla/${asset.serie}`} className="font-black text-slate-900 hover:text-amber-600 hover:underline">
                        {asset.serie}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-right font-black text-slate-950">${Number(asset.renta_precio).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3.5">{asset.renta_moneda}</td>
                    <td className="px-4 py-3.5 font-bold">{asset.tipo_poliza}</td>
                    <td className="px-4 py-3.5">{asset.distribuidor}</td>
                    <td className="px-4 py-3.5 text-right font-black text-slate-900">${Number(asset.costo_poliza_distribuidor).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3.5">{asset.moneda_pago_distribuidor}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 text-[9px] font-black uppercase rounded border tracking-wider ${statusColors[asset.estatus as keyof typeof statusColors] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                        {asset.estatus}
                      </span>
                    </td>
                    {!isAdc && <td className="px-4 py-3.5 font-bold text-slate-500">{asset.adc}</td>}
                    <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/r4/flotilla/${asset.serie}`} className="p-1.5 text-slate-400 hover:text-amber-600 bg-slate-50 hover:bg-amber-50 rounded-lg transition-colors">
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        <button onClick={(e) => startEditing(e, asset)} className="p-1.5 text-slate-400 hover:text-amber-600 bg-slate-50 hover:bg-amber-50 rounded-lg transition-colors">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={(e) => openTransferModal(e, asset)} className="p-1.5 text-slate-400 hover:text-amber-600 bg-slate-50 hover:bg-amber-50 rounded-lg transition-colors">
                          <MapPin className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Table Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t-2 border-slate-50 bg-slate-50/50">
              <span className="text-xs font-bold text-slate-500 font-brand">
                Página {currentPage} de {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 disabled:opacity-50 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 disabled:opacity-50 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VISTA DE CARDS */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-in fade-in duration-300">
          {paginatedAssets.map((asset) => (
            <div key={asset.serie} className="bg-white border border-slate-200 rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col h-full overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                <div>
                  <Link href={`/r4/flotilla/${asset.serie}`} className="font-black text-lg text-slate-900 hover:text-amber-600 hover:underline">
                    {asset.serie}
                  </Link>
                  <div className="flex gap-2 items-center mt-1">
                    <span className={`inline-flex px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${statusColors[asset.estatus as keyof typeof statusColors] || 'bg-slate-50 border-slate-200'}`}>
                      {asset.estatus}
                    </span>
                    <span className="text-xs text-slate-400 font-bold">{asset.tipo} • Clase {asset.clase}</span>
                  </div>
                </div>
                <div className="p-2.5 bg-white border border-slate-200 rounded-2xl shadow-sm text-slate-500">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>
              
              <div className="p-5 flex-1 space-y-4 text-xs font-bold text-slate-600">
                <div>
                  <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Ubicación</p>
                  <p className="font-black text-sm text-slate-900">{asset.cliente}</p>
                  <p className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-slate-400"/> {asset.site}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-[11px]">
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase">Cuenta:</span>
                    <p className="font-black text-slate-800">{asset.cuenta}</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase">Distribuidor:</span>
                    <p className="font-black text-slate-800">{asset.distribuidor}</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase">Modelo:</span>
                    <p className="font-black text-slate-800">{asset.modelo}</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase">Precio Renta:</span>
                    <p className="font-black text-slate-950">${Number(asset.renta_precio).toLocaleString('es-MX', { minimumFractionDigits: 2 })} {asset.renta_moneda}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 bg-slate-50/50 p-3 rounded-2xl">
                  <div>
                    <span className="text-[8px] text-slate-400 uppercase font-black block">Entregado</span>
                    <p className="font-black text-[10.5px] text-slate-800">{asset.fechaIngreso}</p>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-400 uppercase font-black block">Plazo (Meses)</span>
                    <p className="font-black text-[10.5px] text-slate-800">{asset.plazo}</p>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-400 uppercase font-black block">Vencimiento</span>
                    <p className="font-black text-[10.5px] text-amber-600">{asset.fechaVencimiento}</p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button onClick={(e) => startEditing(e, asset)} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-amber-600 rounded-xl transition-all" title="Editar">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={(e) => openTransferModal(e, asset)} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-amber-600 rounded-xl transition-all" title="Transferir equipo">
                    <MapPin className="w-4 h-4" />
                  </button>
                </div>
                <Link href={`/r4/flotilla/${asset.serie}`} className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm">
                  <Eye className="w-3.5 h-3.5" /> Detalle
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Carga Masiva */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-base font-black flex items-center gap-2 text-slate-900">
                  <HardDrive className="w-5 h-5 text-amber-600" />
                  Carga Masiva de Flotilla
                </h3>
                <button onClick={() => setIsUploadModalOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                  Sube un archivo <span className="font-black text-slate-900">.xlsx</span> o <span className="font-black text-slate-900">.csv</span> para importar y actualizar múltiples equipos, incluyendo sus fechas de mantenimiento.
                </p>
                <div className="p-2">
                  {isUploading ? (
                    <div className="flex flex-col items-center justify-center py-10 space-y-4">
                      <div className="relative w-20 h-20">
                        <div className="absolute inset-0 border-4 border-amber-100 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-amber-600 rounded-full border-t-transparent animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <FileSpreadsheet className="w-8 h-8 text-amber-600 animate-pulse" />
                        </div>
                      </div>
                      <h3 className="text-base font-black text-slate-900">Procesando Archivo...</h3>
                      <p className="text-xs text-slate-400 text-center max-w-xs font-semibold">
                        Registrando activos y rentas mensuales...
                      </p>
                    </div>
                  ) : (
                    <>
                      <label 
                        className={`relative flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-3xl cursor-pointer transition-all duration-300 ${file ? 'border-amber-500/50 bg-amber-50/5' : 'border-slate-200 hover:border-amber-500 hover:bg-slate-50/50 group'}`}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                      >
                        <input id="file-upload" type="file" className="hidden" accept=".xlsx,.csv" onChange={handleFileChange} />
                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-sm">
                          <Upload className="w-5 h-5 text-amber-600" />
                        </div>
                        <p className="text-xs font-black mb-1">
                          {file ? file.name : 'Arrastra tu archivo aquí o haz clic'}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold">Tamaño máximo: 10MB</p>
                      </label>

                      {file && (
                        <div className="flex items-center justify-between bg-amber-50/30 border border-amber-100 p-4 rounded-2xl mt-4">
                          <div className="flex items-center gap-3">
                            <FileSpreadsheet className="w-8 h-8 text-green-600" />
                            <div>
                              <p className="text-xs font-black">{file.name}</p>
                              <p className="text-[9px] text-slate-400 uppercase font-medium mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                          </div>
                          <button onClick={() => setFile(null)} className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-red-500 transition-all shadow-sm" title="Quitar archivo">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50/50">
                <button onClick={() => { setIsUploadModalOpen(false); setFile(null); }} className="px-5 py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-colors" disabled={isUploading}>
                  Cancelar
                </button>
                <button onClick={handleUpload} disabled={isUploading || !file} className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-amber-100 transition-colors disabled:opacity-50 flex items-center gap-2">
                  Importar Datos
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Alta de Nuevo Activo */}
      <AnimatePresence>
        {isNewAssetModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-base font-black flex items-center gap-2 text-slate-900">
                  <Plus className="w-5 h-5 text-amber-600" />
                  Alta de Nuevo Activo
                </h3>
                <button onClick={() => setIsNewAssetModalOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto font-bold text-xs text-slate-600">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Número de Serie *</label>
                    <input type="text" value={newAssetSerie} onChange={(e) => setNewAssetSerie(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-amber-500" placeholder="Ej: 12345" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Modelo *</label>
                    <input type="text" value={newAssetModelo} onChange={(e) => setNewAssetModelo(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-amber-500" placeholder="Ej: Raymond 7400" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Tipo de Activo *</label>
                    <select value={newAssetTipo} onChange={(e) => setNewAssetTipo(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none cursor-pointer">
                      <option>Montacargas</option>
                      <option>Patín</option>
                      <option>Batería</option>
                      <option>Cargador</option>
                      <option>Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Clase *</label>
                    <select value={newAssetClase} onChange={(e) => setNewAssetClase(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none cursor-pointer">
                      <option>Clase I</option>
                      <option>Clase II</option>
                      <option>Clase III</option>
                      <option>Clase IV</option>
                      <option>Clase V</option>
                      <option>OTROS</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Estatus Inicial *</label>
                    <select value={newAssetEstatus} onChange={(e) => setNewAssetEstatus(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none cursor-pointer">
                      <option value="Activo">Activo</option>
                      <option value="Back Up">Back Up</option>
                      <option value="Disponible">Disponible</option>
                      <option value="Inactivo">Inactivo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Ejecutivo (ADC)</label>
                    <input type="text" value={newAssetAdc} onChange={(e) => setNewAssetAdc(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-amber-500" placeholder={loggedInAdcName} />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Distribuidor</label>
                    <input type="text" value={newAssetDistribuidor} onChange={(e) => setNewAssetDistribuidor(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-amber-500" placeholder="Distribuidor que atiende" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">OACH</label>
                    <input type="text" value={newAssetOach} onChange={(e) => setNewAssetOach(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Altura</label>
                    <input type="text" value={newAssetAltura} onChange={(e) => setNewAssetAltura(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">BC</label>
                    <input type="text" value={newAssetBc} onChange={(e) => setNewAssetBc(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-amber-500" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50/50">
                <button onClick={() => setIsNewAssetModalOpen(false)} className="px-5 py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleCreateAsset} className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-amber-100 transition-colors">
                  Guardar Equipo
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Editar Equipo (Incluye campos adicionales de póliza) */}
      <AnimatePresence>
        {isEditModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-base font-black flex items-center gap-2 text-slate-900">
                  <Edit className="w-5 h-5 text-amber-600" />
                  Editar Activo: {editingRowId}
                </h3>
                <button onClick={cancelEditing} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto font-bold text-xs text-slate-600">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Clase</label>
                    <input type="text" value={editingData.clase || ''} onChange={(e) => setEditingData({...editingData, clase: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Modelo</label>
                    <input type="text" value={editingData.modelo || ''} onChange={(e) => setEditingData({...editingData, modelo: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Cuenta</label>
                    <input type="text" value={editingData.cuenta || ''} onChange={(e) => setEditingData({...editingData, cuenta: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Distribuidor</label>
                    <input type="text" value={editingData.distribuidor || ''} onChange={(e) => setEditingData({...editingData, distribuidor: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Estatus Operativo</label>
                    <select value={editingData.estatus || ''} onChange={(e) => setEditingData({...editingData, estatus: e.target.value, estatus_operativo: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none cursor-pointer">
                      <option value="Activo">Activo</option>
                      <option value="Back Up">Back Up</option>
                      <option value="Inactivo con Cliente">Inactivo con Cliente</option>
                      <option value="Inactivo">Inactivo</option>
                      <option value="Disponible">Disponible</option>
                      <option value="En Renta">En Renta</option>
                      <option value="Mantenimiento">Mantenimiento</option>
                      <option value="En Taller">En Taller</option>
                    </select>
                  </div>
                  {!isAdc && (
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider mb-1">Administrador (ADC)</label>
                      <input type="text" value={editingData.adc || ''} onChange={(e) => setEditingData({...editingData, adc: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none" />
                    </div>
                  )}

                  {/* Campos Financieros y Pólizas */}
                  <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
                    <h4 className="text-[10px] uppercase tracking-widest text-amber-600 mb-3">Condiciones de Renta y Póliza</h4>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Precio Renta Cliente</label>
                    <input type="number" value={editingData.renta_precio || ''} onChange={(e) => setEditingData({...editingData, renta_precio: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Moneda Renta</label>
                    <select value={editingData.renta_moneda || 'MXN'} onChange={(e) => setEditingData({...editingData, renta_moneda: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none cursor-pointer">
                      <option value="MXN">MXN</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Tipo de Póliza (SMP/CFPM)</label>
                    <select value={editingData.tipo_poliza || 'SMP'} onChange={(e) => setEditingData({...editingData, tipo_poliza: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none cursor-pointer">
                      <option value="SMP">SMP</option>
                      <option value="CFPM">CFPM</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Costo Póliza Distribuidor</label>
                    <input type="number" value={editingData.costo_poliza_distribuidor || ''} onChange={(e) => setEditingData({...editingData, costo_poliza_distribuidor: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Moneda Pago Distribuidor</label>
                    <select value={editingData.moneda_pago_distribuidor || 'MXN'} onChange={(e) => setEditingData({...editingData, moneda_pago_distribuidor: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none cursor-pointer">
                      <option value="MXN">MXN</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50/50">
                <button onClick={cancelEditing} className="px-5 py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-colors">
                  Cancelar
                </button>
                <button onClick={saveEditing} className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-amber-100 transition-colors">
                  {isAdc ? 'Solicitar Cambio' : 'Guardar Directo'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Transferir Equipo */}
      <AnimatePresence>
        {isTransferModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-base font-black flex items-center gap-2 text-slate-900">
                  <MapPin className="w-5 h-5 text-amber-600" />
                  Transferir Serie: {selectedAssetForTransfer?.serie}
                </h3>
                <button onClick={() => setIsTransferModalOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-4 font-bold text-xs text-slate-600">
                <div>
                  <p className="text-[9px] text-slate-400 uppercase mb-1">Ubicación Actual</p>
                  <p className="text-slate-900 text-sm font-black">{selectedAssetForTransfer?.cliente} - {selectedAssetForTransfer?.site}</p>
                  <p className="text-[10px] text-slate-500 font-bold mt-1">ADC Responsable: {selectedAssetForTransfer?.adc}</p>
                </div>
                
                <div className="pt-2">
                  <label className="block text-[10px] uppercase tracking-wider mb-2">Seleccionar Sitio de Destino *</label>
                  <select
                    value={transferDestinationSite}
                    onChange={(e) => setTransferDestinationSite(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none cursor-pointer"
                  >
                    <option value="">-- Elige un sitio destino --</option>
                    {allSites.map(site => (
                      <option key={site.id} value={site.id}>
                        {site.cliente?.razon_social || 'Cliente'} - {site.nombre} (ADC: {site.adc || 'Sin asignación'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50/50">
                <button onClick={() => setIsTransferModalOpen(false)} className="px-5 py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleTransfer} className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-amber-100 transition-colors">
                  Ejecutar Transferencia
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
