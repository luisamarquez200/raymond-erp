"use client";

import { useParams } from 'next/navigation';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { QrCode, Search, LayoutGrid, FileText, CheckCircle2, XCircle, MapPin, Tag, Download, Truck, Wrench, ClipboardCheck } from 'lucide-react';
import { QrScannerButton } from '@/components/ui/qr-scanner-button';
import { equipoUbicacionApi, EquipoUbicacion, MovilizacionHistory } from '@/services/taller-r1/equipo-ubicacion.service';
import { generateQRLabel } from '@/lib/generateQRLabel';
import { TableList } from '@/components/shared/TableList';
import { DataTableColumnHeader } from '@/components/ui/data-table/data-table-column-header';
import { DataTableViewOptions } from '@/components/ui/data-table/data-table-view-options';
import * as XLSX from 'xlsx';
import { ColumnDef } from '@tanstack/react-table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { MovilizacionModal } from './MovilizacionModal';
import { EquipoUbicacionDetailsModal } from '@/components/taller-r1/equipo-ubicacion/EquipoUbicacionDetailsModal';
import { EvaluacionModal } from '@/components/taller-r1/evaluaciones/EvaluacionModal';

export default function EquipoUbicacionPage() {
  const params = useParams();
  const site = params?.site as string;
  const [data, setData] = useState<EquipoUbicacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('Todo');
  const [selectedItem, setSelectedItem] = useState<EquipoUbicacion | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [table, setTable] = useState<any>(null);

  // Movilizaciones State
  const [movilizarModalOpen, setMovilizarModalOpen] = useState(false);
  const [itemToMovilizar, setItemToMovilizar] = useState<EquipoUbicacion | null>(null);
  const [historialMovilizaciones, setHistorialMovilizaciones] = useState<MovilizacionHistory[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  // Evaluación State
  const [evalModalOpen, setEvalModalOpen] = useState(false);
  const [evalItem, setEvalItem] = useState<any>(null);

  const TABS = ["Todo", "Retirado", "Ingresado", "Reservado"];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (modalOpen && selectedItem) {
      loadHistorial(selectedItem.id_equipo_ubicacion);
    } else {
      setHistorialMovilizaciones([]);
    }
  }, [modalOpen, selectedItem]);

  const loadHistorial = async (id: string) => {
    try {
      setLoadingHistorial(true);
      const history = await equipoUbicacionApi.getMovilizaciones(id);
      setHistorialMovilizaciones(Array.isArray(history) ? history : []);
    } catch (error) {
      console.error("Error loading historial:", error);
      setHistorialMovilizaciones([]);
    } finally {
      setLoadingHistorial(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await equipoUbicacionApi.getAll();
      setData(res);
    } catch (error) {
      console.error('Error loading equipo ubicaciones', error);
      toast.error('Error al cargar la información');
    } finally {
      setLoading(false);
    }
  };

    const handleGenerateQR = async (item: EquipoUbicacion) => {
    try {
      await generateQRLabel({
        serial: item.serial_equipo || 'SN-UNKNOWN',
        site: site
      });
      toast.success('Etiqueta generada correctamente');
    } catch (error) {
      console.error('Error generating QR:', error);
      toast.error('Error al generar la etiqueta');
    }
  };

  const handleOpenEvaluation = (item: EquipoUbicacion) => {
    setEvalItem({
      id: item.id_detalle || '',
      serial: item.serial_equipo || 'N/A',
      modelo: item.modelo || 'Desconocido',
      tipo: 'equipo',
    });
    setEvalModalOpen(true);
  };

  const filteredData = data.filter(item => {
    const matchesSearch = item.serial_equipo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.modelo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.cliente?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTab = activeTab === 'Todo' || item.estado === activeTab;
    return matchesSearch && matchesTab;
  });

  const ingresadosCount = data.filter(item => item.estado === 'Ingresado').length;
  const retiradosCount = data.filter(item => item.estado === 'Retirado').length;

  const handleExportExcel = () => {
    const exportData = filteredData.map(item => ({
      'Serial': item.serial_equipo,
      'Equipo': item.modelo,
      'Marca': item.marca,
      'Clase': item.clase,
      'Ubicación': item.ubicacion,
      'Sub Ubicación': item.sub_ubicacion,
      'Estado': item.estado,
      'Fecha Ingreso': item.fecha_entrada && item.fecha_entrada !== 'N/D' ? new Date(item.fecha_entrada).toLocaleDateString() : 'N/D',
      'Fecha Salida': item.fecha_salida && item.fecha_salida !== 'N/D' ? new Date(item.fecha_salida).toLocaleDateString() : 'N/D',
      'Cliente': item.cliente,
      'Vendedor': item.unidad_venta,
      'Folio': item.folio
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "EquiposUbicacion");
    XLSX.writeFile(workbook, "Equipos_Ubicacion.xlsx");
  };

  const columns: ColumnDef<EquipoUbicacion>[] = [
    {
      accessorKey: 'serial_equipo',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Serial" />,
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
      header: ({ column }) => <DataTableColumnHeader column={column} title="Ubicación / Sub" />,
      size: 200,
      cell: ({ row }) => (
        <div className="flex flex-col space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
            <MapPin className="w-3.5 h-3.5 text-gray-400" />
            {row.original.ubicacion}
          </div>
          <div>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${row.original.ubicacion_ocupada
              ? 'bg-red-50 text-red-700 border-red-100'
              : 'bg-green-50 text-green-700 border-green-100'
              }`}>
              {row.original.ubicacion_ocupada ? <XCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
              {row.original.sub_ubicacion}
            </span>
          </div>
        </div>
      )
    },
    {
      id: 'fechas',
      accessorKey: 'fecha_entrada',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Fechas" />,
      size: 140,
      cell: ({ row }) => (
        <div className="flex flex-col text-[11px] font-medium text-gray-600 space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-green-600 w-5">IN:</span>
            <span>{row.original.fecha_entrada && row.original.fecha_entrada !== 'N/D' ? new Date(row.original.fecha_entrada).toLocaleDateString() : 'N/D'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-red-600 w-5">OUT:</span>
            <span>{row.original.fecha_salida && row.original.fecha_salida !== 'N/D' ? new Date(row.original.fecha_salida).toLocaleDateString() : '-'}</span>
          </div>
        </div>
      )
    },
    {
      accessorKey: 'cliente',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Datos Comerciales" />,
      size: 220,
      cell: ({ row }) => (
        <div className="flex flex-col space-y-0.5">
          <span className="text-xs font-bold text-gray-800 line-clamp-1" title={row.original.cliente}>{row.original.cliente}</span>
          <span className="text-[10px] font-bold text-red-700 bg-red-50 w-fit px-1.5 py-0.5 rounded border border-red-100 line-clamp-1 mt-1">V: {row.original.unidad_venta}</span>
        </div>
      )
    },
    {
      accessorKey: 'folio',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Folio" />,
      size: 120,
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700 bg-gray-50 border border-gray-200 px-2 py-1 rounded">
          <FileText className="w-3.5 h-3.5 text-gray-400" />
          #{row.original.folio}
        </span>
      )
    },
    {
      id: 'acciones',
      header: 'Acciones',
      size: 100,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {row.original.estado !== 'Retirado' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setItemToMovilizar(row.original);
                setMovilizarModalOpen(true);
              }}
              className="p-2 text-gray-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
              title="Movilizar Equipo"
            >
              <Truck className="w-5 h-5" />
            </button>
          )}
          {row.original.id_detalle && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenEvaluation(row.original);
              }}
              className="p-2 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-200"
              title="Evaluar equipo"
            >
              <ClipboardCheck className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleGenerateQR(row.original);
            }}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
            title="Generar QR"
          >
            <QrCode className="w-5 h-5" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">

      {/* Header Section (Same as Cargue Masivo) */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-black text-gray-900 tracking-tight">
                Locaciones de Inventario
              </h1>
              <p className="text-gray-600 mt-2 font-medium">
                Maestro de ubicaciones y trazabilidad de equipos
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm">
                <div className="flex items-center gap-1.5 border-r border-gray-200 pr-3">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-xs font-bold text-gray-600">IN: {ingresadosCount}</span>
                </div>
                <div className="flex items-center gap-1.5 pl-1 rounded-xl">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <span className="text-xs font-bold text-gray-600">OUT: {retiradosCount}</span>
                </div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                <p className="text-red-800 font-bold text-sm">
                  {filteredData.length} Reg.
                </p>
              </div>
              {table && <DataTableViewOptions table={table} />}
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-bold shadow-sm transition-all border border-green-700/50"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Exportar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-6">

        {/* Filters and Search (Standard View as requested) */}
        <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-center justify-between">
          <div className="flex flex-wrap bg-white rounded-xl shadow-sm border border-gray-100 p-2 gap-1">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex-grow sm:flex-grow-0 text-center ${activeTab === tab
                  ? 'bg-red-50 text-red-600 shadow-sm border border-red-100'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50 border border-transparent'
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 w-full md:max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por serie, modelo o cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all font-medium text-sm text-gray-900"
              />
            </div>
            <QrScannerButton onScan={(value) => setSearchTerm(value)} />
          </div>
        </div>

        {/* Tabla de Datos */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
          <TableList
            isLoading={loading}
            data={filteredData}
            columns={columns}
            hideToolbar={true}
            initialPageSize={50}
            hidePageSizeSelector={true}
            onTableReady={setTable}
            onRowClick={(row) => {
              setSelectedItem(row);
              setModalOpen(true);
            }}
            renderMobileItem={(row) => (
              <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm flex items-center justify-between hover:border-red-200 transition-colors cursor-pointer">
                <div className="flex flex-col">
                  <span className="font-black text-slate-800 text-lg tracking-tight">Serial: {row.serial_equipo}</span>
                  <span className="text-[10px] font-mono font-bold text-slate-400">{row.modelo}</span>
                </div>
                <div className="flex items-center gap-2">
                  {row.estado !== 'Retirado' && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setItemToMovilizar(row);
                          setMovilizarModalOpen(true);
                        }}
                        className="p-2 text-gray-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
                        title="Movilizar Equipo"
                      >
                        <Truck className="w-6 h-6" />
                      </button>
                    </>
                  )}
                  {row.id_detalle && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEvaluation(row);
                      }}
                      className="p-2 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-200"
                      title="Evaluar equipo"
                    >
                      <ClipboardCheck className="w-6 h-6" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGenerateQR(row);
                    }}
                    className="p-2 text-gray-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
                    title="Generar QR"
                  >
                    <QrCode className="w-6 h-6" />
                  </button>
                </div>
              </div>
            )}
            emptyMessage={
              <div className="py-16 text-center">
                <LayoutGrid className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-xl font-bold text-gray-700 mb-2">No hay registros</h3>
                <p className="text-gray-500">No se encontraron equipos ubicados con los filtros actuales.</p>
              </div>
            }
          />
        </div>
      </div>

      {/* Modal de Detalles Estilo "Lista Pura" */}
      <EquipoUbicacionDetailsModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        selectedItem={selectedItem}
        onGenerateQR={handleGenerateQR}
        onMovilizar={(item) => {
            setItemToMovilizar(item);
            setMovilizarModalOpen(true);
        }}
      />

      <MovilizacionModal
        open={movilizarModalOpen}
        onOpenChange={setMovilizarModalOpen}
        equipo={itemToMovilizar}
        onSuccess={loadData}
      />

      <EvaluacionModal
        open={evalModalOpen}
        onClose={() => setEvalModalOpen(false)}
        item={evalItem}
        onSuccess={loadData}
      />
    </div>
  );
}
