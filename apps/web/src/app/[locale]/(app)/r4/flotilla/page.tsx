"use client";

import { 
  Search, Filter, Download, Grid3x3, List, Plus, Eye, Edit, 
  FileText, Clock, CheckCircle, Upload, X, FileSpreadsheet, 
  Wrench, Activity, CheckCircle2, AlertTriangle, ChevronRight, ShieldCheck, MapPin, Truck, HardDrive, Info
} from "lucide-react";
import { Link } from "@/i18n/routing"; // Next-intl custom link
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

// Mock user since useAppUser from RootLayout might not exist in exactly the same way here
const useAppUser = () => {
  return { role: "admin", adcAsignado: "Juan Pérez" };
};

const fleetAssets = [
  { serie: "7720-12345", tipo: "Montacargas", cliente: "Grupo Industrial MX", site: "Planta Norte", cuenta: "Cuenta A", adc: "Juan Pérez", distribuidor: "Raymond MTY", clase: "Clase I", modelo: "7720", oach: "84\"", altura: "210\"", bc: "36\"", estatus: "Activo", smp: "Al día", proxSmp: "15 May 2026", responsable: "Juan Pérez", fechaIngreso: "10 Ene 2024", plazo: "36 meses", fechaVencimiento: "10 Ene 2027", fechaRecoleccion: "-" },
  { serie: "4250-98765", tipo: "Montacargas", cliente: "Logística Express", site: "Centro Distribución", cuenta: "Cuenta B", adc: "María López", distribuidor: "Raymond CDMX", clase: "Clase II", modelo: "4250", oach: "95\"", altura: "240\"", bc: "24\"", estatus: "Activo", smp: "Pendiente", proxSmp: "Hoy", responsable: "María López", fechaIngreso: "05 Mar 2023", plazo: "48 meses", fechaVencimiento: "05 Mar 2027", fechaRecoleccion: "-" },
  { serie: "8210-45678", tipo: "Patín", cliente: "Construcciones del Sur", site: "Obra Central", cuenta: "Cuenta C", adc: "Carlos Sánchez", distribuidor: "Raymond GDL", clase: "Clase III", modelo: "8210", oach: "N/A", altura: "N/A", bc: "24\"", estatus: "Inactivo con cliente", smp: "Vencido", proxSmp: "01 May 2026", responsable: "Carlos Sánchez", fechaIngreso: "20 Nov 2024", plazo: "24 meses", fechaVencimiento: "20 Nov 2026", fechaRecoleccion: "-" },
  { serie: "7720-11223", tipo: "Montacargas", cliente: "Minera del Pacífico", site: "Mina Las Torres", cuenta: "Cuenta A", adc: "Ana Martínez", distribuidor: "Raymond MTY", clase: "Clase I", modelo: "7720", oach: "84\"", altura: "210\"", bc: "36\"", estatus: "Back Up", smp: "Al día", proxSmp: "20 Jun 2026", responsable: "Ana Martínez", fechaIngreso: "15 Feb 2025", plazo: "12 meses", fechaVencimiento: "15 Feb 2026", fechaRecoleccion: "-" },
  { serie: "4750-33445", tipo: "Montacargas", cliente: "Energía Renovable SA", site: "Parque Eólico", cuenta: "Cuenta D", adc: "Roberto Gómez", distribuidor: "Raymond QRO", clase: "Clase II", modelo: "4750", oach: "107\"", altura: "270\"", bc: "36\"", estatus: "Inactivo", smp: "Sin SMP", proxSmp: "-", responsable: "Roberto Gómez", fechaIngreso: "12 Oct 2021", plazo: "36 meses", fechaVencimiento: "12 Oct 2024", fechaRecoleccion: "15 Oct 2024" },
  { serie: "7720-44556", tipo: "Montacargas", cliente: "Grupo Industrial MX", site: "Planta Sur", cuenta: "Cuenta A", adc: "Juan Pérez", distribuidor: "Raymond CDMX", clase: "Clase I", modelo: "7720", oach: "84\"", altura: "210\"", bc: "36\"", estatus: "Activo", smp: "Al día", proxSmp: "28 May 2026", responsable: "Juan Pérez", fechaIngreso: "01 Ago 2024", plazo: "60 meses", fechaVencimiento: "01 Ago 2029", fechaRecoleccion: "-" },
  { serie: "BAT-99887", tipo: "Batería", cliente: "Logística Express", site: "Centro Distribución", cuenta: "Cuenta B", adc: "María López", distribuidor: "Raymond CDMX", clase: "N/A", modelo: "Deka 36V", oach: "N/A", altura: "N/A", bc: "N/A", estatus: "Activo", smp: "Sin SMP", proxSmp: "-", responsable: "María López", fechaIngreso: "05 Mar 2023", plazo: "48 meses", fechaVencimiento: "05 Mar 2027", fechaRecoleccion: "-" }
];

const statusColors = {
  "Activo": "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
  "Inactivo": "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
  "Back Up": "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  "Inactivo con cliente": "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
};

const smpColors = {
  "Al día": "text-green-800 bg-green-100 border-green-200 dark:text-green-400 dark:bg-green-900/30 dark:border-green-800",
  "Pendiente": "text-amber-800 bg-amber-100 border-amber-200 dark:text-amber-400 dark:bg-amber-900/30 dark:border-amber-800",
  "Vencido": "text-red-800 bg-red-100 border-red-200 dark:text-red-400 dark:bg-red-900/30 dark:border-red-800",
  "Sin SMP": "text-gray-800 bg-gray-100 border-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:border-gray-700",
};

export default function Fleet() {
  const { role, adcAsignado } = useAppUser();
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const [isNewAssetModalOpen, setIsNewAssetModalOpen] = useState(false);
  const [newAssetTipo, setNewAssetTipo] = useState("Montacargas");

  // Transfer Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedAssetForTransfer, setSelectedAssetForTransfer] = useState<any>(null);

  const openTransferModal = (asset: any) => {
    setSelectedAssetForTransfer(asset);
    setIsTransferModalOpen(true);
  };

  // ADC Visual Visibility Logic
  const filteredAssets = role === "adc_user" 
    ? fleetAssets.filter(asset => asset.adc === adcAsignado) 
    : fleetAssets;

  // Stock Rules
  const stockEstatus = ["Activo", "Back Up", "Inactivo con cliente"];
  const equiposEnStock = filteredAssets.filter(a => stockEstatus.includes(a.estatus));

  const statusCounts = {
    totalStock: equiposEnStock.length,
    adc1: equiposEnStock.filter(a => a.adc === "Juan Pérez").length,
    adc2: equiposEnStock.filter(a => a.adc === "María López").length,
    adc3: equiposEnStock.filter(a => a.adc === "Carlos Sánchez").length,
    adc4: equiposEnStock.filter(a => a.adc === "Ana Martínez").length,
    adc5: equiposEnStock.filter(a => a.adc === "Roberto Gómez").length,
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto min-h-screen">
      
      {/* HEADER EJECUTIVO */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Activity className="w-6 h-6 text-primary" />
              Gestión de Flotilla y Activos
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Monitoreo de equipos en operación y stock por administrador de cuenta.</p>
          </div>
          <div className="flex items-center gap-3">
            {role !== "admin" && (
              <>
                <button className="flex items-center gap-2 px-4 py-2 bg-secondary text-foreground border border-border rounded-lg hover:bg-secondary/80 transition-colors font-medium text-sm">
                  <Truck className="w-4 h-4 text-primary" />
                  Asignar Back Up
                </button>
                <button 
                  onClick={() => setIsUploadModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-secondary text-foreground border border-border rounded-lg hover:bg-secondary/80 transition-colors font-medium text-sm"
                >
                  <Upload className="w-4 h-4" />
                  Carga Masiva
                </button>
                <button 
                  onClick={() => setIsNewAssetModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors shadow-sm font-medium text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Nueva Entrada
                </button>
              </>
            )}
            {role === "admin" && (
               <div className="px-4 py-2 bg-secondary/50 text-muted-foreground border border-border rounded-lg font-medium text-sm flex items-center gap-2">
                 <ShieldCheck className="w-4 h-4" />
                 Modo Solo Lectura (Global)
               </div>
            )}
          </div>
        </div>

        {/* DASHBOARD KPIs (Stock) */}
        <div className="pt-4 border-t border-border grid grid-cols-2 md:grid-cols-6 gap-4">
          
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 opacity-10">
              <Truck className="w-20 h-20" />
            </div>
            <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Total en Stock</p>
            <p className="text-3xl font-black text-primary">{statusCounts.totalStock}</p>
            <p className="text-[10px] font-medium text-primary mt-2">Equipos asignados</p>
          </div>
          
          <div className="bg-secondary/30 border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 line-clamp-1">Juan Pérez</p>
            <p className="text-2xl font-black text-foreground">{statusCounts.adc1}</p>
            <p className="text-[10px] font-medium text-muted-foreground mt-2">Equipos</p>
          </div>
          
          <div className="bg-secondary/30 border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 line-clamp-1">María López</p>
            <p className="text-2xl font-black text-foreground">{statusCounts.adc2}</p>
            <p className="text-[10px] font-medium text-muted-foreground mt-2">Equipos</p>
          </div>
          
          <div className="bg-secondary/30 border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 line-clamp-1">Carlos Sánchez</p>
            <p className="text-2xl font-black text-foreground">{statusCounts.adc3}</p>
            <p className="text-[10px] font-medium text-muted-foreground mt-2">Equipos</p>
          </div>
          
          <div className="bg-secondary/30 border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 line-clamp-1">Ana Martínez</p>
            <p className="text-2xl font-black text-foreground">{statusCounts.adc4}</p>
            <p className="text-[10px] font-medium text-muted-foreground mt-2">Equipos</p>
          </div>

          <div className="bg-secondary/30 border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 line-clamp-1">Roberto Gómez</p>
            <p className="text-2xl font-black text-foreground">{statusCounts.adc5}</p>
            <p className="text-[10px] font-medium text-muted-foreground mt-2">Equipos</p>
          </div>
        </div>
      </div>

      {/* TOOLBAR: FILTROS Y VISTAS */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por Serie, Cliente, Modelo..."
              className="w-full pl-9 pr-4 py-2 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
            />
          </div>
          <div className="flex items-center gap-2 bg-secondary/50 p-1 rounded-lg border border-border shrink-0">
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "table" ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"}`}
              title="Vista de Tabla"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "cards" ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"}`}
              title="Vista de Cuadrícula"
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Filtros avanzados */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 border-t border-border pt-4">
          <select className="px-3 py-1.5 bg-background border border-border rounded-md text-xs font-medium focus:ring-2 focus:ring-primary/20">
            <option>Cliente: Todos</option>
            <option>Grupo Industrial MX</option>
            <option>Logística Express</option>
          </select>
          <select className="px-3 py-1.5 bg-background border border-border rounded-md text-xs font-medium focus:ring-2 focus:ring-primary/20">
            <option>Sitio: Todos</option>
          </select>
          <select className="px-3 py-1.5 bg-background border border-border rounded-md text-xs font-medium focus:ring-2 focus:ring-primary/20">
            <option>Cuenta: Todas</option>
          </select>
          {role === "admin" ? (
            <select className="px-3 py-1.5 bg-background border border-border rounded-md text-xs font-medium focus:ring-2 focus:ring-primary/20">
              <option>ADC: Todos</option>
              <option>Juan Pérez</option>
              <option>Ana Martínez</option>
            </select>
          ) : (
            <div className="px-3 py-1.5 bg-secondary/50 border border-green-500/30 rounded-md text-xs font-medium flex items-center gap-1.5 text-green-600 dark:text-green-400">
              <span className="font-bold">ADC:</span> Juan Pérez
            </div>
          )}
          <select className="px-3 py-1.5 bg-background border border-border rounded-md text-xs font-medium focus:ring-2 focus:ring-primary/20">
            <option>Distribuidor: Todos</option>
          </select>
          <select className="px-3 py-1.5 bg-background border border-border rounded-md text-xs font-medium focus:ring-2 focus:ring-primary/20">
            <option>Clase: Todas</option>
            <option>Clase I</option>
            <option>Clase II</option>
            <option>Clase III</option>
          </select>
          <select className="px-3 py-1.5 bg-background border border-border rounded-md text-xs font-medium focus:ring-2 focus:ring-primary/20">
            <option>Estatus: Todos</option>
            <option>Activo</option>
            <option>Back Up</option>
            <option>Inactivo con cliente</option>
            <option>Inactivo</option>
          </select>
          <select className="px-3 py-1.5 bg-background border border-border rounded-md text-xs font-medium focus:ring-2 focus:ring-primary/20">
            <option>Tipo: Todos</option>
            <option>Montacargas</option>
            <option>Patín</option>
            <option>Batería</option>
          </select>
        </div>
      </div>

      {/* VISTA DE TABLA */}
      {viewMode === "table" && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden animate-in fade-in duration-300">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-secondary/50 text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                <tr>
                  <th className="px-5 py-4 font-semibold">No. Serie</th>
                  <th className="px-5 py-4 font-semibold">Tipo / Clase</th>
                  <th className="px-5 py-4 font-semibold">Modelo</th>
                  <th className="px-5 py-4 font-semibold">Estatus</th>
                  <th className="px-5 py-4 font-semibold">Cliente / Site</th>
                  <th className="px-5 py-4 font-semibold">ADC</th>
                  <th className="px-5 py-4 font-semibold">Ingreso / Plazo / Vencimiento</th>
                  <th className="px-5 py-4 font-semibold">Recolección</th>
                  <th className="px-5 py-4 font-semibold border-l border-border bg-secondary/30">Estado SMP</th>
                  <th className="px-5 py-4 font-semibold text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAssets.map((asset) => (
                  <tr key={asset.serie} className="hover:bg-secondary/30 transition-colors group">
                    <td className="px-5 py-3">
                      <Link href={`/r4/flotilla/${asset.serie}`} className="font-bold text-primary hover:underline text-sm">
                        {asset.serie}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-foreground">{asset.tipo}</p>
                      <p className="text-xs text-muted-foreground">{asset.clase}</p>
                    </td>
                    <td className="px-5 py-3">{asset.modelo}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${statusColors[asset.estatus as keyof typeof statusColors]}`}>
                        {asset.estatus}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium">{asset.cliente}</p>
                      <p className="text-xs text-muted-foreground">{asset.site}</p>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{asset.adc}</td>
                    
                    {/* Fechas y Plazo */}
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs"><span className="text-muted-foreground">Ingreso:</span> {asset.fechaIngreso}</span>
                        <span className="text-xs"><span className="text-muted-foreground">Plazo:</span> {asset.plazo}</span>
                        <span className="text-xs"><span className="text-muted-foreground">Vence:</span> {asset.fechaVencimiento}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs ${asset.fechaRecoleccion !== '-' ? 'font-bold text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>{asset.fechaRecoleccion}</span>
                    </td>
                    
                    {/* COLUMNA SMP */}
                    <td className="px-5 py-3 border-l border-border bg-secondary/10">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${smpColors[asset.smp as keyof typeof smpColors]}`}>
                          {asset.smp}
                        </span>
                        {asset.smp !== 'Sin SMP' && (
                          <span className={`text-[10px] ${asset.smp === 'Vencido' ? 'text-red-600 dark:text-red-400 font-bold' : asset.smp === 'Pendiente' ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-muted-foreground'}`}>
                            Próx: {asset.proxSmp}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-center gap-1">
                        <Link href={`/r4/flotilla/${asset.serie}`}>
                          <button className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-primary" title="Ver detalle">
                            <Eye className="w-4 h-4" />
                          </button>
                        </Link>
                        <button className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground" title="Editar">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground" title="Documentos">
                          <FileText className="w-4 h-4" />
                        </button>
                        <button className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground" title="Historial">
                          <Clock className="w-4 h-4" />
                        </button>
                        <Link href={`/r4/flotilla/${asset.serie}`}>
                          <button className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-primary" title="Registrar SMP">
                            <Wrench className="w-4 h-4" />
                          </button>
                        </Link>
                        <button onClick={() => openTransferModal(asset)} className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-primary" title="Transferir equipo">
                          <MapPin className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISTA DE CARDS */}
      {viewMode === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-in fade-in duration-300">
          {filteredAssets.map((asset) => (
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
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${smpColors[asset.smp as keyof typeof smpColors].split(' ')[0]}`}>
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

                <div className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-secondary/50 hover:border-primary/50 transition-colors cursor-pointer group">
                  <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                    <Upload className="w-6 h-6 text-primary" />
                  </div>
                  <p className="text-sm font-bold mb-1">Arrastra tu archivo aquí</p>
                  <p className="text-xs text-muted-foreground">Tamaño máximo: 10MB</p>
                </div>

                <div className="flex items-center justify-between bg-primary/5 border border-primary/10 p-4 rounded-xl">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-8 h-8 text-green-600 dark:text-green-400" />
                    <div>
                      <p className="text-sm font-bold">Plantilla_Activos_R4.xlsx</p>
                      <p className="text-[10px] text-muted-foreground uppercase font-medium mt-0.5">Última actualización: Hoy</p>
                    </div>
                  </div>
                  <button className="p-2 bg-background hover:bg-secondary border border-border rounded-lg text-primary transition-all shadow-sm" title="Descargar plantilla">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-5 border-t border-border bg-secondary/30">
                <button onClick={() => setIsUploadModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
                  Cancelar
                </button>
                <button className="px-6 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors shadow-md">
                  Importar Datos
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
                      <input type="text" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 font-bold" placeholder="Ej. 7720-12345" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Modelo *</label>
                      <input type="text" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20" placeholder="Ej. 7720" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5 flex justify-between">OACH {newAssetTipo === "Montacargas" && <span className="text-red-500">*</span>}</label>
                      <input type="text" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20" placeholder="Ej. 84&quot;" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5 flex justify-between">Altura {newAssetTipo === "Montacargas" && <span className="text-red-500">*</span>}</label>
                      <input type="text" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20" placeholder="Ej. 210&quot;" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5 flex justify-between">Compartimiento Batería (BC) {newAssetTipo === "Montacargas" && <span className="text-red-500">*</span>}</label>
                      <input type="text" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20" placeholder="Ej. 36&quot;" />
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
                        <option>Grupo Industrial MX</option>
                        <option>Logística Express</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Cuenta Relacionada</label>
                      <select className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20">
                        <option>Seleccionar...</option>
                        <option>Cuenta A</option>
                        <option>Cuenta B</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Site (Ubicación)</label>
                      <select className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20">
                        <option>Seleccionar...</option>
                        <option>Planta Norte</option>
                        <option>Centro Distribución</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Administrador de Cuenta (ADC)</label>
                      <select className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20">
                        <option>Seleccionar...</option>
                        <option>Juan Pérez</option>
                        <option>Ana Martínez</option>
                        <option>Carlos Sánchez</option>
                        <option>María López</option>
                        <option>Roberto Gómez</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Distribuidor de Servicio</label>
                      <select className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20">
                        <option>Seleccionar...</option>
                        <option>Raymond MTY</option>
                        <option>Raymond CDMX</option>
                        <option>Raymond GDL</option>
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
                  <textarea rows={2} placeholder="Detalles adicionales sobre la reubicación..." className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 resize-none"></textarea>
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
      </AnimatePresence>

    </div>
  );
}
