"use client";

import { 
  Search, Receipt, Calendar, CalendarDays, Plus, Filter, Download, X, Pencil, Check, ChevronsUpDown, FileText, Building2, MapPin, Truck, FileSpreadsheet, Eye, BatteryCharging, FilePlus
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useState, useEffect, Fragment, useRef } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth.store";
import { useConfigStore } from "@/store/config.store";
import { motion, AnimatePresence } from "motion/react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

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

export default function RentasTab() {
  const { user } = useAuthStore();
  let rawRole: any = user?.role;
  if (Array.isArray(rawRole)) rawRole = rawRole[0]?.name || rawRole[0]?.rol || rawRole[0];
  if (typeof rawRole === 'object' && rawRole !== null) rawRole = rawRole?.name || rawRole?.rol;
  const userRole = String(rawRole || 'administrador').toLowerCase();
  
  const isAdc = userRole !== 'administrador' && !userRole.includes('geren') && !userRole.includes('coordinaci');
  const loggedInAdcName = user 
    ? (userRole === 'auxiliar' || userRole.includes('auxiliar'))
      ? (user.adc_asociado_name || '')
      : `${user.firstName} ${user.lastName || ''}`.trim()
    : '';

  const { roleColors } = useConfigStore();
  const currentColor = user?.role ? (roleColors[user.role.toLowerCase()] || roleColors.administrador) : roleColors.administrador;

  const [rentas, setRentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isNewRentaModalOpen, setIsNewRentaModalOpen] = useState(false);

  // Registro OC Modal State
  const [isFichaOcModalOpen, setIsFichaOcModalOpen] = useState(false);
  const [selectedFichaClienteId, setSelectedFichaClienteId] = useState("");
  const [selectedFichaSitioId, setSelectedFichaSitioId] = useState("");
  const [fichaFolioOc, setFichaFolioOc] = useState("");
  const [fichaPedidoTotvs, setFichaPedidoTotvs] = useState("");
  const [fichaFechaTotvs, setFichaFechaTotvs] = useState("");
  const [fichaMesCobro, setFichaMesCobro] = useState("");
  const [fichaPdfFile, setFichaPdfFile] = useState<File | null>(null);
  const [isFichaDragging, setIsFichaDragging] = useState(false);
  const [fichaSeriesGrid, setFichaSeriesGrid] = useState<any[]>([]); // Array of { assetId, serie, modelo, clase, checked, renta_base, dias_caidos, descuento, renta_final }
  const [isSubmittingFicha, setIsSubmittingFicha] = useState(false);

  const [openFichaCliente, setOpenFichaCliente] = useState(false);
  const [openFichaSitio, setOpenFichaSitio] = useState(false);
  const [openFichaCuenta, setOpenFichaCuenta] = useState(false);
  const [selectedFichaCuenta, setSelectedFichaCuenta] = useState("");
  const [fichaCuentaSearchTerm, setFichaCuentaSearchTerm] = useState('');

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

  // Filter States (Multi-select)
  const [selectedFilterCuenta, setSelectedFilterCuenta] = useState<string[]>([]);
  const [selectedFilterSitio, setSelectedFilterSitio] = useState<string[]>([]);
  const [selectedFilterClase, setSelectedFilterClase] = useState<string[]>([]);
  const [selectedFilterModelo, setSelectedFilterModelo] = useState<string[]>([]);
  const [selectedFilterDistribuidor, setSelectedFilterDistribuidor] = useState<string[]>([]);
  const [selectedFilterEquipo, setSelectedFilterEquipo] = useState<string[]>([]);
  const [selectedFilterMoneda, setSelectedFilterMoneda] = useState<string[]>([]);
  const [selectedFilterPoliza, setSelectedFilterPoliza] = useState<string[]>([]);
  const [selectedFilterPropietario, setSelectedFilterPropietario] = useState<string[]>([]);

  // Combobox open states
  const [openFilterCuenta, setOpenFilterCuenta] = useState(false);
  const [openFilterSitio, setOpenFilterSitio] = useState(false);
  const [openFilterClase, setOpenFilterClase] = useState(false);
  const [openFilterModelo, setOpenFilterModelo] = useState(false);
  const [openFilterDistribuidor, setOpenFilterDistribuidor] = useState(false);
  const [openFilterEquipo, setOpenFilterEquipo] = useState(false);
  const [openFilterMoneda, setOpenFilterMoneda] = useState(false);
  const [openFilterPoliza, setOpenFilterPoliza] = useState(false);
  const [openFilterPropietario, setOpenFilterPropietario] = useState(false);

  // Combobox search states
  const [searchCuenta, setSearchCuenta] = useState("");
  const [searchSitio, setSearchSitio] = useState("");
  const [searchClase, setSearchClase] = useState("");
  const [searchModelo, setSearchModelo] = useState("");
  const [searchDistribuidor, setSearchDistribuidor] = useState("");
  const [searchEquipo, setSearchEquipo] = useState("");
  const [searchMoneda, setSearchMoneda] = useState("");
  const [searchPoliza, setSearchPoliza] = useState("");
  const [searchPropietario, setSearchPropietario] = useState("");

  // VIEW MODAL STATE
  const [viewRentaConfig, setViewRentaConfig] = useState({
    isOpen: false,
    renta: null as any,
    documentos: [] as any[],
    loadingDocs: false,
  });

  // REGISTER OC STATE
  const [registerOcConfig, setRegisterOcConfig] = useState<{
    isOpen: boolean; renta: any; periodo: string; po: string; isSubmitting: boolean; pdfFile: File | null; isDragging: boolean;
  }>({
    isOpen: false,
    renta: null as any,
    periodo: '',
    po: '',
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
        po: registerOcConfig.po
      });

      // Upload PDF
      const fileData = new FormData();
      fileData.append('file', registerOcConfig.pdfFile);
      await api.post(`/r4/rentas/${registerOcConfig.renta.id}/documentos`, fileData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success('Orden de compra registrada con éxito');
      setRegisterOcConfig({ isOpen: false, renta: null, periodo: '', po: '', isSubmitting: false, pdfFile: null, isDragging: false });
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
        const adcLower = c.adc?.toLowerCase() || '';
        const userLower = loggedInAdcName.toLowerCase();
        return adcLower === userLower || userLower.includes(adcLower) || adcLower.includes(user?.firstName?.toLowerCase() || '');
      })
    : clientesDisponibles;

  const selectedClienteObj = clientesDisponibles.find((c: any) => c.id === newRentaFormData.cliente_id);

  const cuentasDelCliente = Array.from(new Set<string>(
    (selectedClienteObj?.sitios || [])
      .map((s: any) => s.cuenta)
      .filter((v: any): v is string => !!v)
  )).sort((a: string, b: string) => a.localeCompare(b));

  const openEditModal = (renta: any) => {
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
  const itemsPerPage = 15;

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
      const siteAssets = equiposDisponibles.filter(e => e.sitio_id === newRentaFormData.sitio_id);
      if (siteAssets.length === 1 && newRentaFormData.activo_id !== siteAssets[0].id) {
        setNewRentaFormData(prev => ({ ...prev, activo_id: siteAssets[0].id }));
      }
    }
  }, [isNewRentaModalOpen, newRentaFormData.sitio_id, equiposDisponibles, newRentaFormData.activo_id]);

  // Filter series based on selected site in Ficha OC
  useEffect(() => {
    if (!selectedFichaSitioId) {
      setFichaSeriesGrid([]);
      return;
    }

    // Find all assets assigned to this site
    const siteAssets = equiposDisponibles.filter(e => e.sitio_id === selectedFichaSitioId);
    
    const gridData = siteAssets.map(asset => {
      // Find if this asset has an active renta
      const activeRenta = rentas.find(r => r.activo?.id === asset.id && r.estado !== 'CANCELADA');
      const basePrice = activeRenta?.detalles?.renta_base || activeRenta?.tarifa || 0;
      
      return {
        assetId: asset.id,
        serie: asset.serie,
        modelo: asset.modelo || '-',
        clase: asset.clase || '-',
        checked: siteAssets.length === 1 ? true : false,
        renta_base: basePrice,
        dias_caidos: 0,
        descuento: 0,
        renta_final: basePrice,
        existingRenta: activeRenta || null
      };
    });

    setFichaSeriesGrid(gridData);
  }, [selectedFichaSitioId, equiposDisponibles, rentas]);

  // Recalculate discount when pricing or dias caidos change
  const handleGridFieldChange = (index: number, field: 'checked' | 'renta_base' | 'dias_caidos', value: any) => {
    const updated = [...fichaSeriesGrid];
    const item = { ...updated[index] };
    
    if (field === 'checked') {
      item.checked = value;
    } else if (field === 'renta_base') {
      item.renta_base = Number(value) || 0;
    } else if (field === 'dias_caidos') {
      item.dias_caidos = Number(value) || 0;
    }

    // discount = (base / 30) * dias_caidos
    const calculatedDiscount = (item.renta_base / 30) * item.dias_caidos;
    item.descuento = Math.round(calculatedDiscount * 100) / 100;
    item.renta_final = Math.max(0, Math.round((item.renta_base - item.descuento) * 100) / 100);

    updated[index] = item;
    setFichaSeriesGrid(updated);
  };

  // Select-all toggle for OC equipment table
  const allSeriesChecked = fichaSeriesGrid.length > 0 && fichaSeriesGrid.every(i => i.checked);
  const someSeriesChecked = fichaSeriesGrid.some(i => i.checked) && !allSeriesChecked;
  const handleSelectAllSeries = () => {
    setFichaSeriesGrid(prev => prev.map(i => ({ ...i, checked: !allSeriesChecked })));
  };

  // Total a Facturar — suma de renta_final de equipos seleccionados
  const totalAFacturar = fichaSeriesGrid
    .filter(i => i.checked)
    .reduce((sum, i) => sum + i.renta_final, 0);

  // Reset OC form helper — called on close, cancel, or backdrop click
  const resetFichaOcForm = () => {
    setSelectedFichaClienteId("");
    setSelectedFichaSitioId("");
    setFichaFolioOc("");
    setFichaPedidoTotvs("");
    setFichaFechaTotvs("");
    setFichaMesCobro("");
    setFichaPdfFile(null);
    setIsFichaDragging(false);
    setIsFichaOcModalOpen(false);
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
      toast.info("Procesando registro de OC simplificada...");

      for (const item of selectedItems) {
        let rentaId = '';
        
        if (item.existingRenta) {
          rentaId = item.existingRenta.id;
          // Update existing renta
          await api.patch(`/r4/rentas/${rentaId}`, {
            no_registro_totvs: fichaPedidoTotvs || undefined,
            fecha_pedido_totvs: fichaFechaTotvs || undefined,
          });

          await api.patch(`/r4/rentas/${rentaId}/detalles`, {
            oc_cliente: fichaFolioOc,
            mes_cobro: fichaMesCobro || undefined,
            descuento_dias_caidos: item.descuento,
            renta_base: item.renta_base,
            renta_real: item.renta_final
          });
        } else {
          // Create new renta
          const payload = {
            cliente_id: selectedFichaClienteId,
            sitio_id: selectedFichaSitioId,
            activo_id: item.assetId,
            fecha_inicio: new Date().toISOString().split('T')[0], // Default today
            fecha_fin: new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0], // Default 1 year
            no_registro_totvs: fichaPedidoTotvs || undefined,
            fecha_pedido_totvs: fichaFechaTotvs || undefined,
            detalles: {
              oc_cliente: fichaFolioOc,
              mes_cobro: fichaMesCobro || undefined,
              descuento_dias_caidos: item.descuento,
              renta_base: item.renta_base,
              renta_real: item.renta_final,
              moneda: 'MXN'
            }
          };

          const createRes = await api.post('/r4/rentas', payload);
          rentaId = createRes.data?.data?.id || createRes.data?.id;
        }

        // Upload PDF if loaded
        if (fichaPdfFile && rentaId) {
          const fileData = new FormData();
          fileData.append('file', fichaPdfFile);
          await api.post(`/r4/rentas/${rentaId}/documentos`, fileData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
        }
      }

      toast.success("Registro OC guardada con éxito.");
      setIsFichaOcModalOpen(false);
      // Clean form
      setSelectedFichaClienteId("");
      setSelectedFichaSitioId("");
      setFichaFolioOc("");
      setFichaPedidoTotvs("");
      setFichaFechaTotvs("");
      setFichaMesCobro("");
      setFichaPdfFile(null);
      setIsFichaDragging(false);
      fetchRentasYClientes();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || "Error al registrar la Ficha de OC.");
    } finally {
      setIsSubmittingFicha(false);
    }
  };

  // ADC Visual Filtering Logic
  const baseRentas = isAdc
    ? rentas.filter(r => {
        const adcLower = r.adc?.toLowerCase() || '';
        const userLower = loggedInAdcName.toLowerCase();
        return adcLower === userLower || userLower.includes(adcLower) || adcLower.includes(user?.firstName?.toLowerCase() || '');
      })
    : rentas;

  const filterUniqueCuentas = Array.from(new Set(baseRentas.map(r => r.cuenta).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  const filterUniqueSitios = Array.from(new Set(baseRentas.map(r => r.sitio?.nombre).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  const filterUniqueClases = Array.from(new Set(baseRentas.map(r => r.activo?.clase).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  const filterUniqueModelos = Array.from(new Set(baseRentas.map(r => r.activo?.modelo).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  const filterUniqueDistribuidores = Array.from(new Set(baseRentas.map(r => r.distribuidor || r.activo?.distribuidor).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  const filterUniquePropietarios = Array.from(new Set(baseRentas.map(r => r.propietario || r.activo?.propietario).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));

  const isMatchFilter = (filterVals: string[], valToTest: any) => {
    if (!filterVals || filterVals.length === 0 || filterVals.includes('Todos')) return true;
    return filterVals.includes(valToTest);
  };

  const filteredRentas = baseRentas.filter((renta: any) => {
    const cond = renta.condiciones || {};
    const detalles = renta.detalles || {};
    const matchesSearch = !searchTerm ? true : (
      renta.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      renta.cliente?.razonSocial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      renta.cliente?.razon_social?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      renta.activo?.serie?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      renta.orden_compra?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      renta.detalles?.oc_cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (renta.propietario || renta.activo?.propietario)?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const matchesCuenta = isMatchFilter(selectedFilterCuenta, renta.cuenta);
    const matchesSitio = isMatchFilter(selectedFilterSitio, renta.sitio?.nombre);
    const matchesClase = isMatchFilter(selectedFilterClase, renta.activo?.clase);
    const matchesModelo = isMatchFilter(selectedFilterModelo, renta.activo?.modelo);
    const matchesDistribuidor = isMatchFilter(selectedFilterDistribuidor, renta.distribuidor || renta.activo?.distribuidor);
    const tipoEq = renta.activo?.clase?.includes('III') ? 'Patín' : 'Montacargas';
    const matchesEquipo = isMatchFilter(selectedFilterEquipo, tipoEq);
    const matchesMoneda = isMatchFilter(selectedFilterMoneda, detalles.moneda || 'MXN');
    const matchesPoliza = isMatchFilter(selectedFilterPoliza, cond.tipo_poliza || renta.activo?.tipo_poliza || 'SMP');
    const matchesPropietario = isMatchFilter(selectedFilterPropietario, renta.propietario || renta.activo?.propietario);

    return matchesSearch && matchesCuenta && matchesSitio && matchesClase && matchesModelo && matchesDistribuidor && matchesEquipo && matchesMoneda && matchesPoliza && matchesPropietario;
  });

  const totalRentas = filteredRentas.length;
  const activas = filteredRentas.filter(r => {
    const estadoRenta = r.estado?.toUpperCase() || '';
    const estadoActivo = r.activo?.estatus?.toUpperCase() || '';
    
    // Ignore inactivos
    if (estadoRenta.includes('INACTIV') || estadoActivo.includes('INACTIV')) return false;

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
    
    // Ignore inactivos
    if (estadoRenta.includes('INACTIV') || estadoActivo.includes('INACTIV')) return false;
    
    return fechaFin > hoy && fechaFin <= en30Dias && estadoRenta !== 'CANCELADA';
  }).length;

  // Apply pagination
  const totalItems = filteredRentas.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  
  const importeMXN = filteredRentas.reduce((sum, r) => {
    const estadoRenta = r.estado?.toUpperCase() || '';
    const estadoActivo = r.activo?.estatus?.toUpperCase() || '';
    if (estadoRenta.includes('INACTIV') || estadoActivo.includes('INACTIV')) return sum;
    
    const isUSD = (r.detalles?.moneda || 'MXN') === 'USD';
    return isUSD ? sum : sum + (r.detalles?.renta_base || r.tarifa || 0);
  }, 0);
  
  const importeUSD = filteredRentas.reduce((sum, r) => {
    const estadoRenta = r.estado?.toUpperCase() || '';
    const estadoActivo = r.activo?.estatus?.toUpperCase() || '';
    if (estadoRenta.includes('INACTIV') || estadoActivo.includes('INACTIV')) return sum;
    
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
  const adcBudgetMap = new Map();
  const clientBudgetMap = new Map();
  
  filteredRentas.forEach(r => {
    const estadoRenta = r.estado?.toUpperCase() || '';
    const estadoActivo = r.activo?.estatus?.toUpperCase() || '';
    if (estadoRenta.includes('INACTIV') || estadoActivo.includes('INACTIV')) return;
    
    // Normalize budget to a single currency for graphing (e.g. MXN, roughly USD * 20)
    let amount = Number(r.detalles?.renta_base || r.tarifa || 0);
    if ((r.detalles?.moneda || 'MXN') === 'USD') amount *= 20; // approximate conversion for visual distribution only

    const adc = r.adc || r.cliente?.datos_comerciales?.adc || 'Sin ADC';
    const client = r.cliente?.razonSocial || r.cliente?.razon_social || 'Sin Cliente';
    
    adcBudgetMap.set(adc, (adcBudgetMap.get(adc) || 0) + amount);
    clientBudgetMap.set(client, (clientBudgetMap.get(client) || 0) + amount);
  });
  
  const adcChartData = Array.from(adcBudgetMap.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);
    
  const clientChartData = Array.from(clientBudgetMap.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5); // Top 5 clients
    
  const PIE_COLORS = ['#E5222D', '#334155', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

  return (
    <div className="min-h-screen bg-[#F9FAFB] p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="flex flex-col -gap-1">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] mb-1" style={{ color: currentColor }}>RAYMOND</span>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Gestión de Rentas</h1>
          <p className="text-slate-500 font-medium mt-1">Administración de contratos de renta, vigencias y asignación de activos</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportRentasToCSV}
            className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-sm transition-all shadow-md hover:bg-slate-50 flex items-center gap-2 uppercase tracking-widest shrink-0"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
          <button
            onClick={() => setIsFichaOcModalOpen(true)}
            className="px-6 py-3 text-white rounded-2xl font-bold text-xs transition-all shadow-md hover:opacity-90 flex items-center gap-2 uppercase tracking-widest shrink-0 whitespace-nowrap"
            style={{ backgroundColor: currentColor, boxShadow: `0 4px 14px 0 ${currentColor}40` }}
          >
            <FileText className="w-4 h-4" />
            Registro OC
          </button>
          <div className="relative group hidden lg:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-red-500 transition-colors" />
            <input
              type="text"
              placeholder="Buscar por cliente, serie..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-48 pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:border-red-500 focus:outline-none transition-all shadow-md"
            />
          </div>
          {(selectedFilterCuenta.length > 0 || selectedFilterSitio.length > 0 || selectedFilterClase.length > 0 || selectedFilterModelo.length > 0 || selectedFilterDistribuidor.length > 0 || selectedFilterPropietario.length > 0 || selectedFilterEquipo.length > 0 || selectedFilterMoneda.length > 0 || selectedFilterPoliza.length > 0) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedFilterCuenta([]);
                setSelectedFilterSitio([]);
                setSelectedFilterClase([]);
                setSelectedFilterModelo([]);
                setSelectedFilterDistribuidor([]);
                setSelectedFilterPropietario([]);
                setSelectedFilterEquipo([]);
                setSelectedFilterMoneda([]);
                setSelectedFilterPoliza([]);
                setCurrentPage(1);
              }}
              className="px-3 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl border-2 border-red-200 flex items-center justify-center transition-colors font-bold shadow-md shrink-0"
              title="Limpiar filtros"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setIsNewRentaModalOpen(true)}
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-xs transition-all shadow-md shadow-slate-900/20 flex items-center gap-2 uppercase tracking-widest shrink-0 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Nueva Renta
          </button>
        </div>
      </div>

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
          <p className="text-blue-600 text-[10px] font-black uppercase tracking-widest mb-2 line-clamp-1">Importe de Pedidos</p>
          {importeMXN > 0 && <h3 className="text-xl font-black text-slate-900">${importeMXN.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} MXN</h3>}
          {importeUSD > 0 && <h3 className="text-xl font-black text-slate-900">${importeUSD.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} USD</h3>}
          {importeMXN === 0 && importeUSD === 0 && <h3 className="text-xl font-black text-slate-900">$0.00</h3>}
        </div>
      </div>
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6">Presupuesto por ADC</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={adcChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`} />
                <Tooltip 
                  cursor={{ fill: '#f1f5f9' }} 
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 700, fontSize: '12px' }}
                  formatter={(val: number) => [`$${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 'Importe (MXN Eq.)']}
                />
                <Bar dataKey="total" fill={currentColor} radius={[6, 6, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6">Top 5 Clientes (Distribución)</h3>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={clientChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="total"
                  stroke="none"
                >
                  {clientChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 700, fontSize: '12px' }}
                  formatter={(val: number) => [`$${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 'Importe (MXN Eq.)']}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* SEARCH FOR MOBILE ONLY */}
      <div className="lg:hidden relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-red-500 transition-colors" />
        <input
          type="text"
          placeholder="Buscar por cliente, serie, folio OC..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-xs font-bold focus:border-red-500 focus:outline-none transition-all shadow-sm"
        />
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
                  <th className="px-4 py-4 font-black">Ejecutivo (ADC)</th>
                )}
                <th className="px-4 py-4">
                  <TableHeaderFilter label="Equipo" title="TIPO" value={selectedFilterEquipo} onChange={(val) => { setSelectedFilterEquipo(val); setCurrentPage(1); }} options={['Montacargas', 'Patín']} open={openFilterEquipo} setOpen={setOpenFilterEquipo} search={searchEquipo} setSearch={setSearchEquipo} currentColor={currentColor} />
                </th>
                <th className="px-4 py-4">
                  <TableHeaderFilter label="Clase" title="CLASE" value={selectedFilterClase} onChange={(val) => { setSelectedFilterClase(val); setCurrentPage(1); }} options={filterUniqueClases} open={openFilterClase} setOpen={setOpenFilterClase} search={searchClase} setSearch={setSearchClase} currentColor={currentColor} />
                </th>
                <th className="px-4 py-4">
                  <TableHeaderFilter label="Modelo" title="MODELO" value={selectedFilterModelo} onChange={(val) => { setSelectedFilterModelo(val); setCurrentPage(1); }} options={filterUniqueModelos} open={openFilterModelo} setOpen={setOpenFilterModelo} search={searchModelo} setSearch={setSearchModelo} currentColor={currentColor} />
                </th>
                <th className="px-4 py-4 font-black">Serie</th>
                <th className="px-4 py-4 font-black">Estatus Equipo</th>
                <th className="px-4 py-4 font-black">OACH</th>
                <th className="px-4 py-4 font-black">Altura</th>
                <th className="px-4 py-4 font-black">BC</th>
                <th className="px-4 py-4 font-black">Folio OC</th>
                <th className="px-4 py-4 font-black">F. Entregado</th>
                <th className="px-4 py-4 font-black">Plazo (meses)</th>
                <th className="px-4 py-4 font-black">F. Vencimiento</th>
                <th className="px-4 py-4">
                  <TableHeaderFilter label="Propietario" title="PROPIETARIO" value={selectedFilterPropietario} onChange={(val) => { setSelectedFilterPropietario(val); setCurrentPage(1); }} options={filterUniquePropietarios} open={openFilterPropietario} setOpen={setOpenFilterPropietario} search={searchPropietario} setSearch={setSearchPropietario} currentColor={currentColor} />
                </th>
                <th className="px-4 py-4 font-black text-right">Precio Renta</th>
                <th className="px-4 py-4">
                  <TableHeaderFilter label="Moneda" title="MONEDA" value={selectedFilterMoneda} onChange={(val) => { setSelectedFilterMoneda(val); setCurrentPage(1); }} options={['MXN', 'USD']} open={openFilterMoneda} setOpen={setOpenFilterMoneda} search={searchMoneda} setSearch={setSearchMoneda} currentColor={currentColor} />
                </th>
                <th className="px-4 py-4">
                  <TableHeaderFilter label="Póliza" title="PÓLIZA" value={selectedFilterPoliza} onChange={(val) => { setSelectedFilterPoliza(val); setCurrentPage(1); }} options={['CFPM', 'NA', 'SMP']} open={openFilterPoliza} setOpen={setOpenFilterPoliza} search={searchPoliza} setSearch={setSearchPoliza} currentColor={currentColor} />
                </th>
                <th className="px-4 py-4">
                  <TableHeaderFilter label="Distribuidor" title="DISTRIBUIDOR" value={selectedFilterDistribuidor} onChange={(val) => { setSelectedFilterDistribuidor(val); setCurrentPage(1); }} options={filterUniqueDistribuidores} open={openFilterDistribuidor} setOpen={setOpenFilterDistribuidor} search={searchDistribuidor} setSearch={setSearchDistribuidor} currentColor={currentColor} />
                </th>
                <th className="px-4 py-4 font-black text-right">Costo Póliza</th>
                <th className="px-4 py-4 font-black">Moneda Pago</th>
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
                        <td className="px-4 py-3.5 font-bold text-[#E5222D]">
                          {renta.orden_compra || detalles.oc_cliente || '-'}
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
                                setRegisterOcConfig(prev => ({
                                  ...prev,
                                  isOpen: true,
                                  renta,
                                  periodo: '',
                                  po: '',
                                  isSubmitting: false,
                                  pdfFile: null,
                                  isDragging: false
                                }));
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
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 rounded-b-[2rem]">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Página {currentPage} de {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors uppercase tracking-widest"
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors uppercase tracking-widest"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* REGISTER OC MANUAL MODAL */}
      <AnimatePresence>
        {registerOcConfig.isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRegisterOcConfig(prev => ({ ...prev, isOpen: false, renta: null, periodo: '', po: '', isSubmitting: false, pdfFile: null, isDragging: false }))}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-[2rem] shadow-2xl z-50 overflow-hidden flex flex-col"
            >
              <form onSubmit={handleRegisterOc} className="flex flex-col h-full">
                <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
                    <FilePlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Registrar OC</h2>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Generar orden mensual rápida</p>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Renta Seleccionada</div>
                    <div className="text-sm font-bold text-slate-700">{registerOcConfig.renta?.cuenta} - {registerOcConfig.renta?.activo?.serie}</div>
                  </div>

                  <div>
                    <label className="text-xs font-black text-slate-800 uppercase tracking-widest block mb-2">
                      Período (YYYY-MM)
                    </label>
                    <input
                      type="month"
                      required
                      placeholder="Ej. 2026-05"
                      value={registerOcConfig.periodo}
                      onChange={e => setRegisterOcConfig(prev => ({ ...prev, periodo: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold focus:border-amber-500 focus:outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black text-slate-800 uppercase tracking-widest block mb-2">
                      Folio PO (Orden de Compra)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ingresa el folio de la OC"
                      value={registerOcConfig.po}
                      onChange={e => setRegisterOcConfig(prev => ({ ...prev, po: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold focus:border-amber-500 focus:outline-none transition-all"
                    />
                  </div>

                  {/* PDF Upload */}
                  <div>
                    <label className="text-xs font-black text-slate-800 uppercase tracking-widest block mb-2">
                      Cargar PDF de la OC del Cliente <span className="text-red-500">*</span>
                    </label>
                    {registerOcConfig.pdfFile ? (
                      <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 w-full">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 bg-emerald-100 rounded-xl shrink-0">
                            <FileText className="w-4 h-4 text-emerald-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-emerald-700 truncate max-w-[280px]">{registerOcConfig.pdfFile.name}</p>
                            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                              {(registerOcConfig.pdfFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <button
                            type="button"
                            onClick={() => document.getElementById('registerOcPdfUpload')?.click()}
                            className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                          >
                            Reemplazar
                          </button>
                          <button
                            type="button"
                            onClick={() => setRegisterOcConfig(prev => ({ ...prev, pdfFile: null }))}
                            className="p-1.5 hover:bg-emerald-100 rounded-lg transition-colors text-emerald-400 hover:text-emerald-600"
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
                          registerOcConfig.isDragging ? "border-emerald-500 bg-emerald-50/50" : "border-slate-200 bg-white hover:border-emerald-400"
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
                        <FilePlus className={cn("w-6 h-6 mb-1 transition-colors", registerOcConfig.isDragging ? "text-emerald-500" : "text-slate-300")} />
                        <span className="text-xs font-bold text-slate-600">
                          {registerOcConfig.isDragging ? "¡Suelta el archivo aquí!" : "Seleccionar Archivo PDF o Arrastrar y Soltar"}
                        </span>
                        <span className="text-xs text-slate-400">PDF máximo 10MB</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-[2rem]">
                  <button
                    type="button"
                    onClick={() => setRegisterOcConfig(prev => ({ ...prev, isOpen: false, renta: null, periodo: '', po: '', isSubmitting: false, pdfFile: null, isDragging: false }))}
                    className="px-6 py-3 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-black uppercase tracking-widest transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={registerOcConfig.isSubmitting}
                    className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-black uppercase tracking-widest transition-all disabled:opacity-50"
                  >
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
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl bg-white rounded-[2rem] shadow-2xl z-50 overflow-hidden flex flex-col max-h-[90vh]"
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* Cliente select */}
                    <div className="space-y-1.5 flex flex-col">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Cliente *</label>
                      <Popover open={openFichaCliente} onOpenChange={setOpenFichaCliente}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 flex justify-between items-center focus:outline-none focus:border-red-500 hover:border-red-500 transition-colors"
                          >
                            {selectedFichaClienteId
                              ? (clientesDisponibles.find((c: any) => c.id === selectedFichaClienteId)?.razonSocial || clientesDisponibles.find((c: any) => c.id === selectedFichaClienteId)?.razon_social)
                              : "Seleccionar Cliente..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                                      <span>{c.razonSocial || c.razon_social}</span>
                                      {selectedFichaClienteId === c.id && <Check className="w-4 h-4 text-red-600" />}
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
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 flex justify-between items-center focus:outline-none focus:border-red-500 hover:border-red-500 transition-colors disabled:opacity-50"
                          >
                            {selectedFichaCuenta || "Todas las cuentas"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                              const sitiosDelCliente = clientesDisponibles.find((c: any) => c.id === selectedFichaClienteId)?.sitios || [];
                              const cuentasUnicas = Array.from(new Set(sitiosDelCliente.map((s: any) => s.cuenta).filter(Boolean))) as string[];
                              const filtered = cuentasUnicas.filter(c => c.toLowerCase().includes(fichaCuentaSearchTerm.toLowerCase())).sort();
                              
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
                                    {!selectedFichaCuenta && <Check className="w-4 h-4 text-red-600" />}
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
                                      <span>{cuenta}</span>
                                      {selectedFichaCuenta === cuenta && <Check className="w-4 h-4 text-red-600" />}
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
                      <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Sitio *</label>
                      <Popover open={openFichaSitio} onOpenChange={setOpenFichaSitio}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            disabled={!selectedFichaClienteId}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 flex justify-between items-center focus:outline-none focus:border-red-500 hover:border-red-500 transition-colors disabled:opacity-50"
                          >
                            {selectedFichaSitioId
                              ? clientesDisponibles.find((c: any) => c.id === selectedFichaClienteId)?.sitios?.find((s: any) => s.id === selectedFichaSitioId)?.nombre
                              : "Seleccionar Sitio..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                            {(() => {
                              const sitiosDelCliente = clientesDisponibles.find((c: any) => c.id === selectedFichaClienteId)?.sitios || [];
                              const filteredByCuenta = selectedFichaCuenta ? sitiosDelCliente.filter((s: any) => s.cuenta === selectedFichaCuenta) : sitiosDelCliente;
                              const filtered = filteredByCuenta
                                .filter((s: any) => s && (s.nombre || '').toLowerCase().includes((fichaSitioSearchTerm || '').toLowerCase()))
                                .sort((a: any, b: any) => (a.nombre || '').localeCompare(b.nombre || ''));

                              if (filtered.length === 0) return <div className="p-4 text-center text-sm text-slate-500">No se encontraron sitios.</div>;

                              return filtered.map((s: any) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedFichaSitioId(s.id);
                                    if (s.cuenta) setSelectedFichaCuenta(s.cuenta);
                                    setOpenFichaSitio(false);
                                    setFichaSitioSearchTerm('');
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors flex items-center justify-between font-medium"
                                >
                                  <span>{s.nombre}</span>
                                  {selectedFichaSitioId === s.id && <Check className="w-4 h-4 text-red-600" />}
                                </button>
                              ));
                            })()}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Folio OC */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Folio OC Cliente *</label>
                      <input
                        type="text"
                        value={fichaFolioOc}
                        onChange={e => setFichaFolioOc(e.target.value)}
                        placeholder="Escribe el folio de la OC"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-red-500 transition-all"
                      />
                    </div>

                    {/* Folio Pedido Totvs */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Folio Pedido TOTVS</label>
                      <input
                        type="text"
                        value={fichaPedidoTotvs}
                        onChange={e => setFichaPedidoTotvs(e.target.value)}
                        placeholder="Escribe el folio de pedido registrado en Totvs"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-red-500 transition-all"
                      />
                    </div>

                    {/* Fecha Registro Totvs */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Fecha Registro TOTVS</label>
                      <input
                        type="date"
                        value={fichaFechaTotvs}
                        onChange={e => setFichaFechaTotvs(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-red-500 transition-all"
                      />
                    </div>

                    {/* Mes de Cobertura */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Mes de Cobertura</label>
                      <input
                        type="month"
                        value={fichaMesCobro}
                        onChange={e => setFichaMesCobro(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-red-500 transition-all"
                      />
                    </div>

                    {/* PDF Upload */}
                    <div className="space-y-1.5 md:col-span-2">
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
                            isFichaDragging ? "border-red-500 bg-red-50/50" : "border-slate-200 bg-slate-50/50 hover:border-red-400"
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
                          <div className="pointer-events-none flex flex-col items-center gap-1.5">
                            <FileText className={cn("w-8 h-8 transition-colors", isFichaDragging ? "text-red-500" : "text-slate-400")} />
                            <span className={cn("text-sm font-bold", isFichaDragging ? "text-red-600" : "text-slate-700")}>
                              {isFichaDragging ? "¡Suelta el archivo aquí!" : "Seleccionar Archivo PDF o Arrastrar y Soltar"}
                            </span>
                            <span className="text-xs text-slate-400">PDF máximo 10MB</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  </div>

                  {/* Grid of Series & Days Discount Calculator */}
                  {selectedFichaSitioId && (
                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6">
                  <h3 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: currentColor }}>
                    <Truck className="w-4 h-4"/> 2. Selección de Equipo
                  </h3>
                      <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                        <table className="w-full text-left text-xs whitespace-nowrap">
                          <thead className="bg-slate-50 text-[10px] text-slate-400 font-black uppercase tracking-wider border-b border-slate-100">
                            <tr>
                              <th className="p-3 w-10">
                                <button
                                  type="button"
                                  onClick={handleSelectAllSeries}
                                  className={cn(
                                    "text-[9px] font-black uppercase tracking-wider transition-colors whitespace-nowrap px-1.5 py-0.5 rounded",
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
                              <th className="p-3">Clase / Modelo</th>
                              <th className="p-3 w-28">Tarifa Renta</th>
                              <th className="p-3 w-24">Días Caídos</th>
                              <th className="p-3 w-28">Descuento</th>
                              <th className="p-3 w-28 font-black text-[#E5222D]">Tarifa Final</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {fichaSeriesGrid.map((item, index) => (
                              <tr key={item.assetId} className={cn("hover:bg-slate-50/50 transition-colors", item.checked && "bg-red-50/10")}>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={item.checked}
                                    onChange={e => handleGridFieldChange(index, 'checked', e.target.checked)}
                                    className="w-4.5 h-4.5 rounded text-red-600 focus:ring-red-500 cursor-pointer"
                                  />
                                </td>
                                <td className="p-3">
                                  <div className="font-bold text-slate-800">{item.serie}</div>
                                  {item.existingRenta && (
                                    <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-50 border border-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded mt-0.5 inline-block">Renta Activa</span>
                                  )}
                                </td>
                                <td className="p-3 text-slate-600">
                                  <div className="flex flex-col text-xs mt-0.5">
                                    <span className="font-bold text-slate-800">{item.modelo || '-'}</span>
                                    <span style={{ color: currentColor }}>{item.clase || '-'}</span>
                                  </div>
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
                                    onChange={e => handleGridFieldChange(index, 'dias_caidos', e.target.value)}
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
                            ))}
                          </tbody>
                          <tfoot className="border-t-2 border-slate-200 bg-slate-50/80">
                            <tr>
                              <td colSpan={5} className="p-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
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
                            placeholder="Ej. 12"
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
                        <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Asignar Equipo (Serie)</label>
                        <button
                          type="button"
                          disabled={!newRentaFormData.cliente_id || !newRentaFormData.sitio_id}
                          onClick={() => setOpenEquipo(!openEquipo)}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 flex justify-between items-center focus:outline-none focus:border-red-500 hover:border-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-slate-200"
                        >
                          {newRentaFormData.activo_id
                            ? equiposDisponibles.find((e) => e.id === newRentaFormData.activo_id)?.serie
                            : "Seleccionar Equipo..."}
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
                        {(!newRentaFormData.cliente_id || !newRentaFormData.sitio_id) && (
                          <p className="text-[10px] text-slate-400 font-bold mt-1 ml-1 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"></span>
                            {!newRentaFormData.cliente_id
                              ? 'Selecciona primero una cuenta'
                              : 'Selecciona primero un sitio'}
                          </p>
                        )}

                        {openEquipo && (
                          <div className="absolute top-[100%] mt-2 left-0 w-full sm:w-[400px] z-[9999] bg-white border border-slate-200 shadow-xl rounded-xl p-2 animate-in fade-in zoom-in-95 duration-200">
                            <div className="relative mb-2">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input
                                type="text"
                                placeholder="Buscar por serie o modelo..."
                                value={equipoSearchTerm}
                                onChange={(e) => setEquipoSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-red-500"
                              />
                            </div>
                            <div className="max-h-[200px] overflow-y-auto space-y-1">
                              {equiposDisponibles
                                .filter((e) => {
                                  const st = e.estatus?.toUpperCase();
                                  if (st !== 'DISPONIBLE' && st !== 'BACK UP') return false;
                                  const hasVigente = rentas.some((r: any) => r.activo?.id === e.id && r.estado === 'VIGENTE');
                                  if (hasVigente) return false;
                                  const term = equipoSearchTerm.toLowerCase();
                                  return (e.serie?.toLowerCase().includes(term) || e.modelo?.toLowerCase().includes(term));
                                })
                                .map((e) => (
                                  <button
                                    key={e.id}
                                    type="button"
                                    onClick={() => {
                                      const assetPrice = e.renta_precio || 0;
                                      setNewRentaFormData((prev) => ({
                                        ...prev,
                                        activo_id: e.id,
                                        renta_base: assetPrice.toString(),
                                      }));
                                      setOpenEquipo(false);
                                      setEquipoSearchTerm('');
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors flex items-center justify-between font-medium"
                                  >
                                    <span>{e.serie} {e.modelo ? `- ${e.modelo}` : ''}</span>
                                    {newRentaFormData.activo_id === e.id && (
                                      <Check className="w-4 h-4 text-red-600" />
                                    )}
                                  </button>
                                ))}
                                {equiposDisponibles.filter((e) => {
                                  const st = e.estatus?.toUpperCase();
                                  if (st !== 'DISPONIBLE' && st !== 'BACK UP') return false;
                                  const hasVigente = rentas.some((r: any) => r.activo?.id === e.id && r.estado === 'VIGENTE');
                                  if (hasVigente) return false;
                                  const term = equipoSearchTerm.toLowerCase();
                                  return (e.serie?.toLowerCase().includes(term) || e.modelo?.toLowerCase().includes(term));
                                }).length === 0 && (
                                  <div className="py-4 text-center text-sm text-slate-500">
                                    No se encontraron equipos disponibles.
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
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-[2rem] shadow-xl z-50 overflow-hidden flex flex-col max-h-[90vh]"
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
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white">
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
                      <p className="font-bold text-slate-800 text-sm mt-0.5">{viewRentaConfig.renta.no_registro_totvs || '-'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Fecha Pedido TOTVS / Mes Cobro</span>
                      <p className="font-bold text-slate-800 text-sm mt-0.5">
                        {viewRentaConfig.renta.fecha_pedido_totvs ? new Date(viewRentaConfig.renta.fecha_pedido_totvs).toLocaleDateString('es-ES') : '-'}
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
                  <h3 className="text-sm font-black text-slate-800 border-b-2 border-slate-100 pb-2 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-800">4</span>
                    Historial de Pedidos (Renta)
                  </h3>
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
                    
                    if (projection.length === 0) {
                      return <p className="text-sm font-medium text-slate-500 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center">No hay proyección ni pedidos para esta renta.</p>;
                    }

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
                      <div className="space-y-4">
                        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center justify-between">
                          <span className="text-sm font-black text-emerald-900 uppercase tracking-widest">Presupuesto Total Proyectado</span>
                          <span className="text-lg font-black text-emerald-700">${totalVigencia.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        
                        <div className="space-y-4">
                          {sortedYears.map((year: string) => {
                            const yData = yearsMap.get(year);
                            const sortedMonths = [...yData.months].sort((a: any, b: any) => b.periodo.localeCompare(a.periodo));
                            return (
                              <div key={year} className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                                  <span className="text-sm font-black text-slate-800">{year}</span>
                                  <span className="text-xs font-bold text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                                    Subtotal: ${yData.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                                <div className="divide-y divide-slate-100">
                                  {sortedMonths.map((m: any, idx: number) => (
                                    <div key={`${m.periodo}-${idx}`} className="p-4 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors">
                                      <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Período</span>
                                        <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                          {m.periodo}
                                          {m.hasOc ? (
                                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded uppercase tracking-wider">Subida</span>
                                          ) : (
                                            <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded uppercase tracking-wider">Pendiente</span>
                                          )}
                                        </span>
                                      </div>
                                      <div className="flex flex-col items-end">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Presupuesto Mensual</span>
                                        <span className="text-sm font-bold text-[#E5222D]">${m.tarifa.toLocaleString(undefined, { minimumFractionDigits: 2 })} {m.moneda}</span>
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
    </div>
  );
}
