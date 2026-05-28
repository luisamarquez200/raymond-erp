'use client';

import { useState, useEffect } from 'react';
import renovadosService, { RenovadoSolicitud } from '@/services/taller-r1/renovados.service';
import { NuevaSolicitudModal } from './NuevaSolicitudModal';
import { DetalleRenovadoModal } from './DetalleRenovadoModal';
import { EstacionesTab } from './EstacionesTab';
import { toast } from 'sonner';
import {
    Search, Clock, CheckCircle2, AlertCircle,
    Wrench, ArrowRight, Package, Calendar, Play, LayoutGrid, LayoutDashboard, Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { QrScannerButton } from '@/components/ui/qr-scanner-button';

export const RenovadosDashboard = ({ forceView }: { forceView?: 'estaciones' | 'solicitudes' }) => {
    const [solicitudes, setSolicitudes] = useState<RenovadoSolicitud[]>([]);
    const [pendingEquipos, setPendingEquipos] = useState<any[]>([]);
    const [estaciones, setEstaciones] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'estaciones' | 'solicitudes'>(forceView || 'estaciones');
    const [solicitudView, setSolicitudView] = useState<'activos' | 'pendientes'>('activos');
    const [filterStatus, setFilterStatus] = useState<'todo' | 'Por Iniciar' | 'En Proceso' | 'Finalizado'>('todo');
    const [showEstacionesMap, setShowEstacionesMap] = useState(true);

    const [showNuevaModal, setShowNuevaModal] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedItem, setSelectedItem] = useState<any | null>(null);

    useEffect(() => {
        if (activeTab === 'solicitudes') {
            loadData();
        }
    }, [activeTab, solicitudView]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [solicitudesData, stationsData] = await Promise.all([
                solicitudView === 'activos' ? renovadosService.findAll() : renovadosService.getPending(),
                renovadosService.getEstaciones()
            ]);

            if (solicitudView === 'activos') {
                setSolicitudes(solicitudesData);
            } else {
                setPendingEquipos(solicitudesData);
            }

            // Natural sorting order (1, 2, 3...)
            const sortedStations = (stationsData || []).sort((a: any, b: any) =>
                a.nombre.localeCompare(b.nombre, undefined, { numeric: true, sensitivity: 'base' })
            );
            setEstaciones(sortedStations);
        } catch (error) {
            toast.error('Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    const filtered = solicitudes.filter(s => {
        const matchesSearch = s.serial_equipo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.cliente?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterStatus === 'todo' || s.estado === filterStatus;
        return matchesSearch && matchesFilter;
    });

    const sortedFiltered = [...filtered].sort((a, b) => {
        const nameA = a.rel_estacion?.nombre || '';
        const nameB = b.rel_estacion?.nombre || '';
        
        if (!nameA && !nameB) return 0;
        if (!nameA) return 1; // Put unassigned at the end
        if (!nameB) return -1;
        
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });

    const filteredPending = pendingEquipos.filter(e =>
        e.serial_equipo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.modelo?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getProgress = (solicitud: RenovadoSolicitud) => {
        if (!solicitud.fases || solicitud.fases.length === 0) return 0;
        const completed = solicitud.fases.filter(f => f.estado === 'Finalizada').length;
        return Math.round((completed / solicitud.fases.length) * 100);
    };

    const getActivePhase = (solicitud: RenovadoSolicitud) => {
        if (!solicitud.fases || solicitud.fases.length === 0) return 'Iniciando...';
        const active = solicitud.fases.find(f => f.estado === 'En proceso');
        if (active) return active.nombre_fase;
        const next = solicitud.fases.find(f => f.estado === 'Sin iniciar');
        return next ? `Pendiente: ${next.nombre_fase}` : 'Finalizado';
    };

    const getTotalHours = (solicitud: RenovadoSolicitud) => {
        if (!solicitud.fases || solicitud.fases.length === 0) return 0;
        return solicitud.fases.reduce((sum, f) => sum + (f.horas_registradas || 0), 0);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            {!forceView && (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Administración de Taller</h1>
                        <p className="text-slate-500 font-medium mt-1">Gestión de estaciones y solicitudes de mantenimiento R1</p>
                    </div>
                </div>
            )}

            {forceView === 'solicitudes' && (
                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Solicitudes de Taller</h1>
                        <p className="text-slate-500 font-medium mt-1">Órdenes de trabajo y seguimiento de mantenimiento R1</p>
                    </div>
                </div>
            )}

            {/* Main Navigation Tabs */}
            {!forceView && (
                <div className="flex bg-slate-100/50 p-1.5 rounded-[2rem] border border-slate-100 gap-2 w-fit">
                    <button
                        onClick={() => setActiveTab('estaciones')}
                        className={cn(
                            "flex items-center gap-2 px-8 py-3 rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all",
                            activeTab === 'estaciones'
                                ? "bg-white text-red-600 shadow-xl shadow-red-500/10"
                                : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        <LayoutGrid className="w-4 h-4" />
                        Estaciones
                    </button>
                    <button
                        onClick={() => setActiveTab('solicitudes')}
                        className={cn(
                            "flex items-center gap-2 px-8 py-3 rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all",
                            activeTab === 'solicitudes'
                                ? "bg-white text-red-600 shadow-xl shadow-red-500/10"
                                : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        <Wrench className="w-4 h-4" />
                        Solicitudes de Taller
                    </button>
                </div>
            )}

            {activeTab === 'estaciones' ? (
                <EstacionesTab />
            ) : (
                <div className="space-y-6">
                    {/* Action Bar */}
                    <div className="flex bg-slate-100/50 p-1 rounded-2xl w-full justify-end gap-2 mb-4">
                        {!showEstacionesMap && solicitudView === 'activos' && estaciones.length > 0 && (
                            <button
                                onClick={() => setShowEstacionesMap(true)}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all bg-slate-900 text-white hover:bg-slate-800 shadow-sm mr-auto"
                            >
                                <LayoutGrid className="w-4 h-4" /> Mostrar Mapa
                            </button>
                        )}
                        <button
                            onClick={() => setShowNuevaModal(true)}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all bg-red-600 text-white hover:bg-red-700 shadow-sm ml-auto"
                        >
                            <Plus className="w-4 h-4" /> Nueva Solicitud
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5">
                            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                                <LayoutDashboard className="w-7 h-7" />
                            </div>
                            <div>
                                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Total Órdenes</p>
                                <h3 className="text-3xl font-black text-slate-900">{solicitudes.length}</h3>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5">
                            <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                                <Clock className="w-7 h-7" />
                            </div>
                            <div>
                                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">En Proceso</p>
                                <h3 className="text-3xl font-black text-slate-900">{solicitudes.filter(s => s.estado === 'En Proceso').length}</h3>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5">
                            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                                <CheckCircle2 className="w-7 h-7" />
                            </div>
                            <div>
                                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Finalizados</p>
                                <h3 className="text-3xl font-black text-slate-900">{solicitudes.filter(s => s.estado === 'Finalizado').length}</h3>
                            </div>
                        </div>
                    </div>

                    {/* Real-time Stations Map */}
                    {solicitudView === 'activos' && estaciones.length > 0 && showEstacionesMap && (
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Mapa de Estaciones</h3>
                                    <p className="text-slate-400 text-xs font-bold mt-0.5">Estado actual y ocupación del taller</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="px-3 py-1 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-wider">
                                        {estaciones.filter(e => solicitudes.some(s => s.id_estacion === e.id_estacion && s.estado !== 'Finalizado')).length} / {estaciones.length} Ocupadas
                                    </span>
                                    <button
                                        onClick={() => setShowEstacionesMap(false)}
                                        className="px-3 py-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors text-[9px] font-black uppercase tracking-widest border border-slate-100"
                                    >
                                        Ocultar
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                {estaciones.map((est) => {
                                    // Find active solicitation in this station
                                    const activeSol = solicitudes.find(s => s.id_estacion === est.id_estacion && s.estado !== 'Finalizado');
                                    
                                    return (
                                        <div
                                            key={est.id_estacion}
                                            onClick={() => activeSol && setSelectedId(activeSol.id_solicitud)}
                                            className={cn(
                                                "p-4 rounded-2xl border transition-all text-left flex flex-col justify-between h-28 relative overflow-hidden group",
                                                activeSol 
                                                    ? "bg-gradient-to-br from-red-50/50 to-red-100/20 border-red-100 hover:border-red-300 hover:shadow-lg hover:shadow-red-50/50 cursor-pointer" 
                                                    : "bg-slate-50/50 border-slate-100/80 hover:bg-slate-50"
                                            )}
                                        >
                                            {/* Top Line */}
                                            <div className="flex items-center justify-between w-full">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider group-hover:text-slate-700 transition-colors">
                                                    {est.nombre}
                                                </span>
                                                <span className={cn(
                                                    "w-2 h-2 rounded-full",
                                                    activeSol ? "bg-red-500 animate-pulse" : "bg-slate-300"
                                                )} />
                                            </div>

                                            {/* Content */}
                                            <div className="mt-2 flex-1 flex flex-col justify-end">
                                                {activeSol ? (
                                                    <>
                                                        <span className="text-sm font-black text-slate-900 tracking-tight block uppercase truncate">
                                                            {activeSol.serial_equipo}
                                                        </span>
                                                        <span className="text-[9px] font-bold text-red-600 block mt-0.5 truncate uppercase tracking-widest">
                                                            {getActivePhase(activeSol)}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                        Vacía
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Filters */}
                    <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                        <div className="flex items-center gap-2 w-full flex-1">
                            <div className="relative flex-1 group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-red-500 transition-colors" />
                                <input
                                    type="text"
                                    placeholder={solicitudView === 'activos' ? "Buscar por serie o cliente..." : "Buscar equipo pendiente..."}
                                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:border-red-500 transition-all outline-none font-bold text-sm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <QrScannerButton onScan={(val) => setSearchTerm(val)} />
                        </div>
                        {solicitudView === 'activos' && (
                            <div className="flex bg-slate-50 p-1.5 rounded-xl border border-slate-100 gap-2">
                                {['todo', 'Por Iniciar', 'En Proceso', 'Finalizado'].map((status) => (
                                    <button
                                        key={status}
                                        onClick={() => setFilterStatus(status as any)}
                                        className={cn(
                                            "px-6 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all",
                                            filterStatus === status
                                                ? "bg-white text-red-600 shadow-sm"
                                                : "text-slate-400 hover:text-slate-600"
                                        )}
                                    >
                                        {status === 'todo' ? 'Todos' : status}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Table/Cards */}
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center">
                            <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
                            <p className="mt-4 text-slate-400 font-bold uppercase tracking-widest text-[10px]">Cargando...</p>
                        </div>
                    ) : (
                        sortedFiltered.length === 0 ? (
                            <div className="py-32 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100 italic">
                                <p className="text-slate-300 font-black text-xl">No se encontraron órdenes de taller</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {sortedFiltered.map((solicitud) => {
                                    const totalHours = getTotalHours(solicitud);
                                    return (
                                    <div
                                        key={solicitud.id_solicitud}
                                        onClick={() => setSelectedId(solicitud.id_solicitud)}
                                        className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:border-red-200 hover:shadow-xl hover:shadow-red-500/5 transition-all group relative overflow-hidden flex flex-col md:flex-row md:items-start gap-6 cursor-pointer"
                                    >
                                        {/* Status Indicator */}
                                        <div className={cn(
                                            "absolute top-0 left-0 w-2 h-full",
                                            solicitud.estado === 'Finalizado' ? "bg-emerald-500" : 
                                            solicitud.estado === 'Por Iniciar' ? "bg-slate-300" : "bg-amber-500"
                                        )} />

                                        <div className="flex-1 space-y-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-red-50 group-hover:text-red-600 transition-all">
                                                    <Package className="w-7 h-7" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Serie</span>
                                                        <span className={cn(
                                                            "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border",
                                                            solicitud.estado === 'Finalizado' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : 
                                                            solicitud.estado === 'Por Iniciar' ? "bg-slate-100 text-slate-500 border-slate-200" : "bg-amber-50 text-amber-600 border-amber-100"
                                                        )}>
                                                            {solicitud.estado}
                                                        </span>
                                                    </div>
                                                    <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase truncate">{solicitud.serial_equipo}</h3>
                                                </div>

                                                {/* Progress badge - visible on mobile */}
                                                <div className="md:hidden flex items-center gap-2 shrink-0">
                                                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center">
                                                        <span className="text-xs font-black text-slate-700">{getProgress(solicitud)}%</span>
                                                    </div>
                                                    <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-red-500 transition-all group-hover:translate-x-1" />
                                                </div>
                                            </div>

                                            {/* 4-column grid: Estación, Fase, Responsable, Target */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-1">
                                                <div className="min-w-0">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Estación</span>
                                                    <p className="text-sm font-black text-red-600 truncate">{solicitud.rel_estacion?.nombre || 'General'}</p>
                                                </div>
                                                <div className="min-w-0">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Fase Actual</span>
                                                    <p className="text-sm font-black text-slate-700 truncate">{getActivePhase(solicitud)}</p>
                                                </div>
                                                <div className="min-w-0">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Responsable</span>
                                                    <p className="text-sm font-black text-slate-700 truncate">{solicitud.tecnico_responsable || 'Sin asignar'}</p>
                                                </div>
                                                <div className="min-w-0">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Fecha Target</span>
                                                    <div className="flex items-center gap-1.5">
                                                        <Calendar className="w-3 h-3 text-red-500 shrink-0" />
                                                        <p className="text-sm font-black text-slate-700 truncate">
                                                            {solicitud.fecha_target ? format(new Date(solicitud.fecha_target), 'dd MMM yyyy', { locale: es }) : 'N/A'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 4-column grid: Cliente, ADC, Incidencias, Horas */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-1">
                                                <div className="min-w-0">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Cliente</span>
                                                    <p className="text-sm font-black text-slate-700 truncate">{solicitud.cliente || '—'}</p>
                                                </div>
                                                <div className="min-w-0">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">ADC</span>
                                                    <p className="text-sm font-black text-slate-700 truncate">{solicitud.adc || '—'}</p>
                                                </div>
                                                <div className="min-w-0">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Incidencias</span>
                                                    <div className="flex items-center gap-1.5">
                                                        <AlertCircle className={cn("w-3 h-3 shrink-0", (solicitud._count?.incidencias || 0) > 0 ? "text-red-500" : "text-slate-300")} />
                                                        <p className="text-sm font-black text-slate-700">{solicitud._count?.incidencias || 0}</p>
                                                    </div>
                                                </div>
                                                <div className="min-w-0">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Horas Proceso</span>
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                                                        <p className="text-sm font-black text-slate-700">{totalHours > 0 ? `${totalHours.toFixed(1)}h` : '—'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Desktop: Progress bar + arrow */}
                                        <div className="hidden md:flex flex-col items-center justify-between h-full min-w-[140px] py-2">
                                            <div className="w-full space-y-2">
                                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    <span>Progreso</span>
                                                    <span className="text-slate-900">{getProgress(solicitud)}%</span>
                                                </div>
                                                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={cn(
                                                            "h-full transition-all duration-1000",
                                                            solicitud.estado === 'Finalizado' ? "bg-emerald-500" : "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]"
                                                        )}
                                                        style={{ width: `${getProgress(solicitud)}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-red-50 group-hover:text-red-600 transition-all text-slate-400">
                                                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                                            </div>
                                        </div>
                                    </div>
                                    );
                                })}
                            </div>
                        )
                    )}
                </div>
            )}

            {/* Modals */}
            <NuevaSolicitudModal
                open={showNuevaModal}
                equipo={selectedItem}
                onClose={() => {
                    setShowNuevaModal(false);
                    setSelectedItem(null);
                }}
                onSuccess={loadData}
            />

            <DetalleRenovadoModal
                idSolicitud={selectedId}
                open={!!selectedId}
                onClose={() => setSelectedId(null)}
                onSuccess={loadData}
            />
        </div>
    );
};
