'use client';

import { useState, useEffect } from 'react';
import { Users, Plus, ShieldCheck, Mail } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';
import { CrearUsuarioAdcModal } from '@/components/comercial-r4/adcs/CrearUsuarioAdcModal';

interface AdcEntry {
    name: string;
    status: 'Usuario Creado' | 'Sin Usuario';
}

export default function AdcsPage() {
    const { user } = useAuthStore();
    const isAdmin = user?.role?.toUpperCase() === 'ADMINISTRADOR' || user?.role?.toUpperCase() === 'SUPERADMIN';

    const [adcs, setAdcs] = useState<AdcEntry[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAdcName, setSelectedAdcName] = useState('');

    const fetchAdcs = async () => {
        try {
            setLoading(true);
            const res = await api.get('/r4/adcs');
            setAdcs(res.data?.data || []);
        } catch (error) {
            console.error('Error fetching ADCs:', error);
            toast.error('Error al cargar la lista de ADCs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAdmin) {
            fetchAdcs();
        } else {
            setLoading(false);
        }
    }, [isAdmin]);

    const handleOpenModal = (adcName: string) => {
        setSelectedAdcName(adcName);
        setIsModalOpen(true);
    };

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-[#F9FAFB] p-8 flex items-center justify-center">
                <div className="text-center bg-white p-12 rounded-3xl shadow-sm border border-slate-100 max-w-md">
                    <ShieldCheck className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-black text-slate-900 mb-2">Acceso Restringido</h2>
                    <p className="text-slate-500 font-medium">Solo los administradores pueden gestionar usuarios ADC.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F9FAFB] p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#E5222D]"></div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
                            <Users className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Gestión de Usuarios ADC</h1>
                            <p className="text-slate-500 font-medium mt-1">
                                Asigna correos y contraseñas a los Asesores Comerciales (ADC) detectados en el sistema.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-5 flex flex-col justify-between">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-2 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> USUARIOS CREADOS
                        </p>
                        <h3 className="text-4xl font-black text-emerald-900">
                            {adcs.filter(a => a.status === 'Usuario Creado').length}
                        </h3>
                    </div>
                    
                    <div className="bg-red-50/50 border border-red-100 rounded-2xl p-5 flex flex-col justify-between">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#E5222D] mb-2 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500"></span> PENDIENTES DE CREAR
                        </p>
                        <h3 className="text-4xl font-black text-red-900">
                            {adcs.filter(a => a.status === 'Sin Usuario').length}
                        </h3>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm animate-in fade-in duration-300">
                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-slate-100">
                                <th className="p-4">Nombre del ADC</th>
                                <th className="p-4 text-center">Estado del Usuario</th>
                                <th className="p-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={3} className="p-12 text-center text-slate-400">
                                        Cargando ADCs...
                                    </td>
                                </tr>
                            ) : adcs.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="p-12 text-center text-slate-400">
                                        No se encontraron ADCs en la base de datos (Flotilla/Rentas).
                                    </td>
                                </tr>
                            ) : (
                                adcs.map((adc, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600">
                                                    {adc.name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-bold text-slate-900">{adc.name}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-bold border ${
                                                adc.status === 'Usuario Creado' 
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                                    : 'bg-red-50 text-red-600 border-red-100'
                                            }`}>
                                                {adc.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            {adc.status === 'Sin Usuario' ? (
                                                <button
                                                    onClick={() => handleOpenModal(adc.name)}
                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#E5222D] hover:bg-[#CC1E28] text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-red-200"
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                    Asignar Usuario
                                                </button>
                                            ) : (
                                                <button
                                                    disabled
                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-400 rounded-xl font-bold text-xs cursor-not-allowed"
                                                >
                                                    <ShieldCheck className="w-3.5 h-3.5" />
                                                    Cuenta Activa
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <CrearUsuarioAdcModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                adcName={selectedAdcName}
                onSuccess={fetchAdcs}
            />
        </div>
    );
}
