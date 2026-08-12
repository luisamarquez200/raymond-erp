'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import TooltipInfo from '@/components/ui/TooltipInfo';
import { Pencil, Check, X, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface SummaryCardsProps {
    stats: {
        presupuesto_mes: number;
        acumulado: number;
        total_a_facturar: number;
        pedidos_enviados: number;
        facturado: number;
        faltante: number;
        cumplimiento_general: number;
        equipos_detenidos: number;
    };
    moneda: string;
    tipoCambio?: number;
    // Props for editable Facturado
    canEditFacturado?: boolean;      // true if role is Gerente/Administrador
    activeFilters?: { year: string; month: string[] };
    onFacturadoSaved?: () => void;   // triggers refetch on parent
}

export default function SummaryCards({ stats, moneda, tipoCambio, canEditFacturado, activeFilters, onFacturadoSaved }: SummaryCardsProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const formatCurrency = (val: number) => {
        if (val === 0) return '$0';
        return new Intl.NumberFormat('es-MX', { 
            style: 'currency', 
            currency: moneda || 'MXN', 
            maximumFractionDigits: val >= 10000 ? 0 : 2 
        }).format(val);
    };

    const formatPercent = (val: number) => {
        return `${Math.round(val)}%`;
    };

    const handleStartEdit = () => {
        setEditValue(stats.facturado > 0 ? stats.facturado.toString() : '');
        setIsEditing(true);
    };

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleCancel = () => {
        setIsEditing(false);
        setEditValue('');
    };

    const handleSave = async () => {
        if (!activeFilters) return;
        const monto = parseFloat(editValue.replace(/,/g, ''));
        if (isNaN(monto) || monto < 0) {
            toast.error('Por favor ingresa un monto válido.');
            return;
        }

        // If multiple months selected, save once per month proportionally? 
        // Per the plan: save global amount per month+moneda. If multiple months, save one per month.
        const months = activeFilters.month;
        if (months.length > 1) {
            toast.error(`Tienes ${months.length} meses seleccionados. Para editar "Facturado", selecciona un solo mes.`, { duration: 4000 });
            return;
        }

        const periodo = `${activeFilters.year}-${String(parseInt(months[0])).padStart(2, '0')}`;

        setIsSaving(true);
        try {
            await api.patch('/r4/presupuestos/facturado', {
                periodo,
                moneda: moneda.toUpperCase(),
                monto,
            });
            toast.success(`Facturado actualizado para ${periodo} (${moneda}): ${formatCurrency(monto)}`);
            setIsEditing(false);
            setEditValue('');
            onFacturadoSaved?.();
        } catch (err) {
            toast.error('Error al guardar el valor de facturado.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') handleCancel();
    };

    return (
        <div className="space-y-3 mb-6">
            {/* Top Bar with Exchange Rate Info */}
            {tipoCambio && (
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-2 text-xs">
                    <span className="font-semibold text-slate-600 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Tipo de Cambio Oficial del Periodo:
                    </span>
                    <span className="font-black text-slate-900 bg-white border border-slate-200 px-3 py-1 rounded-xl shadow-2xs tabular-nums text-xs">
                        $ {tipoCambio.toFixed(2)} MXN / USD
                    </span>
                </div>
            )}

            {/* Single Compact Row of 8 KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5">
                {/* 1. Presupuesto del Mes */}
                <Card className="shadow-sm border-slate-100 bg-white p-3 rounded-2xl">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate flex items-center justify-between">
                        Presupuesto Periodo
                        <TooltipInfo 
                            text="Meta de facturación estimada para el periodo." 
                            formula="∑ (Presupuesto asignado a cada Cliente / ADC en el periodo)"
                        />
                    </div>
                    <div className="text-sm font-bold text-slate-900 mt-1 tabular-nums truncate" title={formatCurrency(stats.presupuesto_mes)}>
                        {formatCurrency(stats.presupuesto_mes)}
                    </div>
                </Card>

                {/* 2. Acumulado */}
                <Card className="shadow-sm border-slate-100 bg-white p-3 rounded-2xl">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate flex items-center justify-between">
                        Acumulado
                        <TooltipInfo 
                            text="Saldo pendiente acumulado de meses anteriores." 
                            formula="∑ (Órdenes Mensuales no facturadas de meses previos)"
                        />
                    </div>
                    <div className="text-sm font-bold text-slate-900 mt-1 tabular-nums truncate" title={formatCurrency(stats.acumulado)}>
                        {formatCurrency(stats.acumulado)}
                    </div>
                </Card>

                {/* 3. Total a Facturar */}
                <Card className="shadow-sm border-amber-200/80 bg-amber-50/50 p-3 rounded-2xl">
                    <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider truncate flex items-center justify-between">
                        Total a Facturar
                        <TooltipInfo 
                            text="Importe total requerido a facturar en el periodo." 
                            formula="Presupuesto Mes + Pendiente Acumulado"
                        />
                    </div>
                    <div className="text-sm font-black text-amber-600 mt-1 tabular-nums truncate" title={formatCurrency(stats.total_a_facturar)}>
                        {formatCurrency(stats.total_a_facturar)}
                    </div>
                </Card>

                {/* 4. Pedidos Enviados */}
                <Card className="shadow-sm border-slate-100 bg-white p-3 rounded-2xl">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate flex items-center justify-between">
                        Pedidos Enviados
                        <TooltipInfo 
                            text="Monto de órdenes de compra colocadas en el mes." 
                            formula="∑ (Órdenes Mensuales recibidas con PO en el mes)"
                        />
                    </div>
                    <div className="text-sm font-bold text-slate-900 mt-1 tabular-nums truncate" title={formatCurrency(stats.pedidos_enviados)}>
                        {formatCurrency(stats.pedidos_enviados)}
                    </div>
                </Card>

                {/* 5. Facturado — EDITABLE for Gerente */}
                <Card className={cn(
                    "shadow-sm p-3 rounded-2xl transition-all duration-200",
                    canEditFacturado ? "border-emerald-200/80 bg-emerald-50/40 hover:border-emerald-400/60 cursor-pointer group" : "border-slate-100 bg-white"
                )}>
                    <div className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider truncate flex items-center justify-between">
                        Facturado
                        <div className="flex items-center gap-1">
                            <TooltipInfo 
                                text="Monto efectivamente facturado del periodo. Solo el Gerente puede modificar este valor." 
                                formula="Dato ingresado manualmente por el Gerente"
                            />
                            {canEditFacturado && !isEditing && (
                                <button
                                    onClick={handleStartEdit}
                                    className="ml-0.5 p-0.5 rounded-md text-emerald-500 hover:bg-emerald-100 transition-all"
                                    title="Editar Facturado"
                                >
                                    <Pencil className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    </div>

                    {isEditing ? (
                        <div className="mt-1 flex flex-col gap-1">
                            <input
                                ref={inputRef}
                                type="number"
                                min="0"
                                step="0.01"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="w-full text-xs font-bold border border-emerald-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white text-slate-900 tabular-nums"
                                placeholder="0.00"
                            />
                            <div className="flex gap-1 justify-end">
                                <button
                                    onClick={handleCancel}
                                    disabled={isSaving}
                                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="p-1 rounded-md text-white bg-emerald-500 hover:bg-emerald-600 transition-all"
                                >
                                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div 
                            className="text-sm font-bold text-emerald-700 mt-1 tabular-nums truncate" 
                            title={formatCurrency(stats.facturado)}
                            onClick={canEditFacturado ? handleStartEdit : undefined}
                        >
                            {formatCurrency(stats.facturado)}
                        </div>
                    )}
                </Card>

                {/* 6. Faltante */}
                <Card className="shadow-sm border-slate-100 bg-white p-3 rounded-2xl">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate flex items-center justify-between">
                        Faltante
                        <TooltipInfo 
                            text="Brecha pendiente para alcanzar la meta a facturar." 
                            formula="Total a Facturar - Pedidos Enviados"
                        />
                    </div>
                    <div className="text-sm font-bold text-red-500 mt-1 tabular-nums truncate" title={formatCurrency(stats.faltante)}>
                        {formatCurrency(stats.faltante)}
                    </div>
                </Card>

                {/* 7. Equipos Detenidos */}
                <Card className="shadow-sm border-slate-100 bg-white p-3 rounded-2xl">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate flex items-center justify-between">
                        Equipos Detenidos
                        <TooltipInfo 
                            text="Renta inactiva o fuera de operación por falla." 
                            formula="Count(Activos en Renta con Estatus = Detenido)"
                        />
                    </div>
                    <div className="text-sm font-bold text-slate-900 mt-1 tabular-nums truncate" title={stats.equipos_detenidos.toLocaleString('es-MX')}>
                        {stats.equipos_detenidos.toLocaleString('es-MX')}
                    </div>
                </Card>

                {/* 8. Cumplimiento General */}
                <Card className="shadow-sm border-slate-100 bg-white p-3 rounded-2xl flex flex-col justify-between">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate flex items-center justify-between">
                        Cumplimiento
                        <TooltipInfo 
                            text="Porcentaje general alcanzado respecto a la meta." 
                            formula="(Facturado ÷ Total a Facturar) × 100"
                        />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                        <span className={cn(
                            "text-sm font-bold tabular-nums",
                            stats.cumplimiento_general >= 100 ? "text-emerald-600" :
                            stats.cumplimiento_general >= 80 ? "text-amber-500" : "text-red-500"
                        )}>
                            {formatPercent(stats.cumplimiento_general)}
                        </span>
                        <div className="w-8 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div 
                                className={cn(
                                    "h-full rounded-full transition-all duration-700",
                                    stats.cumplimiento_general >= 100 ? "bg-emerald-500" :
                                    stats.cumplimiento_general >= 80 ? "bg-amber-500" : "bg-red-500"
                                )}
                                style={{ width: `${Math.min(stats.cumplimiento_general, 100)}%` }}
                            />
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
