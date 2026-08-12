import React, { useState } from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Wrench, CheckCircle2, ShieldCheck, Loader2, Info } from 'lucide-react';
import dayjs from 'dayjs';

interface RegistrarMantenimientoModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    equipoId?: string;
    serie?: string;
    distribuidorActual?: string;
    costoServicioParametrizado?: number | string;
    tipoServicioParametrizado?: string;
    ultimoSmp?: string;
    proximoSmp?: string;
    onSuccess?: () => void;
}

export default function RegistrarMantenimientoModal({
    open,
    onOpenChange,
    equipoId,
    serie,
    distribuidorActual = 'Raymond MTY',
    costoServicioParametrizado = '$1,500.00',
    tipoServicioParametrizado = 'CFPM / SMP',
    ultimoSmp = '15 Abr 2026',
    proximoSmp = '15 May 2026',
    onSuccess
}: RegistrarMantenimientoModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        fecha_servicio: dayjs().format('YYYY-MM-DD'),
        tecnico_responsable: distribuidorActual,
        dias_caidos: '0',
        observaciones: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // Simulate recording maintenance in ERP backend
            await new Promise((resolve) => setTimeout(resolve, 600));
            alert('✅ Mantenimiento registrado exitosamente. Se actualizaron los costos y el estado SMP en la flotilla.');
            onOpenChange(false);
            if (onSuccess) onSuccess();
        } catch (err) {
            alert('Error al registrar mantenimiento');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md p-0 overflow-hidden bg-white rounded-3xl border-slate-200 shadow-xl">
                
                {/* Header: Estado de Mantenimiento */}
                <div className="p-5 bg-emerald-50/60 border-b border-emerald-100">
                    <p className="text-[11px] font-black text-emerald-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ESTADO DE MANTENIMIENTO
                    </p>
                    <div className="flex items-center gap-2">
                        <span className="text-xl font-black text-slate-900">Al Día</span>
                        {serie && <span className="text-xs font-semibold text-slate-500">Serie: {serie}</span>}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-emerald-200/60 text-xs">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Último SMP Realizado</p>
                            <p className="font-bold text-slate-800 mt-0.5">{ultimoSmp}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Próximo SMP</p>
                            <p className="font-bold text-rose-600 mt-0.5">{proximoSmp}</p>
                        </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-emerald-200/40 text-xs">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Distribuidor a Cargo</p>
                        <p className="font-extrabold text-slate-800 flex items-center gap-1 mt-0.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />
                            {distribuidorActual}
                        </p>
                    </div>
                </div>

                {/* Body: Formulario Registrar Mantenimiento */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-rose-600 flex items-center gap-1.5">
                            <Wrench className="w-4 h-4" />
                            Registrar Mantenimiento
                        </h3>
                    </div>

                    {/* Ficha de Valores Parametrizados del Cargue Masivo */}
                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2 text-xs">
                        <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                            <Info className="w-3 h-3 text-indigo-500" />
                            Datos precargados de Flotilla
                        </p>
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                            <div>
                                <span className="text-[10px] text-slate-400 uppercase block">Tipo de Servicio:</span>
                                <span className="font-bold text-slate-800">{tipoServicioParametrizado}</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 uppercase block">Costo Servicio:</span>
                                <span className="font-bold text-emerald-700">{costoServicioParametrizado}</span>
                            </div>
                        </div>
                    </div>

                    {/* Fecha del Servicio */}
                    <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-slate-500 uppercase">FECHA DEL SERVICIO *</Label>
                        <Input 
                            type="date"
                            value={formData.fecha_servicio}
                            onChange={(e) => setFormData(prev => ({ ...prev, fecha_servicio: e.target.value }))}
                            className="h-10 bg-slate-50 border-slate-200 text-xs rounded-xl font-medium"
                            required
                        />
                    </div>

                    {/* Técnico Responsable / Distribuidor */}
                    <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-slate-500 uppercase">TÉCNICO RESPONSABLE / DISTRIBUIDOR</Label>
                        <Input 
                            placeholder="Nombre del técnico o distribuidor"
                            value={formData.tecnico_responsable}
                            onChange={(e) => setFormData(prev => ({ ...prev, tecnico_responsable: e.target.value }))}
                            className="h-10 bg-slate-50 border-slate-200 text-xs rounded-xl font-medium"
                        />
                    </div>

                    {/* Días sin Operación (Días Caídos) */}
                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                        <Label className="text-[11px] font-bold text-slate-500 uppercase">DÍAS SIN OPERACIÓN (DÍAS CAÍDOS)</Label>
                        <Input 
                            type="number"
                            placeholder="Ej. 2"
                            value={formData.dias_caidos}
                            onChange={(e) => setFormData(prev => ({ ...prev, dias_caidos: e.target.value }))}
                            className="h-10 bg-white border-slate-200 text-xs rounded-xl font-medium tabular-nums"
                        />
                    </div>

                    {/* Observaciones / Resultado */}
                    <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-slate-500 uppercase">OBSERVACIONES / RESULTADO</Label>
                        <Textarea 
                            placeholder="Detalles del hallazgo o rutina realizada..."
                            value={formData.observaciones}
                            onChange={(e) => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
                            className="bg-slate-50 border-slate-200 text-xs rounded-xl font-medium min-h-[80px]"
                        />
                    </div>

                    <DialogFooter className="pt-2 flex items-center justify-end gap-2">
                        <Button 
                            type="button" 
                            variant="ghost" 
                            onClick={() => onOpenChange(false)}
                            className="h-9 text-xs font-semibold text-slate-600 rounded-xl"
                        >
                            Cancelar
                        </Button>
                        <Button 
                            type="submit" 
                            disabled={isSubmitting}
                            className="h-9 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs px-5 shadow-xs"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                'Guardar Registro'
                            )}
                        </Button>
                    </DialogFooter>
                </form>

            </DialogContent>
        </Dialog>
    );
}
