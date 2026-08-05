import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowUpRight, DollarSign, TrendingUp, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
}

export default function SummaryCards({ stats, moneda }: SummaryCardsProps) {
    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda }).format(val);
    };

    const formatPercent = (val: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'percent', maximumFractionDigits: 1 }).format(val / 100);
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Presupuesto del Mes */}
            <Card className="hover:shadow-lg transition-all duration-300 border-slate-100 group">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium text-slate-500">Presupuesto del Mes</CardTitle>
                    <DollarSign className="w-4 h-4 text-slate-400 group-hover:text-amber-500 transition-colors" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-slate-900">{formatCurrency(stats.presupuesto_mes)}</div>
                    <p className="text-xs text-slate-400 mt-1">Estimado para {moneda}</p>
                </CardContent>
            </Card>

            {/* Acumulado */}
            <Card className="hover:shadow-lg transition-all duration-300 border-slate-100 group">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium text-slate-500">Pendiente Acumulado</CardTitle>
                    <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-amber-500 transition-colors" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-slate-900">{formatCurrency(stats.acumulado)}</div>
                    <p className="text-xs text-slate-400 mt-1">De meses anteriores</p>
                </CardContent>
            </Card>

            {/* Total a Facturar */}
            <Card className="hover:shadow-lg transition-all duration-300 border-slate-100 bg-amber-50/50 group">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-bold text-amber-900">Total a Facturar</CardTitle>
                    <TrendingUp className="w-4 h-4 text-amber-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-black text-amber-600">{formatCurrency(stats.total_a_facturar)}</div>
                    <p className="text-xs text-amber-700/70 mt-1">Presupuesto + Acumulado</p>
                </CardContent>
            </Card>

            {/* Cumplimiento */}
            <Card className="hover:shadow-lg transition-all duration-300 border-slate-100 group">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium text-slate-500">Cumplimiento General</CardTitle>
                    <CheckCircle2 className={cn("w-4 h-4 transition-colors", stats.cumplimiento_general >= 100 ? "text-emerald-500" : "text-amber-500")} />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-slate-900">{formatPercent(stats.cumplimiento_general)}</div>
                    <div className="w-full bg-slate-100 h-1.5 mt-3 rounded-full overflow-hidden">
                        <div 
                            className={cn("h-full rounded-full transition-all duration-1000", stats.cumplimiento_general >= 100 ? "bg-emerald-500" : "bg-amber-500")}
                            style={{ width: `${Math.min(stats.cumplimiento_general, 100)}%` }}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Pedidos Enviados */}
            <Card className="hover:shadow-lg transition-all duration-300 border-slate-100 group">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium text-slate-500">Pedidos Enviados</CardTitle>
                    <FileText className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-slate-900">{formatCurrency(stats.pedidos_enviados)}</div>
                    <p className="text-xs text-slate-400 mt-1">Órdenes del mes</p>
                </CardContent>
            </Card>

            {/* Faltante */}
            <Card className="hover:shadow-lg transition-all duration-300 border-slate-100 group">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium text-slate-500">Faltante</CardTitle>
                    <AlertCircle className="w-4 h-4 text-slate-400 group-hover:text-red-500 transition-colors" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-red-500">{formatCurrency(stats.faltante)}</div>
                    <p className="text-xs text-slate-400 mt-1">Total a facturar - Pedidos enviados</p>
                </CardContent>
            </Card>

            {/* Equipos Detenidos */}
            <Card className="hover:shadow-lg transition-all duration-300 border-slate-100 group">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium text-slate-500">Equipos Detenidos</CardTitle>
                    <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200">Afectación</Badge>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-slate-900">{formatCurrency(stats.equipos_detenidos)}</div>
                    <p className="text-xs text-slate-400 mt-1">Presupuesto inactivo</p>
                </CardContent>
            </Card>
            
            {/* Facturado (Same as Pedidos Enviados for now, but shown for completion based on requirements) */}
            <Card className="hover:shadow-lg transition-all duration-300 border-slate-100 group">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium text-slate-500">Facturado</CardTitle>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">Enviado</Badge>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-slate-900">{formatCurrency(stats.facturado)}</div>
                    <p className="text-xs text-slate-400 mt-1">Correspondiente al periodo</p>
                </CardContent>
            </Card>
        </div>
    );
}
