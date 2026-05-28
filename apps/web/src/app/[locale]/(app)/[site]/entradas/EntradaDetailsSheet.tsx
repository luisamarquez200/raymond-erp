import { useEffect, useState, useMemo } from 'react';
import { EvaluacionModal } from '@/components/taller-r1/evaluaciones/EvaluacionModal';
import HistoryView from '@/components/taller-r1/evaluaciones/HistoryView';
import { useAuthTallerStore } from '@/store/auth-taller.store';

import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';
import { entradasApi, Entrada } from '@/services/taller-r1/entradas.service';
import { Loader2, Calendar, User, UserCheck, AlertCircle, FileText, Package, Wrench, MessageSquare, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

interface EntradaDetailsSheetProps {
    entradaId: string | null;
    open: boolean;
    onClose: () => void;
}

export function EntradaDetailsSheet({ entradaId, open, onClose }: EntradaDetailsSheetProps) {
    const [loading, setLoading] = useState(false);
    const [entrada, setEntrada] = useState<Entrada | null>(null);
    const [detalles, setDetalles] = useState<any[]>([]);
    const [accesorios, setAccesorios] = useState<any[]>([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Evaluation Modal State
    const [evalModalOpen, setEvalModalOpen] = useState(false);
    const [selectedItemForEval, setSelectedItemForEval] = useState<any>(null);
    const [selectedEvalId, setSelectedEvalId] = useState<string | undefined>(undefined);
    const { selectedSite } = useAuthTallerStore();


    useEffect(() => {
        if (open && entradaId) {
            loadDetails(entradaId);
        } else {
            // Reset state when closed
            setEntrada(null);
            setDetalles([]);
            setAccesorios([]);
        }
    }, [open, entradaId]);

    const loadDetails = async (id: string) => {
        try {
            setLoading(true);
            const [entradaData, detallesData, accesoriosData] = await Promise.all([
                entradasApi.getById(id),
                entradasApi.getDetalles(id),
                entradasApi.getAccesorios(id)
            ]);
            console.log('Detalles loaded:', detallesData);
            console.log('Accesorios loaded:', accesoriosData);
            setEntrada(entradaData);
            setDetalles(Array.isArray(detallesData) ? detallesData : []);
            setAccesorios(Array.isArray(accesoriosData) ? accesoriosData : []);
        } catch (error) {
            console.error('Error loading entrada details:', error);
            toast.error('Error al cargar los detalles de la entrada');
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Por Ubicar': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'Cerrado': return 'bg-green-100 text-green-800 border-green-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    return (
        <Sheet open={open} onOpenChange={(val) => !val && onClose()}>
            <SheetContent side="right" className="w-[800px] sm:w-[540px] overflow-y-auto">
                <SheetHeader className="mb-6">
                    <SheetTitle className="flex items-center gap-3 text-2xl">
                        {loading ? (
                            <span className="h-8 w-32 bg-gray-200 animate-pulse rounded"></span>
                        ) : (
                            <>
                                <span className="font-mono text-gray-500">#{entrada?.folio}</span>
                                <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(entrada?.estado || '')}`}>
                                    {entrada?.estado}
                                </span>
                            </>
                        )}
                    </SheetTitle>
                    <SheetDescription>
                        Detalles completos de la entrada al taller.
                    </SheetDescription>
                </SheetHeader>

                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 space-y-4">
                        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
                        <p className="text-gray-500 text-sm font-medium">Cargando información premium...</p>
                    </div>
                ) : entrada ? (
                    <div className="space-y-8 pb-10">
                        {/* Info General Premium */}
                        <section className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 space-y-6 shadow-sm">
                            <div className="flex items-center justify-between">
                                <h3 className="font-black text-slate-900 flex items-center gap-2 uppercase tracking-widest text-xs">
                                    <FileText className="w-4 h-4 text-slate-500" />
                                    Información General
                                </h3>
                                <span className={`px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border shadow-sm ${getStatusColor(entrada.estado || '')}`}>
                                    {entrada.estado}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                <div className="space-y-1">
                                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Cliente</p>
                                    <p className="font-bold text-slate-700 text-sm">
                                        {entrada.rel_cliente?.nombre_cliente || entrada.cliente || '-'}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Registro</p>
                                    <div className="flex items-center gap-2 font-bold text-slate-700 text-sm">
                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                        {new Date(entrada.fecha_creacion).toLocaleDateString()}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Folio</p>
                                    <p className="font-mono font-black text-slate-900 text-base underline decoration-slate-200 underline-offset-4">{entrada.folio}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Creado por</p>
                                    <div className="flex items-center gap-2 font-bold text-slate-700 text-sm">
                                        <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                                            <User className="w-3 h-3 text-slate-400" />
                                        </div>
                                        {entrada.usuario_asignado || '-'}
                                    </div>
                                </div>
                                <div className="space-y-2 col-span-1">
                                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Factura</p>
                                    <p className="font-bold text-slate-700 text-sm bg-slate-100/50 w-fit px-2 py-0.5 rounded border border-slate-200/50">{entrada.factura || '-'}</p>
                                </div>
                            </div>

                            {entrada.comentario && (
                                <div className="mt-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <MessageSquare className="w-3 h-3 text-slate-400" /> Comentarios
                                    </p>
                                    <p className="text-sm text-slate-600 font-medium italic leading-relaxed">
                                        "{entrada.comentario}"
                                    </p>
                                </div>
                            )}
                        </section>

                        {/* Evidencias Visuales */}
                        {(entrada.evidencia_1 || entrada.evidencia_2 || entrada.evidencia_3) && (
                            <section className="space-y-4">
                                <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest text-[10px] ml-1">
                                    <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                                    Galería de Evidencias
                                </h3>
                                <div className="grid grid-cols-3 gap-3">
                                    {[entrada.evidencia_1, entrada.evidencia_2, entrada.evidencia_3]
                                        .filter(Boolean)
                                        .map((evidencia, i) => (
                                            <div key={i} className="aspect-video bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 relative group shadow-sm transition-all hover:border-slate-300">
                                                <img
                                                    src={evidencia}
                                                    alt={`Evidencia ${i + 1}`}
                                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                                />
                                                <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
                                                    <a
                                                        href={evidencia}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="bg-white/90 text-slate-900 text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-xl hover:bg-slate-900 hover:text-white transition-all"
                                                    >
                                                        Ampliar
                                                    </a>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </section>
                        )}

                        {/* Equipos Detallados */}
                        <section className="space-y-4">
                            <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest text-[10px] ml-1">
                                <Package className="w-3.5 h-3.5 text-slate-400" />
                                Inventario de Equipos ({detalles.length})
                            </h3>
                            {detalles.length === 0 ? (
                                <div className="p-12 text-center bg-slate-50/50 rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-4">
                                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center border border-slate-100">
                                        <Package className="w-8 h-8 text-slate-200" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inventario Vacío</p>
                                        <p className="text-xs text-slate-400 font-medium mt-1">No hay equipos vinculados en este folio.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {detalles.map((detalle, idx) => (
                                        <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 w-20 h-20 bg-slate-50 rounded-bl-[3rem] -mr-6 -mt-6 -z-0 group-hover:bg-slate-100 transition-colors"></div>

                                            <div className="relative z-10">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <p className="font-black text-slate-900 text-base tracking-tight leading-tight">{detalle.modelo}</p>
                                                        <p className="text-[10px] font-mono text-slate-400 mt-0.5 bg-slate-50 w-fit px-1.5 py-0.5 rounded uppercase font-bold border border-slate-100">SN: {detalle.serial_equipo || detalle.serial}</p>
                                                    </div>
                                                    <span className="text-[9px] font-black bg-slate-800 text-white px-2.5 py-1 rounded-lg uppercase tracking-widest shadow-lg shadow-slate-200">
                                                        {detalle.clase}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1">
                                                        <p className="text-slate-400 text-[8px] font-black uppercase tracking-widest">Observaciones</p>
                                                        <p className="text-[11px] text-slate-600 font-medium leading-relaxed italic line-clamp-2">
                                                            {detalle.comentarios || 'Sin observaciones registradas.'}
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2">
                                                        {detalle.calificacion && (
                                                            <div className="space-y-1 text-right">
                                                                <p className="text-slate-400 text-[8px] font-black uppercase tracking-widest">Calificación</p>
                                                                <span className="inline-block text-[10px] font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                                                                    {detalle.calificacion}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {selectedSite !== 'r3' && selectedSite !== 'r2' && (
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedItemForEval({
                                                                        id: detalle.id_detalles,
                                                                        serial: detalle.serial_equipo || detalle.serial,
                                                                        modelo: detalle.modelo,
                                                                        tipo: 'equipo',
                                                                        clase: detalle.clase,
                                                                        distribuidor: entrada.distribuidor,
                                                                        cliente_origen: entrada.rel_cliente?.nombre_cliente || entrada.cliente_origen
                                                                    });
                                                                    setSelectedEvalId(undefined);
                                                                    setEvalModalOpen(true);
                                                                }}
                                                                className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-indigo-100"
                                                            >
                                                                Evaluar
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {selectedSite !== 'r3' && (
                                                    <div className="mt-6 pt-6 border-t border-slate-50">
                                                        <HistoryView
                                                            item={{
                                                                id: detalle.id_detalles,
                                                                serial: detalle.serial_equipo || detalle.serial || '',
                                                                tipo: 'equipo'
                                                            }}
                                                            onViewEvaluation={(evalId) => {
                                                                setSelectedItemForEval({
                                                                    id: detalle.id_detalles,
                                                                    serial: detalle.serial_equipo || detalle.serial || '',
                                                                    modelo: detalle.modelo,
                                                                    tipo: 'equipo',
                                                                    clase: detalle.clase,
                                                                    distribuidor: entrada.distribuidor,
                                                                    cliente_origen: entrada.rel_cliente?.nombre_cliente || entrada.cliente_origen
                                                                });
                                                                setSelectedEvalId(evalId);
                                                                setEvalModalOpen(true);
                                                            }}
                                                            refreshTrigger={refreshTrigger}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>



                        {/* Firmas de Formalización */}
                        <section className="space-y-4">
                            <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest text-[10px] ml-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                                Formalización y Firmas
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-3 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 shadow-inner">
                                    <div className="flex flex-col items-center">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-3">Firma de Entrega</p>
                                        <div className="w-full aspect-[2/1] bg-white rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden shadow-sm shadow-inner">
                                            {entrada.firma_entrega ? (
                                                <img src={entrada.firma_entrega} className="max-h-full object-contain mix-blend-multiply opacity-80" alt="Firma Entrega" />
                                            ) : (
                                                <span className="text-[10px] text-slate-300 font-bold italic uppercase text-xs">Pendiente</span>
                                            )}
                                        </div>
                                        <p className="mt-3 text-sm font-black text-slate-700 border-b-2 border-slate-100 pb-0.5">{entrada.nombre_entrega || '-'}</p>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1 italic">Entregó Material</p>
                                    </div>
                                </div>
                                <div className="space-y-3 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 shadow-inner">
                                    <div className="flex flex-col items-center">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-3">Firma de Recibido</p>
                                        <div className="w-full aspect-[2/1] bg-white rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden shadow-sm shadow-inner">
                                            {entrada.firma_recibo ? (
                                                <img src={entrada.firma_recibo} className="max-h-full object-contain mix-blend-multiply opacity-80" alt="Firma Recibo" />
                                            ) : (
                                                <span className="text-[10px] text-slate-300 font-bold italic uppercase text-xs">Pendiente</span>
                                            )}
                                        </div>
                                        <p className="mt-3 text-sm font-black text-slate-700 border-b-2 border-slate-100 pb-0.5">{entrada.usuario_asignado || '-'}</p>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1 italic">Recibió en Almacén</p>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-300 bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-200 m-6 p-12">
                        <div className="w-20 h-20 bg-white rounded-[1.5rem] shadow-md flex items-center justify-center mb-6 border border-slate-100">
                            <AlertCircle className="w-10 h-10 text-slate-100" />
                        </div>
                        <p className="font-black uppercase tracking-[0.2em] text-[10px] text-slate-400">Información no disponible</p>
                    </div>
                )}
            </SheetContent>

            {selectedItemForEval && (
                <EvaluacionModal
                    open={evalModalOpen}
                    onClose={() => {
                        setEvalModalOpen(false);
                        setSelectedItemForEval(null);
                        setSelectedEvalId(undefined);
                    }}
                    item={selectedItemForEval}
                    evaluationId={selectedEvalId}
                    onSuccess={() => {
                        entrada && loadDetails(entrada.id_entrada);
                        setRefreshTrigger(prev => prev + 1);
                    }}
                />
            )}
        </Sheet>
    );
}
