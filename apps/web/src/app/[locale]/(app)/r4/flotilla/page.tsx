'use client';

import { 
  Search, Filter, Download, Grid3x3, List, Plus, Eye, Edit, 
  FileText, Clock, CheckCircle, Upload, X, FileSpreadsheet, 
  Wrench, Activity, CheckCircle2, AlertTriangle, ChevronRight, ShieldCheck, MapPin, Truck, HardDrive, Info, Check, ChevronsUpDown
} from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';
import { useConfigStore } from '@/store/config.store';

const statusColors = {
  'Activo': 'bg-emerald-50 text-emerald-700 border-emerald-100',
  'En Renta': 'bg-blue-50 text-blue-700 border-blue-100',
  'Inactivo': 'bg-gray-50 text-gray-600 border-gray-200',
  'Disponible': 'bg-blue-50 text-blue-700 border-blue-100',
  'Back Up': 'bg-blue-50 text-blue-700 border-blue-100',
  'Inactivo con Cliente': 'bg-red-50 text-red-700 border-red-100',
  'En Taller': 'bg-red-50 text-red-700 border-red-100',
  'Mantenimiento': 'bg-red-50 text-red-700 border-red-100',
};

const formatFilterText = (str: string) => {
  if (!str) return '-';
  if (str === str.toUpperCase() && str.length > 3) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const FilterCombobox = ({ 
  label, value, onChange, options, open, setOpen, search, setSearch, currentColor 
}: {
  label: string; value: string; onChange: (val: string) => void; options: string[]; open: boolean; setOpen: (val: boolean) => void; search: string; setSearch: (val: string) => void; currentColor?: string;
}) => (
  <div className="relative group flex-1 min-w-[160px]">
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex justify-between items-center focus:outline-none focus:border-red-500 hover:border-slate-300 transition-all h-[42px]"
    >
      <span className="truncate">{value === 'Todos' ? `${label}: Todos` : formatFilterText(value)}</span>
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </button>
    {open && (
      <div className="absolute top-[100%] mt-2 left-0 w-[240px] z-[9999] bg-white border border-slate-200 shadow-xl rounded-xl p-2 animate-in fade-in zoom-in-95 duration-200">
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={`Buscar ${label.toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-red-500"
          />
        </div>
        <div className="max-h-[200px] overflow-y-auto space-y-1">
          <button
            type="button"
            onClick={() => { onChange('Todos'); setOpen(false); setSearch(''); }}
            className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors flex items-center justify-between font-bold"
          >
            <span>Todos</span>
            {value === 'Todos' && <Check className="w-4 h-4 shrink-0" style={{ color: currentColor || '#dc2626' }} />}
          </button>
          {options
            .filter(opt => opt.toLowerCase().includes(search.toLowerCase()))
            .map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); setSearch(''); }}
                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors flex items-center justify-between font-medium"
              >
                <span className="truncate pr-2">{formatFilterText(opt)}</span>
                {value === opt && <Check className="w-4 h-4 shrink-0" style={{ color: currentColor || '#dc2626' }} />}
              </button>
            ))}
        </div>
      </div>
    )}
  </div>
);

export default function Fleet() {
  const { user } = useAuthStore();
  const { roleColors } = useConfigStore();
  const currentColor = user?.role ? (roleColors[user.role.toLowerCase()] || roleColors.administrador) : roleColors.administrador;
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
  const [selectedCuenta, setSelectedCuenta] = useState<string>('Todos');
  const [selectedEstatus, setSelectedEstatus] = useState<string>('Todos');
  const [selectedTipo, setSelectedTipo] = useState<string>('Todos');
  const [selectedModelo, setSelectedModelo] = useState<string>('Todos');
  const [selectedClase, setSelectedClase] = useState<string>('Todos');
  const [selectedDistribuidor, setSelectedDistribuidor] = useState<string>('Todos');

  const [openFilterADC, setOpenFilterADC] = useState(false);
  const [openFilterCliente, setOpenFilterCliente] = useState(false);
  const [openFilterCuenta, setOpenFilterCuenta] = useState(false);
  const [openFilterEstatus, setOpenFilterEstatus] = useState(false);
  const [openFilterModelo, setOpenFilterModelo] = useState(false);
  const [openFilterClase, setOpenFilterClase] = useState(false);
  const [openFilterDistribuidor, setOpenFilterDistribuidor] = useState(false);

  const [searchADC, setSearchADC] = useState('');
  const [searchCliente, setSearchCliente] = useState('');
  const [searchCuenta, setSearchCuenta] = useState('');
  const [searchEstatus, setSearchEstatus] = useState('');
  const [searchModelo, setSearchModelo] = useState('');
  const [searchClase, setSearchClase] = useState('');
  const [searchDistribuidor, setSearchDistribuidor] = useState('');

  const hasActiveFilters = 
    selectedADC !== 'Todos' ||
    selectedCliente !== 'Todos' ||
    selectedCuenta !== 'Todos' ||
    selectedEstatus !== 'Todos' ||
    selectedTipo !== 'Todos' ||
    selectedModelo !== 'Todos' ||
    selectedClase !== 'Todos' ||
    selectedDistribuidor !== 'Todos' ||
    searchTerm !== '';

  const clearFilters = () => {
    setSelectedADC('Todos');
    setSelectedCliente('Todos');
    setSelectedCuenta('Todos');
    setSelectedEstatus('Todos');
    setSelectedTipo('Todos');
    setSelectedModelo('Todos');
    setSelectedClase('Todos');
    setSelectedDistribuidor('Todos');
    setSearchTerm('');
    setCurrentPage(1);
  };

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
  const [clientesDisponibles, setClientesDisponibles] = useState<any[]>([]);

  // User Profile Identification
  let rawRole: any = user?.role;
  if (Array.isArray(rawRole)) rawRole = rawRole[0]?.name || rawRole[0]?.rol || rawRole[0];
  if (typeof rawRole === 'object' && rawRole !== null) rawRole = rawRole?.name || rawRole?.rol;
  const userRole = String(rawRole || 'administrador').toLowerCase();
  
  const isAdc = userRole !== 'administrador' && !userRole.includes('geren') && !userRole.includes('coordinaci');
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
      setClientesDisponibles(clientes);
      let sites = clientes.flatMap((c: any) => 
        (c.sitios || []).map((s: any) => ({
          ...s,
          cliente: { razon_social: c.razonSocial || c.razon_social },
          adc: c.adc && c.adc !== '-' ? c.adc : ''
        }))
      );
      
      // Filter sites by ADC if user is an ADC
      if (isAdc) {
        const userLower = loggedInAdcName.toLowerCase();
        sites = sites.filter((s: any) => {
          const adcLower = s.adc?.toLowerCase() || '';
          return adcLower === userLower || userLower.includes(adcLower) || adcLower.includes(user?.firstName?.toLowerCase() || '');
        });
      }
      
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

  // Auto-assign Clase based on Modelo if known
  useEffect(() => {
    const term = newAssetModelo.toLowerCase();
    if (term.includes('7400') || term.includes('4250') || term.includes('4750')) {
      setNewAssetClase('Clase I');
    } else if (term.includes('order picker') || term.includes('5000')) {
      setNewAssetClase('Clase II');
    } else if (term.includes('patin') || term.includes('8000') || term.includes('8210')) {
      setNewAssetClase('Clase III');
    }
  }, [newAssetModelo]);

  useEffect(() => {
    if (editingData.modelo) {
      const term = editingData.modelo.toLowerCase();
      let newClase = editingData.clase;
      if (term.includes('7400') || term.includes('4250') || term.includes('4750')) {
        newClase = 'Clase I';
      } else if (term.includes('order picker') || term.includes('5000')) {
        newClase = 'Clase II';
      } else if (term.includes('patin') || term.includes('8000') || term.includes('8210')) {
        newClase = 'Clase III';
      }
      if (newClase !== editingData.clase) {
        setEditingData((prev: any) => ({ ...prev, clase: newClase }));
      }
    }
  }, [editingData.modelo]);

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
      if (selectedAssetForTransfer?.estatus?.toUpperCase() !== 'INACTIVO') {
        // Must set status to INACTIVO first and notify
        toast.error(`Las transferencias entre diferentes ADCs deben ser autorizadas por Coordinación. Por favor cambie el estatus del equipo a "Inactivo" primero.`);
        return;
      }
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
    if (!newAssetSerie || !newAssetModelo || !newAssetCliente || !newAssetSitio) {
      toast.error('Faltan campos obligatorios (Serie, Modelo, Cliente, Sitio).');
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
      await api.post('/r4/flotilla', payload); // Or direct creation API
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
  
  const getFilteredFor = (skipFilterName: string) => {
    return normalizedAssets.filter((asset: any) => {
      if (skipFilterName !== 'adc' && selectedADC !== 'Todos' && asset.adc !== selectedADC) return false;
      if (skipFilterName !== 'cliente' && selectedCliente !== 'Todos' && asset.cliente !== selectedCliente) return false;
      if (skipFilterName !== 'cuenta' && selectedCuenta !== 'Todos' && asset.cuenta !== selectedCuenta) return false;
      if (skipFilterName !== 'estatus' && selectedEstatus !== 'Todos' && asset.estatus !== selectedEstatus) return false;
      if (skipFilterName !== 'tipo' && selectedTipo !== 'Todos' && asset.tipo !== selectedTipo) return false;
      if (skipFilterName !== 'modelo' && selectedModelo !== 'Todos' && asset.modelo !== selectedModelo) return false;
      if (skipFilterName !== 'clase' && selectedClase !== 'Todos' && asset.clase !== selectedClase) return false;
      if (skipFilterName !== 'distribuidor' && selectedDistribuidor !== 'Todos' && asset.distribuidor !== selectedDistribuidor) return false;
      return true;
    });
  };

  const uniqueADCs = Array.from(new Set(getFilteredFor('adc').map(a => getValidString(a.adc)).filter((v): v is string => !!v))).sort();
  const uniqueClientes = Array.from(new Set(getFilteredFor('cliente').map(a => getValidString(a.cliente)).filter((v): v is string => !!v))).sort();
  const uniqueCuentas = Array.from(new Set(getFilteredFor('cuenta').map(a => getValidString(a.cuenta)).filter((v): v is string => !!v))).sort();
  const uniqueSites = Array.from(new Set(getFilteredFor('site').map(a => getValidString(a.site)).filter((v): v is string => !!v))).sort();
  const uniqueDistribuidores = Array.from(new Set(getFilteredFor('distribuidor').map(a => getValidString(a.distribuidor)).filter((v): v is string => !!v))).sort();
  const uniqueEstatus = Array.from(new Set(getFilteredFor('estatus').map(a => getValidString(a.estatus)).filter((v): v is string => !!v))).sort();
  const uniqueTipos = Array.from(new Set(getFilteredFor('tipo').map(a => getValidString(a.tipo)).filter((v): v is string => !!v))).sort();
  const uniqueModelos = Array.from(new Set(getFilteredFor('modelo').map(a => getValidString(a.modelo)).filter((v): v is string => !!v))).sort();
  const uniqueClases = Array.from(new Set(getFilteredFor('clase').map(a => getValidString(a.clase)).filter((v): v is string => !!v))).sort();

  const filteredAssets = normalizedAssets.filter((asset: any) => {
    if (selectedADC !== 'Todos' && asset.adc !== selectedADC) return false;
    if (selectedCliente !== 'Todos' && asset.cliente !== selectedCliente) return false;
    if (selectedCuenta !== 'Todos' && asset.cuenta !== selectedCuenta) return false;
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

  const handleDownloadExcel = async () => {
    try {
      toast.info('Generando Excel...');
      const response = await api.get('/r4/flotilla/exportar/excel', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Flotilla_${new Date().getTime()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Excel descargado correctamente');
    } catch (error) {
      console.error('Error downloading excel', error);
      toast.error('Error al exportar');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const dropped = e.dataTransfer.files?.[0] || null;
    if (dropped) setFile(dropped);
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post('/r4/flotilla/importar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Archivo procesado correctamente');
      setFile(null);
      setIsUploadModalOpen(false);
      fetchFlotilla();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Error al procesar el archivo');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="flex flex-col -gap-1">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] mb-1" style={{ color: currentColor }}>RAYMOND</span>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Flotilla Rental</h1>
          <p className="text-slate-500 font-medium mt-1">Gestión integral de equipos, mantenimientos y ubicaciones</p>
        </div>
        
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 w-full md:w-auto">
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
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl sm:rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-sm whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Carga Masiva</span>
            <span className="sm:hidden">Masiva</span>
          </button>
          <button
            onClick={handleDownloadExcel}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl sm:rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-sm whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Exportar
          </button>
          {!isAdc && (
            <button 
              onClick={() => setIsNewAssetModalOpen(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 sm:py-3 text-white rounded-xl sm:rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md whitespace-nowrap hover:opacity-90 mt-2 sm:mt-0"
              style={{ backgroundColor: currentColor, boxShadow: `0 4px 14px 0 ${currentColor}40` }}
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Alta de Equipo
            </button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mt-8 sm:mt-12">
        <div className="bg-white rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 lg:p-8 border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute -right-4 -bottom-4 sm:-right-8 sm:-bottom-8 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-500">
            <Truck className="w-24 h-24 sm:w-32 sm:h-32 lg:w-48 lg:h-48" style={{ color: currentColor }} />
          </div>
          <div className="relative z-10">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2 line-clamp-1">Total Activos</p>
            <h3 className="text-2xl sm:text-3xl font-black" style={{ color: currentColor }}>
              {loading ? <span className="text-slate-200">--</span> : statusCounts.totalActivos}
            </h3>
          </div>
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
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-red-500 transition-colors" />
            <input
              type="text"
              placeholder="Buscar por Serie, Cliente o Modelo"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:border-red-500 focus:outline-none transition-all"
            />
          </div>

          {!isAdc && (
            <FilterCombobox
              label="Ejecutivo (ADC)"
              value={selectedADC}
              onChange={(val) => { setSelectedADC(val); setCurrentPage(1); }}
              options={uniqueADCs}
              open={openFilterADC}
              setOpen={setOpenFilterADC}
              search={searchADC}
              setSearch={setSearchADC}
              currentColor={currentColor}
            />
          )}

          <FilterCombobox
            label="Cliente"
            value={selectedCliente}
            onChange={(val) => { setSelectedCliente(val); setCurrentPage(1); }}
            options={uniqueClientes}
            open={openFilterCliente}
            setOpen={setOpenFilterCliente}
            search={searchCliente}
            setSearch={setSearchCliente}
            currentColor={currentColor}
          />
          
          <FilterCombobox
            label="Cuenta"
            value={selectedCuenta}
            onChange={(val) => { setSelectedCuenta(val); setCurrentPage(1); }}
            options={uniqueCuentas}
            open={openFilterCuenta}
            setOpen={setOpenFilterCuenta}
            search={searchCuenta}
            setSearch={setSearchCuenta}
            currentColor={currentColor}
          />

          <FilterCombobox
            label="Estatus"
            value={selectedEstatus}
            onChange={(val) => { setSelectedEstatus(val); setCurrentPage(1); }}
            options={uniqueEstatus}
            open={openFilterEstatus}
            setOpen={setOpenFilterEstatus}
            search={searchEstatus}
            setSearch={setSearchEstatus}
            currentColor={currentColor}
          />

          <FilterCombobox
            label="Modelo"
            value={selectedModelo}
            onChange={(val) => { setSelectedModelo(val); setCurrentPage(1); }}
            options={uniqueModelos}
            open={openFilterModelo}
            setOpen={setOpenFilterModelo}
            search={searchModelo}
            setSearch={setSearchModelo}
            currentColor={currentColor}
          />

          <FilterCombobox
            label="Clase"
            value={selectedClase}
            onChange={(val) => { setSelectedClase(val); setCurrentPage(1); }}
            options={uniqueClases}
            open={openFilterClase}
            setOpen={setOpenFilterClase}
            search={searchClase}
            setSearch={setSearchClase}
            currentColor={currentColor}
          />

          <FilterCombobox
            label="Distribuidor"
            value={selectedDistribuidor}
            onChange={(val) => { setSelectedDistribuidor(val); setCurrentPage(1); }}
            options={uniqueDistribuidores}
            open={openFilterDistribuidor}
            setOpen={setOpenFilterDistribuidor}
            search={searchDistribuidor}
            setSearch={setSearchDistribuidor}
            currentColor={currentColor}
          />

          <div className="flex gap-2">
            {hasActiveFilters && (
              <button onClick={clearFilters} className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl border border-red-200 flex items-center justify-center gap-2 transition-colors font-bold text-xs uppercase tracking-widest" title="Limpiar filtros">
                <X className="w-4 h-4" />
                Limpiar
              </button>
            )}
            <button onClick={() => setViewMode(viewMode === 'table' ? 'cards' : 'table')} className="px-3 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 flex items-center justify-center transition-colors" title="Cambiar vista">
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
                  <tr>
                    <td colSpan={15}>
                      <div className="py-24 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-500">
                        <div className="relative w-16 h-16">
                          <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                          <div className="absolute inset-0 border-4 rounded-full border-t-transparent animate-spin" style={{ borderColor: `${currentColor} transparent` }}></div>
                          <Truck className="absolute inset-0 m-auto w-6 h-6 animate-pulse" style={{ color: currentColor }} />
                        </div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Cargando flotilla...</p>
                      </div>
                    </td>
                  </tr>
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
                      <Link href={`/r4/flotilla/${asset.serie}`} className="font-black text-slate-900 hover:text-red-600 hover:underline">
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
                        <Link href={`/r4/flotilla/${asset.serie}`} className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 rounded-lg transition-colors">
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        <button onClick={(e) => startEditing(e, asset)} className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 rounded-lg transition-colors">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={(e) => openTransferModal(e, asset)} className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 rounded-lg transition-colors">
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
                  <Link href={`/r4/flotilla/${asset.serie}`} className="font-black text-lg text-slate-900 hover:text-red-600 hover:underline">
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
                    <p className="font-black text-[10.5px] text-red-600">{asset.fechaVencimiento}</p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button onClick={(e) => startEditing(e, asset)} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-red-600 rounded-xl transition-all" title="Editar">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={(e) => openTransferModal(e, asset)} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-red-600 rounded-xl transition-all" title="Transferir equipo">
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
                  <HardDrive className="w-5 h-5 text-red-600" />
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
                        <div className="absolute inset-0 border-4 border-red-100 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-red-600 rounded-full border-t-transparent animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <FileSpreadsheet className="w-8 h-8 text-red-600 animate-pulse" />
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
                        className={`relative flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-3xl cursor-pointer transition-all duration-300 ${file ? 'border-red-500/50 bg-red-50/5' : 'border-slate-200 hover:border-red-500 hover:bg-slate-50/50 group'}`}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                      >
                        <input id="file-upload" type="file" className="hidden" accept=".xlsx,.csv" onChange={handleFileChange} />
                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-sm">
                          <Upload className="w-5 h-5 text-red-600" />
                        </div>
                        <p className="text-xs font-black mb-1">
                          {file ? file.name : 'Arrastra tu archivo aquí o haz clic'}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold">Tamaño máximo: 10MB</p>
                      </label>

                      {file && (
                        <div className="flex items-center justify-between bg-red-50/30 border border-red-100 p-4 rounded-2xl mt-4">
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
                <button onClick={handleUpload} disabled={isUploading || !file} className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-red-100 transition-colors disabled:opacity-50 flex items-center gap-2">
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
                  <Plus className="w-5 h-5 text-red-600" />
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
                    <input type="text" value={newAssetSerie} onChange={(e) => setNewAssetSerie(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500" placeholder="Ej: 12345" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Modelo *</label>
                    <input type="text" value={newAssetModelo} onChange={(e) => setNewAssetModelo(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500" placeholder="Ej: Raymond 7400" />
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
                    <select value={newAssetClase} onChange={(e) => setNewAssetClase(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500 cursor-pointer">
                      <option>Clase I</option>
                      <option>Clase II</option>
                      <option>Clase III</option>
                      <option>Clase IV</option>
                      <option>Clase V</option>
                      <option>OTROS</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Cliente *</label>
                    <select value={newAssetCliente} onChange={(e) => { setNewAssetCliente(e.target.value); setNewAssetSitio(''); }} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500 cursor-pointer">
                      <option value="">Seleccionar Cliente</option>
                      {clientesDisponibles.map((c: any) => <option key={c.id} value={c.id}>{c.razonSocial || c.razon_social}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Sitio *</label>
                    <select value={newAssetSitio} onChange={(e) => setNewAssetSitio(e.target.value)} disabled={!newAssetCliente} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500 cursor-pointer disabled:opacity-50">
                      <option value="">Seleccionar Sitio</option>
                      {clientesDisponibles.find((c: any) => c.id === newAssetCliente)?.sitios?.map((s: any) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
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
                    <select value={newAssetAdc} onChange={(e) => setNewAssetAdc(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500 cursor-pointer">
                      <option value="">Seleccionar ADC</option>
                      {uniqueADCs.map(adc => <option key={adc} value={adc}>{adc}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Distribuidor</label>
                    <select value={newAssetDistribuidor} onChange={(e) => setNewAssetDistribuidor(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500 cursor-pointer">
                      <option value="">Seleccionar Distribuidor</option>
                      {uniqueDistribuidores.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">OACH</label>
                    <input type="text" value={newAssetOach} onChange={(e) => setNewAssetOach(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Altura</label>
                    <input type="text" value={newAssetAltura} onChange={(e) => setNewAssetAltura(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">BC</label>
                    <input type="text" value={newAssetBc} onChange={(e) => setNewAssetBc(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50/50">
                <button onClick={() => setIsNewAssetModalOpen(false)} className="px-5 py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleCreateAsset} className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-red-100 transition-colors">
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
                  <Edit className="w-5 h-5 text-red-600" />
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
                    <input type="text" value={editingData.clase || ''} readOnly className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 focus:outline-none cursor-not-allowed" />
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
                    <select value={editingData.distribuidor || ''} onChange={(e) => setEditingData({...editingData, distribuidor: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500 cursor-pointer">
                      <option value="">Seleccionar Distribuidor</option>
                      {uniqueDistribuidores.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
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
                      <select value={editingData.adc || ''} onChange={(e) => setEditingData({...editingData, adc: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500 cursor-pointer">
                        <option value="">Seleccionar ADC</option>
                        {uniqueADCs.map(adc => <option key={adc} value={adc}>{adc}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Campos Financieros y Pólizas */}
                  <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
                    <h4 className="text-[10px] uppercase tracking-widest text-red-600 mb-3">Condiciones de Renta y Póliza</h4>
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
                <button onClick={saveEditing} className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-red-100 transition-colors">
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
                  <MapPin className="w-5 h-5 text-red-600" />
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
                  <Select
                    value={transferDestinationSite}
                    onValueChange={(val) => setTransferDestinationSite(val)}
                  >
                    <SelectTrigger className="w-full bg-slate-50 border-slate-200 rounded-xl text-xs font-bold text-slate-700 h-[42px] focus:ring-0 focus:border-red-500 transition-all shadow-sm hover:border-slate-300">
                      <SelectValue placeholder="-- Elige un sitio destino --" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-100 shadow-xl bg-white z-50 max-h-[300px]">
                      {allSites.map(site => (
                        <SelectItem key={site.id} value={site.id} className="text-xs text-slate-700">
                          {site.cliente?.razon_social || 'Cliente'} - {site.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50/50">
                <button onClick={() => setIsTransferModalOpen(false)} className="px-5 py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleTransfer} className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-red-100 transition-colors">
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
