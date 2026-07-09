'use client';

import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Loader2, QrCode, Search, X, Camera,
  Package, MapPin, Wrench, FileSpreadsheet,
  CheckCircle2, Hash, Tag, Clock, Layers,
  FileText, ArrowRightLeft, Smartphone, ImageIcon, Monitor
} from 'lucide-react';
import api from '@/lib/api';

interface SearchResult {
  found: boolean;
  type?: 'equipo' | 'ubicacion' | 'accesorio' | 'cargue_masivo';
  data?: Record<string, any>;
}

const TYPE_CONFIG: Record<string, {
  label: string;
  gradient: string;
  softBg: string;
  softText: string;
  border: string;
  icon: React.ReactNode;
}> = {
  equipo: {
    label: 'Equipo', gradient: 'from-blue-600 to-blue-700',
    softBg: 'bg-blue-50', softText: 'text-blue-700', border: 'border-blue-200',
    icon: <Package className="w-6 h-6" />,
  },
  ubicacion: {
    label: 'Ubicación', gradient: 'from-emerald-600 to-emerald-700',
    softBg: 'bg-emerald-50', softText: 'text-emerald-700', border: 'border-emerald-200',
    icon: <MapPin className="w-6 h-6" />,
  },
  accesorio: {
    label: 'Accesorio', gradient: 'from-violet-600 to-violet-700',
    softBg: 'bg-violet-50', softText: 'text-violet-700', border: 'border-violet-200',
    icon: <Wrench className="w-6 h-6" />,
  },
  cargue_masivo: {
    label: 'Cargue Masivo', gradient: 'from-red-600 to-red-700',
    softBg: 'bg-red-50', softText: 'text-red-700', border: 'border-red-200',
    icon: <FileSpreadsheet className="w-6 h-6" />,
  },
};

function formatLabel(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(key: string, value: any): string {
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (key.includes('fecha') || key.includes('date')) {
    try {
      return new Date(value).toLocaleDateString('es-MX', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch { return String(value); }
  }
  return String(value);
}

function FieldIcon({ fieldKey }: { fieldKey: string }) {
  if (fieldKey.includes('serial') || fieldKey.includes('id')) return <Hash className="w-3.5 h-3.5" />;
  if (fieldKey.includes('fecha') || fieldKey.includes('date')) return <Clock className="w-3.5 h-3.5" />;
  if (fieldKey.includes('tipo') || fieldKey.includes('clase')) return <Tag className="w-3.5 h-3.5" />;
  if (fieldKey.includes('modelo')) return <Layers className="w-3.5 h-3.5" />;
  if (fieldKey.includes('rack') || fieldKey.includes('ubicacion')) return <MapPin className="w-3.5 h-3.5" />;
  if (fieldKey.includes('entrada') || fieldKey.includes('estado')) return <ArrowRightLeft className="w-3.5 h-3.5" />;
  return <FileText className="w-3.5 h-3.5" />;
}

export default function DashboardR1() {
  const [isSearching, setIsSearching] = useState(false);
  const [resultData, setResultData] = useState<SearchResult | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [scannerStarted, setScannerStarted] = useState(false);
  const [scannerTab, setScannerTab] = useState<'camera' | 'file'>('camera');
  const isHandlingRef = useRef(false);
  const scannerRef = useRef<any>(null);

  const handleSearch = async (term: string) => {
    const q = term.trim();
    if (!q) return;
    try {
      setIsSearching(true);
      const res = await api.get(`/taller-r1/search?q=${encodeURIComponent(q)}`);
      const result: SearchResult = res.data?.data || res.data;
      if (result?.found) {
        setResultData(result);
        setIsModalOpen(true);
      } else {
        toast.error(`Sin resultados para: "${q}"`);
      }
    } catch {
      toast.error('Error de conexión al buscar.');
    } finally {
      setIsSearching(false);
    }
  };

  const onScanSuccess = (decodedText: string) => {
    if (isHandlingRef.current) return;
    isHandlingRef.current = true;
    setLastScanned(decodedText);
    toast.success(`QR leído: ${decodedText}`);
    handleSearch(decodedText).finally(() => {
      setTimeout(() => { isHandlingRef.current = false; }, 3000);
    });
  };

  const videoRef = useRef<HTMLDivElement>(null);
  const qrReaderRef = useRef<any>(null);

  const startCamera = async () => {
    try {
      // First set scannerStarted so the div renders, then initialize
      setScannerStarted(true);
    } catch (e) {
      console.error('[camera]', e);
      toast.error('Error al activar la cámara.');
    }
  };

  // When scannerStarted becomes true, the div is now in DOM — initialize scanner
  useEffect(() => {
    if (!scannerStarted) return;
    let qrReader: any = null;

    const init = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        qrReader = new Html5Qrcode('qr-reader-camera');
        qrReaderRef.current = qrReader;

        // Get available cameras and pick back-facing if available
        const devices = await Html5Qrcode.getCameras();
        if (!devices || devices.length === 0) {
          toast.error('No se encontró ninguna cámara en este dispositivo.');
          setScannerStarted(false);
          return;
        }
        // prefer rear camera or last one
        const backCamera = devices.find((d: any) =>
          /back|rear|environment|trasera/i.test(d.label)
        ) || devices[devices.length - 1];

        await qrReader.start(
          backCamera.id,
          { fps: 10, qrbox: { width: 230, height: 230 } },
          onScanSuccess,
          () => {} // ignore frame errors
        );
      } catch (e: any) {
        console.error('[camera init]', e);
        if (String(e).includes('Permission') || String(e).includes('NotAllowed')) {
          toast.error('Permiso de cámara denegado. Ve a Configuración del navegador y permite el acceso.');
        } else {
          toast.error(`Error de cámara: ${e?.message || e}`);
        }
        setScannerStarted(false);
      }
    };

    // Small delay to ensure div is painted
    const timer = setTimeout(init, 100);
    return () => {
      clearTimeout(timer);
      qrReader?.stop().catch(() => {});
    };
  }, [scannerStarted]);

  const stopCamera = async () => {
    try {
      await qrReaderRef.current?.stop();
      qrReaderRef.current = null;
    } catch {}
    setScannerStarted(false);
  };

  const handleFileQr = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const reader = new Html5Qrcode('qr-file-reader');
      const result = await reader.scanFile(file, true);
      setLastScanned(result);
      await handleSearch(result);
      await reader.clear();
    } catch {
      toast.error('No se pudo leer el QR de la imagen. Intenta con otra foto.');
    }
    e.target.value = '';
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      qrReaderRef.current?.stop().catch(() => {});
    };
  }, []);

  const closeModal = () => { setIsModalOpen(false); setResultData(null); };
  const typeInfo = resultData?.type ? TYPE_CONFIG[resultData.type] : null;

  // Filtrar campos técnicos y organizar por secciones
  const data = resultData?.data || {};
  const EXCLUDED_KEYS = [
    'id_detalles', 'id_entrada', 'id_equipo', 'id_sub_ubicacion', 'id_ubicacion',
    'id_accesorio', 'id_equipo_ubicacion', 'id_solicitud', 'pdf', 'evidencia',
    'comentario', 'QR_Link', 'status_totvs', 'semanas_renovacion', 'stock',
    'usuario_entrada', 'usuario_salida', 'vendedor'
  ];

  const getSections = () => {
    if (!resultData?.data) return [];
    
    const general = [];
    const ubicacion = [];
    const almacen = [];

    const entries = Object.entries(data).filter(([k, v]) => 
      !EXCLUDED_KEYS.some(ex => k.startsWith(ex)) && 
      v !== null && v !== undefined && v !== '' && typeof v !== 'object'
    );

    for (const [key, value] of entries) {
      if (key.includes('ubicacion') || key.includes('rack')) {
        ubicacion.push({ key, value });
      } else if (key.includes('fecha') || key.includes('tiempo') || key.includes('permanencia')) {
        almacen.push({ key, value });
      } else {
        general.push({ key, value });
      }
    }

    const visibleEntries = Object.entries(data).filter(([k, v]) => 
      !EXCLUDED_KEYS.some(ex => k.startsWith(ex)) && 
      v !== null && v !== undefined && v !== '' && typeof v !== 'object'
    );

    return [
      { id: 'general', title: 'Información General', items: general, icon: <Package className="w-4 h-4" /> },
      { id: 'ubicacion', title: 'Ubicación y Logística', items: ubicacion, icon: <MapPin className="w-4 h-4" /> },
      { id: 'almacen', title: 'Almacén y Tiempo', items: almacen, icon: <Clock className="w-4 h-4" /> },
    ].filter(s => s.items.length > 0);
  };

  const sections = getSections();
  const dataForFallback = resultData?.data || {};
  const visibleEntriesFallback = Object.entries(dataForFallback).filter(([k, v]) => 
     !EXCLUDED_KEYS.some(ex => k.startsWith(ex)) && 
     v !== null && v !== undefined && v !== '' && typeof v !== 'object'
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="mx-auto px-4 md:px-8 py-6 max-w-5xl w-full flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">Dashboard Central</h1>
            <p className="text-gray-500 mt-1 text-sm font-medium">
              Busca seriales manualmente o escanea un QR para obtener datos al instante.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-5 py-3">
            <QrCode className="w-5 h-5 text-red-600" />
            <span className="text-red-700 font-bold text-sm">Scanner QR</span>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-5xl w-full mx-auto px-4 md:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* LEFT: Search + Tips */}
          <div className="space-y-5">
            {/* Search */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 transition-all hover:shadow-md">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                  <Search className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 className="font-black text-gray-900 uppercase tracking-wide text-sm">Búsqueda Manual</h2>
                  <p className="text-xs text-gray-500">Número de serie o Folio</p>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchInput)}
                  placeholder="Ej: RXI005..."
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400 text-sm font-medium transition-all"
                />
                <button
                  onClick={() => handleSearch(searchInput)}
                  disabled={isSearching || !searchInput.trim()}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white px-5 py-3 rounded-xl flex items-center gap-2 font-bold transition-all shadow-md hover:shadow-lg active:scale-95"
                >
                  {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Help Cards */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-xs font-black text-gray-400 mb-4 uppercase tracking-widest">Guía de Uso</h3>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { icon: <Monitor className="text-blue-600" />, bg: 'bg-blue-50', border: 'border-blue-100', title: 'PC / Laptop', desc: 'Permite el acceso a la cámara frontal.' },
                  { icon: <Smartphone className="text-violet-600" />, bg: 'bg-violet-50', border: 'border-violet-100', title: 'Dispositivo Móvil', desc: 'Usa la cámara trasera automáticamente.' },
                  { icon: <ImageIcon className="text-amber-600" />, bg: 'bg-amber-50', border: 'border-amber-100', title: 'Cargue de Imagen', desc: 'Selecciona una foto clara del código QR.' }
                ].map((item, i) => (
                  <div key={i} className={`flex items-start gap-3 p-3 ${item.bg} rounded-xl border ${item.border}`}>
                    <div className="mt-0.5">{item.icon}</div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">{item.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Last scanned */}
            {lastScanned && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-left-4">
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-emerald-600 font-bold uppercase tracking-wide">Último QR escaneado</p>
                  <p className="text-sm font-black text-emerald-800">{lastScanned}</p>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: QR Scanner */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setScannerTab('camera')}
                className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-bold transition-all ${
                  scannerTab === 'camera'
                    ? 'text-red-600 border-b-2 border-red-600 bg-red-50/30'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Camera className="w-4 h-4" /> Cámara
              </button>
              <button
                onClick={() => { setScannerTab('file'); stopCamera(); }}
                className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-bold transition-all ${
                  scannerTab === 'file'
                    ? 'text-red-600 border-b-2 border-red-600 bg-red-50/30'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
              >
                <ImageIcon className="w-4 h-4" /> Imagen
              </button>
            </div>

            <div className="flex-1 p-6 flex flex-col">
              {scannerTab === 'camera' ? (
                <div className="flex flex-col h-full">
                  <div
                    id="qr-reader-camera"
                    className={`w-full rounded-2xl overflow-hidden border-4 border-gray-50 shadow-inner ${scannerStarted ? 'block' : 'hidden'}`}
                  />
                  {!scannerStarted && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 py-10">
                      <div className="relative">
                        <div className="absolute inset-0 bg-red-400/20 blur-2xl rounded-full scale-150 animate-pulse" />
                        <div className="relative w-24 h-24 bg-gray-50 rounded-[2rem] flex items-center justify-center border border-gray-200 shadow-sm">
                          <Camera className="w-12 h-12 text-gray-300" />
                        </div>
                      </div>
                      <div className="max-w-[240px]">
                        <p className="text-gray-900 font-black">Activa el Scanner</p>
                        <p className="text-gray-500 text-xs mt-1.5 leading-relaxed">Necesitamos permiso para usar la cámara de este dispositivo.</p>
                      </div>
                      <button
                        onClick={startCamera}
                        className="px-10 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black shadow-lg shadow-red-200 transition-all hover:-translate-y-1 active:scale-95"
                      >
                        Iniciar Escaneo
                      </button>
                    </div>
                  )}
                  {scannerStarted && (
                    <button onClick={stopCamera} className="mt-4 text-xs font-bold text-gray-400 hover:text-red-600 transition-colors uppercase tracking-widest flex items-center justify-center gap-2">
                      <X className="w-3 h-3" /> Detener Cámara
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 py-10">
                  <div className="w-24 h-24 bg-amber-50 rounded-[2rem] flex items-center justify-center border border-amber-100 shadow-sm">
                    <ImageIcon className="w-12 h-12 text-amber-500" />
                  </div>
                  <div className="max-w-[240px]">
                    <p className="text-gray-900 font-black text-lg">Subir Imagen</p>
                    <p className="text-gray-500 text-xs mt-1 leading-relaxed">Sube una fotografía nítida del código QR para procesarla.</p>
                  </div>
                  <label className="cursor-pointer">
                    <div className="px-10 py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black shadow-lg shadow-amber-200 transition-all hover:-translate-y-1 active:scale-95">
                      Elegir Archivo
                    </div>
                    <input type="file" accept="image/*" onChange={handleFileQr} className="hidden" />
                  </label>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── MODAL RESULTADO REDISEÑADO ── */}
      {isModalOpen && resultData?.data && typeInfo && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 bg-black/60 backdrop-blur-md"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200" style={{ maxHeight: '90vh' }}>
            {/* Header Stylized */}
            <div className={`bg-gradient-to-br ${typeInfo.gradient} p-8 relative overflow-hidden`}>
              {/* Background Decoration */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-black/10 rounded-full blur-2xl" />
              
              <div className="relative flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-md border border-white/30 rounded-3xl flex items-center justify-center text-white shadow-xl">
                    {typeInfo.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                       <span className="w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
                       <p className="text-white/80 text-[10px] font-black uppercase tracking-[0.2em]">Registro Validado</p>
                    </div>
                    <h3 className="text-white text-3xl font-black tracking-tighter mt-1">{typeInfo.label}</h3>
                  </div>
                </div>
                <button 
                  onClick={closeModal} 
                  className="w-11 h-11 bg-black/10 hover:bg-black/20 text-white rounded-2xl flex items-center justify-center transition-all hover:rotate-90"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Serial Batch */}
              {resultData.data.serial && (
                <div className="mt-6 flex items-center gap-3">
                  <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-2xl text-gray-900 shadow-lg">
                    <Hash className="w-4 h-4 text-gray-400" />
                    <span className="font-black text-sm tracking-widest">{resultData.data.serial}</span>
                  </div>
                  {resultData.data.estado && (
                    <div className="bg-white/20 backdrop-blur-md border border-white/30 px-4 py-2 rounded-2xl text-white font-bold text-sm">
                      {resultData.data.estado}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Enriched Content Area */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              {sections.map((section) => (
                <div key={section.id} className="space-y-4">
                  <div className="flex items-center gap-2 px-2">
                    <div className={`p-2 rounded-lg bg-gray-50 text-gray-400`}>
                      {section.icon}
                    </div>
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">{section.title}</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {section.items.map(({ key, value }) => (
                      <div 
                        key={key} 
                        className="group flex flex-col p-4 bg-gray-50/50 hover:bg-white rounded-[1.25rem] border border-transparent hover:border-gray-100 hover:shadow-sm transition-all"
                      >
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1 px-1">
                          {formatLabel(key)}
                        </span>
                        <span className="text-sm font-bold text-gray-900 px-1 truncate">
                          {formatValue(key, value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* If no sections but have data, show vanilla list (fallback) */}
              {sections.length === 0 && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                   {visibleEntriesFallback.map(([key, value]: [string, any]) => (
                      <div key={key} className="p-3 bg-gray-50 rounded-xl flex justify-between gap-4">
                        <span className="text-[10px] uppercase font-black text-gray-400 leading-none">{formatLabel(key)}</span>
                        <span className="text-xs font-bold text-gray-900 text-right">{formatValue(key, value)}</span>
                      </div>
                   ))}
                 </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-8 pt-0 flex gap-3">
              <button 
                onClick={closeModal} 
                className="flex-1 py-4 bg-gray-900 hover:bg-black text-white rounded-[1.5rem] font-black tracking-wide shadow-xl shadow-gray-200 transition-all hover:-translate-y-1 active:scale-[0.98]"
              >
                Cerrar Consulta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
