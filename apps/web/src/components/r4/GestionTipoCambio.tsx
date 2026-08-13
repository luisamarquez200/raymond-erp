'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DollarSign, History, Edit, Plus, CheckCircle2, XCircle, Calendar, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useConfigStore } from '@/store/config.store';
import TooltipInfo from '@/components/ui/TooltipInfo';
import { toast } from 'sonner';
import api from '@/lib/api';

interface TipoCambioItem {
    id: string;
    year: number;
    month: number;
    tipo_cambio: number;
    activo: boolean;
    usuario_nombre?: string;
    updated_at: string;
}

interface HistorialItem {
    id: string;
    year: number;
    month: number;
    valor_anterior: number | null;
    valor_nuevo: number;
    usuario_nombre: string;
    motivo: string;
    fecha: string;
}

const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function GestionTipoCambio() {
    const { user } = useAuthStore();
    const { roleColors } = useConfigStore();
    const primaryColor = user?.role ? (roleColors[user.role.toLowerCase()] || roleColors.administrador) : '#E5222D';

    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [rates, setRates] = useState<TipoCambioItem[]>([]);
    const [historial, setHistorial] = useState<HistorialItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    // Modal state for Edit / Create
    const [showEditModal, setShowEditModal] = useState<boolean>(false);
    const [editingItem, setEditingItem] = useState<{
        year: number;
        month: number;
        tipo_cambio: string;
        activo: boolean;
        motivo: string;
    }>({
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        tipo_cambio: '18.00',
        activo: true,
        motivo: ''
    });

    // Modal state for History Audit Log
    const [showHistorialModal, setShowHistorialModal] = useState<boolean>(false);

    const fetchRates = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/r4/tipo-cambio?year=${selectedYear}`);
            const data = res.data?.data || res.data || [];
            setRates(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching exchange rates:', error);
            toast.error('Error al cargar tipos de cambio');
        } finally {
            setLoading(false);
        }
    };

    const fetchHistorial = async () => {
        try {
            const res = await api.get(`/r4/tipo-cambio/historial?year=${selectedYear}`);
            const data = res.data?.data || res.data || [];
            setHistorial(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching exchange rate history:', error);
        }
    };

    useEffect(() => {
        fetchRates();
        fetchHistorial();
    }, [selectedYear]);

    const handleSaveRate = async (e: React.FormEvent) => {
        e.preventDefault();
        const numRate = parseFloat(editingItem.tipo_cambio);

        if (isNaN(numRate) || numRate <= 0) {
            toast.error('Ingrese un tipo de cambio válido mayor a 0');
            return;
        }

        try {
            await api.post('/r4/tipo-cambio', {
                year: editingItem.year,
                month: editingItem.month,
                tipo_cambio: numRate,
                activo: editingItem.activo,
                motivo: editingItem.motivo || 'Modificación manual desde configuración',
                usuario_nombre: (user as any)?.nombre || user?.email || 'Administrador'
            });

            toast.success(`Tipo de cambio guardado para ${MONTH_NAMES[editingItem.month - 1]} ${editingItem.year}`);
            setShowEditModal(false);
            fetchRates();
            fetchHistorial();
        } catch (error) {
            console.error('Error saving exchange rate:', error);
            toast.error('Error en el servidor al guardar el tipo de cambio');
        }
    };

    const openCreateForMonth = (monthIndex: number) => {
        const existing = rates.find(r => r.month === monthIndex + 1 && r.year === selectedYear);
        setEditingItem({
            year: selectedYear,
            month: monthIndex + 1,
            tipo_cambio: existing ? existing.tipo_cambio.toString() : '18.00',
            activo: existing ? existing.activo : true,
            motivo: ''
        });
        setShowEditModal(true);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(val);
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('es-MX', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Top Bar with Year Selector and Actions */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
                        <DollarSign className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            Tipo de Cambio Mensual (MXN / USD)
                            <TooltipInfo text="Parametrización oficial por periodo para conversiones entre MXN y USD en Presupuestos, Rentas y Flotilla." />
                        </h2>
                        <p className="text-xs font-medium text-slate-500">
                            Administra y audita la tasa de conversión por cada mes del año.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-600">Año:</span>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="bg-transparent text-sm font-black text-slate-900 focus:outline-none cursor-pointer"
                        >
                            {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={() => setShowHistorialModal(true)}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all"
                    >
                        <History className="w-4 h-4" />
                        Histórico ({historial.length})
                    </button>

                    <button
                        onClick={fetchRates}
                        className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl transition-all"
                        title="Actualizar tabla"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Monthly Rates Grid Table */}
            <Card className="shadow-sm border-slate-100 overflow-hidden bg-white rounded-3xl">
                <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-4 px-6 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                        Periodos de {selectedYear}
                    </CardTitle>
                    <span className="text-xs font-medium text-slate-500">
                        12 Meses Registrados
                    </span>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-50/50 text-slate-400 font-semibold uppercase text-[11px] tracking-wider border-b border-slate-100">
                                    <th className="p-4">Mes</th>
                                    <th className="p-4">Tipo de Cambio</th>
                                    <th className="p-4">Estado</th>
                                    <th className="p-4">Última Modificación</th>
                                    <th className="p-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                {MONTH_NAMES.map((monthName, idx) => {
                                    const monthNum = idx + 1;
                                    const rateItem = rates.find(r => r.month === monthNum);

                                    return (
                                        <tr key={monthNum} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="p-4 font-bold text-slate-900">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold flex items-center justify-center">
                                                        {monthNum}
                                                    </span>
                                                    {monthName} {selectedYear}
                                                </div>
                                            </td>
                                            <td className="p-4 font-bold text-slate-900 tabular-nums text-sm">
                                                {rateItem ? (
                                                    <span className="text-slate-900 bg-slate-100 px-3 py-1 rounded-xl">
                                                        {formatCurrency(rateItem.tipo_cambio)}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 font-normal italic">Sin configurar (Usa 18.00)</span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                {rateItem ? (
                                                    rateItem.activo ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                                                            <CheckCircle2 className="w-3.5 h-3.5" /> Activo
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500">
                                                            <XCircle className="w-3.5 h-3.5" /> Inactivo
                                                        </span>
                                                    )
                                                ) : (
                                                    <span className="text-slate-400 font-normal">-</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-slate-500 text-xs">
                                                {rateItem ? (
                                                    <div>
                                                        <p className="font-semibold text-slate-700">{rateItem.usuario_nombre || 'Sistema'}</p>
                                                        <p className="text-[11px] text-slate-400">{formatDate(rateItem.updated_at)}</p>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 font-normal">-</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => openCreateForMonth(idx)}
                                                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-all shadow-sm flex items-center gap-1.5 ml-auto"
                                                >
                                                    <Edit className="w-3.5 h-3.5" />
                                                    {rateItem ? 'Editar' : 'Registrar'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Modal Edit / Register Exchange Rate */}
            {showEditModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">
                                    Configurar Tipo de Cambio
                                </h3>
                                <p className="text-xs font-medium text-slate-500">
                                    {MONTH_NAMES[editingItem.month - 1]} {editingItem.year}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveRate} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Tipo de Cambio (MXN / USD) *
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3 text-slate-400 font-bold">$</span>
                                    <input
                                        type="number"
                                        step="0.0001"
                                        min="0.01"
                                        value={editingItem.tipo_cambio}
                                        onChange={(e) => setEditingItem({ ...editingItem, tipo_cambio: e.target.value })}
                                        placeholder="Ej. 18.35"
                                        required
                                        className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-red-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Estado
                                </label>
                                <select
                                    value={editingItem.activo ? 'true' : 'false'}
                                    onChange={(e) => setEditingItem({ ...editingItem, activo: e.target.value === 'true' })}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-red-500"
                                >
                                    <option value="true">Activo</option>
                                    <option value="false">Inactivo</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Motivo del cambio / Notas (Trazabilidad)
                                </label>
                                <textarea
                                    value={editingItem.motivo}
                                    onChange={(e) => setEditingItem({ ...editingItem, motivo: e.target.value })}
                                    placeholder="Ej. Ajuste según valor oficial DOF de inicio de mes"
                                    rows={3}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-red-500"
                                />
                            </div>

                            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-red-200"
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Audit History Trail */}
            {showHistorialModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <History className="w-5 h-5 text-slate-600" />
                                    Bitácora de Trazabilidad e Histórico ({selectedYear})
                                </h3>
                                <p className="text-xs font-medium text-slate-500">
                                    Registro inalterable de modificaciones de tipo de cambio por periodo.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowHistorialModal(false)}
                                className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 max-h-[450px] overflow-auto">
                            {historial.length === 0 ? (
                                <p className="text-center text-slate-400 text-xs py-8">
                                    No hay cambios registrados en el historial para {selectedYear}.
                                </p>
                            ) : (
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-slate-50 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-100">
                                            <th className="p-3">Periodo</th>
                                            <th className="p-3">Valor Anterior</th>
                                            <th className="p-3">Nuevo Valor</th>
                                            <th className="p-3">Usuario</th>
                                            <th className="p-3">Fecha / Hora</th>
                                            <th className="p-3">Motivo</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                        {historial.map((item) => (
                                            <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                                                    {MONTH_NAMES[item.month - 1]} {item.year}
                                                </td>
                                                <td className="p-3 text-slate-500 tabular-nums">
                                                    {item.valor_anterior ? formatCurrency(item.valor_anterior) : '-'}
                                                </td>
                                                <td className="p-3 font-bold text-emerald-600 tabular-nums">
                                                    {formatCurrency(item.valor_nuevo)}
                                                </td>
                                                <td className="p-3 font-medium text-slate-800">
                                                    {item.usuario_nombre || 'Sistema'}
                                                </td>
                                                <td className="p-3 text-slate-400 text-[11px] whitespace-nowrap">
                                                    {formatDate(item.fecha)}
                                                </td>
                                                <td className="p-3 text-slate-600 text-xs italic">
                                                    {item.motivo || 'Modificación de parámetro'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
