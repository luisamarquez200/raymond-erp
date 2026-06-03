"use client";

import { 
  Search, Filter, Download, Grid3x3, List, Plus, Eye, Edit, 
  FileText, Clock, CheckCircle, Upload, X, FileSpreadsheet, 
  Wrench, Activity, CheckCircle2, AlertTriangle, ChevronRight, ShieldCheck, MapPin, Truck, HardDrive, Info
} from "lucide-react";
import { Link } from "@/i18n/routing"; // Next-intl custom link
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import api from "@/lib/api";
import { toast } from "sonner";

// Mock user since useAppUser from RootLayout might not exist in exactly the same way here
const useAppUser = () => {
  return { role: "admin", adcAsignado: "Juan Pérez" };
};

const statusColors = {
  "Activo": "bg-emerald-50 text-emerald-700 border-emerald-100",
  "En Renta": "bg-blue-50 text-blue-700 border-blue-100",
  "Inactivo": "bg-gray-50 text-gray-600 border-gray-200",
  "Disponible": "bg-blue-50 text-blue-700 border-blue-100",
  "Back Up": "bg-blue-50 text-blue-700 border-blue-100",
  "Inactivo con cliente": "bg-amber-50 text-amber-700 border-amber-100",
  "En Taller": "bg-amber-50 text-amber-700 border-amber-100",
  "Mantenimiento": "bg-amber-50 text-amber-700 border-amber-100",
};

const smpColors = {
  "Al día": "text-emerald-700 bg-emerald-50 border-emerald-100",
  "Pendiente": "text-amber-700 bg-amber-50 border-amber-100",
  "Vencido": "text-red-700 bg-red-50 border-red-100",
  "Sin SMP": "text-gray-600 bg-gray-50 border-gray-200",
};

export default function Fleet() {
  const { role, adcAsignado } = useAppUser();
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [fleetAssets, setFleetAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [selectedADC, setSelectedADC] = useState<string>("Todos");

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

  useEffect(() => {
    fetchFlotilla();
  }, []);

  const [isNewAssetModalOpen, setIsNewAssetModalOpen] = useState(false);
  const [newAssetTipo, setNewAssetTipo] = useState("Montacargas");

  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<any>({});
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const startEditing = (e: React.MouseEvent, asset: any) => {
    e.stopPropagation();
    setEditingRowId(asset.serie);
    setEditingData({ ...asset });
    setIsEditModalOpen(true);
  };

  const cancelEditing = () => {
    setEditingRowId(null);
    setEditingData({});
    setIsEditModalOpen(false);
  };

  const saveEditing = async () => {
    try {
      // await api.put(`/r4/flotilla/${editingRowId}`, editingData); // Real API call
      setFleetAssets(prev => prev.map(a => a.serie === editingRowId ? { ...a, ...editingData } : a));
      toast.success("Activo actualizado correctamente");
      cancelEditing();
    } catch (error) {
      console.error(error);
      toast.error("Error al actualizar el activo");
    }
  };

  // Transfer Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedAssetForTransfer, setSelectedAssetForTransfer] = useState<any>(null);

  const openTransferModal = (asset: any) => {
    setSelectedAssetForTransfer(asset);
    setIsTransferModalOpen(true);
  };

  // ADC Visual Visibility Logic
  const baseAssets = role === "adc_user" 
    ? fleetAssets.filter(a => a.adc?.toLowerCase() === adcAsignado?.toLowerCase())
    : fleetAssets;
    
  const getValidString = (val: any) => typeof val === 'string' && val !== '[object Object]' ? val : null;
  const uniqueADCs = Array.from(new Set(baseAssets.map(a => getValidString(a.adc)).filter(Boolean))).sort();
  const uniqueClientes = Array.from(new Set(baseAssets.map(a => getValidString(a.cliente)).filter(Boolean))).sort();
  const uniqueSites = Array.from(new Set(baseAssets.map(a => getValidString(a.site)).filter(Boolean))).sort();
  const uniqueCuentas = Array.from(new Set(baseAssets.map(a => getValidString(a.cuenta)).filter(Boolean))).sort();
  const uniqueDistribuidores = Array.from(new Set(baseAssets.map(a => getValidString(a.distribuidor)).filter(Boolean))).sort();

  const filteredAssets = baseAssets.filter((asset: any) => {
    if (selectedADC !== "Todos" && asset.adc !== selectedADC) return false;
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

  // Stock Rules
  const getEstatusCount = (statusList: string[]) => 
    filteredAssets.filter(a => a && a.estatus && statusList.includes(a.estatus.toUpperCase())).length;

  const statusCounts = {
    totalActivos: filteredAssets.length,
    enRenta: getEstatusCount(['ACTIVO', 'EN RENTA']),
    disponibles: getEstatusCount(['DISPONIBLE', 'BACK UP']),
    mantenimiento: getEstatusCount(['MANTENIMIENTO', 'EN TALLER', 'INACTIVO CON CLIENTE']),
    inactivos: getEstatusCount(['INACTIVO']),
    movimientos: 0, // Pendiente de conexión real
    docsPendientes: 0 // Pendiente de conexión real
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
          fetchFlotilla(); // Refresh the list
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
          {role === 'admin' && (
            <button onClick={() => setIsNewAssetModalOpen(true)} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-amber-100">
              <Plus className="w-4 h-4" />
              Alta de Equipo
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
        
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
        
        <div className="bg-white p-4 sm:p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-amber-100 hover:shadow-md transition-all">
          <p className="text-amber-600 text-[10px] font-black uppercase tracking-widest mb-2 line-clamp-1">Mantenimiento</p>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900">{statusCounts.mantenimiento}</h3>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-red-100 hover:shadow-md transition-all">
          <p className="text-red-600 text-[10px] font-black uppercase tracking-widest mb-2 line-clamp-1">Inactivos</p>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900">{statusCounts.inactivos}</h3>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-slate-300 hover:shadow-md transition-all">
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2 line-clamp-1">Movimientos</p>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900">{statusCounts.movimientos}</h3>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-slate-300 hover:shadow-md transition-all">
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2 line-clamp-1">Docs Pend.</p>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900">{statusCounts.docsPendientes}</h3>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative group flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-amber-500 transition-colors" />
            <input
              type="text"
              placeholder="Buscar por Serie, Cliente o Modelo"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Reset page on search
              }}
              className="w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-medium focus:border-amber-500 focus:outline-none transition-all shadow-sm"
            />
          </div>
          
          <div className="relative group w-full sm:w-64">
            <select
              value={selectedADC}
              onChange={(e) => {
                setSelectedADC(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-4 pr-10 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:border-amber-500 focus:outline-none transition-all shadow-sm appearance-none cursor-pointer"
            >
              <option value="Todos">Todos los ADCs</option>
              {(uniqueADCs as string[]).map(adc => (
                <option key={adc} value={adc}>{adc}</option>
              ))}
            </select>
            <Filter className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
            <select className="px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-500 transition-all shadow-sm shrink-0">
              <option>Todos los clientes</option>
              <option>Cliente A</option>
              <option>Cliente B</option>
            </select>
            <select className="px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-500 transition-all shadow-sm shrink-0">
              <option>Estatus: Todos</option>
              <option>Activo / En Renta</option>
              <option>Disponible / Back Up</option>
              <option>En Mantenimiento</option>
              <option>Inactivo</option>
            </select>
            <select className="px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-500 transition-all shadow-sm shrink-0">
              <option>Tipo: Todos</option>
              <option>Montacargas</option>
              <option>Patín</option>
            </select>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      {viewMode === "table" && (
        <div className="bg-white border-2 border-slate-100 rounded-[2rem] shadow-sm overflow-hidden animate-in fade-in duration-300">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-widest border-b-2 border-slate-100">
                <tr>
                  <th className="px-6 py-5 font-black">Equipo / Serie</th>
                  <th className="px-6 py-5 font-black">Estatus</th>
                  <th className="px-6 py-5 font-black">Cliente / Sitio</th>
                  <th className="px-6 py-5 font-black">ADC</th>
                  <th className="px-6 py-5 font-black">Ingreso / Plazo / Vencimiento</th>
                  <th className="px-6 py-5 font-black text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold">Cargando flotilla...</td></tr>
                ) : filteredAssets.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold">No se encontraron activos.</td></tr>
                ) : paginatedAssets.map((asset) => (
                  <tr key={asset.serie} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={(e) => startEditing(e, asset)}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                          {asset.tipo === 'Montacargas' ? <Truck className="w-5 h-5 text-slate-400" /> : <HardDrive className="w-5 h-5 text-slate-400" />}
                        </div>
                        <div>
                          <p className="font-black text-slate-900 group-hover:text-amber-600 transition-colors">{asset.serie}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              Clase {asset.clase}
                            </span>
                            <span className="text-[10px] text-slate-500">{asset.modelo}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 text-[9px] font-black uppercase rounded border tracking-wider ${statusColors[asset.estatus as keyof typeof statusColors] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                        {asset.estatus}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-slate-800 text-sm">{asset.cliente}</span>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          <span>{asset.site}</span>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                        {asset.adc}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ingreso:</span>
                          <span className="text-xs font-medium text-slate-700">{asset.fechaIngreso}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Plazo:</span>
                          <span className="text-xs font-bold text-slate-700">{asset.plazo}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vence:</span>
                          <span className="text-xs font-medium text-slate-700">{asset.fechaVencimiento}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={(e) => startEditing(e, asset)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 bg-slate-50 hover:bg-amber-50 rounded transition-colors"
                          title="Editar Activo"
                        >
                          <Edit className="w-4 h-4" />
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
      )}

      {/* VISTA DE CARDS */}
      {viewMode === "cards" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-in fade-in duration-300">
            {paginatedAssets.map((asset) => (
            <div key={asset.serie} className="bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col h-full overflow-hidden">
              
              <div className="p-5 border-b border-border flex justify-between items-start bg-secondary/20">
                <div>
                  <Link href={`/r4/flotilla/${asset.serie}`} className="font-black text-xl text-primary hover:underline flex items-center gap-2 mb-1">
                    {asset.serie}
                  </Link>
                  <div className="flex gap-2 items-center">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${statusColors[asset.estatus as keyof typeof statusColors]}`}>
                      {asset.estatus}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">{asset.tipo} • {asset.clase}</span>
                  </div>
                </div>
                <div className="p-2 bg-background border border-border rounded-lg shadow-sm">
                  <ShieldCheck className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
              
              <div className="p-5 flex-1 space-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase mb-0.5">Ubicación</p>
                  <p className="font-bold text-sm line-clamp-1">{asset.cliente}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3"/> {asset.site}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-2 border-t border-border pt-2">
                  <div>
                    <span className="text-xs text-muted-foreground">Cuenta:</span>
                    <p className="font-medium text-xs truncate">{asset.cuenta}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Distribuidor:</span>
                    <p className="font-medium text-xs truncate">{asset.distribuidor}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">ADC:</span>
                    <p className="font-medium text-xs truncate">{asset.adc}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Modelo:</span>
                    <p className="font-medium text-xs truncate">{asset.modelo}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-border pt-2 bg-secondary/10 p-2 rounded">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Ingreso</span>
                    <p className="font-medium text-[11px] truncate">{asset.fechaIngreso}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Plazo</span>
                    <p className="font-medium text-[11px] truncate">{asset.plazo}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Vence</span>
                    <p className="font-medium text-[11px] truncate text-primary">{asset.fechaVencimiento}</p>
                  </div>
                </div>

                {/* SECCIÓN SMP EN CARD */}
                <div className={`mt-2 p-3 rounded-lg border ${asset.smp === 'Vencido' ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' : asset.smp === 'Pendiente' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' : asset.smp === 'Sin SMP' ? 'bg-secondary/30 border-border' : 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'}`}>
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 text-muted-foreground">
                      <Wrench className="w-3 h-3" /> Estado SMP
                    </p>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${(smpColors[asset.smp as keyof typeof smpColors] || '').split(' ')[0]}`}>
                      {asset.smp}
                    </span>
                  </div>
                  {asset.smp !== 'Sin SMP' && (
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-muted-foreground">Próximo servicio:</span>
                      <span className="text-xs font-bold text-foreground">{asset.proxSmp}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-3 border-t border-border bg-secondary/10 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button className="p-2 hover:bg-secondary text-muted-foreground hover:text-foreground rounded transition-colors" title="Editar">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button className="p-2 hover:bg-secondary text-muted-foreground hover:text-foreground rounded transition-colors" title="Documentos">
                    <FileText className="w-4 h-4" />
                  </button>
                  <button className="p-2 hover:bg-secondary text-muted-foreground hover:text-foreground rounded transition-colors" title="Historial">
                    <Clock className="w-4 h-4" />
                  </button>
                  <Link href={`/r4/flotilla/${asset.serie}`}>
                    <button className="p-2 hover:bg-secondary text-muted-foreground hover:text-primary rounded transition-colors" title="Registrar SMP">
                      <Wrench className="w-4 h-4" />
                    </button>
                  </Link>
                  <button onClick={() => openTransferModal(asset)} className="p-2 hover:bg-secondary text-muted-foreground hover:text-primary rounded transition-colors" title="Transferir equipo">
                    <MapPin className="w-4 h-4" />
                  </button>
                </div>
                <Link href={`/r4/flotilla/${asset.serie}`}>
                  <button className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">
                    <Eye className="w-4 h-4" /> Detalle
                  </button>
                </Link>
              </div>
            </div>
          ))}
          </div>
          
          {/* Cards Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 bg-white rounded-2xl border-2 border-slate-100 shadow-sm mt-4">
              <span className="text-sm font-bold text-slate-500">
                Página {currentPage} de {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 disabled:opacity-50 hover:bg-slate-100 transition-all"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 disabled:opacity-50 hover:bg-slate-100 transition-all"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
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
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-border bg-secondary/30">
                <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <HardDrive className="w-5 h-5 text-primary" />
                  Carga Masiva de Flotilla
                </h3>
                <button onClick={() => setIsUploadModalOpen(false)} className="p-1.5 hover:bg-secondary rounded-lg text-muted-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Sube un archivo <span className="font-bold text-foreground">.xlsx</span> o <span className="font-bold text-foreground">.csv</span> para importar y actualizar múltiples equipos, incluyendo sus fechas de mantenimiento, de una sola vez.
                </p>
              <div className="p-5">
                {isUploading ? (
                  <div className="flex flex-col items-center justify-center py-10 space-y-4">
                    <div className="relative w-20 h-20">
                      <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <FileSpreadsheet className="w-8 h-8 text-primary animate-pulse" />
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-foreground">Procesando Archivo...</h3>
                    <p className="text-sm text-muted-foreground text-center max-w-xs">
                      Estamos validando y registrando los activos y sus rentas mensuales. 
                      <br/><br/>
                      <span className="font-semibold text-amber-600 dark:text-amber-400">Este proceso puede tomar entre 1 y 2 minutos. Por favor, no cierres esta ventana.</span>
                    </p>
                  </div>
                ) : (
                  <>
                    <label 
                      className={`relative flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300 ${file ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary hover:bg-secondary/50 group'}`}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                    >
                      <input id="file-upload" type="file" className="hidden" accept=".xlsx,.csv" onChange={handleFileChange} />
                      <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                        <Upload className="w-6 h-6 text-primary" />
                      </div>
                      <p className="text-sm font-bold mb-1">
                        {file ? file.name : "Arrastra tu archivo aquí o haz clic para subir"}
                      </p>
                      <p className="text-xs text-muted-foreground">Tamaño máximo: 10MB</p>
                    </label>

                    {file && (
                      <div className="flex items-center justify-between bg-primary/5 border border-primary/10 p-4 rounded-xl mt-4">
                        <div className="flex items-center gap-3">
                          <FileSpreadsheet className="w-8 h-8 text-green-600 dark:text-green-400" />
                          <div>
                            <p className="text-sm font-bold">{file.name}</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-medium mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        </div>
                        <button onClick={() => setFile(null)} className="p-2 bg-background hover:bg-secondary border border-border rounded-lg text-red-500 transition-all shadow-sm" title="Quitar archivo">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              </div>

              <div className="flex items-center justify-end gap-3 p-5 border-t border-border bg-secondary/30">
                <button onClick={() => { setIsUploadModalOpen(false); setFile(null); }} className="px-5 py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors" disabled={isUploading}>
                  Cancelar
                </button>
                <button onClick={handleUpload} disabled={isUploading || !file} className="px-6 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                  {isUploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Procesando...
                    </>
                  ) : 'Importar Datos'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* --- MODAL NUEVA ENTRADA (ALTA DE EQUIPO) --- */}
        {isNewAssetModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between p-5 border-b border-border bg-secondary/30 shrink-0">
                <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <Truck className="w-5 h-5 text-primary" />
                  Alta de Nuevo Activo
                </h3>
                <button onClick={() => setIsNewAssetModalOpen(false)} className="p-1.5 hover:bg-secondary rounded-lg text-muted-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
                
                {/* Tipo de Equipo */}
                <div className="space-y-4">
                  <h4 className="font-bold text-sm text-primary border-b border-border pb-2">1. Clasificación del Activo</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Tipo de Equipo *</label>
                      <select 
                        value={newAssetTipo}
                        onChange={(e) => setNewAssetTipo(e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 font-medium"
                      >
                        <option>Montacargas</option>
                        <option>Patín</option>
                        <option>Batería</option>
                        <option>Cargador</option>
                        <option>Otro / Accesorio</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Clase</label>
                      <select className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20">
                        <option>Clase I</option>
                        <option>Clase II</option>
                        <option>Clase III</option>
                        <option>Clase IV</option>
                        <option>Clase V</option>
                        <option>N/A</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Estatus Inicial *</label>
                      <select className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20">
                        <option>Activo</option>
                        <option>Back Up</option>
                        <option>Inactivo con cliente</option>
                        <option>Inactivo</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Especificaciones Técnicas */}
                <div className="space-y-4">
                  <h4 className="font-bold text-sm text-primary border-b border-border pb-2">2. Especificaciones Técnicas</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1.5">Número de Serie *</label>
                      <input type="text" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 font-bold" placeholder="Escribe la serie" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Modelo *</label>
                      <input type="text" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20" placeholder="Escribe el modelo" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5 flex justify-between">OACH {newAssetTipo === "Montacargas" && <span className="text-red-500">*</span>}</label>
                      <input type="text" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20" placeholder="Escribe el ancho" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5 flex justify-between">Altura {newAssetTipo === "Montacargas" && <span className="text-red-500">*</span>}</label>
                      <input type="text" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20" placeholder="Escribe la altura" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5 flex justify-between">Compartimiento Batería (BC) {newAssetTipo === "Montacargas" && <span className="text-red-500">*</span>}</label>
                      <input type="text" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20" placeholder="Escribe el ancho" />
                    </div>
                  </div>
                  {newAssetTipo !== "Montacargas" && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-400 flex items-center gap-2">
                      <Info className="w-4 h-4 shrink-0" />
                      Al ser un producto alterno ({newAssetTipo}), los campos OACH, Altura y BC no son obligatorios.
                    </div>
                  )}
                </div>

                {/* Asignación y Control */}
                <div className="space-y-4">
                  <h4 className="font-bold text-sm text-primary border-b border-border pb-2">3. Asignación y Control Comercial</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Cliente</label>
                      <select className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20">
                        <option>Seleccionar...</option>
                        {(uniqueClientes as string[]).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Cuenta Relacionada</label>
                      <select className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20">
                        <option>Seleccionar...</option>
                        {(uniqueCuentas as string[]).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Site (Ubicación)</label>
                      <select className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20">
                        <option>Seleccionar...</option>
                        {(uniqueSites as string[]).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Administrador de Cuenta (ADC)</label>
                      <select className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20">
                        <option>Seleccionar...</option>
                        {(uniqueADCs as string[]).map(adc => <option key={adc} value={adc}>{adc}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Distribuidor de Servicio</label>
                      <select className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20">
                        <option>Seleccionar...</option>
                        {(uniqueDistribuidores as string[]).map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

              </div>

              <div className="flex items-center justify-end gap-3 p-5 border-t border-border bg-secondary/30 shrink-0">
                <button onClick={() => setIsNewAssetModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
                  Cancelar
                </button>
                <button className="px-6 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors shadow-md">
                  Registrar Activo
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* --- MODAL DE TRANSFERENCIA DE EQUIPO --- */}
        {isTransferModalOpen && selectedAssetForTransfer && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-5 border-b border-border bg-secondary/30 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Transferir Equipo</h3>
                  <p className="text-sm text-muted-foreground mt-1">Registrar reubicación de este activo a otro sitio.</p>
                </div>
                <button onClick={() => setIsTransferModalOpen(false)} className="p-2 hover:bg-secondary rounded-lg transition-colors text-muted-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Equipo</label>
                    <input type="text" readOnly value={selectedAssetForTransfer.serie} className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-sm font-medium text-foreground" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Site Actual</label>
                    <input type="text" readOnly value={selectedAssetForTransfer.site} className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-sm font-medium text-foreground" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Nuevo Site *</label>
                  <select className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20">
                    <option value="">Seleccione el sitio destino...</option>
                    <option value="SIT-002">Planta Sur</option>
                    <option value="SIT-003">Obra Central</option>
                    <option value="SIT-004">Proyecto Residencial</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Fecha de Transferencia *</label>
                    <input type="date" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Responsable *</label>
                    <input type="text" placeholder="Nombre de quien autoriza" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Motivo de Transferencia *</label>
                  <select className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20">
                    <option>Reasignación Operativa</option>
                    <option>Cierre de Proyecto</option>
                    <option>Mantenimiento Mayor</option>
                    <option>Préstamo Temporal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Comentarios</label>
                  <textarea rows={2} placeholder="Detalles adicionales sobre la reubicación" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 resize-none"></textarea>
                </div>
                
                <div className="bg-primary/5 p-3 rounded-lg border border-primary/20 flex gap-2">
                  <Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">Esta acción quedará registrada en el historial del activo y requerirá validación del nuevo responsable de sitio.</p>
                </div>
              </div>

              <div className="p-5 border-t border-border bg-secondary/30 flex justify-end gap-3 shrink-0">
                <button onClick={() => setIsTransferModalOpen(false)} className="px-4 py-2 text-sm font-medium text-foreground bg-background border border-border rounded-lg hover:bg-secondary transition-colors">
                  Cancelar
                </button>
                <button onClick={() => setIsTransferModalOpen(false)} className="px-5 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-md flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Transferir
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {/* --- MODAL EDICIÓN DE EQUIPO --- */}
        {isEditModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between p-5 border-b border-border bg-secondary/30 shrink-0">
                <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <Edit className="w-5 h-5 text-amber-600" />
                  Editar Activo: {editingData.serie}
                </h3>
                <button onClick={cancelEditing} className="p-1.5 hover:bg-secondary rounded-lg text-muted-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Modelo</label>
                    <input 
                      type="text" 
                      value={editingData.modelo || ''} 
                      onChange={(e) => setEditingData({...editingData, modelo: e.target.value})}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Estatus</label>
                    <select 
                      value={editingData.estatus || ''} 
                      onChange={(e) => setEditingData({...editingData, estatus: e.target.value})}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="Activo">Activo</option>
                      <option value="En Renta">En Renta</option>
                      <option value="Inactivo">Inactivo</option>
                      <option value="Disponible">Disponible</option>
                      <option value="Back Up">Back Up</option>
                      <option value="Inactivo con cliente">Inactivo con cliente</option>
                      <option value="En Taller">En Taller</option>
                      <option value="Mantenimiento">Mantenimiento</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-border">
                  <h4 className="font-bold text-sm text-primary">Asignación Comercial</h4>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Cliente</label>
                      <select 
                        value={editingData.cliente || ''} 
                        onChange={(e) => setEditingData({...editingData, cliente: e.target.value})}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="">Seleccionar...</option>
                        {(uniqueClientes as string[]).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Site (Ubicación)</label>
                      <select 
                        value={editingData.site || ''} 
                        onChange={(e) => setEditingData({...editingData, site: e.target.value})}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="">Seleccionar...</option>
                        {(uniqueSites as string[]).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Administrador de Cuenta (ADC)</label>
                      <select 
                        value={editingData.adc || ''} 
                        onChange={(e) => setEditingData({...editingData, adc: e.target.value})}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="">Seleccionar...</option>
                        {(uniqueADCs as string[]).map(adc => <option key={adc} value={adc}>{adc}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

              </div>

              <div className="flex items-center justify-end gap-3 p-5 border-t border-border bg-secondary/30 shrink-0">
                <button onClick={cancelEditing} className="px-5 py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
                  Cancelar
                </button>
                <button onClick={saveEditing} className="px-6 py-2.5 bg-amber-600 text-white text-sm font-bold rounded-lg hover:bg-amber-700 transition-colors shadow-md">
                  Guardar Cambios
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
