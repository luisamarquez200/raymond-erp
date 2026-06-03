"use client";

import { 
  Search, FileSpreadsheet, Building2, MapPin, Truck, ChevronRight,
  Filter, Plus, User, Phone, Mail, FileText, Settings, Shield, X, Map, Trash
} from "lucide-react";
import { useState, useEffect } from "react";
import api from "@/lib/api";
import { toast } from "sonner";

export default function ClientesSitios() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "activos" | "inactivos">("todos");
  
  // Selection
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);

  // Modal Client
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [newClientFormData, setNewClientFormData] = useState({
    razon_social: '', rfc: '', adc: '', moneda: 'MXN', calle: '', numero: '', cp: '', ciudad: '', estado: '', sitio_nombre: '', sitio_direccion: ''
  });
  const [isSubmittingClient, setIsSubmittingClient] = useState(false);

  // Modal Sitio
  const [isNewSitioModalOpen, setIsNewSitioModalOpen] = useState(false);
  const [newSitioFormData, setNewSitioFormData] = useState({
    nombre: '', direccion: '', region: '', no_totvs: '', responsable: ''
  });
  const [isSubmittingSitio, setIsSubmittingSitio] = useState(false);

  // Modal Eliminar
  const [deleteModalConfig, setDeleteModalConfig] = useState<{ isOpen: boolean, type: 'cliente' | 'sitio', id: string, name: string, sitiosCount?: number } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Pagination for Directory
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchClientes = async () => {
    try {
      setLoading(true);
      const res = await api.get('/r4/clientes');
      const dataArray = res.data?.data || res.data || [];
      setClientes(Array.isArray(dataArray) ? dataArray : []);
      if (dataArray.length > 0) {
        setSelectedClienteId(dataArray[0].id);
      }
    } catch (error) {
      console.error('Error fetching clientes:', error);
      toast.error('Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientFormData.razon_social || !newClientFormData.rfc) {
      toast.error('Razón Social y RFC son obligatorios');
      return;
    }
    
    try {
      setIsSubmittingClient(true);
      const payload: any = {
        razon_social: newClientFormData.razon_social,
        rfc: newClientFormData.rfc,
        adc: newClientFormData.adc,
        moneda: newClientFormData.moneda,
        datos_fiscales: {
          calle: newClientFormData.calle,
          numero: newClientFormData.numero,
          cp: newClientFormData.cp,
          ciudad: newClientFormData.ciudad,
          estado: newClientFormData.estado,
        }
      };
      
      if (newClientFormData.sitio_nombre) {
        payload.sitios = [{ nombre: newClientFormData.sitio_nombre, direccion: newClientFormData.sitio_direccion }];
      }
      
      await api.post('/r4/clientes', payload);
      toast.success('Cliente creado correctamente');
      setIsNewClientModalOpen(false);
      setNewClientFormData({
        razon_social: '', rfc: '', adc: '', moneda: 'MXN', calle: '', numero: '', cp: '', ciudad: '', estado: '', sitio_nombre: '', sitio_direccion: ''
      });
      fetchClientes();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Error al crear cliente');
    } finally {
      setIsSubmittingClient(false);
    }
  };

  const handleCreateSitio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClienteId) return;
    if (!newSitioFormData.nombre) {
      toast.error('Nombre del sitio es obligatorio');
      return;
    }
    try {
      setIsSubmittingSitio(true);
      await api.post(`/r4/clientes/${selectedClienteId}/sitios`, newSitioFormData);
      toast.success('Sitio agregado correctamente');
      setIsNewSitioModalOpen(false);
      setNewSitioFormData({ nombre: '', direccion: '', region: '', no_totvs: '', responsable: '' });
      fetchClientes();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Error al crear sitio');
    } finally {
      setIsSubmittingSitio(false);
    }
  };

  const requestDeleteCliente = (id: string, name: string, sitiosCount?: number) => setDeleteModalConfig({ isOpen: true, type: 'cliente', id, name, sitiosCount });
  const requestDeleteSitio = (id: string, name: string) => setDeleteModalConfig({ isOpen: true, type: 'sitio', id, name });

  const confirmDelete = async () => {
    if (!deleteModalConfig) return;
    try {
      setIsDeleting(true);
      if (deleteModalConfig.type === 'cliente') {
        await api.delete(`/r4/clientes/${deleteModalConfig.id}`);
        toast.success("Cliente eliminado exitosamente");
        if (selectedClienteId === deleteModalConfig.id) setSelectedClienteId(null);
      } else {
        await api.delete(`/r4/sitios/${deleteModalConfig.id}`);
        toast.success("Sitio eliminado exitosamente");
      }
      fetchClientes();
      setDeleteModalConfig(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || `Error al eliminar ${deleteModalConfig.type}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const totalClientes = clientes.length;
  const totalSitios = clientes.reduce((acc, c) => acc + (c.sitiosCount || 0), 0);
  const activos = clientes.filter(c => c.estatus?.toLowerCase() === 'activo');
  const inactivos = clientes.filter(c => c.estatus?.toLowerCase() !== 'activo');

  const filteredClientes = clientes.filter((cliente: any) => {
    const matchStatus = 
      statusFilter === "todos" ? true :
      statusFilter === "activos" ? cliente.estatus?.toLowerCase() === 'activo' :
      cliente.estatus?.toLowerCase() !== 'activo';
    
    const matchSearch = !searchTerm ? true :
      (cliente.razonSocial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
       cliente.rfc?.toLowerCase().includes(searchTerm.toLowerCase()));
       
    return matchStatus && matchSearch;
  });

  const totalPages = Math.ceil(filteredClientes.length / itemsPerPage);
  const paginatedClientes = filteredClientes.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const selectedCliente = clientes.find(c => c.id === selectedClienteId) || null;

  return (
    <div className="min-h-screen bg-[#F9FAFB] p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden space-y-6">
      
      {/* HEADER SECTION */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-red-600"></div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Catálogo de Clientes y Sitios</h1>
              <p className="text-slate-500 font-medium mt-1">Administración de empresas, ubicaciones y asignación de distribuidores de servicio.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-slate-100 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm transition-all shadow-sm">
              <Filter className="w-4 h-4" />
              Filtros
            </button>
            <button 
              onClick={() => setIsNewClientModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#E5222D] hover:bg-[#CC1E28] text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-red-200"
            >
              <Plus className="w-4 h-4" />
              Nuevo Cliente
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
          <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-5 flex flex-col justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> CLIENTES ACTIVOS
            </p>
            <h3 className="text-4xl font-black text-emerald-900">{activos.length}</h3>
            <p className="text-xs font-bold text-emerald-700/70 mt-2">Empresas con servicio contratado.</p>
          </div>
          
          <div className="bg-red-50/50 border border-red-100 rounded-2xl p-5 flex flex-col justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-600 mb-2 flex items-center gap-2">
              <MapPin className="w-3 h-3"/> SITIOS ACTIVOS
            </p>
            <h3 className="text-4xl font-black text-red-900">{totalSitios}</h3>
            <p className="text-xs font-bold text-red-700/70 mt-2">Ubicaciones de operación dadas de alta.</p>
          </div>
        </div>
      </div>

      {/* TWO COLUMN LAYOUT */}
      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* LEFT COLUMN: DIRECTORIO */}
        <div className="w-full lg:w-1/3 flex flex-col gap-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col gap-4">
            
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-red-500 transition-colors" />
              <input
                type="text"
                placeholder="Buscar cliente o RFC"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-transparent rounded-2xl text-sm font-medium focus:border-red-100 focus:bg-white focus:outline-none transition-all"
              />
            </div>

            <div className="flex bg-slate-100 p-1 rounded-2xl">
              <button 
                onClick={() => {setStatusFilter("todos"); setCurrentPage(1);}}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${statusFilter === 'todos' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Todos ({totalClientes})
              </button>
              <button 
                onClick={() => {setStatusFilter("activos"); setCurrentPage(1);}}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${statusFilter === 'activos' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Activos ({activos.length})
              </button>
              <button 
                onClick={() => {setStatusFilter("inactivos"); setCurrentPage(1);}}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${statusFilter === 'inactivos' ? 'bg-white shadow-sm text-red-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Inactivos ({inactivos.length})
              </button>
            </div>
            
            <div className="flex items-center justify-between mt-2 px-1">
              <h3 className="text-sm font-black text-slate-800">Directorio</h3>
              <span className="text-xs font-bold text-slate-400">{filteredClientes.length} resultados</span>
            </div>

            <div className="flex flex-col gap-3">
              {loading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-500">
                  <div className="relative w-12 h-12">
                     <div className="absolute inset-0 border-4 border-red-50 rounded-full"></div>
                     <div className="absolute inset-0 border-4 border-[#E1000F] rounded-full border-t-transparent animate-spin"></div>
                     <Building2 className="absolute inset-0 m-auto w-5 h-5 text-[#E1000F] animate-pulse" />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando directorio...</p>
                </div>
              ) : paginatedClientes.length === 0 ? (
                 <div className="py-12 text-center text-slate-400 font-bold text-sm">No hay clientes.</div>
              ) : paginatedClientes.map((cliente) => (
                <div 
                  key={cliente.id} 
                  onClick={() => setSelectedClienteId(cliente.id)}
                  className={`p-4 rounded-2xl cursor-pointer transition-all border-2 flex flex-col gap-3 ${
                    selectedClienteId === cliente.id 
                      ? 'border-red-100 bg-red-50/30 shadow-sm' 
                      : 'border-slate-50 bg-white hover:border-slate-100 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <h4 className="font-black text-slate-900 line-clamp-1">{cliente.razonSocial}</h4>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">{cliente.rfc}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${
                      cliente.estatus?.toLowerCase() === 'activo' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {cliente.estatus}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {cliente.sitiosCount || 0} sitios
                      <span className="text-red-600 ml-1">Raymond GDL</span>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded">MXN</span>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center pt-2 px-1">
                 <button 
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-800 disabled:opacity-30"
                 >Anterior</button>
                 <span className="text-xs font-bold text-slate-400">{currentPage} / {totalPages}</span>
                 <button 
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-800 disabled:opacity-30"
                 >Siguiente</button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: DETALLE DEL CLIENTE */}
        <div className="w-full lg:w-2/3 flex flex-col gap-6">
          {!selectedCliente ? (
            <div className="bg-white rounded-3xl p-12 border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center h-full min-h-[400px]">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <Building2 className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-xl font-black text-slate-800">Ningún cliente seleccionado</h3>
              <p className="text-slate-500 font-medium mt-2 max-w-sm">Selecciona un cliente del directorio para ver su información completa, distribuidores y sitios de operación.</p>
            </div>
          ) : (
            <>
              {/* Header Card */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="flex gap-5 items-center">
                    <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center shrink-0 border border-red-100">
                      <Building2 className="w-8 h-8 text-red-500" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-900">{selectedCliente.razonSocial}</h2>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-sm font-bold text-slate-500">CLI-00{selectedCliente.id?.slice(-2) || '1'}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${
                          selectedCliente.estatus?.toLowerCase() === 'activo' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {selectedCliente.estatus}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => requestDeleteCliente(selectedCliente.id, selectedCliente.razonSocial, selectedCliente.sitiosCount)}
                      className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-red-100 hover:border-red-200 hover:bg-red-50 text-red-600 rounded-xl font-bold text-xs transition-all shadow-sm"
                    >
                      <Trash className="w-3.5 h-3.5" />
                      Eliminar
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-100 hover:border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-xs transition-all shadow-sm">
                      <Settings className="w-3.5 h-3.5" />
                      Editar Info
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-8 pt-8 border-t border-slate-100">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">RFC</p>
                    <p className="text-sm font-bold text-slate-800">{selectedCliente.rfc}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Cuenta Asociada</p>
                    <p className="text-sm font-bold text-slate-800">Cuenta Estratégica A</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">País y Moneda</p>
                    <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5"><Map className="w-3.5 h-3.5 text-slate-400"/> México • MXN</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Clave ADC</p>
                    <p className="text-sm font-bold text-slate-800 bg-slate-100 inline-block px-2 py-0.5 rounded">ADC-001</p>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><User className="w-3 h-3"/> Contacto Principal</p>
                    <p className="text-sm font-bold text-slate-800">Ing. Roberto Guzmán</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                     <p className="text-xs font-bold text-slate-600 flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-slate-400"/> +52 33 1234-5678</p>
                     <p className="text-xs font-bold text-red-600 flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-red-400"/> contacto@grupoindustrial.mx</p>
                  </div>
                </div>
              </div>

              {/* Distribuidor Card */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm flex flex-col gap-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-red-500"/>
                    Distribuidor de Mantenimiento (Nivel Cliente)
                  </h3>
                  <button className="text-[11px] font-black text-red-600 hover:text-red-700 transition-colors uppercase tracking-wider">
                    Cambiar asignación
                  </button>
                </div>
                
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 bg-white border-2 border-slate-100 rounded-2xl p-5 shadow-sm">
                     <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-lg font-black text-slate-900">Raymond GDL</h4>
                          <span className="inline-flex px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border bg-red-50 text-red-700 border-red-100 mt-1">Región Occidente</span>
                        </div>
                        <span className="flex items-center gap-1 text-xs font-bold text-slate-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100"><span className="text-amber-500">★</span> 4.7</span>
                     </div>
                     <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-slate-50">
                        <p className="text-xs font-bold text-slate-600 flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-slate-400"/> 33 1234 5678</p>
                        <p className="text-xs font-bold text-slate-600 flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-slate-400"/> soporte@raymondgdl.mx</p>
                     </div>
                  </div>
                  <div className="w-full md:w-64 bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col gap-4">
                     <div>
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Tipo de Cobertura</p>
                       <p className="text-xs font-bold text-emerald-700 flex items-center gap-1.5"><Shield className="w-3 h-3"/> Mantenimiento Total (Full Service)</p>
                     </div>
                     <div>
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Asignación</p>
                       <p className="text-sm font-bold text-slate-800">15 Ene 2025</p>
                       <p className="text-[10px] text-slate-500 font-medium mt-0.5">Por: Admin Sistema</p>
                     </div>
                     <button className="text-[10px] font-bold text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1 mt-auto">
                        <FileText className="w-3 h-3"/> Ver historial de cambios
                     </button>
                  </div>
                </div>
              </div>

              {/* Sitios de Operación */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm flex flex-col gap-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-red-500"/>
                    Sitios de Operación ({selectedCliente.sitios?.length || 0})
                  </h3>
                  <button 
                    onClick={() => setIsNewSitioModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-bold text-xs transition-all shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar Sitio
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedCliente.sitios?.length > 0 ? selectedCliente.sitios.map((sitio: any, idx: number) => (
                    <div key={sitio.id} className="border-2 border-slate-100 rounded-2xl overflow-hidden hover:border-slate-200 transition-all shadow-sm flex flex-col">
                      <div className="p-5 border-l-4 border-l-red-500 flex-1">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-black text-slate-900 text-lg">{sitio.nombre}</h4>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => requestDeleteSitio(sitio.id, sitio.nombre)}
                              className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100"
                              title="Eliminar sitio"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                            <div className="bg-slate-50 border border-slate-100 rounded-xl p-2 text-center min-w-[60px]">
                              <p className="text-sm font-black text-slate-900">{sitio.activosCount || 12}</p>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">activos</p>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs font-bold text-slate-500 mb-4">SIT-00{idx+1} • Región {idx===0?'Occidente':'Norte'} • Tienda TOTVS: TD-01{idx}</p>
                        <p className="text-sm text-slate-600 font-medium leading-relaxed">{sitio.direccion || 'Av. Periférico Nte 123, Guadalajara, JAL'}</p>
                      </div>
                      <div className="bg-slate-50 p-3 border-t border-slate-100 flex justify-between items-center px-5">
                        <p className="text-xs font-bold text-slate-600 flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-slate-400"/> 
                          {sitio.responsable && sitio.responsable !== '-' ? sitio.responsable : 'Sin responsable asignado'}
                        </p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-1.5"><Truck className="w-3.5 h-3.5"/> Raymond {idx===0?'GDL':'MTY'}</p>
                      </div>
                    </div>
                  )) : (
                    <div className="col-span-2 py-8 text-center text-slate-500 font-medium bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                      Este cliente aún no tiene sitios registrados.
                    </div>
                  )}
                </div>
              </div>

            </>
          )}
        </div>
      </div>

      {/* MODAL ALTA DE NUEVO CLIENTE */}
      {isNewClientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col relative border border-slate-100">
            <form onSubmit={handleCreateClient} className="flex flex-col h-full overflow-hidden">
            <button 
              type="button"
              onClick={() => setIsNewClientModalOpen(false)}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-8 border-b border-slate-100 shrink-0">
              <h2 className="text-2xl font-black text-slate-900">Alta de Nuevo Cliente</h2>
              <p className="text-slate-500 font-medium mt-1">Completa el formulario estándar para el registro corporativo.</p>
            </div>

            <div className="p-8 overflow-y-auto flex-1 custom-scrollbar space-y-8">
              
              <section className="space-y-4">
                <h3 className="text-sm font-black text-red-600 uppercase tracking-widest flex items-center gap-2 mb-4">
                  <Building2 className="w-4 h-4" /> Información Fiscal y Comercial
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700">Nombre o Razón Social *</label>
                    <input type="text" value={newClientFormData.razon_social} onChange={e => setNewClientFormData({...newClientFormData, razon_social: e.target.value})} placeholder="Escribe el nombre o razón social" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-red-500 focus:bg-white focus:outline-none transition-all" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700">RFC *</label>
                    <input type="text" value={newClientFormData.rfc} onChange={e => setNewClientFormData({...newClientFormData, rfc: e.target.value})} placeholder="Escribe el RFC" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-red-500 focus:bg-white focus:outline-none transition-all uppercase placeholder:normal-case" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700">Clave ADC</label>
                    <input type="text" value={newClientFormData.adc} onChange={e => setNewClientFormData({...newClientFormData, adc: e.target.value})} placeholder="Escribe la clave ADC" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-red-500 focus:bg-white focus:outline-none transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700">Moneda Preferida</label>
                    <select value={newClientFormData.moneda} onChange={e => setNewClientFormData({...newClientFormData, moneda: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:border-red-500 focus:bg-white focus:outline-none transition-all appearance-none">
                      <option value="MXN">MXN - Peso Mexicano</option>
                      <option value="USD">USD - Dólar Estadounidense</option>
                    </select>
                  </div>
                </div>
              </section>

              <hr className="border-slate-100" />

              <section className="space-y-4">
                <h3 className="text-sm font-black text-red-600 uppercase tracking-widest flex items-center gap-2 mb-4">
                  <MapPin className="w-4 h-4" /> Dirección del Cliente (Fiscal)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-black text-slate-700">Calle</label>
                    <input type="text" value={newClientFormData.calle} onChange={e => setNewClientFormData({...newClientFormData, calle: e.target.value})} placeholder="Escribe la calle" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-red-500 focus:bg-white focus:outline-none transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700">Número</label>
                    <input type="text" value={newClientFormData.numero} onChange={e => setNewClientFormData({...newClientFormData, numero: e.target.value})} placeholder="Escribe el número" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-red-500 focus:bg-white focus:outline-none transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700">Código Postal</label>
                    <input type="text" value={newClientFormData.cp} onChange={e => setNewClientFormData({...newClientFormData, cp: e.target.value})} placeholder="Escribe el código postal" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-red-500 focus:bg-white focus:outline-none transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700">Ciudad / Municipio</label>
                    <input type="text" value={newClientFormData.ciudad} onChange={e => setNewClientFormData({...newClientFormData, ciudad: e.target.value})} placeholder="Escribe la ciudad o municipio" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-red-500 focus:bg-white focus:outline-none transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700">Estado</label>
                    <input type="text" value={newClientFormData.estado} onChange={e => setNewClientFormData({...newClientFormData, estado: e.target.value})} placeholder="Escribe el estado" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-red-500 focus:bg-white focus:outline-none transition-all" />
                  </div>
                </div>
              </section>

              <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl mt-4">
                <h4 className="text-sm font-black text-slate-800 mb-1">Sitio Principal de Operación (Opcional)</h4>
                <p className="text-xs text-slate-500 font-medium mb-4">Puedes dar de alta la dirección del sitio donde operarán los equipos, si es diferente a la fiscal.</p>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700">Nombre del Sitio</label>
                    <input type="text" value={newClientFormData.sitio_nombre} onChange={e => setNewClientFormData({...newClientFormData, sitio_nombre: e.target.value})} placeholder="Escribe el nombre del sitio" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:border-red-500 focus:outline-none transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700">Dirección del sitio del cliente</label>
                    <input type="text" value={newClientFormData.sitio_direccion} onChange={e => setNewClientFormData({...newClientFormData, sitio_direccion: e.target.value})} placeholder="Calle, Número, CP, Ciudad, Estado" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:border-red-500 focus:outline-none transition-all" />
                  </div>
                </div>
              </div>

            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0 flex justify-end gap-3 rounded-b-[2rem]">
              <button 
                type="button"
                onClick={() => setIsNewClientModalOpen(false)}
                className="px-6 py-3 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-sm transition-all"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                disabled={isSubmittingClient}
                className="px-8 py-3 bg-[#E5222D] hover:bg-[#CC1E28] disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-red-200 flex items-center gap-2"
              >
                <Building2 className="w-4 h-4"/> {isSubmittingClient ? 'Guardando...' : 'Guardar Cliente'}
              </button>
            </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ALTA DE NUEVO SITIO */}
      {isNewSitioModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col relative border border-slate-100">
            <form onSubmit={handleCreateSitio} className="flex flex-col h-full overflow-hidden">
            <button 
              type="button"
              onClick={() => setIsNewSitioModalOpen(false)}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-8 border-b border-slate-100 shrink-0">
              <h2 className="text-2xl font-black text-slate-900">Agregar Sitio</h2>
              <p className="text-slate-500 font-medium mt-1">Registra un nuevo sitio de operación para este cliente.</p>
            </div>

            <div className="p-8 overflow-y-auto flex-1 custom-scrollbar space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">Nombre del Sitio *</label>
                <input type="text" value={newSitioFormData.nombre} onChange={e => setNewSitioFormData({...newSitioFormData, nombre: e.target.value})} placeholder="Escribe el nombre del sitio" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-red-500 focus:bg-white focus:outline-none transition-all" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">Dirección</label>
                <input type="text" value={newSitioFormData.direccion} onChange={e => setNewSitioFormData({...newSitioFormData, direccion: e.target.value})} placeholder="Escribe la dirección" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-red-500 focus:bg-white focus:outline-none transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">Región</label>
                <input type="text" value={newSitioFormData.region} onChange={e => setNewSitioFormData({...newSitioFormData, region: e.target.value})} placeholder="Escribe la región" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-red-500 focus:bg-white focus:outline-none transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">Número TOTVS</label>
                <input type="text" value={newSitioFormData.no_totvs} onChange={e => setNewSitioFormData({...newSitioFormData, no_totvs: e.target.value})} placeholder="Escribe el número TOTVS" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-red-500 focus:bg-white focus:outline-none transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">Responsable</label>
                <input type="text" value={newSitioFormData.responsable} onChange={e => setNewSitioFormData({...newSitioFormData, responsable: e.target.value})} placeholder="Escribe el responsable" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-red-500 focus:bg-white focus:outline-none transition-all" />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0 flex justify-end gap-3 rounded-b-[2rem]">
              <button 
                type="button"
                onClick={() => setIsNewSitioModalOpen(false)}
                className="px-6 py-3 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-sm transition-all"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                disabled={isSubmittingSitio}
                className="px-8 py-3 bg-[#E5222D] hover:bg-[#CC1E28] disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-red-200 flex items-center gap-2"
              >
                <MapPin className="w-4 h-4"/> {isSubmittingSitio ? 'Guardando...' : 'Guardar Sitio'}
              </button>
            </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL CONFIRMAR ELIMINACIÓN */}
      {deleteModalConfig?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col relative border border-slate-100 p-8 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-2">¿Estás seguro?</h2>
            <p className="text-slate-500 font-medium mb-8">
              Estás a punto de eliminar {deleteModalConfig.type === 'cliente' ? 'el cliente' : 'el sitio'} <strong className="text-slate-700">"{deleteModalConfig.name}"</strong>. 
              {deleteModalConfig.type === 'cliente' && deleteModalConfig.sitiosCount && deleteModalConfig.sitiosCount > 0 ? (
                <span className="block mt-4 text-red-600 font-medium bg-red-50 p-3 rounded-xl border border-red-100 text-sm">
                  ⚠️ Este cliente tiene <strong>{deleteModalConfig.sitiosCount} sitio{deleteModalConfig.sitiosCount > 1 ? 's' : ''}</strong> asociado{deleteModalConfig.sitiosCount > 1 ? 's' : ''}. Al continuar, también se eliminarán de forma permanente.
                </span>
              ) : (
                " Esta acción no se puede deshacer."
              )}
            </p>
            <div className="flex justify-center gap-3 w-full">
              <button 
                onClick={() => setDeleteModalConfig(null)}
                className="flex-1 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 py-3 bg-[#E5222D] hover:bg-[#CC1E28] disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-red-200"
              >
                {isDeleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
