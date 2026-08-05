import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Info } from 'lucide-react';

export default function ObservacionesSection({ observaciones }: { observaciones: any[] }) {
    return (
        <Card className="shadow-sm border-slate-100">
            <CardHeader className="bg-slate-50 border-b border-slate-100">
                <CardTitle className="text-lg font-bold text-slate-800">Observaciones</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
                {observaciones.length === 0 ? (
                    <p className="text-slate-400 text-sm text-center py-4">No hay observaciones para este periodo.</p>
                ) : (
                    observaciones.map((obs, idx) => {
                        const isAlerta = obs.tipo === 'Alerta';
                        const isWarning = obs.tipo === 'Warning';
                        
                        const bgClass = isAlerta ? 'bg-red-50/50 border-red-100' : isWarning ? 'bg-amber-50/50 border-amber-100' : 'bg-blue-50/50 border-blue-100';
                        const iconColor = isAlerta ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-blue-500';
                        const titleColor = isAlerta ? 'text-red-800' : isWarning ? 'text-amber-800' : 'text-blue-800';

                        return (
                            <div key={idx} className={`flex items-start space-x-3 p-3 rounded-lg border ${bgClass}`}>
                                <Info className={`w-5 h-5 mt-0.5 flex-shrink-0 ${iconColor}`} />
                                <div>
                                    <p className={`text-sm font-bold ${titleColor}`}>{obs.tipo}</p>
                                    <p className="text-sm text-slate-700 mt-1 leading-relaxed">{obs.mensaje}</p>
                                </div>
                            </div>
                        );
                    })
                )}
            </CardContent>
        </Card>
    );
}
