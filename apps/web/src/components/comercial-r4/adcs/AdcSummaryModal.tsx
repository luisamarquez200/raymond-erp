import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Mail, Clock, Building2, User } from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useConfigStore } from '@/store/config.store';

interface AdcSummaryProps {
  isOpen: boolean;
  onClose: () => void;
  adcName: string;
}

export function AdcSummaryModal({ isOpen, onClose, adcName }: AdcSummaryProps) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const { roleColors } = useConfigStore();
  
  // Assuming this modal is accessed by admin, but we can fallback to default if we want
  const currentColor = roleColors.administrador;

  useEffect(() => {
    if (isOpen && adcName) {
      const fetchSummary = async () => {
        try {
          setLoading(true);
          const res = await api.get(`/r4/adcs/${encodeURIComponent(adcName)}/summary`);
          setSummary(res.data?.data);
        } catch (error) {
          console.error('Error fetching ADC summary:', error);
          toast.error('Error al cargar el resumen del ADC');
        } finally {
          setLoading(false);
        }
      };
      fetchSummary();
    } else {
      setSummary(null);
    }
  }, [isOpen, adcName]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Nunca';
    return new Date(dateStr).toLocaleString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-slate-50 border-slate-100 rounded-[2rem]">
        <div className="h-2 w-full" style={{ backgroundColor: currentColor }}></div>
        <div className="p-8">
          <DialogHeader className="mb-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm" style={{ backgroundColor: `${currentColor}15`, color: currentColor }}>
                <User className="w-8 h-8" />
              </div>
              <div>
                <DialogTitle className="text-3xl font-black text-slate-900 tracking-tight">
                  {adcName}
                </DialogTitle>
                <p className="text-sm font-medium text-slate-500 mt-1">Resumen del Asesor Comercial</p>
              </div>
            </div>
          </DialogHeader>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-4">
              <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-slate-400 animate-spin" style={{ borderTopColor: currentColor }}></div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cargando información...</p>
            </div>
          ) : summary ? (
            <div className="space-y-6">
              {/* Info Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Correo Electrónico</h4>
                  </div>
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {summary.email || <span className="text-slate-400 italic">No registrado</span>}
                  </p>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Último Ingreso</h4>
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    {formatDate(summary.lastLoginAt)}
                  </p>
                </div>
              </div>

              {/* Clients List */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5" style={{ color: currentColor }} />
                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">Clientes Asociados</h4>
                  </div>
                  <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">
                    {summary.totalClientes} en total
                  </span>
                </div>

                <div className="max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                  {summary.clientesAsociados && summary.clientesAsociados.length > 0 ? (
                    <ul className="space-y-2">
                      {summary.clientesAsociados.map((cliente: string, idx: number) => (
                        <li key={idx} className="text-sm font-medium text-slate-700 py-2 border-b border-slate-100 last:border-0 flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentColor }}></div>
                          {cliente}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-400 font-medium py-4 text-center">No tiene clientes asociados en la base de datos de rentas/flotilla.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-red-500 font-medium">
              No se pudo cargar la información.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
