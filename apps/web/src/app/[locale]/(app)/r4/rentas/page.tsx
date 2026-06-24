"use client";

import {
  Search, Receipt, Calendar, CalendarDays, Plus, Filter, Download, X, Pencil, Check, ChevronsUpDown, FileText, Building2, MapPin, Truck, FileSpreadsheet
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useState, useEffect, Fragment } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth.store";
import { motion, AnimatePresence } from "motion/react";

export default function R4RentasPage() {
  const { user } = useAuthStore();
  let rawRole: any = user?.role;
  if (Array.isArray(rawRole)) rawRole = rawRole[0]?.name || rawRole[0]?.rol || rawRole[0];
  if (typeof rawRole === 'object' && rawRole !== null) rawRole = rawRole?.name || rawRole?.rol;
  const userRole = String(rawRole || 'administrador').toLowerCase();
  
  const isAdc = userRole !== 'administrador' && !userRole.includes('geren') && !userRole.includes('coordinaci');
  const loggedInAdcName = user ? `${user.firstName} ${user.lastName || ''}`.trim() : '';

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
  const [fichaSeriesGrid, setFichaSeriesGrid] = useState<any[]>([]); // Array of { assetId, serie, modelo, clase, checked, renta_base, dias_caidos, descuento, renta_final }
  const [isSubmittingFicha, setIsSubmittingFicha] = useState(false);

  const [openFichaCliente, setOpenFichaCliente] = useState(false);
  const [openFichaSitio, setOpenFichaSitio] = useState(false);

  // NEW STATE FOR STANDALONE RENTA
  const [clientesDisponibles, setClientesDisponibles] = useState<any[]>([]);
  const [equiposDisponibles, setEquiposDisponibles] = useState<any[]>([]);
  const [newRentaFormData, setNewRentaFormData] = useState({
    cliente_id: '', sitio_id: '', contrato_id: '', tipo_renta: 'Mensual', moneda: 'MXN', fecha_inicio: '', fecha_fin: '', activo_id: '', renta_base: '', mantenimiento: false, comentarios: '', plazo_meses: '', mes_cobertura: ''
  });
  const [editRentaConfig, setEditRentaConfig] = useState<{ isOpen: boolean; id: string; formData: any }>({
    isOpen: false,
    id: '',
    formData: { estado: '', renta_base: '', moneda: 'MXN', po: '', ordenes: [] }
  });
  const [isSubmittingRenta, setIsSubmittingRenta] = useState(false);
  const [openCliente, setOpenCliente] = useState(false);
  const [openSitio, setOpenSitio] = useState(false);
  const [openEquipo, setOpenEquipo] = useState(false);
  const selectedClienteObj = clientesDisponibles.find(c => c.id === newRentaFormData.cliente_id);

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
      setRentas(Array.isArray(dataArray) ? dataArray : []);

      const clientesArray = resClientes.data?.data || resClientes.data || [];
      setClientesDisponibles(Array.isArray(clientesArray) ? clientesArray : []);

      const equiposArray = resFlotilla.data?.data || resFlotilla.data || [];
      setEquiposDisponibles(Array.isArray(equiposArray) ? equiposArray : []);
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
        checked: false,
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
          mes_cobro: newRentaFormData.mes_cobertura || null,
          renta_base: Number(newRentaFormData.renta_base) || 0,
          mantenimiento: newRentaFormData.mantenimiento,
          comentarios: newRentaFormData.comentarios
        }
      };

      await api.post('/r4/rentas', payload);
      toast.success('Renta creada correctamente');
      setIsNewRentaModalOpen(false);
      setNewRentaFormData({
        cliente_id: '', sitio_id: '', contrato_id: '', tipo_renta: 'Mensual', moneda: 'MXN', fecha_inicio: '', fecha_fin: '', activo_id: '', renta_base: '', mantenimiento: false, comentarios: '', plazo_meses: '', mes_cobertura: ''
      });
      fetchRentasYClientes();
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
      setEditRentaConfig({ ...editRentaConfig, isOpen: false });
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
            no_registro_totvs: fichaPedidoTotvs || null,
            fecha_pedido_totvs: fichaFechaTotvs || null,
            detalles: {
              oc_cliente: fichaFolioOc,
              mes_cobro: fichaMesCobro || null,
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

  const totalRentas = baseRentas.length;
  const activas = baseRentas.filter(r => 
    r.estado?.toUpperCase() === 'VIGENTE' || 
    r.estado?.toUpperCase() === 'IMPORTADA' || 
    r.estado?.toUpperCase() === 'RENOVADA' ||
    r.estado?.toLowerCase().includes('activo')
  ).length;

  const hoy = new Date();
  const en30Dias = new Date();
  en30Dias.setDate(hoy.getDate() + 30);

  const porVencer = baseRentas.filter(r => {
    if (!r.fecha_fin) return false;
    const fechaFin = new Date(r.fecha_fin);
    return fechaFin > hoy && fechaFin <= en30Dias && r.estado?.toUpperCase() !== 'CANCELADA';
  }).length;

  const filteredRentas = baseRentas.filter((renta: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      renta.id?.toLowerCase().includes(term) ||
      renta.cliente?.razonSocial?.toLowerCase().includes(term) ||
      renta.activo?.serie?.toLowerCase().includes(term) ||
      renta.orden_compra?.toLowerCase().includes(term) ||
      renta.detalles?.oc_cliente?.toLowerCase().includes(term)
    );
  });

  // Apply pagination
  const totalItems = filteredRentas.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
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

  return (
    <div className="min-h-screen bg-[#F9FAFB] p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col -gap-1">
          <span className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] mb-1">RAYMOND</span>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Gestión de Rentas</h1>
          <p className="text-slate-500 font-medium mt-1">Administración de contratos de renta, vigencias y asignación de activos</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsFichaOcModalOpen(true)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#E5222D] hover:bg-[#CC1E28] text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-red-100"
          >
            <FileText className="w-4 h-4" />
            Registro OC
          </button>
          <button
            onClick={() => setIsNewRentaModalOpen(true)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Nueva Renta
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:border-red-100 hover:shadow-md transition-all">
          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Receipt className="w-24 h-24 text-red-600" />
          </div>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2 line-clamp-1">Total de Rentas {isAdc && '(Mi ADC)'}</p>
          <h3 className="text-3xl font-black text-red-600">{totalRentas}</h3>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-emerald-100 hover:shadow-md transition-all">
          <p className="text-emerald-600 text-[10px] font-black uppercase tracking-widest mb-2 line-clamp-1">Vigentes / Activas</p>
          <h3 className="text-3xl font-black text-slate-900">{activas}</h3>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-red-100 hover:shadow-md transition-all">
          <p className="text-red-600 text-[10px] font-black uppercase tracking-widest mb-2 line-clamp-1">Próximas a Vencer</p>
          <h3 className="text-3xl font-black text-slate-900">{porVencer}</h3>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative group flex-1 w-full max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-red-500 transition-colors" />
          <input
            type="text"
            placeholder="Buscar por cliente, serie, folio OC"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-medium focus:border-red-500 focus:outline-none transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Grouped Table */}
      <div className="bg-white border-2 border-slate-100 rounded-[2rem] shadow-sm overflow-hidden animate-in fade-in duration-300">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
            <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-widest border-b-2 border-slate-100">
              <tr>
                <th className="px-4 py-4 font-black">Cuenta</th>
                <th className="px-4 py-4 font-black">Site</th>
                <th className="px-4 py-4 font-black">Tipo</th>
                <th className="px-4 py-4 font-black">Clase</th>
                <th className="px-4 py-4 font-black">Modelo</th>
                <th className="px-4 py-4 font-black">Folio OC</th>
                <th className="px-4 py-4 font-black">Serie</th>
                <th className="px-4 py-4 font-black">Precio Renta</th>
                <th className="px-4 py-4 font-black">Moneda</th>
                <th className="px-4 py-4 font-black">Póliza</th>
                <th className="px-4 py-4 font-black">Distribuidor</th>
                <th className="px-4 py-4 font-black">Costo Póliza</th>
                <th className="px-4 py-4 font-black">Moneda Pago</th>
                <th className="px-4 py-4 font-black text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={14} className="px-6 py-12 text-center text-slate-400 font-bold">Cargando rentas...</td></tr>
              ) : Object.keys(groupedRentas).length === 0 ? (
                <tr><td colSpan={14} className="px-6 py-12 text-center text-slate-400 font-bold">No se encontraron rentas.</td></tr>
              ) : Object.entries(groupedRentas).map(([clienteNombre, clientRentas]) => (
                <Fragment key={clienteNombre}>
                  {/* Group header */}
                  <tr className="bg-slate-50/80 font-black text-slate-800 border-y border-slate-100">
                    <td colSpan={14} className="px-4 py-3 text-xs flex items-center gap-2">
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
                        <td className="px-4 py-3.5 text-slate-500">
                          {renta.activo?.clase?.includes('III') ? 'Patín' : 'Montacargas'}
                        </td>
                        <td className="px-4 py-3.5 text-slate-500">{renta.activo?.clase || '-'}</td>
                        <td className="px-4 py-3.5 text-slate-700">{renta.activo?.modelo || '-'}</td>
                        <td className="px-4 py-3.5 font-bold text-[#E5222D]">
                          {renta.orden_compra || detalles.oc_cliente || '-'}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-slate-800">{renta.activo?.serie || '-'}</td>
                        <td className="px-4 py-3.5 font-bold text-slate-800">
                          ${(detalles.renta_base || renta.tarifa || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3.5 text-slate-500">{detalles.moneda || 'MXN'}</td>
                        <td className="px-4 py-3.5 text-slate-600">{cond.tipo_poliza || 'SMP'}</td>
                        <td className="px-4 py-3.5 text-slate-600">{renta.distribuidor || '-'}</td>
                        <td className="px-4 py-3.5 text-slate-600">
                          ${(cond.costo_poliza_distribuidor || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3.5 text-slate-500">{cond.moneda_pago_distribuidor || 'MXN'}</td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEditModal(renta); }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
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

      {/* Registro OC MODAL */}
      <AnimatePresence>
        {isFichaOcModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFichaOcModalOpen(false)}
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
                    onClick={() => setIsFichaOcModalOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Cliente select */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Cliente *</label>
                      <select
                        value={selectedFichaClienteId}
                        onChange={e => {
                          setSelectedFichaClienteId(e.target.value);
                          setSelectedFichaSitioId('');
                        }}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-red-500 transition-all"
                      >
                        <option value="">Seleccionar Cliente...</option>
                        {clientesDisponibles.map((c) => (
                          <option key={c.id} value={c.id}>{c.razonSocial}</option>
                        ))}
                      </select>
                    </div>

                    {/* Sitio select */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Sitio *</label>
                      <select
                        value={selectedFichaSitioId}
                        onChange={e => setSelectedFichaSitioId(e.target.value)}
                        disabled={!selectedFichaClienteId}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-red-500 transition-all disabled:opacity-50"
                      >
                        <option value="">Seleccionar Sitio...</option>
                        {clientesDisponibles.find(c => c.id === selectedFichaClienteId)?.sitios?.map((s: any) => (
                          <option key={s.id} value={s.id}>{s.nombre}</option>
                        ))}
                      </select>
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
                        required
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

                    {/* Mes de Cobro */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Mes de Cobro</label>
                      <input
                        type="text"
                        value={fichaMesCobro}
                        onChange={e => setFichaMesCobro(e.target.value)}
                        placeholder="Ej. Junio 2026"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-red-500 transition-all"
                      />
                    </div>

                    {/* PDF Upload */}
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Cargar PDF de la OC del Cliente</label>
                      <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center hover:border-red-400 transition-all bg-slate-50/50">
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
                        <label htmlFor="fichaPdfUpload" className="cursor-pointer flex flex-col items-center justify-center gap-1.5">
                          <FileText className="w-8 h-8 text-slate-400" />
                          <span className="text-sm font-bold text-slate-700">
                            {fichaPdfFile ? fichaPdfFile.name : "Seleccionar Archivo PDF..."}
                          </span>
                          <span className="text-xs text-slate-400">PDF máximo 10MB</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Grid of Series & Days Discount Calculator */}
                  {selectedFichaSitioId && (
                    <div className="space-y-4 pt-4 border-t border-slate-100">
                      <div className="flex justify-between items-center">
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Truck className="w-4 h-4 text-red-500" />
                          Equipos del Sitio y Descuento por Días Caídos
                        </h3>
                        <span className="text-xs text-slate-400 font-bold">{fichaSeriesGrid.length} equipos encontrados</span>
                      </div>

                      <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                        <table className="w-full text-left text-xs whitespace-nowrap">
                          <thead className="bg-slate-50 text-[10px] text-slate-400 font-black uppercase tracking-wider border-b border-slate-100">
                            <tr>
                              <th className="p-3 w-10">Select</th>
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
                                  <div>Clase {item.clase}</div>
                                  <div className="text-[10px] text-slate-400 font-medium">{item.modelo}</div>
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
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0 rounded-b-[2rem]">
                  <button
                    type="button"
                    onClick={() => setIsFichaOcModalOpen(false)}
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
              onClick={() => setIsNewRentaModalOpen(false)}
              className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-[2rem] shadow-xl z-50 overflow-hidden flex flex-col max-h-[90vh]"
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
                    onClick={() => setIsNewRentaModalOpen(false)}
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Cliente</label>
                          <select
                            value={newRentaFormData.cliente_id}
                            onChange={e => setNewRentaFormData(prev => ({ ...prev, cliente_id: e.target.value, sitio_id: '' }))}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-red-500 transition-colors"
                          >
                            <option value="">Seleccionar Cliente...</option>
                            {clientesDisponibles.map((c) => (
                              <option key={c.id} value={c.id}>{c.razonSocial}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Sitio</label>
                          <select
                            value={newRentaFormData.sitio_id}
                            onChange={e => setNewRentaFormData(prev => ({ ...prev, sitio_id: e.target.value }))}
                            disabled={!newRentaFormData.cliente_id}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
                          >
                            <option value="">Seleccionar Sitio...</option>
                            {selectedClienteObj?.sitios?.map((s: any) => (
                              <option key={s.id} value={s.id}>{s.nombre}</option>
                            ))}
                          </select>
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
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Tipo de Renta</label>
                          <select value={newRentaFormData.tipo_renta} onChange={e => setNewRentaFormData({ ...newRentaFormData, tipo_renta: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-red-500 transition-colors">
                            <option value="Mensual">Mensual</option>
                            <option value="Bimestral">Bimestral</option>
                            <option value="Trimestral">Trimestral</option>
                            <option value="Anual">Anual</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Moneda</label>
                          <select value={newRentaFormData.moneda} onChange={e => setNewRentaFormData({ ...newRentaFormData, moneda: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-red-500 transition-colors">
                            <option value="MXN">MXN (Pesos Mexicanos)</option>
                            <option value="USD">USD (Dólares)</option>
                          </select>
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

                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Mes de Cobertura</label>
                          <input
                            type="month"
                            value={newRentaFormData.mes_cobertura}
                            onChange={e => setNewRentaFormData({ ...newRentaFormData, mes_cobertura: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-red-500 transition-colors"
                          />
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Asignar Equipo (Serie)</label>
                        <select
                          value={newRentaFormData.activo_id}
                          onChange={e => {
                            const val = e.target.value;
                            const assetPrice = equiposDisponibles.find(eq => eq.id === val)?.renta_precio || 0;
                            setNewRentaFormData(prev => ({ ...prev, activo_id: val, renta_base: assetPrice.toString() }));
                          }}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-red-500 transition-colors"
                        >
                          <option value="">Seleccionar Equipo...</option>
                          {equiposDisponibles.map((e) => (
                            <option key={e.id} value={e.id}>{e.serie} {e.modelo ? `- ${e.modelo}` : ''}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Tarifa Renta</label>
                        <input
                          type="number"
                          value={newRentaFormData.renta_base}
                          readOnly
                          placeholder="0.00"
                          className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 focus:outline-none cursor-not-allowed opacity-80"
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
                        <label className="flex items-center gap-3 p-4 border-2 border-slate-100 rounded-xl cursor-pointer hover:border-red-500 transition-colors bg-white">
                          <input type="checkbox" checked={newRentaFormData.mantenimiento} onChange={e => setNewRentaFormData({ ...newRentaFormData, mantenimiento: e.target.checked })} className="w-5 h-5 rounded text-red-600 focus:ring-red-500" />
                          <span className="text-sm font-bold text-slate-700">Incluye Mantenimiento Preventivo (SMP)</span>
                        </label>
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
                    onClick={() => setIsNewRentaModalOpen(false)}
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
              onClick={() => setEditRentaConfig({ ...editRentaConfig, isOpen: false })}
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
                    onClick={() => setEditRentaConfig({ ...editRentaConfig, isOpen: false })}
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
                          <option value="VIGENTE">VIGENTE</option>
                          <option value="IMPORTADA">IMPORTADA</option>
                          <option value="RENOVADA">RENOVADA</option>
                          <option value="CANCELADA">CANCELADA</option>
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
                    onClick={() => setEditRentaConfig({ ...editRentaConfig, isOpen: false })}
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
    </div>
  );
}
