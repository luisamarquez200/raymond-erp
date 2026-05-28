'use client';

import { useState, useEffect, useCallback } from 'react';
import { entradasApi } from '@/services/taller-r1/entradas.service';
import { ubicacionesApi, Ubicacion } from '@/services/taller-r1/ubicaciones.service';
import { clientesApi, Cliente } from '@/services/taller-r1/clientes.service';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type TipoElemento = 'equipo' | 'accesorio';

interface EntradaRapidaRow {
    id: string;
    folio: string;
    fecha: string;
    cliente: string;
    marca: string;
    modelo: string;
    numero_serie: string;
    clase: string;
    ubicacion: string;
    tipo: TipoElemento;
    status: 'pending' | 'success' | 'error';
    errorMsg?: string;
}

const KEYWORDS_ACCESORIO = ['bateria', 'batería', 'cargador', 'mastil', 'mástil', 'horquilla', 'neumatico', 'neumático', 'accesorio'];

function detectTipo(clase: string): TipoElemento {
    const lower = clase.toLowerCase().trim();
    return KEYWORDS_ACCESORIO.some(k => lower.includes(k)) ? 'accesorio' : 'equipo';
}

function normalizeDate(raw: string): string {
    if (!raw) return new Date().toISOString().split('T')[0];
    const s = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
        const [, d, mo, y] = m;
        const year = y.length === 2 ? `20${y}` : y;
        return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return new Date().toISOString().split('T')[0];
}

function newRow(): EntradaRapidaRow {
    return {
        id: crypto.randomUUID(),
        folio: '',
        fecha: new Date().toISOString().split('T')[0],
        cliente: '',
        marca: '',
        modelo: '',
        numero_serie: '',
        clase: '',
        ubicacion: '',
        tipo: 'equipo',
        status: 'pending',
    };
}

export default function EntradasRapidasPage() {
    const [rows, setRows] = useState<EntradaRapidaRow[]>([newRow()]);
    const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [loadingUbic, setLoadingUbic] = useState(true);
    const [loadingClientes, setLoadingClientes] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        ubicacionesApi.getAll()
            .then(d => setUbicaciones(Array.isArray(d) ? d : []))
            .finally(() => setLoadingUbic(false));

        clientesApi.getAll()
            .then(d => setClientes(Array.isArray(d) ? d : []))
            .finally(() => setLoadingClientes(false));
    }, []);

    const updateRow = useCallback((id: string, field: keyof EntradaRapidaRow, value: string) => {
        setRows(prev => prev.map(r => {
            if (r.id !== id) return r;
            const updated: EntradaRapidaRow = { ...r, [field]: value, status: 'pending', errorMsg: undefined };
            if (field === 'clase') updated.tipo = detectTipo(value);
            return updated;
        }));
    }, []);

    const addRow = () => setRows(prev => [...prev, newRow()]);
    const removeRow = (id: string) => setRows(prev => prev.filter(r => r.id !== id));

    const resolveClienteId = (rawNombre: string): string => {
        if (!rawNombre) return '';
        const exact = clientes.find(c => c.nombre_cliente === rawNombre);
        if (exact) return exact.id_cliente;
        const partial = clientes.find(c =>
            c.nombre_cliente?.toLowerCase().includes(rawNombre.toLowerCase()) ||
            rawNombre.toLowerCase().includes(c.nombre_cliente?.toLowerCase() || '')
        );
        return partial?.id_cliente || '';
    };

    const resolveUbicacion = (raw: string): string | null => {
        if (!raw) return null;
        const byId = ubicaciones.find(u => u.id_ubicacion === raw);
        if (byId) return byId.id_ubicacion;
        const byName = ubicaciones.find(u => u.nombre_ubicacion.toLowerCase() === raw.toLowerCase());
        return byName?.id_ubicacion || null;
    };

    const pasteFromClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText();
            const lines = text.trim().split('\n').filter(Boolean);
            const parsed: EntradaRapidaRow[] = lines.map(line => {
                const cols = line.split('\t');
                const clase = cols[6]?.trim() || '';
                const clienteNombre = cols[2]?.trim() || '';
                const clienteResolved = resolveClienteId(clienteNombre) || clienteNombre;
                return {
                    id: crypto.randomUUID(),
                    folio: cols[0]?.trim() || '',
                    fecha: normalizeDate(cols[1]?.trim() || ''),
                    cliente: clienteResolved,
                    marca: cols[3]?.trim() || '',
                    modelo: cols[4]?.trim() || '',
                    numero_serie: cols[5]?.trim() || '',
                    clase,
                    ubicacion: resolveUbicacion(cols[7]?.trim() || '') || '',
                    tipo: detectTipo(clase),
                    status: 'pending',
                };
            });
            if (parsed.length > 0) {
                setRows(prev => [...prev.filter(r => r.folio || r.numero_serie), ...parsed]);
                const acc = parsed.filter(p => p.tipo === 'accesorio').length;
                toast.success(`${parsed.length} filas pegadas — ${parsed.length - acc} equipos, ${acc} accesorios`);
            }
        } catch {
            toast.error('No se pudo leer el portapapeles.');
        }
    };

    const handleSubmit = async () => {
        const pending = rows.filter(r => r.status !== 'success');
        if (pending.length === 0) { toast.info('Todas las filas ya fueron procesadas.'); return; }

        setSubmitting(true);
        let ok = 0, fail = 0;

        for (const row of rows) {
            if (row.status === 'success') continue;

            if (!row.folio || !row.numero_serie || !row.ubicacion) {
                const missing = [!row.folio && 'Folio', !row.numero_serie && 'No. Serie', !row.ubicacion && 'Ubicación'].filter(Boolean).join(', ');
                setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'error', errorMsg: `Falta: ${missing}` } : r));
                fail++;
                continue;
            }

            const id_ubicacion = resolveUbicacion(row.ubicacion) || row.ubicacion;
            const clienteObj = clientes.find(c => c.id_cliente === row.cliente);
            const clienteParaBackend = clienteObj ? clienteObj.nombre_cliente : row.cliente;

            try {
                await entradasApi.createRapida({
                    folio: row.folio,
                    fecha: row.fecha,
                    cliente: clienteParaBackend || undefined,
                    marca: row.marca || undefined,
                    modelo: row.modelo || undefined,
                    numero_serie: row.numero_serie,
                    clase: row.clase || undefined,
                    ubicacion: id_ubicacion,
                    tipo: row.tipo,
                });
                setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'success' } : r));
                ok++;
            } catch (err: any) {
                const msg = err?.response?.data?.message || err?.message || 'Error desconocido';
                setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'error', errorMsg: msg } : r));
                fail++;
            }
        }

        setSubmitting(false);
        if (ok > 0) toast.success(`✅ ${ok} entrada(s) creada(s)`);
        if (fail > 0) toast.error(`❌ ${fail} fallaron`);
    };

    const loading = loadingUbic || loadingClientes;

    const statCounts = {
        total: rows.length,
        pendientes: rows.filter(r => r.status === 'pending').length,
        creadas: rows.filter(r => r.status === 'success').length,
        errores: rows.filter(r => r.status === 'error').length,
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
            <div className="bg-white border-b border-gray-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em]">RAYMOND</span>
                            <h1 className="text-4xl font-black text-gray-900 tracking-tight">Entradas Rápidas</h1>
                            <p className="text-gray-600 mt-2 font-medium">
                                Crea entrada + detalle + producto ubicación en un solo paso. Cliente y ubicación se resuelven automáticamente.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm">
                                <div className="flex items-center gap-1.5 border-r border-gray-200 pr-3">
                                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                                    <span className="text-xs font-bold text-gray-600">{statCounts.pendientes} pend.</span>
                                </div>
                                <div className="flex items-center gap-1.5 border-r border-gray-200 pr-3">
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                    <span className="text-xs font-bold text-gray-600">{statCounts.creadas} ok</span>
                                </div>
                                <div className="flex items-center gap-1.5 pl-1">
                                    <div className="w-2 h-2 rounded-full bg-red-500" />
                                    <span className="text-xs font-bold text-gray-600">{statCounts.errores} err</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-8 py-6 space-y-6">
                <div className="flex items-center justify-between">
                    <button onClick={pasteFromClipboard} disabled={loading}
                        className="inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest border-2 border-slate-100 transition-all shadow-sm disabled:opacity-50">
                        <Upload className="w-4 h-4" />
                        Pegar desde Excel
                    </button>
                    <button onClick={handleSubmit} disabled={submitting || loading}
                        className="inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all shadow-lg shadow-green-100 border border-green-700/50 disabled:opacity-50">
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Procesar todas
                    </button>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 text-xs text-blue-700 space-y-1.5">
                    <p className="font-black uppercase tracking-widest text-[10px]">Columnas al pegar desde Excel (en orden):</p>
                    <p className="font-mono font-bold">Folio | Fecha | Cliente | Marca | Modelo | No.Serie | Clase | Ubicación</p>
                    <p>El cliente y la ubicación se <strong>resuelven automáticamente</strong> contra la base de datos. El tipo Equipo/Accesorio se detecta por la clase.</p>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-3 text-xs text-amber-700 space-y-1">
                    <p className="font-black uppercase tracking-widest text-[10px]">Leyenda</p>
                    <div className="flex gap-4">
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" /> Pendiente</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" /> Creada</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> Error</span>
                    </div>
                </div>

                {loading && (
                    <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                        <Loader2 className="w-4 h-4 animate-spin" /> Cargando catálogos...
                    </div>
                )}

                <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50/40 backdrop-blur-sm border-b border-gray-100">
                                    <th className="h-12 px-4 text-left align-middle font-black text-xs text-gray-400 whitespace-nowrap uppercase tracking-widest w-8">#</th>
                                    <th className="h-12 px-4 text-left align-middle font-black text-xs text-gray-400 whitespace-nowrap uppercase tracking-widest">Folio *</th>
                                    <th className="h-12 px-4 text-left align-middle font-black text-xs text-gray-400 whitespace-nowrap uppercase tracking-widest">Fecha</th>
                                    <th className="h-12 px-4 text-left align-middle font-black text-xs text-gray-400 whitespace-nowrap uppercase tracking-widest">Cliente</th>
                                    <th className="h-12 px-4 text-left align-middle font-black text-xs text-gray-400 whitespace-nowrap uppercase tracking-widest">Marca</th>
                                    <th className="h-12 px-4 text-left align-middle font-black text-xs text-gray-400 whitespace-nowrap uppercase tracking-widest">Modelo</th>
                                    <th className="h-12 px-4 text-left align-middle font-black text-xs text-gray-400 whitespace-nowrap uppercase tracking-widest">No. Serie *</th>
                                    <th className="h-12 px-4 text-left align-middle font-black text-xs text-gray-400 whitespace-nowrap uppercase tracking-widest">Clase</th>
                                    <th className="h-12 px-4 text-left align-middle font-black text-xs text-gray-400 whitespace-nowrap uppercase tracking-widest">Tipo</th>
                                    <th className="h-12 px-4 text-left align-middle font-black text-xs text-gray-400 whitespace-nowrap uppercase tracking-widest">Ubicación *</th>
                                    <th className="h-12 px-4 w-8"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, idx) => {
                                    const bg = row.status === 'success' ? 'bg-green-50'
                                        : row.status === 'error' ? 'bg-red-50'
                                            : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/20';
                                    const inp = "border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500/20 w-full bg-white transition-all";
                                    const disabled = row.status === 'success';
                                    return (
                                        <tr key={row.id} className={cn(bg, "border-b border-gray-50/30 transition-all hover:bg-gray-50/50 group")}>
                                            <td className="px-4 py-2.5 align-middle text-sm whitespace-nowrap text-center">
                                                {row.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />}
                                                {row.status === 'error' && <span title={row.errorMsg}><AlertCircle className="w-4 h-4 text-red-500 mx-auto cursor-help" /></span>}
                                                {row.status === 'pending' && <span className="text-gray-400 font-black text-xs">{idx + 1}</span>}
                                            </td>
                                            <td className="px-2 py-1.5 min-w-[90px]">
                                                <input className={inp} value={row.folio} placeholder="E-66"
                                                    onChange={e => updateRow(row.id, 'folio', e.target.value)} disabled={disabled} />
                                            </td>
                                            <td className="px-2 py-1.5 min-w-[130px]">
                                                <input type="date" className={inp} value={row.fecha}
                                                    onChange={e => updateRow(row.id, 'fecha', e.target.value)} disabled={disabled} />
                                            </td>
                                            <td className="px-2 py-1.5 min-w-[160px]">
                                                <select className={cn(inp, "bg-white")} value={row.cliente}
                                                    onChange={e => updateRow(row.id, 'cliente', e.target.value)} disabled={disabled || loadingClientes}>
                                                    <option value="">Sin cliente</option>
                                                    {clientes.map(c => (
                                                        <option key={c.id_cliente} value={c.id_cliente}>
                                                            {c.nombre_cliente}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-2 py-1.5 min-w-[90px]">
                                                <input className={inp} value={row.marca} placeholder="Raymond"
                                                    onChange={e => updateRow(row.id, 'marca', e.target.value)} disabled={disabled} />
                                            </td>
                                            <td className="px-2 py-1.5 min-w-[90px]">
                                                <input className={inp} value={row.modelo} placeholder="4150"
                                                    onChange={e => updateRow(row.id, 'modelo', e.target.value)} disabled={disabled} />
                                            </td>
                                            <td className="px-2 py-1.5 min-w-[140px]">
                                                <input className={inp} value={row.numero_serie} placeholder="415-18-57713"
                                                    onChange={e => updateRow(row.id, 'numero_serie', e.target.value)} disabled={disabled} />
                                            </td>
                                            <td className="px-2 py-1.5 min-w-[110px]">
                                                <input className={inp} value={row.clase} placeholder="Clase I / Bateria"
                                                    onChange={e => updateRow(row.id, 'clase', e.target.value)} disabled={disabled} />
                                            </td>
                                            <td className="px-2 py-1.5 min-w-[100px]">
                                                <select className={cn(inp, "bg-white font-bold", row.tipo === 'accesorio' ? 'text-amber-700 border-amber-300' : 'text-slate-700')}
                                                    value={row.tipo} onChange={e => updateRow(row.id, 'tipo', e.target.value)} disabled={disabled}>
                                                    <option value="equipo">Equipo</option>
                                                    <option value="accesorio">Accesorio</option>
                                                </select>
                                            </td>
                                            <td className="px-2 py-1.5 min-w-[150px]">
                                                <select className={cn(inp, "bg-white")} value={row.ubicacion}
                                                    onChange={e => updateRow(row.id, 'ubicacion', e.target.value)} disabled={disabled || loadingUbic}>
                                                    <option value="">Seleccionar...</option>
                                                    {ubicaciones.map(u => (
                                                        <option key={u.id_ubicacion} value={u.id_ubicacion}>
                                                            {u.nombre_ubicacion}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-2 py-1.5">
                                                {!disabled && (
                                                    <button onClick={() => removeRow(row.id)} disabled={rows.length === 1}
                                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-100 opacity-0 group-hover:opacity-100" title="Eliminar fila">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {rows.some(r => r.status === 'error') && (
                    <div className="space-y-1.5 bg-red-50 border border-red-100 rounded-2xl p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-red-700">Errores</p>
                        {rows.filter(r => r.status === 'error').map(r => (
                            <p key={r.id} className="text-xs text-red-700 flex items-start gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                <span className="font-bold">Folio {r.folio || '(vacío)'}:</span> {r.errorMsg}
                            </p>
                        ))}
                    </div>
                )}

                <div className="flex items-center gap-3">
                    <button onClick={addRow}
                        className="inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest border-2 border-slate-100 transition-all shadow-sm">
                        <Plus className="w-4 h-4" />
                        Agregar fila
                    </button>
                    <span className="text-xs text-gray-400 font-medium">* Campos requeridos. Al pegar desde Excel, el cliente y la ubicación se auto-mapean por nombre.</span>
                </div>
            </div>
        </div>
    );
}
