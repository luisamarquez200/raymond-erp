'use client';

import { useState, useEffect } from 'react';
import { evaluacionesApi } from '@/services/taller-r1/evaluaciones.service';
import {
    History,
    Calendar,
    Star,
    Zap,
    FileText,
    Loader2,
    CheckCircle2,
    AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getErrorMessage } from '@/lib/utils';

interface HistoryViewProps {
    item: {
        id: string;
        serial: string;
        tipo: 'equipo' | 'accesorio';
    } | null;
    onViewEvaluation?: (evaluationId: string) => void;
    refreshTrigger?: number;
}

export default function HistoryView({ item, onViewEvaluation, refreshTrigger }: HistoryViewProps) {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {

        if (!item || !item.serial) {
            setHistory([]);
            setLoading(false);
            return;
        }

        let cancelled = false;

        const fetchHistory = async () => {
            setLoading(true);
            try {
                let data: any[] = [];
                if (item.tipo === 'equipo') {
                    data = await evaluacionesApi.getHistoryBySerial(item.serial);
                } else {
                    data = await evaluacionesApi.getChargeHistory(item.id);
                }
                if (!cancelled) {
                    setHistory(Array.isArray(data) ? data : []);
                }
            } catch (error: any) {
                console.error('HistoryView: error loading history', getErrorMessage(error));
                if (!cancelled) {
                    setHistory([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        fetchHistory();

        return () => {
            cancelled = true;
        };
    }, [item?.id, item?.serial, item?.tipo, refreshTrigger]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12 gap-3 text-slate-400">
                <Loader2 className="animate-spin" size={20} />
                <span className="text-xs font-black uppercase tracking-widest">Cargando historial...</span>
            </div>
        );
    }

    const historyArray = Array.isArray(history) ? history : [];

    if (historyArray.length === 0) {
        return (
            <div className="p-12 text-center bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-100 italic text-slate-400 font-medium">
                No hay historial registrado para este elemento.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 px-2 mb-2">
                <History className="text-slate-400" size={20} />
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                    {item?.tipo === 'equipo' ? 'Historial de Evaluaciones' : 'Historial de Cargas'}
                </h4>
            </div>

            <div className="space-y-3">
                {historyArray.map((histItem, idx) => {
                    const dateValue = histItem.fecha_creacion || histItem.fecha_carga;
                    let formattedDate = 'Fecha no disponible';
                    if (dateValue) {
                        const date = new Date(dateValue);
                        if (!isNaN(date.getTime())) {
                            formattedDate = format(date, "d 'de' MMMM, yyyy", { locale: es });
                        }
                    }

                    return (
                        <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-4 group hover:border-indigo-200 transition-all">
                            <div className={`p-3 rounded-xl ${item?.tipo === 'equipo' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                {item?.tipo === 'equipo' ? <Star size={18} /> : <Zap size={18} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-4 mb-2">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-black text-slate-800 tracking-tight">
                                            {item?.tipo === 'equipo' ? 'Evaluación Técnica' : 'Carga Registrada'}
                                        </span>
                                        {histItem.porcentaje_total !== undefined && (
                                            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black border border-indigo-100 shadow-sm">
                                                {histItem.porcentaje_total}%
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-[10px] font-bold text-slate-400 font-mono bg-white px-2 py-1 rounded-md border border-slate-100 uppercase">
                                            {formattedDate}
                                        </span>
                                        {item?.tipo === 'equipo' && histItem.id_evaluacion && (
                                            <button
                                                onClick={() => onViewEvaluation?.(histItem.id_evaluacion)}
                                                className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-indigo-100"
                                                title="Ver Detalle Completos"
                                            >
                                                <CheckCircle2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {histItem.estado_montacargas && (
                                    <p className="text-xs font-bold text-indigo-900/40 uppercase tracking-widest mb-2 px-1">
                                        Estado: <span className="text-indigo-600 underline underline-offset-4 decoration-indigo-200">{histItem.estado_montacargas}</span>
                                    </p>
                                )}
                                {(histItem.notas || histItem.comentarios) && (
                                    <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed italic">
                                            {histItem.notas || histItem.comentarios}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
