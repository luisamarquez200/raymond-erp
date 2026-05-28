'use client';

import { useState, useEffect } from 'react';
import renovadosService, { CreateRenovadoDto } from '@/services/taller-r1/renovados.service';
import { equipoUbicacionApi, EquipoUbicacion } from '@/services/taller-r1/equipo-ubicacion.service';
import { clientesApi } from '@/services/taller-r1/clientes.service';
import { adcApi } from '@/services/taller-r1/adc.service';
import { toast } from 'sonner';
import { X, Calendar, User, Search, Package, CheckCircle2, ChevronDown, Layout, Plus, Check } from 'lucide-react';
import { cn, getErrorMessage } from '@/lib/utils';
import { useTallerUsuarios } from '@/hooks/taller-r1/useTallerUsuarios';
import api from '@/lib/api-taller';
import { QrScannerButton } from '@/components/ui/qr-scanner-button';

interface Props {
    open: boolean;
    equipo?: any;
    onClose: () => void;
    onSuccess: () => void;
}

export const NuevaSolicitudModal = ({ open, equipo, onClose, onSuccess }: Props) => {
    const { data: usuarios = [] } = useTallerUsuarios();
    const [loading, setLoading] = useState(false);
    const [equipos, setEquipos] = useState<EquipoUbicacion[]>([]);
    const [clientes, setClientes] = useState<any[]>([]);
    const [adcs, setAdcs] = useState<any[]>([]);
    const [estaciones, setEstaciones] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    const [showQuickAddClient, setShowQuickAddClient] = useState(false);
    const [showQuickAddAdc, setShowQuickAddAdc] = useState(false);
    const [quickAddValue, setQuickAddValue] = useState('');

    const [formData, setFormData] = useState<CreateRenovadoDto>({
        serial_equipo: '',
        fecha_target: undefined as any,
        cliente: '',
        adc: '',
        meses_fuera: '1-3',
        comentarios: ''
    });

    useEffect(() => {
        if (open) {
            loadData();
            if (equipo) {
                setFormData(prev => ({
                    ...prev,
                    serial_equipo: equipo.serial_equipo,
                    cliente: equipo.cliente || '',
                    adc: equipo.adc || ''
                }));
            }
        } else {
            // Reset form when closing
            setFormData({
                serial_equipo: '',
                fecha_target: undefined as any,
                cliente: '',
                adc: '',
                meses_fuera: '1-3',
                comentarios: ''
            });
            setSearchTerm('');
            setShowQuickAddClient(false);
            setShowQuickAddAdc(false);
            setQuickAddValue('');
        }
    }, [open, equipo]);

    const loadData = async () => {
        try {
            const [allEquipos, allClientes, allAdcs, allEstaciones] = await Promise.all([
                renovadosService.getPending(),
                clientesApi.getAll(),
                adcApi.getAll(),
                renovadosService.getEstaciones()
            ]);
            
            setEquipos(allEquipos || []);
            setClientes((allClientes || []).sort((a: any, b: any) => a.nombre_cliente?.localeCompare(b.nombre_cliente)));
            setAdcs((allAdcs || []).sort((a: any, b: any) => a.nombre?.localeCompare(b.nombre)));
            setEstaciones(allEstaciones || []);
        } catch (error) {
            toast.error(getErrorMessage(error, 'Error al cargar datos para la solicitud'));
        }
    };

    const handleSaveQuickAddClient = async () => {
        if (!quickAddValue.trim()) return;
        try {
            setLoading(true);
            const newClient = await api.post('/taller-r1/clientes', {
                nombre_cliente: quickAddValue.toUpperCase()
            });
            const clientData = newClient.data?.data || newClient.data;
            setClientes(prev => [...prev, clientData].sort((a, b) => a.nombre_cliente.localeCompare(b.nombre_cliente)));
            setFormData(prev => ({ ...prev, cliente: clientData.nombre_cliente }));
            toast.success('Cliente añadido');
            setShowQuickAddClient(false);
            setQuickAddValue('');
        } catch (error) {
            toast.error('Error al guardar cliente');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveQuickAddAdc = async () => {
        if (!quickAddValue.trim()) return;
        try {
            setLoading(true);
            const newAdc = await adcApi.create(quickAddValue.toUpperCase());
            setAdcs(prev => [...prev, newAdc]);
            setFormData(prev => ({ ...prev, adc: newAdc.nombre }));
            toast.success('ADC añadido');
            setShowQuickAddAdc(false);
            setQuickAddValue('');
        } catch (error) {
            toast.error('Error al guardar ADC');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.serial_equipo || !formData.fecha_target || !formData.meses_fuera) {
            toast.error('Por favor completa los campos obligatorios');
            return;
        }

        try {
            setLoading(true);
            await renovadosService.create(formData);
            toast.success('Solicitud de renovado creada correctamente');
            onSuccess();
            onClose();
            // Reset form
            setFormData({
                serial_equipo: '',
                fecha_target: undefined as any,
                cliente: '',
                adc: '',
                meses_fuera: '1-3',
                comentarios: ''
            });
        } catch (error: any) {
            toast.error(getErrorMessage(error, 'Error al crear la solicitud'));
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    const filteredEquipos = equipos.filter(e =>
        e.serial_equipo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.modelo?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] border border-slate-100 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50 rounded-t-[2.5rem]">
                    <div>
                        <span className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] block mb-1">RENOVADOS</span>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Nueva Solicitud</h2>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-white rounded-2xl transition-all text-slate-400 hover:text-red-500 shadow-sm border border-transparent hover:border-slate-100">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
                    {/* Selección de Equipo */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                            {equipo ? "Equipo Seleccionado" : "Equipo en Stock"} <span className="text-red-500">*</span>
                        </label>
                        
                        {!equipo ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <div className="relative group flex-1">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-red-500 transition-colors" />
                                        <input
                                            type="text"
                                            placeholder="Buscar por serie o modelo..."
                                            className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-red-500 transition-all outline-none font-bold"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <QrScannerButton onScan={(val) => setSearchTerm(val)} />
                                </div>
                                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                    {filteredEquipos.map((e) => (
                                        <button
                                            key={e.id_equipo_ubicacion}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, serial_equipo: e.serial_equipo || '' })}
                                            className={cn(
                                                "flex items-center justify-between p-4 rounded-2xl border transition-all text-left",
                                                formData.serial_equipo === e.serial_equipo
                                                    ? "bg-red-50 border-red-200 shadow-sm"
                                                    : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", formData.serial_equipo === e.serial_equipo ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-400")}>
                                                    <Package className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-900 text-sm">{e.serial_equipo}</p>
                                                    <p className="text-xs font-bold text-slate-400">{e.modelo} - {e.clase}</p>
                                                </div>
                                            </div>
                                            {formData.serial_equipo === e.serial_equipo && <CheckCircle2 className="w-5 h-5 text-red-600" />}
                                        </button>
                                    ))}
                                    {filteredEquipos.length === 0 && (
                                        <p className="text-center py-4 text-slate-400 font-bold text-xs uppercase italic">No se encontraron equipos en stock</p>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-between p-4 rounded-2xl border bg-slate-50 border-slate-200 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-100 text-red-600">
                                        <Package className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-black text-slate-900 text-sm">{equipo.serial_equipo}</p>
                                        <p className="text-xs font-bold text-slate-400">{equipo.modelo} - {equipo.clase}</p>
                                    </div>
                                </div>
                                <div className="px-3 py-1 bg-red-600 text-white rounded-lg text-[8px] font-black uppercase tracking-widest shadow-lg shadow-red-200">
                                    Pre-cargado
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Fecha Target */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Fecha Target <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
                                <input
                                    type="date"
                                    className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-red-500 transition-all outline-none font-bold min-h-[58px] cursor-pointer"
                                    value={formData.fecha_target instanceof Date 
                                        ? formData.fecha_target.toISOString().split('T')[0] 
                                        : (typeof formData.fecha_target === 'string' ? formData.fecha_target : '')}
                                    onChange={(e) => setFormData({ ...formData, fecha_target: e.target.value })}
                                    onClick={(e) => (e.target as any).showPicker?.()}
                                    onFocus={(e) => (e.target as any).showPicker?.()}
                                    required
                                />
                            </div>
                        </div>

                        {/* Meses Fuera */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Meses Fuera <span className="text-red-500">*</span></label>
                            <select
                                className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-red-500 transition-all outline-none font-bold appearance-none"
                                value={formData.meses_fuera}
                                onChange={(e) => setFormData({ ...formData, meses_fuera: e.target.value })}
                            >
                                <option value="1-3">1–3 meses</option>
                                <option value="4-6">4–6 meses</option>
                                <option value="6-12">6–12 meses</option>
                                <option value="12+">12+ meses</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Cliente */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-end mb-0.5 px-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</label>
                                <button
                                    type="button"
                                    onClick={() => setShowQuickAddClient(true)}
                                    className="text-[10px] font-black uppercase text-slate-400 hover:text-red-600 transition-all flex items-center gap-1"
                                    title="Agregar nuevo cliente"
                                >
                                    <Plus className="w-3 h-3" /> Añadir Nuevo
                                </button>
                            </div>
                            
                            {showQuickAddClient ? (
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Nuevo nombre de cliente"
                                        className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-red-500 transition-all outline-none font-bold"
                                        value={quickAddValue}
                                        onChange={(e) => setQuickAddValue(e.target.value)}
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={handleSaveQuickAddClient}
                                        className="px-4 py-4 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-100 transition-all shadow-sm flex items-center justify-center"
                                    >
                                        <Check className="w-5 h-5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowQuickAddClient(false)}
                                        className="px-4 py-4 bg-slate-100 text-slate-400 rounded-2xl hover:bg-slate-200 transition-all shadow-sm flex items-center justify-center"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            ) : (
                                <div className="relative appearance-none">
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                    <select
                                        className="w-full pl-4 pr-10 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-red-500 transition-all outline-none font-bold appearance-none"
                                        value={formData.cliente}
                                        onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                                    >
                                        <option value="">Seleccionar cliente...</option>
                                        {clientes.map(c => (
                                            <option key={c.id_cliente} value={c.nombre_cliente}>{c.nombre_cliente}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* ADC */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-end mb-0.5 px-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ADC</label>
                                <button
                                    type="button"
                                    onClick={() => setShowQuickAddAdc(true)}
                                    className="text-[10px] font-black uppercase text-slate-400 hover:text-red-600 transition-all flex items-center gap-1"
                                    title="Agregar nuevo ADC"
                                >
                                    <Plus className="w-3 h-3" /> Añadir Nuevo
                                </button>
                            </div>
                            
                            {showQuickAddAdc ? (
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Nuevo nombre de ADC"
                                        className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-red-500 transition-all outline-none font-bold"
                                        value={quickAddValue}
                                        onChange={(e) => setQuickAddValue(e.target.value)}
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={handleSaveQuickAddAdc}
                                        className="px-4 py-4 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-100 transition-all shadow-sm flex items-center justify-center"
                                    >
                                        <Check className="w-5 h-5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowQuickAddAdc(false)}
                                        className="px-4 py-4 bg-slate-100 text-slate-400 rounded-2xl hover:bg-slate-200 transition-all shadow-sm flex items-center justify-center"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            ) : (
                                <div className="relative appearance-none">
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                    <select
                                        className="w-full pl-4 pr-10 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-red-500 transition-all outline-none font-bold appearance-none"
                                        value={formData.adc}
                                        onChange={(e) => setFormData({ ...formData, adc: e.target.value })}
                                    >
                                        <option value="">Seleccionar ADC...</option>
                                        {adcs.map(a => (
                                            <option key={a.id} value={a.nombre}>{a.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        {/* Comentarios */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Comentarios</label>
                            <textarea
                                className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-red-500 transition-all outline-none font-bold resize-none min-h-[100px]"
                                placeholder="Escribe observaciones adicionales o requerimientos iniciales aquí..."
                                value={formData.comentarios}
                                onChange={(e) => setFormData({ ...formData, comentarios: e.target.value })}
                            />
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className="p-8 border-t border-slate-100 bg-slate-50/50 rounded-b-[2.5rem] flex items-center justify-end gap-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-8 py-4 text-slate-400 hover:text-slate-600 font-black text-xs uppercase tracking-widest transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !formData.serial_equipo}
                        className="flex items-center gap-3 px-10 py-4 bg-red-600 text-white rounded-[1.25rem] hover:bg-red-700 transition-all shadow-xl shadow-red-200 font-black text-xs uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>
                                Generar Orden
                                <CheckCircle2 className="w-5 h-5 transition-transform group-hover:scale-110" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
