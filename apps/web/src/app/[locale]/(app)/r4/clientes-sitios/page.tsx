"use client";

import { 
  Search, FileSpreadsheet, Building2, MapPin, Truck, ChevronRight,
  Filter, Plus, User, Phone, Mail, FileText, Settings, Shield, X, Map, Trash, Download, GitMerge, AlertTriangle
} from "lucide-react";
import { useState, useEffect } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth.store";
import { useConfigStore } from "@/store/config.store";


export default function ClientesSitios() {
  const { user } = useAuthStore();
  const isReadOnly = ['VISITANTE'].includes(user?.role?.toUpperCase() || '');
  const { roleColors } = useConfigStore();
  const currentColor = user?.role ? (roleColors[user.role.toLowerCase()] || roleColors.administrador) : roleColors.administrador;

  const [activeTab, setActiveTab] = useState<'clientes' | 'directorio'>('clientes');
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

  // Modal Edit Client
  const [isEditClientModalOpen, setIsEditClientModalOpen] = useState(false);
  const [editClientFormData, setEditClientFormData] = useState({
    razon_social: '', rfc: '', adc: '', moneda: 'MXN', calle: '', numero: '', cp: '', ciudad: '', estado: ''
  });
  const [isSubmittingEditClient, setIsSubmittingEditClient] = useState(false);

  // Modal Sitio
  const [isNewSitioModalOpen, setIsNewSitioModalOpen] = useState(false);
  const [newSitioFormData, setNewSitioFormData] = useState({
    nombre: '', direccion: '', region: '', no_totvs: '', responsable: '',
    distribuidor: '', distribuidor_contacto_nombre: '', distribuidor_contacto_telefono: '', distribuidor_contacto_correo: ''
  });
  const [isSubmittingSitio, setIsSubmittingSitio] = useState(false);

  // Modal Eliminar
  const [deleteModalConfig, setDeleteModalConfig] = useState<{ isOpen: boolean, type: 'cliente' | 'sitio', id: string, name: string, sitiosCount?: number } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal Fusionar Clientes
  const [fusionarModal, setFusionarModal] = useState<{ isOpen: boolean, sourceId: string, sourceName: string } | null>(null);
  const [fusionarSearch, setFusionarSearch] = useState('');
  const [fusionarTargetId, setFusionarTargetId] = useState<string | null>(null);
  const [isFusionando, setIsFusionando] = useState(false);

  // Modal Fusionar Sitios
  const [fusionarSitioModal, setFusionarSitioModal] = useState<{ isOpen: boolean, sourceId: string, sourceName: string, clienteId?: string, clienteNombre?: string } | null>(null);
  const [fusionarSitioSearch, setFusionarSitioSearch] = useState('');
  const [fusionarSitioTargetId, setFusionarSitioTargetId] = useState<string | null>(null);
  const [isFusionandoSitio, setIsFusionandoSitio] = useState(false);

  // Pagination for Directory
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Pagination for Directorio Tab
  const [currentPageDirectorio, setCurrentPageDirectorio] = useState(1);
  const itemsPerPageDirectorio = 10;

  const fetchClientes = async () => {
    try {
      setLoading(true);
      const res = await api.get('/r4/clientes');
      const dataArray = res.data?.data || res.data || [];
      setClientes(Array.isArray(dataArray) ? dataArray : []);
      if (dataArray.length > 0 && !selectedClienteId) {
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
    if (isReadOnly) {
      toast.error('No tienes permisos para crear clientes.');
      return;
    }
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

  const openEditClientModal = (cliente: any) => {
    setEditClientFormData({
      razon_social: cliente.razonSocial || '',
      rfc: cliente.rfc === '-' ? '' : (cliente.rfc || ''),
      adc: cliente.adc === '-' ? '' : (cliente.adc || ''),
      moneda: cliente.moneda || 'MXN',
      calle: cliente.datos_fiscales?.calle || '',
      numero: cliente.datos_fiscales?.numero || '',
      cp: cliente.datos_fiscales?.cp || '',
      ciudad: cliente.ciudad === '-' ? '' : (cliente.ciudad || ''),
      estado: cliente.estado_fiscal === '-' ? '' : (cliente.estado_fiscal || '')
    });
    setIsEditClientModalOpen(true);
  };

  const handleEditClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      toast.error('No tienes permisos para editar clientes.');
      return;
    }
    if (!selectedClienteId) return;
    if (!editClientFormData.razon_social || !editClientFormData.rfc) {
      toast.error('Razón Social y RFC son obligatorios');
      return;
    }
    
    try {
      setIsSubmittingEditClient(true);
      const payload: any = {
        razon_social: editClientFormData.razon_social,
        rfc: editClientFormData.rfc,
        adc: editClientFormData.adc,
        moneda: editClientFormData.moneda,
        datos_fiscales: {
          calle: editClientFormData.calle,
          numero: editClientFormData.numero,
          cp: editClientFormData.cp,
          ciudad: editClientFormData.ciudad,
          estado: editClientFormData.estado,
        }
      };
      
      await api.put(`/r4/clientes/${selectedClienteId}`, payload);
      toast.success('Cliente actualizado correctamente');
      setIsEditClientModalOpen(false);
      fetchClientes();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Error al actualizar cliente');
    } finally {
      setIsSubmittingEditClient(false);
    }
  };

  const handleCreateSitio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      toast.error('No tienes permisos para agregar sitios.');
      return;
    }
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
      setNewSitioFormData({ 
        nombre: '', direccion: '', region: '', no_totvs: '', responsable: '',
        distribuidor: '', distribuidor_contacto_nombre: '', distribuidor_contacto_telefono: '', distribuidor_contacto_correo: ''
      });
      fetchClientes();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Error al crear sitio');
    } finally {
      setIsSubmittingSitio(false);
    }
  };

  const requestDeleteCliente = (id: string, name: string, sitiosCount?: number) => {
    if (isReadOnly) {
      toast.error('No tienes permisos para eliminar clientes.');
      return;
    }
    setDeleteModalConfig({ isOpen: true, type: 'cliente', id, name, sitiosCount });
  };
  
  const requestDeleteSitio = (id: string, name: string) => {
    if (isReadOnly) {
      toast.error('No tienes permisos para eliminar sitios.');
      return;
    }
    setDeleteModalConfig({ isOpen: true, type: 'sitio', id, name });
  };

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

  const handleFusionarClientes = async () => {
    if (!fusionarModal || !fusionarTargetId) return;
    try {
      setIsFusionando(true);
      const res = await api.post(`/r4/clientes/${fusionarModal.sourceId}/fusionar/${fusionarTargetId}`);
      const result = res.data?.data;
      toast.success(result?.message || 'Clientes fusionados exitosamente');
      setFusionarModal(null);
      setFusionarTargetId(null);
      setFusionarSearch('');
      if (selectedClienteId === fusionarModal.sourceId) setSelectedClienteId(fusionarTargetId);
      fetchClientes();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al fusionar clientes');
    } finally {
      setIsFusionando(false);
    }
  };

  const handleFusionarSitios = async () => {
    if (!fusionarSitioModal || !fusionarSitioTargetId) return;
    try {
      setIsFusionandoSitio(true);
      const res = await api.post(`/r4/sitios/${fusionarSitioModal.sourceId}/fusionar/${fusionarSitioTargetId}`);
      const result = res.data?.data;
      toast.success(result?.message || 'Sitios fusionados exitosamente');
      setFusionarSitioModal(null);
      setFusionarSitioTargetId(null);
      setFusionarSitioSearch('');
      fetchClientes();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al fusionar sitios');
    } finally {
      setIsFusionandoSitio(false);
    }
  };

  const handleDownloadExcel = async () => {
    try {
      toast.info('Generando Excel...');
      const response = await api.get('/r4/clientes/exportar/excel', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Directorio_Clientes_y_Distribuidores.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Directorio exportado a Excel con éxito');
    } catch (error) {
      console.error(error);
      toast.error('Error al descargar el archivo Excel');
    }
  };

  const totalClientes = clientes.length;
  const totalSitios = clientes.reduce((acc, c) => acc + (c.sitiosCount || 0), 0);
  const activos = clientes.filter(c => c.estatus?.toLowerCase() === 'activo');
  const inactivos = clientes.filter(c => c.estatus?.toLowerCase() !== 'activo');

  const filteredClientes = clientes
    .filter((cliente: any) => {
      const matchStatus = 
        statusFilter === "todos" ? true :
        statusFilter === "activos" ? cliente.estatus?.toLowerCase() === 'activo' :
        cliente.estatus?.toLowerCase() !== 'activo';
      
      const matchSearch = !searchTerm ? true :
        (cliente.razonSocial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
         cliente.rfc?.toLowerCase().includes(searchTerm.toLowerCase()));
         
      return matchStatus && matchSearch;
    })
    .sort((a: any, b: any) => (a.razonSocial || a.razon_social || '').localeCompare(b.razonSocial || b.razon_social || '', 'es', { sensitivity: 'base' }));

  const totalPages = Math.ceil(filteredClientes.length / itemsPerPage);
  const paginatedClientes = filteredClientes.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const selectedCliente = clientes.find(c => c.id === selectedClienteId) || null;

  const allSites = clientes
    .flatMap((cliente: any) => 
      (cliente.sitios || []).map((sitio: any) => ({
        ...sitio,
        clienteId: cliente.id,
        clienteRazonSocial: cliente.razonSocial,
        clienteRfc: cliente.rfc,
        clienteEstatus: cliente.estatus
      }))
    )
    .sort((a: any, b: any) => {
      // Sort by client name first, then by site nombre (primary DB field)
      const clientCompare = (a.clienteRazonSocial || '').localeCompare(b.clienteRazonSocial || '', 'es', { sensitivity: 'base' });
      if (clientCompare !== 0) return clientCompare;
      const nameA = a.nombre || a.tienda || '';
      const nameB = b.nombre || b.tienda || '';
      return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
    });

  const userRoleStr = (user?.role || '').toLowerCase();
  const isAdministrator = ['administrador', 'admin', 'superadmin', 'gerente', 'coordinacion', 'coordinador'].some(r => userRoleStr.includes(r));
  const isAdc = !isAdministrator && !!user;

  // Calculate unique distributors dynamically from the database
  const loadedDistribuidores = allSites
    .map((site: any) => site.distribuidor)
    .filter((d: any) => Boolean(d) && String(d) !== '[object Object]' && String(d) !== '-');
  const baseDistribuidores = ['Raymond GDL', 'Raymond Monterrey', 'Raymond Centro', 'Raymond Bajío', 'Raymond Norte', 'Raymond Occidente'];
  const uniqueDistribuidores = isAdc
    ? (Array.from(new Set(loadedDistribuidores)).sort((a: any, b: any) => String(a).localeCompare(String(b), 'es', { sensitivity: 'base' })))
    : (Array.from(new Set([...baseDistribuidores, ...loadedDistribuidores])).sort((a: any, b: any) => String(a).localeCompare(String(b), 'es', { sensitivity: 'base' })));

  const totalPagesDirectorio = Math.ceil(allSites.length / itemsPerPageDirectorio);
  const paginatedAllSites = allSites.slice((currentPageDirectorio - 1) * itemsPerPageDirectorio, currentPageDirectorio * itemsPerPageDirectorio);
  return (
    <div className="min-h-screen bg-[#F9FAFB] p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden space-y-6">
      
      {/* HEADER SECTION */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: currentColor }}></div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl" style={{ backgroundColor: `${currentColor}15`, color: currentColor }}>
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Catálogo de Clientes y Sitios</h1>
              <p className="text-slate-500 font-medium mt-1">Administración de empresas, ubicaciones y asignación de distribuidores de servicio.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleDownloadExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold text-sm transition-all shadow-sm border border-emerald-200"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Descargar Excel
            </button>
            {!isReadOnly && (
              <button 
                onClick={() => setIsNewClientModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl font-bold text-sm transition-all shadow-md"
                style={{ backgroundColor: currentColor, boxShadow: `0 4px 14px 0 ${currentColor}40` }}
              >
                <Plus className="w-4 h-4" />
                Nuevo Cliente
              </button>
            )}
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
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#E5222D] mb-2 flex items-center gap-2">
              <MapPin className="w-3 h-3"/> SITIOS ACTIVOS
            </p>
            <h3 className="text-4xl font-black text-red-900">{totalSitios}</h3>
            <p className="text-xs font-bold text-red-700/70 mt-2">Ubicaciones de operación dadas de alta.</p>
          </div>
        </div>
      </div>

      {/* TABS SELECTOR */}
      <div className="flex bg-white rounded-2xl p-1.5 shadow-sm border border-slate-100 w-full sm:w-auto overflow-x-auto">
        <button
          onClick={() => setActiveTab('clientes')}
          className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'clientes'
              ? 'text-white shadow-md'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
          style={activeTab === 'clientes' ? { backgroundColor: currentColor, boxShadow: `0 4px 14px 0 ${currentColor}40` } : {}}
        >
          Clientes y Sitios
        </button>
        <button
          onClick={() => setActiveTab('directorio')}
          className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'directorio'
              ? 'text-white shadow-md'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
          style={activeTab === 'directorio' ? { backgroundColor: currentColor, boxShadow: `0 4px 14px 0 ${currentColor}40` } : {}}
        >
          Directorio de Distribuidores
        </button>
      </div>

      {activeTab === 'clientes' ? (
        /* TWO COLUMN LAYOUT */
        <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in duration-300">
          
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
                <h3 className="text-sm font-black text-slate-800">Clientes</h3>
                <span className="text-xs font-bold text-slate-400">{filteredClientes.length} resultados</span>
              </div>

              <div className="flex flex-col gap-3">
                {loading ? (
                  <div className="flex flex-col gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="p-4 rounded-2xl border border-slate-100 bg-white shadow-xs space-y-3 animate-pulse">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1.5 w-3/4">
                            <div className="h-4 bg-slate-200 rounded w-2/3" />
                            <div className="h-3 bg-slate-100 rounded w-1/3" />
                          </div>
                          <div className="h-4 w-12 bg-slate-100 rounded" />
                        </div>
                        <div className="pt-2 border-t border-slate-50 flex justify-between">
                          <div className="h-3 w-16 bg-slate-100 rounded" />
                          <div className="h-3 w-8 bg-slate-100 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : paginatedClientes.length === 0 ? (
                  <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center gap-2">
                    <Building2 className="w-8 h-8 text-slate-300" />
                    <p className="text-slate-600 font-bold text-xs">No se encontraron clientes</p>
                    <p className="text-slate-400 text-[11px] max-w-[200px]">Prueba con otro término de búsqueda o agrega un nuevo cliente con el botón superior.</p>
                  </div>
                ) : paginatedClientes.map((cliente) => (
                  <div 
                    key={cliente.id} 
                    onClick={() => setSelectedClienteId(cliente.id)}
                    className={`p-4 rounded-2xl cursor-pointer transition-all border-2 flex flex-col gap-3 ${
                      selectedClienteId === cliente.id 
                        ? 'bg-slate-50 shadow-sm' 
                        : 'border-slate-50 bg-white hover:border-slate-100 hover:shadow-sm'
                    }`}
                    style={selectedClienteId === cliente.id ? { borderColor: currentColor } : {}}
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
                      </div>
                      <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{cliente.moneda}</span>
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
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 border" style={{ backgroundColor: `${currentColor}15`, color: currentColor, borderColor: `${currentColor}30` }}>
                        <Building2 className="w-8 h-8" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-black text-slate-900">{selectedCliente.razonSocial}</h2>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-sm font-bold text-slate-500">Código TOTVS: {selectedCliente.no_totvs || selectedCliente.codigo_totvs || selectedCliente.id?.slice(-6) || '1'}</span>
                          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${
                            selectedCliente.estatus?.toLowerCase() === 'activo' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {selectedCliente.estatus}
                          </span>
                        </div>
                      </div>
                    </div>
                    {!isReadOnly && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button 
                          onClick={() => requestDeleteCliente(selectedCliente.id, selectedCliente.razonSocial, selectedCliente.sitiosCount)}
                          className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-red-100 hover:border-red-200 hover:bg-red-50 text-red-600 rounded-xl font-bold text-xs transition-all shadow-sm"
                        >
                          <Trash className="w-3.5 h-3.5" />
                          Eliminar
                        </button>
                        <button 
                          onClick={() => {
                            setFusionarSearch('');
                            setFusionarTargetId(null);
                            setFusionarModal({ isOpen: true, sourceId: selectedCliente.id, sourceName: selectedCliente.razonSocial });
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-amber-100 hover:border-amber-200 hover:bg-amber-50 text-amber-700 rounded-xl font-bold text-xs transition-all shadow-sm"
                        >
                          <GitMerge className="w-3.5 h-3.5" />
                          Fusionar con...
                        </button>
                        <button 
                          onClick={() => openEditClientModal(selectedCliente)}
                          className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-100 hover:border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-xs transition-all shadow-sm"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          Editar Info
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-8 pt-8 border-t border-slate-100">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">RFC</p>
                      <p className="text-sm font-bold text-slate-800">{selectedCliente.rfc}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Moneda Preferida</p>
                      <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5"><Map className="w-3.5 h-3.5 text-slate-400"/> {selectedCliente.moneda || 'MXN'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Ciudad / Estado</p>
                      <p className="text-sm font-bold text-slate-800">{selectedCliente.ciudad || '-'}, {selectedCliente.estado_fiscal || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Clave ADC</p>
                      <p className="text-sm font-bold text-slate-800 bg-slate-100 inline-block px-2 py-0.5 rounded">{selectedCliente.adc || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Sitios de Operación */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm flex flex-col gap-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <MapPin className="w-5 h-5" style={{ color: currentColor }}/>
                      Sitios de Operación ({selectedCliente.sitios?.length || 0})
                    </h3>
                    {!isReadOnly && (
                      <button 
                        onClick={() => setIsNewSitioModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-white rounded-xl font-bold text-xs transition-all shadow-sm"
                        style={{ backgroundColor: currentColor }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Agregar Sitio
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedCliente.sitios?.length > 0 ? [...selectedCliente.sitios].sort((a: any, b: any) => {
                      const getTitle = (s: any) => {
                        const cuenta = (s.cuenta && s.cuenta !== '-') ? s.cuenta : (selectedCliente?.razonSocial || selectedCliente?.nombre || '');
                        const tienda = (s.tienda && s.tienda !== '-') ? s.tienda : (s.nombre && s.nombre !== '-' ? s.nombre : '');
                        if (cuenta && tienda && cuenta !== tienda) return `${cuenta} / ${tienda}`;
                        return tienda || cuenta || s.nombre || 'Sitio de Operación';
                      };
                      return getTitle(a).localeCompare(getTitle(b), 'es', { sensitivity: 'base', numeric: true });
                    }).map((sitio: any, idx: number) => {
                      const cuentaVal = (sitio.cuenta && sitio.cuenta !== '-') ? sitio.cuenta : (selectedCliente?.razonSocial || selectedCliente?.nombre || '');
                      const tiendaVal = (sitio.tienda && sitio.tienda !== '-') ? sitio.tienda : (sitio.nombre && sitio.nombre !== '-' ? sitio.nombre : '');
                      const displayTitle = (cuentaVal && tiendaVal && cuentaVal !== tiendaVal) 
                        ? `${cuentaVal} / ${tiendaVal}` 
                        : (tiendaVal || cuentaVal || sitio.nombre || 'Sitio de Operación');

                      return (
                        <div key={sitio.id} className="border-2 border-slate-100 rounded-2xl overflow-hidden hover:border-slate-200 transition-all shadow-sm flex flex-col">
                          <div className="p-5 flex-1 space-y-3" style={{ borderLeft: `4px solid ${currentColor}` }}>
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-black text-slate-900 text-lg">{displayTitle}</h4>
                                <p className="text-[10px] font-bold text-slate-500 mt-0.5">Código TOTVS: {sitio.no_totvs && sitio.no_totvs !== '-' ? sitio.no_totvs : '-'}</p>
                              </div>
                            <div className="flex items-center gap-2">
                              {!isReadOnly && (
                                <>
                                  <button
                                    onClick={() => {
                                      setFusionarSitioSearch('');
                                      setFusionarSitioTargetId(null);
                                      setFusionarSitioModal({
                                        isOpen: true,
                                        sourceId: sitio.id,
                                        sourceName: displayTitle,
                                        clienteId: selectedCliente.id,
                                        clienteNombre: selectedCliente.razonSocial || selectedCliente.nombre
                                      });
                                    }}
                                    className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors border border-transparent"
                                    title="Fusionar sitio con otro"
                                  >
                                    <GitMerge className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => requestDeleteSitio(sitio.id, sitio.nombre)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent"
                                    title="Eliminar sitio"
                                  >
                                    <Trash className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                              <div className="bg-slate-50 border border-slate-100 rounded-xl p-2 text-center min-w-[60px]">
                                <p className="text-sm font-black text-slate-900">{sitio.activosCount || 0}</p>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">activos</p>
                              </div>
                            </div>
                          </div>
                          
                          <p className="text-sm text-slate-600 font-medium leading-relaxed">{sitio.direccion || 'Sin dirección registrada'}</p>
                          
                          {/* Distribuidor Info Block */}
                          <div className="bg-slate-50/80 border border-slate-100 p-3.5 rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Distribuidor</span>
                              <span className="text-xs font-bold flex items-center gap-1" style={{ color: currentColor }}><Truck className="w-3.5 h-3.5"/> {sitio.distribuidor && String(sitio.distribuidor) !== '[object Object]' && String(sitio.distribuidor) !== '-' ? sitio.distribuidor : 'No asignado'}</span>
                            </div>
                            {sitio.distribuidor_contacto_nombre && sitio.distribuidor_contacto_nombre !== '-' && (
                              <div className="pt-2 border-t border-slate-200/50 space-y-1.5">
                                <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                  <User className="w-3 h-3 text-slate-400"/> {sitio.distribuidor_contacto_nombre}
                                </p>
                                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-[11px] text-slate-500 font-medium">
                                  <span className="flex items-center gap-1"><Phone className="w-3 h-3"/> {sitio.distribuidor_contacto_telefono || '-'}</span>
                                  <span className="flex items-center gap-1"><Mail className="w-3 h-3"/> {sitio.distribuidor_contacto_correo || '-'}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }) : (
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
      ) : (
        /* TAB 2: DIRECTORIO DE DISTRIBUIDORES */
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm animate-in fade-in duration-300 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">Directorio Unificado de Distribuidores</h2>
              <p className="text-slate-500 text-sm mt-1">Listado completo de clientes, sitios de operación y sus distribuidores de servicio técnico asignados.</p>
            </div>
            <button
              onClick={handleDownloadExcel}
              className="flex items-center justify-center gap-2 px-5 py-3 text-white rounded-2xl font-bold text-sm transition-all shadow-md self-start sm:self-auto"
              style={{ backgroundColor: currentColor }}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Descargar Excel Completo
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-slate-100">
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Sitio / Sucursal</th>
                  <th className="p-4">Ejecutivo (ADC)</th>
                  <th className="p-4">Distribuidor Asignado</th>
                  <th className="p-4">Contacto Técnico</th>
                  <th className="p-4">Estatus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
                {paginatedAllSites.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-400">
                      No se encontraron sitios o distribuidores registrados.
                    </td>
                  </tr>
                ) : paginatedAllSites.map((site: any) => {
                  const safeStr = (v: any) => {
                    if (v === null || v === undefined) return '-';
                    if (typeof v === 'object') {
                      if ('text' in v && typeof v.text === 'string') return v.text.trim();
                      if ('hyperlink' in v && typeof v.hyperlink === 'string') return v.hyperlink.replace(/^mailto:/i, '').trim();
                      return '-';
                    }
                    const s = String(v).trim();
                    if (s === '[object Object]' || s === '' || s === 'null' || s === 'undefined') return '-';
                    return s;
                  };

                  const adcTel = safeStr(site.contacto_operativo?.adc_telefono);
                  const adcMail = safeStr(site.contacto_operativo?.adc_correo);
                  const distNombre = safeStr(site.distribuidor);
                  const cNombre = safeStr(site.distribuidor_contacto_nombre);
                  const cTel = safeStr(site.distribuidor_contacto_telefono);
                  const cMail = safeStr(site.distribuidor_contacto_correo);

                  return (
                  <tr key={site.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{site.clienteRazonSocial}</span>
                        <span className="text-xs text-slate-400">{safeStr(site.clienteRfc)}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">{site.nombre}</span>
                        <span className="text-xs text-slate-500 truncate max-w-[200px]" title={site.direccion}>{safeStr(site.direccion)}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      {site.adc && site.adc !== '-' && site.adc !== 'Sin ADC' ? (
                        <div className="flex flex-col text-xs">
                          <span className="font-bold text-slate-800">{site.adc}</span>
                          {adcTel !== '-' && <span className="text-slate-500">{adcTel}</span>}
                          {adcMail !== '-' && <span style={{ color: currentColor }}>{adcMail}</span>}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Sin ADC</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 border rounded-xl text-xs font-bold" style={{ color: currentColor, borderColor: `${currentColor}30`, backgroundColor: `${currentColor}10` }}>
                        <Truck className="w-3.5 h-3.5"/>
                        {distNombre !== '-' ? distNombre : 'No asignado'}
                      </span>
                    </td>
                    <td className="p-4">
                      {cNombre !== '-' ? (
                        <div className="flex flex-col text-xs">
                          <span className="font-bold text-slate-800">{cNombre}</span>
                          {cTel !== '-' && <span className="text-slate-500">{cTel}</span>}
                          {cMail !== '-' && <span style={{ color: currentColor }}>{cMail}</span>}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Sin contacto registrado</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${
                        site.clienteEstatus?.toLowerCase() === 'activo' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {site.clienteEstatus}
                      </span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls for Directorio */}
          {totalPagesDirectorio > 1 && (
            <div className="flex justify-center items-center py-4 gap-4">
               <button 
                onClick={() => setCurrentPageDirectorio(p => Math.max(p - 1, 1))}
                disabled={currentPageDirectorio === 1}
                className="px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-slate-800 disabled:opacity-30 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
               >Anterior</button>
               <span className="text-sm font-bold text-slate-600 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                 Página {currentPageDirectorio} de {totalPagesDirectorio}
               </span>
               <button 
                onClick={() => setCurrentPageDirectorio(p => Math.min(p + 1, totalPagesDirectorio))}
                disabled={currentPageDirectorio === totalPagesDirectorio}
                className="px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-slate-800 disabled:opacity-30 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
               >Siguiente</button>
            </div>
          )}
        </div>
      )}

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
                <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 mb-4" style={{ color: currentColor }}>
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
                <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 mb-4" style={{ color: currentColor }}>
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
                className="px-8 py-3 text-white rounded-xl font-bold text-sm transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
                style={{ backgroundColor: currentColor, boxShadow: `0 4px 14px 0 ${currentColor}40` }}
              >
                <Building2 className="w-4 h-4"/> {isSubmittingClient ? 'Guardando...' : 'Guardar Cliente'}
              </button>
            </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR CLIENTE */}
      {isEditClientModalOpen && selectedCliente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col relative border border-slate-100">
            <form onSubmit={handleEditClient} className="flex flex-col h-full overflow-hidden">
            <div className="flex justify-between items-center p-8 pb-4">
              <h3 className="text-sm font-black uppercase tracking-widest" style={{ color: currentColor }}>Editar Cliente</h3>
              <button type="button" onClick={() => setIsEditClientModalOpen(false)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-8 pt-0 overflow-y-auto flex-1 custom-scrollbar space-y-8">
              <section className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 mb-4" style={{ color: currentColor }}>
                  <Building2 className="w-4 h-4" /> Información Fiscal y Comercial
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700">Nombre o Razón Social *</label>
                    <input type="text" value={editClientFormData.razon_social} onChange={e => setEditClientFormData({...editClientFormData, razon_social: e.target.value})} placeholder="Escribe el nombre o razón social" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-red-500 focus:bg-white focus:outline-none transition-all" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700">RFC *</label>
                    <input type="text" value={editClientFormData.rfc} onChange={e => setEditClientFormData({...editClientFormData, rfc: e.target.value})} placeholder="Escribe el RFC" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-red-500 focus:bg-white focus:outline-none transition-all uppercase placeholder:normal-case" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700">Clave ADC</label>
                    <input type="text" value={editClientFormData.adc} onChange={e => setEditClientFormData({...editClientFormData, adc: e.target.value})} placeholder="Escribe la clave ADC" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-red-500 focus:bg-white focus:outline-none transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700">Moneda Preferida</label>
                    <select value={editClientFormData.moneda} onChange={e => setEditClientFormData({...editClientFormData, moneda: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:border-red-500 focus:bg-white focus:outline-none transition-all appearance-none">
                      <option value="MXN">MXN - Peso Mexicano</option>
                      <option value="USD">USD - Dólar Estadounidense</option>
                    </select>
                  </div>
                </div>
              </section>

              <hr className="border-slate-100" />

              <section className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 mb-4" style={{ color: currentColor }}>
                  <MapPin className="w-4 h-4" /> Dirección del Cliente (Fiscal)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-black text-slate-700">Calle</label>
                    <input type="text" value={editClientFormData.calle} onChange={e => setEditClientFormData({...editClientFormData, calle: e.target.value})} placeholder="Escribe la calle" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-red-500 focus:bg-white focus:outline-none transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700">Número</label>
                    <input type="text" value={editClientFormData.numero} onChange={e => setEditClientFormData({...editClientFormData, numero: e.target.value})} placeholder="Escribe el número" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-red-500 focus:bg-white focus:outline-none transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700">Código Postal</label>
                    <input type="text" value={editClientFormData.cp} onChange={e => setEditClientFormData({...editClientFormData, cp: e.target.value})} placeholder="Escribe el código postal" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-red-500 focus:bg-white focus:outline-none transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700">Ciudad / Municipio</label>
                    <input type="text" value={editClientFormData.ciudad} onChange={e => setEditClientFormData({...editClientFormData, ciudad: e.target.value})} placeholder="Escribe la ciudad o municipio" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-red-500 focus:bg-white focus:outline-none transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700">Estado</label>
                    <input type="text" value={editClientFormData.estado} onChange={e => setEditClientFormData({...editClientFormData, estado: e.target.value})} placeholder="Escribe el estado" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-red-500 focus:bg-white focus:outline-none transition-all" />
                  </div>
                </div>
              </section>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0 flex justify-end gap-3 rounded-b-[2rem]">
              <button 
                type="button"
                onClick={() => setIsEditClientModalOpen(false)}
                className="px-6 py-3 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-sm transition-all"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                disabled={isSubmittingEditClient}
                className="px-8 py-3 text-white rounded-xl font-bold text-sm transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
                style={{ backgroundColor: currentColor, boxShadow: `0 4px 14px 0 ${currentColor}40` }}
              >
                <Settings className="w-4 h-4"/> {isSubmittingEditClient ? 'Guardando...' : 'Guardar Cambios'}
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
                <label className="text-xs font-black text-slate-700">Código TOTVS</label>
                <input type="text" value={newSitioFormData.no_totvs} onChange={e => setNewSitioFormData({...newSitioFormData, no_totvs: e.target.value})} placeholder="Escribe el Código TOTVS" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-red-500 focus:bg-white focus:outline-none transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">Responsable de Operación</label>
                <input type="text" value={newSitioFormData.responsable} onChange={e => setNewSitioFormData({...newSitioFormData, responsable: e.target.value})} placeholder="Escribe el responsable de operación" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-red-500 focus:bg-white focus:outline-none transition-all" />
              </div>

              <hr className="border-slate-100 my-4" />
              <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2" style={{ color: currentColor }}>
                <Truck className="w-4 h-4"/> Asignación de Distribuidor
              </h3>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">Distribuidor que atiende</label>
                <select value={newSitioFormData.distribuidor} onChange={e => setNewSitioFormData({...newSitioFormData, distribuidor: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:border-red-500 focus:outline-none transition-all">
                  <option value="">Seleccionar Distribuidor</option>
                  {uniqueDistribuidores.map(d => (
                    <option key={String(d)} value={String(d)}>{String(d)}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">Contacto de Distribuidor (Nombre)</label>
                <input type="text" value={newSitioFormData.distribuidor_contacto_nombre} onChange={e => setNewSitioFormData({...newSitioFormData, distribuidor_contacto_nombre: e.target.value})} placeholder="Nombre del contacto del distribuidor" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-red-500 focus:bg-white focus:outline-none transition-all" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700">Teléfono</label>
                  <input type="text" value={newSitioFormData.distribuidor_contacto_telefono} onChange={e => setNewSitioFormData({...newSitioFormData, distribuidor_contacto_telefono: e.target.value})} placeholder="Teléfono" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-red-500 focus:bg-white focus:outline-none transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700">Correo</label>
                  <input type="email" value={newSitioFormData.distribuidor_contacto_correo} onChange={e => setNewSitioFormData({...newSitioFormData, distribuidor_contacto_correo: e.target.value})} placeholder="Correo" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-red-500 focus:bg-white focus:outline-none transition-all" />
                </div>
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
                className="px-8 py-3 text-white rounded-xl font-bold text-sm transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
                style={{ backgroundColor: currentColor, boxShadow: `0 4px 14px 0 ${currentColor}40` }}
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
                disabled={isDeleting || (deleteModalConfig.type === 'cliente' && (deleteModalConfig.sitiosCount || 0) > 0)}
                className="flex-1 py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: currentColor, boxShadow: `0 4px 14px 0 ${currentColor}40` }}
              >
                {isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FUSIONAR CLIENTES */}
      {fusionarModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col border border-slate-100">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center">
                  <GitMerge className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">Fusionar Cliente</h2>
                  <p className="text-xs text-slate-500 font-medium">Selecciona el cliente destino</p>
                </div>
              </div>
              <button onClick={() => setFusionarModal(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Source info */}
            <div className="px-6 pt-4 pb-3">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">Cliente a eliminar (duplicado)</p>
                <p className="font-black text-slate-900">{fusionarModal.sourceName}</p>
                <p className="text-xs text-amber-700 mt-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Sus sitios, activos y rentas serán migrados al cliente destino y este será eliminado.
                </p>
              </div>

              {/* Search target */}
              <p className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2">Fusionar en...</p>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar cliente destino..."
                  value={fusionarSearch}
                  onChange={(e) => { setFusionarSearch(e.target.value); setFusionarTargetId(null); }}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-medium focus:border-amber-200 focus:bg-white focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Client list */}
            <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-2">
              {clientes
                .filter(c => c.id !== fusionarModal.sourceId)
                .filter(c => !fusionarSearch || c.razonSocial?.toLowerCase().includes(fusionarSearch.toLowerCase()) || c.rfc?.toLowerCase().includes(fusionarSearch.toLowerCase()))
                .slice(0, 20)
                .map(c => (
                  <button
                    key={c.id}
                    onClick={() => setFusionarTargetId(c.id)}
                    className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all ${
                      fusionarTargetId === c.id
                        ? 'border-amber-400 bg-amber-50'
                        : 'border-slate-100 hover:border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-black text-slate-900 text-sm">{c.razonSocial}</p>
                        <p className="text-xs text-slate-500">{c.rfc && c.rfc !== '-' ? c.rfc : 'Sin RFC'}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] font-bold text-slate-400">{c.sitiosCount || 0} sitios</span>
                        {fusionarTargetId === c.id && (
                          <span className="text-[9px] font-black text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full uppercase tracking-widest">Seleccionado</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              {clientes.filter(c => c.id !== fusionarModal.sourceId && (!fusionarSearch || c.razonSocial?.toLowerCase().includes(fusionarSearch.toLowerCase()) || c.rfc?.toLowerCase().includes(fusionarSearch.toLowerCase()))).length === 0 && (
                <p className="text-center text-slate-400 font-medium text-sm py-8">No se encontraron clientes</p>
              )}
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setFusionarModal(null)}
                className="flex-1 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleFusionarClientes}
                disabled={!fusionarTargetId || isFusionando}
                className="flex-1 py-3 text-white rounded-xl font-black text-sm transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ backgroundColor: '#D97706' }}
              >
                <GitMerge className="w-4 h-4" />
                {isFusionando ? 'Fusionando...' : 'Confirmar Fusión'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Fusionar Sitio */}
      {fusionarSitioModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col border border-slate-100">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center">
                  <GitMerge className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">Fusionar Sitio</h2>
                  <p className="text-xs text-slate-500 font-medium">Selecciona el sitio destino</p>
                </div>
              </div>
              <button onClick={() => setFusionarSitioModal(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Source info */}
            <div className="px-6 pt-4 pb-3">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">Sitio a eliminar (duplicado)</p>
                <p className="font-black text-slate-900 text-base">{fusionarSitioModal.sourceName}</p>
                {fusionarSitioModal.clienteNombre && (
                  <p className="text-xs font-bold text-slate-500 mt-0.5">Cliente actual: {fusionarSitioModal.clienteNombre}</p>
                )}
                <p className="text-xs text-amber-700 mt-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Sus activos, rentas y contratos serán migrados al sitio destino seleccionado y este sitio será eliminado.
                </p>
              </div>

              {/* Search target */}
              <p className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2">Fusionar en...</p>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar sitio por nombre, código TOTVS o cliente..."
                  value={fusionarSitioSearch}
                  onChange={(e) => { setFusionarSitioSearch(e.target.value); setFusionarSitioTargetId(null); }}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-medium focus:border-amber-200 focus:bg-white focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Sites list */}
            <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-2">
              {allSites
                .filter(s => s.id !== fusionarSitioModal.sourceId)
                .filter(s => {
                  if (!fusionarSitioSearch) return true;
                  const query = fusionarSitioSearch.toLowerCase();
                  return (
                    (s.nombre && s.nombre.toLowerCase().includes(query)) ||
                    (s.tienda && s.tienda.toLowerCase().includes(query)) ||
                    (s.cuenta && s.cuenta.toLowerCase().includes(query)) ||
                    (s.no_totvs && s.no_totvs.toLowerCase().includes(query)) ||
                    (s.direccion && s.direccion.toLowerCase().includes(query)) ||
                    (s.distribuidor && s.distribuidor.toLowerCase().includes(query)) ||
                    (s.clienteRazonSocial && s.clienteRazonSocial.toLowerCase().includes(query))
                  );
                })
                .sort((a, b) => {
                  // Prioritize sites from the same client
                  const aSameClient = a.clienteId === fusionarSitioModal.clienteId ? 1 : 0;
                  const bSameClient = b.clienteId === fusionarSitioModal.clienteId ? 1 : 0;
                  if (aSameClient !== bSameClient) return bSameClient - aSameClient;
                  const nameA = a.nombre || a.tienda || '';
                  const nameB = b.nombre || b.tienda || '';
                  return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
                })
                .slice(0, 30)
                .map(s => {
                  const isSameClient = s.clienteId === fusionarSitioModal.clienteId;
                  const displayTitle = (s.cuenta && s.tienda && s.cuenta !== s.tienda && s.cuenta !== '-' && s.tienda !== '-')
                    ? `${s.cuenta} / ${s.tienda}`
                    : (s.tienda || s.cuenta || s.nombre || 'Sitio de Operación');

                  return (
                    <button
                      key={s.id}
                      onClick={() => setFusionarSitioTargetId(s.id)}
                      className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all ${
                        fusionarSitioTargetId === s.id
                          ? 'border-amber-400 bg-amber-50'
                          : 'border-slate-100 hover:border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0 pr-3">
                          <div className="flex items-center gap-2">
                            <p className="font-black text-slate-900 text-sm truncate">{displayTitle}</p>
                            {isSameClient && (
                              <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded shrink-0">
                                Mismo Cliente
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                            {s.no_totvs && s.no_totvs !== '-' && (
                              <span>TOTVS: {s.no_totvs}</span>
                            )}
                            {s.clienteRazonSocial && !isSameClient && (
                              <span className="truncate">Cliente: {s.clienteRazonSocial}</span>
                            )}
                          </div>
                          {s.direccion && s.direccion !== '-' && (
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">{s.direccion}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[10px] font-bold text-slate-400">{s.activosCount || 0} activos</span>
                          {fusionarSitioTargetId === s.id && (
                            <span className="text-[9px] font-black text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full uppercase tracking-widest">Seleccionado</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              {allSites.filter(s => s.id !== fusionarSitioModal.sourceId && (!fusionarSitioSearch || (
                (s.nombre && s.nombre.toLowerCase().includes(fusionarSitioSearch.toLowerCase())) ||
                (s.tienda && s.tienda.toLowerCase().includes(fusionarSitioSearch.toLowerCase())) ||
                (s.cuenta && s.cuenta.toLowerCase().includes(fusionarSitioSearch.toLowerCase())) ||
                (s.no_totvs && s.no_totvs.toLowerCase().includes(fusionarSitioSearch.toLowerCase())) ||
                (s.direccion && s.direccion.toLowerCase().includes(fusionarSitioSearch.toLowerCase())) ||
                (s.clienteRazonSocial && s.clienteRazonSocial.toLowerCase().includes(fusionarSitioSearch.toLowerCase()))
              ))).length === 0 && (
                <p className="text-center text-slate-400 font-medium text-sm py-8">No se encontraron sitios</p>
              )}
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setFusionarSitioModal(null)}
                className="flex-1 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleFusionarSitios}
                disabled={!fusionarSitioTargetId || isFusionandoSitio}
                className="flex-1 py-3 text-white rounded-xl font-black text-sm transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ backgroundColor: '#D97706' }}
              >
                <GitMerge className="w-4 h-4" />
                {isFusionandoSitio ? 'Fusionando...' : 'Confirmar Fusión'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
