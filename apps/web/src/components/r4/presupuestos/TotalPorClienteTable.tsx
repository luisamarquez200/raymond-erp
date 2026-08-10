import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import TooltipInfo from '@/components/ui/TooltipInfo';

export default function TotalPorClienteTable({ data, moneda }: { data: any[], moneda: string }) {
    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda }).format(val);
    };

    return (
        <Card className="shadow-sm border-slate-100 overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100">
                <CardTitle className="text-lg font-bold text-slate-800 flex items-center">
                    Total a Facturar por Cliente
                    <TooltipInfo text="Desglose del monto total proyectado para facturar desglosado por cada cliente." />
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="max-h-[300px] overflow-auto">
                    <Table>
                        <TableHeader className="bg-slate-50/50 sticky top-0">
                            <TableRow>
                                <TableHead className="font-semibold text-slate-600">Cliente</TableHead>
                                <TableHead className="text-right font-semibold text-slate-600">P. Mes</TableHead>
                                <TableHead className="text-right font-semibold text-slate-600">Acumulado</TableHead>
                                <TableHead className="text-right font-bold text-amber-700">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-slate-400 h-24">
                                        No hay información disponible
                                    </TableCell>
                                </TableRow>
                            ) : (
                                data.map((row, idx) => (
                                    <TableRow key={idx} className="hover:bg-slate-50 transition-colors">
                                        <TableCell className="font-medium text-slate-700">{row.cliente}</TableCell>
                                        <TableCell className="text-right text-slate-600">{formatCurrency(row.presupuesto_mes)}</TableCell>
                                        <TableCell className="text-right text-slate-600">{formatCurrency(row.pendiente_acumulado)}</TableCell>
                                        <TableCell className="text-right font-black text-amber-600">
                                            {formatCurrency(row.total_facturar)}
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
