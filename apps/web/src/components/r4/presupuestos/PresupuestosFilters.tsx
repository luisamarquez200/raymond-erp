import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Download, Search, Loader2, RotateCcw } from 'lucide-react';
import dayjs from 'dayjs';

interface FiltersProps {
    filters: any;
    setFilters: (filters: any) => void;
    onSearch?: () => void;
    onReset?: () => void;
    isSearching?: boolean;
}

export default function PresupuestosFilters({ filters, setFilters, onSearch, onReset, isSearching }: FiltersProps) {
    const years = Array.from({ length: 5 }, (_, i) => (dayjs().year() - 2 + i).toString());
    const months = [
        { val: '1', label: 'Enero' }, { val: '2', label: 'Febrero' }, { val: '3', label: 'Marzo' },
        { val: '4', label: 'Abril' }, { val: '5', label: 'Mayo' }, { val: '6', label: 'Junio' },
        { val: '7', label: 'Julio' }, { val: '8', label: 'Agosto' }, { val: '9', label: 'Septiembre' },
        { val: '10', label: 'Octubre' }, { val: '11', label: 'Noviembre' }, { val: '12', label: 'Diciembre' },
    ];

    const handleChange = (key: string, value: string) => {
        setFilters((prev: any) => ({ ...prev, [key]: value }));
    };

    return (
        <Card className="shadow-sm border-slate-100 bg-white mb-6">
            <CardContent className="p-4 md:p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
                    
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-500 uppercase">Año</Label>
                        <Select value={filters.year} onValueChange={(val) => handleChange('year', val)}>
                            <SelectTrigger className="w-full bg-slate-50 border-slate-200">
                                <SelectValue placeholder="Año" />
                            </SelectTrigger>
                            <SelectContent>
                                {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-500 uppercase">Mes</Label>
                        <Select value={filters.month} onValueChange={(val) => handleChange('month', val)}>
                            <SelectTrigger className="w-full bg-slate-50 border-slate-200">
                                <SelectValue placeholder="Mes" />
                            </SelectTrigger>
                            <SelectContent>
                                {months.map(m => <SelectItem key={m.val} value={m.val}>{m.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-500 uppercase">Moneda</Label>
                        <Select value={filters.moneda} onValueChange={(val) => handleChange('moneda', val)}>
                            <SelectTrigger className="w-full bg-slate-50 border-slate-200">
                                <SelectValue placeholder="Moneda" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="MXN">MXN</SelectItem>
                                <SelectItem value="USD">USD</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-2 lg:col-span-3 justify-end">
                        {onReset && (
                            <Button
                                variant="outline"
                                onClick={onReset}
                                title="Restaurar filtros iniciales"
                                className="border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-bold"
                            >
                                <RotateCcw className="w-4 h-4 mr-2" />
                                Restaurar
                            </Button>
                        )}
                        {onSearch && (
                            <Button 
                                onClick={onSearch}
                                disabled={isSearching}
                                className="flex-1 lg:flex-initial bg-slate-900 text-white hover:bg-slate-800 font-bold px-6"
                            >
                                {isSearching ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin text-white" />
                                        Buscando...
                                    </>
                                ) : (
                                    <>
                                        <Search className="w-4 h-4 mr-2" />
                                        Buscar
                                    </>
                                )}
                            </Button>
                        )}
                        <Button 
                            variant="outline" 
                            className="flex-1 lg:flex-initial border-slate-200 text-slate-700 hover:bg-slate-50"
                            onClick={() => alert('Generando reporte PDF/Excel...')}
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Exportar Reporte
                        </Button>
                    </div>

                </div>
            </CardContent>
        </Card>
    );
}
