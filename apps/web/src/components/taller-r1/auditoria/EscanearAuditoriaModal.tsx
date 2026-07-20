'use client';

import { useState } from 'react';
import { X, QrCode, Search, CheckCircle2, AlertTriangle, AlertCircle, History } from 'lucide-react';
import { toast } from 'sonner';
import { auditoriaApi } from '@/services/taller-r1/auditoria.service';
import { useAuthTallerStore } from '@/store/auth-taller.store';
import { cn } from '@/lib/utils';
import { Scanner } from '@yudiel/react-qr-scanner';

interface EscanearAuditoriaModalProps {
    isOpen: boolean;
    idAuditoria: string | null;
    onClose: () => void;
}

interface ScanLog {
    serial: string;
    status: 'success' | 'warning' | 'error';
    message: string;
    details?: string;
    tipo?: string | null;
    timestamp: Date;
}

export default function EscanearAuditoriaModal({ isOpen, idAuditoria, onClose }: EscanearAuditoriaModalProps) {
    const selectedSite = useAuthTallerStore(state => state.selectedSite);
    const [manualSerial, setManualSerial] = useState('');
    const [loading, setLoading] = useState(false);
    const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);

    if (!isOpen || !idAuditoria) return null;

    const handleScan = async (serial: string) => {
        if (!selectedSite || !idAuditoria || !serial) return;
        
        // Prevent double scanning locally to save API calls
        if (scanLogs.some(log => log.serial.toLowerCase() === serial.toLowerCase())) {
            toast.warning(`El serial ${serial} ya fue escaneado en esta auditoría.`);
            return;
        }

        setLoading(true);
        try {
            const res = await auditoriaApi.scanEquipo(selectedSite, idAuditoria, serial);
            
            let status: 'success' | 'warning' | 'error' = 'success';
            if (res.status === 'NOT_FOUND') status = 'error';
            if (res.status === 'INVALID_STATE') status = 'warning';

            const newLog: ScanLog = {
                serial: res.serial,
                status: status,
                message: res.message,
                details: res.itemInfo ? `${res.itemInfo.modelo} - ${res.itemInfo.ubicacion}` : undefined,
                tipo: res.tipo_item,
                timestamp: new Date()
            };

            setScanLogs(prev => [newLog, ...prev]);

            if (status === 'success') {
                const tipoLabel = res.tipo_item === 'accesorio' ? 'Accesorio' : 'Equipo';
                toast.success(`${tipoLabel} ${res.serial} agregado a la auditoría`);
            }
            else if (status === 'warning') toast.warning(`Estado inusual para ${res.serial}`);
            else toast.error(`Serial ${res.serial} no encontrado`);

        } catch (error: any) {
            console.error('Error scanning:', error);
            const errMsg = error?.response?.data?.message || 'Error al procesar el código';
            
            // Add a log for the error
            if (error?.response?.status === 400 && errMsg.includes('ya fue escaneado')) {
                 toast.info(`El equipo ${serial} ya fue contabilizado en esta auditoría.`);
                 setScanLogs(prev => [{
                    serial: serial,
                    status: 'warning',
                    message: 'Ya escaneado en esta auditoría',
                    timestamp: new Date()
                }, ...prev]);
            } else {
                 toast.error(errMsg);
            }
        } finally {
            setLoading(false);
            setManualSerial('');
        }
    };

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (manualSerial.trim()) {
            handleScan(manualSerial.trim());
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-[110] p-4">
            <div className="bg-white w-full max-w-5xl h-full max-h-[90vh] rounded-[3rem] shadow-2xl flex border border-white/20 overflow-hidden relative">
                
                {/* Left Side: Scanner */}
                <div className="flex-1 bg-slate-900 text-white relative flex flex-col p-8 md:p-12 border-r border-white/10">
                    <button
                        onClick={onClose}
                        className="absolute top-6 left-6 p-4 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl transition-all z-20 text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    <div className="text-center mt-6 mb-8 flex-shrink-0 z-10">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/20 rounded-3xl mb-4 border border-red-500/30">
                            <QrCode className="w-8 h-8 text-red-400" />
                        </div>
                        <h2 className="text-3xl font-black uppercase tracking-tight">Escáner Activo</h2>
                        <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em] mt-2">Equipos y Accesorios</p>
                    </div>

                    <div className="flex-1 flex flex-col justify-center items-center max-w-sm mx-auto w-full z-10">
                        <div className="w-full aspect-square relative rounded-[3rem] overflow-hidden border-8 border-white/5 shadow-2xl">
                            <Scanner
                                onScan={(result: any[]) => {
                                    if (!loading && result && result.length > 0) {
                                        handleScan(result[0].rawValue);
                                    }
                                }}
                                onError={() => toast.error('Confirma los permisos de cámara')}
                                styles={{ container: { width: '100%', height: '100%' } }}
                                components={{ finder: false }}
                            />
                            {/* Scanning overlay UI */}
                            <div className="absolute inset-0 border-[3px] border-dashed border-red-500/50 m-8 rounded-[2rem] pointer-events-none" />
                            <div className="absolute top-1/2 left-0 w-full h-1 bg-red-500 shadow-[0_0_20px_bg-red-500] animate-scan pointer-events-none" />
                        </div>

                        {/* Manual Entry */}
                        <div className="w-full mt-10">
                            <div className="flex items-center justify-between mb-3 px-2">
                                <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Ingreso Manual</span>
                            </div>
                            <form onSubmit={handleManualSubmit} className="relative group">
                                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 group-focus-within:text-red-400 transition-colors" />
                                <input
                                    type="text"
                                    value={manualSerial}
                                    onChange={(e) => setManualSerial(e.target.value)}
                                    placeholder="NÚMERO DE SERIE..."
                                    className="w-full pl-16 pr-32 py-5 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-4 focus:ring-red-500/20 focus:bg-white/10 transition-all font-black uppercase text-sm tracking-widest placeholder:text-white/20"
                                />
                                <button
                                    type="submit"
                                    disabled={loading || !manualSerial.trim()}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-white/10 disabled:text-white/30 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                                >
                                    Enviar
                                </button>
                            </form>
                        </div>
                    </div>
                </div>

                {/* Right Side: Log Feed */}
                <div className="flex-1 bg-slate-50 flex flex-col items-stretch max-w-lg hidden md:flex overflow-hidden">
                    <div className="p-8 border-b border-slate-200 bg-white">
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                            <History className="w-5 h-5 text-slate-400" />
                            Bitácora de Escaneo
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                            {scanLogs.length} items registrados en esta sesión
                        </p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 custom-scrollbar space-y-4">
                        {scanLogs.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 opacity-50">
                                <QrCode className="w-16 h-16" />
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-center max-w-[200px]">Aún no hay escaneos en esta sesión</p>
                            </div>
                        ) : (
                            scanLogs.map((log, index) => (
                                <div
                                    key={index}
                                    className={cn(
                                        "p-5 rounded-2xl border bg-white shadow-sm transition-all animate-in slide-in-from-right-8 duration-300",
                                        log.status === 'success' && "border-green-100",
                                        log.status === 'warning' && "border-orange-100 bg-orange-50/30",
                                        log.status === 'error' && "border-red-100"
                                    )}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className={cn(
                                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner",
                                            log.status === 'success' && "bg-green-100 text-green-600",
                                            log.status === 'warning' && "bg-orange-100 text-orange-600",
                                            log.status === 'error' && "bg-red-100 text-red-600"
                                        )}>
                                            {log.status === 'success' && <CheckCircle2 className="w-5 h-5" />}
                                            {log.status === 'warning' && <AlertTriangle className="w-5 h-5" />}
                                            {log.status === 'error' && <AlertCircle className="w-5 h-5" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <h4 className="font-black text-slate-900 uppercase tracking-widest text-sm truncate">{log.serial}</h4>
                                                    {log.tipo && (
                                                        <span className={cn(
                                                            "px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest shrink-0",
                                                            log.tipo === 'accesorio' ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
                                                        )}>
                                                            {log.tipo === 'accesorio' ? 'ACC' : 'EQUI'}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider shrink-0 ml-2">{log.timestamp.toLocaleTimeString()}</span>
                                            </div>
                                            <p className={cn(
                                                "text-xs font-bold leading-snug mt-1",
                                                log.status === 'success' && "text-green-600",
                                                log.status === 'warning' && "text-orange-600",
                                                log.status === 'error' && "text-red-500"
                                            )}>
                                                {log.message}
                                            </p>
                                            {log.details && (
                                                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 px-2 py-1 bg-slate-50 rounded inline-block">
                                                     {log.details}
                                                 </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
            
            {/* Custom Scan Animation logic */}
            <style>{`
                @keyframes scan {
                    0% { top: 0; }
                    50% { top: 100%; transform: scaleY(-1); }
                    100% { top: 0; transform: scaleY(1); }
                }
                .animate-scan {
                    animation: scan 3s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}
