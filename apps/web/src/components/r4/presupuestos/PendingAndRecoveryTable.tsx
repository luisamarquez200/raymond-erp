import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import TooltipInfo from '@/components/ui/TooltipInfo';

interface PendingAndRecoveryTableProps {
    pendienteData?: any[];
    recuperacionData?: any[];
    moneda?: string;
}

export default function PendingAndRecoveryTable({ 
    pendienteData = [], 
    recuperacionData = [], 
    moneda = 'MXN' 
}: PendingAndRecoveryTableProps) {
    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-MX', { 
            style: 'currency', 
            currency: moneda || 'MXN', 
            maximumFractionDigits: val >= 10000 ? 0 : 2 
        }).format(val);
    };

    // Grouping by (adc, cliente) to show IMPORTE (pendiente) and RECIBIDO (recuperación)
    const combinedMap = new Map<string, { adc: string; cliente: string; importe: number; recibido: number }>();

    (pendienteData || []).forEach(row => {
        const adcName = row.adc || 'Sin ADC';
        const clientName = row.cliente || 'Sin Cliente';
        const key = `${adcName}___${clientName}`;

        if (!combinedMap.has(key)) {
            combinedMap.set(key, { adc: adcName, cliente: clientName, importe: 0, recibido: 0 });
        }
        combinedMap.get(key)!.importe += Number(row.pendiente || row.importe || 0);
    });

    (recuperacionData || []).forEach(row => {
        const adcName = row.adc || 'Sin ADC';
        const clientName = row.cliente || 'Sin Cliente';
        const key = `${adcName}___${clientName}`;

        if (!combinedMap.has(key)) {
            combinedMap.set(key, { adc: adcName, cliente: clientName, importe: 0, recibido: 0 });
        }
        combinedMap.get(key)!.recibido += Number(row.recibido || row.importe || 0);
    });

    const rows = Array.from(combinedMap.values()).sort((a, b) => b.importe - a.importe);

    return (
        <Card className="shadow-sm border-slate-100 overflow-hidden flex flex-col h-[420px] bg-white rounded-2xl">
            <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-3.5 px-5 flex flex-row items-center justify-between shrink-0">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                    Pendiente Acumulado y Recuperación
                    <TooltipInfo text="Detalle consolidado por ADC y cliente del saldo pendiente acumulado de periodos anteriores y el importe recuperado/recibido." />
                </CardTitle>
                <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    {rows.length} registros
                </span>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-auto w-full">
                    <Table className="w-full text-xs">
                        <TableHeader className="bg-slate-50/50 sticky top-0 z-10 border-b border-slate-100">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="py-2.5 px-4 font-semibold text-slate-400 uppercase text-[11px] tracking-wider whitespace-nowrap">ADC</TableHead>
                                <TableHead className="py-2.5 px-4 font-semibold text-slate-400 uppercase text-[11px] tracking-wider whitespace-nowrap">Cliente</TableHead>
                                <TableHead className="py-2.5 px-4 text-right font-semibold text-slate-400 uppercase text-[11px] tracking-wider whitespace-nowrap">Importe Pendiente</TableHead>
                                <TableHead className="py-2.5 px-4 text-right font-semibold text-slate-400 uppercase text-[11px] tracking-wider whitespace-nowrap">Recibido</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-slate-400 py-12">
                                        No hay acumulado pendiente ni recuperación registrada para este periodo
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((row, idx) => (
                                    <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100/60">
                                        <TableCell className="py-2.5 px-4 font-medium text-slate-700 whitespace-nowrap max-w-[130px] truncate" title={row.adc}>{row.adc}</TableCell>
                                        <TableCell className="py-2.5 px-4 font-normal text-slate-600 whitespace-nowrap max-w-[140px] truncate" title={row.cliente}>{row.cliente}</TableCell>
                                        <TableCell className="py-2.5 px-4 text-right font-medium text-amber-600 whitespace-nowrap tabular-nums">
                                            {formatCurrency(row.importe)}
                                        </TableCell>
                                        <TableCell className="py-2.5 px-4 text-right font-bold text-emerald-600 whitespace-nowrap tabular-nums">
                                            {formatCurrency(row.recibido)}
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
