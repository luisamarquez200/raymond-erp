'use client';

import { useState, useEffect } from 'react';
import { X, FileSpreadsheet, Box, AlertTriangle, Search, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { auditoriaApi } from '@/services/taller-r1/auditoria.service';
import { useAuthTallerStore } from '@/store/auth-taller.store';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AuditoriaDetailsModalProps {
    isOpen: boolean;
    id_auditoria: string | null;
    onClose: () => void;
}

export default function AuditoriaDetailsModal({ isOpen, id_auditoria, onClose }: AuditoriaDetailsModalProps) {
    const selectedSite = useAuthTallerStore(state => state.selectedSite);
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'scanned' | 'missing'>('scanned');

    // Filtros
    const [searchSerial, setSearchSerial] = useState('');
    const [filterModelo, setFilterModelo] = useState('all');
    const [filterClase, setFilterClase] = useState('all');
    const [filterEstado, setFilterEstado] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterTipo, setFilterTipo] = useState('all');

    useEffect(() => {
        if (isOpen && id_auditoria && selectedSite) {
            loadReport();
            setActiveTab('scanned');
        } else if (!isOpen) {
            setReport(null);
        }
    }, [isOpen, id_auditoria, selectedSite]);

    const loadReport = async () => {
        setLoading(true);
        try {
            const data = await auditoriaApi.getReport(selectedSite!, id_auditoria!);
            setReport(data);
        } catch (error) {
            console.error('Error loading report:', error);
            toast.error('Error al cargar los detalles de la auditoría');
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const handleExportExcel = () => {
        if (!report) return;

        try {
            // Preparar datos para Excel
            const scannedData = report.scanned.map((item: any) => ({
                'Serial': item.serial,
                'Tipo': item.tipo_item,
                'Modelo': item.modelo,
                'Clase': item.clase,
                'Ubicación en Sistema': item.ubicacion_actual,
                'Estado en Sistema': item.estado_actual,
                'Status Auditoría': item.status_auditoria,
            }));

            const missingData = report.missing.map((item: any) => ({
                'Serial': item.serial,
                'Tipo': item.tipo_item,
                'Modelo': item.modelo,
                'Clase': item.clase,
                'Ubicación en Sistema': item.ubicacion_actual,
                'Estado en Sistema': item.estado_actual,
                'Status Auditoría': item.status_auditoria,
            }));

            const wb = XLSX.utils.book_new();
            
            const wsScanned = XLSX.utils.json_to_sheet(scannedData);
            XLSX.utils.book_append_sheet(wb, wsScanned, 'Escaneados');
            
            if (missingData.length > 0) {
                 const wsMissing = XLSX.utils.json_to_sheet(missingData);
                 XLSX.utils.book_append_sheet(wb, wsMissing, 'Faltantes');
            }

            const fileName = `Auditoria_${format(new Date(report.auditoria.fecha_auditoria), 'yyyy-MM-dd')}_${report.auditoria.usuario_auditor}.xlsx`;
            XLSX.writeFile(wb, fileName);
            toast.success('Reporte exportado correctamente');
        } catch (error) {
            console.error('Error exporting excel:', error);
            toast.error('Error al generar el archivo Excel');
        }
    };

    // Reset states on tab switch
    useEffect(() => {
        setSearchSerial('');
        setFilterModelo('all');
        setFilterClase('all');
        setFilterEstado('all');
        setFilterStatus('all');
        setFilterTipo('all');
    }, [activeTab, isOpen]);

    if (!isOpen) return null;

    if (loading || !report) {
        return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                 <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
        );
    }

    const auditoria = report.auditoria;
    
    // Filter logic
    const currentList = activeTab === 'scanned' ? report.scanned : report.missing;
    
    const uniqueOptions = {
        modelos: Array.from(new Set(currentList.map((i:any) => i.modelo).filter(Boolean))).sort() as string[],
        clases: Array.from(new Set(currentList.map((i:any) => i.clase).filter(Boolean))).sort() as string[],
        estados: Array.from(new Set(currentList.map((i:any) => i.estado_actual).filter(Boolean))).sort() as string[],
        statuses: Array.from(new Set(currentList.map((i:any) => i.status_auditoria).filter(Boolean))).sort() as string[],
        tipos: Array.from(new Set(currentList.map((i:any) => i.tipo_item).filter(Boolean))).sort() as string[]
    };

    const filteredList = currentList.filter((item: any) => {
        const matchSerial = searchSerial === '' || item.serial?.toLowerCase().includes(searchSerial.toLowerCase());
        const matchModelo = filterModelo === 'all' || item.modelo === filterModelo;
        const matchClase = filterClase === 'all' || item.clase === filterClase;
        const matchEstado = filterEstado === 'all' || item.estado_actual === filterEstado;
        const matchStatus = filterStatus === 'all' || item.status_auditoria === filterStatus;
        const matchTipo = filterTipo === 'all' || item.tipo_item === filterTipo;
        return matchSerial && matchModelo && matchClase && matchEstado && matchStatus && matchTipo;
    });

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white w-full max-w-6xl max-h-[92vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-3 py-1 bg-slate-100 text-slate-700 text-[10px] font-black rounded-full uppercase tracking-widest">
                                Auditoría Cerrada
                            </span>
                             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                 {format(new Date(auditoria.fecha_auditoria), 'dd MMM yyyy - HH:mm', { locale: es })}
                             </span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            Reporte de Auditoría
                            <span className="text-sm font-bold text-slate-400 uppercase">/ {auditoria.usuario_auditor}</span>
                        </h2>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={handleExportExcel}
                            className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all shadow-sm"
                        >
                            <FileSpreadsheet className="w-5 h-5" />
                            <span className="hidden sm:inline">Exportar</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-3 text-slate-400 hover:text-slate-600 hover:bg-white rounded-2xl transition-all shadow-sm border border-transparent hover:border-slate-100 bg-white"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar bg-slate-50/30">
                    {/* Resumen */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Escaneados</p>
                            <p className="text-3xl font-black text-slate-900">{report.scanned.length}</p>
                        </div>
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden">
                            <div className="absolute right-0 top-0 w-24 h-24 bg-red-50 rounded-bl-[100px] flex items-start justify-end p-4">
                                 <AlertTriangle className="w-6 h-6 text-red-400" />
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Supuestos Faltantes</p>
                            <p className="text-3xl font-black text-red-600">{report.missing?.length || 0}</p>
                        </div>
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm col-span-2">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Comentarios</p>
                             <p className="text-sm font-medium text-slate-700 line-clamp-2">{auditoria.comentarios || 'Sin comentarios registrados.'}</p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-4 mb-6 relative z-10">
                        <button
                            onClick={() => setActiveTab('scanned')}
                            className={cn(
                                "px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-sm flex items-center gap-2",
                                activeTab === 'scanned' ? "bg-slate-900 text-white" : "bg-white text-slate-400 hover:bg-slate-50"
                            )}
                        >
                             <Search className="w-4 h-4" /> Items Documentados
                        </button>
                        <button
                            onClick={() => setActiveTab('missing')}
                            className={cn(
                                "px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-sm flex items-center gap-2",
                                activeTab === 'missing' ? "bg-red-600 text-white" : "bg-white text-slate-400 hover:bg-slate-50"
                            )}
                        >
                            <AlertTriangle className="w-4 h-4" /> Items Faltantes ({report.missing?.length || 0})
                        </button>
                    </div>
                    {/* Filtros */}
                    <div className="bg-slate-50/50 rounded-2xl p-4 mb-4 border border-slate-100 flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[200px]">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Buscar Serial</label>
                            <input 
                                type="text"
                                placeholder="Escribe el serial..." 
                                value={searchSerial}
                                onChange={(e) => setSearchSerial(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20"
                            />
                        </div>
                        <div className="w-full sm:w-auto">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Modelo</label>
                            <select value={filterModelo} onChange={(e) => setFilterModelo(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none">
                                <option value="all">Todos</option>
                                {uniqueOptions.modelos.map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div className="w-full sm:w-auto">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Clase</label>
                            <select value={filterClase} onChange={(e) => setFilterClase(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none">
                                <option value="all">Todas</option>
                                {uniqueOptions.clases.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="w-full sm:w-auto">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Estado SIS</label>
                            <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none">
                                <option value="all">Todos</option>
                                {uniqueOptions.estados.map((e) => <option key={e} value={e}>{e}</option>)}
                            </select>
                        </div>
                        <div className="w-full sm:w-auto">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Status Aud.</label>
                            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none">
                                <option value="all">Todos</option>
                                {uniqueOptions.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="w-full sm:w-auto">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Tipo</label>
                            <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none">
                                <option value="all">Todos</option>
                                {uniqueOptions.tipos.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Tabla */}
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Serial</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Modelo / Clase</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Ubicación Sistema</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado Sistema</th>
                                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Auditoría</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredList.map((item: any, idx: number) => (
                                    <tr key={idx} className="group hover:bg-slate-50/50 transition-all">
                                        <td className="px-6 py-4 font-black font-mono text-slate-900">{item.serial}</td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border",
                                                item.tipo_item === 'Accesorio'
                                                    ? "bg-purple-50 text-purple-600 border-purple-100"
                                                    : "bg-blue-50 text-blue-600 border-blue-100"
                                            )}>
                                                {item.tipo_item === 'Accesorio' ? 'Accesorio' : 'Equipo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700">{item.modelo}</span>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{item.clase}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-500 uppercase">{item.ubicacion_actual}</td>
                                        <td className="px-6 py-4">
                                             <span className={cn(
                                                "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border",
                                                ['Ingresado', 'Reservado', 'ingresado', 'reservado'].includes(item.estado_actual) 
                                                    ? "bg-green-50 text-green-600 border-green-100" 
                                                    : "bg-orange-50 text-orange-600 border-orange-100"
                                            )}>
                                                {item.estado_actual}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={cn(
                                                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest",
                                                item.status_auditoria.includes('Correctamente') ? "text-emerald-600 bg-emerald-50" : 
                                                item.status_auditoria.includes('Faltante') ? "text-red-600 bg-red-50" :
                                                "text-orange-600 bg-orange-50"
                                            )}>
                                                {item.status_auditoria.includes('Correctamente') && <CheckCircle2 className="w-3.5 h-3.5" />}
                                                {item.status_auditoria.includes('No existe') && <AlertTriangle className="w-3.5 h-3.5" />}
                                                {item.status_auditoria}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {filteredList.length === 0 && (
                                     <tr>
                                         <td colSpan={6} className="px-6 py-24 text-center text-slate-400">
                                            <Box className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                            <p className="font-black text-xs uppercase tracking-widest">No hay registros para mostrar con estos filtros</p>
                                         </td>
                                     </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
