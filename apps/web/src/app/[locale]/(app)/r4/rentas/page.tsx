"use client";

import {
  Search, Receipt, Calendar, CalendarDays, Plus, Filter, Download, X, Pencil, Check, ChevronsUpDown
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/routing";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import api from "@/lib/api";
import { toast } from "sonner";

export default function R4RentasPage() {
  const [rentas, setRentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isNewRentaModalOpen, setIsNewRentaModalOpen] = useState(false);

  // NEW STATE
  const [clientesDisponibles, setClientesDisponibles] = useState<any[]>([]);
  const [equiposDisponibles, setEquiposDisponibles] = useState<any[]>([]);
  const [newRentaFormData, setNewRentaFormData] = useState({
    cliente_id: '', sitio_id: '', contrato_id: '', tipo_renta: 'Mensual', moneda: 'MXN', fecha_inicio: '', fecha_fin: '', activo_id: '', renta_base: '', mantenimiento: false, comentarios: ''
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
  const itemsPerPage = 10;

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
        detalles: {
          tipo_renta: newRentaFormData.tipo_renta,
          moneda: newRentaFormData.moneda,
          renta_base: Number(newRentaFormData.renta_base) || 0,
          mantenimiento: newRentaFormData.mantenimiento,
          comentarios: newRentaFormData.comentarios
        }
      };

      await api.post('/r4/rentas', payload);
      toast.success('Renta creada correctamente');
      setIsNewRentaModalOpen(false);
      setNewRentaFormData({
        cliente_id: '', sitio_id: '', contrato_id: '', tipo_renta: 'Mensual', moneda: 'MXN', fecha_inicio: '', fecha_fin: '', activo_id: '', renta_base: '', mantenimiento: false, comentarios: ''
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

  const totalRentas = rentas.length;
  const activas = rentas.filter(r => r.estado?.toLowerCase().includes('activo') || r.estado?.toLowerCase().includes('vigente')).length;
  const porVencer = rentas.filter(r => r.estado?.toLowerCase().includes('vencer')).length;

  const filteredRentas = rentas.filter((renta: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      renta.id?.toLowerCase().includes(term) ||
      renta.cliente?.razonSocial?.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredRentas.length / itemsPerPage);
  const paginatedRentas = filteredRentas.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="min-h-screen bg-[#F9FAFB] p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col -gap-1">
          <span className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] mb-1">RAYMOND</span>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Gestión de Rentas</h1>
          <p className="text-slate-500 font-medium mt-1">Administración de contratos de renta, vigencias y asignación de activos</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsNewRentaModalOpen(true)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-amber-100"
          >
            <Plus className="w-4 h-4" />
            Nueva Renta
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:border-amber-100 hover:shadow-md transition-all">
          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Receipt className="w-24 h-24 text-amber-600" />
          </div>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2 line-clamp-1">Total de Rentas</p>
          <h3 className="text-3xl font-black text-amber-600">{totalRentas}</h3>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-emerald-100 hover:shadow-md transition-all">
          <p className="text-emerald-600 text-[10px] font-black uppercase tracking-widest mb-2 line-clamp-1">Vigentes / Activas</p>
          <h3 className="text-3xl font-black text-slate-900">{activas}</h3>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-amber-100 hover:shadow-md transition-all">
          <p className="text-amber-600 text-[10px] font-black uppercase tracking-widest mb-2 line-clamp-1">Próximas a Vencer</p>
          <h3 className="text-3xl font-black text-slate-900">{porVencer}</h3>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative group flex-1 w-full max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-amber-500 transition-colors" />
          <input
            type="text"
            placeholder="Buscar por ID, Cliente"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // Reset page on search
            }}
            className="w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-medium focus:border-amber-500 focus:outline-none transition-all shadow-sm"
          />
        </div>
        <div className="flex gap-2">
          <button className="flex items-center justify-center p-3 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl border-2 border-slate-100 transition-all shadow-sm"><Filter className="w-4 h-4" /></button>
          <button className="flex items-center justify-center p-3 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl border-2 border-slate-100 transition-all shadow-sm"><Download className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="bg-white border-2 border-slate-100 rounded-[2rem] shadow-sm overflow-hidden animate-in fade-in duration-300">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-widest border-b-2 border-slate-100">
              <tr>
                <th className="px-6 py-5 font-black">PO / ID Renta</th>
                <th className="px-6 py-5 font-black">Cliente</th>
                <th className="px-6 py-5 font-black">Equipos Asignados</th>
                <th className="px-6 py-5 font-black">Fecha Inicio</th>
                <th className="px-6 py-5 font-black">Fin Vigencia</th>
                <th className="px-6 py-5 font-black">Tarifa Mensual</th>
                <th className="px-6 py-5 font-black">Estado</th>
                <th className="px-6 py-5 font-black text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-bold">Cargando rentas...</td></tr>
              ) : filteredRentas.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-bold">No se encontraron rentas.</td></tr>
              ) : paginatedRentas.map((renta) => (
                <tr key={renta.id} className="hover:bg-slate-50 transition-colors group cursor-pointer">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-900 group-hover:text-amber-600 transition-colors">
                        {renta.orden_compra || renta.detalles?.oc_cliente || renta.id.substring(0, 8).toUpperCase()}
                      </span>
                      {!(renta.orden_compra || renta.detalles?.oc_cliente) && (
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">ID Sistema</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-700">{renta.cliente?.razonSocial || 'Sin cliente'}</td>
                  <td className="px-6 py-4">
                    <span className="bg-slate-100 px-2 py-1.5 rounded-lg text-[10px] font-black uppercase text-slate-500 border border-slate-200">
                      1 Activo
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-500">{new Date(renta.fecha_inicio).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-700">{new Date(renta.fecha_fin).toLocaleDateString()}</td>
                  <td className="px-6 py-4 font-black text-slate-800">
                    ${(renta.detalles?.total_con_mantenimiento || renta.detalles?.renta_real || renta.detalles?.renta_base || 0).toLocaleString()} {renta.detalles?.moneda || 'MXN'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${renta.estado?.toLowerCase() === 'activo' || renta.estado?.toLowerCase() === 'vigente'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : 'bg-amber-50 text-amber-700 border-amber-100'
                      }`}>
                      {renta.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditModal(renta); }}
                      className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t-2 border-slate-50 bg-slate-50/50">
            <span className="text-sm font-bold text-slate-500">
              Página {currentPage} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 disabled:opacity-50 hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 disabled:opacity-50 hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

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
                    <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
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
                          <Popover open={openCliente} onOpenChange={setOpenCliente}>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-700 flex items-center justify-between focus:outline-none focus:border-amber-500 transition-colors"
                              >
                                <span className="truncate">
                                  {newRentaFormData.cliente_id
                                    ? clientesDisponibles.find((c) => c.id === newRentaFormData.cliente_id)?.razonSocial
                                    : "Seleccionar Cliente..."}
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-2xl border-2 border-slate-100 shadow-xl bg-white overflow-hidden" align="start">
                              <Command className="bg-transparent [&_[cmdk-input-wrapper]]:border-b-2 [&_[cmdk-input-wrapper]]:border-slate-100 [&_[cmdk-input]]:text-sm [&_[cmdk-input]]:font-bold [&_[cmdk-input]]:text-slate-700">
                                <CommandInput placeholder="Buscar cliente" className="border-none focus:ring-0 outline-none shadow-none bg-transparent" />
                                <CommandList>
                                  <CommandEmpty className="py-6 text-center text-sm font-bold text-slate-500">No se encontró ningún cliente.</CommandEmpty>
                                  <CommandGroup className="p-1.5">
                                    {clientesDisponibles.map((c) => (
                                      <CommandItem
                                        key={c.id}
                                        value={c.razonSocial}
                                        onSelect={() => {
                                          setNewRentaFormData({ ...newRentaFormData, cliente_id: c.id, sitio_id: '' });
                                          setOpenCliente(false);
                                        }}
                                        className="rounded-xl mb-1 last:mb-0 cursor-pointer font-bold text-slate-600 aria-selected:bg-amber-50 aria-selected:text-amber-700"
                                      >
                                        <Check className={cn("mr-2 h-4 w-4 shrink-0 text-amber-600", newRentaFormData.cliente_id === c.id ? "opacity-100" : "opacity-0")} />
                                        {c.razonSocial}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Sitio</label>
                          <Popover open={openSitio} onOpenChange={setOpenSitio}>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                disabled={!newRentaFormData.cliente_id}
                                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-700 flex items-center justify-between focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50"
                              >
                                <span className="truncate">
                                  {newRentaFormData.sitio_id
                                    ? selectedClienteObj?.sitios?.find((s: any) => s.id === newRentaFormData.sitio_id)?.nombre
                                    : "Seleccionar Sitio..."}
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-2xl border-2 border-slate-100 shadow-xl bg-white overflow-hidden" align="start">
                              <Command className="bg-transparent [&_[cmdk-input-wrapper]]:border-b-2 [&_[cmdk-input-wrapper]]:border-slate-100 [&_[cmdk-input]]:text-sm [&_[cmdk-input]]:font-bold [&_[cmdk-input]]:text-slate-700">
                                <CommandInput placeholder="Buscar sitio" className="border-none focus:ring-0 outline-none shadow-none bg-transparent" />
                                <CommandList>
                                  <CommandEmpty className="py-6 text-center text-sm font-bold text-slate-500">No se encontró ningún sitio.</CommandEmpty>
                                  <CommandGroup className="p-1.5">
                                    {selectedClienteObj?.sitios?.map((s: any) => (
                                      <CommandItem
                                        key={s.id}
                                        value={s.nombre}
                                        onSelect={() => {
                                          setNewRentaFormData({ ...newRentaFormData, sitio_id: s.id });
                                          setOpenSitio(false);
                                        }}
                                        className="rounded-xl mb-1 last:mb-0 cursor-pointer font-bold text-slate-600 aria-selected:bg-amber-50 aria-selected:text-amber-700"
                                      >
                                        <Check className={cn("mr-2 h-4 w-4 shrink-0 text-amber-600", newRentaFormData.sitio_id === s.id ? "opacity-100" : "opacity-0")} />
                                        {s.nombre}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Código de Contrato</label>
                          <input
                            type="text"
                            value={newRentaFormData.contrato_id}
                            onChange={e => setNewRentaFormData({ ...newRentaFormData, contrato_id: e.target.value })}
                            placeholder="Escribe el código"
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-500 transition-colors"
                          />
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
                          <select value={newRentaFormData.tipo_renta} onChange={e => setNewRentaFormData({ ...newRentaFormData, tipo_renta: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-500 transition-colors">
                            <option value="Mensual">Mensual</option>
                            <option value="Bimestral">Bimestral</option>
                            <option value="Trimestral">Trimestral</option>
                            <option value="Anual">Anual</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Moneda</label>
                          <select value={newRentaFormData.moneda} onChange={e => setNewRentaFormData({ ...newRentaFormData, moneda: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-500 transition-colors">
                            <option value="MXN">MXN (Pesos Mexicanos)</option>
                            <option value="USD">USD (Dólares)</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Fecha Inicio</label>
                          <input
                            type="date"
                            value={newRentaFormData.fecha_inicio}
                            onChange={e => setNewRentaFormData({ ...newRentaFormData, fecha_inicio: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-500 transition-colors" required
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Fin de Vigencia</label>
                          <input
                            type="date"
                            value={newRentaFormData.fecha_fin}
                            onChange={e => setNewRentaFormData({ ...newRentaFormData, fecha_fin: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-500 transition-colors" required
                          />
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Asignar Equipo (ID / Serie)</label>
                        <div className="flex gap-2">
                          <Popover open={openEquipo} onOpenChange={setOpenEquipo}>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="flex-1 w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-700 flex items-center justify-between focus:outline-none focus:border-amber-500 transition-colors"
                              >
                                <span className="truncate">
                                  {newRentaFormData.activo_id
                                    ? (equiposDisponibles.find((e) => e.id === newRentaFormData.activo_id)?.serie + (equiposDisponibles.find((e) => e.id === newRentaFormData.activo_id)?.modelo ? ` - ${equiposDisponibles.find((e) => e.id === newRentaFormData.activo_id)?.modelo}` : ''))
                                    : "Seleccionar Equipo..."}
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-2xl border-2 border-slate-100 shadow-xl bg-white overflow-hidden" align="start">
                              <Command className="bg-transparent [&_[cmdk-input-wrapper]]:border-b-2 [&_[cmdk-input-wrapper]]:border-slate-100 [&_[cmdk-input]]:text-sm [&_[cmdk-input]]:font-bold [&_[cmdk-input]]:text-slate-700">
                                <CommandInput placeholder="Buscar equipo (ID o Serie)" className="border-none focus:ring-0 outline-none shadow-none bg-transparent" />
                                <CommandList>
                                  <CommandEmpty className="py-6 text-center text-sm font-bold text-slate-500">No se encontró ningún equipo.</CommandEmpty>
                                  <CommandGroup className="p-1.5">
                                    {equiposDisponibles.map((e) => (
                                      <CommandItem
                                        key={e.id}
                                        value={`${e.serie} ${e.modelo || ''}`}
                                        onSelect={() => {
                                          setNewRentaFormData({ ...newRentaFormData, activo_id: e.id });
                                          setOpenEquipo(false);
                                        }}
                                        className="rounded-xl mb-1 last:mb-0 cursor-pointer font-bold text-slate-600 aria-selected:bg-amber-50 aria-selected:text-amber-700"
                                      >
                                        <Check className={cn("mr-2 h-4 w-4 shrink-0 text-amber-600", newRentaFormData.activo_id === e.id ? "opacity-100" : "opacity-0")} />
                                        {e.serie} {e.modelo ? `- ${e.modelo}` : ''}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Tarifa Mensual por Equipo</label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={newRentaFormData.renta_base}
                              onChange={e => setNewRentaFormData({ ...newRentaFormData, renta_base: e.target.value })}
                              placeholder="0.00"
                              className="w-full pl-8 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-500 transition-colors"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SECCIÓN: ADICIONALES */}
                    <div>
                      <h3 className="text-sm font-black text-slate-800 border-b-2 border-slate-100 pb-2 mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-500">3</span>
                        Adicionales
                      </h3>
                      <div className="space-y-4">
                        <label className="flex items-center gap-3 p-4 border-2 border-slate-100 rounded-xl cursor-pointer hover:border-amber-500 transition-colors bg-white">
                          <input type="checkbox" checked={newRentaFormData.mantenimiento} onChange={e => setNewRentaFormData({ ...newRentaFormData, mantenimiento: e.target.checked })} className="w-5 h-5 rounded text-amber-600 focus:ring-amber-500" />
                          <span className="text-sm font-bold text-slate-700">Incluye Mantenimiento Preventivo (SMP)</span>
                        </label>

                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Notas o Cláusulas Adicionales</label>
                          <textarea
                            rows={3}
                            value={newRentaFormData.comentarios}
                            onChange={e => setNewRentaFormData({ ...newRentaFormData, comentarios: e.target.value })}
                            placeholder="Escribe aquí cualquier condición especial del contrato"
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                          ></textarea>
                        </div>
                      </div>
                    </div>

                    {/* SECCIÓN: RESUMEN */}
                    <div className="bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] p-6">
                      <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-slate-400" />
                        Resumen de la Renta
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500 font-bold">Equipos Asignados:</span>
                          <span className="text-slate-900 font-black">{newRentaFormData.activo_id ? '1' : '0'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500 font-bold">Tarifa Base:</span>
                          <span className="text-slate-900 font-black">$0.00</span>
                        </div>
                        <div className="pt-3 border-t-2 border-slate-200 border-dashed flex justify-between">
                          <span className="text-slate-700 font-black uppercase tracking-widest text-xs mt-1">Total Estimado</span>
                          <span className="text-2xl font-black text-amber-600">${newRentaFormData.renta_base ? Number(newRentaFormData.renta_base).toFixed(2) : '0.00'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsNewRentaModalOpen(false)}
                    className="px-6 py-3 bg-white border-2 border-slate-200 text-slate-600 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-slate-50 hover:border-slate-300 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRenta}
                    className="px-6 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-sm font-black uppercase tracking-widest shadow-lg shadow-amber-200 hover:shadow-amber-300 transition-all flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    {isSubmittingRenta ? 'Creando...' : 'Crear Renta'}
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
                    <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
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
                  
                  {/* Información General */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-800 border-b-2 border-slate-100 pb-2 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-[10px] text-amber-600">1</span>
                      Información General
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Orden de Compra / PO Vigente</label>
                        <div className="w-full px-4 py-3 bg-slate-100 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-600 flex items-center justify-between">
                          {editRentaConfig.formData.po}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Estado</label>
                        <select
                          value={editRentaConfig.formData.estado}
                          onChange={e => setEditRentaConfig({ ...editRentaConfig, formData: { ...editRentaConfig.formData, estado: e.target.value } })}
                          className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-500 transition-colors" required>
                          <option value="IMPORTADA">IMPORTADA</option>
                          <option value="VIGENTE">VIGENTE</option>
                          <option value="CANCELADA">CANCELADA</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Tarifa Base</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">$</span>
                          <input type="number" step="0.01" min="0" placeholder="0.00"
                            value={editRentaConfig.formData.renta_base}
                            onChange={e => setEditRentaConfig({ ...editRentaConfig, formData: { ...editRentaConfig.formData, renta_base: e.target.value } })}
                            className="w-full pl-8 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-500 transition-colors" required />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Moneda</label>
                        <select
                          value={editRentaConfig.formData.moneda}
                          onChange={e => setEditRentaConfig({ ...editRentaConfig, formData: { ...editRentaConfig.formData, moneda: e.target.value } })}
                          className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-500 transition-colors" required>
                          <option value="MXN">MXN (Pesos Mexicanos)</option>
                          <option value="USD">USD (Dólares)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Órdenes Mensuales */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-800 border-b-2 border-slate-100 pb-2 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-[10px] text-amber-600">2</span>
                      Órdenes Mensuales
                    </h3>
                    
                    {editRentaConfig.formData.ordenes && editRentaConfig.formData.ordenes.length > 0 ? (
                      <div className="overflow-x-auto rounded-xl border-2 border-slate-100">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                          <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-widest border-b-2 border-slate-100">
                            <tr>
                              <th className="px-4 py-3 font-black">Periodo</th>
                              <th className="px-4 py-3 font-black">PO</th>
                              <th className="px-4 py-3 font-black text-right">Monto</th>
                              <th className="px-4 py-3 font-black text-center">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {editRentaConfig.formData.ordenes.map((orden: any) => (
                              <tr key={orden.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 font-black text-slate-700">{orden.periodo}</td>
                                <td className="px-4 py-3 font-bold text-slate-600">{orden.po || 'N/A'}</td>
                                <td className="px-4 py-3 font-black text-slate-900 text-right">
                                  {orden.tarifa ? `$${Number(orden.tarifa).toFixed(2)} ${orden.moneda || ''}` : 'N/A'}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="px-2 py-1 bg-amber-50 text-amber-700 text-[10px] font-black tracking-widest uppercase rounded-lg border border-amber-200">
                                    {orden.estado}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="bg-slate-50 border-2 border-slate-100 border-dashed rounded-xl p-8 text-center">
                        <p className="text-sm font-bold text-slate-400">No hay órdenes mensuales registradas para esta renta.</p>
                      </div>
                    )}
                  </div>
                  
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                  <button type="button" onClick={() => setEditRentaConfig({ ...editRentaConfig, isOpen: false })} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors">Cancelar</button>
                  <button type="submit" disabled={isSubmittingRenta} className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-black tracking-wide transition-colors disabled:opacity-50">Guardar Cambios</button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
