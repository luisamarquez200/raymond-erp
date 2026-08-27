'use client';

import { 
  Search, Filter, Download, Grid3x3, List, Plus, Eye, Edit, 
  FileText, Clock, CheckCircle, Upload, X, FileSpreadsheet, 
  Wrench, Activity, CheckCircle2, AlertTriangle, ChevronRight, ChevronLeft, ShieldCheck, MapPin, Truck, HardDrive, Info, Check, ChevronsUpDown, Loader2, Trash2, ChevronDown, ChevronUp, Layers
} from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';
import { useConfigStore } from '@/store/config.store';
import { useUser } from '@/hooks/useUsers';
import PageLoader from '@/components/ui/PageLoader';
import TooltipInfo from '@/components/ui/TooltipInfo';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/SearchableSelect';
import * as XLSX from 'xlsx';

const statusColors = {
  'Activo': 'bg-emerald-50 text-emerald-700 border-emerald-100',
  'Inactivo': 'bg-gray-50 text-gray-600 border-gray-200',
  'Comodato': 'bg-blue-50 text-blue-700 border-blue-100',
  'Back Up': 'bg-purple-50 text-purple-700 border-purple-100',
  'Inactivo con Cliente': 'bg-red-50 text-red-700 border-red-100',
};

const formatFilterText = (str: string) => {
  if (!str) return '-';
  return str.toUpperCase();
};

const TableHeaderFilter = ({ 
  label, title, value, onChange, options, open, setOpen, search, setSearch, currentColor 
}: {
  label: string; title: string; value: string[]; onChange: (val: string[]) => void; options: string[]; open: boolean; setOpen: (val: boolean) => void; search: string; setSearch: (val: string) => void; currentColor?: string;
}) => {
  const isAll = !value || value.length === 0 || value.includes('Todos');
  const hasSelection = !isAll && value.length > 0;

  const toggleOption = (opt: string) => {
    if (opt === 'Todos') {
      onChange([]);
      return;
    }
    let current = (value || []).filter(v => v !== 'Todos');
    if (current.includes(opt)) {
      current = current.filter(v => v !== opt);
    } else {
      current = [...current, opt];
    }
    onChange(current);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="flex items-center gap-1.5 cursor-pointer select-none group hover:bg-slate-100/50 p-1 -m-1 rounded-lg transition-colors">
          <span className={hasSelection ? "text-red-600 font-black" : "text-slate-500 font-black"}>{title}</span>
          <div className={`p-1 rounded-md transition-colors ${hasSelection ? 'bg-red-50 text-red-600' : 'text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-700'}`}>
            <Filter className="w-3.5 h-3.5" />
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-2" align="start" sideOffset={8}>
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
        <div className="max-h-[200px] overflow-y-auto space-y-1 custom-scrollbar pr-1">
          <button
            type="button"
            onClick={() => toggleOption('Todos')}
            className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors flex items-center justify-between font-bold"
          >
            <span>TODOS</span>
            {isAll && <Check className="w-4 h-4 shrink-0" style={{ color: currentColor || '#dc2626' }} />}
          </button>
          {options
            .filter(opt => opt.toLowerCase().includes(search.toLowerCase()))
            .map(opt => {
              const isSelected = !isAll && value.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleOption(opt)}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors flex items-center justify-between font-medium"
                >
                  <span className="truncate pr-2">{formatFilterText(opt)}</span>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-red-600 border-red-600 text-white' : 'border-slate-300'}`}>
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </button>
              );
            })}
        </div>
        {!isAll && (
          <div className="pt-2 mt-2 border-t border-slate-100 flex justify-between items-center px-1">
            <span className="text-[10px] font-bold text-slate-400">{value.length} sel.</span>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[10px] font-black text-red-600 uppercase hover:underline"
            >
              Limpiar
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

interface FlotillaTabProps {
  adminAdcScope?: 'todos' | 'mis_adcs';
  setAdminAdcScope?: (scope: 'todos' | 'mis_adcs') => void;
}

export default function FlotillaTab({ 
  adminAdcScope: externalAdminAdcScope, 
  setAdminAdcScope: externalSetAdminAdcScope 
}: FlotillaTabProps = {}) {
  const { user } = useAuthStore();
  // Cargar perfil fresco del usuario logueado desde la API (para tener adc_asociado_name actualizado)
  const { data: freshUserProfile } = useUser(user?.id || '');
  const { roleColors } = useConfigStore();
  const currentColor = user?.role ? (roleColors[user.role.toLowerCase()] || roleColors.administrador) : roleColors.administrador;
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [density, setDensity] = useState<'comfortable' | 'compact'>('compact');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [fleetAssets, setFleetAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [showApprovalsTab, setShowApprovalsTab] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showDuplicates, setShowDuplicates] = useState(false);

  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [openFilters, setOpenFilters] = useState<Record<string, boolean>>({});
  const [searchFilters, setSearchFilters] = useState<Record<string, string>>({});
  const [searchPropietario, setSearchPropietario] = useState('');

  const hasActiveFilters = Object.values(activeFilters).some(arr => arr && arr.length > 0 && !arr.includes('Todos')) || searchTerm !== '';

  const clearFilters = () => {
    setActiveFilters({});
    setSearchTerm('');
    setCurrentPage(1);
  };

  // New Asset Form State
  const [isNewAssetModalOpen, setIsNewAssetModalOpen] = useState(false);
  const [newAssetTipo, setNewAssetTipo] = useState('Contrabalanceado');
  const [newAssetSerie, setNewAssetSerie] = useState('');
  const [newAssetModelo, setNewAssetModelo] = useState('');
  const [newAssetClase, setNewAssetClase] = useState('I');
  const [newAssetEstatus, setNewAssetEstatus] = useState('Activo');
  const [newAssetOach, setNewAssetOach] = useState('');
  const [newAssetAltura, setNewAssetAltura] = useState('');
  const [newAssetBc, setNewAssetBc] = useState('');
  const [newAssetCliente, setNewAssetCliente] = useState('');
  const [newAssetCuenta, setNewAssetCuenta] = useState('');
  const [newAssetSitio, setNewAssetSitio] = useState('');
  const [newAssetDistribuidor, setNewAssetDistribuidor] = useState('');
  const [newAssetAdc, setNewAssetAdc] = useState('');
  const [newAssetPropietario, setNewAssetPropietario] = useState('');
  const [newAssetIwarehouse, setNewAssetIwarehouse] = useState('');
  // Renta opcional — sección colapsable
  const [showRentaSection, setShowRentaSection] = useState(false);
  const [newRentaPrecio, setNewRentaPrecio] = useState('');
  const [newRentaMoneda, setNewRentaMoneda] = useState('MXN');
  const [newRentaPoliza, setNewRentaPoliza] = useState('SMP');
  const [newRentaCostoDealer, setNewRentaCostoDealer] = useState('');
  const [newRentaMonedaDealer, setNewRentaMonedaDealer] = useState('MXN');
  const [newRentaFechaInicio, setNewRentaFechaInicio] = useState('');
  const [newRentaPlazo, setNewRentaPlazo] = useState('');
  const [newRentaFechaFin, setNewRentaFechaFin] = useState('');
  const [newRentaFolioOc, setNewRentaFolioOc] = useState('');
  const [newRentaPedidoTotvs, setNewRentaPedidoTotvs] = useState('');
  const [newRentaFechaTotvs, setNewRentaFechaTotvs] = useState('');

  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<any>({});
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Delete Modal State
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    asset: any | null;
    isDeleting: boolean;
  }>({
    isOpen: false,
    asset: null,
    isDeleting: false,
  });

  // Transfer Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedAssetForTransfer, setSelectedAssetForTransfer] = useState<any>(null);
  const [transferDestinationSite, setTransferDestinationSite] = useState('');
  const [allSites, setAllSites] = useState<any[]>([]);
  const [clientesDisponibles, setClientesDisponibles] = useState<any[]>([]);

  const [internalAdminAdcScope, setInternalAdminAdcScope] = useState<'todos' | 'mis_adcs'>('todos');
  const adminAdcScope = externalAdminAdcScope ?? internalAdminAdcScope;
  const setAdminAdcScope = externalSetAdminAdcScope ?? setInternalAdminAdcScope;

  // User Profile Identification
  let rawRole: any = user?.role;
  if (Array.isArray(rawRole)) rawRole = rawRole[0]?.name || rawRole[0]?.rol || rawRole[0];
  if (typeof rawRole === 'object' && rawRole !== null) rawRole = rawRole?.name || rawRole?.rol;
  const userRole = String(rawRole || 'administrador').toLowerCase();
  
  const isAdc = userRole !== 'administrador' && !userRole.includes('geren') && !userRole.includes('coordinaci');
  const loggedInAdcName = user 
    ? (userRole === 'auxiliar' || userRole.includes('auxiliar'))
      ? (user.adc_asociado_name || '')
      : `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || ''
    : '';

  useEffect(() => {
    if (isNewAssetModalOpen && isAdc && loggedInAdcName) {
      setNewAssetAdc(loggedInAdcName);
    }
  }, [isNewAssetModalOpen, isAdc, loggedInAdcName]);

  // Auto-calculate Fecha Vencimiento in Datos de Renta (Opcional) when Fecha Entregado or Plazo changes
  useEffect(() => {
    if (newRentaFechaInicio && newRentaPlazo) {
      const months = parseInt(newRentaPlazo, 10);
      if (!isNaN(months) && months > 0) {
        const parts = newRentaFechaInicio.split('-');
        if (parts.length === 3) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          const d = parseInt(parts[2], 10);
          if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
            const dt = new Date(y, m - 1 + months, d);
            const yyyy = dt.getFullYear();
            const mm = String(dt.getMonth() + 1).padStart(2, '0');
            const dd = String(dt.getDate()).padStart(2, '0');
            setNewRentaFechaFin(`${yyyy}-${mm}-${dd}`);
          }
        }
      }
    }
  }, [newRentaFechaInicio, newRentaPlazo]);

  const defaultModelosCatalog: SearchableSelectOption[] = [
    { label: 'Raymond 7400', value: 'Raymond 7400', description: 'Reach Truck (Clase II)' },
    { label: 'Raymond 7500', value: 'Raymond 7500', description: 'Deep Reach Truck (Clase II)' },
    { label: 'Raymond 7700', value: 'Raymond 7700', description: 'Reach Truck (Clase II)' },
    { label: 'Raymond 4150', value: 'Raymond 4150', description: '3-Wheel Counterbalance (Clase I)' },
    { label: 'Raymond 4250', value: 'Raymond 4250', description: 'Counterbalance (Clase I)' },
    { label: 'Raymond 4460', value: 'Raymond 4460', description: 'Sit-Down Counterbalance (Clase I)' },
    { label: 'Raymond 4750', value: 'Raymond 4750', description: '4-Wheel Counterbalance (Clase I)' },
    { label: 'Raymond 5200', value: 'Raymond 5200', description: 'Orderpicker (Clase II)' },
    { label: 'Raymond 5300', value: 'Raymond 5300', description: 'Orderpicker (Clase II)' },
    { label: 'Raymond 5400', value: 'Raymond 5400', description: 'Orderpicker (Clase II)' },
    { label: 'Raymond 5500', value: 'Raymond 5500', description: 'Orderpicker (Clase II)' },
    { label: 'Raymond 5600', value: 'Raymond 5600', description: 'Orderpicker (Clase II)' },
    { label: 'Raymond 8210', value: 'Raymond 8210', description: 'Walkie Pallet Truck (Clase III)' },
    { label: 'Raymond 8410', value: 'Raymond 8410', description: 'End Rider Pallet Truck (Clase III)' },
    { label: 'Raymond 8510', value: 'Raymond 8510', description: 'Center Rider Pallet Truck (Clase III)' },
    { label: 'Raymond 8610', value: 'Raymond 8610', description: 'Tow Tractor (Clase VI)' },
    { label: 'Raymond 8900', value: 'Raymond 8900', description: 'Rider Pallet Truck (Clase III)' },
    { label: 'Raymond 6210', value: 'Raymond 6210', description: 'Walkie Stacker (Clase III)' },
    { label: 'Raymond 7200', value: 'Raymond 7200', description: 'Reach Truck (Clase II)' },
    { label: 'Raymond 9600', value: 'Raymond 9600', description: 'Swing Reach (Clase II)' },
    { label: 'Raymond 9700', value: 'Raymond 9700', description: 'Swing Reach (Clase II)' },
    { label: '8FG50', value: '8FG50', description: 'Toyota Gas Counterbalance (Clase V)' },
    { label: '8FBN25', value: '8FBN25', description: 'Toyota Electric Counterbalance (Clase I)' },
  ];

  const modeloOptions = useMemo<SearchableSelectOption[]>(() => {
    const map = new Map<string, SearchableSelectOption>();
    defaultModelosCatalog.forEach(m => map.set(m.value.toLowerCase(), m));
    
    (fleetAssets || []).forEach((a: any) => {
      if (a.modelo && a.modelo.trim()) {
        const val = a.modelo.trim();
        const key = val.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            label: val,
            value: val,
            description: a.clase ? `Clase ${a.clase}` : 'Modelo Registrado'
          });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [fleetAssets]);

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

  useEffect(() => {
    const term = newAssetModelo.toLowerCase();
    if (term.includes('7400') || term.includes('4250') || term.includes('4750')) {
      setNewAssetClase('I');
    } else if (term.includes('order picker') || term.includes('5000')) {
      setNewAssetClase('II');
    } else if (term.includes('patin') || term.includes('8000') || term.includes('8210')) {
      setNewAssetClase('III');
    }
  }, [newAssetModelo]);

  // Auto-select single client in Nuevo Equipo modal
  useEffect(() => {
    if (isNewAssetModalOpen && clientesDisponibles.length === 1 && !newAssetCliente) {
      setNewAssetCliente(clientesDisponibles[0].id);
    }
  }, [isNewAssetModalOpen, clientesDisponibles, newAssetCliente]);

  // Auto-select single sitio in Nuevo Equipo modal
  useEffect(() => {
    if (isNewAssetModalOpen && newAssetCliente) {
      const client = clientesDisponibles.find((c: any) => c.id === newAssetCliente);
      const sitios = client?.sitios || [];
      if (sitios.length === 1 && newAssetSitio !== sitios[0].id) {
        setNewAssetSitio(sitios[0].id);
      }
    }
  }, [isNewAssetModalOpen, newAssetCliente, clientesDisponibles, newAssetSitio]);

  // Auto-select single destination site in Transfer modal
  useEffect(() => {
    if (isTransferModalOpen && allSites.length === 1 && !transferDestinationSite) {
      setTransferDestinationSite(allSites[0].id);
    }
  }, [isTransferModalOpen, allSites, transferDestinationSite]);

  useEffect(() => {
    if (editingData.modelo) {
      const term = editingData.modelo.toLowerCase();
      let newClase = editingData.clase;
      if (term.includes('7400') || term.includes('4250') || term.includes('4750')) {
        newClase = 'I';
      } else if (term.includes('order picker') || term.includes('5000')) {
        newClase = 'II';
      } else if (term.includes('patin') || term.includes('8000') || term.includes('8210')) {
        newClase = 'III';
      }
      if (newClase !== editingData.clase) {
        setEditingData((prev: any) => ({ ...prev, clase: newClase }));
      }
    }
  }, [editingData.modelo]);

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const handleApprove = async (id: string) => {
    setActionLoadingId(id);
    const toastId = toast.loading('Aprobando solicitud...');
    try {
      await api.post(`/r4/flotilla/solicitudes/${id}/aprobar`);
      toast.success('Cambio aprobado con éxito', { id: toastId });
      await Promise.all([fetchPendingApprovals(), fetchFlotilla()]);
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('Error al aprobar el cambio', { id: toastId });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoadingId(id);
    const toastId = toast.loading('Rechazando solicitud...');
    try {
      await api.post(`/r4/flotilla/solicitudes/${id}/rechazar`);
      toast.success('Cambio rechazado', { id: toastId });
      await fetchPendingApprovals();
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Error al rechazar el cambio', { id: toastId });
    } finally {
      setActionLoadingId(null);
    }
  };

  const startEditing = (e: React.MouseEvent, asset: any) => {
    e.stopPropagation();
    if (isAdc && !isTestingAdmin) {
      const adcLower = (asset.adc || '').toLowerCase().trim();
      const adcKeywords = loggedInAdcName.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      const userFirstName = (user?.firstName || '').toLowerCase().trim();
      const isOwner = adcKeywords.some(kw => adcLower === kw || adcLower.includes(kw) || kw.includes(adcLower)) ||
        (userFirstName && adcLower.includes(userFirstName));
      if (!isOwner) {
        toast.error('Solo puedes editar o solicitar cambios para equipos de tu propio ADC asignado.');
        return;
      }
    }
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
        toast.info('Solicitud de cambio enviada para aprobación de Gerencia.');
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
        toast.error(`Las transferencias entre diferentes ADCs deben ser autorizadas por Gerencia. Por favor cambie el estatus del equipo a "Inactivo" primero.`);
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
        toast.info('Solicitud de transferencia enviada a Gerencia para aprobación.');
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

  const handleCloseTransferModal = () => {
    setIsTransferModalOpen(false);
    setSelectedAssetForTransfer(null);
    setTransferDestinationSite('');
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
      // Build renta section only if user filled at least precio or tipo poliza
      const hasRentaData = newRentaPrecio || newRentaPoliza !== 'SMP' || newRentaFechaInicio || newRentaFolioOc || newRentaPedidoTotvs;
      const rentaPayload = hasRentaData ? {
        renta_precio: newRentaPrecio ? parseFloat(newRentaPrecio) : undefined,
        renta_moneda: newRentaMoneda,
        tipo_poliza: newRentaPoliza,
        costo_poliza_distribuidor: newRentaCostoDealer ? parseFloat(newRentaCostoDealer) : undefined,
        moneda_pago_distribuidor: newRentaMonedaDealer,
        fecha_inicio: newRentaFechaInicio || undefined,
        plazo_meses: newRentaPlazo ? parseInt(newRentaPlazo) : undefined,
        fecha_fin: newRentaFechaFin || undefined,
        oc_cliente: newRentaFolioOc || undefined,
        no_registro_totvs: newRentaPedidoTotvs || undefined,
        fecha_pedido_totvs: newRentaFechaTotvs || undefined,
      } : undefined;

      const selectedSiteObj = (clientesDisponibles.find(c => c.id === newAssetCliente)?.sitios || []).find((s: any) => s.id === newAssetSitio);
      const computedCuenta = newAssetCuenta || selectedSiteObj?.cuenta || undefined;

      const payload = {
        serie: newAssetSerie,
        tipo: newAssetTipo,
        clase: newAssetClase,
        modelo: newAssetModelo,
        oach: newAssetOach,
        altura: newAssetAltura,
        bc: newAssetBc,
        estatus_operativo: newAssetEstatus,
        cliente_id: newAssetCliente,
        cuenta: computedCuenta,
        sitio_id: newAssetSitio,
        adc: isAdc ? (loggedInAdcName || newAssetAdc) : (newAssetAdc || loggedInAdcName),
        distribuidor: newAssetDistribuidor,
        propietario: newAssetPropietario,
        ...(newAssetIwarehouse && { info_tecnica: { iwarehouse: newAssetIwarehouse } }),
        ...(rentaPayload && { renta: rentaPayload }),
      };

      // Creación directa de alta de equipo para todos los roles (incluidos ADC) sin requerir aprobación ni notificar administradores
      await api.post('/r4/flotilla', payload);
      toast.success(hasRentaData ? 'Equipo y Renta registrados con éxito' : 'Equipo registrado con éxito');
      handleCloseNewAssetModal();
      fetchFlotilla();
      fetchPendingApprovals();
    } catch (error: any) {
      console.error('Error creating asset:', error);
      toast.error(error.response?.data?.message || 'Error al procesar el alta del equipo');
    }
  };

  const handleCloseNewAssetModal = () => {
    setIsNewAssetModalOpen(false);
    setNewAssetSerie('');
    setNewAssetModelo('');
    setNewAssetClase('I');
    setNewAssetCliente('');
    setNewAssetCuenta('');
    setNewAssetSitio('');
    setNewAssetAdc('');
    setNewAssetDistribuidor('');
    setNewAssetPropietario('');
    setNewAssetIwarehouse('');
    setNewAssetOach('');
    setNewAssetAltura('');
    setNewAssetBc('');
    // Reset renta section
    setShowRentaSection(false);
    setNewRentaPrecio('');
    setNewRentaMoneda('MXN');
    setNewRentaPoliza('SMP');
    setNewRentaCostoDealer('');
    setNewRentaMonedaDealer('MXN');
    setNewRentaFechaInicio('');
    setNewRentaPlazo('');
    setNewRentaFechaFin('');
    setNewRentaFolioOc('');
    setNewRentaPedidoTotvs('');
    setNewRentaFechaTotvs('');
  };

  const handleDeleteClick = (e: React.MouseEvent, asset: any) => {
    e.stopPropagation();
    setDeleteConfirmModal({
      isOpen: true,
      asset,
      isDeleting: false,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmModal.asset) return;
    try {
      setDeleteConfirmModal(prev => ({ ...prev, isDeleting: true }));
      await api.delete(`/r4/flotilla/${deleteConfirmModal.asset.serie}`);
      toast.success(`Equipo ${deleteConfirmModal.asset.serie} eliminado correctamente`);
      setDeleteConfirmModal({ isOpen: false, asset: null, isDeleting: false });
      fetchFlotilla();
    } catch (error: any) {
      console.error('Error deleting asset:', error);
      toast.error(error.response?.data?.message || 'Error al eliminar el equipo');
      setDeleteConfirmModal(prev => ({ ...prev, isDeleting: false }));
    }
  };

  // ADC Visual Filtering Logic
  // Bypass filter for the generic "comercial.admin2" testing account
  const isTestingAdmin = user?.email === 'comercial.admin2@run.com' || (user as any)?.username === 'Administrador';
  
  const isAdministrator = userRole === 'administrador' || userRole.includes('coordinaci') || userRole.includes('geren');

  let baseAssets = fleetAssets;
  if (isAdc && !isTestingAdmin) {
    baseAssets = fleetAssets.filter(a => {
        const adcLower = a.adc?.toLowerCase() || '';
        const userLower = loggedInAdcName.toLowerCase();
        const usernameLower = (user as any)?.username?.toLowerCase() || '';
        const emailLower = user?.email?.toLowerCase() || '';
        return adcLower === userLower || 
               userLower.includes(adcLower) || 
               (user?.firstName && adcLower.includes(user.firstName.toLowerCase())) ||
               usernameLower.includes(adcLower) ||
               emailLower.includes(adcLower);
    });
  } else if (isAdministrator && adminAdcScope === 'mis_adcs') {
    // Leer ADCs asignados: primero del perfil fresco de la API, luego del store
    const rawAdcAsociado = 
      freshUserProfile?.adcAsociadoName ||
      (user as any)?.adc_asociado_name || 
      (user as any)?.adcAsociadoName || '';

    let assignedAdcKeywords: string[] = [];

    if (rawAdcAsociado && rawAdcAsociado !== 'ninguno') {
      // El campo puede contener múltiples ADCs separados por coma: "Andrea Esquivel, Montserrat Covarrubias"
      assignedAdcKeywords = rawAdcAsociado
        .split(',')
        .map((s: string) => s.trim().toLowerCase())
        .filter(Boolean);
    }

    if (assignedAdcKeywords.length === 0) {
      // Si no tiene ADCs asignados, mostrar vacío con mensaje informativo
      baseAssets = [];
    } else {
      baseAssets = fleetAssets.filter(a => {
        const adcLower = (a.adc || '').toLowerCase().trim();
        return assignedAdcKeywords.some(kw => 
          adcLower === kw || 
          adcLower.includes(kw) || 
          kw.includes(adcLower)
        );
      });
    }
  }

  const normalizedAssets = baseAssets.map(a => {
    // Normalize ESTATUS to the master file nomenclature
    let estatus = a.estatus || a.estatus_operativo || '';
    const estatusUpper = estatus.toUpperCase().trim();
    if (estatusUpper === 'ACTIVO' || estatusUpper === 'OPERATIVO' || estatusUpper === 'DISPONIBLE') {
      estatus = 'Activo';
    } else if (estatusUpper.includes('INACTIVO') && estatusUpper.includes('CLIENTE')) {
      estatus = 'Inactivo con Cliente';
    } else if (estatusUpper.startsWith('INACTIVO')) {
      estatus = 'Inactivo';
    } else if (estatusUpper === 'BACK UP' || estatusUpper === 'BACKUP' || estatusUpper === 'COMODATO') {
      estatus = 'Back Up';
    } else if (estatusUpper.includes('ENTREGAR') || estatusUpper.includes('ENTREGAR')) {
      estatus = 'Por Entregar';
    } else if (estatusUpper.includes('RETIRAR')) {
      estatus = 'Por Retirar';
    }
    return {
      ...a,
      estatus,
      distribuidor: typeof a.distribuidor === 'string' ? a.distribuidor.toUpperCase() : a.distribuidor,
      modelo: typeof a.modelo === 'string' ? a.modelo.toUpperCase() : a.modelo,
      serie: typeof a.serie === 'string' ? a.serie.toUpperCase() : a.serie,
    };
  });

  const getValidString = (val: any) => typeof val === 'string' && val !== '[object Object]' ? val : null;
  
  const isMatchFilter = (filterVals: string[], valToTest: any) => {
    if (!filterVals || filterVals.length === 0 || filterVals.includes('Todos')) return true;
    return filterVals.includes(valToTest);
  };

  const getFilteredFor = (skipFilterName: string) => {
    return normalizedAssets.filter((asset: any) => {
      for (const [key, selected] of Object.entries(activeFilters)) {
        if (key === skipFilterName) continue;
        const val = asset[key];
        if (!isMatchFilter(selected, val)) return false;
      }
      return true;
    });
  };

  const getUnique = (key: string) => {
    return Array.from(new Set(getFilteredFor(key).map(a => getValidString(a[key])).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  };

  const filteredAssets = normalizedAssets.filter((asset: any) => {
    for (const [key, selected] of Object.entries(activeFilters)) {
      const val = asset[key];
      if (!isMatchFilter(selected, val)) return false;
    }
    
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      asset.serie?.toLowerCase().includes(term) ||
      asset.cliente?.toLowerCase().includes(term) ||
      asset.modelo?.toLowerCase().includes(term)
    );
  });

  const renderFilter = (key: string, label: string, title: string) => (
    <TableHeaderFilter
      label={label}
      title={title}
      value={activeFilters[key] || []}
      onChange={(val) => { setActiveFilters(prev => ({ ...prev, [key]: val })); setCurrentPage(1); }}
      options={getUnique(key)}
      open={openFilters[key] || false}
      setOpen={(val) => setOpenFilters(prev => ({ ...prev, [key]: val as boolean }))}
      search={searchFilters[key] || ''}
      setSearch={(val) => setSearchFilters(prev => ({ ...prev, [key]: val }))}
      currentColor={currentColor}
    />
  );

  // Sort alphabetically by client name, then secondary by series
  const sortedAssets = [...filteredAssets].sort((a: any, b: any) => {
    const clientA = (a.cliente || a.cliente_nombre || '').toString().trim();
    const clientB = (b.cliente || b.cliente_nombre || '').toString().trim();
    const clientCompare = clientA.localeCompare(clientB, 'es', { sensitivity: 'base' });
    if (clientCompare !== 0) return clientCompare;
    const serieA = (a.serie || '').toString().trim();
    const serieB = (b.serie || '').toString().trim();
    return serieA.localeCompare(serieB, 'es', { sensitivity: 'base' });
  });

  const totalPages = Math.ceil(sortedAssets.length / itemsPerPage);
  const paginatedAssets = sortedAssets.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const isAccesorio = (a: any) => {
    if (!a) return false;
    if (a.esAccesorio === true || a.isAccesorio === true) return true;
    
    const claseStr = (a.clase || '').toString().toLowerCase().trim();
    const tipoStr = (a.tipo || '').toString().toLowerCase().trim();

    // CLASE "Others" = todos los accesorios/periféricos del Excel (baterías, cargadores, etc.)
    if (claseStr === 'others' || claseStr === 'other') {
      return true;
    }

    // Clase includes 'bater' (baterias/bateria)
    if (claseStr.includes('bater')) {
      return true;
    }

    // Tipo includes any accessory keyword
    if (
      tipoStr.includes('accesorio') || 
      tipoStr.includes('bater') || 
      tipoStr.includes('cargador') ||
      tipoStr.includes('intercambiador') ||
      tipoStr.includes('battery stand') ||
      tipoStr.includes('aditamento') ||
      tipoStr === 'otros'
    ) {
      return true;
    }

    return false;
  };

  const isEquipo = (a: any) => !isAccesorio(a);

  const getEstatusCount = (statusList: string[], category: 'equipos' | 'accesorios') => 
    filteredAssets.filter(a => {
      if (!a || !a.estatus) return false;
      const isAcc = isAccesorio(a);
      if (category === 'equipos' && isAcc) return false;
      if (category === 'accesorios' && !isAcc) return false;
      return statusList.map(s => s.toUpperCase()).includes(a.estatus.toUpperCase());
    }).length;

  const statusCounts = {
    // Row 1: Indicadores para Equipos
    equiposActivos: getEstatusCount(['Activo', 'Activa', 'En Renta', 'Vigente', 'Comodato', 'Asignado'], 'equipos'),
    equiposBackup: getEstatusCount(['Back Up', 'Backup'], 'equipos'),
    equiposInactivoCliente: getEstatusCount(['Inactivo con Cliente'], 'equipos'),

    // Row 2: Indicadores para Accesorios
    accesoriosActivos: getEstatusCount(['Activo', 'Activa', 'En Renta', 'Vigente', 'Comodato', 'Asignado'], 'accesorios'),
    accesoriosInactivos: getEstatusCount(['Inactivo', 'Inactivo con Cliente'], 'accesorios'),
  };

  const handleDownloadExcel = async () => {
    try {
      toast.info('Generando Excel con registros filtrados...');
      const rows = filteredAssets.map((asset: any) => ({
        'CLIENTE': asset.cliente || '',
        'CUENTA': asset.cuenta || '',
        'SITE': asset.site || '',
        'ADC': asset.adc || '',
        'DISTRIBUIDOR': asset.distribuidor || '',
        'TIPO': asset.tipo || '',
        'CLASE': asset.clase || '',
        'MODELO': asset.modelo || '',
        'SERIE': asset.serie || '',
        'IWAREHOUSE': asset.iwarehouse || '-',
        'OACH': asset.oach || '',
        'ALTURA': asset.altura || '',
        'BC': asset.bc || '',
        'PROPIETARIO': asset.propietario || '',
        'ESTATUS': asset.estatus || '',
        'FECHA ENTREGADO': asset.fechaIngreso || '',
        'PLAZO (MESES)': asset.plazo || '',
        'FECHA VENCIMIENTO': asset.fechaVencimiento || '',
        'PRECIO RENTA CLIENTE': asset.renta_precio || '',
        'MONEDA': asset.renta_moneda || '',
        'CFPM / SMP': asset.tipo_poliza || '',
        'COSTO SERVICIO DEALER': asset.costo_poliza_distribuidor || '',
        'MONEDA SERVICIO': asset.moneda_pago_distribuidor || '',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Flotilla");
      XLSX.writeFile(wb, `Flotilla_${new Date().getTime()}.xlsx`);

      toast.success('Excel generado correctamente');
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
    setUploadError(null);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      // Full bulk load: admin/gerente use /r4/carga-masiva
      // Partial load: ADC use /r4/carga-masiva/parcial (backend filters rows by the ADC's name)
      const endpoint = isAdc ? '/r4/carga-masiva/parcial' : '/r4/carga-masiva';
      const response = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = response.data?.data || response.data || {};
      setUploadResult(data);
      toast.success(isAdc ? 'Cargue parcial procesado exitosamente.' : 'Carga masiva procesada exitosamente.');
      // Refresh flotilla and sites in background
      fetchFlotilla();
      fetchSites();
    } catch (error: any) {
      console.error('Error uploading file:', error);
      const errMsg = error.response?.data?.message || 'Error al procesar el archivo. Verifica el formato e intenta nuevamente.';
      setUploadError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsUploading(false);
    }
  };
  const uniqueADCs = Array.from(new Set(normalizedAssets.map((a: any) => a.adc).filter(Boolean))).sort() as string[];
  const uniqueDistribuidores = Array.from(new Set(normalizedAssets.map((a: any) => a.distribuidor).filter(Boolean))).sort() as string[];
  const uniqueClases = Array.from(new Set(normalizedAssets.map((a: any) => a.clase).filter(Boolean))).sort() as string[];

  const renderIwarehouseBadge = (val: string) => {
    if (!val || val === '-') return <span className="text-slate-400">-</span>;
    const isYes = val.toUpperCase().trim() === 'SI' || val.toUpperCase().trim() === 'SÍ' || val.toUpperCase().trim() === 'YES';
    if (isYes) return <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200">Sí</span>;
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">No</span>;
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-[0.25em] mb-1" style={{ color: currentColor }}>RAYMOND</span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Flotilla Rental</h1>
          <p className="text-slate-500 font-medium mt-1 text-sm">Gestión integral de equipos, mantenimientos y ubicaciones</p>
        </div>
        
        {/* Header Action Buttons (Primary CTA & Alerts Only) */}
        <div className="flex items-center gap-3 shrink-0">
          {!isAdc && pendingApprovals.length > 0 && (
            <button
              onClick={() => setShowApprovalsTab(!showApprovalsTab)}
              className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl sm:rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-sm border-2 ${showApprovalsTab ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-600 border-red-200 hover:bg-red-50'}`}
            >
              <AlertTriangle className="w-4 h-4" />
              Aprobaciones ({pendingApprovals.length})
            </button>
          )}
          <button 
            onClick={() => setIsNewAssetModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 text-white rounded-xl sm:rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg whitespace-nowrap hover:opacity-90 active:scale-95"
            style={{ backgroundColor: currentColor, boxShadow: `0 4px 14px 0 ${currentColor}40` }}
          >
            <Plus className="w-4 h-4" />
            <span>Alta de Equipo</span>
          </button>
        </div>
      </div>

      {/* Global Tab Loader */}
      {loading && fleetAssets.length === 0 ? (
        <PageLoader title="Cargando base instalada..." subtitle="Calculando métricas ejecutivas..." color={currentColor} />
      ) : (
        <>
          {/* Differentiated Indicators Row */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
            
            {/* GROUP 1: EQUIPOS (3 Columns) */}
            <div className="lg:col-span-3 bg-white/60 p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
              <div className="flex items-center gap-1.5 px-1">
                <Truck className="w-3.5 h-3.5 text-red-600" />
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">Indicadores de Equipos</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Equipos Activos */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 hover:border-emerald-300 hover:shadow-xs transition-all flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1 mb-0.5">
                      <p className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">Activos</p>
                      <TooltipInfo text="Total de equipos activos operando." formula='Count(Activos con Estatus = "Activo")' />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">
                      {statusCounts.equiposActivos.toLocaleString('es-MX')}
                    </h3>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>

                {/* Equipos Back Up */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 hover:border-purple-300 hover:shadow-xs transition-all flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1 mb-0.5">
                      <p className="text-[10px] font-black text-purple-700 uppercase tracking-wider">Back Up</p>
                      <TooltipInfo text="Equipos de respaldo en almacén o retenidos." formula='Count(Activos con Estatus = "Back Up")' />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">
                      {statusCounts.equiposBackup.toLocaleString('es-MX')}
                    </h3>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>

                {/* Equipos Inactivo con Cliente */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 hover:border-amber-300 hover:shadow-xs transition-all flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1 mb-0.5">
                      <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider">Inactivo c/ Cliente</p>
                      <TooltipInfo text="Equipos asignados pero parados o inactivos en sitio del cliente." formula='Count(Activos con Estatus = "Inactivo con Cliente")' />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">
                      {statusCounts.equiposInactivoCliente.toLocaleString('es-MX')}
                    </h3>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>

            {/* GROUP 2: ACCESORIOS (2 Columns) */}
            <div className="lg:col-span-2 bg-slate-50/80 p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
              <div className="flex items-center gap-1.5 px-1">
                <HardDrive className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">Indicadores de Accesorios</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Accesorios Activos */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 hover:border-blue-300 hover:shadow-xs transition-all flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1 mb-0.5">
                      <p className="text-[10px] font-black text-blue-700 uppercase tracking-wider">Activos</p>
                      <TooltipInfo text="Accesorios en operación regular." formula='Count(Accesorios con Estatus = "Activo")' />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">
                      {statusCounts.accesoriosActivos.toLocaleString('es-MX')}
                    </h3>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Activity className="w-4 h-4" />
                  </div>
                </div>

                {/* Accesorios Inactivos */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 hover:border-rose-300 hover:shadow-xs transition-all flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1 mb-0.5">
                      <p className="text-[10px] font-black text-rose-700 uppercase tracking-wider">Inactivos</p>
                      <TooltipInfo text="Accesorios inactivos o retirados." formula='Count(Accesorios con Estatus = "Inactivo")' />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">
                      {statusCounts.accesoriosInactivos.toLocaleString('es-MX')}
                    </h3>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                    <X className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>

          </div>

      {/* Coordinator Approval Drawer */}
      {showApprovalsTab && !isAdc && pendingApprovals.length > 0 && (
        <div className="bg-red-50/50 p-6 border-2 border-red-100 rounded-[2rem] space-y-4 animate-in slide-in-from-top duration-300">
          <h2 className="text-lg font-black text-red-800 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Solicitudes Pendientes de Aprobación
          </h2>
          <div className="overflow-x-auto bg-white rounded-2xl border border-red-100 shadow-sm">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-red-50 text-[9px] text-red-700 uppercase tracking-widest border-b border-red-100">
                <tr>
                  <th className="px-4 py-3 font-black">Solicitante (ADC)</th>
                  <th className="px-4 py-3 font-black">Acción</th>
                  <th className="px-4 py-3 font-black">Equipo (Serie / Modelo)</th>
                  <th className="px-4 py-3 font-black">Sitio Anterior</th>
                  <th className="px-4 py-3 font-black">Sitio Propuesto</th>
                  <th className="px-4 py-3 font-black">Detalles Propuestos</th>
                  <th className="px-4 py-3 font-black">Fecha / Hora Envío</th>
                  <th className="px-4 py-3 font-black text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-50 text-slate-700 font-bold">
                {pendingApprovals.map((sol: any) => {
                  const sitioAntNombre = sol.sitioAnteriorNombre || allSites.find(s => s.id === sol.sitioAnteriorId)?.nombre || 'Sin sitio anterior';
                  const sitioNvoNombre = sol.sitioNuevoNombre || allSites.find(s => s.id === sol.sitioNuevoId)?.nombre || sol.sitioNuevoId;
                  const accionBadge = sol.accionNombre || (sol.datosPropuestos?.tipo === 'ALTA' ? 'Alta de Equipo' : sol.datosPropuestos?.tipo === 'EDICION' ? 'Edición de Equipo' : 'Transferencia de Sitio');

                  return (
                    <tr key={sol.id} className="hover:bg-red-50/50 transition-colors">
                      <td className="px-4 py-3 font-black text-slate-900">{sol.solicitante || 'ADC Solicitante'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                          {accionBadge}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-900 font-black">{sol.activoSerie} ({sol.activoModelo})</td>
                      <td className="px-4 py-3 text-slate-500">{sitioAntNombre}</td>
                      <td className="px-4 py-3 text-red-700 font-black">{sitioNvoNombre}</td>
                      <td className="px-4 py-3">
                        {sol.datosPropuestos?.datos ? (
                          <div className="space-y-0.5 text-[10px]">
                            {Object.entries(sol.datosPropuestos.datos).map(([k, v]: any) => (
                              <div key={k}><span className="text-slate-400 font-normal">{k}:</span> {String(v)}</div>
                            ))}
                          </div>
                        ) : <span className="text-slate-400 italic">Transferencia de sitio</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-[10px] font-medium">
                        {sol.fechaEnvioFormatted || new Date(sol.fecha).toLocaleString('es-MX')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-2 justify-end">
                          <button 
                            disabled={actionLoadingId === sol.id} 
                            onClick={() => handleApprove(sol.id)} 
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5"
                          >
                            {actionLoadingId === sol.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                            <span>Aprobar</span>
                          </button>
                          <button 
                            disabled={actionLoadingId === sol.id} 
                            onClick={() => handleReject(sol.id)} 
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5"
                          >
                            {actionLoadingId === sol.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                            <span>Rechazar</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dedicated Controls & Search Toolbar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border-2 border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        {/* Left: Search Bar & Clear Filters */}
        <div className="flex items-center gap-3 flex-1 w-full md:w-auto">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 focus-within:text-red-500 transition-colors" />
            <input
              type="text"
              placeholder="Buscar serie..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 hover:bg-slate-100/60 focus:bg-white border-2 border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:border-red-500 focus:outline-none transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {hasActiveFilters && (
            <button 
              onClick={clearFilters} 
              className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl border-2 border-red-200 text-xs font-bold transition-all shadow-sm shrink-0" 
              title="Limpiar todos los filtros"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Limpiar filtros</span>
            </button>
          )}
        </div>

        {/* Right: Data Actions (Import/Export) + Scope Selector + View Switcher */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 shrink-0 justify-between lg:justify-end w-full lg:w-auto">
          {/* Data Actions: Carga Masiva & Exportar */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-all whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>{isAdc ? 'Cargue Parcial' : 'Carga Masiva'}</span>
            </button>
            <button
              onClick={handleDownloadExcel}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-all whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Exportar</span>
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="bg-white border-2 border-slate-100 rounded-[2rem] shadow-sm overflow-hidden animate-in fade-in duration-300">
        <div className="overflow-x-auto overflow-y-auto max-h-[65vh] relative scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
          {loading ? (
            <div className="p-4">
              <TableSkeleton rows={12} columns={14} />
            </div>
          ) : (
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="sticky top-0 z-20 bg-slate-50 text-[10px] text-slate-500 uppercase tracking-widest border-b-2 border-slate-100 shadow-sm">
                <tr>
                  <th className="px-4 py-3.5">{renderFilter('cliente', 'Cliente', 'CLIENTE')}</th>
                  <th className="px-4 py-3.5">{renderFilter('cuenta', 'Cuenta', 'CUENTA')}</th>
                  <th className="px-4 py-3.5">{renderFilter('site', 'Site', 'SITE')}</th>
                  <th className="px-4 py-3.5">{renderFilter('tipo', 'Tipo', 'TIPO')}</th>
                  <th className="px-4 py-3.5">{renderFilter('clase', 'Clase', 'CLASE')}</th>
                  <th className="px-4 py-3.5">{renderFilter('modelo', 'Modelo', 'MODELO')}</th>
                  <th className="px-4 py-3.5">{renderFilter('serie', 'Serie', 'SERIE')}</th>
                  <th className="px-4 py-3.5">{renderFilter('iwarehouse', 'iWarehouse', 'IWAREHOUSE')}</th>
                  <th className="px-4 py-3.5">{renderFilter('oach', 'OACH', 'OACH')}</th>
                  <th className="px-4 py-3.5">{renderFilter('altura', 'Altura', 'ALTURA')}</th>
                  <th className="px-4 py-3.5">{renderFilter('bc', 'BC', 'BC')}</th>
                  <th className="px-4 py-3.5">{renderFilter('fechaIngreso', 'F. Entregado', 'F. ENTREGADO')}</th>
                  <th className="px-4 py-3.5">{renderFilter('plazo', 'Plazo (meses)', 'PLAZO')}</th>
                  <th className="px-4 py-3.5">{renderFilter('fechaVencimiento', 'F. Vencimiento', 'VENCIMIENTO')}</th>
                  <th className="px-4 py-3.5 text-right">{renderFilter('renta_precio', 'Precio Renta', 'PRECIO')}</th>
                  <th className="px-4 py-3.5">{renderFilter('renta_moneda', 'Moneda', 'MONEDA')}</th>
                  <th className="px-4 py-3.5">{renderFilter('tipo_poliza', 'Tipo Póliza', 'PÓLIZA')}</th>
                  <th className="px-4 py-3.5">{renderFilter('distribuidor', 'Distribuidor', 'DISTRIBUIDOR')}</th>
                  <th className="px-4 py-3.5 text-right">{renderFilter('costo_poliza_distribuidor', 'Costo Póliza', 'COSTO')}</th>
                  <th className="px-4 py-3.5">{renderFilter('moneda_pago_distribuidor', 'Moneda Pago', 'MONEDA PAGO')}</th>
                  <th className="px-4 py-3.5">{renderFilter('estatus', 'Estatus', 'ESTATUS')}</th>
                  <th className="px-4 py-3.5">{renderFilter('propietario', 'Propietario', 'PROPIETARIO')}</th>
                  {!isAdc ? (
                    <th className="px-4 py-3.5">{renderFilter('adc', 'Ejecutivo (ADC)', 'ADC')}</th>
                  ) : null}
                  <th className="px-4 py-3.5 font-black text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssets.length === 0 ? (
                  <tr><td colSpan={24} className="px-6 py-12 text-center text-slate-400 font-bold">No se encontraron activos con los filtros seleccionados.</td></tr>
                ) : paginatedAssets.map((asset) => {
                  const cellPy = density === 'compact' ? 'py-2' : 'py-3.5';
                  return (
                  <tr key={asset.serie} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={(e) => startEditing(e, asset)}>
                    <td className={`px-4 ${cellPy} font-bold text-slate-800`}>{asset.cliente}</td>
                    <td className={`px-4 ${cellPy} text-slate-800 font-bold`}>{asset.cuenta}</td>
                    <td className={`px-4 ${cellPy}`}>{asset.site}</td>
                    <td className={`px-4 ${cellPy}`}>{asset.tipo}</td>
                    <td className={`px-4 ${cellPy} font-mono text-[11px]`}>{asset.clase}</td>
                    <td className={`px-4 ${cellPy} font-bold text-slate-800`}>{asset.modelo}</td>
                    <td className={`px-4 ${cellPy}`}>
                      <Link href={`/r4/flotilla/${asset.serie}`} className="font-black text-slate-900 hover:text-red-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                        {asset.serie}
                      </Link>
                    </td>
                    <td className={`px-4 ${cellPy} text-center`}>{renderIwarehouseBadge(asset.iwarehouse)}</td>
                    <td className={`px-4 ${cellPy} text-slate-500`}>{asset.oach || '-'}</td>
                    <td className={`px-4 ${cellPy} text-slate-500`}>{asset.altura || '-'}</td>
                    <td className={`px-4 ${cellPy} text-slate-500`}>{asset.bc || '-'}</td>
                    <td className={`px-4 ${cellPy} text-slate-500`}>{asset.fechaIngreso || '-'}</td>
                    <td className={`px-4 ${cellPy} text-slate-500`}>{asset.plazo || '-'}</td>
                    <td className={`px-4 ${cellPy} text-slate-500`}>{asset.fechaVencimiento || '-'}</td>
                    <td className={`px-4 ${cellPy} text-right font-black text-slate-950`}>${Number(asset.renta_precio).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                    <td className={`px-4 ${cellPy}`}>{asset.renta_moneda}</td>
                    <td className={`px-4 ${cellPy} font-bold`}>{asset.tipo_poliza}</td>
                    <td className={`px-4 ${cellPy}`}>{asset.distribuidor}</td>
                    <td className={`px-4 ${cellPy} text-right font-black text-slate-900`}>${Number(asset.costo_poliza_distribuidor).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                    <td className={`px-4 ${cellPy}`}>{asset.moneda_pago_distribuidor}</td>
                    <td className={`px-4 ${cellPy}`}>
                      <span className={`inline-flex items-center px-2 py-0.5 text-[9px] font-black uppercase rounded border tracking-wider ${statusColors[asset.estatus as keyof typeof statusColors] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                        {asset.estatus}
                      </span>
                    </td>
                    <td className={`px-4 ${cellPy} font-bold`}>{asset.propietario}</td>
                    {!isAdc && <td className={`px-4 ${cellPy} font-bold text-slate-500`}>{asset.adc}</td>}
                    <td className={`px-4 ${cellPy} text-right`} onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/r4/flotilla/${asset.serie}`} className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 rounded-lg transition-colors" title="Ver detalle">
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        <button onClick={(e) => startEditing(e, asset)} className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 rounded-lg transition-colors" title="Editar">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={(e) => openTransferModal(e, asset)} className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 rounded-lg transition-colors" title="Transferir de sitio">
                          <MapPin className="w-3.5 h-3.5" />
                        </button>
                        {isAdministrator && (
                          <button onClick={(e) => handleDeleteClick(e, asset)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar equipo">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            )}
          </div>
          
          {/* Table Pagination */}
          {sortedAssets.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t-2 border-slate-50 bg-slate-50/50 gap-4">
              <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                <span>
                  Mostrando <strong className="text-slate-900 font-bold">{((currentPage - 1) * itemsPerPage) + 1}</strong> a <strong className="text-slate-900 font-bold">{Math.min(currentPage * itemsPerPage, sortedAssets.length)}</strong> de <strong className="text-slate-900 font-bold">{sortedAssets.length}</strong> registros
                </span>
                <span className="text-slate-300">|</span>
                <div className="flex items-center gap-1.5">
                  <span>Filas:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 cursor-pointer shadow-xs"
                  >
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all cursor-pointer shadow-xs"
                  title="Primera página"
                >
                  «
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all cursor-pointer shadow-xs"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>

                <div className="flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 shadow-xs">
                  <span>{currentPage} / {totalPages}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all cursor-pointer shadow-xs"
                >
                  <span>Siguiente</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all cursor-pointer shadow-xs"
                  title="Última página"
                >
                  »
                </button>
              </div>
            </div>
          )}
        </div>
      </>
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
              className="bg-white border border-slate-200 rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-base font-black flex items-center gap-2 text-slate-900">
                  <HardDrive className="w-5 h-5" style={{ color: isAdc ? '#6366f1' : '#dc2626' }} />
                  {isAdc ? 'Cargue Parcial de Flotilla' : 'Carga Masiva de Flotilla'}
                </h3>
                <button 
                  onClick={() => { setIsUploadModalOpen(false); setFile(null); setUploadResult(null); setUploadError(null); setShowDuplicates(false); }} 
                  className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-5 overflow-y-auto">
                {uploadResult ? (
                  /* SUCCESS RESULT STATE */
                  <div className="flex flex-col items-center justify-center py-2 space-y-4">
                    <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-md">
                      <CheckCircle2 className="w-9 h-9 animate-in zoom-in-50 duration-300" />
                    </div>
                    <div className="text-center space-y-1">
                      <h3 className="text-lg font-black text-slate-900">¡Carga Procesada Exitosamente!</h3>
                      <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
                        {isAdc 
                          ? 'Tus equipos y registros asignados se han actualizado en la base de datos.'
                          : 'La flotilla, rentas y directorio se sincronizaron con éxito en la plataforma.'
                        }
                      </p>
                    </div>

                    {/* Resumen de Métricas */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full pt-1">
                      <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-2xl text-center">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">Filas en Archivo</span>
                        <span className="text-xl font-black text-slate-900">{uploadResult.processed || 0}</span>
                      </div>
                      <div className="bg-indigo-50/60 border border-indigo-100 p-3 rounded-2xl text-center">
                        <span className="text-[9px] font-black uppercase tracking-wider text-indigo-600 block mb-0.5">Equipos Únicos</span>
                        <span className="text-xl font-black text-indigo-700">{uploadResult.details?.equiposUnicos ?? uploadResult.processed ?? 0}</span>
                      </div>
                      <div className="bg-emerald-50/60 border border-emerald-100 p-3 rounded-2xl text-center">
                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 block mb-0.5">Rentas Generadas</span>
                        <span className="text-xl font-black text-emerald-700">{uploadResult.details?.rentasCreadas || 0}</span>
                      </div>
                      <div className="bg-amber-50/60 border border-amber-100 p-3 rounded-2xl text-center">
                        <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 block mb-0.5">Sitios Sincronizados</span>
                        <span className="text-xl font-black text-amber-700">{uploadResult.details?.sitiosNuevos || 0}</span>
                      </div>
                    </div>

                    {/* Desglose de Series Duplicadas si existen */}
                    {uploadResult.details?.duplicados && uploadResult.details.duplicados.length > 0 && (
                      <div className="w-full bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 text-left space-y-2.5 mt-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-200/80 text-amber-900 text-[10px] font-black">
                              {uploadResult.details.duplicados.length}
                            </span>
                            <span>Series con filas repetidas ({uploadResult.details.totalFilasDuplicadas || uploadResult.details.duplicados.length} filas consolidadas)</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowDuplicates(!showDuplicates)}
                            className="text-[11px] font-bold text-amber-800 hover:text-amber-950 underline underline-offset-2 transition-colors flex items-center gap-1"
                          >
                            {showDuplicates ? (
                              <><span>Ocultar</span><ChevronUp className="w-3.5 h-3.5" /></>
                            ) : (
                              <><span>Ver detalle</span><ChevronDown className="w-3.5 h-3.5" /></>
                            )}
                          </button>
                        </div>

                        <p className="text-[11px] text-amber-800/80 leading-relaxed">
                          Estas series aparecen más de una vez en el Excel. El sistema las consolidó en un único equipo activo para no duplicar inventario:
                        </p>

                        {showDuplicates && (
                          <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 pt-1">
                            {uploadResult.details.duplicados.map((dup: any, idx: number) => (
                              <div key={idx} className="bg-white border border-amber-200/70 rounded-xl p-2.5 text-xs flex flex-col gap-1 shadow-sm">
                                <div className="flex items-center justify-between">
                                  <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                    {dup.serie}
                                  </span>
                                  <span className="text-[10px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">
                                    {dup.count} veces en Excel
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-600 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                  <span><strong className="text-slate-700">Filas:</strong> {dup.rows.join(', ')}</span>
                                  <span><strong className="text-slate-700">Cliente(s):</strong> {dup.clientes.join(', ')}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : isUploading ? (
                  /* LOADING STATE */
                  <div className="flex flex-col items-center justify-center py-10 space-y-4">
                    <div className="relative w-20 h-20">
                      <div className="absolute inset-0 border-4 border-red-100 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-red-600 rounded-full border-t-transparent animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <FileSpreadsheet className="w-8 h-8 text-red-600 animate-pulse" />
                      </div>
                    </div>
                    <h3 className="text-base font-black text-slate-900">Procesando y Guardando Archivo...</h3>
                    <p className="text-xs text-slate-400 text-center max-w-xs font-semibold">
                      Sincronizando equipos, directorio de distribuidores y rentas operativas. Por favor espera unos segundos.
                    </p>
                  </div>
                ) : (
                  /* UPLOAD FORM STATE */
                  <>
                    <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                      {isAdc 
                        ? <>Sube tu archivo maestro <span className="font-black text-slate-900">.xlsx</span>. Se procesarán los registros asociados a <span className="font-black text-indigo-600">tu ADC</span>.</>
                        : <>Sube el archivo maestro <span className="font-black text-slate-900">.xlsx</span> para actualizar equipos, rentas y directorio de clientes y distribuidores.</>
                      }
                    </p>

                    {uploadError && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700">
                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div className="text-xs font-semibold">
                          <p className="font-bold">Error en la carga:</p>
                          <p className="mt-0.5">{uploadError}</p>
                        </div>
                      </div>
                    )}

                    <div className="p-2">
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
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50/50">
                {uploadResult ? (
                  <button 
                    onClick={() => { setIsUploadModalOpen(false); setFile(null); setUploadResult(null); setUploadError(null); }} 
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Finalizar y Ver Flotilla
                  </button>
                ) : (
                  <>
                    <button 
                      onClick={() => { setIsUploadModalOpen(false); setFile(null); setUploadError(null); }} 
                      className="px-5 py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-colors" 
                      disabled={isUploading}
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={handleUpload} 
                      disabled={isUploading || !file} 
                      className={`px-6 py-2.5 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg transition-colors disabled:opacity-50 flex items-center gap-2 ${isAdc ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100' : 'bg-red-600 hover:bg-red-700 shadow-red-100'}`}
                    >
                      {isAdc ? 'Importar mis datos' : 'Importar Datos'}
                    </button>
                  </>
                )}
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
                <button onClick={handleCloseNewAssetModal} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
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
                    <label className="block text-[10px] uppercase tracking-wider mb-1 font-black text-slate-700">Modelo *</label>
                    <SearchableSelect
                      options={modeloOptions}
                      value={newAssetModelo}
                      onChange={(val) => setNewAssetModelo(val)}
                      placeholder="Buscar o seleccionar modelo..."
                      searchPlaceholder="Escribe el modelo para buscar (ej. 7400, 8210)..."
                      emptyMessage="No se encontraron coincidencias"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Tipo de Activo *</label>
                    <select value={newAssetTipo} onChange={(e) => setNewAssetTipo(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none cursor-pointer">
                      <option>Contrabalanceado</option>
                      <option>Reach</option>
                      <option>Walkie</option>
                      <option>Stacker</option>
                      <option>Orderpicker</option>
                      <option>Deep Reach</option>
                      <option>Swing Reach</option>
                      <option>Tugger</option>
                      <option>Plataforma</option>
                      <option>Barredora</option>
                      <option>Intercambiador</option>
                      <option>Battery Stand</option>
                      <option>Aditamento</option>
                      <option>Baterías</option>
                      <option>Cargador</option>
                      <option>Otros</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Clase *</label>
                    <select value={newAssetClase} onChange={(e) => setNewAssetClase(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500 cursor-pointer">
                      {uniqueClases.map(c => <option key={c} value={c}>{c}</option>)}
                      {!uniqueClases.includes('I') && <option value="I">I</option>}
                      {!uniqueClases.includes('II') && <option value="II">II</option>}
                      {!uniqueClases.includes('III') && <option value="III">III</option>}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Cliente *</label>
                    <select 
                      value={newAssetCliente} 
                      onChange={(e) => { 
                        setNewAssetCliente(e.target.value); 
                        setNewAssetCuenta('');
                        setNewAssetSitio(''); 
                      }} 
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500 cursor-pointer"
                    >
                      <option value="">Seleccionar Cliente</option>
                      {[...clientesDisponibles].sort((a, b) => (a.razonSocial || a.razon_social || '').localeCompare(b.razonSocial || b.razon_social || '')).map((c: any) => <option key={c.id} value={c.id}>{c.razonSocial || c.razon_social}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1 font-bold text-slate-700">Cuenta</label>
                    {(() => {
                      const clientSitios = clientesDisponibles.find((c: any) => c.id === newAssetCliente)?.sitios || [];
                      const clientCuentas = Array.from(new Set(clientSitios.map((s: any) => s.cuenta).filter(Boolean))) as string[];
                      
                      return (
                        <div className="flex gap-2">
                          <select 
                            value={newAssetCuenta} 
                            onChange={(e) => {
                              setNewAssetCuenta(e.target.value);
                              setNewAssetSitio('');
                            }}
                            disabled={!newAssetCliente}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500 cursor-pointer disabled:opacity-50"
                          >
                            <option value="">Todas / Sin Cuenta específica</option>
                            {clientCuentas.map(cta => (
                              <option key={cta} value={cta}>{cta}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })()}
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Sitio *</label>
                    <select 
                      value={newAssetSitio} 
                      onChange={(e) => {
                        const sId = e.target.value;
                        setNewAssetSitio(sId);
                        const sObj = (clientesDisponibles.find((c: any) => c.id === newAssetCliente)?.sitios || []).find((s: any) => s.id === sId);
                        if (sObj?.cuenta && !newAssetCuenta) {
                          setNewAssetCuenta(sObj.cuenta);
                        }
                      }} 
                      disabled={!newAssetCliente} 
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500 cursor-pointer disabled:opacity-50"
                    >
                      <option value="">Seleccionar Sitio</option>
                      {(() => {
                        const clientSitios = clientesDisponibles.find((c: any) => c.id === newAssetCliente)?.sitios || [];
                        const filtered = newAssetCuenta 
                          ? clientSitios.filter((s: any) => s.cuenta === newAssetCuenta)
                          : clientSitios;
                        return [...filtered].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')).map((s: any) => (
                          <option key={s.id} value={s.id}>{s.nombre} {s.cuenta ? `(${s.cuenta})` : ''}</option>
                        ));
                      })()}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Estatus Inicial *</label>
                    <select value={newAssetEstatus} onChange={(e) => setNewAssetEstatus(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none cursor-pointer">
                      <option value="Activo">Activo</option>
                      <option value="Inactivo">Inactivo</option>
                      <option value="Back Up">Back Up</option>
                      <option value="Inactivo con Cliente">Inactivo con Cliente</option>
                      <option value="Por Entregar">Por Entregar</option>
                      <option value="Por Retirar">Por Retirar</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1 font-bold text-slate-700">Ejecutivo (ADC) *</label>
                    {isAdc ? (
                      <div>
                        <input 
                          type="text" 
                          value={newAssetAdc || loggedInAdcName} 
                          readOnly 
                          disabled 
                          className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-none cursor-not-allowed" 
                        />
                        <p className="text-[9px] text-amber-600 font-semibold mt-1">Asignado automáticamente a tu sesión de ADC</p>
                      </div>
                    ) : (
                      <select value={newAssetAdc} onChange={(e) => setNewAssetAdc(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500 cursor-pointer">
                        <option value="">Seleccionar ADC</option>
                        {uniqueADCs.map(adc => <option key={adc} value={adc}>{adc}</option>)}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Distribuidor</label>
                    <select value={newAssetDistribuidor} onChange={(e) => setNewAssetDistribuidor(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500 cursor-pointer">
                      <option value="">Seleccionar Distribuidor</option>
                      {uniqueDistribuidores.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Propietario</label>
                    <input type="text" value={newAssetPropietario} onChange={(e) => setNewAssetPropietario(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500" placeholder="Ej: LOGIS / RYDER" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">OACH</label>
                    <input type="text" value={newAssetOach} onChange={(e) => setNewAssetOach(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500" placeholder="Ej: 95 in" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Altura</label>
                    <input type="text" value={newAssetAltura} onChange={(e) => setNewAssetAltura(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500" placeholder="Ej: 240 in" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">BC</label>
                    <input type="text" value={newAssetBc} onChange={(e) => setNewAssetBc(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500" placeholder="Ej: 36 in" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">iWarehouse S/N</label>
                    <input type="text" value={newAssetIwarehouse} onChange={(e) => setNewAssetIwarehouse(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500" placeholder="Ej: IW-98210" />
                  </div>
                </div>

                {/* SECCIÓN RENTA OPCIONAL */}
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setShowRentaSection(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-wider text-slate-600 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-black">R</span>
                      Datos de Renta y Orden de Compra (opcional)
                    </span>
                    <span className="text-slate-400 text-lg">{showRentaSection ? '−' : '+'}</span>
                  </button>

                  {showRentaSection && (
                    <div className="mt-3 p-4 bg-red-50/40 border border-red-100 rounded-2xl grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider mb-1 text-red-700">Precio Renta Cliente</label>
                        <input type="number" value={newRentaPrecio} onChange={(e) => setNewRentaPrecio(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-red-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500" placeholder="Ej: 5500" />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider mb-1 text-red-700">Moneda Renta</label>
                        <select value={newRentaMoneda} onChange={(e) => setNewRentaMoneda(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-red-200 rounded-xl text-slate-900 focus:outline-none cursor-pointer">
                          <option value="MXN">MXN</option>
                          <option value="USD">USD</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider mb-1 text-red-700">CFPM / SMP (Póliza)</label>
                        <select value={newRentaPoliza} onChange={(e) => setNewRentaPoliza(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-red-200 rounded-xl text-slate-900 focus:outline-none cursor-pointer">
                          <option value="SMP">SMP</option>
                          <option value="CFPM">CFPM</option>
                          <option value="RENTA">RENTA</option>
                          <option value="N/A">N/A</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider mb-1 text-red-700">Costo Servicio Dealer</label>
                        <input type="number" value={newRentaCostoDealer} onChange={(e) => setNewRentaCostoDealer(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-red-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500" placeholder="Ej: 1200" />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider mb-1 text-red-700">Moneda Dealer</label>
                        <select value={newRentaMonedaDealer} onChange={(e) => setNewRentaMonedaDealer(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-red-200 rounded-xl text-slate-900 focus:outline-none cursor-pointer">
                          <option value="MXN">MXN</option>
                          <option value="USD">USD</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider mb-1 text-red-700">Fecha Entregado (Inicio)</label>
                        <input type="date" value={newRentaFechaInicio} onChange={(e) => setNewRentaFechaInicio(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-red-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500" />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider mb-1 text-red-700">Plazo (meses)</label>
                        <input 
                          type="number" 
                          value={newRentaPlazo} 
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewRentaPlazo(val);
                            if (newRentaFechaInicio && val && Number(val) > 0) {
                              const [y, m, d] = newRentaFechaInicio.split('-').map(Number);
                              const fin = new Date(y, m - 1 + Number(val), d);
                              setNewRentaFechaFin(fin.toISOString().split('T')[0]);
                            }
                          }} 
                          className="w-full px-3.5 py-2.5 bg-white border border-red-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500" 
                          placeholder="Ej: 36" 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider mb-1 text-red-700 font-bold flex items-center justify-between">
                          <span>Fecha Vencimiento</span>
                          <span className="text-[9px] font-semibold text-red-500">Auto-calculada</span>
                        </label>
                        <input 
                          type="date" 
                          value={newRentaFechaFin} 
                          onChange={(e) => setNewRentaFechaFin(e.target.value)} 
                          className="w-full px-3.5 py-2.5 bg-red-50/50 border border-red-200 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-red-500" 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider mb-1 text-red-700 font-bold">Folio OC Cliente</label>
                        <input 
                          type="text" 
                          value={newRentaFolioOc} 
                          onChange={(e) => setNewRentaFolioOc(e.target.value)} 
                          className="w-full px-3.5 py-2.5 bg-white border border-red-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500" 
                          placeholder="Ej: OC-9872" 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider mb-1 text-red-700 font-bold">No. Pedido TOTVS</label>
                        <input 
                          type="text" 
                          value={newRentaPedidoTotvs} 
                          onChange={(e) => setNewRentaPedidoTotvs(e.target.value)} 
                          className="w-full px-3.5 py-2.5 bg-white border border-red-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500" 
                          placeholder="Ej: PED-10293" 
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] uppercase tracking-wider mb-1 text-red-700 font-bold">Fecha Registro TOTVS</label>
                        <input 
                          type="date" 
                          value={newRentaFechaTotvs} 
                          onChange={(e) => setNewRentaFechaTotvs(e.target.value)} 
                          className="w-full px-3.5 py-2.5 bg-white border border-red-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500" 
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50/50">
                <button onClick={handleCloseNewAssetModal} className="px-5 py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-colors">
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
                    <label className="block text-[10px] uppercase tracking-wider mb-1 font-black text-slate-700">Número de Serie *</label>
                    <input type="text" value={editingData.serie || ''} onChange={(e) => setEditingData({...editingData, serie: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500 font-bold" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1 font-black text-slate-700">Modelo *</label>
                    <SearchableSelect
                      options={modeloOptions}
                      value={editingData.modelo || ''}
                      onChange={(val) => setEditingData({...editingData, modelo: val})}
                      placeholder="Buscar o seleccionar modelo..."
                      searchPlaceholder="Escribe el modelo para buscar..."
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1 font-black text-slate-700">Clase *</label>
                    <select 
                      value={editingData.clase || ''} 
                      onChange={(e) => setEditingData({...editingData, clase: e.target.value})} 
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500 cursor-pointer font-bold"
                    >
                      <option value="">Seleccionar Clase</option>
                      <option value="I">Clase I - Eléctricos de Pasajero</option>
                      <option value="II">Clase II - Pasillo Angosto (Reach / Orderpicker)</option>
                      <option value="III">Clase III - Manuales / Walkie</option>
                      <option value="IV">Clase IV - Combustión Cojín</option>
                      <option value="V">Clase V - Combustión Neumático</option>
                      <option value="VI">Clase VI - Tractores / Arrastre</option>
                      <option value="N/A">N/A - Accesorios / Baterías</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1 font-black text-slate-700">Tipo de Activo *</label>
                    <select 
                      value={editingData.tipo || editingData.tipo_equipo || 'Contrabalanceado'} 
                      onChange={(e) => setEditingData({...editingData, tipo: e.target.value, tipo_equipo: e.target.value})} 
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500 cursor-pointer font-bold"
                    >
                      <option>Contrabalanceado</option>
                      <option>Reach</option>
                      <option>Walkie</option>
                      <option>Stacker</option>
                      <option>Orderpicker</option>
                      <option>Deep Reach</option>
                      <option>Swing Reach</option>
                      <option>Tugger</option>
                      <option>Plataforma</option>
                      <option>Barredora</option>
                      <option>Intercambiador</option>
                      <option>Battery Stand</option>
                      <option>Aditamento</option>
                      <option>Baterías</option>
                      <option>Cargador</option>
                      <option>Otros</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1 font-black text-slate-700">Marca</label>
                    <input type="text" value={editingData.marca || 'Raymond'} onChange={(e) => setEditingData({...editingData, marca: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none font-bold" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1 font-black text-slate-700">Capacidad (LB)</label>
                    <input type="text" value={editingData.capacidad || editingData.capacidad_lb || ''} onChange={(e) => setEditingData({...editingData, capacidad: e.target.value, capacidad_lb: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none font-bold" placeholder="Ej: 4500" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1 font-black text-slate-700">OACH</label>
                    <input type="text" value={editingData.oach || ''} onChange={(e) => setEditingData({...editingData, oach: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none font-bold" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1 font-black text-slate-700">Altura</label>
                    <input type="text" value={editingData.altura || ''} onChange={(e) => setEditingData({...editingData, altura: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none font-bold" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1 font-black text-slate-700">BC</label>
                    <input type="text" value={editingData.bc || ''} onChange={(e) => setEditingData({...editingData, bc: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none font-bold" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1 font-black text-slate-700">Cuenta / Cliente</label>
                    <input type="text" value={editingData.cuenta || ''} onChange={(e) => setEditingData({...editingData, cuenta: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none font-bold" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1 font-black text-slate-700">Distribuidor</label>
                    <select value={editingData.distribuidor || ''} onChange={(e) => setEditingData({...editingData, distribuidor: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500 cursor-pointer font-bold">
                      <option value="">Seleccionar Distribuidor</option>
                      {uniqueDistribuidores.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1 font-black text-slate-700">Propietario</label>
                    <input type="text" value={editingData.propietario || ''} onChange={(e) => setEditingData({...editingData, propietario: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none font-bold" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1 font-black text-slate-700">Estatus Operativo</label>
                    <select value={editingData.estatus || ''} onChange={(e) => setEditingData({...editingData, estatus: e.target.value, estatus_operativo: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none cursor-pointer font-bold">
                      <option value="Activo">Activo</option>
                      <option value="Inactivo">Inactivo</option>
                      <option value="Comodato">Comodato</option>
                      <option value="Back Up">Back Up</option>
                      <option value="Inactivo con Cliente">Inactivo con Cliente</option>
                      <option value="Por Entregar">Por Entregar</option>
                      <option value="Por Retirar">Por Retirar</option>
                    </select>
                  </div>
                  {!isAdc && (
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider mb-1 font-black text-slate-700">Administrador (ADC)</label>
                      <select value={editingData.adc || ''} onChange={(e) => setEditingData({...editingData, adc: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-red-500 cursor-pointer font-bold">
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
                <button onClick={handleCloseTransferModal} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
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
                <button onClick={handleCloseTransferModal} className="px-5 py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-colors">
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

      {/* Modal Confirmación de Eliminación de Activo */}
      <AnimatePresence>
        {deleteConfirmModal.isOpen && deleteConfirmModal.asset && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-red-50/50">
                <h3 className="text-base font-black flex items-center gap-2 text-red-600">
                  <Trash2 className="w-5 h-5" />
                  Eliminar Equipo
                </h3>
                <button 
                  onClick={() => setDeleteConfirmModal({ isOpen: false, asset: null, isDeleting: false })} 
                  className="p-1.5 hover:bg-red-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-3 font-medium text-sm text-slate-600">
                <p>
                  ¿Estás seguro de que deseas eliminar permanentemente el equipo con serie <strong className="font-bold text-slate-900">{deleteConfirmModal.asset.serie}</strong>?
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1 text-slate-700">
                  <div><strong>Modelo:</strong> {deleteConfirmModal.asset.modelo || '-'}</div>
                  <div><strong>Cliente:</strong> {deleteConfirmModal.asset.cliente || '-'}</div>
                  <div><strong>Sitio:</strong> {deleteConfirmModal.asset.site || '-'}</div>
                  {deleteConfirmModal.asset.cuenta && <div><strong>Cuenta:</strong> {deleteConfirmModal.asset.cuenta}</div>}
                </div>
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 font-medium">
                  ⚠️ Esta acción eliminará el registro del equipo, sus configuraciones de renta y órdenes asociadas. Esta acción no se puede deshacer.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50/50">
                <button 
                  type="button"
                  disabled={deleteConfirmModal.isDeleting}
                  onClick={() => setDeleteConfirmModal({ isOpen: false, asset: null, isDeleting: false })} 
                  className="px-5 py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  disabled={deleteConfirmModal.isDeleting}
                  onClick={handleConfirmDelete} 
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-red-100 transition-colors cursor-pointer"
                >
                  {deleteConfirmModal.isDeleting ? 'Eliminando...' : 'Sí, Eliminar Equipo'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
