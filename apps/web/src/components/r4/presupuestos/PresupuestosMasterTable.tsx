import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import TooltipInfo from '@/components/ui/TooltipInfo';
import { UserCheck } from 'lucide-react';

interface MasterRow {
    adc: string;
    cliente: string;
    moneda: string;
    presupuesto: number;
    enviado: number;
    cumplimiento: number;
    equipos_detenidos: number;
    pendiente_acumulado: number;
    total_facturar: number;
}

interface PresupuestosMasterTableProps {
    data: MasterRow[];
    moneda: string;
}

export default function PresupuestosMasterTable({ data = [], moneda = 'MXN' }: PresupuestosMasterTableProps) {
    const formatCurrency = (val: number) => {
        if (val === 0) return '-';
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: moneda || 'MXN',
            maximumFractionDigits: val >= 10000 ? 0 : 2
        }).format(val);
    };

    const formatPercent = (val: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'percent', maximumFractionDigits: 1 }).format(val / 100);
    };

    // Sort defensively: Group by ADC alphabetically, then by Total a Facturar descending
    const sortedData = [...(data || [])].sort((a, b) => {
        const adcCompare = (a.adc || '').localeCompare(b.adc || '', 'es', { sensitivity: 'base' });
        if (adcCompare !== 0) return adcCompare;
        return (b.total_facturar || 0) - (a.total_facturar || 0);
    });

    // Calculate totals for footer
    const totals = sortedData.reduce(
        (acc, row) => {
            acc.presupuesto += Number(row.presupuesto || 0);
            acc.enviado += Number(row.enviado || 0);
            acc.equipos_detenidos += Number(row.equipos_detenidos || 0);
            acc.pendiente_acumulado += Number(row.pendiente_acumulado || 0);
            acc.total_facturar += Number(row.total_facturar || 0);
            return acc;
        },
        { presupuesto: 0, enviado: 0, equipos_detenidos: 0, pendiente_acumulado: 0, total_facturar: 0 }
    );

    const totalCumplimiento = totals.presupuesto > 0 ? (totals.enviado / totals.presupuesto) * 100 : 0;

    return (
        <Card className="shadow-sm border-slate-100 overflow-hidden flex flex-col bg-white rounded-2xl w-full">
            <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-3.5 px-5 flex flex-row items-center justify-between shrink-0">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                    Resumen Consolidado por ADC y Cuentas
                    <TooltipInfo text="Muestra los ejecutivos (ADC) agrupados en orden con cada una de sus cuentas asignadas y su desglose presupuestal." />
                </CardTitle>
                <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    {sortedData.length} cuentas agrupadas
                </span>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
                <div className="overflow-x-auto w-full">
                    <Table className="w-full text-xs">
                        <TableHeader className="bg-slate-50/50 sticky top-0 z-10 border-b border-slate-100">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="py-2.5 px-4 font-semibold text-slate-400 uppercase text-[11px] tracking-wider whitespace-nowrap min-w-[150px]">
                                    ADC / Ejecutivo
                                </TableHead>
                                <TableHead className="py-2.5 px-4 font-semibold text-slate-400 uppercase text-[11px] tracking-wider whitespace-nowrap min-w-[160px]">
                                    Cliente / Cuenta
                                </TableHead>
                                <TableHead className="py-2.5 px-4 text-right font-semibold text-slate-400 uppercase text-[11px] tracking-wider whitespace-nowrap">
                                    Presupuesto
                                </TableHead>
                                <TableHead className="py-2.5 px-4 text-right font-semibold text-slate-400 uppercase text-[11px] tracking-wider whitespace-nowrap">
                                    Equipos Detenidos
                                </TableHead>
                                <TableHead className="py-2.5 px-4 text-right font-semibold text-slate-400 uppercase text-[11px] tracking-wider whitespace-nowrap">
                                    Pendiente Acumulado
                                </TableHead>
                                <TableHead className="py-2.5 px-4 text-right font-semibold text-slate-400 uppercase text-[11px] tracking-wider whitespace-nowrap">
                                    Total a Facturar
                                </TableHead>
                                <TableHead className="py-2.5 px-4 text-right font-semibold text-slate-400 uppercase text-[11px] tracking-wider whitespace-nowrap min-w-[130px]">
                                    % Cumplimiento
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-slate-400 py-12">
                                        No hay información disponible para este periodo
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sortedData.map((row, idx) => {
                                    const isNewAdcGroup = idx === 0 || sortedData[idx - 1].adc.trim().toLowerCase() !== row.adc.trim().toLowerCase();

                                    return (
                                        <TableRow 
                                            key={idx} 
                                            className={cn(
                                                "hover:bg-slate-50/70 transition-colors border-b border-slate-100/60",
                                                isNewAdcGroup && idx > 0 && "border-t-2 border-slate-200/80"
                                            )}
                                        >
                                            {/* ADC Column - Bold name displayed ONLY ONCE per group */}
                                            <TableCell className="py-2.5 px-4 whitespace-nowrap max-w-[160px] truncate" title={isNewAdcGroup ? row.adc : undefined}>
                                                {isNewAdcGroup ? (
                                                    <div className="flex items-center gap-1.5 font-bold text-slate-900">
                                                        <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                        <span>{row.adc}</span>
                                                    </div>
                                                ) : null}
                                            </TableCell>

                                            {/* Cliente */}
                                            <TableCell className="py-2.5 px-4 font-medium text-slate-800 whitespace-nowrap max-w-[180px] truncate" title={row.cliente}>
                                                {row.cliente}
                                            </TableCell>

                                            {/* Presupuesto */}
                                            <TableCell className="py-2.5 px-4 text-right font-normal text-slate-500 whitespace-nowrap tabular-nums">
                                                {formatCurrency(row.presupuesto)}
                                            </TableCell>

                                            {/* Equipos Detenidos */}
                                            <TableCell className="py-2.5 px-4 text-right font-normal text-slate-500 whitespace-nowrap tabular-nums">
                                                {row.equipos_detenidos ? Number(row.equipos_detenidos).toLocaleString('es-MX') : '0'}
                                            </TableCell>

                                            {/* Pendiente Acumulado */}
                                            <TableCell className="py-2.5 px-4 text-right font-normal text-slate-500 whitespace-nowrap tabular-nums">
                                                {formatCurrency(row.pendiente_acumulado)}
                                            </TableCell>

                                            {/* Total a Facturar */}
                                            <TableCell className="py-2.5 px-4 text-right font-bold text-amber-600 whitespace-nowrap tabular-nums">
                                                {formatCurrency(row.total_facturar)}
                                            </TableCell>

                                            {/* % Cumplimiento (At the End) */}
                                            <TableCell className="py-2.5 px-4 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end space-x-2">
                                                    <span className={cn(
                                                        "font-bold text-xs min-w-[42px] text-right",
                                                        row.cumplimiento >= 100 ? "text-emerald-600" : 
                                                        row.cumplimiento >= 80 ? "text-amber-500" : "text-red-500"
                                                    )}>
                                                        {formatPercent(row.cumplimiento)}
                                                    </span>
                                                    <div className="w-14 bg-slate-100 h-1.5 rounded-full overflow-hidden hidden sm:block">
                                                        <div 
                                                            className={cn(
                                                                "h-full rounded-full transition-all duration-700",
                                                                row.cumplimiento >= 100 ? "bg-emerald-500" : 
                                                                row.cumplimiento >= 80 ? "bg-amber-500" : "bg-red-500"
                                                            )}
                                                            style={{ width: `${Math.min(row.cumplimiento, 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                        
                        {/* Footer Total Row */}
                        {sortedData.length > 0 && (
                            <tfoot className="bg-slate-50/90 font-semibold text-slate-800 border-t-2 border-slate-200">
                                <tr>
                                    <TableCell colSpan={2} className="py-3 px-4 font-bold text-slate-900 uppercase text-xs">
                                        TOTAL GENERAL
                                    </TableCell>
                                    <TableCell className="py-3 px-4 text-right font-semibold text-slate-700 tabular-nums">
                                        {formatCurrency(totals.presupuesto)}
                                    </TableCell>
                                    <TableCell className="py-3 px-4 text-right font-semibold text-slate-700 tabular-nums">
                                        {totals.equipos_detenidos.toLocaleString('es-MX')}
                                    </TableCell>
                                    <TableCell className="py-3 px-4 text-right font-semibold text-slate-700 tabular-nums">
                                        {formatCurrency(totals.pendiente_acumulado)}
                                    </TableCell>
                                    <TableCell className="py-3 px-4 text-right font-bold text-amber-600 tabular-nums">
                                        {formatCurrency(totals.total_facturar)}
                                    </TableCell>
                                    <TableCell className="py-3 px-4 text-right whitespace-nowrap">
                                        <span className={cn(
                                            "font-bold text-xs",
                                            totalCumplimiento >= 100 ? "text-emerald-600" : 
                                            totalCumplimiento >= 80 ? "text-amber-500" : "text-red-500"
                                        )}>
                                            {formatPercent(totalCumplimiento)}
                                        </span>
                                    </TableCell>
                                </tr>
                            </tfoot>
                        )}
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
