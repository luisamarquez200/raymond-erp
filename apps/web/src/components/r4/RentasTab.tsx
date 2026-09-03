"use client";

import { 
  Search, Receipt, Calendar, CalendarDays, Plus, Filter, Download, X, Pencil, Check, ChevronsUpDown, FileText, Building2, MapPin, Truck, FileSpreadsheet, Eye, BatteryCharging, FilePlus, ChevronLeft, ChevronRight, Sparkles, Layers, CheckCircle2, Trash2
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useState, useEffect, Fragment, useRef } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth.store";
import { useConfigStore } from "@/store/config.store";
import { useUser } from "@/hooks/useUsers";
import PageLoader from "@/components/ui/PageLoader";
import { motion, AnimatePresence } from "motion/react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { RotateCcw } from "lucide-react";
import CopiarMesAnteriorModal from "@/components/r4/ordenes/CopiarMesAnteriorModal";

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

interface RentasTabProps {
  adminAdcScope?: 'todos' | 'mis_adcs';
  setAdminAdcScope?: (scope: 'todos' | 'mis_adcs') => void;
}

function cleanAdcName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSameAdc(adcCandidate: string | null | undefined, targetAdc: string): boolean {
  const c = cleanAdcName(adcCandidate);
  const t = cleanAdcName(targetAdc);
  if (!c || !t) return false;
  if (c === t) return true;

  const cTokens = c.split(' ').filter(w => w.length > 2);
  const tTokens = t.split(' ').filter(w => w.length > 2);
  if (cTokens.length === 0 || tTokens.length === 0) return false;

  const allTargetInCandidate = tTokens.every(token => cTokens.includes(token));
  const allCandidateInTarget = cTokens.every(token => tTokens.includes(token));
  if (allTargetInCandidate || allCandidateInTarget) return true;

  if (tTokens.length === 1 && cTokens.includes(tTokens[0]) && tTokens[0].length >= 4) return true;
  if (cTokens.length === 1 && tTokens.includes(cTokens[0]) && cTokens[0].length >= 4) return true;

  return false;
}

export default function RentasTab({ 
  adminAdcScope: externalAdminAdcScope, 
  setAdminAdcScope: externalSetAdminAdcScope 
}: RentasTabProps = {}) {
  const { user } = useAuthStore();
  const { data: freshUserProfile } = useUser(user?.id || '');
  let rawRole: any = user?.role;
  if (Array.isArray(rawRole)) rawRole = rawRole[0]?.name || rawRole[0]?.rol || rawRole[0];
  if (typeof rawRole === 'object' && rawRole !== null) rawRole = rawRole?.name || rawRole?.rol;
  const userRole = String(rawRole || '').toLowerCase();
  
  const isAdministrator = ['administrador', 'admin', 'superadmin', 'gerente', 'coordinacion', 'coordinador'].some(r => userRole.includes(r));
  const isAdc = !isAdministrator && userRole !== '';

  const rawAdcAsociado = 
    freshUserProfile?.adcAsociadoName ||
    (user as any)?.adc_asociado_name || 
    (user as any)?.adcAsociadoName || '';

  const loggedInAdcName = 
    rawAdcAsociado && rawAdcAsociado !== 'ninguno'
      ? rawAdcAsociado
      : `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || (user as any)?.name || user?.email || '';

  const { roleColors } = useConfigStore();
  const currentColor = user?.role ? (roleColors[user.role.toLowerCase()] || roleColors.administrador) : roleColors.administrador;

  const [internalAdminAdcScope, setInternalAdminAdcScope] = useState<'todos' | 'mis_adcs'>('todos');
  const adminAdcScope = externalAdminAdcScope ?? internalAdminAdcScope;
  const setAdminAdcScope = externalSetAdminAdcScope ?? setInternalAdminAdcScope;
  const [rentas, setRentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isNewRentaModalOpen, setIsNewRentaModalOpen] = useState(false);

  // Registro OC Modal State
  const [isFichaOcModalOpen, setIsFichaOcModalOpen] = useState(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [selectedFichaClienteId, setSelectedFichaClienteId] = useState("");
  const [selectedFichaSitioId, setSelectedFichaSitioId] = useState("");
  const [fichaFolioOc, setFichaFolioOc] = useState("");
  const [fichaPedidoTotvs, setFichaPedidoTotvs] = useState("");
  const [fichaFechaTotvs, setFichaFechaTotvs] = useState("");
  const [fichaMesCobro, setFichaMesCobro] = useState(new Date().toISOString().slice(0, 7));
  const [fichaMesCobroFin, setFichaMesCobroFin] = useState('');
  const [fichaPdfFile, setFichaPdfFile] = useState<File | null>(null);
  const [isFichaDragging, setIsFichaDragging] = useState(false);
  const [fichaSeriesGrid, setFichaSeriesGrid] = useState<any[]>([]); // Array of { assetId, serie, modelo, clase, sitioId, sitioNombre, cuenta, checked, renta_base, dias_caidos, descuento, renta_final, alreadyHasOrderInMonth, orderInMonthPo, orderInMonthTotvs, hadOrderInPrevMonth, pedido_totvs }
  const [showOnlyAvailableInMonth, setShowOnlyAvailableInMonth] = useState(false);
  const [isSubmittingFicha, setIsSubmittingFicha] = useState(false);

  const [openFichaCliente, setOpenFichaCliente] = useState(false);
  const [openFichaSitio, setOpenFichaSitio] = useState(false);
  const [openFichaCuenta, setOpenFichaCuenta] = useState(false);
  const [selectedFichaCuenta, setSelectedFichaCuenta] = useState("");
  const [fichaCuentaSearchTerm, setFichaCuentaSearchTerm] = useState('');

  // Helper para generar rango de meses
  const getMonthsInRange = (startPeriod: string, endPeriod?: string): string[] => {
    if (!startPeriod) return [];
    if (!endPeriod || endPeriod < startPeriod) return [startPeriod];
    
    const [startY, startM] = startPeriod.split('-').map(Number);
    const [endY, endM] = endPeriod.split('-').map(Number);
    
    const result: string[] = [];
    let curY = startY;
    let curM = startM;
    
    while (curY < endY || (curY === endY && curM <= endM)) {
      result.push(`${curY}-${String(curM).padStart(2, '0')}`);
      curM++;
      if (curM > 12) {
        curM = 1;
        curY++;
      }
    }
    return result;
  };

  // NEW STATE FOR STANDALONE RENTA
  const [clientesDisponibles, setClientesDisponibles] = useState<any[]>([]);
  const [equiposDisponibles, setEquiposDisponibles] = useState<any[]>([]);
  const [newRentaFormData, setNewRentaFormData] = useState({
    cliente_id: '', sitio_id: '', cuenta: '', contrato_id: '', tipo_renta: 'Mensual', moneda: 'MXN', fecha_inicio: '', fecha_fin: '', activo_id: '', renta_base: '', mantenimiento: false, tipo_poliza: 'SMP', costo_poliza: '', moneda_poliza: 'MXN', comentarios: '', plazo_meses: '', mes_cobertura: ''
  });
  const [editRentaConfig, setEditRentaConfig] = useState<{ isOpen: boolean; id: string; formData: any }>({
    isOpen: false,
    id: '',
    formData: { estado: '', renta_base: '', moneda: 'MXN', po: '', ordenes: [] }
  });
  const [isSubmittingRenta, setIsSubmittingRenta] = useState(false);
  const [deleteRentaModal, setDeleteRentaModal] = useState<{
    isOpen: boolean;
    renta: any | null;
    isDeleting: boolean;
  }>({
    isOpen: false,
    renta: null,
    isDeleting: false,
  });

  // Filter States (Multi-select)
  const [selectedFilterCuenta, setSelectedFilterCuenta] = useState<string[]>([]);
  const [selectedFilterSitio, setSelectedFilterSitio] = useState<string[]>([]);
  const [selectedFilterAdc, setSelectedFilterAdc] = useState<string[]>([]);
  const [selectedFilterEquipo, setSelectedFilterEquipo] = useState<string[]>([]);
  const [selectedFilterClase, setSelectedFilterClase] = useState<string[]>([]);
  const [selectedFilterModelo, setSelectedFilterModelo] = useState<string[]>([]);
  const [selectedFilterSerie, setSelectedFilterSerie] = useState<string[]>([]);
  const [selectedFilterEstatus, setSelectedFilterEstatus] = useState<string[]>([]);
  const [selectedFilterOach, setSelectedFilterOach] = useState<string[]>([]);
  const [selectedFilterAltura, setSelectedFilterAltura] = useState<string[]>([]);
  const [selectedFilterBc, setSelectedFilterBc] = useState<string[]>([]);
  const [selectedFilterFolioOc, setSelectedFilterFolioOc] = useState<string[]>([]);
  const [selectedFilterFEntregado, setSelectedFilterFEntregado] = useState<string[]>([]);
  const [selectedFilterPlazo, setSelectedFilterPlazo] = useState<string[]>([]);
  const [selectedFilterFVencimiento, setSelectedFilterFVencimiento] = useState<string[]>([]);
  const [selectedFilterPropietario, setSelectedFilterPropietario] = useState<string[]>([]);
  const [selectedFilterPrecioRenta, setSelectedFilterPrecioRenta] = useState<string[]>([]);
  const [selectedFilterMoneda, setSelectedFilterMoneda] = useState<string[]>([]);
  const [selectedFilterPoliza, setSelectedFilterPoliza] = useState<string[]>([]);
  const [selectedFilterDistribuidor, setSelectedFilterDistribuidor] = useState<string[]>([]);
  const [selectedFilterCostoPoliza, setSelectedFilterCostoPoliza] = useState<string[]>([]);
  const [selectedFilterMonedaPago, setSelectedFilterMonedaPago] = useState<string[]>([]);

  // Period / Mes Filter States
  const [selectedPeriodoView, setSelectedPeriodoView] = useState<string>('2026-09');
  const [selectedOcPeriodoStatus, setSelectedOcPeriodoStatus] = useState<'TODOS' | 'CON_OC' | 'SIN_OC'>('TODOS');
  const [openPeriodoViewPopover, setOpenPeriodoViewPopover] = useState(false);

  // Combobox open states
  const [openFilterCuenta, setOpenFilterCuenta] = useState(false);
  const [openFilterSitio, setOpenFilterSitio] = useState(false);
  const [openFilterAdc, setOpenFilterAdc] = useState(false);
  const [openFilterEquipo, setOpenFilterEquipo] = useState(false);
  const [openFilterClase, setOpenFilterClase] = useState(false);
  const [openFilterModelo, setOpenFilterModelo] = useState(false);
  const [openFilterSerie, setOpenFilterSerie] = useState(false);
  const [openFilterEstatus, setOpenFilterEstatus] = useState(false);
  const [openFilterOach, setOpenFilterOach] = useState(false);
  const [openFilterAltura, setOpenFilterAltura] = useState(false);
  const [openFilterBc, setOpenFilterBc] = useState(false);
  const [openFilterFolioOc, setOpenFilterFolioOc] = useState(false);
  const [openFilterFEntregado, setOpenFilterFEntregado] = useState(false);
  const [openFilterPlazo, setOpenFilterPlazo] = useState(false);
  const [openFilterFVencimiento, setOpenFilterFVencimiento] = useState(false);
  const [openFilterPropietario, setOpenFilterPropietario] = useState(false);
  const [openFilterPrecioRenta, setOpenFilterPrecioRenta] = useState(false);
  const [openFilterMoneda, setOpenFilterMoneda] = useState(false);
  const [openFilterPoliza, setOpenFilterPoliza] = useState(false);
  const [openFilterDistribuidor, setOpenFilterDistribuidor] = useState(false);
  const [openFilterCostoPoliza, setOpenFilterCostoPoliza] = useState(false);
  const [openFilterMonedaPago, setOpenFilterMonedaPago] = useState(false);

  // Combobox search states
  const [searchCuenta, setSearchCuenta] = useState("");
  const [searchSitio, setSearchSitio] = useState("");
  const [searchAdc, setSearchAdc] = useState("");
  const [searchEquipo, setSearchEquipo] = useState("");
  const [searchClase, setSearchClase] = useState("");
  const [searchModelo, setSearchModelo] = useState("");
  const [searchSerie, setSearchSerie] = useState("");
  const [searchEstatus, setSearchEstatus] = useState("");
  const [searchOach, setSearchOach] = useState("");
  const [searchAltura, setSearchAltura] = useState("");
  const [searchBc, setSearchBc] = useState("");
  const [searchFolioOc, setSearchFolioOc] = useState("");
  const [searchFEntregado, setSearchFEntregado] = useState("");
  const [searchPlazo, setSearchPlazo] = useState("");
  const [searchFVencimiento, setSearchFVencimiento] = useState("");
  const [searchPropietario, setSearchPropietario] = useState("");
  const [searchPrecioRenta, setSearchPrecioRenta] = useState("");
  const [searchMoneda, setSearchMoneda] = useState("");
  const [searchPoliza, setSearchPoliza] = useState("");
  const [searchDistribuidor, setSearchDistribuidor] = useState("");
  const [searchCostoPoliza, setSearchCostoPoliza] = useState("");
  const [searchMonedaPago, setSearchMonedaPago] = useState("");

  // VIEW MODAL STATE
  const [viewRentaConfig, setViewRentaConfig] = useState({
    isOpen: false,
    renta: null as any,
    documentos: [] as any[],
    loadingDocs: false,
  });

  // REGISTER OC STATE
  const [registerOcConfig, setRegisterOcConfig] = useState<{
    isOpen: boolean;
    renta: any;
    periodo: string;
    po: string;
    pedido_totvs: string;
    fecha_pedido_totvs: string;
    isSubmitting: boolean;
    pdfFile: File | null;
    isDragging: boolean;
  }>({
    isOpen: false,
    renta: null as any,
    periodo: '',
    po: '',
    pedido_totvs: '',
    fecha_pedido_totvs: '',
    isSubmitting: false,
    pdfFile: null,
    isDragging: false,
  });

  const openViewModal = async (renta: any) => {
    setViewRentaConfig({
      isOpen: true,
      renta,
      documentos: [],
      loadingDocs: true,
    });

    try {
      const res = await api.get(`/r4/rentas/${renta.id}/documentos`);
      const docs = res.data?.data || res.data || [];
      setViewRentaConfig(prev => ({
        ...prev,
        documentos: Array.isArray(docs) ? docs : [],
        loadingDocs: false,
      }));
    } catch (error) {
      console.error('Error fetching documents:', error);
      setViewRentaConfig(prev => ({ ...prev, loadingDocs: false }));
    }
  };

  const handleRegisterOc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerOcConfig.pdfFile) {
      toast.error('El documento PDF de la OC es obligatorio.');
      return;
    }
    try {
      setRegisterOcConfig(prev => ({ ...prev, isSubmitting: true }));
      await api.post('/r4/ordenes-mensuales', {
        renta_id: registerOcConfig.renta.id,
        periodo: registerOcConfig.periodo,
        po: registerOcConfig.po,
        pedido_totvs: registerOcConfig.pedido_totvs || undefined,
        fecha_pedido_totvs: registerOcConfig.fecha_pedido_totvs || undefined,
      });

      // Also update renta's no_registro_totvs & fecha_pedido_totvs if provided
      if (registerOcConfig.pedido_totvs || registerOcConfig.fecha_pedido_totvs) {
        await api.patch(`/r4/rentas/${registerOcConfig.renta.id}`, {
          no_registro_totvs: registerOcConfig.pedido_totvs || undefined,
          fecha_pedido_totvs: registerOcConfig.fecha_pedido_totvs || undefined,
        });
      }

      // Upload PDF
      const fileData = new FormData();
      fileData.append('file', registerOcConfig.pdfFile);
      await api.post(`/r4/rentas/${registerOcConfig.renta.id}/documentos`, fileData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success('Orden de compra registrada con éxito');
      setRegisterOcConfig({
        isOpen: false,
        renta: null,
        periodo: '',
        po: '',
        pedido_totvs: '',
        fecha_pedido_totvs: '',
        isSubmitting: false,
        pdfFile: null,
        isDragging: false
      });
      fetchRentasYClientes(); // Refresh rentas to show new order
    } catch (error: any) {
      console.error('Error registrando OC:', error);
      toast.error(error.response?.data?.message || 'Error al registrar la Orden de Compra');
      setRegisterOcConfig(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  const exportRentasToCSV = () => {
    const headers = [
      'Cuenta',
      'Sitio',
      'Equipo',
      'Clase',
      'Modelo',
      'PO/OC',
      'Serie',
      'Tarifa Base',
      'Moneda',
      'Tipo Póliza',
      'Distribuidor',
      'Tarifa Póliza',
      'Moneda Póliza'
    ];
    
    const rows = filteredRentas.map(renta => {
      const cond = renta.condiciones || {};
      const detalles = renta.detalles || {};
      return [
        renta.cuenta || '',
        renta.sitio?.nombre || '',
        renta.activo?.clase?.includes('III') ? 'Patín' : 'Montacargas',
        renta.activo?.clase || '',
        renta.activo?.modelo || '',
        renta.orden_compra || detalles.oc_cliente || '',
        renta.activo?.serie || '',
        detalles.renta_base || renta.tarifa || 0,
        detalles.moneda || 'MXN',
        cond.tipo_poliza || renta.activo?.tipo_poliza || 'SMP',
        renta.distribuidor || renta.activo?.distribuidor || '',
        cond.costo_poliza_distribuidor || renta.activo?.costo_poliza_distribuidor || 0,
        cond.moneda_pago_distribuidor || renta.activo?.moneda_pago_distribuidor || 'MXN'
      ];
    });
    
    let csvContent = "\uFEFF";
    csvContent += [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Rentas_R4_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const [openCliente, setOpenCliente] = useState(false);
  const [openCuenta, setOpenCuenta] = useState(false);
  const [openSitio, setOpenSitio] = useState(false);
  const [openEquipo, setOpenEquipo] = useState(false);
  const [openTipoRenta, setOpenTipoRenta] = useState(false);
  const [openMoneda, setOpenMoneda] = useState(false);
  const [equipoSearchTerm, setEquipoSearchTerm] = useState('');
  const [clienteSearchTerm, setClienteSearchTerm] = useState('');
  const [cuentaSearchTerm, setCuentaSearchTerm] = useState('');
  const [sitioSearchTerm, setSitioSearchTerm] = useState('');

  const [fichaClienteSearchTerm, setFichaClienteSearchTerm] = useState('');
  const [fichaSitioSearchTerm, setFichaSitioSearchTerm] = useState('');

  // ADC Visual Filtering Logic for Clientes
  const filteredClientesDisponibles = isAdc
    ? clientesDisponibles.filter((c: any) => {
        const adcLower = (c.adc || '').toLowerCase().trim();
        const adcKeywords = loggedInAdcName.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
        const userFirstName = (user?.firstName || '').toLowerCase().trim();
        const hasMatchingSitio = (c.sitios || []).some((s: any) => {
          const sAdc = (s.adc || '').toLowerCase();
          return adcKeywords.some((kw: string) => sAdc === kw || sAdc.includes(kw) || kw.includes(sAdc)) || (userFirstName && sAdc.includes(userFirstName));
        });
        const hasMatchingRenta = rentas.some((r: any) => {
          if (r.cliente_id !== c.id && r.cliente?.id !== c.id) return false;
          const rAdc = (r.adc || r.activo?.adc || '').toLowerCase();
          return adcKeywords.some((kw: string) => rAdc === kw || rAdc.includes(kw) || kw.includes(rAdc)) || (userFirstName && rAdc.includes(userFirstName));
        });
        return adcKeywords.some((kw: string) => adcLower === kw || adcLower.includes(kw) || kw.includes(adcLower)) ||
          (userFirstName && adcLower.includes(userFirstName)) || hasMatchingSitio || hasMatchingRenta;
      })
    : clientesDisponibles;

  const getCuentasParaCliente = (clienteId: string) => {
    if (!clienteId) return [];
    const clientObj = clientesDisponibles.find((c: any) => c.id === clienteId);
    const fromSitios = (clientObj?.sitios || []).map((s: any) => s.cuenta);
    const fromRentas = rentas
      .filter((r: any) => r.cliente_id === clienteId || r.cliente?.id === clienteId)
      .flatMap((r: any) => [r.cuenta, r.activo?.cuenta]);
    const fromEquipos = equiposDisponibles
      .filter((e: any) => e.cliente_id === clienteId || e.sitio?.cliente_id === clienteId)
      .map((e: any) => e.cuenta);

    const combined = Array.from(new Set([...fromSitios, ...fromRentas, ...fromEquipos].filter(Boolean))) as string[];
    return combined.filter(c => typeof c === 'string' && c.trim() !== '' && c.trim() !== '-').sort((a, b) => a.localeCompare(b));
  };

  const cuentasDelCliente = getCuentasParaCliente(newRentaFormData.cliente_id);
  const selectedClienteObj = clientesDisponibles.find((c: any) => c.id === newRentaFormData.cliente_id);

  const openEditModal = (renta: any) => {
    if (isAdc) {
      const rAdc = renta.adc || renta.sitio?.adc || (renta.cliente as any)?.datos_comerciales?.adc || '';
      const adcKeywords = loggedInAdcName.split(',').map((s: string) => s.trim()).filter(Boolean);
      const userFirstName = (user?.firstName || '').toLowerCase().trim();
      const userLastName = (user?.lastName || '').toLowerCase().trim();
      const userFullName = `${userFirstName} ${userLastName}`.trim();
      const isOwner = adcKeywords.some((kw: string) => isSameAdc(rAdc, kw)) || (userFullName && isSameAdc(rAdc, userFullName));
      if (!isOwner) {
        toast.error('Solo puedes editar información de rentas correspondientes a tu propio ADC asignado.');
        return;
      }
    }
    setEditRentaConfig({
      isOpen: true,
      id: renta.id,
      formData: {
        estado: renta.estado || 'VIGENTE',
        renta_base: renta.detalles?.renta_base || renta.tarifa || '',
        moneda: renta.detalles?.moneda || 'MXN',
        po: renta.orden_compra || 'No registrado',
        ordenes: renta.ordenes || []
      }
    });
  };

  const handleCloseEditModal = () => {
    setEditRentaConfig({
      isOpen: false,
      id: '',
      formData: { estado: '', renta_base: '', moneda: 'MXN', po: '', ordenes: [] }
    });
  };

  const handleCloseNewRentaModal = () => {
    setIsNewRentaModalOpen(false);
    setNewRentaFormData({
      cliente_id: '', sitio_id: '', cuenta: '', contrato_id: '', tipo_renta: 'Mensual', moneda: 'MXN', fecha_inicio: '', fecha_fin: '', activo_id: '', renta_base: '', mantenimiento: false, tipo_poliza: 'SMP', costo_poliza: '', moneda_poliza: 'MXN', comentarios: '', plazo_meses: '', mes_cobertura: ''
    });
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  const fetchRentasYClientes = async () => {
    try {
      setLoading(true);
      const [resRentas, resClientes, resFlotilla] = await Promise.all([
        api.get('/r4/rentas'),
        api.get('/r4/clientes'),
        api.get('/r4/flotilla')
      ]);
      const dataArray = resRentas.data?.data || resRentas.data || [];
      const mappedRentas = (Array.isArray(dataArray) ? dataArray : []).map((r: any) => ({
        ...r,
        distribuidor: r.distribuidor?.toUpperCase(),
        activo: r.activo ? {
          ...r.activo,
          distribuidor: r.activo.distribuidor?.toUpperCase(),
          modelo: r.activo.modelo?.toUpperCase(),
          serie: r.activo.serie?.toUpperCase(),
        } : null,
      }));
      setRentas(mappedRentas);

      const clientesArray = resClientes.data?.data || resClientes.data || [];
      setClientesDisponibles(Array.isArray(clientesArray) ? clientesArray : []);

      const equiposArray = resFlotilla.data?.data || resFlotilla.data || [];
      const mappedEquipos = (Array.isArray(equiposArray) ? equiposArray : []).map((e: any) => ({
        ...e,
        distribuidor: e.distribuidor?.toUpperCase(),
        modelo: e.modelo?.toUpperCase(),
        serie: e.serie?.toUpperCase(),
      }));
      setEquiposDisponibles(mappedEquipos);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRentasYClientes();
  }, []);

  // Auto-select single client in Ficha OC modal
  useEffect(() => {
    if (isFichaOcModalOpen && clientesDisponibles.length === 1 && !selectedFichaClienteId) {
      setSelectedFichaClienteId(clientesDisponibles[0].id);
    }
  }, [isFichaOcModalOpen, clientesDisponibles, selectedFichaClienteId]);

  // Auto-select single sitio in Ficha OC modal
  useEffect(() => {
    if (isFichaOcModalOpen && selectedFichaClienteId) {
      const client = clientesDisponibles.find((c: any) => c.id === selectedFichaClienteId);
      const sitios = client?.sitios || [];
      if (sitios.length === 1 && selectedFichaSitioId !== sitios[0].id) {
        setSelectedFichaSitioId(sitios[0].id);
      }
    }
  }, [isFichaOcModalOpen, selectedFichaClienteId, clientesDisponibles, selectedFichaSitioId]);

  // Auto-select single client in Nueva Renta modal
  useEffect(() => {
    if (isNewRentaModalOpen && clientesDisponibles.length === 1 && !newRentaFormData.cliente_id) {
      setNewRentaFormData(prev => ({ ...prev, cliente_id: clientesDisponibles[0].id }));
    }
  }, [isNewRentaModalOpen, clientesDisponibles, newRentaFormData.cliente_id]);

  // Auto-select single sitio in Nueva Renta modal
  useEffect(() => {
    if (isNewRentaModalOpen && newRentaFormData.cliente_id) {
      const client = clientesDisponibles.find((c: any) => c.id === newRentaFormData.cliente_id);
      const sitios = client?.sitios || [];
      if (sitios.length === 1 && newRentaFormData.sitio_id !== sitios[0].id) {
        setNewRentaFormData(prev => ({ ...prev, sitio_id: sitios[0].id }));
      }
    }
  }, [isNewRentaModalOpen, newRentaFormData.cliente_id, clientesDisponibles, newRentaFormData.sitio_id]);

  // Auto-select single equipo in Nueva Renta modal
  useEffect(() => {
    if (isNewRentaModalOpen && newRentaFormData.sitio_id) {
      const siteAssets = equiposDisponibles.filter(e => {
        if (e.sitio_id !== newRentaFormData.sitio_id) return false;
        const st = (e.estatus || '').trim().toUpperCase();
        return st.startsWith('INACTIVO');
      });
      if (siteAssets.length === 1 && newRentaFormData.activo_id !== siteAssets[0].id) {
        setNewRentaFormData(prev => ({ ...prev, activo_id: siteAssets[0].id }));
      }
    }
  }, [isNewRentaModalOpen, newRentaFormData.sitio_id, equiposDisponibles, newRentaFormData.activo_id]);

  // Filter series based on selected client, site and cuenta in Ficha OC
  useEffect(() => {
    if (!selectedFichaClienteId) {
      setFichaSeriesGrid([]);
      return;
    }

    const client = clientesDisponibles.find((c: any) => c.id === selectedFichaClienteId);
    const sitiosDelCliente = client?.sitios || [];
    const clientSiteIds = new Set(sitiosDelCliente.map((s: any) => s.id));

    const isAssetEstatusActivo = (statusStr?: string | null) => {
      if (!statusStr) return true;
      const s = statusStr.trim().toUpperCase();
      if (s === 'ACTIVO' || s === 'OPERATIVO' || s === 'DISPONIBLE' || s === 'VIGENTE') return true;
      if (s.includes('INACTIV') || s.includes('BACK') || s.includes('RETIRAR') || s.includes('COMODATO') || s.includes('BAJA') || s.includes('TALLER')) {
        return false;
      }
      return true;
    };

    const isRentaActiva = (r: any) => {
      if (!r) return false;
      const estadoRenta = (r.estado || '').trim().toUpperCase();
      const estadoActivo = (r.activo?.estatus || r.activo?.estatus_operativo || '').trim().toUpperCase();
      if (estadoRenta === 'CANCELADA' || estadoRenta === 'TERMINADA' || estadoRenta.includes('INACTIV')) return false;
      if (estadoActivo.includes('INACTIV') || estadoActivo.includes('BACK') || estadoActivo.includes('RETIRAR') || estadoActivo.includes('BAJA') || estadoActivo.includes('TALLER') || estadoActivo.includes('COMODATO')) return false;
      return true;
    };

    // Find all active assets assigned strictly to this client
    let siteAssets: any[] = [];

    // 1. First, include all assets from active rentas belonging to this client
    rentas.forEach(r => {
      const isForThisClient = (r.cliente_id === selectedFichaClienteId || r.cliente?.id === selectedFichaClienteId);
      if (isForThisClient && r.activo && isRentaActiva(r)) {
        if (selectedFichaSitioId && r.sitio_id !== selectedFichaSitioId) return;
        if (!siteAssets.some(e => e.id === r.activo.id)) {
          siteAssets.push({
            id: r.activo.id,
            serie: r.activo.serie,
            modelo: r.activo.modelo,
            clase: r.activo.clase,
            sitio_id: r.sitio_id,
            cuenta: r.cuenta,
            estatus: r.activo.estatus || 'Activo',
            renta: r
          });
        }
      }
    });

    // 2. Also check equiposDisponibles that explicitly belong to this client and are NOT rented to any other client
    equiposDisponibles.forEach(e => {
      if (!isAssetEstatusActivo(e.estatus || e.estatus_operativo)) return;
      if (siteAssets.some(a => a.id === e.id)) return;

      // Check if this asset has an active renta with a DIFFERENT client (e.g. CIVAC BPC)
      const hasActiveRentaWithOther = rentas.some(r =>
        r.activo?.id === e.id &&
        (r.cliente_id !== selectedFichaClienteId && r.cliente?.id !== selectedFichaClienteId) &&
        isRentaActiva(r)
      );
      if (hasActiveRentaWithOther) return; // Belongs to another client!

      // Check if asset is explicitly assigned to this client or one of its valid sites
      const belongsToClient = e.cliente_id === selectedFichaClienteId || (e.sitio_id && clientSiteIds.has(e.sitio_id));
      if (!belongsToClient) return;

      if (selectedFichaSitioId && e.sitio_id !== selectedFichaSitioId) return;

      siteAssets.push({
        id: e.id,
        serie: e.serie,
        modelo: e.modelo,
        clase: e.clase,
        sitio_id: e.sitio_id,
        cuenta: e.cuenta,
        estatus: e.estatus || 'Activo',
        renta: null
      });
    });
    
    // If a specific cuenta is selected, filter strictly by that cuenta
    if (selectedFichaCuenta) {
      const matchCuentaNorm = selectedFichaCuenta.trim().toLowerCase();
      siteAssets = siteAssets.filter(asset => {
        const activeRenta = asset.renta || rentas.find(r => r.activo?.id === asset.id && (r.cliente_id === selectedFichaClienteId || r.cliente?.id === selectedFichaClienteId) && r.estado !== 'CANCELADA');
        const eqCuenta = (asset.cuenta || activeRenta?.cuenta || '').trim().toLowerCase();
        return eqCuenta === matchCuentaNorm;
      });
    }

    // Calculate previous month string
    let prevPeriod = '';
    if (fichaMesCobro && fichaMesCobro.includes('-')) {
      const [y, m] = fichaMesCobro.split('-').map(Number);
      const prevDate = new Date(y, m - 2, 1);
      prevPeriod = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    }

    const gridData = siteAssets.map(asset => {
      // Find if this asset has an active renta STRICTLY with the selected client
      const activeRenta = asset.renta || rentas.find(r => r.activo?.id === asset.id && (r.cliente_id === selectedFichaClienteId || r.cliente?.id === selectedFichaClienteId) && r.estado !== 'CANCELADA');
      const basePrice = activeRenta?.detalles?.renta_base || activeRenta?.tarifa || 0;
      
      const orders = activeRenta?.ordenes || [];
      const orderInCurrentMonth = orders.find((o: any) => {
        if (o.periodo !== fichaMesCobro) return false;
        const poStr = (o.po || '').trim().toUpperCase();
        return poStr !== '' && poStr !== '-' && poStr !== 'PENDIENTE' && poStr !== 'SIN OC' && poStr !== 'NULL' && poStr !== 'UNDEFINED';
      });

      const hadOrderInPrev = prevPeriod ? orders.some((o: any) => {
        if (o.periodo !== prevPeriod) return false;
        const poStr = (o.po || '').trim().toUpperCase();
        return poStr !== '' && poStr !== '-' && poStr !== 'PENDIENTE' && poStr !== 'SIN OC';
      }) : false;

      const alreadyHasOrder = !!orderInCurrentMonth;
      const existingTotvs = orderInCurrentMonth?.pedido_totvs || (orderInCurrentMonth?.condiciones as any)?.pedido_totvs || (orderInCurrentMonth?.condiciones as any)?.pedido || (orderInCurrentMonth?.condiciones as any)?.pedido_tovts || activeRenta?.no_registro_totvs || '';

      const assetSitio = sitiosDelCliente.find((s: any) => s.id === (asset.sitio_id || activeRenta?.sitio_id)) || activeRenta?.sitio;
      const assetCuenta = asset.cuenta || activeRenta?.cuenta || assetSitio?.cuenta || '-';

      return {
        assetId: asset.id,
        serie: asset.serie,
        modelo: asset.modelo || '-',
        clase: asset.clase || '-',
        sitioId: asset.sitio_id || activeRenta?.sitio_id || sitiosDelCliente[0]?.id || '',
        sitioNombre: assetSitio?.nombre || 'Sitio Principal',
        cuenta: assetCuenta,
        checked: false,
        renta_base: basePrice,
        dias_caidos: 0,
        descuento: 0,
        renta_final: basePrice,
        existingRenta: activeRenta || null,
        alreadyHasOrderInMonth: alreadyHasOrder,
        orderInMonthPo: orderInCurrentMonth?.po || null,
        orderInMonthTotvs: existingTotvs || null,
        hadOrderInPrevMonth: hadOrderInPrev,
        pedido_totvs: existingTotvs || fichaPedidoTotvs || '',
      };
    });

    setFichaSeriesGrid(gridData);
  }, [selectedFichaClienteId, selectedFichaSitioId, selectedFichaCuenta, fichaMesCobro, equiposDisponibles, rentas, clientesDisponibles]);

  // Recalculate discount when pricing or dias caidos change
  const handleGridFieldChange = (index: number, field: 'checked' | 'renta_base' | 'dias_caidos' | 'pedido_totvs', value: any) => {
    const updated = [...fichaSeriesGrid];
    const item = { ...updated[index] };
    
    if (field === 'checked') {
      item.checked = value;
    } else if (field === 'renta_base') {
      item.renta_base = Number(value) || 0;
    } else if (field === 'dias_caidos') {
      item.dias_caidos = Number(value) || 0;
    } else if (field === 'pedido_totvs') {
      item.pedido_totvs = value;
    }

    // discount = (base / 30) * dias_caidos
    const calculatedDiscount = (item.renta_base / 30) * item.dias_caidos;
    item.descuento = Math.round(calculatedDiscount * 100) / 100;
    item.renta_final = Math.max(0, Math.round((item.renta_base - item.descuento) * 100) / 100);

    updated[index] = item;
    setFichaSeriesGrid(updated);
  };

  // Copy selection of previous month
  const handleCopyPrevMonthSelection = () => {
    if (!fichaMesCobro) {
      toast.error('Selecciona primero el Mes de Cobertura');
      return;
    }
    const [y, m] = fichaMesCobro.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevMonthName = prevDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });

    let count = 0;
    const updated = fichaSeriesGrid.map(item => {
      // If already billed this month, keep it unchecked
      if (item.alreadyHasOrderInMonth) return { ...item, checked: false };
      // If had order in previous month, check it
      if (item.hadOrderInPrevMonth) {
        count++;
        return { ...item, checked: true };
      }
      return { ...item, checked: false };
    });

    setFichaSeriesGrid(updated);
    if (count > 0) {
      toast.success(`Se seleccionaron ${count} series cobradas en ${prevMonthName}`);
    } else {
      toast.info(`No se encontraron series cobradas en el mes previo (${prevMonthName})`);
    }
  };

  // Select-all toggle for OC equipment table
  const availableSeries = fichaSeriesGrid.filter(i => !showOnlyAvailableInMonth || !i.alreadyHasOrderInMonth);
  const allSeriesChecked = availableSeries.length > 0 && availableSeries.every(i => i.checked);
  const someSeriesChecked = availableSeries.some(i => i.checked) && !allSeriesChecked;
  const handleSelectAllSeries = () => {
    const nextChecked = !allSeriesChecked;
    setFichaSeriesGrid(prev => prev.map(i => {
      if (showOnlyAvailableInMonth && i.alreadyHasOrderInMonth) return { ...i, checked: false };
      return { ...i, checked: nextChecked };
    }));
  };

  // Total a Facturar — suma de renta_final de equipos seleccionados
  const totalAFacturar = fichaSeriesGrid
    .filter(i => i.checked)
    .reduce((sum, i) => sum + i.renta_final, 0);

  // Reset OC form helper — called on close, cancel, or backdrop click
  const resetFichaOcForm = () => {
    setSelectedFichaClienteId("");
    setSelectedFichaSitioId("");
    setSelectedFichaCuenta("");
    setFichaFolioOc("");
    setFichaPedidoTotvs("");
    setFichaFechaTotvs("");
    const initialMonth = selectedPeriodoView && selectedPeriodoView !== 'todos' ? selectedPeriodoView : new Date().toISOString().slice(0, 7);
    setFichaMesCobro(initialMonth);
    setFichaMesCobroFin("");
    setFichaPdfFile(null);
    setIsFichaDragging(false);
    setShowOnlyAvailableInMonth(false);
    setIsFichaOcModalOpen(false);
    setFichaClienteSearchTerm("");
    setFichaSitioSearchTerm("");
    setFichaCuentaSearchTerm("");
    setCuentaSearchTerm("");
    setSitioSearchTerm("");
    setOpenFichaCliente(false);
    setOpenFichaSitio(false);
    setOpenFichaCuenta(false);
  };

  const handleCreateRenta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRentaFormData.cliente_id || !newRentaFormData.sitio_id || !newRentaFormData.activo_id || !newRentaFormData.fecha_inicio || !newRentaFormData.fecha_fin) {
      toast.error('Cliente, Sitio, Equipo y Fechas son obligatorios');
      return;
    }

    try {
      setIsSubmittingRenta(true);
      const payload = {
        cliente_id: newRentaFormData.cliente_id,
        sitio_id: newRentaFormData.sitio_id,
        activo_id: newRentaFormData.activo_id,
        contrato_id: newRentaFormData.contrato_id || null,
        fecha_inicio: newRentaFormData.fecha_inicio,
        fecha_fin: newRentaFormData.fecha_fin,
        plazo_meses: newRentaFormData.plazo_meses ? Number(newRentaFormData.plazo_meses) : null,
        detalles: {
          tipo_renta: newRentaFormData.tipo_renta,
          moneda: newRentaFormData.moneda,
          mes_cobro: null,
          renta_base: Number(newRentaFormData.renta_base) || 0,
          mantenimiento: newRentaFormData.mantenimiento,
          comentarios: newRentaFormData.comentarios
        },
        condiciones: {
          tipo_poliza: newRentaFormData.tipo_poliza,
          costo_poliza_distribuidor: Number(newRentaFormData.costo_poliza) || 0,
          moneda_pago_distribuidor: newRentaFormData.moneda_poliza
        }
      };

      const response = await api.post('/r4/rentas', payload);
      toast.success('Renta creada correctamente. Ahora registra la Orden de Compra.');
      setIsNewRentaModalOpen(false);
      setNewRentaFormData({
        cliente_id: '', sitio_id: '', cuenta: '', contrato_id: '', tipo_renta: 'Mensual', moneda: 'MXN', fecha_inicio: '', fecha_fin: '', activo_id: '', renta_base: '', mantenimiento: false, tipo_poliza: 'SMP', costo_poliza: '', moneda_poliza: 'MXN', comentarios: '', plazo_meses: '', mes_cobertura: ''
      });
      fetchRentasYClientes();

      // Open OC Register modal directly with the new renta
      const nuevaRenta = response.data?.data || response.data;
      if (nuevaRenta && nuevaRenta.id) {
        setRegisterOcConfig({
          isOpen: true,
          renta: nuevaRenta,
          periodo: '',
          po: '',
          pedido_totvs: '',
          fecha_pedido_totvs: '',
          isSubmitting: false,
          pdfFile: null,
          isDragging: false
        });
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Error al crear renta');
    } finally {
      setIsSubmittingRenta(false);
    }
  };

  const handleEditRentaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmittingRenta(true);
      await api.patch(`/r4/rentas/${editRentaConfig.id}`, { estado: editRentaConfig.formData.estado });
      await api.patch(`/r4/rentas/${editRentaConfig.id}/detalles`, {
        renta_base: Number(editRentaConfig.formData.renta_base) || 0,
        moneda: editRentaConfig.formData.moneda
      });
      toast.success('Renta actualizada correctamente');
      handleCloseEditModal();
      fetchRentasYClientes();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Error al actualizar renta');
    } finally {
      setIsSubmittingRenta(false);
    }
  };

  const handleConfirmDeleteRenta = async () => {
    if (!deleteRentaModal.renta) return;
    try {
      setDeleteRentaModal(prev => ({ ...prev, isDeleting: true }));
      await api.delete(`/r4/rentas/${deleteRentaModal.renta.id}`);
      toast.success('Renta eliminada correctamente');
      setDeleteRentaModal({ isOpen: false, renta: null, isDeleting: false });
      fetchRentasYClientes();
    } catch (error: any) {
      console.error('Error deleting renta:', error);
      toast.error(error.response?.data?.message || 'Error al eliminar la renta');
      setDeleteRentaModal(prev => ({ ...prev, isDeleting: false }));
    }
  };

  const handleCreateFichaOc = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedItems = fichaSeriesGrid.filter(item => item.checked);
    if (selectedItems.length === 0) {
      toast.error("Debes seleccionar al menos una serie.");
      return;
    }
    if (!fichaFolioOc) {
      toast.error("El Folio OC Cliente es obligatorio.");
      return;
    }
    if (!fichaPdfFile) {
      toast.error("El documento PDF de la OC es obligatorio.");
      return;
    }

    try {
      setIsSubmittingFicha(true);
      const targetPeriods = getMonthsInRange(fichaMesCobro, fichaMesCobroFin);
      const client = clientesDisponibles.find((c: any) => c.id === selectedFichaClienteId);
      const sitiosDelCliente = client?.sitios || [];

      toast.info(`Procesando registro de OC para ${selectedItems.length} serie(s)...`);

      const batchPayload = {
        cliente_id: selectedFichaClienteId,
        sitio_id: selectedFichaSitioId || undefined,
        cuenta: selectedFichaCuenta || undefined,
        po: fichaFolioOc.trim(),
        pedido_totvs: fichaPedidoTotvs?.trim() || undefined,
        fecha_pedido_totvs: fichaFechaTotvs || undefined,
        periodos: targetPeriods,
        items: selectedItems.map(item => ({
          assetId: item.assetId,
          rentaId: item.existingRenta?.id || undefined,
          sitioId: item.sitioId || selectedFichaSitioId || sitiosDelCliente[0]?.id || undefined,
          cuenta: item.cuenta || selectedFichaCuenta || undefined,
          renta_base: item.renta_base,
          dias_caidos: item.dias_caidos,
          descuento: item.descuento,
          renta_final: item.renta_final,
          pedido_totvs: item.pedido_totvs?.trim() || fichaPedidoTotvs?.trim() || undefined
        }))
      };

      const res = await api.post('/r4/ordenes/batch-ficha-oc', batchPayload);

      toast.success(res.data?.message || `Registro OC guardado con éxito (${targetPeriods.length} mes(es) aplicados).`);
      resetFichaOcForm();
      fetchRentasYClientes();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Error al procesar Registro OC');
    } finally {
      setIsSubmittingFicha(false);
    }
  };

  // ADC Visual Filtering Logic
  let baseRentas = rentas;
  if (isAdc) {
    const adcKeywords = loggedInAdcName
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
    const userFirstName = (user?.firstName || '').toLowerCase().trim();
    const userLastName = (user?.lastName || '').toLowerCase().trim();
    const userFullName = `${userFirstName} ${userLastName}`.trim();

    baseRentas = rentas.filter(r => {
        const rAdc = r.adc || r.sitio?.adc || (r.cliente as any)?.datos_comerciales?.adc || '';
        if (!rAdc) return false;
        return adcKeywords.some((kw: string) => isSameAdc(rAdc, kw)) ||
               (userFullName && isSameAdc(rAdc, userFullName));
    });
  } else if (isAdministrator && adminAdcScope === 'mis_adcs') {
    let assignedAdcKeywords: string[] = [];
    if (rawAdcAsociado && rawAdcAsociado !== 'ninguno') {
      assignedAdcKeywords = rawAdcAsociado
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
    }

    if (assignedAdcKeywords.length === 0) {
      baseRentas = [];
    } else {
      baseRentas = rentas.filter(r => {
        const rAdc = r.adc || r.sitio?.adc || (r.cliente as any)?.datos_comerciales?.adc || '';
        return assignedAdcKeywords.some(kw => isSameAdc(rAdc, kw));
      });
    }
  }

  const isMatchFilter = (filterVals: string[], valToTest: any) => {
    if (!filterVals || filterVals.length === 0 || filterVals.includes('Todos')) return true;
    return filterVals.includes(valToTest);
  };

  // Helper for dynamic cascading filter options (each filter shows options based on active filters in other columns)
  const getCascadingFilteredRentas = (excludeFilterName: string) => {
    return baseRentas.filter((renta: any) => {
      const cond = renta.condiciones || {};
      const detalles = renta.detalles || {};
      const rCuenta = renta.cuenta || renta.cliente?.razonSocial || renta.cliente?.razon_social || '-';
      const rAdc = renta.adc || renta.sitio?.adc || (renta.cliente as any)?.datos_comerciales?.adc || '-';
      const tipoEq = renta.activo?.tipo || (renta.activo?.clase?.includes('III') ? 'Patín' : 'Montacargas');
      const rPrecioFormatted = `$${(detalles.renta_base || renta.tarifa || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
      const rCostoPolizaFormatted = `$${(cond.costo_poliza_distribuidor || renta.activo?.costo_poliza_distribuidor || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
      const rFEntregado = renta.fecha_inicio ? new Date(renta.fecha_inicio).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
      const rFVencimiento = renta.fecha_fin ? new Date(renta.fecha_fin).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
      const rPlazo = cond.plazo_meses ? String(cond.plazo_meses) : '-';
      const rFolioOc = renta.orden_compra || detalles.oc_cliente || '-';

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          renta.id?.toLowerCase().includes(term) ||
          renta.cliente?.razonSocial?.toLowerCase().includes(term) ||
          renta.cliente?.razon_social?.toLowerCase().includes(term) ||
          renta.cuenta?.toLowerCase().includes(term) ||
          renta.sitio?.nombre?.toLowerCase().includes(term) ||
          renta.activo?.serie?.toLowerCase().includes(term) ||
          renta.orden_compra?.toLowerCase().includes(term) ||
          renta.detalles?.oc_cliente?.toLowerCase().includes(term) ||
          (renta.propietario || renta.activo?.propietario)?.toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }

      if (excludeFilterName !== 'cuenta' && !isMatchFilter(selectedFilterCuenta, rCuenta)) return false;
      if (excludeFilterName !== 'sitio' && !isMatchFilter(selectedFilterSitio, renta.sitio?.nombre)) return false;
      if (excludeFilterName !== 'adc' && !isMatchFilter(selectedFilterAdc, rAdc)) return false;
      if (excludeFilterName !== 'equipo' && !isMatchFilter(selectedFilterEquipo, tipoEq)) return false;
      if (excludeFilterName !== 'clase' && !isMatchFilter(selectedFilterClase, renta.activo?.clase)) return false;
      if (excludeFilterName !== 'modelo' && !isMatchFilter(selectedFilterModelo, renta.activo?.modelo)) return false;
      if (excludeFilterName !== 'serie' && !isMatchFilter(selectedFilterSerie, renta.activo?.serie)) return false;
      if (excludeFilterName !== 'estatus' && !isMatchFilter(selectedFilterEstatus, renta.activo?.estatus)) return false;
      if (excludeFilterName !== 'oach' && !isMatchFilter(selectedFilterOach, renta.activo?.oach)) return false;
      if (excludeFilterName !== 'altura' && !isMatchFilter(selectedFilterAltura, renta.activo?.altura)) return false;
      if (excludeFilterName !== 'bc' && !isMatchFilter(selectedFilterBc, renta.activo?.bc)) return false;
      if (excludeFilterName !== 'folioOc' && !isMatchFilter(selectedFilterFolioOc, rFolioOc)) return false;
      if (excludeFilterName !== 'fEntregado' && !isMatchFilter(selectedFilterFEntregado, rFEntregado)) return false;
      if (excludeFilterName !== 'plazo' && !isMatchFilter(selectedFilterPlazo, rPlazo)) return false;
      if (excludeFilterName !== 'fVencimiento' && !isMatchFilter(selectedFilterFVencimiento, rFVencimiento)) return false;
      if (excludeFilterName !== 'propietario' && !isMatchFilter(selectedFilterPropietario, renta.propietario || renta.activo?.propietario)) return false;
      if (excludeFilterName !== 'precioRenta' && !isMatchFilter(selectedFilterPrecioRenta, rPrecioFormatted)) return false;
      if (excludeFilterName !== 'moneda' && !isMatchFilter(selectedFilterMoneda, detalles.moneda || 'MXN')) return false;
      if (excludeFilterName !== 'poliza' && !isMatchFilter(selectedFilterPoliza, cond.tipo_poliza || renta.activo?.tipo_poliza || 'SMP')) return false;
      if (excludeFilterName !== 'distribuidor' && !isMatchFilter(selectedFilterDistribuidor, renta.distribuidor || renta.activo?.distribuidor)) return false;
      if (excludeFilterName !== 'costoPoliza' && !isMatchFilter(selectedFilterCostoPoliza, rCostoPolizaFormatted)) return false;
      if (excludeFilterName !== 'monedaPago' && !isMatchFilter(selectedFilterMonedaPago, cond.moneda_pago_distribuidor || renta.activo?.moneda_pago_distribuidor || 'MXN')) return false;

      return true;
    });
  };

  const filterUniqueCuentas = Array.from(new Set(getCascadingFilteredRentas('cuenta').map(r => r.cuenta || r.cliente?.razonSocial || r.cliente?.razon_social).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  const filterUniqueSitios = Array.from(new Set(getCascadingFilteredRentas('sitio').map(r => r.sitio?.nombre).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  const filterUniqueAdcs = Array.from(new Set(getCascadingFilteredRentas('adc').map(r => r.adc || r.sitio?.adc || (r.cliente as any)?.datos_comerciales?.adc).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  const filterUniqueEquipos = Array.from(new Set(getCascadingFilteredRentas('equipo').map(r => r.activo?.tipo || (r.activo?.clase?.includes('III') ? 'Patín' : 'Montacargas')).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  const filterUniqueClases = Array.from(new Set(getCascadingFilteredRentas('clase').map(r => r.activo?.clase).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  const filterUniqueModelos = Array.from(new Set(getCascadingFilteredRentas('modelo').map(r => r.activo?.modelo).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  const filterUniqueSeries = Array.from(new Set(getCascadingFilteredRentas('serie').map(r => r.activo?.serie).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  const filterUniqueEstatus = Array.from(new Set(getCascadingFilteredRentas('estatus').map(r => r.activo?.estatus).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  const filterUniqueOach = Array.from(new Set(getCascadingFilteredRentas('oach').map(r => r.activo?.oach).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  const filterUniqueAlturas = Array.from(new Set(getCascadingFilteredRentas('altura').map(r => r.activo?.altura).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  const filterUniqueBc = Array.from(new Set(getCascadingFilteredRentas('bc').map(r => r.activo?.bc).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  const filterUniqueFolioOc = Array.from(new Set(getCascadingFilteredRentas('folioOc').map(r => r.orden_compra || r.detalles?.oc_cliente).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  const filterUniqueFEntregado = Array.from(new Set(getCascadingFilteredRentas('fEntregado').map(r => r.fecha_inicio ? new Date(r.fecha_inicio).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : null).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  const filterUniquePlazos = Array.from(new Set(getCascadingFilteredRentas('plazo').map(r => r.condiciones?.plazo_meses ? String(r.condiciones.plazo_meses) : null).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  const filterUniqueFVencimiento = Array.from(new Set(getCascadingFilteredRentas('fVencimiento').map(r => r.fecha_fin ? new Date(r.fecha_fin).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : null).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  const filterUniquePropietarios = Array.from(new Set(getCascadingFilteredRentas('propietario').map(r => r.propietario || r.activo?.propietario).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  const filterUniquePreciosRenta = Array.from(new Set(getCascadingFilteredRentas('precioRenta').map(r => `$${(r.detalles?.renta_base || r.tarifa || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`))).sort((a, b) => a.localeCompare(b));
  const filterUniqueMonedas = Array.from(new Set(getCascadingFilteredRentas('moneda').map(r => r.detalles?.moneda || 'MXN').filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  const filterUniquePolizas = Array.from(new Set(getCascadingFilteredRentas('poliza').map(r => r.condiciones?.tipo_poliza || r.activo?.tipo_poliza || 'SMP').filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  const filterUniqueDistribuidores = Array.from(new Set(getCascadingFilteredRentas('distribuidor').map(r => r.distribuidor || r.activo?.distribuidor).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  const filterUniqueCostosPoliza = Array.from(new Set(getCascadingFilteredRentas('costoPoliza').map(r => `$${(r.condiciones?.costo_poliza_distribuidor || r.activo?.costo_poliza_distribuidor || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`))).sort((a, b) => a.localeCompare(b));
  const filterUniqueMonedasPago = Array.from(new Set(getCascadingFilteredRentas('monedaPago').map(r => r.condiciones?.moneda_pago_distribuidor || r.activo?.moneda_pago_distribuidor || 'MXN').filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));

  const filteredRentas = baseRentas.filter((renta: any) => {
    const cond = renta.condiciones || {};
    const detalles = renta.detalles || {};
    const rCuenta = renta.cuenta || renta.cliente?.razonSocial || renta.cliente?.razon_social || '-';
    const matchesSearch = !searchTerm ? true : (
      renta.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      renta.cliente?.razonSocial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      renta.cliente?.razon_social?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      renta.cuenta?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      renta.sitio?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      renta.activo?.serie?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      renta.orden_compra?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      renta.detalles?.oc_cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (renta.propietario || renta.activo?.propietario)?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const rAdc = renta.adc || renta.sitio?.adc || (renta.cliente as any)?.datos_comerciales?.adc || '-';
    const tipoEq = renta.activo?.tipo || (renta.activo?.clase?.includes('III') ? 'Patín' : 'Montacargas');
    const rPrecioFormatted = `$${(detalles.renta_base || renta.tarifa || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    const rCostoPolizaFormatted = `$${(cond.costo_poliza_distribuidor || renta.activo?.costo_poliza_distribuidor || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    const rFEntregado = renta.fecha_inicio ? new Date(renta.fecha_inicio).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
    const rFVencimiento = renta.fecha_fin ? new Date(renta.fecha_fin).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
    const rPlazo = cond.plazo_meses ? String(cond.plazo_meses) : '-';
    const rFolioOc = renta.orden_compra || detalles.oc_cliente || '-';

    const matchesCuenta = isMatchFilter(selectedFilterCuenta, rCuenta);
    const matchesSitio = isMatchFilter(selectedFilterSitio, renta.sitio?.nombre);
    const matchesAdc = isMatchFilter(selectedFilterAdc, rAdc);
    const matchesEquipo = isMatchFilter(selectedFilterEquipo, tipoEq);
    const matchesClase = isMatchFilter(selectedFilterClase, renta.activo?.clase);
    const matchesModelo = isMatchFilter(selectedFilterModelo, renta.activo?.modelo);
    const matchesSerie = isMatchFilter(selectedFilterSerie, renta.activo?.serie);
    const matchesEstatus = isMatchFilter(selectedFilterEstatus, renta.activo?.estatus);
    const matchesOach = isMatchFilter(selectedFilterOach, renta.activo?.oach);
    const matchesAltura = isMatchFilter(selectedFilterAltura, renta.activo?.altura);
    const matchesBc = isMatchFilter(selectedFilterBc, renta.activo?.bc);
    const matchesFolioOc = isMatchFilter(selectedFilterFolioOc, rFolioOc);
    const matchesFEntregado = isMatchFilter(selectedFilterFEntregado, rFEntregado);
    const matchesPlazo = isMatchFilter(selectedFilterPlazo, rPlazo);
    const matchesFVencimiento = isMatchFilter(selectedFilterFVencimiento, rFVencimiento);
    const matchesPropietario = isMatchFilter(selectedFilterPropietario, renta.propietario || renta.activo?.propietario);
    const matchesPrecioRenta = isMatchFilter(selectedFilterPrecioRenta, rPrecioFormatted);
    const matchesMoneda = isMatchFilter(selectedFilterMoneda, detalles.moneda || 'MXN');
    const matchesPoliza = isMatchFilter(selectedFilterPoliza, cond.tipo_poliza || renta.activo?.tipo_poliza || 'SMP');
    const matchesDistribuidor = isMatchFilter(selectedFilterDistribuidor, renta.distribuidor || renta.activo?.distribuidor);
    const matchesCostoPoliza = isMatchFilter(selectedFilterCostoPoliza, rCostoPolizaFormatted);
    const matchesMonedaPago = isMatchFilter(selectedFilterMonedaPago, cond.moneda_pago_distribuidor || renta.activo?.moneda_pago_distribuidor || 'MXN');

    const matchesOcPeriodo = (() => {
      if (selectedOcPeriodoStatus === 'TODOS' || selectedPeriodoView === 'todos') return true;
      const estNorm = (renta.activo?.estatus || '').trim().toUpperCase();
      const isInactiveOrBackup = estNorm.startsWith('INACTIVO') || estNorm === 'BACK UP' || estNorm === 'BACKUP' || estNorm === 'POR RETIRAR' || estNorm === 'BAJA' || estNorm === 'TALLER' || estNorm === 'COMODATO';
      if (isInactiveOrBackup) return false;

      const ord = (renta.ordenes || []).find((o: any) => o.periodo === selectedPeriodoView);
      const hasOc = !!(ord && ord.po && ord.po.trim() !== '' && ord.po !== '-' && ord.po.toUpperCase() !== 'PENDIENTE' && ord.po.toUpperCase() !== 'SIN OC');
      if (selectedOcPeriodoStatus === 'CON_OC') return hasOc;
      if (selectedOcPeriodoStatus === 'SIN_OC') return !hasOc;
      return true;
    })();

    return (
      matchesSearch &&
      matchesCuenta &&
      matchesSitio &&
      matchesAdc &&
      matchesEquipo &&
      matchesClase &&
      matchesModelo &&
      matchesSerie &&
      matchesEstatus &&
      matchesOach &&
      matchesAltura &&
      matchesBc &&
      matchesFolioOc &&
      matchesFEntregado &&
      matchesPlazo &&
      matchesFVencimiento &&
      matchesPropietario &&
      matchesPrecioRenta &&
      matchesMoneda &&
      matchesPoliza &&
      matchesDistribuidor &&
      matchesCostoPoliza &&
      matchesMonedaPago &&
      matchesOcPeriodo
    );
  });

  const periodOcStats = (() => {
    if (!selectedPeriodoView || selectedPeriodoView === 'todos') {
      return { total: baseRentas.length, conOc: 0, sinOc: 0 };
    }
    let total = 0;
    let conOc = 0;
    let sinOc = 0;
    for (const r of baseRentas) {
      const estNorm = (r.activo?.estatus || '').trim().toUpperCase();
      const isInactiveOrBackup = estNorm.startsWith('INACTIVO') || estNorm === 'BACK UP' || estNorm === 'BACKUP' || estNorm === 'POR RETIRAR' || estNorm === 'BAJA' || estNorm === 'TALLER' || estNorm === 'COMODATO';
      if (isInactiveOrBackup) continue;
      total++;
      const ord = (r.ordenes || []).find((o: any) => o.periodo === selectedPeriodoView);
      const hasOc = !!(ord && ord.po && ord.po.trim() !== '' && ord.po !== '-' && ord.po.toUpperCase() !== 'PENDIENTE' && ord.po.toUpperCase() !== 'SIN OC');
      if (hasOc) conOc++;
      else sinOc++;
    }
    return { total, conOc, sinOc };
  })();

  const totalRentas = filteredRentas.length;
  const activas = filteredRentas.filter(r => {
    const estadoRenta = r.estado?.toUpperCase() || '';
    const estadoActivo = r.activo?.estatus?.toUpperCase() || '';
    
    // Ignore inactivos & backup
    if (estadoRenta.includes('INACTIV') || estadoActivo.includes('INACTIV') || estadoActivo === 'BACK UP' || estadoActivo === 'BACKUP' || estadoActivo === 'POR RETIRAR' || estadoActivo === 'COMODATO' || estadoActivo === 'BAJA' || estadoActivo === 'TALLER') return false;

    return (
      estadoRenta === 'VIGENTE' || 
      estadoRenta === 'IMPORTADA' || 
      estadoRenta === 'RENOVADA' ||
      estadoRenta === 'ACTIVO'
    );
  }).length;

  const hoy = new Date();
  const en30Dias = new Date();
  en30Dias.setDate(hoy.getDate() + 30);

  const porVencer = filteredRentas.filter(r => {
    if (!r.fecha_fin) return false;
    const fechaFin = new Date(r.fecha_fin);
    const estadoRenta = r.estado?.toUpperCase() || '';
    const estadoActivo = r.activo?.estatus?.toUpperCase() || '';
    
    // Ignore inactivos & backup
    if (estadoRenta.includes('INACTIV') || estadoActivo.includes('INACTIV') || estadoActivo === 'BACK UP' || estadoActivo === 'BACKUP' || estadoActivo === 'POR RETIRAR' || estadoActivo === 'COMODATO' || estadoActivo === 'BAJA' || estadoActivo === 'TALLER') return false;
    
    return fechaFin > hoy && fechaFin <= en30Dias && estadoRenta !== 'CANCELADA';
  }).length;

  // Apply pagination
  const totalItems = filteredRentas.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  
  const importeMXN = filteredRentas.reduce((sum, r) => {
    const estadoRenta = r.estado?.toUpperCase() || '';
    const estadoActivo = r.activo?.estatus?.toUpperCase() || '';
    if (estadoRenta.includes('INACTIV') || estadoActivo.includes('INACTIV') || estadoActivo === 'BACK UP' || estadoActivo === 'BACKUP' || estadoActivo === 'POR RETIRAR' || estadoActivo === 'COMODATO' || estadoActivo === 'BAJA' || estadoActivo === 'TALLER') return sum;
    
    const isUSD = (r.detalles?.moneda || 'MXN') === 'USD';
    return isUSD ? sum : sum + (r.detalles?.renta_base || r.tarifa || 0);
  }, 0);
  
  const importeUSD = filteredRentas.reduce((sum, r) => {
    const estadoRenta = r.estado?.toUpperCase() || '';
    const estadoActivo = r.activo?.estatus?.toUpperCase() || '';
    if (estadoRenta.includes('INACTIV') || estadoActivo.includes('INACTIV') || estadoActivo === 'BACK UP' || estadoActivo === 'BACKUP' || estadoActivo === 'POR RETIRAR' || estadoActivo === 'COMODATO' || estadoActivo === 'BAJA' || estadoActivo === 'TALLER') return sum;
    
    const isUSD = (r.detalles?.moneda || 'MXN') === 'USD';
    return isUSD ? sum + (r.detalles?.renta_base || r.tarifa || 0) : sum;
  }, 0);
  const paginatedRentas = filteredRentas.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Group by client
  const groupedRentas: Record<string, any[]> = {};
  paginatedRentas.forEach(renta => {
    const clienteNombre = renta.cliente?.razonSocial || 'Sin Cliente';
    if (!groupedRentas[clienteNombre]) {
      groupedRentas[clienteNombre] = [];
    }
    groupedRentas[clienteNombre].push(renta);
  });

  // Calculate chart data based on filteredRentas
  const adcMap = new Map<string, { name: string; mxn: number; usd: number }>();
  const distribuidorMap = new Map<string, number>();
  const equipoTipoMap = new Map<string, number>();
  
  filteredRentas.forEach(r => {
    const estadoRenta = r.estado?.toUpperCase() || '';
    const estadoActivo = r.activo?.estatus?.toUpperCase() || '';
    if (estadoRenta.includes('INACTIV') || estadoActivo.includes('INACTIV')) return;
    
    const amount = Number(r.detalles?.renta_base || r.tarifa || 0);
    const currency = (r.detalles?.moneda || r.moneda || 'MXN').toUpperCase();
    const adc = r.adc || r.cliente?.datos_comerciales?.adc || 'Sin ADC';

    // ADC Budget (Separated MXN & USD)
    if (!adcMap.has(adc)) {
      adcMap.set(adc, { name: adc, mxn: 0, usd: 0 });
    }
    const adcEntry = adcMap.get(adc)!;
    if (currency === 'USD') {
      adcEntry.usd += amount;
    } else {
      adcEntry.mxn += amount;
    }

    // Distribuidor Distribution
    const dist = r.distribuidor || r.activo?.distribuidor || 'Sin Distribuidor';
    distribuidorMap.set(dist, (distribuidorMap.get(dist) || 0) + 1);

    // Tipo de Equipo Distribution
    const tipo = r.activo?.tipo || r.tipo || r.activo?.clase || 'Sin Especificar';
    equipoTipoMap.set(tipo, (equipoTipoMap.get(tipo) || 0) + 1);
  });
  
  const totalMxn = Array.from(adcMap.values()).reduce((sum, item) => sum + item.mxn, 0);
  const totalUsd = Array.from(adcMap.values()).reduce((sum, item) => sum + item.usd, 0);

  const adcChartData = Array.from(adcMap.values())
    .map(item => ({
      ...item,
      mxnPercent: totalMxn > 0 ? (item.mxn / totalMxn) * 100 : 0,
      usdPercent: totalUsd > 0 ? (item.usd / totalUsd) * 100 : 0,
    }))
    .sort((a, b) => (b.mxn + b.usd) - (a.mxn + a.usd));

  const buildTop5ChartData = (mapData: Map<string, number>) => {
    const sorted = Array.from(mapData.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    if (sorted.length <= 5) return sorted;

    const top5 = sorted.slice(0, 5);
    const othersCount = sorted.slice(5).reduce((acc, curr) => acc + curr.value, 0);
    if (othersCount > 0) {
      top5.push({ name: 'Otros', value: othersCount });
    }
    return top5;
  };

  const distribuidorChartData = buildTop5ChartData(distribuidorMap);
  const equipoChartData = buildTop5ChartData(equipoTipoMap);
    
  const PIE_COLORS = ['#E5222D', '#334155', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
  const PIE_COLORS_EQUIPOS = ['#8b5cf6', '#10b981', '#f59e0b', '#E5222D', '#3b82f6', '#64748b'];

  return (
    <div className="min-h-screen bg-[#F9FAFB] p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-[0.25em] mb-1" style={{ color: currentColor }}>RAYMOND</span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Gestión de Rentas</h1>
          <p className="text-slate-500 font-medium mt-1 text-sm">Administración de contratos de renta, vigencias y asignación de activos</p>
        </div>
        
        {/* Header Action Button (Primary CTA Only) */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setIsNewRentaModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl sm:rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-slate-900/20 whitespace-nowrap active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Renta</span>
          </button>
        </div>
      </div>

      {loading && rentas.length === 0 ? (
        <PageLoader title="Cargando información de rentas" subtitle="Obteniendo contratos, montos y vigencias de la plataforma..." color={currentColor} />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="sticky top-16 lg:top-0 z-20 bg-[#F9FAFB]/95 backdrop-blur-md py-3 -my-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-8 -top-8 text-slate-50/50 transform group-hover:scale-110 transition-transform duration-500">
            <Receipt className="w-48 h-48" style={{ color: `${currentColor}10` }} />
          </div>
          <div className="relative z-10">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2 line-clamp-1">Total de Rentas {isAdc && '(Mi ADC)'}</p>
            <h3 className="text-3xl font-black" style={{ color: currentColor }}>{totalRentas}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-emerald-100 hover:shadow-md transition-all">
          <p className="text-emerald-600 text-[10px] font-black uppercase tracking-widest mb-2 line-clamp-1">Vigentes / Activas</p>
          <h3 className="text-3xl font-black text-slate-900">{activas}</h3>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-red-100 hover:shadow-md transition-all">
          <p className="text-red-600 text-[10px] font-black uppercase tracking-widest mb-2 line-clamp-1">Próximas a Vencer</p>
          <h3 className="text-3xl font-black text-slate-900">{porVencer}</h3>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-blue-100 hover:shadow-md transition-all flex flex-col justify-center">
          <p className="text-blue-600 text-[10px] font-black uppercase tracking-widest mb-2 line-clamp-1">Total a facturar</p>
          {importeMXN > 0 && <h3 className="text-xl font-black text-slate-900">${importeMXN.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} MXN</h3>}
          {importeUSD > 0 && <h3 className="text-xl font-black text-slate-900">${importeUSD.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} USD</h3>}
          {importeMXN === 0 && importeUSD === 0 && <h3 className="text-xl font-black text-slate-900">$0.00</h3>}
        </div>
      </div>
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Chart 1: Presupuesto por ADC (Dos barras: MXN y USD) */}
        <div className="xl:col-span-1 bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Presupuesto por ADC</h3>
            <span className="text-[10px] font-extrabold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">% de Cartera</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={adcChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(val) => `${val}%`} />
                <Tooltip 
                  cursor={{ fill: '#f1f5f9' }} 
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 700, fontSize: '12px' }}
                  formatter={(val: number, name: string) => [`${val.toFixed(1)}%`, name]}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingTop: '8px' }} />
                <Bar dataKey="mxnPercent" name="MXN (%)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={35} />
                <Bar dataKey="usdPercent" name="USD (%)" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={35} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Distribución por Distribuidor */}
        <div className="xl:col-span-1 bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Distribución por Distribuidor</h3>
            <span className="text-[10px] font-extrabold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">Top 5</span>
          </div>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distribuidorChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {distribuidorChartData.map((entry, index) => (
                    <Cell key={`cell-dist-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 700, fontSize: '12px' }}
                  formatter={(val: number) => [`${val} rentas`, 'Total']}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Distribución por Tipo de Equipo */}
        <div className="xl:col-span-1 bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Distribución por Tipo de Equipo</h3>
            <span className="text-[10px] font-extrabold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">Top 5</span>
          </div>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={equipoChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {equipoChartData.map((entry, index) => (
                    <Cell key={`cell-eq-${index}`} fill={PIE_COLORS_EQUIPOS[index % PIE_COLORS_EQUIPOS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 700, fontSize: '12px' }}
                  formatter={(val: number) => [`${val} equipos`, 'Total']}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Dedicated Controls & Search Toolbar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border-2 border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        {/* Left: Search Bar & Clear Filters */}
        <div className="flex items-center gap-3 flex-1 w-full md:w-auto">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 focus-within:text-red-500 transition-colors" />
            <input
              type="text"
              placeholder="Buscar por cliente, serie, folio OC..."
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

          {(searchTerm || 
            selectedFilterCuenta.length > 0 || 
            selectedFilterSitio.length > 0 || 
            selectedFilterAdc.length > 0 || 
            selectedFilterEquipo.length > 0 || 
            selectedFilterClase.length > 0 || 
            selectedFilterModelo.length > 0 || 
            selectedFilterSerie.length > 0 || 
            selectedFilterEstatus.length > 0 || 
            selectedFilterOach.length > 0 || 
            selectedFilterAltura.length > 0 || 
            selectedFilterBc.length > 0 || 
            selectedFilterFolioOc.length > 0 || 
            selectedFilterFEntregado.length > 0 || 
            selectedFilterPlazo.length > 0 || 
            selectedFilterFVencimiento.length > 0 || 
            selectedFilterPropietario.length > 0 || 
            selectedFilterPrecioRenta.length > 0 || 
            selectedFilterMoneda.length > 0 || 
            selectedFilterPoliza.length > 0 || 
            selectedFilterDistribuidor.length > 0 || 
            selectedFilterCostoPoliza.length > 0 || 
            selectedFilterMonedaPago.length > 0) && (
            <button 
              onClick={() => {
                setSearchTerm('');
                setSelectedOcPeriodoStatus('TODOS');
                setSelectedFilterCuenta([]);
                setSelectedFilterSitio([]);
                setSelectedFilterAdc([]);
                setSelectedFilterEquipo([]);
                setSelectedFilterClase([]);
                setSelectedFilterModelo([]);
                setSelectedFilterSerie([]);
                setSelectedFilterEstatus([]);
                setSelectedFilterOach([]);
                setSelectedFilterAltura([]);
                setSelectedFilterBc([]);
                setSelectedFilterFolioOc([]);
                setSelectedFilterFEntregado([]);
                setSelectedFilterPlazo([]);
                setSelectedFilterFVencimiento([]);
                setSelectedFilterPropietario([]);
                setSelectedFilterPrecioRenta([]);
                setSelectedFilterMoneda([]);
                setSelectedFilterPoliza([]);
                setSelectedFilterDistribuidor([]);
                setSelectedFilterCostoPoliza([]);
                setSelectedFilterMonedaPago([]);
                setCurrentPage(1);
              }} 
              className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl border-2 border-red-200 text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer" 
              title="Limpiar todos los filtros"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Limpiar filtros</span>
            </button>
          )}
        </div>

        {/* Right: Period Selector & Quick Filters & Actions */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 shrink-0 justify-between md:justify-end w-full md:w-auto">
          {/* Period Selector Popover */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-slate-200 shadow-2xs">
            <Popover open={openPeriodoViewPopover} onOpenChange={setOpenPeriodoViewPopover}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-black text-slate-800 transition-all border border-slate-200 cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5 text-red-600" />
                  <span>
                    {selectedPeriodoView === 'todos' 
                      ? 'Todos los Periodos' 
                      : (() => {
                          const [y, m] = selectedPeriodoView.split('-');
                          const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                          return `${monthNames[Number(m) - 1]} ${y}`;
                        })()
                    }
                  </span>
                  <ChevronsUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-2 bg-white rounded-2xl shadow-xl border border-slate-200">
                <div className="text-[10px] font-black uppercase text-slate-400 px-2 py-1 tracking-wider">
                  Seleccionar Periodo
                </div>
                <div className="space-y-1">
                  {[
                    { value: '2026-07', label: 'Julio 2026' },
                    { value: '2026-08', label: 'Agosto 2026' },
                    { value: '2026-09', label: 'Septiembre 2026' },
                    { value: '2026-10', label: 'Octubre 2026' },
                    { value: '2026-11', label: 'Noviembre 2026' },
                    { value: '2026-12', label: 'Diciembre 2026' },
                    { value: '2027-01', label: 'Enero 2027' },
                    { value: 'todos', label: 'Todos los periodos' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setSelectedPeriodoView(opt.value);
                        setOpenPeriodoViewPopover(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-xs rounded-xl font-bold transition-all flex items-center justify-between cursor-pointer",
                        selectedPeriodoView === opt.value 
                          ? "bg-red-50 text-red-700 font-black" 
                          : "text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <span>{opt.label}</span>
                      {selectedPeriodoView === opt.value && <Check className="w-3.5 h-3.5 text-red-600" />}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Quick status pills */}
          {selectedPeriodoView !== 'todos' && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setSelectedOcPeriodoStatus('TODOS')}
                className={cn(
                  "px-2.5 py-1 rounded-xl text-xs font-black transition-all cursor-pointer",
                  selectedOcPeriodoStatus === 'TODOS'
                    ? "bg-white text-slate-800 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                Todos ({periodOcStats.total})
              </button>
              <button
                type="button"
                onClick={() => setSelectedOcPeriodoStatus('CON_OC')}
                className={cn(
                  "px-2.5 py-1 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1",
                  selectedOcPeriodoStatus === 'CON_OC'
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "text-emerald-700 hover:bg-emerald-50"
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                Con OC ({periodOcStats.conOc})
              </button>
              <button
                type="button"
                onClick={() => setSelectedOcPeriodoStatus('SIN_OC')}
                className={cn(
                  "px-2.5 py-1 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1",
                  selectedOcPeriodoStatus === 'SIN_OC'
                    ? "bg-amber-500 text-white shadow-2xs"
                    : "text-amber-700 hover:bg-amber-50"
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300"></span>
                Sin OC ({periodOcStats.sinOc})
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={exportRentasToCSV}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-2xs whitespace-nowrap cursor-pointer"
              title="Exportar a Excel"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Exportar</span>
            </button>
            <button
              onClick={() => setIsCopyModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer"
              title="Copiar y replicar OCs del mes anterior"
            >
              <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
              <span>Copiar Mes Anterior</span>
            </button>
            <button
              onClick={() => {
                resetFichaOcForm();
                setIsFichaOcModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm hover:opacity-90 whitespace-nowrap cursor-pointer"
              style={{ backgroundColor: currentColor, boxShadow: `0 2px 8px 0 ${currentColor}30` }}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Registro OC</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grouped Table */}
      <div className="bg-white border-2 border-slate-100 rounded-[2rem] shadow-sm overflow-hidden animate-in fade-in duration-300">
        <div className="overflow-x-auto overflow-y-auto max-h-[65vh] relative scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
          <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-50 text-[10px] text-slate-500 uppercase tracking-widest border-b-2 border-slate-100 shadow-sm">
              <tr>
                <th className="px-4 py-4">
                  <TableHeaderFilter label="Cuenta" title="CUENTA" value={selectedFilterCuenta} onChange={(val) => { setSelectedFilterCuenta(val); setCurrentPage(1); }} options={filterUniqueCuentas} open={openFilterCuenta} setOpen={setOpenFilterCuenta} search={searchCuenta} setSearch={setSearchCuenta} currentColor={currentColor} />
                </th>
                <th className="px-4 py-4">
                  <TableHeaderFilter label="Sitio" title="SITE" value={selectedFilterSitio} onChange={(val) => { setSelectedFilterSitio(val); setCurrentPage(1); }} options={filterUniqueSitios} open={openFilterSitio} setOpen={setOpenFilterSitio} search={searchSitio} setSearch={setSearchSitio} currentColor={currentColor} />
                </th>
                {!isAdc && (
                  <th className="px-4 py-4">
                    <TableHeaderFilter label="Ejecutivo (ADC)" title="EJECUTIVO (ADC)" value={selectedFilterAdc} onChange={(val) => { setSelectedFilterAdc(val); setCurrentPage(1); }} options={filterUniqueAdcs} open={openFilterAdc} setOpen={setOpenFilterAdc} search={searchAdc} setSearch={setSearchAdc} currentColor={currentColor} />
                  </th>
                )}
                <th className="px-4 py-4">
                  <TableHeaderFilter label="Equipo" title="TIPO" value={selectedFilterEquipo} onChange={(val) => { setSelectedFilterEquipo(val); setCurrentPage(1); }} options={filterUniqueEquipos} open={openFilterEquipo} setOpen={setOpenFilterEquipo} search={searchEquipo} setSearch={setSearchEquipo} currentColor={currentColor} />
                </th>
                <th className="px-4 py-4">
                  <TableHeaderFilter label="Clase" title="CLASE" value={selectedFilterClase} onChange={(val) => { setSelectedFilterClase(val); setCurrentPage(1); }} options={filterUniqueClases} open={openFilterClase} setOpen={setOpenFilterClase} search={searchClase} setSearch={setSearchClase} currentColor={currentColor} />
                </th>
                <th className="px-4 py-4">
                  <TableHeaderFilter label="Modelo" title="MODELO" value={selectedFilterModelo} onChange={(val) => { setSelectedFilterModelo(val); setCurrentPage(1); }} options={filterUniqueModelos} open={openFilterModelo} setOpen={setOpenFilterModelo} search={searchModelo} setSearch={setSearchModelo} currentColor={currentColor} />
                </th>
                <th className="px-4 py-4">
                  <TableHeaderFilter label="Serie" title="SERIE" value={selectedFilterSerie} onChange={(val) => { setSelectedFilterSerie(val); setCurrentPage(1); }} options={filterUniqueSeries} open={openFilterSerie} setOpen={setOpenFilterSerie} search={searchSerie} setSearch={setSearchSerie} currentColor={currentColor} />
                </th>
                <th className="px-4 py-4">
                  <TableHeaderFilter label="Estatus" title="ESTATUS EQUIPO" value={selectedFilterEstatus} onChange={(val) => { setSelectedFilterEstatus(val); setCurrentPage(1); }} options={filterUniqueEstatus} open={openFilterEstatus} setOpen={setOpenFilterEstatus} search={searchEstatus} setSearch={setSearchEstatus} currentColor={currentColor} />
                </th>
                <th className="px-4 py-4">
                  <TableHeaderFilter label="OACH" title="OACH" value={selectedFilterOach} onChange={(val) => { setSelectedFilterOach(val); setCurrentPage(1); }} options={filterUniqueOach} open={openFilterOach} setOpen={setOpenFilterOach} search={searchOach} setSearch={setSearchOach} currentColor={currentColor} />
                </th>
                <th className="px-4 py-4">
                  <TableHeaderFilter label="Altura" title="ALTURA" value={selectedFilterAltura} onChange={(val) => { setSelectedFilterAltura(val); setCurrentPage(1); }} options={filterUniqueAlturas} open={openFilterAltura} setOpen={setOpenFilterAltura} search={searchAltura} setSearch={setSearchAltura} currentColor={currentColor} />
                </th>
                <th className="px-4 py-4">
                  <TableHeaderFilter label="BC" title="BC" value={selectedFilterBc} onChange={(val) => { setSelectedFilterBc(val); setCurrentPage(1); }} options={filterUniqueBc} open={openFilterBc} setOpen={setOpenFilterBc} search={searchBc} setSearch={setSearchBc} currentColor={currentColor} />
                </th>
                <th className="px-4 py-4">
                  <TableHeaderFilter label="Folio OC" title="FOLIO OC" value={selectedFilterFolioOc} onChange={(val) => { setSelectedFilterFolioOc(val); setCurrentPage(1); }} options={filterUniqueFolioOc} open={openFilterFolioOc} setOpen={setOpenFilterFolioOc} search={searchFolioOc} setSearch={setSearchFolioOc} currentColor={currentColor} />
                </th>
                <th className="px-4 py-4">
                  <TableHeaderFilter label="F. Entregado" title="F. ENTREGADO" value={selectedFilterFEntregado} onChange={(val) => { setSelectedFilterFEntregado(val); setCurrentPage(1); }} options={filterUniqueFEntregado} open={openFilterFEntregado} setOpen={setOpenFilterFEntregado} search={searchFEntregado} setSearch={setSearchFEntregado} currentColor={currentColor} />
                </th>
                <th className="px-4 py-4">
                  <TableHeaderFilter label="Plazo" title="PLAZO (MESES)" value={selectedFilterPlazo} onChange={(val) => { setSelectedFilterPlazo(val); setCurrentPage(1); }} options={filterUniquePlazos} open={openFilterPlazo} setOpen={setOpenFilterPlazo} search={searchPlazo} setSearch={setSearchPlazo} currentColor={currentColor} />
                </th>
                <th className="px-4 py-4">
                  <TableHeaderFilter label="F. Vencimiento" title="F. VENCIMIENTO" value={selectedFilterFVencimiento} onChange={(val) => { setSelectedFilterFVencimiento(val); setCurrentPage(1); }} options={filterUniqueFVencimiento} open={openFilterFVencimiento} setOpen={setOpenFilterFVencimiento} search={searchFVencimiento} setSearch={setSearchFVencimiento} currentColor={currentColor} />
                </th>
                <th className="px-4 py-4">
                  <TableHeaderFilter label="Propietario" title="PROPIETARIO" value={selectedFilterPropietario} onChange={(val) => { setSelectedFilterPropietario(val); setCurrentPage(1); }} options={filterUniquePropietarios} open={openFilterPropietario} setOpen={setOpenFilterPropietario} search={searchPropietario} setSearch={setSearchPropietario} currentColor={currentColor} />
                </th>
                <th className="px-4 py-4 text-right">
                  <TableHeaderFilter label="Precio Renta" title="PRECIO RENTA" value={selectedFilterPrecioRenta} onChange={(val) => { setSelectedFilterPrecioRenta(val); setCurrentPage(1); }} options={filterUniquePreciosRenta} open={openFilterPrecioRenta} setOpen={setOpenFilterPrecioRenta} search={searchPrecioRenta} setSearch={setSearchPrecioRenta} currentColor={currentColor} />
                </th>
                <th className="px-4 py-4">
                  <TableHeaderFilter label="Moneda" title="MONEDA" value={selectedFilterMoneda} onChange={(val) => { setSelectedFilterMoneda(val); setCurrentPage(1); }} options={filterUniqueMonedas} open={openFilterMoneda} setOpen={setOpenFilterMoneda} search={searchMoneda} setSearch={setSearchMoneda} currentColor={currentColor} />
                </th>
                <th className="px-4 py-4">
                  <TableHeaderFilter label="Póliza" title="PÓLIZA" value={selectedFilterPoliza} onChange={(val) => { setSelectedFilterPoliza(val); setCurrentPage(1); }} options={filterUniquePolizas} open={openFilterPoliza} setOpen={setOpenFilterPoliza} search={searchPoliza} setSearch={setSearchPoliza} currentColor={currentColor} />
                </th>
                <th className="px-4 py-4">
                  <TableHeaderFilter label="Distribuidor" title="DISTRIBUIDOR" value={selectedFilterDistribuidor} onChange={(val) => { setSelectedFilterDistribuidor(val); setCurrentPage(1); }} options={filterUniqueDistribuidores} open={openFilterDistribuidor} setOpen={setOpenFilterDistribuidor} search={searchDistribuidor} setSearch={setSearchDistribuidor} currentColor={currentColor} />
                </th>
                <th className="px-4 py-4 text-right">
                  <TableHeaderFilter label="Costo Póliza" title="COSTO PÓLIZA" value={selectedFilterCostoPoliza} onChange={(val) => { setSelectedFilterCostoPoliza(val); setCurrentPage(1); }} options={filterUniqueCostosPoliza} open={openFilterCostoPoliza} setOpen={setOpenFilterCostoPoliza} search={searchCostoPoliza} setSearch={setSearchCostoPoliza} currentColor={currentColor} />
                </th>
                <th className="px-4 py-4">
                  <TableHeaderFilter label="Moneda Pago" title="MONEDA PAGO" value={selectedFilterMonedaPago} onChange={(val) => { setSelectedFilterMonedaPago(val); setCurrentPage(1); }} options={filterUniqueMonedasPago} open={openFilterMonedaPago} setOpen={setOpenFilterMonedaPago} search={searchMonedaPago} setSearch={setSearchMonedaPago} currentColor={currentColor} />
                </th>
                <th className="px-4 py-4 font-black text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={22}>
                    <div className="py-24 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-500">
                      <div className="relative w-16 h-16">
                        <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                        <div className="absolute inset-0 border-4 rounded-full border-t-transparent animate-spin" style={{ borderColor: `${currentColor} transparent` }}></div>
                        <Receipt className="absolute inset-0 m-auto w-6 h-6 animate-pulse" style={{ color: currentColor }} />
                      </div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Cargando rentas...</p>
                    </div>
                  </td>
                </tr>
              ) : Object.keys(groupedRentas).length === 0 ? (
                <tr><td colSpan={22} className="px-6 py-12 text-center text-slate-400 font-bold">No se encontraron rentas.</td></tr>
              ) : Object.entries(groupedRentas).map(([clienteNombre, clientRentas]) => (
                <Fragment key={clienteNombre}>
                  {/* Group header */}
                  <tr className="bg-slate-50/80 font-black text-slate-800 border-y border-slate-100">
                    <td colSpan={22} className="px-4 py-3 text-xs flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[#E5222D]" />
                      {clienteNombre}
                      <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded border ml-2">
                        {clientRentas.length} renta{clientRentas.length > 1 ? 's' : ''}
                      </span>
                    </td>
                  </tr>
                  {clientRentas.map((renta) => {
                    const cond = renta.condiciones || {};
                    const detalles = renta.detalles || {};
                    return (
                      <tr key={renta.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-4 py-3.5 font-semibold text-slate-900">{renta.cuenta || '-'}</td>
                        <td className="px-4 py-3.5 text-slate-600">{renta.sitio?.nombre || '-'}</td>
                        {!isAdc && (
                          <td className="px-4 py-3.5 font-bold text-slate-500">{renta.adc || renta.cliente?.datos_comerciales?.adc || '-'}</td>
                        )}
                        <td className="px-4 py-3.5 text-slate-500">{renta.activo?.tipo || '-'}</td>
                        <td className="px-4 py-3.5 text-slate-500">{renta.activo?.clase || '-'}</td>
                        <td className="px-4 py-3.5 text-slate-700">{renta.activo?.modelo || '-'}</td>
                        <td className="px-4 py-3.5 font-mono text-xs text-slate-800">{renta.activo?.serie || '-'}</td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                            {renta.activo?.estatus || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-500">{renta.activo?.oach || '-'}</td>
                        <td className="px-4 py-3.5 text-slate-500">{renta.activo?.altura || '-'}</td>
                        <td className="px-4 py-3.5 text-slate-500">{renta.activo?.bc || '-'}</td>
                        <td className="px-4 py-3.5">
                          {(() => {
                            if (selectedPeriodoView !== 'todos') {
                              const estNorm = (renta.activo?.estatus || '').trim().toUpperCase();
                              const isInactiveOrBackup = estNorm.startsWith('INACTIVO') || estNorm === 'BACK UP' || estNorm === 'BACKUP' || estNorm === 'POR RETIRAR' || estNorm === 'BAJA' || estNorm === 'TALLER' || estNorm === 'COMODATO';
                              
                              if (isInactiveOrBackup) {
                                return (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                    {renta.activo?.estatus || 'Back Up'}
                                  </span>
                                );
                              }

                              const ord = (renta.ordenes || []).find((o: any) => o.periodo === selectedPeriodoView);
                              if (ord?.po && ord.po.trim() !== '' && ord.po !== '-' && ord.po.toUpperCase() !== 'PENDIENTE' && ord.po.toUpperCase() !== 'SIN OC') {
                                return (
                                  <span 
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200" 
                                    title={`TOTVS: ${ord.pedido_totvs || '-'} | Tarifa: $${Number(ord.tarifa || 0).toLocaleString()}`}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    {ord.po}
                                  </span>
                                );
                              }
                              return (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                  Sin OC
                                </span>
                              );
                            }
                            return (
                              <span className="font-bold text-[#E5222D]">
                                {renta.orden_compra || detalles.oc_cliente || '-'}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3.5 text-slate-500">
                          {renta.fecha_inicio ? new Date(renta.fecha_inicio).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                        </td>
                        <td className="px-4 py-3.5 text-slate-500">{cond.plazo_meses || '-'}</td>
                        <td className="px-4 py-3.5 text-slate-500">
                          {renta.fecha_fin ? new Date(renta.fecha_fin).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                        </td>
                        <td className="px-4 py-3.5 font-bold text-slate-700">{renta.propietario || renta.activo?.propietario || '-'}</td>
                        <td className="px-4 py-3.5 text-right font-bold text-slate-800">
                          ${(detalles.renta_base || renta.tarifa || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3.5 text-slate-500">{detalles.moneda || 'MXN'}</td>
                        <td className="px-4 py-3.5 text-slate-600">{cond.tipo_poliza || renta.activo?.tipo_poliza || 'SMP'}</td>
                        <td className="px-4 py-3.5 text-slate-600">{renta.distribuidor || renta.activo?.distribuidor || '-'}</td>
                        <td className="px-4 py-3.5 text-right text-slate-600">
                          ${(cond.costo_poliza_distribuidor || renta.activo?.costo_poliza_distribuidor || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3.5 text-slate-500">{cond.moneda_pago_distribuidor || renta.activo?.moneda_pago_distribuidor || 'MXN'}</td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setRegisterOcConfig({
                                  isOpen: true,
                                  renta,
                                  periodo: new Date().toISOString().slice(0, 7),
                                  po: renta.orden_compra || (renta.detalles as any)?.oc_cliente || '',
                                  pedido_totvs: renta.no_registro_totvs || (renta.condiciones as any)?.pedido_totvs || '',
                                  fecha_pedido_totvs: renta.fecha_pedido_totvs ? new Date(renta.fecha_pedido_totvs).toISOString().split('T')[0] : '',
                                  isSubmitting: false,
                                  pdfFile: null,
                                  isDragging: false
                                });
                              }}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                              title="Registrar OC"
                            >
                              <FilePlus className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); openViewModal(renta); }}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                              title="Consultar"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); openEditModal(renta); }}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {isAdministrator && (
                              <button
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  setDeleteRentaModal({ isOpen: true, renta, isDeleting: false });
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                title="Eliminar Renta"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {totalItems > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-[2rem] gap-4">
            <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
              <span>
                Mostrando <strong className="text-slate-900 font-bold">{((currentPage - 1) * itemsPerPage) + 1}</strong> a <strong className="text-slate-900 font-bold">{Math.min(currentPage * itemsPerPage, totalItems)}</strong> de <strong className="text-slate-900 font-bold">{totalItems}</strong> registros
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
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
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
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
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

      {/* REGISTER OC MANUAL MODAL */}
      <AnimatePresence>
        {registerOcConfig.isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRegisterOcConfig(prev => ({ ...prev, isOpen: false, renta: null, periodo: '', po: '', pedido_totvs: '', fecha_pedido_totvs: '', isSubmitting: false, pdfFile: null, isDragging: false }))}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl bg-white rounded-[2rem] shadow-2xl z-50 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <form onSubmit={handleRegisterOc} className="flex flex-col h-full overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-red-50 text-[#E5222D] rounded-2xl">
                      <FilePlus className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900">Registrar Orden de Compra</h2>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Generar orden mensual rápida</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRegisterOcConfig(prev => ({ ...prev, isOpen: false, renta: null, periodo: '', po: '', pedido_totvs: '', fecha_pedido_totvs: '', isSubmitting: false, pdfFile: null, isDragging: false }))}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar space-y-5">
                  {/* Selected Renta Info Card */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between">
                    <div className="space-y-0.5 min-w-0 pr-3">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Equipo / Renta</span>
                      <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <span className="font-mono text-slate-900 font-black">{registerOcConfig.renta?.activo?.serie || '-'}</span>
                        <span className="text-xs text-slate-400 font-medium truncate">• {registerOcConfig.renta?.activo?.modelo || registerOcConfig.renta?.activo?.clase || 'Equipo'}</span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {registerOcConfig.renta?.cliente?.razon_social || registerOcConfig.renta?.cliente?.nombre || 'Cliente'} — <strong className="text-slate-700">{registerOcConfig.renta?.cuenta || registerOcConfig.renta?.sitio?.nombre}</strong>
                      </p>
                    </div>
                    <div className="text-right shrink-0 bg-white border border-slate-200/80 rounded-xl px-3 py-1.5">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Tarifa Base</span>
                      <div className="text-xs font-black text-slate-900">
                        ${(Number(registerOcConfig.renta?.detalles?.renta_base) || Number(registerOcConfig.renta?.tarifa) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-[10px] text-slate-500 font-normal">{registerOcConfig.renta?.detalles?.moneda || 'MXN'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Form Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-widest">
                        Folio OC Cliente *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ingresar número de OC"
                        value={registerOcConfig.po}
                        onChange={e => setRegisterOcConfig(prev => ({ ...prev, po: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:border-red-500 focus:outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-widest">
                        Mes de Cobertura *
                      </label>
                      <input
                        type="month"
                        required
                        value={registerOcConfig.periodo}
                        onChange={e => setRegisterOcConfig(prev => ({ ...prev, periodo: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:border-red-500 focus:outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-widest">
                        Pedido TOTVS
                      </label>
                      <input
                        type="text"
                        placeholder="Ingresar pedido TOTVS"
                        value={registerOcConfig.pedido_totvs}
                        onChange={e => setRegisterOcConfig(prev => ({ ...prev, pedido_totvs: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:border-red-500 focus:outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-widest">
                        Fecha Registro TOTVS
                      </label>
                      <input
                        type="date"
                        value={registerOcConfig.fecha_pedido_totvs}
                        onChange={e => setRegisterOcConfig(prev => ({ ...prev, fecha_pedido_totvs: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:border-red-500 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* PDF Upload */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-widest">
                      Documento PDF de la OC <span className="text-red-500">*</span>
                    </label>
                    {registerOcConfig.pdfFile ? (
                      <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-2xl px-4 py-3 w-full">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 bg-red-100 rounded-xl shrink-0">
                            <FileText className="w-4 h-4 text-red-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-red-700 truncate max-w-[280px]">{registerOcConfig.pdfFile.name}</p>
                            <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">
                              {(registerOcConfig.pdfFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <button
                            type="button"
                            onClick={() => document.getElementById('registerOcPdfUpload')?.click()}
                            className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                          >
                            Reemplazar
                          </button>
                          <button
                            type="button"
                            onClick={() => setRegisterOcConfig(prev => ({ ...prev, pdfFile: null }))}
                            className="p-1.5 hover:bg-red-100 rounded-lg transition-colors text-red-400 hover:text-red-600"
                            title="Eliminar archivo"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <input
                          type="file"
                          accept="application/pdf"
                          id="registerOcPdfUpload"
                          className="hidden"
                          onChange={e => {
                            if (e.target.files && e.target.files[0]) {
                              setRegisterOcConfig(prev => ({ ...prev, pdfFile: e.target.files![0] }));
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <div
                        onClick={() => document.getElementById('registerOcPdfUpload')?.click()}
                        className={cn(
                          "cursor-pointer flex flex-col items-center justify-center gap-1.5 border-2 border-dashed rounded-2xl p-4 text-center transition-all w-full",
                          registerOcConfig.isDragging ? "border-red-500 bg-red-50/50" : "border-slate-200 bg-slate-50/50 hover:border-red-400 hover:bg-slate-50"
                        )}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setRegisterOcConfig(prev => ({ ...prev, isDragging: true }));
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = 'copy';
                          setRegisterOcConfig(prev => ({ ...prev, isDragging: true }));
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setRegisterOcConfig(prev => ({ ...prev, isDragging: false }));
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setRegisterOcConfig(prev => ({ ...prev, isDragging: false }));
                          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                            const droppedFile = e.dataTransfer.files[0];
                            if (droppedFile.type === "application/pdf") {
                              setRegisterOcConfig(prev => ({ ...prev, pdfFile: droppedFile }));
                            } else {
                              toast.error("Solo se permiten archivos PDF");
                            }
                          }
                        }}
                      >
                        <input
                          type="file"
                          accept="application/pdf"
                          id="registerOcPdfUpload"
                          className="hidden"
                          onChange={e => {
                            if (e.target.files && e.target.files[0]) {
                              setRegisterOcConfig(prev => ({ ...prev, pdfFile: e.target.files![0] }));
                            }
                          }}
                        />
                        <FileText className={cn("w-7 h-7 mb-0.5 transition-colors", registerOcConfig.isDragging ? "text-red-500" : "text-slate-400")} />
                        <span className={cn("text-xs font-bold", registerOcConfig.isDragging ? "text-red-600" : "text-slate-700")}>
                          {registerOcConfig.isDragging ? "¡Suelta el archivo aquí!" : "Seleccionar Archivo PDF o Arrastrar y Soltar"}
                        </span>
                        <span className="text-[11px] text-slate-400">PDF máximo 10MB</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0 rounded-b-[2rem]">
                  <button
                    type="button"
                    onClick={() => setRegisterOcConfig(prev => ({ ...prev, isOpen: false, renta: null, periodo: '', po: '', pedido_totvs: '', fecha_pedido_totvs: '', isSubmitting: false, pdfFile: null, isDragging: false }))}
                    className="px-6 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={registerOcConfig.isSubmitting}
                    className="px-7 py-2.5 bg-[#E5222D] hover:bg-[#CC1E28] text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-red-200 flex items-center gap-2 disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    {registerOcConfig.isSubmitting ? 'Guardando...' : 'Registrar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Registro OC MODAL */}
      <AnimatePresence>
        {isFichaOcModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={resetFichaOcForm}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-6xl max-h-[92vh] bg-white rounded-[2rem] shadow-2xl z-50 overflow-hidden flex flex-col"
            >
              <form onSubmit={handleCreateFichaOc} className="flex flex-col h-full overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-red-50 text-[#E5222D] rounded-2xl">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900">Registro OC</h2>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Registrar Orden de Compra Cliente</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={resetFichaOcForm}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-8 pt-0 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6">
                
                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6">
                  <h3 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: currentColor }}>
                    <Building2 className="w-4 h-4"/> 1. Información del Cliente
                  </h3>
                  <div className="space-y-4">
                    {/* Row 1: Selectores de Cliente, Cuenta y Sitio */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Cliente select */}
                      <div className="space-y-1.5 flex flex-col">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Cliente *</label>
                        <Popover open={openFichaCliente} onOpenChange={setOpenFichaCliente}>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 flex justify-between items-center focus:outline-none focus:border-red-500 hover:border-red-400 transition-colors"
                            >
                              <span className={cn("truncate", !selectedFichaClienteId && "text-slate-400 font-normal")}>
                                {selectedFichaClienteId
                                  ? (clientesDisponibles.find((c: any) => c.id === selectedFichaClienteId)?.razonSocial || clientesDisponibles.find((c: any) => c.id === selectedFichaClienteId)?.razon_social)
                                  : "Seleccionar cliente..."}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-40" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-2 z-[99999]" align="start">
                            <div className="relative mb-2">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input
                                type="text"
                                placeholder="Buscar cliente..."
                                value={fichaClienteSearchTerm}
                                onChange={(e) => setFichaClienteSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-red-500"
                              />
                            </div>
                            <div className="max-h-[250px] overflow-y-auto space-y-1">
                              {[...filteredClientesDisponibles]
                                .filter((c: any) => c && (c.razonSocial || c.razon_social || '').toLowerCase().includes((fichaClienteSearchTerm || '').toLowerCase()))
                                .sort((a, b) => (a.razonSocial || a.razon_social || '').localeCompare(b.razonSocial || b.razon_social || ''))
                                .length === 0 ? (
                                  <div className="p-4 text-center text-sm text-slate-500">No se encontraron clientes.</div>
                                ) : (
                                  [...filteredClientesDisponibles]
                                    .filter((c: any) => c && (c.razonSocial || c.razon_social || '').toLowerCase().includes((fichaClienteSearchTerm || '').toLowerCase()))
                                    .sort((a, b) => (a.razonSocial || a.razon_social || '').localeCompare(b.razonSocial || b.razon_social || ''))
                                    .map((c: any) => (
                                      <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => {
                                          setSelectedFichaClienteId(c.id);
                                          setSelectedFichaCuenta('');
                                          setSelectedFichaSitioId('');
                                          setOpenFichaCliente(false);
                                          setFichaClienteSearchTerm('');
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors flex items-center justify-between font-medium"
                                      >
                                        <span className="truncate">{c.razonSocial || c.razon_social}</span>
                                        {selectedFichaClienteId === c.id && <Check className="w-4 h-4 text-red-600 shrink-0 ml-2" />}
                                      </button>
                                    ))
                                )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Cuenta select */}
                      <div className="space-y-1.5 flex flex-col">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Cuenta</label>
                        <Popover open={openFichaCuenta} onOpenChange={setOpenFichaCuenta}>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              disabled={!selectedFichaClienteId}
                              className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 flex justify-between items-center focus:outline-none focus:border-red-500 hover:border-red-400 transition-colors disabled:opacity-50"
                            >
                              <span className="truncate">
                                {selectedFichaCuenta || "Todas las cuentas"}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-40" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-2 z-[99999]" align="start">
                            <div className="relative mb-2">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input
                                type="text"
                                placeholder="Buscar cuenta..."
                                value={fichaCuentaSearchTerm}
                                onChange={(e) => setFichaCuentaSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-red-500"
                              />
                            </div>
                            <div className="max-h-[250px] overflow-y-auto space-y-1">
                              {(() => {
                                const cuentasUnicas = getCuentasParaCliente(selectedFichaClienteId);
                                const filtered = cuentasUnicas.filter(c => c.toLowerCase().includes(fichaCuentaSearchTerm.toLowerCase())).sort((a, b) => a.localeCompare(b));
                                
                                if (filtered.length === 0) return <div className="p-4 text-center text-sm text-slate-500">No se encontraron cuentas.</div>;
                                
                                return (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedFichaCuenta('');
                                        setSelectedFichaSitioId('');
                                        setOpenFichaCuenta(false);
                                      }}
                                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors flex items-center justify-between font-medium"
                                    >
                                      <span>Todas las cuentas</span>
                                      {!selectedFichaCuenta && <Check className="w-4 h-4 text-red-600 shrink-0 ml-2" />}
                                    </button>
                                    {filtered.map(cuenta => (
                                      <button
                                        key={cuenta}
                                        type="button"
                                        onClick={() => {
                                          setSelectedFichaCuenta(cuenta);
                                          setSelectedFichaSitioId('');
                                          setOpenFichaCuenta(false);
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors flex items-center justify-between font-medium"
                                      >
                                        <span className="truncate">{cuenta}</span>
                                        {selectedFichaCuenta === cuenta && <Check className="w-4 h-4 text-red-600 shrink-0 ml-2" />}
                                      </button>
                                    ))}
                                  </>
                                );
                              })()}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Sitio select */}
                      <div className="space-y-1.5 flex flex-col">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Sitio / Ubicación</label>
                        <Popover open={openFichaSitio} onOpenChange={setOpenFichaSitio}>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              disabled={!selectedFichaClienteId}
                              className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 flex justify-between items-center focus:outline-none focus:border-red-500 hover:border-red-400 transition-colors disabled:opacity-50"
                            >
                              <span className="truncate">
                                {selectedFichaSitioId
                                  ? (clientesDisponibles.find((c: any) => c.id === selectedFichaClienteId)?.sitios?.find((s: any) => s.id === selectedFichaSitioId)?.nombre || "Sitio seleccionado")
                                  : "Todos los sitios"}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-40" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-2 z-[99999]" align="start">
                            <div className="relative mb-2">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input
                                type="text"
                                placeholder="Buscar sitio..."
                                value={fichaSitioSearchTerm}
                                onChange={(e) => setFichaSitioSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-red-500"
                              />
                            </div>
                            <div className="max-h-[250px] overflow-y-auto space-y-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedFichaSitioId('');
                                  setOpenFichaSitio(false);
                                  setFichaSitioSearchTerm('');
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors flex items-center justify-between font-medium"
                              >
                                <span className="font-bold text-slate-800">Todos los sitios</span>
                                {!selectedFichaSitioId && <Check className="w-4 h-4 text-red-600 shrink-0 ml-2" />}
                              </button>
                              {(() => {
                                const sitiosDelCliente = clientesDisponibles.find((c: any) => c.id === selectedFichaClienteId)?.sitios || [];
                                const filteredByCuenta = selectedFichaCuenta
                                  ? sitiosDelCliente.filter((s: any) => {
                                      const matchCta = selectedFichaCuenta.trim().toLowerCase();
                                      if ((s.cuenta || '').trim().toLowerCase() === matchCta) return true;
                                      const hasRenta = rentas.some((r: any) =>
                                        (r.cliente_id === selectedFichaClienteId || r.cliente?.id === selectedFichaClienteId) &&
                                        r.sitio_id === s.id &&
                                        ((r.cuenta || '').trim().toLowerCase() === matchCta || (r.activo?.cuenta || '').trim().toLowerCase() === matchCta)
                                      );
                                      if (hasRenta) return true;
                                      const hasEquipo = equiposDisponibles.some((e: any) =>
                                        e.sitio_id === s.id && (e.cuenta || '').trim().toLowerCase() === matchCta
                                      );
                                      return hasEquipo;
                                    })
                                  : sitiosDelCliente;

                                const filtered = filteredByCuenta
                                  .filter((s: any) => s && (s.nombre || '').toLowerCase().includes((fichaSitioSearchTerm || '').toLowerCase()))
                                  .sort((a: any, b: any) => (a.nombre || '').localeCompare(b.nombre || ''));

                                if (filtered.length === 0) return <div className="p-4 text-center text-sm text-slate-500">No se encontraron otros sitios.</div>;

                                return filtered.map((s: any) => (
                                  <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedFichaSitioId(s.id);
                                      if (s.cuenta && !selectedFichaCuenta) setSelectedFichaCuenta(s.cuenta);
                                      setOpenFichaSitio(false);
                                      setFichaSitioSearchTerm('');
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors flex items-center justify-between font-medium"
                                  >
                                    <span className="truncate">{s.nombre}</span>
                                    {selectedFichaSitioId === s.id && <Check className="w-4 h-4 text-red-600 shrink-0 ml-2" />}
                                  </button>
                                ));
                              })()}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {/* Row 2: Folio OC, Folio Pedido TOTVS, Fecha TOTVS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Folio OC */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Folio OC Cliente *</label>
                        <input
                          type="text"
                          required
                          value={fichaFolioOc}
                          onChange={e => setFichaFolioOc(e.target.value)}
                          placeholder="Ingresar número de OC"
                          className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-red-500 transition-all placeholder:text-slate-400 placeholder:font-normal"
                        />
                      </div>

                      {/* Folio Pedido Totvs */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Folio Pedido TOTVS</label>
                        <input
                          type="text"
                          value={fichaPedidoTotvs}
                          onChange={e => {
                            const val = e.target.value;
                            setFichaPedidoTotvs(val);
                            setFichaSeriesGrid(prev => prev.map(item => {
                              if (!item.pedido_totvs || item.pedido_totvs === fichaPedidoTotvs) {
                                return { ...item, pedido_totvs: val };
                              }
                              return item;
                            }));
                          }}
                          placeholder="Ingresar pedido TOTVS (opcional)"
                          className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-red-500 transition-all placeholder:text-slate-400 placeholder:font-normal"
                        />
                      </div>

                      {/* Fecha Registro Totvs */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Fecha Registro TOTVS</label>
                        <input
                          type="date"
                          value={fichaFechaTotvs}
                          onChange={e => setFichaFechaTotvs(e.target.value)}
                          className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-red-500 transition-all"
                        />
                      </div>
                    </div>

                    {/* Row 3: Mes Inicio y Mes Fin */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Mes de Cobertura Desde */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Mes Inicio (Desde) *</label>
                        <input
                          type="month"
                          value={fichaMesCobro}
                          onChange={e => setFichaMesCobro(e.target.value)}
                          className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-red-500 transition-all"
                          required
                        />
                      </div>

                      {/* Mes de Cobertura Hasta (Opcional) */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Mes Fin (Hasta - Opcional)</label>
                          {fichaMesCobroFin && (
                            <button 
                              type="button" 
                              onClick={() => setFichaMesCobroFin('')}
                              className="text-[10px] font-bold text-slate-400 hover:text-red-500 cursor-pointer"
                            >
                              Limpiar
                            </button>
                          )}
                        </div>
                        <input
                          type="month"
                          min={fichaMesCobro}
                          value={fichaMesCobroFin}
                          onChange={e => setFichaMesCobroFin(e.target.value)}
                          className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-red-500 transition-all"
                        />
                        {fichaMesCobroFin && fichaMesCobroFin >= fichaMesCobro && (
                          <p className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            Aplica a {getMonthsInRange(fichaMesCobro, fichaMesCobroFin).length} meses ({fichaMesCobro} a {fichaMesCobroFin})
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Row 4: Carga de PDF */}
                    <div className="space-y-1.5 pt-1">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Cargar PDF de la OC del Cliente <span className="text-red-500">*</span></label>
                      {fichaPdfFile ? (
                        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-2xl px-4 py-3 w-full">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 bg-red-100 rounded-xl shrink-0">
                              <FileText className="w-4 h-4 text-red-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-red-700 truncate max-w-[280px]">{fichaPdfFile.name}</p>
                              <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">
                                {(fichaPdfFile.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            <button
                              type="button"
                              onClick={() => document.getElementById('fichaPdfUpload')?.click()}
                              className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                            >
                              Reemplazar
                            </button>
                            <button
                              type="button"
                              onClick={() => setFichaPdfFile(null)}
                              className="p-1.5 hover:bg-red-100 rounded-lg transition-colors text-red-400 hover:text-red-600"
                              title="Eliminar archivo"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <input
                            type="file"
                            accept="application/pdf"
                            id="fichaPdfUpload"
                            className="hidden"
                            onChange={e => {
                              if (e.target.files && e.target.files[0]) {
                                setFichaPdfFile(e.target.files[0]);
                              }
                            }}
                          />
                        </div>
                      ) : (
                        <div
                          onClick={() => document.getElementById('fichaPdfUpload')?.click()}
                          className={cn(
                            "cursor-pointer flex flex-col items-center justify-center gap-1.5 border-2 border-dashed rounded-2xl p-4 text-center transition-all w-full",
                            isFichaDragging ? "border-red-500 bg-red-50/50" : "border-slate-200 bg-white hover:border-red-400 hover:bg-slate-50/50"
                          )}
                          onDragEnter={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsFichaDragging(true);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            e.dataTransfer.dropEffect = 'copy';
                            setIsFichaDragging(true);
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsFichaDragging(false);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsFichaDragging(false);
                            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                              const droppedFile = e.dataTransfer.files[0];
                              if (droppedFile.type === "application/pdf") {
                                setFichaPdfFile(droppedFile);
                              } else {
                                toast.error("Solo se permiten archivos PDF");
                              }
                            }
                          }}
                        >
                          <input
                            type="file"
                            accept="application/pdf"
                            id="fichaPdfUpload"
                            className="hidden"
                            onChange={e => {
                              if (e.target.files && e.target.files[0]) {
                                setFichaPdfFile(e.target.files[0]);
                              }
                            }}
                          />
                          <div className="pointer-events-none flex flex-col items-center gap-1">
                            <FileText className={cn("w-7 h-7 transition-colors", isFichaDragging ? "text-red-500" : "text-slate-400")} />
                            <span className={cn("text-xs font-bold", isFichaDragging ? "text-red-600" : "text-slate-700")}>
                              {isFichaDragging ? "¡Suelta el archivo aquí!" : "Seleccionar Archivo PDF o Arrastrar y Soltar"}
                            </span>
                            <span className="text-[11px] text-slate-400">PDF máximo 10MB</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                  {/* Grid of Series & Days Discount Calculator */}
                  {selectedFichaClienteId && (
                    <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2" style={{ color: currentColor }}>
                            <Truck className="w-4 h-4"/> 2. Selección de Equipos para la OC
                          </h3>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">
                            Meses de cobertura: <strong className="text-slate-800 font-bold">
                              {fichaMesCobroFin && fichaMesCobroFin >= fichaMesCobro 
                                ? `${fichaMesCobro} a ${fichaMesCobroFin} (${getMonthsInRange(fichaMesCobro, fichaMesCobroFin).length} meses)` 
                                : (fichaMesCobro || 'Sin mes seleccionado')}
                            </strong>
                            <span className="text-slate-400 ml-2">
                              {selectedFichaSitioId 
                                ? `• Sitio: ${clientesDisponibles.find(c => c.id === selectedFichaClienteId)?.sitios?.find((s: any) => s.id === selectedFichaSitioId)?.nombre}`
                                : '• Todas las cuentas y sitios del cliente'}
                            </span>
                          </p>
                        </div>

                        {/* Quick action buttons */}
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCopyPrevMonthSelection}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                            title="Seleccionar automáticamente las series que tuvieron cobro el mes anterior"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Copiar selección mes previo</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowOnlyAvailableInMonth(prev => !prev)}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-xs cursor-pointer",
                              showOnlyAvailableInMonth
                                ? "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                                : "bg-slate-200 border-slate-300 text-slate-800"
                            )}
                          >
                            <Layers className="w-3.5 h-3.5 text-slate-500" />
                            <span>{showOnlyAvailableInMonth ? "Ver todas las series" : "Ocultar ya registradas"}</span>
                          </button>
                        </div>
                      </div>

                      {/* Summary counters bar */}
                      {(() => {
                        const totalCount = fichaSeriesGrid.length;
                        const alreadyCount = fichaSeriesGrid.filter(i => i.alreadyHasOrderInMonth).length;
                        const availCount = totalCount - alreadyCount;
                        return (
                          <div className="flex flex-wrap items-center gap-3 text-xs bg-white border border-slate-200/80 rounded-xl px-4 py-2">
                            <span className="text-slate-500">Total series activas: <strong className="text-slate-900 font-bold">{totalCount}</strong></span>
                            <span className="text-slate-300">|</span>
                            <span className="text-emerald-700 font-bold">Disponibles sin OC este mes: {availCount}</span>
                            {alreadyCount > 0 && (
                              <>
                                <span className="text-slate-300">|</span>
                                <span className="text-amber-700 font-bold">Ya con OC en {fichaMesCobro}: {alreadyCount}</span>
                              </>
                            )}
                          </div>
                        );
                      })()}

                      <div className="border border-slate-200 rounded-2xl overflow-x-auto custom-scrollbar shadow-sm bg-white">
                        <table className="w-full text-left text-xs whitespace-nowrap min-w-[960px]">
                          <thead className="bg-slate-50 text-[10px] text-slate-400 font-black uppercase tracking-wider border-b border-slate-100">
                            <tr>
                              <th className="p-3 w-10">
                                <button
                                  type="button"
                                  onClick={handleSelectAllSeries}
                                  className={cn(
                                    "text-[9px] font-black uppercase tracking-wider transition-colors whitespace-nowrap px-1.5 py-0.5 rounded cursor-pointer",
                                    allSeriesChecked
                                      ? "text-red-600 bg-red-50 hover:bg-red-100"
                                      : someSeriesChecked
                                      ? "text-amber-600 bg-amber-50 hover:bg-amber-100"
                                      : "text-slate-500 hover:text-red-600 hover:bg-red-50"
                                  )}
                                >
                                  {allSeriesChecked ? 'Quitar Todo' : 'Sel. Todo'}
                                </button>
                              </th>
                              <th className="p-3">Serie</th>
                              <th className="p-3">Sitio / Cuenta</th>
                              <th className="p-3">Clase / Modelo</th>
                              <th className="p-3">Estatus en Mes</th>
                              <th className="p-3 w-32">Pedido TOTVS</th>
                              <th className="p-3 w-28">Tarifa Renta</th>
                              <th className="p-3 w-24">Días Caídos</th>
                              <th className="p-3 w-28">Descuento</th>
                              <th className="p-3 w-28 font-black text-[#E5222D]">Tarifa Final</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {fichaSeriesGrid
                              .filter(item => !showOnlyAvailableInMonth || !item.alreadyHasOrderInMonth)
                              .map((item, index) => {
                                const realIdx = fichaSeriesGrid.findIndex(g => g.assetId === item.assetId);
                                return (
                                  <tr 
                                    key={item.assetId} 
                                    className={cn(
                                      "hover:bg-slate-50/50 transition-colors", 
                                      item.checked && "bg-red-50/15",
                                      item.alreadyHasOrderInMonth && "bg-slate-50/70 opacity-70"
                                    )}
                                  >
                                    <td className="p-3 text-center">
                                      <input
                                        type="checkbox"
                                        checked={item.checked}
                                        onChange={e => handleGridFieldChange(realIdx, 'checked', e.target.checked)}
                                        className="w-4.5 h-4.5 rounded text-red-600 focus:ring-red-500 cursor-pointer"
                                      />
                                    </td>
                                    <td className="p-3">
                                      <div className="font-bold text-slate-800">{item.serie}</div>
                                      {item.existingRenta && (
                                        <span className="text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded mt-0.5 inline-block">Renta Activa</span>
                                      )}
                                    </td>
                                    <td className="p-3 text-slate-600">
                                      <div className="flex flex-col text-xs mt-0.5">
                                        <span className="font-bold text-slate-800">{item.sitioNombre || '-'}</span>
                                        <span className="text-[10px] text-slate-500">{item.cuenta || '-'}</span>
                                      </div>
                                    </td>
                                    <td className="p-3 text-slate-600">
                                      <div className="flex flex-col text-xs mt-0.5">
                                        <span className="font-bold text-slate-800">{item.modelo || '-'}</span>
                                        <span style={{ color: currentColor }}>{item.clase || '-'}</span>
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      {item.alreadyHasOrderInMonth ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-amber-50 border border-amber-200 text-amber-800 px-2 py-1 rounded-lg" title="Ya tiene OC registrada este mes. Puedes marcarla para actualizar o reasignar.">
                                          <Check className="w-3 h-3 text-amber-600" />
                                          OC: {item.orderInMonthPo || 'Registrada'}
                                        </span>
                                      ) : item.hadOrderInPrevMonth ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-1 rounded-lg">
                                          <Sparkles className="w-3 h-3 text-emerald-600" />
                                          Cobrada mes anterior
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-bold text-slate-400">Disponible</span>
                                      )}
                                    </td>
                                    <td className="p-3">
                                      <input
                                        type="text"
                                        value={item.pedido_totvs || ""}
                                        onChange={e => handleGridFieldChange(realIdx, 'pedido_totvs', e.target.value)}
                                        placeholder={fichaPedidoTotvs || "Pedido TOTVS"}
                                        className="w-28 px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-red-500 text-xs font-bold placeholder:font-normal placeholder:text-slate-400"
                                      />
                                    </td>
                                    <td className="p-3">
                                      <input
                                        type="number"
                                        value={item.renta_base || ""}
                                        readOnly
                                        className="w-24 px-2 py-1 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 focus:outline-none text-xs font-bold cursor-not-allowed"
                                      />
                                    </td>
                                    <td className="p-3">
                                      <input
                                        type="number"
                                        min="0"
                                        max="30"
                                        value={item.dias_caidos || ""}
                                        onChange={e => handleGridFieldChange(realIdx, 'dias_caidos', e.target.value)}
                                        placeholder="0"
                                        className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-red-500 text-xs font-bold"
                                      />
                                    </td>
                                    <td className="p-3 font-semibold text-slate-500">
                                      ${item.descuento.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-3 font-black text-slate-900 text-sm">
                                      ${item.renta_final.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                          <tfoot className="border-t-2 border-slate-200 bg-slate-50/80">
                            <tr>
                              <td colSpan={8} className="p-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Total a Facturar
                                <span className="text-slate-400 font-medium ml-1">
                                  ({fichaSeriesGrid.filter(i => i.checked).length} equipo{fichaSeriesGrid.filter(i => i.checked).length !== 1 ? 's' : ''})
                                </span>
                              </td>
                              <td className="p-3" />
                              <td className="p-3 font-black text-base" style={{ color: totalAFacturar > 0 ? '#E5222D' : undefined }}>
                                ${totalAFacturar.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0 rounded-b-[2rem]">
                  <button
                    type="button"
                    onClick={resetFichaOcForm}
                    className="px-6 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingFicha}
                    className="px-8 py-3 bg-[#E5222D] hover:bg-[#CC1E28] disabled:opacity-50 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-md shadow-red-200 flex items-center gap-2 animate-pulse-subtle"
                  >
                    <Check className="w-4 h-4" />
                    {isSubmittingFicha ? 'Guardando...' : 'Registrar Ficha'}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* NEW RENTA MODAL */}
      <AnimatePresence>
        {isNewRentaModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseNewRentaModal}
              className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-5xl bg-white rounded-[2rem] shadow-xl z-50 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <form onSubmit={handleCreateRenta} className="flex flex-col h-full overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 text-slate-600 rounded-xl">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900">Nueva Renta</h2>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Crear Contrato</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseNewRentaModal}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                  <div className="space-y-8">
                    {/* SECCIÓN: DATOS GENERALES */}
                    <div>
                      <h3 className="text-sm font-black text-slate-800 border-b-2 border-slate-100 pb-2 mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-500">1</span>
                        Datos Generales
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2 relative">
                          <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Cliente</label>
                          <button
                            type="button"
                            onClick={() => setOpenCliente(!openCliente)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 flex justify-between items-center focus:outline-none focus:border-red-500 hover:border-red-500 transition-colors"
                          >
                            {newRentaFormData.cliente_id
                              ? (clientesDisponibles.find((c: any) => c.id === newRentaFormData.cliente_id)?.razonSocial || clientesDisponibles.find((c: any) => c.id === newRentaFormData.cliente_id)?.razon_social)
                              : "Seleccionar Cliente..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </button>
                          
                          {openCliente && (
                            <div className="absolute top-[100%] mt-2 left-0 w-full z-[9999] bg-white border border-slate-200 shadow-xl rounded-xl p-2 animate-in fade-in zoom-in-95 duration-200">
                              <div className="relative mb-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                  type="text"
                                  placeholder="Buscar cliente..."
                                  value={clienteSearchTerm}
                                  onChange={(e) => setClienteSearchTerm(e.target.value)}
                                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-red-500"
                                />
                              </div>
                              <div className="max-h-[200px] overflow-y-auto space-y-1">
                                {[...filteredClientesDisponibles]
                                  .filter((c: any) => c && (c.razonSocial || c.razon_social || '').toLowerCase().includes((clienteSearchTerm || '').toLowerCase()))
                                  .sort((a, b) => (a.razonSocial || a.razon_social || '').localeCompare(b.razonSocial || b.razon_social || ''))
                                  .map((c: any) => (
                                    <button
                                      key={c.id}
                                      type="button"
                                      onClick={() => {
                                        setNewRentaFormData(prev => ({ ...prev, cliente_id: c.id, cuenta: '', sitio_id: '' }));
                                        setOpenCliente(false);
                                        setClienteSearchTerm('');
                                      }}
                                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors flex items-center justify-between font-medium"
                                    >
                                      <span>{c.razonSocial || c.razon_social}</span>
                                      {newRentaFormData.cliente_id === c.id && <Check className="w-4 h-4 text-red-600" />}
                                    </button>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 relative">
                          <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Cuenta</label>
                          <button
                            type="button"
                            disabled={!newRentaFormData.cliente_id}
                            onClick={() => setOpenCuenta(!openCuenta)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 flex justify-between items-center focus:outline-none focus:border-red-500 hover:border-red-500 transition-colors disabled:opacity-50"
                          >
                            {newRentaFormData.cuenta || "Seleccionar Cuenta..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </button>
                          
                          {openCuenta && (
                            <div className="absolute top-[100%] mt-2 left-0 w-full z-[9999] bg-white border border-slate-200 shadow-xl rounded-xl p-2 animate-in fade-in zoom-in-95 duration-200">
                              <div className="relative mb-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                  type="text"
                                  placeholder="Buscar cuenta..."
                                  value={cuentaSearchTerm}
                                  onChange={(e) => setCuentaSearchTerm(e.target.value)}
                                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-red-500"
                                />
                              </div>
                              <div className="max-h-[200px] overflow-y-auto space-y-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNewRentaFormData(prev => ({ ...prev, cuenta: '', sitio_id: '' }));
                                    setOpenCuenta(false);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 rounded-lg transition-colors flex items-center justify-between font-medium italic"
                                >
                                  <span>Todas las cuentas</span>
                                </button>
                                {cuentasDelCliente
                                  .filter(cuenta => cuenta.toLowerCase().includes((cuentaSearchTerm || '').toLowerCase()))
                                  .map((cuenta: string) => (
                                    <button
                                      key={cuenta}
                                      type="button"
                                      onClick={() => {
                                        setNewRentaFormData(prev => ({ ...prev, cuenta, sitio_id: '' }));
                                        setOpenCuenta(false);
                                        setCuentaSearchTerm('');
                                      }}
                                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors flex items-center justify-between font-medium"
                                    >
                                      <span>{cuenta}</span>
                                      {newRentaFormData.cuenta === cuenta && <Check className="w-4 h-4 text-red-600" />}
                                    </button>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 relative">
                          <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Sitio</label>
                          <button
                            type="button"
                            disabled={!newRentaFormData.cliente_id}
                            onClick={() => setOpenSitio(!openSitio)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 flex justify-between items-center focus:outline-none focus:border-red-500 hover:border-red-500 transition-colors disabled:opacity-50"
                          >
                            {newRentaFormData.sitio_id
                              ? selectedClienteObj?.sitios?.find((s: any) => s.id === newRentaFormData.sitio_id)?.nombre
                              : "Seleccionar Sitio..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </button>
                          
                          {openSitio && (
                            <div className="absolute top-[100%] mt-2 left-0 w-full z-[9999] bg-white border border-slate-200 shadow-xl rounded-xl p-2 animate-in fade-in zoom-in-95 duration-200">
                              <div className="relative mb-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                  type="text"
                                  placeholder="Buscar sitio..."
                                  value={sitioSearchTerm}
                                  onChange={(e) => setSitioSearchTerm(e.target.value)}
                                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-red-500"
                                />
                              </div>
                              <div className="max-h-[200px] overflow-y-auto space-y-1">
                                {[...(clientesDisponibles.find((c: any) => c && c.id === newRentaFormData.cliente_id)?.sitios || [])]
                                  ?.filter((s: any) => {
                                    const matchSearch = s && (s.nombre || '').toLowerCase().includes((sitioSearchTerm || '').toLowerCase());
                                    const matchCuenta = !newRentaFormData.cuenta || s.cuenta === newRentaFormData.cuenta;
                                    return matchSearch && matchCuenta;
                                  })
                                  .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
                                  .map((s: any) => (
                                    <button
                                      key={s.id}
                                      type="button"
                                      onClick={() => {
                                        setNewRentaFormData(prev => ({ ...prev, sitio_id: s.id, cuenta: s.cuenta || prev.cuenta }));
                                        setOpenSitio(false);
                                        setSitioSearchTerm('');
                                      }}
                                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors flex items-center justify-between font-medium"
                                    >
                                      <span>{s.nombre}</span>
                                      {newRentaFormData.sitio_id === s.id && <Check className="w-4 h-4 text-red-600" />}
                                    </button>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* SECCIÓN: CONDICIONES */}
                    <div>
                      <h3 className="text-sm font-black text-slate-800 border-b-2 border-slate-100 pb-2 mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-500">2</span>
                        Condiciones
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div className="space-y-2 relative">
                          <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Tipo de Renta</label>
                          <button
                            type="button"
                            onClick={() => setOpenTipoRenta(!openTipoRenta)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 flex justify-between items-center focus:outline-none focus:border-red-500 hover:border-red-500 transition-colors"
                          >
                            {newRentaFormData.tipo_renta || "Seleccionar Tipo..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </button>
                          
                          {openTipoRenta && (
                            <div className="absolute top-[100%] mt-2 left-0 w-full z-[9999] bg-white border border-slate-200 shadow-xl rounded-xl p-2 animate-in fade-in zoom-in-95 duration-200">
                              <div className="max-h-[200px] overflow-y-auto space-y-1">
                                {['Mensual', 'Bimestral', 'Trimestral', 'Anual'].map((tipo) => (
                                  <button
                                    key={tipo}
                                    type="button"
                                    onClick={() => {
                                      setNewRentaFormData(prev => ({ ...prev, tipo_renta: tipo }));
                                      setOpenTipoRenta(false);
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors flex items-center justify-between font-medium"
                                  >
                                    <span>{tipo}</span>
                                    {newRentaFormData.tipo_renta === tipo && <Check className="w-4 h-4 text-red-600" />}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 relative">
                          <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Moneda</label>
                          <button
                            type="button"
                            onClick={() => setOpenMoneda(!openMoneda)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 flex justify-between items-center focus:outline-none focus:border-red-500 hover:border-red-500 transition-colors"
                          >
                            {newRentaFormData.moneda === 'MXN' ? 'MXN (Pesos Mexicanos)' : 'USD (Dólares)'}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </button>
                          
                          {openMoneda && (
                            <div className="absolute top-[100%] mt-2 left-0 w-full z-[9999] bg-white border border-slate-200 shadow-xl rounded-xl p-2 animate-in fade-in zoom-in-95 duration-200">
                              <div className="space-y-1">
                                {[
                                  { value: 'MXN', label: 'MXN (Pesos Mexicanos)' },
                                  { value: 'USD', label: 'USD (Dólares)' }
                                ].map((opt) => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                      setNewRentaFormData(prev => ({ ...prev, moneda: opt.value }));
                                      setOpenMoneda(false);
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors flex items-center justify-between font-medium"
                                  >
                                    <span>{opt.label}</span>
                                    {newRentaFormData.moneda === opt.value && <Check className="w-4 h-4 text-red-600" />}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Fecha Inicio</label>
                          <input
                            type="date"
                            value={newRentaFormData.fecha_inicio}
                            onChange={e => {
                              const inicio = e.target.value;
                              let fin = newRentaFormData.fecha_fin;
                              if (inicio && newRentaFormData.plazo_meses) {
                                const date = new Date(inicio + 'T00:00:00');
                                const months = parseInt(newRentaFormData.plazo_meses);
                                if (!isNaN(months) && months > 0) {
                                  date.setMonth(date.getMonth() + months);
                                  fin = date.toISOString().split('T')[0];
                                }
                              }
                              setNewRentaFormData({ ...newRentaFormData, fecha_inicio: inicio, fecha_fin: fin });
                            }}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-red-500 transition-colors" required
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Plazo (Meses)</label>
                          <input
                            type="number"
                            min="1"
                            placeholder="Meses de vigencia"
                            value={newRentaFormData.plazo_meses}
                            onChange={e => {
                              const plazo = e.target.value;
                              let fin = newRentaFormData.fecha_fin;
                              if (newRentaFormData.fecha_inicio && plazo) {
                                const date = new Date(newRentaFormData.fecha_inicio + 'T00:00:00');
                                const months = parseInt(plazo);
                                if (!isNaN(months) && months > 0) {
                                  date.setMonth(date.getMonth() + months);
                                  fin = date.toISOString().split('T')[0];
                                }
                              }
                              setNewRentaFormData({ ...newRentaFormData, plazo_meses: plazo, fecha_fin: fin });
                            }}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-red-500 transition-colors"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Fin de Vigencia</label>
                          <input
                            type="date"
                            value={newRentaFormData.fecha_fin}
                            onChange={e => setNewRentaFormData({ ...newRentaFormData, fecha_fin: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-red-500 transition-colors" required
                          />
                        </div>


                      </div>

                      <div className="space-y-2 mb-4 relative">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                            <Search className="w-3.5 h-3.5 text-red-600" />
                            Asignar Equipo (Serie)
                          </label>
                          {newRentaFormData.activo_id && (
                            <button
                              type="button"
                              onClick={() => {
                                setNewRentaFormData(prev => ({ ...prev, activo_id: '', renta_base: '' }));
                              }}
                              className="text-[10px] font-bold text-red-600 hover:underline"
                            >
                              Limpiar equipo
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setOpenEquipo(!openEquipo);
                            setOpenCliente(false);
                            setOpenCuenta(false);
                            setOpenSitio(false);
                          }}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 flex justify-between items-center focus:outline-none focus:border-red-500 hover:border-red-500 transition-colors"
                        >
                          {newRentaFormData.activo_id ? (() => {
                            const eq = equiposDisponibles.find((e) => e.id === newRentaFormData.activo_id);
                            return (
                              <span className="flex items-center gap-2 truncate">
                                <span className="font-black text-slate-900">{eq?.serie}</span>
                                {eq?.modelo && <span className="text-slate-500 font-normal text-xs">({eq.modelo})</span>}
                                {eq?.estatus && (
                                  <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                                    {eq.estatus}
                                  </span>
                                )}
                              </span>
                            );
                          })() : (
                            <span className="text-slate-400 font-medium">Buscar o seleccionar equipo por serie...</span>
                          )}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </button>
                        
                        {newRentaFormData.activo_id && (() => {
                          const eq = equiposDisponibles.find((e) => e.id === newRentaFormData.activo_id);
                          if (eq?.accesorios && eq.accesorios.length > 0) {
                            return (
                              <div className="mt-2 text-xs flex gap-2 flex-wrap animate-in fade-in slide-in-from-top-2 duration-300">
                                {eq.accesorios.map((acc: any) => (
                                  <span key={acc.id} className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md border border-slate-200 flex items-center gap-1 font-bold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block"></span>
                                    {acc.tipo}: {acc.serie}
                                  </span>
                                ))}
                              </div>
                            );
                          }
                          return null;
                        })()}

                        {openEquipo && (
                          <div className="absolute top-[100%] mt-2 left-0 w-full z-[9999] bg-white border border-slate-200 shadow-2xl rounded-2xl p-3 animate-in fade-in zoom-in-95 duration-200">
                            <div className="relative mb-2">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                              <input
                                autoFocus
                                type="text"
                                placeholder="Escribe la serie, modelo o distribuidor..."
                                value={equipoSearchTerm}
                                onChange={(e) => setEquipoSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-red-500 focus:bg-white"
                              />
                            </div>
                            <div className="max-h-[240px] overflow-y-auto space-y-1 custom-scrollbar">
                              {equiposDisponibles
                                .filter((e) => {
                                  const term = (equipoSearchTerm || '').toLowerCase().trim();
                                  if (!term) return true;
                                  return (
                                    (e.serie || '').toLowerCase().includes(term) ||
                                    (e.modelo || '').toLowerCase().includes(term) ||
                                    (e.distribuidor || '').toLowerCase().includes(term) ||
                                    (e.cliente || '').toLowerCase().includes(term)
                                  );
                                })
                                .map((e) => {
                                  const isSelected = newRentaFormData.activo_id === e.id;
                                  const assetPrice = e.renta_precio || 0;
                                  return (
                                    <button
                                      key={e.id}
                                      type="button"
                                      onClick={() => {
                                        setNewRentaFormData((prev) => {
                                          const nextState = {
                                            ...prev,
                                            activo_id: e.id,
                                            renta_base: prev.renta_base || (assetPrice ? assetPrice.toString() : ''),
                                          };
                                          if (!prev.cliente_id && e.cliente_id) {
                                            nextState.cliente_id = e.cliente_id;
                                          }
                                          if (!prev.sitio_id && e.sitio_id) {
                                            nextState.sitio_id = e.sitio_id;
                                          }
                                          if (!prev.cuenta && e.cuenta && e.cuenta !== '-') {
                                            nextState.cuenta = e.cuenta;
                                          }
                                          return nextState;
                                        });
                                        setOpenEquipo(false);
                                        setEquipoSearchTerm('');
                                      }}
                                      className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between text-xs ${
                                        isSelected 
                                          ? 'bg-red-50 text-red-900 border border-red-200 font-bold' 
                                          : 'hover:bg-slate-50 text-slate-800'
                                      }`}
                                    >
                                      <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                                        <div className="flex items-center gap-2">
                                          <span className="font-black text-slate-900 text-sm">{e.serie}</span>
                                          {e.modelo && <span className="text-slate-500 font-medium">({e.modelo})</span>}
                                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                            (e.estatus || '').toLowerCase().includes('inactivo') ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                                          }`}>
                                            {e.estatus || 'Sin estatus'}
                                          </span>
                                        </div>
                                        {(e.cliente && e.cliente !== 'Sin Cliente') && (
                                          <span className="text-[11px] text-slate-400 truncate">
                                            Cliente actual: {e.cliente} {e.site && e.site !== 'Sin Sitio' ? `• ${e.site}` : ''}
                                          </span>
                                        )}
                                      </div>
                                      {isSelected && <Check className="w-4 h-4 text-red-600 shrink-0" />}
                                    </button>
                                  );
                                })}
                              {equiposDisponibles.filter((e) => {
                                const term = (equipoSearchTerm || '').toLowerCase().trim();
                                if (!term) return true;
                                return (
                                  (e.serie || '').toLowerCase().includes(term) ||
                                  (e.modelo || '').toLowerCase().includes(term) ||
                                  (e.distribuidor || '').toLowerCase().includes(term) ||
                                  (e.cliente || '').toLowerCase().includes(term)
                                );
                              }).length === 0 && (
                                <div className="py-6 text-center text-xs text-slate-400 font-medium">
                                  No se encontraron equipos con la serie o modelo especificado.
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Tarifa Renta</label>
                        <input
                          type="number"
                          value={newRentaFormData.renta_base}
                          onChange={e => setNewRentaFormData({ ...newRentaFormData, renta_base: e.target.value })}
                          placeholder="0.00"
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-red-500 transition-colors"
                        />
                      </div>
                    </div>

                    {/* SECCIÓN: ADICIONALES */}
                    <div>
                      <h3 className="text-sm font-black text-slate-800 border-b-2 border-slate-100 pb-2 mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-500">3</span>
                        Adicionales
                      </h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-2 relative">
                            <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Tipo Póliza (SMP)</label>
                            <select
                              value={newRentaFormData.tipo_poliza}
                              onChange={e => setNewRentaFormData({ ...newRentaFormData, tipo_poliza: e.target.value })}
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-red-500 transition-colors"
                            >
                              <option value="CFPM">CFPM</option>
                              <option value="NA">NA</option>
                              <option value="SMP">SMP</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Tarifa Póliza</label>
                            <input
                              type="number"
                              value={newRentaFormData.costo_poliza}
                              onChange={e => setNewRentaFormData({ ...newRentaFormData, costo_poliza: e.target.value })}
                              placeholder="0.00"
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-red-500 transition-colors"
                            />
                          </div>
                          <div className="space-y-2 relative">
                            <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Moneda Póliza</label>
                            <select
                              value={newRentaFormData.moneda_poliza}
                              onChange={e => setNewRentaFormData({ ...newRentaFormData, moneda_poliza: e.target.value })}
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-red-500 transition-colors"
                            >
                              <option value="MXN">MXN</option>
                              <option value="USD">USD</option>
                            </select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Comentarios</label>
                          <textarea
                            rows={3}
                            value={newRentaFormData.comentarios}
                            onChange={e => setNewRentaFormData({ ...newRentaFormData, comentarios: e.target.value })}
                            placeholder="Cláusulas especiales..."
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-red-500 transition-colors resize-none"
                          ></textarea>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={handleCloseNewRentaModal}
                    className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRenta}
                    className="px-6 py-3 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-xl text-sm font-black uppercase tracking-widest transition-all"
                  >
                    Crear Renta
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* EDIT RENTA MODAL */}
      <AnimatePresence>
        {editRentaConfig.isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseEditModal}
              className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-[2rem] shadow-xl z-50 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <form onSubmit={handleEditRentaSubmit} className="flex flex-col h-full overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 text-red-600 rounded-xl">
                      <Pencil className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900">Editar Renta</h2>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseEditModal}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white">
                  <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-800 border-b-2 border-slate-100 pb-2 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-[10px] text-red-600">1</span>
                      Información General
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Orden de Compra / PO Vigente</label>
                        <div className="w-full px-4 py-3 bg-slate-100 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-600">
                          {editRentaConfig.formData.po}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Estado</label>
                        <select
                          value={editRentaConfig.formData.estado}
                          onChange={e => setEditRentaConfig({ ...editRentaConfig, formData: { ...editRentaConfig.formData, estado: e.target.value } })}
                          className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-red-500 transition-colors" required
                        >
                          <option value="Activo">Activo</option>
                          <option value="Inactivo">Inactivo</option>
                          <option value="Back Up">Back Up</option>
                          <option value="Inactivo con Cliente">Inactivo con Cliente</option>
                          <option value="Por Entregar">Por Entregar</option>
                          <option value="Por Retirar">Por Retirar</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-800 border-b-2 border-slate-100 pb-2 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-[10px] text-red-600">2</span>
                      Tarifas y Monedas
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Tarifa Base Renta</label>
                        <input
                          type="number"
                          value={editRentaConfig.formData.renta_base}
                          onChange={e => setEditRentaConfig({ ...editRentaConfig, formData: { ...editRentaConfig.formData, renta_base: e.target.value } })}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-red-500 transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Moneda</label>
                        <select
                          value={editRentaConfig.formData.moneda}
                          onChange={e => setEditRentaConfig({ ...editRentaConfig, formData: { ...editRentaConfig.formData, moneda: e.target.value } })}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-red-500 transition-colors"
                        >
                          <option value="MXN">MXN</option>
                          <option value="USD">USD</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0 rounded-b-[2rem]">
                  <button
                    type="button"
                    onClick={handleCloseEditModal}
                    className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRenta}
                    className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-black uppercase tracking-widest transition-all"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* VIEW RENTA MODAL */}
      <AnimatePresence>
        {viewRentaConfig.isOpen && viewRentaConfig.renta && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewRentaConfig({ ...viewRentaConfig, isOpen: false })}
              className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-5xl bg-white rounded-[2rem] shadow-2xl z-50 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 text-slate-800 rounded-xl">
                    <Eye className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Consulta de Renta / OC</h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewRentaConfig({ ...viewRentaConfig, isOpen: false })}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white scrollbar-thin scrollbar-thumb-slate-200">
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-slate-800 border-b-2 border-slate-100 pb-2 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-800">1</span>
                    Información General
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Cliente</span>
                      <p className="font-bold text-slate-800 text-sm mt-0.5">{viewRentaConfig.renta.cliente?.razonSocial || viewRentaConfig.renta.cliente?.razon_social || '-'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Sitio</span>
                      <p className="font-bold text-slate-800 text-sm mt-0.5">{viewRentaConfig.renta.sitio?.nombre || '-'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Serie / Equipo</span>
                      <p className="font-bold text-slate-800 text-sm mt-0.5 font-mono">{viewRentaConfig.renta.activo?.serie || '-'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Modelo / Clase</span>
                      <p className="font-bold text-slate-800 text-sm mt-0.5">{viewRentaConfig.renta.activo?.modelo || '-'} ({viewRentaConfig.renta.activo?.clase || '-'})</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Cuenta</span>
                      <p className="font-bold text-slate-800 text-sm mt-0.5">{viewRentaConfig.renta.cuenta || '-'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">ADC / Distribuidor</span>
                      <p className="font-bold text-slate-800 text-sm mt-0.5">{viewRentaConfig.renta.adc || '-'} / {viewRentaConfig.renta.distribuidor || '-'}</p>
                    </div>
                  </div>
                  
                  {/* Accesorios Vinculados */}
                  {viewRentaConfig.renta.activo?.accesorios && viewRentaConfig.renta.activo.accesorios.length > 0 && (
                    <div className="mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                      <h4 className="text-xs font-black text-amber-900 uppercase tracking-widest flex items-center gap-2 mb-3">
                        <BatteryCharging className="w-4 h-4 text-amber-600" />
                        Accesorios del Equipo
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {viewRentaConfig.renta.activo.accesorios.map((acc: any) => (
                          <div key={acc.id} className="bg-white p-3 rounded-xl border border-amber-100 shadow-sm flex justify-between items-center">
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{acc.tipo}</p>
                              <p className="text-sm font-black text-slate-800 font-mono mt-0.5">{acc.serie}</p>
                            </div>
                            <span className="text-[10px] px-2 py-1 bg-slate-100 text-slate-600 rounded-md font-bold uppercase">
                              {acc.tipo_relacion}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-black text-slate-800 border-b-2 border-slate-100 pb-2 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-800">2</span>
                    Detalles de Orden de Compra y Cobro
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Orden de Compra / PO</span>
                      <p className="font-bold text-[#E5222D] text-sm mt-0.5">{viewRentaConfig.renta.orden_compra || viewRentaConfig.renta.detalles?.oc_cliente || '-'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Estado de Renta</span>
                      <p className="font-bold text-slate-800 text-sm mt-0.5">{viewRentaConfig.renta.estado || 'VIGENTE'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">No. Registro TOTVS</span>
                      <p className="font-bold text-slate-800 text-sm mt-0.5">
                        {viewRentaConfig.renta.no_registro_totvs || 
                         viewRentaConfig.renta.ordenes?.[0]?.pedido_totvs || 
                         (viewRentaConfig.renta.ordenes?.[0]?.condiciones as any)?.pedido_totvs || 
                         (viewRentaConfig.renta.ordenes?.[0]?.condiciones as any)?.pedido || 
                         (viewRentaConfig.renta.ordenes?.[0]?.condiciones as any)?.pedido_tovts || 
                         (viewRentaConfig.renta.condiciones as any)?.pedido_totvs || 
                         '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Fecha Pedido TOTVS / Mes Cobro</span>
                      <p className="font-bold text-slate-800 text-sm mt-0.5">
                        {(() => {
                          const d = viewRentaConfig.renta.fecha_pedido_totvs || 
                                    viewRentaConfig.renta.ordenes?.[0]?.fecha_pedido_totvs || 
                                    (viewRentaConfig.renta.ordenes?.[0]?.condiciones as any)?.fecha_pedido_totvs || 
                                    (viewRentaConfig.renta.ordenes?.[0]?.condiciones as any)?.fecha_ped;
                          return d ? new Date(d).toLocaleDateString('es-ES') : '-';
                        })()}
                        {viewRentaConfig.renta.detalles?.mes_cobro ? ` (${viewRentaConfig.renta.detalles.mes_cobro})` : ''}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Tarifa Base Renta / Moneda</span>
                      <p className="font-bold text-slate-800 text-sm mt-0.5">
                        ${(viewRentaConfig.renta.detalles?.renta_base || viewRentaConfig.renta.tarifa || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {viewRentaConfig.renta.detalles?.moneda || 'MXN'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Tipo Póliza / Costo</span>
                      <p className="font-bold text-slate-800 text-sm mt-0.5">
                        {viewRentaConfig.renta.condiciones?.tipo_poliza || viewRentaConfig.renta.activo?.tipo_poliza || 'SMP'}
                        {` - $${(viewRentaConfig.renta.condiciones?.costo_poliza_distribuidor || viewRentaConfig.renta.activo?.costo_poliza_distribuidor || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${viewRentaConfig.renta.condiciones?.moneda_pago_distribuidor || 'MXN'}`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-black text-slate-800 border-b-2 border-slate-100 pb-2 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-800">3</span>
                    Documento PDF de Orden de Compra
                  </h3>
                  {viewRentaConfig.loadingDocs ? (
                    <div className="py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Cargando documento...</div>
                  ) : viewRentaConfig.documentos.length === 0 ? (
                    <p className="text-sm font-medium text-slate-500 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center">No hay documentos cargados para esta Orden de Compra.</p>
                  ) : (
                    <div className="space-y-2">
                      {viewRentaConfig.documentos.map(doc => (
                        <div key={doc.id} className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 bg-red-50 text-[#E5222D] rounded-lg shrink-0">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="truncate">
                              <p className="text-sm font-bold text-slate-800 truncate">{doc.nombre_archivo}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">{doc.formato?.toUpperCase()} • {doc.tamano_kb} KB</p>
                            </div>
                          </div>
                          <a
                            href={doc.url_firmada}
                            target="_blank"
                            rel="noreferrer"
                            className="px-4 py-2 bg-[#E5222D] hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm"
                          >
                            Descargar
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-black text-slate-800 border-b-2 border-slate-100 pb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-800 font-bold">4</span>
                      <span>Historial de Pedidos TOTVS y Órdenes Emitidas</span>
                    </div>
                    {viewRentaConfig.renta.ordenes?.length > 0 && (
                      <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg border border-emerald-200">
                        {viewRentaConfig.renta.ordenes.length} pedido{viewRentaConfig.renta.ordenes.length > 1 ? 's' : ''} registrado{viewRentaConfig.renta.ordenes.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </h3>

                  {/* Tabla de Pedidos TOTVS emitidos con Scroll Horizontal y Vertical */}
                  {(() => {
                    const ordenes = (viewRentaConfig.renta.ordenes || []).sort((a: any, b: any) => (b.periodo || '').localeCompare(a.periodo || ''));
                    if (ordenes.length === 0) {
                      return (
                        <div className="p-6 text-center text-sm text-slate-500 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl space-y-1">
                          <p className="font-bold text-slate-700">Sin historial de pedidos TOTVS u órdenes previas.</p>
                          <p className="text-xs text-slate-400">Aún no se han registrado órdenes mensuales para esta renta.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-xs bg-white scrollbar-thin">
                        <table className="w-full text-left text-xs whitespace-nowrap min-w-[500px]">
                          <thead className="bg-slate-50 text-[10px] text-slate-500 font-black uppercase tracking-wider border-b border-slate-100">
                            <tr>
                              <th className="p-3.5">Periodo</th>
                              <th className="p-3.5">Folio OC Cliente</th>
                              <th className="p-3.5">No. Pedido TOTVS</th>
                              <th className="p-3.5">Fecha Pedido TOTVS</th>
                              <th className="p-3.5 text-right">Tarifa Facturada</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                            {ordenes.map((ord: any) => {
                              const cond = ord.condiciones || {};
                              const rawTotvs = ord.pedido_totvs || cond.pedido_totvs || cond.pedido || cond.pedido_tovts || viewRentaConfig.renta.no_registro_totvs || '-';
                              const invalid = ['USD', 'MXN', 'NA', 'N/A', 'NO', '-', 'NULL', 'UNDEFINED'];
                              const noTotvs = invalid.includes(String(rawTotvs).toUpperCase().trim()) ? '-' : rawTotvs;
                              const isPendingNote = String(noTotvs).toUpperCase().includes('PORTAL');
                              const fTotvs = ord.fecha_pedido_totvs || cond.fecha_pedido_totvs || cond.fecha_ped || viewRentaConfig.renta.fecha_pedido_totvs;
                              
                              const [y, m] = (ord.periodo || '').split('-');
                              const months: Record<string, string> = {
                                '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
                                '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
                                '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre'
                              };
                              const formattedPeriod = m && months[m] ? `${months[m]} ${y}` : ord.periodo;

                              return (
                                <tr key={ord.id} className="hover:bg-slate-50/60 transition-colors">
                                  <td className="p-3.5 font-bold text-slate-900">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold">
                                      {formattedPeriod}
                                    </span>
                                  </td>
                                  <td className="p-3.5 font-black text-[#E5222D]">
                                    {ord.po || viewRentaConfig.renta.orden_compra || '-'}
                                  </td>
                                  <td className="p-3.5">
                                    {isPendingNote ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-medium">
                                        {noTotvs}
                                      </span>
                                    ) : noTotvs !== '-' ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                        {noTotvs}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">-</span>
                                    )}
                                  </td>
                                  <td className="p-3.5 text-slate-500">
                                    {(() => {
                                      if (!fTotvs) return '-';
                                      const s = String(fTotvs).trim();
                                      if (['USD', 'MXN', 'NA', 'N/A', 'NO', '-', 'NULL', 'UNDEFINED', 'INVALID DATE'].includes(s.toUpperCase())) return '-';
                                      const d = new Date(fTotvs);
                                      return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
                                    })()}
                                  </td>
                                  <td className="p-3.5 text-right font-black text-slate-900">
                                    ${(Number(ord.tarifa) || Number(viewRentaConfig.renta.detalles?.renta_base) || Number(viewRentaConfig.renta.tarifa) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {
                                      (() => {
                                        const m = String(ord.moneda || viewRentaConfig.renta.detalles?.moneda || 'MXN').trim().toUpperCase();
                                        return ['NA', 'N/A', 'NO', '-'].includes(m) ? 'USD' : m;
                                      })()
                                    }
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}

                  {/* Proyección y Presupuesto por Vigencia */}
                  {(() => {
                    const ordenes = viewRentaConfig.renta.ordenes || [];
                    const fechaInicio = viewRentaConfig.renta.fecha_inicio;
                    const plazoMeses = Number(viewRentaConfig.renta.condiciones?.plazo_meses || viewRentaConfig.renta.plazo_meses) || 0;
                    const tarifaBase = Number(viewRentaConfig.renta.detalles?.renta_base || viewRentaConfig.renta.tarifa || 0);
                    const moneda = viewRentaConfig.renta.detalles?.moneda || 'MXN';
                    
                    let projection: string[] = [];
                    if (fechaInicio && plazoMeses > 0) {
                      const [y, m, d] = fechaInicio.split('T')[0].split('-');
                      const startDate = new Date(Number(y), Number(m) - 1, Number(d));
                      for(let i = 0; i < plazoMeses; i++) {
                        const mDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
                        const periodStr = `${mDate.getFullYear()}-${String(mDate.getMonth() + 1).padStart(2, '0')}`;
                        projection.push(periodStr);
                      }
                    } else {
                       projection = Array.from(new Set(ordenes.map((o:any) => o.periodo))).filter(Boolean) as string[];
                       projection.sort();
                    }
                    
                    if (projection.length === 0) return null;

                    const yearsMap = new Map();
                    let totalVigencia = 0;

                    projection.forEach((periodoStr) => {
                      const year = periodoStr.split('-')[0];
                      const ordenUpload = ordenes.find((o:any) => o.periodo === periodoStr);
                      
                      const amount = ordenUpload && ordenUpload.tarifa ? Number(ordenUpload.tarifa) : tarifaBase;
                      totalVigencia += amount;
                      
                      if (!yearsMap.has(year)) {
                        yearsMap.set(year, {
                          total: 0,
                          months: []
                        });
                      }
                      const yearData = yearsMap.get(year);
                      yearData.total += amount;
                      yearData.months.push({
                        periodo: periodoStr,
                        tarifa: amount,
                        moneda: ordenUpload ? (ordenUpload.moneda || moneda) : moneda,
                        hasOc: !!ordenUpload,
                        ocNumber: ordenUpload?.po || '-'
                      });
                    });

                    const sortedYears = Array.from(yearsMap.keys()).sort((a, b) => b.localeCompare(a));

                    return (
                      <div className="space-y-3 pt-2">
                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center justify-between">
                          <span className="text-xs font-black text-slate-700 uppercase tracking-widest">Presupuesto Proyectado Vigencia ({plazoMeses || projection.length} meses)</span>
                          <span className="text-base font-black text-slate-900">${totalVigencia.toLocaleString(undefined, { minimumFractionDigits: 2 })} {moneda}</span>
                        </div>
                        
                        <div className="space-y-3">
                          {sortedYears.map((year: string) => {
                            const yData = yearsMap.get(year);
                            const sortedMonths = [...yData.months].sort((a: any, b: any) => b.periodo.localeCompare(a.periodo));
                            return (
                              <div key={year} className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                                <div className="bg-slate-100/70 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                                  <span className="text-xs font-black text-slate-800">{year}</span>
                                  <span className="text-xs font-bold text-slate-600">
                                    Subtotal: ${yData.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                                <div className="divide-y divide-slate-100">
                                  {sortedMonths.map((m: any, idx: number) => (
                                    <div key={`${m.periodo}-${idx}`} className="px-4 py-2.5 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors text-xs">
                                      <div className="flex items-center gap-3">
                                        <span className="font-bold text-slate-800">{m.periodo}</span>
                                        {m.hasOc ? (
                                          <span className="text-[9px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded uppercase">OC: {m.ocNumber}</span>
                                        ) : (
                                          <span className="text-[9px] bg-slate-100 text-slate-500 font-medium px-2 py-0.5 rounded uppercase">Sin OC</span>
                                        )}
                                      </div>
                                      <div className="font-bold text-slate-700">
                                        ${m.tarifa.toLocaleString(undefined, { minimumFractionDigits: 2 })} {m.moneda}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0 rounded-b-[2rem]">
                <button
                  type="button"
                  onClick={() => setViewRentaConfig({ ...viewRentaConfig, isOpen: false })}
                  className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-black uppercase tracking-widest transition-all"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modal Confirmación de Eliminación de Renta */}
      <AnimatePresence>
        {deleteRentaModal.isOpen && deleteRentaModal.renta && (
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
                  Eliminar Renta
                </h3>
                <button 
                  onClick={() => setDeleteRentaModal({ isOpen: false, renta: null, isDeleting: false })} 
                  className="p-1.5 hover:bg-red-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-3 font-medium text-sm text-slate-600">
                <p>
                  ¿Estás seguro de que deseas eliminar permanentemente la renta de la serie <strong className="font-bold text-slate-900">{deleteRentaModal.renta.activo?.serie || deleteRentaModal.renta.id}</strong>?
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1 text-slate-700">
                  <div><strong>Cliente:</strong> {deleteRentaModal.renta.cliente?.razon_social || '-'}</div>
                  <div><strong>Sitio:</strong> {deleteRentaModal.renta.sitio?.nombre || '-'}</div>
                  <div><strong>Cuenta:</strong> {deleteRentaModal.renta.cuenta || '-'}</div>
                  <div><strong>Tarifa:</strong> ${Number(deleteRentaModal.renta.detalles?.renta_base || deleteRentaModal.renta.tarifa || 0).toLocaleString()} {deleteRentaModal.renta.detalles?.moneda || 'MXN'}</div>
                </div>
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 font-medium">
                  ⚠️ Esta acción eliminará la renta y sus órdenes mensuales asociadas. Esta acción no se puede deshacer.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50/50">
                <button 
                  type="button"
                  disabled={deleteRentaModal.isDeleting}
                  onClick={() => setDeleteRentaModal({ isOpen: false, renta: null, isDeleting: false })} 
                  className="px-5 py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  disabled={deleteRentaModal.isDeleting}
                  onClick={handleConfirmDeleteRenta} 
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-red-100 transition-colors cursor-pointer"
                >
                  {deleteRentaModal.isDeleting ? 'Eliminando...' : 'Sí, Eliminar Renta'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Copiar Mes Anterior Modal */}
      <CopiarMesAnteriorModal
        isOpen={isCopyModalOpen}
        onClose={() => setIsCopyModalOpen(false)}
        onSuccess={() => {
          fetchRentasYClientes();
          toast.success('Órdenes replicadas correctamente');
        }}
        currentPeriod={new Date().toISOString().slice(0, 7)}
        currentColor={currentColor}
      />
    </div>
  );
}
