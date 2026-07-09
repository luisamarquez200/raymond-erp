"use client";

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Search, LayoutGrid, FileText, MapPin, Download, Clock, Calendar, Globe } from 'lucide-react';
import { inventarioApi, InventarioItem } from '@/services/taller-r1/inventario.service';
import { TableList } from '@/components/shared/TableList';
import { DataTableColumnHeader } from '@/components/ui/data-table/data-table-column-header';
import { DataTableViewOptions } from '@/components/ui/data-table/data-table-view-options';
import * as XLSX from 'xlsx';
import { ColumnDef } from '@tanstack/react-table';

export default function InventarioPage() {
    const [data, setData] = useState<InventarioItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [table, setTable] = useState<any>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const res = await inventarioApi.getAll();
            setData(res);
        } catch (error) {
            console.error('Error loading inventario', error);
            toast.error('Error al cargar el inventario');
        } finally {
            setLoading(false);
        }
    };

    const filteredData = data.filter(item => {
        const term = searchTerm.toLowerCase();
        return (
            item.serial_equipo?.toLowerCase().includes(term) ||
            item.modelo?.toLowerCase().includes(term) ||
            item.folio?.toLowerCase().includes(term) ||
            item.ubicacion?.toLowerCase().includes(term) ||
            item.sitio?.toLowerCase().includes(term)
        );
    });

    const handleExportExcel = () => {
        const exportData = filteredData.map(item => ({
            'Sitio': item.sitio,
            'Folio': item.folio,
            'Serial': item.serial_equipo,
            'Equipo': item.modelo,
            'Marca': item.marca,
            'Clase': item.clase,
            'Ubicación': item.ubicacion,
            'Sub Ubicación': item.sub_ubicacion,
            'Estado': item.estado,
            'Fecha Ingreso': item.fecha_ingreso && item.fecha_ingreso !== 'N/D' ? new Date(item.fecha_ingreso).toLocaleDateString() : 'N/D',
            'Días de Permanencia': item.dias_permanencia,
            'Semanas de Permanencia': item.semanas_permanencia
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "InventarioGeneral");
        XLSX.writeFile(workbook, `Inventario_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const columns: ColumnDef<InventarioItem>[] = [
        {
            accessorKey: 'sitio',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Sitio" />,
            size: 80,
            cell: ({ row }) => (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 border border-slate-200 w-fit">
                    <Globe className="w-3 h-3 text-slate-500" />
                    <span className="text-xs font-black text-slate-700">{row.original.sitio}</span>
                </div>
            )
        },
        {
            accessorKey: 'folio',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Folio" />,
            size: 100,
            cell: ({ row }) => (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700 bg-gray-50 border border-gray-200 px-2 py-1 rounded">
                    <FileText className="w-3.5 h-3.5 text-gray-400" />
                    #{row.original.folio}
                </span>
            )
        },
        {
            accessorKey: 'serial_equipo',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Serial / Estado" />,
            size: 150,
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-bold text-gray-900">{row.original.serial_equipo}</span>
                    <span className="text-[10px] text-gray-500 uppercase font-semibold">{row.original.estado}</span>
                </div>
            )
        },
        {
            accessorKey: 'modelo',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Equipo" />,
            size: 180,
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-900">{row.original.modelo}</span>
                    <div className="flex gap-1 mt-1">
                        <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded uppercase">{row.original.marca}</span>
                        <span className="text-[10px] font-bold text-gray-600 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded uppercase">{row.original.clase}</span>
                    </div>
                </div>
            )
        },
        {
            accessorKey: 'ubicacion',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Ubicación" />,
            size: 150,
            cell: ({ row }) => (
                <div className="flex flex-col space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        {row.original.ubicacion}
                    </div>
                    <span className="text-[10px] font-bold text-slate-500">{row.original.sub_ubicacion}</span>
                </div>
            )
        },
        {
            id: 'permanencia',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Permanencia" />,
            size: 150,
            cell: ({ row }) => (
                <div className="flex flex-col space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-red-700">
                        <Clock className="w-3.5 h-3.5 text-red-400" />
                        {row.original.dias_permanencia} Días
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                        <Calendar className="w-3.5 h-3.5 text-slate-300" />
                        {row.original.semanas_permanencia} Semanas
                    </div>
                </div>
            )
        },
        {
            accessorKey: 'fecha_ingreso',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha Ingreso" />,
            size: 130,
            cell: ({ row }) => (
                <span className="text-xs font-medium text-gray-600">
                    {row.original.fecha_ingreso && row.original.fecha_ingreso !== 'N/D' ? new Date(row.original.fecha_ingreso).toLocaleDateString() : 'N/D'}
                </span>
            )
        }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
            <div className="bg-white border-b border-gray-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col -gap-1">
                            <span className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] mb-1">RAYMOND</span>
                            <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
                                Inventario General
                            </h1>
                        </div>
                        <p className="text-gray-600 mt-2 font-medium">
                            Vista consolidada de existencias y tiempos de permanencia
                        </p>
                        <div className="flex items-center gap-3">
                            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                                <p className="text-red-800 font-bold text-sm">
                                    {filteredData.length} Equipos
                                </p>
                            </div>
                            {table && <DataTableViewOptions table={table} />}
                            <button
                                onClick={handleExportExcel}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-bold shadow-sm transition-all border border-green-700/50"
                            >
                                <Download className="w-4 h-4" />
                                <span className="hidden sm:inline">Exportar Excel</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-8 py-6">
                <div className="mb-6 flex justify-end">
                    <div className="relative w-full md:max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar por serie, modelo, folio, sitio..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all font-medium text-sm text-gray-900"
                        />
                    </div>
                </div>

                <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
                    <TableList
                        isLoading={loading}
                        data={filteredData}
                        columns={columns}
                        hideToolbar={true}
                        initialPageSize={50}
                        hidePageSizeSelector={true}
                        onTableReady={setTable}
                        renderMobileItem={(row) => (
                            <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col gap-2 hover:border-red-200 transition-colors">
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col">
                                        <span className="font-black text-slate-800 text-lg tracking-tight">{row.serial_equipo}</span>
                                        <span className="text-[10px] font-mono font-bold text-slate-400">{row.modelo} ({row.sitio})</span>
                                    </div>
                                    <span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded border border-slate-200">#{row.folio}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <div className="flex items-center gap-1.5 text-red-700 font-bold">
                                        <Clock className="w-3.5 h-3.5" />
                                        {row.dias_permanencia} días
                                    </div>
                                    <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                        {row.ubicacion}
                                    </div>
                                </div>
                            </div>
                        )}
                        emptyMessage={
                            <div className="py-16 text-center">
                                <LayoutGrid className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                                <h3 className="text-xl font-bold text-gray-700 mb-2">Inventario vacío</h3>
                                <p className="text-gray-500">No se encontraron registros de inventario.</p>
                            </div>
                        }
                    />
                </div>
            </div>
        </div>
    );
}
