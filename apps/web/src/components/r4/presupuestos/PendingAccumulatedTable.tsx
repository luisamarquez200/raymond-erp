import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function PendingAccumulatedTable({ data, moneda }: { data: any[], moneda: string }) {
    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda }).format(val);
    };

    return (
        <Card className="shadow-sm border-slate-100 overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100">
                <CardTitle className="text-lg font-bold text-slate-800">Pendiente Acumulado</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="max-h-[300px] overflow-auto">
                    <Table>
                        <TableHeader className="bg-slate-50/50 sticky top-0">
                            <TableRow>
                                <TableHead className="font-semibold text-slate-600">Cliente</TableHead>
                                <TableHead className="font-semibold text-slate-600">ADC</TableHead>
                                <TableHead className="text-right font-semibold text-slate-600">Importe Pendiente</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center text-slate-400 h-24">
                                        No hay acumulado pendiente
                                    </TableCell>
                                </TableRow>
                            ) : (
                                data.map((row, idx) => (
                                    <TableRow key={idx} className="hover:bg-slate-50 transition-colors">
                                        <TableCell className="font-medium text-slate-700">{row.cliente}</TableCell>
                                        <TableCell className="text-slate-600">{row.adc}</TableCell>
                                        <TableCell className="text-right font-semibold text-amber-600">
                                            {formatCurrency(row.pendiente)}
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
