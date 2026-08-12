import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import TooltipInfo from '@/components/ui/TooltipInfo';

interface EgresosDashboardProps {
    data: any;
    moneda: string;
}

export default function EgresosDashboard({ data, moneda }: EgresosDashboardProps) {
    if (!data) return null;

    const { lectura_ejecutiva, indicadores_clave, cumplimiento_distribuidores, pagos_usd, pagos_mxn } = data;

    const formatCurrency = (val: number, cur: string = 'MXN') => {
        if (val === 0) return '-';
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: cur,
            maximumFractionDigits: 2
        }).format(val);
    };

    const getEstatusBadge = (estatus: string) => {
        switch (estatus) {
            case 'CRÍTICO':
                return 'bg-red-50 text-red-700 border-red-200 font-bold';
            case 'ATENCIÓN':
                return 'bg-amber-50 text-amber-800 border-amber-200 font-bold';
            case 'EN META':
                return 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold';
            default:
                return 'bg-slate-50 text-slate-700 border-slate-200';
        }
    };

    return (
        <div className="space-y-6">
            
            {/* 1. Resumen Ejecutivo & Indicadores Clave en Fila Compacta */}
            <Card className="shadow-sm border-slate-100 bg-white rounded-2xl overflow-hidden">
                <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-3.5 px-5 flex flex-row items-center justify-between shrink-0">
                    <CardTitle className="text-sm font-semibold text-slate-800 flex items-center justify-between w-full">
                        <span>Resumen Ejecutivo | Cumplimiento SMP & Pago a Terceros</span>
                        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                            {indicadores_clave.ejecutados} / {indicadores_clave.aplicables} ejecutados
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                    {/* Lectura Ejecutiva */}
                    <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 leading-relaxed font-medium">
                        <span className="font-bold text-slate-900 uppercase tracking-wider block mb-1">Lectura Ejecutiva:</span>
                        {lectura_ejecutiva}
                    </div>

                    {/* KPIs Principales en 3 Tarjetas Claras */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
                        <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                            <div className="flex items-center justify-center gap-1">
                                <p className="text-xs font-semibold text-slate-500 uppercase">Consolidado General</p>
                                <TooltipInfo text="Porcentaje general de cumplimiento de mantenimientos SMP." formula="(SMP Ejecutados ÷ SMP Programados [Aplica = SI]) × 100" />
                            </div>
                            <p className="text-2xl font-bold text-slate-900 mt-1">{indicadores_clave.consolidado}%</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">{indicadores_clave.ejecutados.toLocaleString('es-MX')} de {indicadores_clave.aplicables.toLocaleString('es-MX')} ejecutados</p>
                        </div>
                        <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                            <div className="flex items-center justify-center gap-1">
                                <p className="text-xs font-semibold text-slate-500 uppercase">Equipo PS (Renta)</p>
                                <TooltipInfo text="Cumplimiento en mantenimientos de la flotilla de renta propia." formula="(SMP Ejecutados en Renta ÷ SMP Programados en Renta) × 100" />
                            </div>
                            <p className="text-2xl font-bold text-emerald-600 mt-1">{indicadores_clave.equipo_ps}%</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">Montacargas de Renta</p>
                        </div>
                        <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                            <div className="flex items-center justify-center gap-1">
                                <p className="text-xs font-semibold text-slate-500 uppercase">Equipo CS (Cliente)</p>
                                <TooltipInfo text="Cumplimiento en mantenimientos de equipos propiedad del cliente." formula="(SMP Ejecutados Cliente ÷ SMP Programados Cliente) × 100" />
                            </div>
                            <p className="text-2xl font-bold text-amber-600 mt-1">{indicadores_clave.equipo_cs}%</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">Equipos de Cliente</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 2. Tabla Cumplimiento SMP por Distribuidor & Ranking Visual */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                
                {/* Tabla Cumplimiento SMP */}
                <Card className="shadow-sm border-slate-100 bg-white rounded-2xl overflow-hidden">
                    <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-3.5 px-5">
                        <CardTitle className="text-sm font-semibold text-slate-800 flex items-center justify-between">
                            <span>Cumplimiento SMP por Distribuidor Tercero</span>
                            <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">{cumplimiento_distribuidores.length} distribuidores</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table className="w-full text-xs">
                            <TableHeader className="bg-slate-50/50 border-b border-slate-100">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="py-2.5 px-4 font-semibold text-slate-400 uppercase text-[11px] tracking-wider">Distribuidor</TableHead>
                                    <TableHead className="py-2.5 px-3 text-right font-semibold text-slate-400 uppercase text-[11px] tracking-wider">Aplica SMP</TableHead>
                                    <TableHead className="py-2.5 px-3 text-right font-semibold text-slate-400 uppercase text-[11px] tracking-wider">Ejecutados</TableHead>
                                    <TableHead className="py-2.5 px-3 text-right font-semibold text-slate-400 uppercase text-[11px] tracking-wider">Brecha</TableHead>
                                    <TableHead className="py-2.5 px-3 text-right font-semibold text-slate-400 uppercase text-[11px] tracking-wider">% Cumpl.</TableHead>
                                    <TableHead className="py-2.5 px-4 text-center font-semibold text-slate-400 uppercase text-[11px] tracking-wider">Estatus</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {cumplimiento_distribuidores.map((row: any, idx: number) => (
                                    <TableRow key={idx} className="hover:bg-slate-50/70 transition-colors border-b border-slate-100/60">
                                        <TableCell className="py-2.5 px-4 font-medium text-slate-700">{row.distribuidor}</TableCell>
                                        <TableCell className="py-2.5 px-3 text-right font-normal text-slate-500 tabular-nums">{row.aplica_smp}</TableCell>
                                        <TableCell className="py-2.5 px-3 text-right font-bold text-emerald-600 tabular-nums">{row.ejecutados}</TableCell>
                                        <TableCell className="py-2.5 px-3 text-right font-bold text-red-500 tabular-nums">{row.brecha}</TableCell>
                                        <TableCell className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums">{row.cumplimiento.toFixed(1)}%</TableCell>
                                        <TableCell className="py-2.5 px-4 text-center">
                                            <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] uppercase border", getEstatusBadge(row.estatus))}>
                                                {row.estatus}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Ranking Visual de Cumplimiento */}
                <Card className="shadow-sm border-slate-100 bg-white rounded-2xl overflow-hidden">
                    <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-3.5 px-5">
                        <CardTitle className="text-sm font-semibold text-slate-800">
                            Ranking Visual: % Cumplimiento SMP por Distribuidor
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 space-y-3">
                        {cumplimiento_distribuidores.map((row: any, idx: number) => (
                            <div key={idx} className="space-y-1">
                                <div className="flex justify-between text-xs font-medium text-slate-700">
                                    <span>{row.distribuidor}</span>
                                    <span className="font-bold tabular-nums">{row.cumplimiento.toFixed(1)}%</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                    <div 
                                        className={cn(
                                            "h-full rounded-full transition-all duration-700",
                                            row.cumplimiento >= 95 ? "bg-emerald-500" :
                                            row.cumplimiento >= 90 ? "bg-amber-500" : "bg-red-500"
                                        )}
                                        style={{ width: `${Math.min(row.cumplimiento, 100)}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

            </div>

            {/* 3. Pagos en USD y MXN por Distribuidor y Servicio */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                
                {/* Pagos en USD */}
                <Card className="shadow-sm border-slate-100 bg-white rounded-2xl overflow-hidden">
                    <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-3.5 px-5 flex flex-row items-center justify-between">
                        <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            PAGOS EN USD POR DISTRIBUIDOR Y SERVICIO
                        </CardTitle>
                        <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">USD</span>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table className="w-full text-xs">
                            <TableHeader className="bg-slate-50/50 border-b border-slate-100">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="py-2.5 px-4 font-semibold text-slate-400 uppercase text-[11px] tracking-wider">Distribuidor</TableHead>
                                    <TableHead className="py-2.5 px-3 text-right font-semibold text-slate-400 uppercase text-[11px] tracking-wider">Preventivos</TableHead>
                                    <TableHead className="py-2.5 px-3 text-right font-semibold text-slate-400 uppercase text-[11px] tracking-wider">Renta Terceros</TableHead>
                                    <TableHead className="py-2.5 px-3 text-right font-semibold text-slate-400 uppercase text-[11px] tracking-wider">Total USD</TableHead>
                                    <TableHead className="py-2.5 px-4 text-right font-semibold text-slate-400 uppercase text-[11px] tracking-wider">% Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pagos_usd.map((row: any, idx: number) => (
                                    <TableRow key={idx} className="hover:bg-slate-50/70 transition-colors border-b border-slate-100/60">
                                        <TableCell className="py-2.5 px-4 font-medium text-slate-700">{row.distribuidor}</TableCell>
                                        <TableCell className="py-2.5 px-3 text-right font-normal text-slate-500 tabular-nums">{formatCurrency(row.preventivos, 'USD')}</TableCell>
                                        <TableCell className="py-2.5 px-3 text-right font-normal text-slate-500 tabular-nums">{formatCurrency(row.renta_terceros, 'USD')}</TableCell>
                                        <TableCell className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums">{formatCurrency(row.total, 'USD')}</TableCell>
                                        <TableCell className="py-2.5 px-4 text-right font-semibold text-slate-600 tabular-nums">{row.porcentaje}%</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Pagos en MXN */}
                <Card className="shadow-sm border-slate-100 bg-white rounded-2xl overflow-hidden">
                    <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-3.5 px-5 flex flex-row items-center justify-between">
                        <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            PAGOS EN MXN POR DISTRIBUIDOR Y SERVICIO
                        </CardTitle>
                        <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">MXN</span>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table className="w-full text-xs">
                            <TableHeader className="bg-slate-50/50 border-b border-slate-100">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="py-2.5 px-4 font-semibold text-slate-400 uppercase text-[11px] tracking-wider">Distribuidor</TableHead>
                                    <TableHead className="py-2.5 px-3 text-right font-semibold text-slate-400 uppercase text-[11px] tracking-wider">Preventivos</TableHead>
                                    <TableHead className="py-2.5 px-3 text-right font-semibold text-slate-400 uppercase text-[11px] tracking-wider">Renta Terceros</TableHead>
                                    <TableHead className="py-2.5 px-3 text-right font-semibold text-slate-400 uppercase text-[11px] tracking-wider">Total MXN</TableHead>
                                    <TableHead className="py-2.5 px-4 text-right font-semibold text-slate-400 uppercase text-[11px] tracking-wider">% Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pagos_mxn.map((row: any, idx: number) => (
                                    <TableRow key={idx} className="hover:bg-slate-50/70 transition-colors border-b border-slate-100/60">
                                        <TableCell className="py-2.5 px-4 font-medium text-slate-700">{row.distribuidor}</TableCell>
                                        <TableCell className="py-2.5 px-3 text-right font-normal text-slate-500 tabular-nums">{formatCurrency(row.preventivos, 'MXN')}</TableCell>
                                        <TableCell className="py-2.5 px-3 text-right font-normal text-slate-500 tabular-nums">{formatCurrency(row.renta_terceros, 'MXN')}</TableCell>
                                        <TableCell className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums">{formatCurrency(row.total, 'MXN')}</TableCell>
                                        <TableCell className="py-2.5 px-4 text-right font-semibold text-slate-600 tabular-nums">{row.porcentaje}%</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

            </div>

        </div>
    );
}
