'use client';

import { useState, useEffect } from 'react';
import { mantenimientoApi, evaluacionesApi } from '@/services/taller-r1/evaluaciones.service';
import {
    Zap,
    Calendar,
    MapPin,
    AlertTriangle,
    CheckCircle2,
    Loader2,
    History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function MantenimientoList() {
    const [alertas, setAlertas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [registering, setRegistering] = useState<string | null>(null);

    useEffect(() => {
        loadAlertas();
    }, []);

    const loadAlertas = async () => {
        setLoading(true);
        try {
            const data = await mantenimientoApi.getAlertas();
            setAlertas(data?.data || data || []);
        } catch (error) {
            console.error('Error loading maintenance alerts:', getErrorMessage(error));
            toast.error(getErrorMessage(error, 'Error al cargar alertas de mantenimiento'));
        } finally {
            setLoading(false);
        }
    };

    const handleRegisterCharge = async (id_accesorio: string) => {
        setRegistering(id_accesorio);
        try {
            await evaluacionesApi.registerCharge(id_accesorio, 'Carga cíclica programada');
            toast.success('Carga registrada correctamente. Próxima carga en 30 días.');
            await loadAlertas();
        } catch (error) {
            console.error('Error registering charge:', getErrorMessage(error));
            toast.error(getErrorMessage(error, 'Error al registrar la carga'));
        } finally {
            setRegistering(null);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
                <Loader2 className="animate-spin" size={40} />
                <p className="font-bold uppercase tracking-widest text-xs">Buscando equipos que requieren carga...</p>
            </div>
        );
    }

    if (alertas.length === 0) {
        return (
            <div className="bg-emerald-50 rounded-[2.5rem] border border-emerald-100 p-12 flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center shadow-inner">
                    <CheckCircle2 size={32} />
                </div>
                <div>
                    <h3 className="text-xl font-black text-emerald-900">Todo al día</h3>
                    <p className="text-emerald-700/70 font-medium">No hay baterías pendientes de carga en este momento.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between px-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Mantenimiento de Baterías</h2>
                    <p className="text-slate-500 font-medium text-sm">Equipos que requieren carga cíclica (cada 30 días)</p>
                </div>
                <div className="bg-amber-100 text-amber-700 font-black px-4 py-2 rounded-2xl text-xs uppercase tracking-widest shadow-sm">
                    {alertas.length} Pendientes
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {alertas.map((acc) => (
                    <div key={acc.id_accesorio} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all overflow-hidden group">
                        <div className="p-6 space-y-4">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                                            <Zap size={16} />
                                        </div>
                                        <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">Batería</span>
                                    </div>
                                    <h4 className="text-lg font-black text-slate-900 leading-tight">{acc.modelo}</h4>
                                    <p className="text-xs font-mono text-slate-400">{acc.serial}</p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <div className="bg-rose-50 text-rose-600 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                                        <AlertTriangle size={10} /> Urgente
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="flex items-center gap-3 text-slate-600 bg-slate-50 p-3 rounded-2xl">
                                    <MapPin size={16} className="text-slate-400" />
                                    <div className="text-xs font-bold leading-none">
                                        <p className="text-slate-400 font-black text-[9px] uppercase mb-1">Ubicación</p>
                                        {acc.rel_ubicacion?.nombre_ubicacion} - {acc.rel_sub_ubicacion?.nombre}
                                        {acc.rack && <span className="ml-1 text-indigo-600">({acc.rack})</span>}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 text-slate-600 bg-slate-50 p-3 rounded-2xl">
                                    <Calendar size={16} className="text-slate-400" />
                                    <div className="text-xs font-bold leading-none">
                                        <p className="text-slate-400 font-black text-[9px] uppercase mb-1">Última Carga</p>
                                        {acc.fecha_ultima_carga
                                            ? format(new Date(acc.fecha_ultima_carga), "d 'de' MMMM", { locale: es })
                                            : 'Nunca registrada'}
                                    </div>
                                </div>
                            </div>

                            <Button
                                onClick={() => handleRegisterCharge(acc.id_accesorio)}
                                disabled={registering === acc.id_accesorio}
                                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                            >
                                {registering === acc.id_accesorio ? (
                                    <Loader2 className="animate-spin" size={16} />
                                ) : (
                                    <History size={16} />
                                )}
                                Registrar Carga Realizada
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
