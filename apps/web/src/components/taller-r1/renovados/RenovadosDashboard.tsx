'use client';

import { useState, useEffect } from 'react';
import renovadosService, { RenovadoSolicitud } from '@/services/taller-r1/renovados.service';
import { NuevaSolicitudModal } from './NuevaSolicitudModal';
import { DetalleRenovadoModal } from './DetalleRenovadoModal';
import { toast } from 'sonner';
import {
    Plus, Search, Filter, Clock, CheckCircle2, AlertCircle,
    Wrench, ArrowRight, Package, Calendar, User, LayoutDashboard,
    MoreVertical, Eye, Play
} from 'lucide-react';
import { cn, getErrorMessage } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const RenovadosDashboard = () => {
    const [solicitudes, setSolicitudes] = useState<RenovadoSolicitud[]>([]);
    const [pendingEquipos, setPendingEquipos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'activos' | 'pendientes'>('activos');
    const [filterStatus, setFilterStatus] = useState<'todo' | 'En Proceso' | 'Finalizado'>('todo');

    const [showNuevaModal, setShowNuevaModal] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedItem, setSelectedItem] = useState<any | null>(null);

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        try {
            setLoading(true);
            if (activeTab === 'activos') {
                const data = await renovadosService.findAll();
                setSolicitudes(data);
            } else {
                const data = await renovadosService.getPending();
                setPendingEquipos(data);
            }
        } catch (error) {
            toast.error(getErrorMessage(error, 'Error al cargar datos'));
        } finally {
            setLoading(false);
        }
    };

    const searchFiltered = solicitudes.filter(s => {
        const matchesSearch = (s.serial_equipo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (s.cliente || '').toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    const filtered = searchFiltered.filter(s => {
        return filterStatus === 'todo' || s.estado === filterStatus;
    });

    const filteredPending = pendingEquipos.filter(e =>
        e.serial_equipo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.modelo?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getProgress = (solicitud: RenovadoSolicitud) => {
        if (!solicitud.fases || solicitud.fases.length === 0) return 0;
        const completed = solicitud.fases.filter(f => f.completado).length;
        return Math.round((completed / solicitud.fases.length) * 100);
    };

    const getActivePhase = (solicitud: RenovadoSolicitud) => {
        if (!solicitud.fases) return 'N/A';
        const active = solicitud.fases.find(f => !f.completado && f.fecha_inicio);
        if (active) return active.nombre_fase;
        const next = solicitud.fases.find(f => !f.completado);
        return next ? `Pendiente: ${next.nombre_fase}` : 'Finalizado';
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header & Stats */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">Administración de Renovado</h1>
                    <p className="text-slate-500 font-medium mt-1">Gestión manual de equipos evaluados para renovación</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-slate-100/50 p-1.5 rounded-[2rem] border border-slate-100 gap-2 w-fit">
                <button
                    onClick={() => setActiveTab('activos')}
                    className={cn(
                        "flex items-center gap-2 px-8 py-3 rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all",
                        activeTab === 'activos'
                            ? "bg-white text-red-600 shadow-xl shadow-red-500/10"
                            : "text-slate-400 hover:text-slate-600"
                    )}
                >
                    <Wrench className="w-4 h-4" />
                    Órdenes Activas
                    <span className="ml-2 bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-[10px]">
                        {searchFiltered.length}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('pendientes')}
                    className={cn(
                        "flex items-center gap-2 px-8 py-3 rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all",
                        activeTab === 'pendientes'
                            ? "bg-white text-red-600 shadow-xl shadow-red-500/10"
                            : "text-slate-400 hover:text-slate-600"
                    )}
                >
                    <Clock className="w-4 h-4" />
                    Pendientes de Inicio
                    <span className="ml-2 bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-[10px]">
                        {filteredPending.length}
                    </span>
                </button>
            </div>

            <div className="sticky top-16 lg:top-0 z-20 bg-gray-50/95 backdrop-blur-md py-3 -my-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5">
                        <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                            <LayoutDashboard className="w-7 h-7" />
                        </div>
                        <div>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Total Órdenes</p>
                            <h3 className="text-3xl font-black text-slate-900">{searchFiltered.length}</h3>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5">
                        <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                            <Clock className="w-7 h-7" />
                        </div>
                        <div>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">En Proceso</p>
                            <h3 className="text-3xl font-black text-slate-900">{searchFiltered.filter(s => s.estado === 'En Proceso').length}</h3>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5">
                        <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                            <CheckCircle2 className="w-7 h-7" />
                        </div>
                        <div>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Finalizados</p>
                            <h3 className="text-3xl font-black text-slate-900">{searchFiltered.filter(s => s.estado === 'Finalizado').length}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-red-500 transition-colors" />
                    <input
                        type="text"
                        placeholder={activeTab === 'activos' ? "Buscar por serie o cliente..." : "Buscar equipo pendiente..."}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:border-red-500 transition-all outline-none font-bold text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                {activeTab === 'activos' && (
                    <div className="flex bg-slate-50 p-1.5 rounded-xl border border-slate-100 gap-2">
                        {['todo', 'En Proceso', 'Finalizado'].map((status) => (
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
            ) : activeTab === 'activos' ? (
                filtered.length === 0 ? (
                    <div className="py-32 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100 italic">
                        <p className="text-slate-300 font-black text-xl">No se encontraron órdenes de renovado</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {filtered.map((solicitud) => (
                            <div
                                key={solicitud.id_solicitud}
                                className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:border-red-200 hover:shadow-xl hover:shadow-red-500/5 transition-all group relative overflow-hidden flex flex-col md:flex-row md:items-center gap-8"
                            >
                                {/* Status Indicator */}
                                <div className={cn(
                                    "absolute top-0 left-0 w-2 h-full",
                                    solicitud.estado === 'Finalizado' ? "bg-emerald-500" : "bg-amber-500"
                                )} />

                                <div className="flex-1 space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-red-50 group-hover:text-red-600 transition-all">
                                            <Package className="w-7 h-7" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Serie</span>
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border",
                                                    solicitud.estado === 'Finalizado' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                                                )}>
                                                    {solicitud.estado}
                                                </span>
                                            </div>
                                            <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">{solicitud.serial_equipo}</h3>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 px-1">
                                        <div>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Fase Actual</span>
                                            <p className="text-sm font-black text-slate-700 truncate">{getActivePhase(solicitud)}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Responsable</span>
                                            <p className="text-sm font-black text-slate-700 truncate">{solicitud.tecnico_responsable || 'Sin asignar'}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Fecha Target</span>
                                            <div className="flex items-center gap-1.5">
                                                <Calendar className="w-3 h-3 text-red-500" />
                                                <p className="text-sm font-black text-slate-700">
                                                    {solicitud.fecha_target ? format(new Date(solicitud.fecha_target), 'dd MMM yyyy', { locale: es }) : 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Incidencias</span>
                                            <div className="flex items-center gap-1.5">
                                                <AlertCircle className={cn("w-3 h-3", (solicitud._count?.incidencias || 0) > 0 ? "text-red-500" : "text-slate-300")} />
                                                <p className="text-sm font-black text-slate-700">{solicitud._count?.incidencias || 0} registradas</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Progress & Actions */}
                                <div className="flex flex-col items-center md:items-end gap-6 min-w-[180px]">
                                    <div className="w-full space-y-2">
                                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            <span>Progreso</span>
                                            <span className="text-slate-900">{getProgress(solicitud)}%</span>
                                        </div>
                                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className={cn(
                                                    "h-full transition-all duration-1000",
                                                    solicitud.estado === 'Finalizado' ? "bg-emerald-500" : "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]"
                                                )}
                                                style={{ width: `${getProgress(solicitud)}%` }}
                                            />
                                        </div>
                                    </div>
                                    <button
                                        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-900 text-white rounded-2xl hover:bg-red-600 transition-all font-black text-xs uppercase tracking-widest group"
                                        onClick={() => setSelectedId(solicitud.id_solicitud)}
                                    >
                                        Continuar
                                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            ) : (
                filteredPending.length === 0 ? (
                    <div className="py-32 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100 italic">
                        <p className="text-slate-300 font-black text-xl">No hay equipos pendientes de renovación</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredPending.map((equipo) => (
                            <div
                                key={equipo.id_equipo_ubicacion}
                                className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:border-red-200 transition-all flex items-center justify-between gap-4"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                                        <Package className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pendiente</span>
                                            <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded text-[8px] font-black uppercase tracking-widest border border-red-100">
                                                {equipo.calificacion}
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-black text-slate-900 uppercase">{equipo.serial_equipo}</h3>
                                        <p className="text-xs font-bold text-slate-400">{equipo.modelo} - {equipo.clase}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedItem(equipo);
                                        setShowNuevaModal(true);
                                    }}
                                    className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-200"
                                >
                                    <Play className="w-4 h-4 fill-current" />
                                    Iniciar
                                </button>
                            </div>
                        ))}
                    </div>
                )
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
