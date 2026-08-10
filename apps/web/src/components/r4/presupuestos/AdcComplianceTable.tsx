import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface AdcCompliance {
    adc: string;
    cliente: string;
    moneda: string;
    cumplimiento: number;
}

import TooltipInfo from '@/components/ui/TooltipInfo';

export default function AdcComplianceTable({ data }: { data: AdcCompliance[] }) {
    const sortedData = [...data].sort((a, b) => b.cumplimiento - a.cumplimiento);

    const formatPercent = (val: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'percent', maximumFractionDigits: 1 }).format(val / 100);
    };

    return (
        <Card className="shadow-sm border-slate-100 overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100">
                <CardTitle className="text-lg font-bold text-slate-800 flex items-center">
                    Cumplimiento por ADC
                    <TooltipInfo text="Muestra el porcentaje de avance individual alcanzado por cada Ejecutivo Comercial (ADC) en su cartera de clientes." />
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="max-h-[400px] overflow-auto">
                    <Table>
                        <TableHeader className="bg-slate-50/50 sticky top-0">
                            <TableRow>
                                <TableHead className="font-semibold text-slate-600">ADC</TableHead>
                                <TableHead className="font-semibold text-slate-600">Cliente</TableHead>
                                <TableHead className="text-right font-semibold text-slate-600 w-1/3">Cumplimiento</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center text-slate-400 h-24">
                                        No hay datos de cumplimiento para los filtros seleccionados
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sortedData.map((row, idx) => (
                                    <TableRow key={idx} className="hover:bg-slate-50 transition-colors">
                                        <TableCell className="font-medium text-slate-700">{row.adc}</TableCell>
                                        <TableCell className="text-slate-600">{row.cliente}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end space-x-3">
                                                <span className={cn(
                                                    "font-bold",
                                                    row.cumplimiento >= 100 ? "text-emerald-600" : 
                                                    row.cumplimiento >= 80 ? "text-amber-500" : "text-red-500"
                                                )}>
                                                    {formatPercent(row.cumplimiento)}
                                                </span>
                                                <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden hidden sm:block">
                                                    <div 
                                                        className={cn(
                                                            "h-full rounded-full transition-all duration-1000",
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
