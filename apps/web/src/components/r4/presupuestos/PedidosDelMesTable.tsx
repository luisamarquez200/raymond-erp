import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import TooltipInfo from '@/components/ui/TooltipInfo';

export default function PedidosDelMesTable({ data = [], title, moneda }: { data: any[], title: string, moneda: string }) {
    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-MX', { 
            style: 'currency', 
            currency: moneda || 'MXN', 
            maximumFractionDigits: val >= 10000 ? 0 : 2 
        }).format(val);
    };

    const tooltipText = title.includes('Recuperación')
        ? 'Monto recuperado de adeudos o saldos pendientes de periodos anteriores.'
        : 'Listado y monto total de órdenes enviadas y colocadas durante el periodo actual.';

    return (
        <Card className="shadow-sm border-slate-100 overflow-hidden flex flex-col h-[420px] bg-white rounded-2xl">
            <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-3.5 px-5 flex flex-row items-center justify-between shrink-0">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                    {title}
                    <TooltipInfo text={tooltipText} />
                </CardTitle>
                <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    {data.length} pedidos
                </span>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-auto w-full">
                    <Table className="w-full text-xs">
                        <TableHeader className="bg-slate-50/50 sticky top-0 z-10 border-b border-slate-100">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="py-2.5 px-4 font-semibold text-slate-400 uppercase text-[11px] tracking-wider whitespace-nowrap">Cliente</TableHead>
                                <TableHead className="py-2.5 px-4 font-semibold text-slate-400 uppercase text-[11px] tracking-wider whitespace-nowrap">PO / Orden</TableHead>
                                <TableHead className="py-2.5 px-4 font-semibold text-slate-400 uppercase text-[11px] tracking-wider whitespace-nowrap">Pedido TOTVS</TableHead>
                                <TableHead className="py-2.5 px-4 text-right font-semibold text-slate-400 uppercase text-[11px] tracking-wider whitespace-nowrap">Importe</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-slate-400 py-12">
                                        No hay pedidos registrados en este periodo
                                    </TableCell>
                                </TableRow>
                            ) : (
                                data.map((row, idx) => (
                                    <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100/60">
                                        <TableCell className="py-2.5 px-4 font-medium text-slate-700 whitespace-nowrap max-w-[160px] truncate" title={row.cliente}>{row.cliente}</TableCell>
                                        <TableCell className="py-2.5 px-4 text-slate-500 font-mono text-xs whitespace-nowrap">{row.po || '-'}</TableCell>
                                        <TableCell className="py-2.5 px-4 text-slate-600 font-mono text-xs whitespace-nowrap font-medium">{row.pedido_totvs || row.pedido_tovts || row.no_registro_totvs || row.po || '-'}</TableCell>
                                        <TableCell className="py-2.5 px-4 text-right font-medium text-slate-700 whitespace-nowrap tabular-nums">
                                            {formatCurrency(row.importe)}
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
