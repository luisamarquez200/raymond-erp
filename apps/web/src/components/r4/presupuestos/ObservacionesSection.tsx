import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Info, AlertTriangle, AlertCircle } from 'lucide-react';

export default function ObservacionesSection({ observaciones = [] }: { observaciones: any[] }) {
    return (
        <Card className="shadow-sm border-slate-100/90 overflow-hidden bg-white rounded-2xl h-[420px] flex flex-col">
            <CardHeader className="bg-slate-50/90 border-b border-slate-100 py-3.5 px-5 flex flex-row items-center justify-between shrink-0">
                <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    Observaciones y Notificaciones
                </CardTitle>
                <span className="text-[11px] font-extrabold text-slate-600 bg-slate-200/60 px-2.5 py-1 rounded-full">
                    {observaciones.length} avisos
                </span>
            </CardHeader>
            <CardContent className="p-4 space-y-3 flex-1 overflow-y-auto">
                {observaciones.length === 0 ? (
                    <p className="text-slate-400 text-xs text-center py-12">No hay observaciones para este periodo.</p>
                ) : (
                    observaciones.map((obs, idx) => {
                        const isAlerta = obs.tipo === 'Alerta';
                        const isWarning = obs.tipo === 'Warning';
                        
                        const bgClass = isAlerta ? 'bg-red-50/60 border-red-200/70' : isWarning ? 'bg-amber-50/60 border-amber-200/70' : 'bg-blue-50/60 border-blue-200/70';
                        const iconColor = isAlerta ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-blue-500';
                        const titleColor = isAlerta ? 'text-red-900' : isWarning ? 'text-amber-900' : 'text-blue-900';

                        const IconComponent = isAlerta ? AlertCircle : isWarning ? AlertTriangle : Info;

                        return (
                            <div key={idx} className={`flex items-start space-x-3 p-3.5 rounded-xl border ${bgClass} transition-all`}>
                                <IconComponent className={`w-5 h-5 mt-0.5 flex-shrink-0 ${iconColor}`} />
                                <div className="space-y-0.5">
                                    <p className={`text-xs font-extrabold uppercase tracking-wider ${titleColor}`}>{obs.tipo}</p>
                                    <p className="text-xs font-medium text-slate-700 leading-relaxed">{obs.mensaje}</p>
                                </div>
                            </div>
                        );
                    })
                )}
            </CardContent>
        </Card>
    );
}
