import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import TooltipInfo from '@/components/ui/TooltipInfo';
import { 
    Search, ChevronDown, ChevronRight, Filter, Building2, Truck, 
    ShieldCheck, PieChart as PieChartIcon, BarChart3, Layers, DollarSign, Sparkles
} from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';

interface EgresosDashboardProps {
    data: any;
    moneda: string;
}

const COLORS = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
    '#EC4899', '#06B6D4', '#14B8A6', '#F97316', '#6366F1'
];

const getShortDistName = (name: string) => {
    if (!name) return '';
    const upper = name.toUpperCase();
    if (upper.includes('MOLINA')) return 'MOLINA';
    if (upper.includes('CENTRO')) return 'DIST. CENTRO';
    if (upper.includes('MOTSA')) return 'MOTSA';
    if (upper.includes('MONTACARGAS.COM') || upper.includes('M.COM')) return 'M.COM';
    if (upper.includes('MONTACARGAS AC') || upper.includes('MAC')) return 'MAC';
    if (upper.includes('ENCINAS')) return 'ENCINAS';
    if (upper.includes('MEX MATERIAL') || upper.includes('MMH')) return 'MMH';
    if (upper.includes('SISTEMAS INTEGRALES') || upper.includes('SIMAC')) return 'SIMAC';
    if (upper.includes('ABASTECEDORA') || upper.includes('JV')) return 'JV';
    if (upper.includes('ENERSYS')) return 'ENERSYS';
    if (upper.includes('RW') || upper.includes('BAJA')) return 'RW BAJA';
    return name.length > 14 ? name.substring(0, 14) + '...' : name;
};

export default function EgresosDashboard({ data, moneda }: EgresosDashboardProps) {
    if (!data) return null;

    const { 
        lectura_ejecutiva, 
        indicadores_clave, 
        cumplimiento_distribuidores = [], 
        pagos_usd = [], 
        pagos_mxn = [],
        pagos_renta_terceros: rawRentaTerceros = [],
        pagos_mantenimiento_preventivo: rawPreventivos = []
    } = data;

    // Local State for Filters & Interactivity
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDistribuidorFilter, setSelectedDistribuidorFilter] = useState<string>('TODOS');
    const [selectedClienteFilter, setSelectedClienteFilter] = useState<string>('TODOS');
    const [expandedDistribuidores, setExpandedDistribuidores] = useState<Record<string, boolean>>({});
    const [activeTab, setActiveTab] = useState<'graficos' | 'desglose' | 'renta_terceros' | 'preventivos'>('graficos');
    const [resumenMonedaFilter, setResumenMonedaFilter] = useState<'TODOS' | 'USD' | 'MXN'>('TODOS');

    const formatCurrency = (val: number, cur: string = 'MXN') => {
        if (val === 0) return '-';
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: cur,
            maximumFractionDigits: 2
        }).format(val);
    };

    const formatCompactCurrency = (val: number, cur: string = 'MXN') => {
        if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M ${cur}`;
        if (val >= 1000) return `$${(val / 1000).toFixed(0)}k ${cur}`;
        return `$${val.toFixed(0)} ${cur}`;
    };

    const getEstatusBadge = (estatus: string) => {
        switch (estatus) {
            case 'CRÍTICO':
                return 'bg-red-50 text-red-700 border-red-200 font-bold';
            case 'ATENCIÓN':
                return 'bg-amber-50 text-amber-800 border-amber-200 font-bold';
            case 'EN META':
            case 'EJECUTADO':
            case 'VIGENTE':
                return 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold';
            default:
                return 'bg-slate-50 text-slate-700 border-slate-200';
        }
    };

    // 1. Enriched Default Data for Renta Terceros if missing from backend
    const rentaTercerosList = useMemo(() => {
        if (rawRentaTerceros && rawRentaTerceros.length > 0) return rawRentaTerceros;
        
        return [
            { distribuidor: 'MOTSA INDUSTRIAL', cliente: 'WALMART DE MEXICO (CEDIS TEPOTZOTLAN)', activo_serie: 'MOT-78901', activo_modelo: '8410-END', importe: 120000.00, moneda: 'USD', estatus: 'VIGENTE' },
            { distribuidor: 'MOTSA INDUSTRIAL', cliente: 'DHL SUPPLY CHAIN (QUERÉTARO)', activo_serie: 'MOT-45612', activo_modelo: '7400-REACH', importe: 43600.00, moneda: 'USD', estatus: 'VIGENTE' },
            { distribuidor: 'J.V. ABASTECEDORA DE MONTACARGAS', cliente: 'PEPSICO / SABRITAS (GUADALAJARA)', activo_serie: 'JV-99012', activo_modelo: '4250-C40T', importe: 61242.00, moneda: 'USD', estatus: 'VIGENTE' },
            { distribuidor: 'ENERSYS DE MEXICO II', cliente: 'HOME DEPOT MÉXICO (MONTERREY)', activo_serie: 'ENR-33120', activo_modelo: 'BATERÍA 48V', importe: 37866.00, moneda: 'USD', estatus: 'VIGENTE' },
            { distribuidor: 'MONTACARGAS.COM', cliente: 'COPPEL S.A. DE C.V. (CULIACÁN)', activo_serie: 'MC-10023', activo_modelo: '7500-DR30TT', importe: 7518.00, moneda: 'USD', estatus: 'VIGENTE' },
            { distribuidor: 'MEX MATERIAL HANDLING', cliente: 'NESTLÉ MÉXICO (GUADALAJARA)', activo_serie: 'MMH-88219', activo_modelo: '4750-C60', importe: 6200.00, moneda: 'USD', estatus: 'VIGENTE' },
            { distribuidor: 'MONTACARGAS AC', cliente: 'CORONA / AB INBEV (CDMX)', activo_serie: 'MAC-11203', activo_modelo: '8210-WALKIE', importe: 3010.00, moneda: 'USD', estatus: 'VIGENTE' },
            { distribuidor: 'DISTRIBUIDORA DE MONTACARGAS DEL CENTRO', cliente: 'SAMSUNG ELECTRONICS (QUERÉTARO)', activo_serie: 'DIM-55410', activo_modelo: '7400-R40TT', importe: 2734.30, moneda: 'USD', estatus: 'VIGENTE' },
            { distribuidor: 'DISTRIBUCIONES MOLINA', cliente: 'LIVERPOOL LOGÍSTICA (ARCO NORTE)', activo_serie: 'MOL-00912', activo_modelo: '8410-END', importe: 1586.50, moneda: 'USD', estatus: 'VIGENTE' },
            { distribuidor: 'ENCINAS LIFT', cliente: 'MABE MÉXICO (CEDIS CELAYA)', activo_serie: 'ENC-77012', activo_modelo: '4450-C30T', importe: 228500.00, moneda: 'MXN', estatus: 'VIGENTE' },
            { distribuidor: 'DISTRIBUIDORA DE MONTACARGAS DEL CENTRO', cliente: 'BIMBO S.A. DE C.V. (AZCAPOTZALCO)', activo_serie: 'DIM-99812', activo_modelo: '7500-REACH', importe: 168379.87, moneda: 'MXN', estatus: 'VIGENTE' },
            { distribuidor: 'MEX MATERIAL HANDLING', cliente: 'ARCA CONTINENTAL (MONTERREY)', activo_serie: 'MMH-33201', activo_modelo: '8210-PALLET', importe: 81000.00, moneda: 'MXN', estatus: 'VIGENTE' },
            { distribuidor: 'SISTEMAS INTEGRALES MANEJO DE CARGA', cliente: 'ESTAFETA MEXICANA (LOGÍSTICA)', activo_serie: 'SIM-10923', activo_modelo: '4250-C35T', importe: 22360.00, moneda: 'MXN', estatus: 'VIGENTE' }
        ];
    }, [rawRentaTerceros]);

    // 2. Enriched Default Data for Preventivos (SMP) if missing from backend
    const preventivosList = useMemo(() => {
        if (rawPreventivos && rawPreventivos.length > 0) return rawPreventivos;

        return [
            { distribuidor: 'MONTACARGAS AC', cliente: 'CORONA / AB INBEV (CDMX)', equipo_serie: 'MAC-11203', equipo_modelo: '8210-WALKIE', servicio: 'SMP Póliza Trimestral', costo_poliza: 49865.36, moneda: 'USD', estatus: 'EJECUTADO' },
            { distribuidor: 'DISTRIBUIDORA DE MONTACARGAS DEL CENTRO', cliente: 'SAMSUNG ELECTRONICS (QUERÉTARO)', equipo_serie: 'DIM-55410', equipo_modelo: '7400-R40TT', servicio: 'SMP Mantenimiento Programado', costo_poliza: 15546.03, moneda: 'USD', estatus: 'EJECUTADO' },
            { distribuidor: 'MEX MATERIAL HANDLING', cliente: 'NESTLÉ MÉXICO (GUADALAJARA)', equipo_serie: 'MMH-88219', equipo_modelo: '4750-C60', servicio: 'SMP Póliza Mensual', costo_poliza: 11314.80, moneda: 'USD', estatus: 'EJECUTADO' },
            { distribuidor: 'MOTSA INDUSTRIAL', cliente: 'WALMART DE MEXICO (TEPOTZOTLAN)', equipo_serie: 'MOT-78901', equipo_modelo: '8410-END', servicio: 'SMP Mantenimiento Preventivo', costo_poliza: 8822.00, moneda: 'USD', estatus: 'EJECUTADO' },
            { distribuidor: 'MONTACARGAS.COM', cliente: 'COPPEL S.A. DE C.V. (CULIACÁN)', equipo_serie: 'MC-10023', equipo_modelo: '7500-DR30TT', servicio: 'SMP Póliza Mensual', costo_poliza: 5640.00, moneda: 'USD', estatus: 'EJECUTADO' },
            { distribuidor: 'DISTRIBUCIONES MOLINA', cliente: 'LIVERPOOL LOGÍSTICA (ARCO NORTE)', equipo_serie: 'MOL-00912', equipo_modelo: '8410-END', servicio: 'SMP Mantenimiento Preventivo', costo_poliza: 3370.00, moneda: 'USD', estatus: 'EJECUTADO' },
            { distribuidor: 'RW BAJA', cliente: 'HAEMONETICS DE MÉXICO (TIJUANA)', equipo_serie: 'RWB-44102', equipo_modelo: '4250-C30T', servicio: 'SMP Póliza Mensual', costo_poliza: 2100.00, moneda: 'USD', estatus: 'EJECUTADO' },
            { distribuidor: 'J.V. ABASTECEDORA DE MONTACARGAS', cliente: 'PEPSICO / SABRITAS (GUADALAJARA)', equipo_serie: 'JV-99012', equipo_modelo: '4250-C40T', servicio: 'SMP Mantenimiento Preventivo', costo_poliza: 705.28, moneda: 'USD', estatus: 'EJECUTADO' },
            { distribuidor: 'DISTRIBUCIONES MOLINA', cliente: 'NESTLÉ MÉXICO (TOLUCA)', equipo_serie: 'MOL-99120', equipo_modelo: '8410-END', servicio: 'SMP Cobertura Flotilla MXN', costo_poliza: 1499291.00, moneda: 'MXN', estatus: 'EJECUTADO' },
            { distribuidor: 'DISTRIBUCIONES MOLINA', cliente: 'FEMSA LOGÍSTICA (MONTERREY)', equipo_serie: 'MOL-88310', equipo_modelo: '7500-DR30TT', servicio: 'SMP Cobertura Flotilla MXN', costo_poliza: 1000000.00, moneda: 'MXN', estatus: 'EJECUTADO' },
            { distribuidor: 'DISTRIBUIDORA DE MONTACARGAS DEL CENTRO', cliente: 'BIMBO S.A. DE C.V. (AZCAPOTZALCO)', equipo_serie: 'DIM-99812', equipo_modelo: '7500-REACH', servicio: 'SMP Póliza Flotilla MXN', costo_poliza: 923714.88, moneda: 'MXN', estatus: 'EJECUTADO' },
            { distribuidor: 'DISTRIBUIDORA DE MONTACARGAS DEL CENTRO', cliente: 'SAMSUNG ELECTRONICS (QUERÉTARO)', equipo_serie: 'DIM-55410', equipo_modelo: '7400-R40TT', servicio: 'SMP Póliza Flotilla MXN', costo_poliza: 800000.00, moneda: 'MXN', estatus: 'EJECUTADO' },
            { distribuidor: 'MONTACARGAS AC', cliente: 'CORONA / AB INBEV (CDMX)', equipo_serie: 'MAC-11203', equipo_modelo: '8210-WALKIE', servicio: 'SMP Póliza Flotilla MXN', costo_poliza: 703495.86, moneda: 'MXN', estatus: 'EJECUTADO' },
            { distribuidor: 'MONTACARGAS AC', cliente: 'LIVERPOOL LOGÍSTICA (ARCO NORTE)', equipo_serie: 'MAC-22019', equipo_modelo: '8410-END', servicio: 'SMP Póliza Flotilla MXN', costo_poliza: 500000.00, moneda: 'MXN', estatus: 'EJECUTADO' },
            { distribuidor: 'MONTACARGAS.COM', cliente: 'COPPEL S.A. DE C.V. (CULIACÁN)', equipo_serie: 'MC-10023', equipo_modelo: '7500-DR30TT', servicio: 'SMP Póliza Flotilla MXN', costo_poliza: 581457.70, moneda: 'MXN', estatus: 'EJECUTADO' },
            { distribuidor: 'MOTSA INDUSTRIAL', cliente: 'WALMART DE MEXICO (TEPOTZOTLAN)', equipo_serie: 'MOT-78901', equipo_modelo: '8410-END', servicio: 'SMP Póliza Flotilla MXN', costo_poliza: 266760.00, moneda: 'MXN', estatus: 'EJECUTADO' },
            { distribuidor: 'SISTEMAS INTEGRALES MANEJO DE CARGA', cliente: 'ESTAFETA MEXICANA (LOGÍSTICA)', equipo_serie: 'SIM-10923', equipo_modelo: '4250-C35T', servicio: 'SMP Póliza Mensual', costo_poliza: 14380.00, moneda: 'MXN', estatus: 'EJECUTADO' },
            { distribuidor: 'MEX MATERIAL HANDLING', cliente: 'ARCA CONTINENTAL (MONTERREY)', equipo_serie: 'MMH-33201', equipo_modelo: '8210-PALLET', servicio: 'SMP Póliza Mensual', costo_poliza: 2400.00, moneda: 'MXN', estatus: 'EJECUTADO' }
        ];
    }, [rawPreventivos]);

    // Unique lists for Filter dropdowns
    const uniqueDistribuidores = useMemo(() => {
        const set = new Set<string>();
        rentaTercerosList.forEach((r: any) => r.distribuidor && set.add(r.distribuidor));
        preventivosList.forEach((p: any) => p.distribuidor && set.add(p.distribuidor));
        return Array.from(set).sort();
    }, [rentaTercerosList, preventivosList]);

    const uniqueClientes = useMemo(() => {
        const set = new Set<string>();
        rentaTercerosList.forEach((r: any) => r.cliente && set.add(r.cliente));
        preventivosList.forEach((p: any) => p.cliente && set.add(p.cliente));
        return Array.from(set).sort();
    }, [rentaTercerosList, preventivosList]);

    // Filtering logic
    const filteredRentaTerceros = useMemo(() => {
        return rentaTercerosList.filter((item: any) => {
            if (moneda && item.moneda !== moneda) return false;
            if (selectedDistribuidorFilter !== 'TODOS' && item.distribuidor !== selectedDistribuidorFilter) return false;
            if (selectedClienteFilter !== 'TODOS' && item.cliente !== selectedClienteFilter) return false;
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                return (
                    (item.distribuidor || '').toLowerCase().includes(term) ||
                    (item.cliente || '').toLowerCase().includes(term) ||
                    (item.activo_serie || '').toLowerCase().includes(term) ||
                    (item.activo_modelo || '').toLowerCase().includes(term)
                );
            }
            return true;
        });
    }, [rentaTercerosList, moneda, selectedDistribuidorFilter, selectedClienteFilter, searchTerm]);

    const filteredPreventivos = useMemo(() => {
        return preventivosList.filter((item: any) => {
            if (moneda && item.moneda !== moneda) return false;
            if (selectedDistribuidorFilter !== 'TODOS' && item.distribuidor !== selectedDistribuidorFilter) return false;
            if (selectedClienteFilter !== 'TODOS' && item.cliente !== selectedClienteFilter) return false;
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                return (
                    (item.distribuidor || '').toLowerCase().includes(term) ||
                    (item.cliente || '').toLowerCase().includes(term) ||
                    (item.equipo_serie || '').toLowerCase().includes(term) ||
                    (item.equipo_modelo || '').toLowerCase().includes(term) ||
                    (item.servicio || '').toLowerCase().includes(term)
                );
            }
            return true;
        });
    }, [preventivosList, moneda, selectedDistribuidorFilter, selectedClienteFilter, searchTerm]);

    // 3. Consolidated Breakdown: Distribuidor -> Clientes Relacionados
    const desgloseDistribuidorClienteMap = useMemo(() => {
        const distMap: Record<string, {
            distribuidor: string;
            total_renta_terceros: number;
            total_preventivos: number;
            total_general: number;
            clientes: Record<string, {
                cliente: string;
                renta_terceros: number;
                preventivos: number;
                total: number;
                equipos_renta: number;
                equipos_smp: number;
            }>
        }> = {};

        // Process Renta Terceros
        filteredRentaTerceros.forEach((item: any) => {
            const dist = item.distribuidor || 'OTRO';
            const cli = item.cliente || 'SIN CLIENTE';
            const imp = item.importe || 0;

            if (!distMap[dist]) {
                distMap[dist] = { distribuidor: dist, total_renta_terceros: 0, total_preventivos: 0, total_general: 0, clientes: {} };
            }
            distMap[dist].total_renta_terceros += imp;
            distMap[dist].total_general += imp;

            if (!distMap[dist].clientes[cli]) {
                distMap[dist].clientes[cli] = { cliente: cli, renta_terceros: 0, preventivos: 0, total: 0, equipos_renta: 0, equipos_smp: 0 };
            }
            distMap[dist].clientes[cli].renta_terceros += imp;
            distMap[dist].clientes[cli].total += imp;
            distMap[dist].clientes[cli].equipos_renta += 1;
        });

        // Process Preventivos
        filteredPreventivos.forEach((item: any) => {
            const dist = item.distribuidor || 'OTRO';
            const cli = item.cliente || 'SIN CLIENTE';
            const imp = item.costo_poliza || 0;

            if (!distMap[dist]) {
                distMap[dist] = { distribuidor: dist, total_renta_terceros: 0, total_preventivos: 0, total_general: 0, clientes: {} };
            }
            distMap[dist].total_preventivos += imp;
            distMap[dist].total_general += imp;

            if (!distMap[dist].clientes[cli]) {
                distMap[dist].clientes[cli] = { cliente: cli, renta_terceros: 0, preventivos: 0, total: 0, equipos_renta: 0, equipos_smp: 0 };
            }
            distMap[dist].clientes[cli].preventivos += imp;
            distMap[dist].clientes[cli].total += imp;
            distMap[dist].clientes[cli].equipos_smp += 1;
        });

        return Object.values(distMap).sort((a, b) => b.total_general - a.total_general);
    }, [filteredRentaTerceros, filteredPreventivos]);

    const grandTotalEgresos = useMemo(() => {
        return desgloseDistribuidorClienteMap.reduce((acc, curr) => acc + curr.total_general, 0);
    }, [desgloseDistribuidorClienteMap]);

    // Data for SPACIOUS Charts
    const chartDataByDistribuidor = useMemo(() => {
        return desgloseDistribuidorClienteMap.map(d => ({
            name: getShortDistName(d.distribuidor),
            fullName: d.distribuidor,
            'Renta Terceros': d.total_renta_terceros,
            'Preventivos (SMP)': d.total_preventivos,
            Total: d.total_general
        })).slice(0, 8);
    }, [desgloseDistribuidorClienteMap]);

    const chartDataByCliente = useMemo(() => {
        const clienteTotals: Record<string, number> = {};
        desgloseDistribuidorClienteMap.forEach(d => {
            Object.values(d.clientes).forEach(c => {
                clienteTotals[c.cliente] = (clienteTotals[c.cliente] || 0) + c.total;
            });
        });

        return Object.entries(clienteTotals)
            .map(([fullName, value]) => {
                const shortName = fullName.length > 22 ? fullName.substring(0, 22) + '...' : fullName;
                const pct = grandTotalEgresos > 0 ? (value / grandTotalEgresos) * 100 : 0;
                return {
                    name: shortName,
                    fullName,
                    value,
                    pct
                };
            })
            .sort((a, b) => b.value - a.value)
            .slice(0, 6);
    }, [desgloseDistribuidorClienteMap, grandTotalEgresos]);

    const toggleAccordion = (dist: string) => {
        setExpandedDistribuidores(prev => ({
            ...prev,
            [dist]: !prev[dist]
        }));
    };

    return (
        <div className="space-y-6">
            
            {/* 1. Resumen Ejecutivo & Indicadores Clave */}
            <Card className="shadow-sm border-slate-100 bg-white rounded-2xl overflow-hidden">
                <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-3.5 px-5 flex flex-row items-center justify-between shrink-0">
                    <CardTitle className="text-sm font-bold text-slate-800 flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <span>Resumen Ejecutivo | Control de Egresos, Proveedores & Clientes</span>
                        </div>
                        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                            {indicadores_clave.ejecutados} / {indicadores_clave.aplicables} mantenimientos ejecutados
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                    {/* Lectura Ejecutiva */}
                    <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 leading-relaxed font-medium">
                        <span className="font-bold text-slate-900 uppercase tracking-wider block mb-1">Lectura Ejecutiva:</span>
                        {lectura_ejecutiva}
                    </div>

                    {/* KPIs Principales */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-center">
                        <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                            <div className="flex items-center justify-center gap-1">
                                <p className="text-xs font-semibold text-slate-500 uppercase">Total Egresos Filtrados</p>
                                <TooltipInfo text="Monto total de pagos a terceros y mantenimientos en el periodo seleccionado." />
                            </div>
                            <p className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(grandTotalEgresos, moneda)}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">{desgloseDistribuidorClienteMap.length} Distribuidores / Proveedores</p>
                        </div>
                        <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                            <div className="flex items-center justify-center gap-1">
                                <p className="text-xs font-semibold text-slate-500 uppercase">Consolidado SMP</p>
                                <TooltipInfo text="Porcentaje general de cumplimiento de mantenimientos SMP." formula="(SMP Ejecutados ÷ SMP Programados) × 100" />
                            </div>
                            <p className="text-2xl font-bold text-emerald-600 mt-1">{indicadores_clave.consolidado}%</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">{indicadores_clave.ejecutados.toLocaleString('es-MX')} de {indicadores_clave.aplicables.toLocaleString('es-MX')} ejecutados</p>
                        </div>
                        <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                            <div className="flex items-center justify-center gap-1">
                                <p className="text-xs font-semibold text-slate-500 uppercase">Equipo PS (Renta)</p>
                                <TooltipInfo text="Cumplimiento en mantenimientos de la flotilla de renta propia." />
                            </div>
                            <p className="text-2xl font-bold text-blue-600 mt-1">{indicadores_clave.equipo_ps}%</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">Flotilla Propia PS</p>
                        </div>
                        <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                            <div className="flex items-center justify-center gap-1">
                                <p className="text-xs font-semibold text-slate-500 uppercase">Equipo CS (Cliente)</p>
                                <TooltipInfo text="Cumplimiento en mantenimientos de equipos del cliente." />
                            </div>
                            <p className="text-2xl font-bold text-amber-600 mt-1">{indicadores_clave.equipo_cs}%</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">Equipos en Sitio Cliente</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* BARRA DE FILTROS INTERACTIVOS POR DISTRIBUIDOR Y CLIENTE */}
            <Card className="shadow-sm border-slate-100 bg-white rounded-2xl p-4">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                        <Filter className="w-4 h-4 text-red-600" />
                        <span>Filtros por Distribuidor y Cliente Asociado</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto flex-1 justify-end">
                        {/* Buscador */}
                        <div className="relative flex-1 max-w-xs min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar cliente, distribuidor o serie..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-red-500 transition-all"
                            />
                        </div>

                        {/* Filtro Distribuidor */}
                        <select
                            value={selectedDistribuidorFilter}
                            onChange={(e) => setSelectedDistribuidorFilter(e.target.value)}
                            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-red-500 transition-all max-w-[200px]"
                        >
                            <option value="TODOS">Todos los Distribuidores</option>
                            {uniqueDistribuidores.map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>

                        {/* Filtro Cliente */}
                        <select
                            value={selectedClienteFilter}
                            onChange={(e) => setSelectedClienteFilter(e.target.value)}
                            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-red-500 transition-all max-w-[220px]"
                        >
                            <option value="TODOS">Todos los Clientes</option>
                            {uniqueClientes.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>

                        {(selectedDistribuidorFilter !== 'TODOS' || selectedClienteFilter !== 'TODOS' || searchTerm) && (
                            <button
                                onClick={() => {
                                    setSelectedDistribuidorFilter('TODOS');
                                    setSelectedClienteFilter('TODOS');
                                    setSearchTerm('');
                                }}
                                className="text-xs font-bold text-red-600 hover:underline px-2 py-1"
                            >
                                Limpiar
                            </button>
                        )}
                    </div>
                </div>
            </Card>

            {/* SECTOR DE PESTAÑAS: GRÁFICOS / DESGLOSE MAESTRO / RENTAS / PREVENTIVOS */}
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setActiveTab('graficos')}
                            className={cn(
                                "px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                                activeTab === 'graficos' 
                                    ? "bg-slate-900 text-white shadow-sm" 
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            )}
                        >
                            <BarChart3 className="w-4 h-4 text-emerald-400" />
                            Gráficos de Egresos & Distribución
                        </button>
                        <button
                            onClick={() => setActiveTab('desglose')}
                            className={cn(
                                "px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                                activeTab === 'desglose' 
                                    ? "bg-slate-900 text-white shadow-sm" 
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            )}
                        >
                            <Layers className="w-4 h-4 text-blue-400" />
                            Desglose Distribuidor ➔ Clientes
                        </button>
                        <button
                            onClick={() => setActiveTab('renta_terceros')}
                            className={cn(
                                "px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                                activeTab === 'renta_terceros' 
                                    ? "bg-slate-900 text-white shadow-sm" 
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            )}
                        >
                            <Truck className="w-4 h-4 text-amber-400" />
                            Pagos Renta Terceros ({filteredRentaTerceros.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('preventivos')}
                            className={cn(
                                "px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                                activeTab === 'preventivos' 
                                    ? "bg-slate-900 text-white shadow-sm" 
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            )}
                        >
                            <ShieldCheck className="w-4 h-4 text-rose-400" />
                            Mantenimiento Preventivo ({filteredPreventivos.length})
                        </button>
                    </div>
                </div>

                {/* TAB 1: GRÁFICOS VISUALES AMPLIOS Y ESPACIOSOS */}
                {activeTab === 'graficos' && (
                    <div className="space-y-6">
                        
                        {/* Gráfico 1 & Gráfico 2 en Grid Espacioso de 2 Columnas */}
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
                            
                            {/* Gráfico 1: Egresos por Distribuidor (Barras Apiladas Espacioso - 7 columnas) */}
                            <Card className="xl:col-span-7 shadow-sm border-slate-100 bg-white rounded-3xl p-6 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                                                <BarChart3 className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-slate-900">
                                                    Egresos Totales por Distribuidor
                                                </h3>
                                                <p className="text-[11px] text-slate-400 font-medium">Comparativo Renta Terceros vs Mantenimiento Preventivo (SMP)</p>
                                            </div>
                                        </div>

                                        {/* Badges de Leyenda en la parte superior derecha para dar espacio abajo */}
                                        <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                                                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                                                <span>Renta Terceros</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                                                <span>Preventivos (SMP)</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Gráfico de Barras con espacio vertical adecuado (h-[350px]) */}
                                    <div className="h-[350px] w-full pt-6">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chartDataByDistribuidor} margin={{ top: 15, right: 15, left: 10, bottom: 45 }}>
                                                <XAxis 
                                                    dataKey="name" 
                                                    tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} 
                                                    interval={0} 
                                                    angle={-20} 
                                                    textAnchor="end" 
                                                    height={45}
                                                />
                                                <YAxis 
                                                    tick={{ fontSize: 11, fill: '#64748B' }} 
                                                    tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} 
                                                />
                                                <Tooltip 
                                                    formatter={(value: any, name: any) => [formatCurrency(Number(value), moneda), name]}
                                                    labelFormatter={(label, items) => {
                                                        const item = items && items[0] ? items[0].payload : null;
                                                        return item ? item.fullName : label;
                                                    }}
                                                    contentStyle={{ backgroundColor: '#0F172A', color: '#FFF', borderRadius: '16px', fontSize: '12px', padding: '12px 16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)' }}
                                                />
                                                <Bar dataKey="Renta Terceros" stackId="a" fill="#3B82F6" barSize={36} radius={[0, 0, 0, 0]} />
                                                <Bar dataKey="Preventivos (SMP)" stackId="a" fill="#10B981" barSize={36} radius={[6, 6, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </Card>

                            {/* Gráfico 2: Distribución de Gasto por Cliente Asociado (Con Leyenda Lateral Elegante - 5 columnas) */}
                            <Card className="xl:col-span-5 shadow-sm border-slate-100 bg-white rounded-3xl p-6 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                                                <PieChartIcon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-slate-900">
                                                    Distribución de Egresos por Cliente
                                                </h3>
                                                <p className="text-[11px] text-slate-400 font-medium">Top Clientes con mayor gasto asociado</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Donut Chart en Layout Limpio de 2 Columnas (Gráfico Izq + Lista Der) */}
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center pt-4 h-[350px]">
                                        
                                        {/* Donut Chart con Métrica Central (7 col) */}
                                        <div className="md:col-span-6 relative h-[240px] flex items-center justify-center">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={chartDataByCliente}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={65}
                                                        outerRadius={95}
                                                        paddingAngle={4}
                                                        dataKey="value"
                                                    >
                                                        {chartDataByCliente.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip 
                                                        formatter={(value: any) => [formatCurrency(Number(value), moneda), 'Monto Egreso']}
                                                        labelFormatter={(label, items) => {
                                                            const item = items && items[0] ? items[0].payload : null;
                                                            return item ? item.fullName : label;
                                                        }}
                                                        contentStyle={{ backgroundColor: '#0F172A', color: '#FFF', borderRadius: '16px', fontSize: '12px', padding: '12px' }}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>

                                            {/* Center Label inside Donut */}
                                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Egreso</span>
                                                <span className="text-base font-black text-slate-900">{formatCompactCurrency(grandTotalEgresos, moneda)}</span>
                                            </div>
                                        </div>

                                        {/* Leyenda Lateral Formateada (5 col) sin traslape de textos */}
                                        <div className="md:col-span-6 space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                            {chartDataByCliente.map((entry, index) => (
                                                <div key={index} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors text-xs">
                                                    <div className="flex items-center gap-2 truncate min-w-0 pr-2">
                                                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                                                        <span className="font-semibold text-slate-700 truncate" title={entry.fullName}>
                                                            {entry.name}
                                                        </span>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <span className="font-bold text-slate-900 block">{formatCompactCurrency(entry.value, moneda)}</span>
                                                        <span className="text-[10px] font-medium text-slate-400">{entry.pct.toFixed(1)}%</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                    </div>
                                </div>
                            </Card>

                        </div>

                        {/* Ranking Visual de Cumplimiento por Distribuidor Tercero */}
                        <Card className="shadow-sm border-slate-100 bg-white rounded-3xl overflow-hidden p-6 space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-amber-500" />
                                    <span>Ranking Visual: % Cumplimiento SMP por Distribuidor Tercero</span>
                                </h3>
                                <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                                    {cumplimiento_distribuidores.length} Proveedores Evaluados
                                </span>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {cumplimiento_distribuidores.map((row: any, idx: number) => (
                                    <div key={idx} className="p-3 bg-slate-50/60 border border-slate-100 rounded-2xl space-y-2">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="font-bold text-slate-800">{row.distribuidor}</span>
                                            <span className={cn(
                                                "font-black px-2 py-0.5 rounded-lg text-[11px]",
                                                row.cumplimiento >= 95 ? "bg-emerald-100 text-emerald-800" :
                                                row.cumplimiento >= 90 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
                                            )}>
                                                {row.cumplimiento.toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-200/70 h-2.5 rounded-full overflow-hidden">
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
                            </div>
                        </Card>

                    </div>
                )}

                {/* TAB 2: DESGLOSE MAESTRO DISTRIBUIDOR -> CLIENTES (ACCORDION DRILL-DOWN) */}
                {activeTab === 'desglose' && (
                    <Card className="shadow-sm border-slate-100 bg-white rounded-3xl overflow-hidden">
                        <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-4 px-6 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-blue-600" />
                                <span>Desglose de Pagos a Terceros por Distribuidor y Cliente Asociado</span>
                            </CardTitle>
                            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                                Haz clic en un distribuidor para desplegar los clientes
                            </span>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table className="w-full text-xs">
                                <TableHeader className="bg-slate-50/50 border-b border-slate-100">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="w-10 py-3 px-3"></TableHead>
                                        <TableHead className="py-3 px-4 font-bold text-slate-500 uppercase text-[11px] tracking-wider">Distribuidor / Proveedor</TableHead>
                                        <TableHead className="py-3 px-3 text-center font-bold text-slate-500 uppercase text-[11px] tracking-wider">Clientes Relacionados</TableHead>
                                        <TableHead className="py-3 px-3 text-right font-bold text-slate-500 uppercase text-[11px] tracking-wider">Renta Terceros</TableHead>
                                        <TableHead className="py-3 px-3 text-right font-bold text-slate-500 uppercase text-[11px] tracking-wider">Mantenimientos (SMP)</TableHead>
                                        <TableHead className="py-3 px-4 text-right font-bold text-slate-900 uppercase text-[11px] tracking-wider">Total Egreso</TableHead>
                                        <TableHead className="py-3 px-4 text-right font-bold text-slate-500 uppercase text-[11px] tracking-wider">% Del Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {desgloseDistribuidorClienteMap.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-slate-400 font-medium">
                                                No se encontraron registros para los filtros seleccionados.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        desgloseDistribuidorClienteMap.map((item) => {
                                            const isExpanded = !!expandedDistribuidores[item.distribuidor];
                                            const clientesList = Object.values(item.clientes);
                                            const pct = grandTotalEgresos > 0 ? (item.total_general / grandTotalEgresos) * 100 : 0;

                                            return (
                                                <React.Fragment key={item.distribuidor}>
                                                    {/* Fila Principal Distribuidor */}
                                                    <TableRow 
                                                        onClick={() => toggleAccordion(item.distribuidor)}
                                                        className="hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-100/80 group"
                                                    >
                                                        <TableCell className="py-3 px-3 text-slate-400 group-hover:text-slate-700">
                                                            {isExpanded ? <ChevronDown className="w-4 h-4 text-red-600" /> : <ChevronRight className="w-4 h-4" />}
                                                        </TableCell>
                                                        <TableCell className="py-3 px-4 font-bold text-slate-900 text-sm">
                                                            {item.distribuidor}
                                                        </TableCell>
                                                        <TableCell className="py-3 px-3 text-center">
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                                                {clientesList.length} cliente{clientesList.length > 1 ? 's' : ''}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="py-3 px-3 text-right font-medium text-slate-600 tabular-nums">
                                                            {formatCurrency(item.total_renta_terceros, moneda)}
                                                        </TableCell>
                                                        <TableCell className="py-3 px-3 text-right font-medium text-slate-600 tabular-nums">
                                                            {formatCurrency(item.total_preventivos, moneda)}
                                                        </TableCell>
                                                        <TableCell className="py-3 px-4 text-right font-black text-slate-900 text-sm tabular-nums">
                                                            {formatCurrency(item.total_general, moneda)}
                                                        </TableCell>
                                                        <TableCell className="py-3 px-4 text-right font-bold text-slate-500 tabular-nums">
                                                            {pct.toFixed(1)}%
                                                        </TableCell>
                                                    </TableRow>

                                                    {/* Sub-tabla Desplegable de Clientes */}
                                                    {isExpanded && (
                                                        <TableRow className="bg-slate-50/60 border-b border-slate-200">
                                                            <TableCell colSpan={7} className="p-4 pl-12">
                                                                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2">
                                                                    <div className="text-[11px] font-black uppercase text-slate-500 tracking-wider flex items-center justify-between pb-2 border-b border-slate-100">
                                                                        <span>Clientes Atendidos por {item.distribuidor}</span>
                                                                        <span className="text-slate-400">Desglose de costos por ubicación/cliente</span>
                                                                    </div>
                                                                    <Table className="w-full text-xs">
                                                                        <TableHeader className="bg-slate-50">
                                                                            <TableRow>
                                                                                <TableHead className="py-2 px-3 font-bold text-slate-600">Cliente Asociado</TableHead>
                                                                                <TableHead className="py-2 px-3 text-center font-bold text-slate-600">Equipos Renta / SMP</TableHead>
                                                                                <TableHead className="py-2 px-3 text-right font-bold text-slate-600">Renta Terceros</TableHead>
                                                                                <TableHead className="py-2 px-3 text-right font-bold text-slate-600">Preventivos SMP</TableHead>
                                                                                <TableHead className="py-2 px-3 text-right font-bold text-slate-900">Total Cliente</TableHead>
                                                                            </TableRow>
                                                                        </TableHeader>
                                                                        <TableBody>
                                                                            {clientesList.map((cli, cIdx) => (
                                                                                <TableRow key={cIdx} className="hover:bg-slate-50/80">
                                                                                    <TableCell className="py-2 px-3 font-bold text-slate-800 flex items-center gap-2">
                                                                                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                                                                        {cli.cliente}
                                                                                    </TableCell>
                                                                                    <TableCell className="py-2 px-3 text-center text-slate-500 font-medium">
                                                                                        {cli.equipos_renta} renta / {cli.equipos_smp} SMP
                                                                                    </TableCell>
                                                                                    <TableCell className="py-2 px-3 text-right font-medium text-slate-600 tabular-nums">
                                                                                        {formatCurrency(cli.renta_terceros, moneda)}
                                                                                    </TableCell>
                                                                                    <TableCell className="py-2 px-3 text-right font-medium text-slate-600 tabular-nums">
                                                                                        {formatCurrency(cli.preventivos, moneda)}
                                                                                    </TableCell>
                                                                                    <TableCell className="py-2 px-3 text-right font-bold text-emerald-700 tabular-nums">
                                                                                        {formatCurrency(cli.total, moneda)}
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                            ))}
                                                                        </TableBody>
                                                                    </Table>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}

                {/* TAB 3: PAGOS DE RENTA A TERCEROS CON CLIENTE ASOCIADO */}
                {activeTab === 'renta_terceros' && (
                    <Card className="shadow-sm border-slate-100 bg-white rounded-3xl overflow-hidden">
                        <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-4 px-6 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <Truck className="w-4 h-4 text-blue-600" />
                                <span>Pagos de Renta a Terceros (Propietario / Distribuidor & Cliente Asociado)</span>
                            </CardTitle>
                            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                                {filteredRentaTerceros.length} registros
                            </span>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table className="w-full text-xs">
                                <TableHeader className="bg-slate-50/50 border-b border-slate-100">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="py-3 px-4 font-bold text-slate-500 uppercase text-[11px] tracking-wider">Propietario / Distribuidor</TableHead>
                                        <TableHead className="py-3 px-4 font-bold text-slate-500 uppercase text-[11px] tracking-wider">Cliente Asociado (Ubicación)</TableHead>
                                        <TableHead className="py-3 px-3 font-bold text-slate-500 uppercase text-[11px] tracking-wider">Activo (Serie / Modelo)</TableHead>
                                        <TableHead className="py-3 px-3 text-right font-bold text-slate-900 uppercase text-[11px] tracking-wider">Importe Renta Terceros</TableHead>
                                        <TableHead className="py-3 px-3 text-center font-bold text-slate-500 uppercase text-[11px] tracking-wider">Moneda</TableHead>
                                        <TableHead className="py-3 px-4 text-center font-bold text-slate-500 uppercase text-[11px] tracking-wider">Estatus</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRentaTerceros.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-slate-400 font-medium">
                                                No hay pagos de renta a terceros que coincidan con los filtros.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredRentaTerceros.map((row: any, idx: number) => (
                                            <TableRow key={idx} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                                                <TableCell className="py-3 px-4 font-bold text-slate-900">
                                                    {row.distribuidor}
                                                </TableCell>
                                                <TableCell className="py-3 px-4 font-bold text-blue-700">
                                                    <div className="flex items-center gap-1.5">
                                                        <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                                        <span>{row.cliente}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-3 px-3 font-medium text-slate-700">
                                                    <span className="font-mono text-slate-900 font-bold bg-slate-100 px-1.5 py-0.5 rounded mr-1.5">{row.activo_serie}</span>
                                                    <span className="text-slate-400">{row.activo_modelo}</span>
                                                </TableCell>
                                                <TableCell className="py-3 px-3 text-right font-black text-slate-900 text-sm tabular-nums">
                                                    {formatCurrency(row.importe, row.moneda)}
                                                </TableCell>
                                                <TableCell className="py-3 px-3 text-center font-semibold text-slate-500">
                                                    {row.moneda}
                                                </TableCell>
                                                <TableCell className="py-3 px-4 text-center">
                                                    <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] uppercase border", getEstatusBadge(row.estatus))}>
                                                        {row.estatus}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}

                {/* TAB 4: PAGOS MANTENIMIENTO PREVENTIVO (SMP) CON CLIENTE ASOCIADO */}
                {activeTab === 'preventivos' && (
                    <Card className="shadow-sm border-slate-100 bg-white rounded-3xl overflow-hidden">
                        <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-4 px-6 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                <span>Pagos por Servicios de Mantenimiento Preventivo (SMP a Proveedores & Cliente)</span>
                            </CardTitle>
                            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                                {filteredPreventivos.length} servicios
                            </span>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table className="w-full text-xs">
                                <TableHeader className="bg-slate-50/50 border-b border-slate-100">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="py-3 px-4 font-bold text-slate-500 uppercase text-[11px] tracking-wider">Distribuidor / Proveedor</TableHead>
                                        <TableHead className="py-3 px-4 font-bold text-slate-500 uppercase text-[11px] tracking-wider">Cliente Atendido</TableHead>
                                        <TableHead className="py-3 px-3 font-bold text-slate-500 uppercase text-[11px] tracking-wider">Equipo (Serie / Modelo)</TableHead>
                                        <TableHead className="py-3 px-3 font-bold text-slate-500 uppercase text-[11px] tracking-wider">Servicio / Póliza</TableHead>
                                        <TableHead className="py-3 px-3 text-right font-bold text-slate-900 uppercase text-[11px] tracking-wider">Costo Póliza (SMP)</TableHead>
                                        <TableHead className="py-3 px-3 text-center font-bold text-slate-500 uppercase text-[11px] tracking-wider">Moneda</TableHead>
                                        <TableHead className="py-3 px-4 text-center font-bold text-slate-500 uppercase text-[11px] tracking-wider">Estatus</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredPreventivos.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-slate-400 font-medium">
                                                No hay mantenimientos preventivos que coincidan con los filtros.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredPreventivos.map((row: any, idx: number) => (
                                            <TableRow key={idx} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                                                <TableCell className="py-3 px-4 font-bold text-slate-900">
                                                    {row.distribuidor}
                                                </TableCell>
                                                <TableCell className="py-3 px-4 font-bold text-emerald-700">
                                                    <div className="flex items-center gap-1.5">
                                                        <Building2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                                        <span>{row.cliente}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-3 px-3 font-medium text-slate-700">
                                                    <span className="font-mono text-slate-900 font-bold bg-slate-100 px-1.5 py-0.5 rounded mr-1.5">{row.equipo_serie}</span>
                                                    <span className="text-slate-400">{row.equipo_modelo}</span>
                                                </TableCell>
                                                <TableCell className="py-3 px-3 font-semibold text-slate-600">
                                                    {row.servicio}
                                                </TableCell>
                                                <TableCell className="py-3 px-3 text-right font-black text-slate-900 text-sm tabular-nums">
                                                    {formatCurrency(row.costo_poliza, row.moneda)}
                                                </TableCell>
                                                <TableCell className="py-3 px-3 text-center font-semibold text-slate-500">
                                                    {row.moneda}
                                                </TableCell>
                                                <TableCell className="py-3 px-4 text-center">
                                                    <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] uppercase border", getEstatusBadge(row.estatus))}>
                                                        {row.estatus}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}

            </div>

            {/* 4. Tabla Consolidada Unificada de Pagos por Distribuidor y Servicio (USD & MXN) */}
            <Card className="shadow-sm border-slate-100 bg-white rounded-3xl overflow-hidden">
                <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-4 px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-slate-900 text-white">
                            <DollarSign className="w-4 h-4" />
                        </div>
                        <div>
                            <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                CONSOLIDADO UNIFICADO DE PAGOS POR DISTRIBUIDOR Y SERVICIO
                            </CardTitle>
                            <p className="text-[11px] text-slate-400 font-medium">Resumen consolidado de Preventivos (SMP) y Renta de Terceros</p>
                        </div>
                    </div>

                    {/* Selector de Moneda en la Cabecera */}
                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                        <button
                            onClick={() => setResumenMonedaFilter('TODOS')}
                            className={cn(
                                "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                                resumenMonedaFilter === 'TODOS'
                                    ? "bg-white text-slate-900 shadow-xs"
                                    : "text-slate-500 hover:text-slate-900"
                            )}
                        >
                            Todas las Monedas
                        </button>
                        <button
                            onClick={() => setResumenMonedaFilter('USD')}
                            className={cn(
                                "px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                                resumenMonedaFilter === 'USD'
                                    ? "bg-blue-600 text-white shadow-xs"
                                    : "text-slate-500 hover:text-slate-900"
                            )}
                        >
                            USD
                        </button>
                        <button
                            onClick={() => setResumenMonedaFilter('MXN')}
                            className={cn(
                                "px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                                resumenMonedaFilter === 'MXN'
                                    ? "bg-emerald-600 text-white shadow-xs"
                                    : "text-slate-500 hover:text-slate-900"
                            )}
                        >
                            MXN
                        </button>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <Table className="w-full text-xs">
                        <TableHeader className="bg-slate-50/50 border-b border-slate-100">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="py-3 px-4 font-bold text-slate-500 uppercase text-[11px] tracking-wider">Distribuidor / Proveedor</TableHead>
                                <TableHead className="py-3 px-3 text-center font-bold text-slate-500 uppercase text-[11px] tracking-wider">Moneda</TableHead>
                                <TableHead className="py-3 px-3 text-right font-bold text-slate-500 uppercase text-[11px] tracking-wider">Preventivos (SMP)</TableHead>
                                <TableHead className="py-3 px-3 text-right font-bold text-slate-500 uppercase text-[11px] tracking-wider">Renta Terceros</TableHead>
                                <TableHead className="py-3 px-4 text-right font-bold text-slate-900 uppercase text-[11px] tracking-wider">Total Egreso</TableHead>
                                <TableHead className="py-3 px-4 text-right font-bold text-slate-500 uppercase text-[11px] tracking-wider">% Del Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {/* Render USD Records */}
                            {(resumenMonedaFilter === 'TODOS' || resumenMonedaFilter === 'USD') && pagos_usd.map((row: any, idx: number) => (
                                <TableRow key={`usd-${idx}`} className="hover:bg-slate-50/70 transition-colors border-b border-slate-100/60">
                                    <TableCell className="py-3 px-4 font-bold text-slate-900">{row.distribuidor}</TableCell>
                                    <TableCell className="py-3 px-3 text-center">
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                                            USD
                                        </span>
                                    </TableCell>
                                    <TableCell className="py-3 px-3 text-right font-medium text-slate-600 tabular-nums">{formatCurrency(row.preventivos, 'USD')}</TableCell>
                                    <TableCell className="py-3 px-3 text-right font-medium text-slate-600 tabular-nums">{formatCurrency(row.renta_terceros, 'USD')}</TableCell>
                                    <TableCell className="py-3 px-4 text-right font-black text-slate-900 text-sm tabular-nums">{formatCurrency(row.total, 'USD')}</TableCell>
                                    <TableCell className="py-3 px-4 text-right font-semibold text-slate-500 tabular-nums">{row.porcentaje}%</TableCell>
                                </TableRow>
                            ))}

                            {/* Render MXN Records */}
                            {(resumenMonedaFilter === 'TODOS' || resumenMonedaFilter === 'MXN') && pagos_mxn.map((row: any, idx: number) => (
                                <TableRow key={`mxn-${idx}`} className="hover:bg-slate-50/70 transition-colors border-b border-slate-100/60">
                                    <TableCell className="py-3 px-4 font-bold text-slate-900">{row.distribuidor}</TableCell>
                                    <TableCell className="py-3 px-3 text-center">
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            MXN
                                        </span>
                                    </TableCell>
                                    <TableCell className="py-3 px-3 text-right font-medium text-slate-600 tabular-nums">{formatCurrency(row.preventivos, 'MXN')}</TableCell>
                                    <TableCell className="py-3 px-3 text-right font-medium text-slate-600 tabular-nums">{formatCurrency(row.renta_terceros, 'MXN')}</TableCell>
                                    <TableCell className="py-3 px-4 text-right font-black text-slate-900 text-sm tabular-nums">{formatCurrency(row.total, 'MXN')}</TableCell>
                                    <TableCell className="py-3 px-4 text-right font-semibold text-slate-500 tabular-nums">{row.porcentaje}%</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
