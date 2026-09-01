import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import TooltipInfo from '@/components/ui/TooltipInfo';
import { MapPin } from 'lucide-react';

export default function PedidosDelMesTable({ data = [], title, moneda }: { data: any[], title: string, moneda: string }) {
    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-MX', { 
            style: 'currency', 
            currency: moneda || 'MXN', 
            maximumFractionDigits: val >= 10000 ? 0 : 2 
        }).format(val);
    };

    const tooltipText = title.includes('Recuperación')
        ? 'Monto totalizado recuperado de periodos anteriores consolidado por OC y Sitio.'
        : 'Listado consolidado por OC y Sitio con el valor totalizado para el periodo actual.';

    return (
        <Card className="shadow-sm border-slate-100 overflow-hidden flex flex-col h-[420px] bg-white rounded-2xl">
            <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-3.5 px-5 flex flex-row items-center justify-between shrink-0">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                    {title}
                    <TooltipInfo text={tooltipText} />
                </CardTitle>
                <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    {data.length} órdenes consolidadas
                </span>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-auto w-full">
                    <Table className="w-full text-xs">
                        <TableHeader className="bg-slate-50/50 sticky top-0 z-10 border-b border-slate-100">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="py-2.5 px-4 font-semibold text-slate-400 uppercase text-[11px] tracking-wider whitespace-nowrap">Cliente</TableHead>
                                <TableHead className="py-2.5 px-4 font-semibold text-slate-400 uppercase text-[11px] tracking-wider whitespace-nowrap">OC / Orden</TableHead>
                                <TableHead className="py-2.5 px-4 font-semibold text-slate-400 uppercase text-[11px] tracking-wider whitespace-nowrap">Sitio</TableHead>
                                <TableHead className="py-2.5 px-4 font-semibold text-slate-400 uppercase text-[11px] tracking-wider whitespace-nowrap">Pedido TOTVS</TableHead>
                                <TableHead className="py-2.5 px-4 text-right font-semibold text-slate-400 uppercase text-[11px] tracking-wider whitespace-nowrap">Valor Totalizado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-slate-400 py-12">
                                        No hay pedidos registrados en este periodo
                                    </TableCell>
                                </TableRow>
                            ) : (
                                data.map((row, idx) => (
                                    <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100/60">
                                        <TableCell className="py-2.5 px-4 font-medium text-slate-800 whitespace-nowrap max-w-[150px] truncate" title={row.cliente}>
                                            {row.cliente}
                                        </TableCell>
                                        <TableCell className="py-2.5 px-4 text-slate-700 font-mono text-xs whitespace-nowrap font-medium">
                                            {row.po && row.po !== '-' ? (
                                                <span className="inline-flex items-center gap-1.5">
                                                    {row.po}
                                                    {row.cantidad_equipos > 1 && (
                                                        <span className="text-[10px] bg-slate-100 text-slate-500 font-sans px-1.5 py-0.2 rounded font-normal">
                                                            {row.cantidad_equipos} eqs
                                                        </span>
                                                    )}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300 italic font-sans text-[11px]">Sin OC</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="py-2.5 px-4 text-slate-600 text-xs whitespace-nowrap max-w-[150px] truncate" title={row.sitio}>
                                            {row.sitio && row.sitio !== '-' ? (
                                                <span className="inline-flex items-center gap-1">
                                                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                                    {row.sitio}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="py-2.5 px-4 text-slate-600 font-mono text-xs whitespace-nowrap">
                                            {row.pedido_totvs || '-'}
                                        </TableCell>
                                        <TableCell className={`py-2.5 px-4 text-right font-semibold whitespace-nowrap tabular-nums text-xs ${row.importe > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
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
