'use client';

import { useState } from 'react';
import { QrCode, X } from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { toast } from 'sonner';

interface QrScannerButtonProps {
  onScan: (value: string) => void;
  className?: string;
}

export function QrScannerButton({ onScan, className }: QrScannerButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [scanned, setScanned] = useState(false);

  const handleScan = (result: any[]) => {
    if (scanned || !result || result.length === 0) return;
    const value = result[0].rawValue;
    if (!value) return;

    setScanned(true);
    onScan(value);
    toast.success(`QR escaneado: ${value}`);
    setTimeout(() => {
      setIsOpen(false);
      setScanned(false);
    }, 400);
  };

  const handleClose = () => {
    setIsOpen(false);
    setScanned(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title="Escanear QR"
        className={`flex items-center justify-center p-2 rounded-lg bg-red-50 border border-red-200 text-red-500 hover:bg-red-100 hover:border-red-300 transition-all ${className ?? ''}`}
      >
        <QrCode className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 text-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-white/10">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/20 rounded-2xl flex items-center justify-center border border-red-500/30">
                  <QrCode className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="font-black text-white text-sm uppercase tracking-widest">Escanear QR</h3>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mt-0.5">
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scanner */}
            <div className="px-6 pb-6">
              <div className="w-full aspect-square relative rounded-2xl overflow-hidden border-4 border-white/10 shadow-inner">
                <Scanner
                  onScan={handleScan}
                  onError={() => toast.error('No se pudo acceder a la cámara. Verifica los permisos.')}
                  styles={{ container: { width: '100%', height: '100%' } }}
                  components={{ finder: false }}
                />
                {/* Overlay */}
                <div className="absolute inset-0 border-[3px] border-dashed border-red-500/60 m-6 rounded-xl pointer-events-none" />
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-red-500/70 shadow-[0_0_12px_2px_rgba(239,68,68,0.6)] animate-qr-scan pointer-events-none" />
              </div>
              <p className="text-center text-[10px] font-black text-white/30 uppercase tracking-[0.25em] mt-4">
                Apunta la cámara al código QR
              </p>
            </div>
          </div>

          <style>{`
            @keyframes qr-scan {
              0%   { top: 10%; }
              50%  { top: 90%; }
              100% { top: 10%; }
            }
            .animate-qr-scan {
              animation: qr-scan 2.5s ease-in-out infinite;
              position: absolute;
            }
          `}</style>
        </div>
      )}
    </>
  );
}
