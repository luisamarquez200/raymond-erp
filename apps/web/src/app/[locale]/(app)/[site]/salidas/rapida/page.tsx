'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { salidasApi } from '@/services/taller-r1/salidas.service';
import { clientesApi, Cliente } from '@/services/taller-r1/clientes.service';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Upload, CheckCircle2, AlertCircle, ArrowUpFromLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthTallerStore } from '@/store/auth-taller.store';

interface SalidaRapidaRow {
    id: string;
    folio: string;
    fecha: string;
    cliente: string;
    destino: string;
    remision: string;
    numero_serie: string;
    status: 'pending' | 'success' | 'error';
    errorMsg?: string;
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

export default function SalidasRapidasPage() {
    const tallerUser = useAuthTallerStore(s => s.user);
    const isAdmin = tallerUser?.role && ['Superadmin', 'Admin', 'Administrador'].includes(tallerUser.role);

    if (!isAdmin) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-red-500 font-bold text-lg">Acceso denegado. Solo administradores.</p>
            </div>
        );
    }

    const [rows, setRows] = useState<SalidaRapidaRow[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [loadingClientes, setLoadingClientes] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [folioReady, setFolioReady] = useState(false);
    const folioRef = useRef(0);

    const createRow = (): SalidaRapidaRow => ({
        id: crypto.randomUUID(),
        folio: folioReady ? `S-${String(folioRef.current++).padStart(3, '0')}` : '',
        fecha: new Date().toISOString().split('T')[0],
        cliente: '',
        destino: '',
        remision: '',
        numero_serie: '',
        status: 'pending',
    });

    useEffect(() => {
        clientesApi.getAll()
            .then(d => setClientes(Array.isArray(d) ? d : []))
            .finally(() => setLoadingClientes(false));

        salidasApi.getNextFolio().then(folio => {
            const num = parseInt(folio.replace('S-', ''), 10);
            folioRef.current = isNaN(num) ? 1 : num;
            setFolioReady(true);
        });
    }, []);

    useEffect(() => {
        if (folioReady && rows.length === 0) {
            setRows([createRow()]);
        }
    }, [folioReady]);

    const updateRow = useCallback((id: string, field: keyof SalidaRapidaRow, value: string) => {
        setRows(prev => prev.map(r =>
            r.id === id ? { ...r, [field]: value, status: 'pending', errorMsg: undefined } : r
        ));
    }, []);

    const addRow = () => setRows(prev => [...prev, createRow()]);
    const removeRow = (id: string) => setRows(prev => prev.filter(r => r.id !== id));

    const resolveClienteNombre = (raw: string): string => {
        if (!raw) return '';
        const exact = clientes.find(c => c.nombre_cliente === raw);
        if (exact) return exact.nombre_cliente;
        const partial = clientes.find(c =>
            c.nombre_cliente?.toLowerCase().includes(raw.toLowerCase())
        );
        return partial?.nombre_cliente || raw;
    };

    const pasteFromClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText();
            const lines = text.trim().split('\n').filter(Boolean);
            const parsed: SalidaRapidaRow[] = lines.map(line => {
                const cols = line.split('\t');
                let folio = cols[0]?.trim() || '';
                if (!folio && folioReady) folio = `S-${String(folioRef.current++).padStart(3, '0')}`;
                return {
                    id: crypto.randomUUID(),
                    folio,
                    fecha: normalizeDate(cols[1]?.trim() || ''),
                    cliente: resolveClienteNombre(cols[2]?.trim() || ''),
                    destino: cols[3]?.trim() || '',
                    remision: cols[4]?.trim() || '',
                    numero_serie: cols[5]?.trim() || '',
                    status: 'pending',
                };
            });
            if (parsed.length > 0) {
                setRows(prev => [...prev.filter(r => r.folio || r.numero_serie), ...parsed]);
                toast.success(`${parsed.length} filas pegadas`);
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

            if (!row.numero_serie) {
                setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'error', errorMsg: 'Falta: No. Serie' } : r));
                fail++;
                continue;
            }

            try {
                await salidasApi.createRapida({
                    folio: row.folio || undefined,
                    fecha: row.fecha,
                    cliente: row.cliente || undefined,
                    destino: row.destino || undefined,
                    remision: row.remision || undefined,
                    numero_serie: row.numero_serie,
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
        if (ok > 0) toast.success(`${ok} salida(s) creada(s)`);
        if (fail > 0) toast.error(`${fail} fallaron`);
    };

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
                            <h1 className="text-4xl font-black text-gray-900 tracking-tight">Salidas Rápidas</h1>
                            <p className="text-gray-600 mt-2 font-medium">
                                Da salida a equipos en un solo paso. El equipo se marca como Retirado y la sub-ubicación se libera automáticamente.
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
                    <button onClick={pasteFromClipboard}
                        className="inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest border-2 border-slate-100 transition-all shadow-sm disabled:opacity-50">
                        <Upload className="w-4 h-4" />
                        Pegar desde Excel
                    </button>
                    <button onClick={handleSubmit} disabled={submitting}
                        className="inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all shadow-lg shadow-red-100 border border-red-700/50 disabled:opacity-50">
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpFromLine className="w-4 h-4" />}
                        Procesar todas
                    </button>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 space-y-1.5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">La salida rápida:</p>
                    <p className="text-xs text-amber-700 font-medium">• Crea la salida con estado <strong>Entregado</strong></p>
                    <p className="text-xs text-amber-700 font-medium">• Marca el equipo como <strong>Retirado</strong> en equipo_ubicación</p>
                    <p className="text-xs text-amber-700 font-medium">• <strong>Libera</strong> la sub-ubicación que ocupaba</p>
                    <p className="text-xs text-amber-700 font-medium">• Si no se especifica folio, se genera automáticamente</p>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-3 text-xs text-blue-700 space-y-1">
                    <p className="font-black uppercase tracking-widest text-[10px]">Columnas al pegar desde Excel (en orden):</p>
                    <p className="font-mono font-bold">Folio | Fecha | Cliente | Destino | Remisión | No. Serie</p>
                    <p>El cliente se <strong>resuelve automáticamente</strong> por nombre contra la base de datos.</p>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-3 text-xs text-amber-700 space-y-1">
                    <p className="font-black uppercase tracking-widest text-[10px]">Leyenda</p>
                    <div className="flex gap-4">
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" /> Pendiente</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" /> Creada</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> Error</span>
                    </div>
                </div>

                <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50/40 backdrop-blur-sm border-b border-gray-100">
                                    <th className="h-12 px-4 text-left align-middle font-black text-xs text-gray-400 whitespace-nowrap uppercase tracking-widest w-8">#</th>
                                    <th className="h-12 px-4 text-left align-middle font-black text-xs text-gray-400 whitespace-nowrap uppercase tracking-widest">Folio</th>
                                    <th className="h-12 px-4 text-left align-middle font-black text-xs text-gray-400 whitespace-nowrap uppercase tracking-widest">Fecha</th>
                                    <th className="h-12 px-4 text-left align-middle font-black text-xs text-gray-400 whitespace-nowrap uppercase tracking-widest">Cliente</th>
                                    <th className="h-12 px-4 text-left align-middle font-black text-xs text-gray-400 whitespace-nowrap uppercase tracking-widest">Destino</th>
                                    <th className="h-12 px-4 text-left align-middle font-black text-xs text-gray-400 whitespace-nowrap uppercase tracking-widest">Remisión</th>
                                    <th className="h-12 px-4 text-left align-middle font-black text-xs text-gray-400 whitespace-nowrap uppercase tracking-widest">No. Serie *</th>
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
                                                <input className={inp} value={row.folio} placeholder="S-123"
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
                                                        <option key={c.id_cliente} value={c.nombre_cliente}>
                                                            {c.nombre_cliente}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>

                                            <td className="px-2 py-1.5 min-w-[120px]">
                                                <input className={inp} value={row.destino} placeholder="Ciudad"
                                                    onChange={e => updateRow(row.id, 'destino', e.target.value)} disabled={disabled} />
                                            </td>

                                            <td className="px-2 py-1.5 min-w-[110px]">
                                                <input className={inp} value={row.remision} placeholder="REM-001"
                                                    onChange={e => updateRow(row.id, 'remision', e.target.value)} disabled={disabled} />
                                            </td>

                                            <td className="px-2 py-1.5 min-w-[140px]">
                                                <input className={inp} value={row.numero_serie} placeholder="415-18-57713"
                                                    onChange={e => updateRow(row.id, 'numero_serie', e.target.value)} disabled={disabled} />
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
                                <span className="font-bold">Serie {r.numero_serie || '(vacío)'}:</span> {r.errorMsg}
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
                    <span className="text-xs text-gray-400 font-medium">* No. Serie es el único campo requerido. El folio se genera automáticamente si se deja vacío.</span>
                </div>
            </div>
        </div>
    );
}
