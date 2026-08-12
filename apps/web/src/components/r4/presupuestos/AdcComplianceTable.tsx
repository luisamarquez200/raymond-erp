import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import TooltipInfo from '@/components/ui/TooltipInfo';

interface AdcComplianceItem {
    adc: string;
    cliente?: string;
    moneda?: string;
    presupuesto?: number;
    budget?: number;
    enviado?: number;
    sentPOs?: number;
    cumplimiento: number;
}

interface AdcComplianceTableProps {
    data: AdcComplianceItem[];
    moneda?: string;
}

export default function AdcComplianceTable({ data, moneda = 'MXN' }: AdcComplianceTableProps) {
    const adcMap = new Map<string, { adc: string; cuentas: number; presupuesto: number; enviado: number; totalCumplimiento: number; cumplimientoCount: number; cumplimiento: number }>();

    (data || []).forEach((row) => {
        const adcName = row.adc || 'Sin ADC';
        const budget = Number(row.presupuesto || row.budget || 0);
        const sent = Number(row.enviado || row.sentPOs || 0);
        const cum = Number(row.cumplimiento || 0);

        if (!adcMap.has(adcName)) {
            adcMap.set(adcName, {
                adc: adcName,
                cuentas: 0,
                presupuesto: 0,
                enviado: 0,
                totalCumplimiento: 0,
                cumplimientoCount: 0,
                cumplimiento: 0
            });
        }

        const entry = adcMap.get(adcName)!;
        entry.cuentas += 1;
        entry.presupuesto += budget;
        entry.enviado += sent;
        if (cum > 0) {
            entry.totalCumplimiento += cum;
            entry.cumplimientoCount += 1;
        }
    });

    const sortedData = Array.from(adcMap.values())
        .map((entry) => {
            let cumplimiento = 0;
            if (entry.presupuesto > 0) {
                cumplimiento = (entry.enviado / entry.presupuesto) * 100;
            } else if (entry.cumplimientoCount > 0) {
                cumplimiento = entry.totalCumplimiento / entry.cumplimientoCount;
            }
            return { ...entry, cumplimiento };
        })
        .sort((a, b) => b.cumplimiento - a.cumplimiento);

    const formatPercent = (val: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'percent', maximumFractionDigits: 1 }).format(val / 100);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-MX', { 
            style: 'currency', 
            currency: moneda || 'MXN', 
            maximumFractionDigits: val >= 10000 ? 0 : 2 
        }).format(val);
    };

    return (
        <Card className="shadow-sm border-slate-100 overflow-hidden flex flex-col h-[420px] bg-white rounded-2xl">
            <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-3.5 px-5 flex flex-row items-center justify-between shrink-0">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                    Cumplimiento por ADC
                    <TooltipInfo text="Muestra el cumplimiento presupuestal consolidado por Ejecutivo Comercial (ADC), sumando todas sus cuentas de clientes." />
                </CardTitle>
                <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    {sortedData.length} ADCs
                </span>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-auto w-full">
                    <Table className="w-full text-xs">
                        <TableHeader className="bg-slate-50/50 sticky top-0 z-10 border-b border-slate-100">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="py-2.5 px-4 font-semibold text-slate-400 uppercase text-[11px] tracking-wider whitespace-nowrap">Ejecutivo (ADC)</TableHead>
                                <TableHead className="py-2.5 px-4 text-center font-semibold text-slate-400 uppercase text-[11px] tracking-wider whitespace-nowrap">Cuentas</TableHead>
                                <TableHead className="py-2.5 px-4 text-right font-semibold text-slate-400 uppercase text-[11px] tracking-wider whitespace-nowrap">Presupuesto</TableHead>
                                <TableHead className="py-2.5 px-4 text-right font-semibold text-slate-400 uppercase text-[11px] tracking-wider whitespace-nowrap">Facturado</TableHead>
                                <TableHead className="py-2.5 px-4 text-right font-semibold text-slate-400 uppercase text-[11px] tracking-wider whitespace-nowrap min-w-[120px]">Cumplimiento</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-slate-400 py-12">
                                        No hay datos de cumplimiento para los filtros seleccionados
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sortedData.map((row, idx) => (
                                    <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100/60">
                                        <TableCell className="py-2.5 px-4 font-medium text-slate-700 whitespace-nowrap max-w-[150px] truncate" title={row.adc}>{row.adc}</TableCell>
                                        <TableCell className="py-2.5 px-4 text-center font-normal text-slate-500 whitespace-nowrap">
                                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[11px] font-medium">
                                                {row.cuentas} {row.cuentas === 1 ? 'cuenta' : 'cuentas'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="py-2.5 px-4 text-right font-normal text-slate-500 whitespace-nowrap tabular-nums">
                                            {formatCurrency(row.presupuesto)}
                                        </TableCell>
                                        <TableCell className="py-2.5 px-4 text-right font-medium text-slate-700 whitespace-nowrap tabular-nums">
                                            {formatCurrency(row.enviado)}
                                        </TableCell>
                                        <TableCell className="py-2.5 px-4 text-right whitespace-nowrap">
                                            <div className="flex items-center justify-end space-x-2">
                                                <span className={cn(
                                                    "font-bold text-xs min-w-[42px] text-right",
                                                    row.cumplimiento >= 100 ? "text-emerald-600" : 
                                                    row.cumplimiento >= 80 ? "text-amber-500" : "text-red-500"
                                                )}>
                                                    {formatPercent(row.cumplimiento)}
                                                </span>
                                                <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden hidden sm:block">
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
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
