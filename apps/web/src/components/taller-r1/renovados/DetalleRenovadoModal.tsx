'use client';

import { useState, useEffect } from 'react';
import { 
    X, Settings, User, Clock, Calendar, CheckCircle2, 
    Zap, Wrench, AlertTriangle, History, Play, Flame, ArrowRight, Plus, Package,
    LayoutDashboard, Pause, Mail, RotateCcw, Trash2, Loader2
} from 'lucide-react';
import renovadosService, { RenovadoSolicitud, RenovadoFase } from '@/services/taller-r1/renovados.service';
import { equipoUbicacionApi } from '@/services/taller-r1/equipo-ubicacion.service';
import { useTallerUsuarios, useCreateTallerUsuario } from '@/hooks/taller-r1/useTallerUsuarios';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Scanner } from '@yudiel/react-qr-scanner';
import { EvaluacionModal } from '../evaluaciones/EvaluacionModal';
import { toast } from 'sonner';
import tallerApi from '@/lib/api-taller';
import * as XLSX from 'xlsx';

interface Props {
    idSolicitud: string | null;
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const DetalleRenovadoModal = ({ idSolicitud, open, onClose, onSuccess }: Props) => {
    const { data: usuarios = [] } = useTallerUsuarios();
    const createUsuario = useCreateTallerUsuario();
    const [solicitud, setSolicitud] = useState<RenovadoSolicitud | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'fases' | 'refacciones' | 'incidencias' | 'historial' | 'estaciones'>('fases');
    const [showScanner, setShowScanner] = useState(false);
    const [scanningFaseId, setScanningFaseId] = useState<string | null>(null);
    const [techLogs, setTechLogs] = useState<any[]>([]);

    // States for new items
    const [newRefaccion, setNewRefaccion] = useState({ area: '', descripcion: '', cantidad: 1 });
    const [newIncidencia, setNewIncidencia] = useState({ tipo: 'SIN INCIDENCIAS', comentarios: '' });
    const [showChangeTech, setShowChangeTech] = useState(false);
    const [newTechData, setNewTechData] = useState({ tecnicoNuevo: '', motivo: '' });
    const [showQuickAddTech, setShowQuickAddTech] = useState(false);
    const [quickTechName, setQuickTechName] = useState('');
    const [quickTechEmail, setQuickTechEmail] = useState('');
    const [quickTechRole, setQuickTechRole] = useState('Administrador');
    const [quickTechSites, setQuickTechSites] = useState<string[]>(['R1']);
    const [quickTechPassword, setQuickTechPassword] = useState('');
    const [quickTechPasswordError, setQuickTechPasswordError] = useState('');
    
    // States for station change
    const [estaciones, setEstaciones] = useState<any[]>([]);
    const [showChangeStation, setShowChangeStation] = useState(false);
    const [newStationData, setNewStationData] = useState({ estacionId: '', motivo: '' });

    // States for evidence
    const [evidenceData, setEvidenceData] = useState<{comentarios: string, foto_1: string, foto_2: string}>({ comentarios: '', foto_1: '', foto_2: '' });
    const [showNextPhaseSelector, setShowNextPhaseSelector] = useState<string | null>(null);
    const [showEvaluacion, setShowEvaluacion] = useState(false);
    const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
    
    // Catalog states
    const [catalogoRefacciones, setCatalogoRefacciones] = useState<any[]>([]);
    const [showCatalogModal, setShowCatalogModal] = useState(false);
    const [catalogFormData, setCatalogFormData] = useState({ refaccion: '', descripcion: '', precio: 0 });

    // External costs states
    const [costosExternos, setCostosExternos] = useState<any[]>([]);
    const [equipoUbicacionId, setEquipoUbicacionId] = useState<string | null>(null);
    const [refaccionSubTab, setRefaccionSubTab] = useState<'internas' | 'externas'>('internas');
    const [newCostoExterno, setNewCostoExterno] = useState({ descripcion: '', precio: '', observaciones: '' });
    const [savingCosto, setSavingCosto] = useState(false);
    const [deletingCostoId, setDeletingCostoId] = useState<number | null>(null);

    useEffect(() => {
        if (open && idSolicitud) {
            loadDetalle();
            renovadosService.getEstaciones().then(res => {
                const sorted = [...(res || [])].sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true, sensitivity: 'base' }));
                setEstaciones(sorted);
            }).catch(() => {});
        }
    }, [open, idSolicitud]);

    const loadDetalle = async () => {
        try {
            setLoading(true);
            const [data, logs, catalog] = await Promise.all([
                renovadosService.findOne(idSolicitud!),
                renovadosService.getTechnicianLogs(idSolicitud!),
                equipoUbicacionApi.getRefaccionesCatalogo()
            ]);
            setSolicitud(data);
            setTechLogs(logs);
            setCatalogoRefacciones(catalog || []);

            // Load equipo_ubicacion for external costs
            if (data?.id_detalle) {
                try {
                    const eu = await equipoUbicacionApi.findByDetailId(data.id_detalle);
                    if (eu?.id_equipo_ubicacion) {
                        setEquipoUbicacionId(eu.id_equipo_ubicacion);
                        const costos = await equipoUbicacionApi.getCostosRefacciones(eu.id_equipo_ubicacion);
                        setCostosExternos(Array.isArray(costos) ? costos.filter((c: any) => c.tipo === 'externo') : []);
                    }
                } catch (_) { /* silent */ }
            }
        } catch (error) {
            toast.error('Error al cargar el detalle de la solicitud');
        } finally {
            setLoading(false);
        }
    };

    const handleStartFase = async (faseId: string, tecnico: string) => {
        try {
            await renovadosService.startFase(faseId, tecnico);
            toast.success('Fase iniciada correctamente');
            loadDetalle();
            setShowScanner(false);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Error al iniciar la fase');
        }
    };

    const handleCompleteFase = async (faseId: string, nextPhase?: string) => {
        try {
            if (evidenceData.comentarios || evidenceData.foto_1 || evidenceData.foto_2) {
                await renovadosService.updateFaseEvidence(faseId, evidenceData);
            }
            
            await renovadosService.completeFase(faseId, nextPhase);
            toast.success('Fase completada');
            setEvidenceData({ comentarios: '', foto_1: '', foto_2: '' });
            setShowNextPhaseSelector(null);
            loadDetalle();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Error al completar la fase');
        }
    };

    const handleRepeatFase = async (faseId: string) => {
        try {
            await renovadosService.repeatFase(faseId);
            toast.success('Fase restablecida. Ya puedes volver a realizarla.');
            loadDetalle();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Error al restablecer la fase');
        }
    };

    const handleImageUpload = (file: File | null, field: 'foto_1' | 'foto_2') => {
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setEvidenceData(prev => ({ ...prev, [field]: reader.result as string }));
        };
        reader.readAsDataURL(file);
    };

    const validateQuickPassword = (password: string) => {
        const hasUpperCase = /[A-Z]/.test(password);
        const hasNumber = /\d/.test(password);
        if (!hasUpperCase || !hasNumber || password.length < 8) {
            return false;
        }
        return true;
    };

    const handleQuickPasswordChange = (val: string) => {
        setQuickTechPassword(val);
        if (val.length > 0) {
            if (!validateQuickPassword(val)) {
                setQuickTechPasswordError("Mínimo 8 caracteres, 1 mayúscula y 1 número");
            } else {
                setQuickTechPasswordError("");
            }
        } else {
            setQuickTechPasswordError("");
        }
    };

    const handleSaveQuickAddTech = async () => {
        if (!quickTechName.trim() || !quickTechEmail.trim() || !quickTechPassword || !!quickTechPasswordError || quickTechSites.length === 0) return;
        try {
            const data = {
                Usuario: quickTechName.trim(),
                Correo: quickTechEmail.trim(),
                Rol: quickTechRole,
                sitio: quickTechSites.join(','),
                ContrasenaUsuario: quickTechPassword,
                Status: 'APPROVED',
                UsuarioBloqueado: false
            };
            const result = await createUsuario.mutateAsync(data);
            
            // Set the new technician in selection
            setNewTechData(prev => ({
                ...prev,
                tecnicoNuevo: result.Usuario || quickTechName.trim()
            }));
            
            // Close quick add form and show success toast
            setShowQuickAddTech(false);
            setQuickTechName('');
            setQuickTechEmail('');
            setQuickTechRole('Administrador');
            setQuickTechSites(['R1']);
            setQuickTechPassword('');
            setQuickTechPasswordError('');
        } catch (error) {
            // Error is handled in the mutation hook (toast.error)
        }
    };

    const handleChangeTech = async () => {
        const isInitial = solicitud?.estado === 'Por Iniciar';
        if (!newTechData.tecnicoNuevo || (!isInitial && !newTechData.motivo)) return;
        try {
            await renovadosService.changeTechnician(idSolicitud!, {
                ...newTechData,
                motivo: isInitial ? 'Asignación inicial' : newTechData.motivo,
                usuarioQueCambia: 'Admin'
            });
            toast.success(isInitial ? 'Técnico asignado' : 'Técnico actualizado');
            setShowChangeTech(false);
            setNewTechData({ tecnicoNuevo: '', motivo: '' });
            loadDetalle();
        } catch (error) {
            toast.error('Error al asignar/cambiar técnico');
        }
    };

    const handleChangeStation = async () => {
        const isInitial = solicitud?.estado === 'Por Iniciar';
        if (!newStationData.estacionId || (!isInitial && !newStationData.motivo)) return;
        try {
            await renovadosService.changeStation(idSolicitud!, {
                ...newStationData,
                motivo: isInitial ? 'Asignación inicial' : newStationData.motivo,
                usuarioQueCambia: 'Admin'
            });
            toast.success(isInitial ? 'Estación asignada' : 'Estación actualizada');
            setShowChangeStation(false);
            setNewStationData({ estacionId: '', motivo: '' });
            loadDetalle();
        } catch (error) {
            toast.error('Error al asignar/cambiar estación');
        }
    };

    const handleAddRefaccion = async () => {
        if (!newRefaccion.area || !newRefaccion.descripcion) {
            toast.warning('Seleccione un área y una refacción');
            return;
        }
        
        const part = catalogoRefacciones.find(p => p.refaccion === newRefaccion.descripcion);
        
        try {
            console.log('Agregando refacción:', {
                ...newRefaccion,
                precio_unitario: part?.precio || 0
            });
            await renovadosService.addRefaccion(idSolicitud!, {
                area: newRefaccion.area,
                descripcion: newRefaccion.descripcion,
                cantidad: Number(newRefaccion.cantidad),
                precio_unitario: Number(part?.precio || 0)
            });
            toast.success('Refacción agregada');
            setNewRefaccion({ area: '', descripcion: '', cantidad: 1 });
            loadDetalle();
        } catch (error: any) {
            console.error('Error detallado:', error.response?.data || error.message);
            toast.error('Error al agregar refacción');
        }
    };

    const handleSendEmail = async () => {
        if (!solicitud?.refacciones || solicitud.refacciones.length === 0) {
            toast.warning('No hay refacciones en la lista para enviar');
            return;
        }

        try {
            toast.loading('Generando Excel y enviando correo...');

            const excelData = solicitud.refacciones.map((r: any) => ({
                'Área': r.area,
                'Número de Parte': r.descripcion,
                'Cantidad Solicitada': r.cantidad,
                'Precio Unitario': r.precio_unitario || 0,
                'Total': (r.precio_unitario || 0) * r.cantidad
            }));
            
            const worksheet = XLSX.utils.json_to_sheet(excelData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Refacciones');
            const excelBase64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
            
            await tallerApi.post('/taller-r1/mail/refacciones', {
                serial_equipo: solicitud.serial_equipo,
                excelBase64: `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${excelBase64}`
            });

            toast.dismiss();
            toast.success('Correo enviado exitosamente.');
        } catch (error) {
            console.error('Error enviando correo:', error);
            toast.dismiss();
            toast.error('Ocurrió un error al enviar el correo.');
        }
    };

    const handleCreateCatalogItem = async () => {
        if (!catalogFormData.refaccion) return;
        try {
            await equipoUbicacionApi.createRefaccionCatalogo(catalogFormData);
            toast.success('Refacción agregada al catálogo');
            setShowCatalogModal(false);
            setCatalogFormData({ refaccion: '', descripcion: '', precio: 0 });
            const catalog = await equipoUbicacionApi.getRefaccionesCatalogo();
            setCatalogoRefacciones(catalog || []);
        } catch (error) {
            toast.error('Error al crear refacción en el catálogo');
        }
    };

    const handleAddCostoExterno = async () => {
        if (!newCostoExterno.descripcion.trim()) {
            toast.warning('La descripción del costo externo es obligatoria');
            return;
        }
        const precio = parseFloat(newCostoExterno.precio.replace(/,/g, ''));
        if (isNaN(precio) || precio <= 0) {
            toast.warning('Ingresa un valor monetario válido mayor a cero');
            return;
        }
        if (!equipoUbicacionId) {
            toast.error('No se encontró el equipo asociado a esta solicitud');
            return;
        }
        setSavingCosto(true);
        try {
            const nuevo = await equipoUbicacionApi.addCostoRefaccion(equipoUbicacionId, {
                descripcion: newCostoExterno.descripcion.trim(),
                precio,
                tipo: 'externo',
                observaciones: newCostoExterno.observaciones.trim() || undefined,
            });
            setCostosExternos(prev => [...prev, nuevo]);
            setNewCostoExterno({ descripcion: '', precio: '', observaciones: '' });
            toast.success('Costo externo registrado correctamente');
        } catch (error) {
            toast.error('Error al registrar el costo externo');
        } finally {
            setSavingCosto(false);
        }
    };

    const handleDeleteCostoExterno = async (id: number) => {
        setDeletingCostoId(id);
        try {
            await equipoUbicacionApi.deleteCostoRefaccion(id);
            setCostosExternos(prev => prev.filter((c: any) => c.id_costos_refacciones !== id));
            toast.success('Costo eliminado');
        } catch (error) {
            toast.error('Error al eliminar el costo');
        } finally {
            setDeletingCostoId(null);
        }
    };

    const handleCreateIncidencia = async () => {
        try {
            await renovadosService.createIncidencia(idSolicitud!, newIncidencia);
            toast.success('Incidencia registrada');
            setNewIncidencia({ tipo: 'SIN INCIDENCIAS', comentarios: '' });
            loadDetalle();
        } catch (error) {
            toast.error('Error al registrar incidencia');
        }
    };

    const handleCloseIncidencia = async (id: string) => {
        try {
            await renovadosService.closeIncidencia(id);
            toast.success('Incidencia cerrada');
            loadDetalle();
        } catch (error) {
            toast.error('Error al cerrar incidencia');
        }
    };

    const handleFinalize = async () => {
        // Enforce that started phases (En proceso) must be completed before finalizing
        const activePhases = solicitud?.fases?.filter((f: any) => f.estado === 'En proceso');
        if (activePhases && activePhases.length > 0) {
            toast.warning(`Aún hay fases activas sin finalizar: ${activePhases.map((f: any) => f.nombre_fase).join(', ')}`);
            return;
        }

        // Security Check: Functional Tests Quality Control
        const pruebasFase = solicitud.fases.find((f: any) => f.nombre_fase === 'Pruebas funcionales');
        if (pruebasFase && pruebasFase.estado !== 'Sin iniciar') {
            const isApproved = pruebasFase.comentarios?.includes('[CALIDAD: APROBADO]');
            const isRejected = pruebasFase.comentarios?.includes('[CALIDAD: RECHAZADO]');

            if (isRejected) {
                toast.error('No se puede finalizar el servicio: Las pruebas funcionales han sido RECHAZADAS.');
                return;
            }

            if (!isApproved) {
                toast.warning('Debe registrar el resultado (Aprobado/Rechazado) de las Pruebas Funcionales antes de finalizar.');
                return;
            }
        }

        try {
            await renovadosService.finalize(idSolicitud!);
            toast.success('Proceso de taller finalizado correctamente');
            setShowFinalizeDialog(false);
            onSuccess();
            onClose();
        } catch (error) {
            toast.error('Error al finalizar el proceso');
        }
    };

    const handleStartOrder = async () => {
        try {
            await renovadosService.startOrder(idSolicitud!);
            toast.success('Orden iniciada. El estado cambió a En Proceso.');
            loadDetalle();
            onSuccess();
        } catch (error) {
            toast.error('Error al iniciar la orden. Asegúrate de tener el endpoint en el backend.');
        }
    };

    if (!open) return null;

    return (
        <>
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-5xl w-full flex flex-col h-[90vh] border border-slate-100 animate-in zoom-in-95 duration-200 overflow-hidden">

                {/* Header */}
                <div className="p-6 sm:p-8 border-b border-slate-50 flex flex-col lg:flex-row items-start lg:items-center gap-4 lg:justify-between bg-slate-50/50 relative">
                    <div className="flex items-start lg:items-center gap-4 lg:gap-6">
                        <div className="w-12 h-12 lg:w-16 lg:h-16 bg-white rounded-2xl lg:rounded-3xl flex shrink-0 items-center justify-center text-red-600 shadow-sm border border-slate-100">
                            <Settings className="w-6 h-6 lg:w-8 lg:h-8 animate-spin-slow" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 lg:gap-3 mb-1">
                                <span className="text-[9px] lg:text-[10px] font-black text-red-600 uppercase tracking-[0.2em]">Orden (R1)</span>
                                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[9px] font-black uppercase">{solicitud?.estado}</span>
                            </div>
                            <h2 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight leading-none uppercase">{solicitud?.serial_equipo}</h2>
                            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-2 lg:gap-4 mt-3 lg:mt-2">
                                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] lg:text-xs font-bold bg-white px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm w-fit">
                                    <User className="w-3.5 h-3.5 text-red-500" />
                                    {solicitud?.tecnico_responsable || 'Sin asignar'}
                                    <button 
                                        onClick={() => setShowChangeTech(true)}
                                        className="ml-2 p-1 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                                    >
                                        <History className="w-3 h-3" />
                                    </button>
                                </div>
                                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] lg:text-xs font-bold bg-white px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm w-fit">
                                    <Flame className="w-3.5 h-3.5 text-orange-500" />
                                    Estación: {solicitud?.rel_estacion?.nombre || 'General'}
                                    <button 
                                        onClick={() => setShowChangeStation(true)}
                                        className="ml-2 p-1 hover:bg-neutral-50 text-neutral-600 rounded-lg transition-colors"
                                    >
                                        <History className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Action buttons */}
                    <div className="flex items-center gap-2 w-full lg:w-auto justify-end mt-2 lg:mt-0">
                        <button
                            onClick={() => setShowEvaluacion(true)}
                            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 lg:py-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-all font-black text-[9px] lg:text-[10px] uppercase tracking-widest shadow-sm"
                        >
                            Ver Evaluación
                            <ArrowRight className="w-3 h-3" />
                        </button>
                    </div>

                    {/* Close button (Absolute on mobile to always be visible at top right) */}
                    <button 
                        onClick={onClose} 
                        className="absolute top-4 right-4 lg:relative lg:top-0 lg:right-0 p-2 lg:p-3 bg-white lg:bg-transparent hover:bg-slate-100 lg:hover:bg-white rounded-xl lg:rounded-2xl transition-all text-slate-400 hover:text-red-500 shadow-sm border border-slate-100 lg:border-transparent lg:hover:border-slate-100 z-10"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Navigation Tabs */}
                {solicitud?.estado !== 'Por Iniciar' && (
                    <div className="px-4 lg:px-8 pt-4 flex flex-wrap gap-x-1 lg:gap-x-4 gap-y-2 border-b border-slate-50 justify-between sm:justify-start">
                    {[
                        { id: 'fases', label: 'Fases', icon: Zap },
                        { id: 'refacciones', label: 'Refacciones', icon: Wrench },
                        { id: 'incidencias', label: 'Paros', icon: AlertTriangle },
                        { id: 'historial', label: 'Técnicos', icon: History },
                        { id: 'estaciones', label: 'Estaciones', icon: Flame },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={cn(
                                "pb-3 px-2 lg:px-4 flex items-center gap-1.5 font-black text-[9px] lg:text-[10px] uppercase tracking-widest transition-all relative",
                                activeTab === tab.id ? "text-red-600" : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            <tab.icon className="w-3.5 h-3.5" />
                            {tab.label}
                            {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-1 bg-red-600 rounded-t-full" />}
                        </button>
                    ))}
                </div>
                )}

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center">
                            <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : solicitud?.estado === 'Por Iniciar' ? (
                        <div className="h-full flex flex-col items-center justify-center space-y-8 max-w-lg mx-auto py-12">
                            <div className="text-center space-y-4">
                                <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center text-red-500 mx-auto mb-6">
                                    <Package className="w-12 h-12" />
                                </div>
                                <h3 className="text-3xl font-black text-slate-900 tracking-tight">Orden Por Iniciar</h3>
                                <p className="text-slate-500 font-medium">
                                    Esta orden se encuentra en estado inicial. Por favor, asigna un técnico responsable y una estación de taller para poder iniciar los trabajos.
                                </p>
                            </div>
                            
                            <div className="w-full space-y-4">
                                <button 
                                    onClick={() => setShowChangeTech(true)}
                                    className="w-full flex items-center justify-between p-6 bg-white rounded-3xl border border-slate-200 hover:border-red-300 hover:shadow-xl hover:shadow-red-500/5 transition-all group"
                                >
                                    <div className="flex items-center gap-5">
                                        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-red-50 group-hover:text-red-500 transition-colors">
                                            <User className="w-6 h-6" />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Técnico Responsable</p>
                                            <p className="text-lg font-black text-slate-700">{solicitud?.tecnico_responsable || 'No asignado'}</p>
                                        </div>
                                    </div>
                                    <Plus className="w-6 h-6 text-slate-300 group-hover:text-red-500 transition-colors" />
                                </button>

                                <button 
                                    onClick={() => setShowChangeStation(true)}
                                    className="w-full flex items-center justify-between p-6 bg-white rounded-3xl border border-slate-200 hover:border-orange-300 hover:shadow-xl hover:shadow-orange-500/5 transition-all group"
                                >
                                    <div className="flex items-center gap-5">
                                        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-orange-50 group-hover:text-orange-500 transition-colors">
                                            <LayoutDashboard className="w-6 h-6" />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Estación de Taller</p>
                                            <p className="text-lg font-black text-slate-700">{solicitud?.rel_estacion?.nombre || 'No asignada'}</p>
                                        </div>
                                    </div>
                                    <Plus className="w-6 h-6 text-slate-300 group-hover:text-orange-500 transition-colors" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {activeTab === 'fases' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {solicitud?.fases?.map((fase: any, idx: number) => (
                                        <div
                                            key={fase.id_fase}
                                            className={cn(
                                                "p-6 rounded-[2.5rem] border transition-all relative overflow-hidden group flex flex-col justify-between",
                                                fase.estado === 'Finalizada'
                                                    ? "bg-emerald-50/20 border-emerald-100"
                                                    : fase.estado === 'En proceso'
                                                        ? "bg-amber-50/30 border-amber-200 shadow-md ring-2 ring-amber-200 ring-offset-4"
                                                        : "bg-white border-slate-100 hover:border-slate-200"
                                            )}
                                        >
                                            <div>
                                                <div className="flex justify-between items-start mb-4">
                                                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Fase {idx + 1}</span>
                                                    {fase.estado === 'Finalizada' ? (
                                                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                                    ) : fase.estado === 'En proceso' ? (
                                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-[8px] font-black uppercase animate-pulse">
                                                            <Clock className="w-3 h-3" />
                                                            En Proceso
                                                        </div>
                                                    ) : (
                                                        <div className="w-5 h-5 border-2 border-slate-100 rounded-full" />
                                                    )}
                                                </div>
                                                <h4 className="font-black text-slate-800 mb-2">{fase.nombre_fase}</h4>

                                                {fase.fecha_inicio && (
                                                    <div className="space-y-1 mb-4">
                                                        <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                                            <User className="w-3 h-3" /> {fase.tecnico}
                                                        </p>
                                                        <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                                            <Calendar className="w-3 h-3" /> {format(new Date(fase.fecha_inicio), 'dd/MM HH:mm')}
                                                        </p>
                                                    </div>
                                                )}

                                                {fase.estado === 'En proceso' && (
                                                    <div className="mb-4 space-y-3 p-4 bg-white/70 rounded-2xl border border-amber-100">
                                                        <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Evidencia Sugerida</p>
                                                        
                                                        {/* Specific Quality Control for Functional Tests */}
                                                        {fase.nombre_fase === 'Pruebas funcionales' && (
                                                            <div className="flex gap-2 mb-3">
                                                                <button
                                                                    onClick={() => setEvidenceData(prev => ({ ...prev, comentarios: `[CALIDAD: APROBADO] ${prev.comentarios.replace('[CALIDAD: APROBADO] ', '').replace('[CALIDAD: RECHAZADO] ', '')}` }))}
                                                                    className={cn(
                                                                        "flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border",
                                                                        evidenceData.comentarios.includes('[CALIDAD: APROBADO]') 
                                                                            ? "bg-emerald-500 text-white border-emerald-600 shadow-lg shadow-emerald-200" 
                                                                            : "bg-white text-emerald-600 border-emerald-100 hover:bg-emerald-50"
                                                                    )}
                                                                >
                                                                    Aprobado ✅
                                                                </button>
                                                                <button
                                                                    onClick={() => setEvidenceData(prev => ({ ...prev, comentarios: `[CALIDAD: RECHAZADO] ${prev.comentarios.replace('[CALIDAD: APROBADO] ', '').replace('[CALIDAD: RECHAZADO] ', '')}` }))}
                                                                    className={cn(
                                                                        "flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border",
                                                                        evidenceData.comentarios.includes('[CALIDAD: RECHAZADO]') 
                                                                            ? "bg-red-500 text-white border-red-600 shadow-lg shadow-red-200" 
                                                                            : "bg-white text-red-600 border-red-100 hover:bg-red-50"
                                                                    )}
                                                                >
                                                                    Rechazado ❌
                                                                </button>
                                                            </div>
                                                        )}

                                                        <textarea 
                                                            className="w-full text-xs font-bold p-0 bg-transparent border-none outline-none resize-none placeholder:text-slate-300 h-16"
                                                            placeholder="Comentarios de la fase..."
                                                            value={evidenceData.comentarios}
                                                            onChange={(e) => setEvidenceData({...evidenceData, comentarios: e.target.value})}
                                                        />
                                                        <div className="space-y-2">
                                                            <div>
                                                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Foto 1</label>
                                                                <input 
                                                                    type="file" 
                                                                    accept="image/*"
                                                                    capture="environment"
                                                                    onChange={(e) => handleImageUpload(e.target.files?.[0] || null, 'foto_1')}
                                                                    className="w-full text-[10px] file:mr-2 file:py-1 file:px-2 file:rounded-xl file:border-0 file:text-[9px] file:font-black file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
                                                                />
                                                                {evidenceData.foto_1 && <img src={evidenceData.foto_1} alt="evidencia 1" className="mt-2 w-full h-16 object-cover rounded-xl" />}
                                                            </div>
                                                            <div>
                                                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Foto 2</label>
                                                                <input 
                                                                    type="file" 
                                                                    accept="image/*"
                                                                    capture="environment"
                                                                    onChange={(e) => handleImageUpload(e.target.files?.[0] || null, 'foto_2')}
                                                                    className="w-full text-[10px] file:mr-2 file:py-1 file:px-2 file:rounded-xl file:border-0 file:text-[9px] file:font-black file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
                                                                />
                                                                {evidenceData.foto_2 && <img src={evidenceData.foto_2} alt="evidencia 2" className="mt-2 w-full h-16 object-cover rounded-xl" />}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {fase.estado === 'Finalizada' && (
                                                    <div className="mb-4 p-3 bg-white/40 rounded-2xl border border-emerald-100/50">
                                                        {fase.comentarios && <p className="text-xs font-bold text-slate-600 line-clamp-2 italic">"{fase.comentarios}"</p>}
                                                        <div className="flex gap-2 mt-2">
                                                            {(fase as any).foto_1 && <img src={(fase as any).foto_1} alt="Evidencia 1" className="w-12 h-12 rounded-xl object-cover" />}
                                                            {(fase as any).foto_2 && <img src={(fase as any).foto_2} alt="Evidencia 2" className="w-12 h-12 rounded-xl object-cover" />}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {fase.estado !== 'Finalizada' && (
                                                <div className="pt-2 border-t border-slate-100/50">
                                                    {fase.estado === 'En proceso' ? (
                                                        <div className="space-y-2">
                                                            <button
                                                                onClick={() => handleCompleteFase(fase.id_fase)}
                                                                className="w-full flex items-center justify-center gap-2 py-3 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-200 hover:bg-red-700 transition-all"
                                                            >
                                                                Finalizar Fase <CheckCircle2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleStartFase(fase.id_fase, solicitud?.tecnico_responsable || 'Sin asignar')}
                                                            className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600 transition-all group/btn"
                                                        >
                                                            Iniciar Fase <Play className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {fase.estado === 'Finalizada' && (
                                                <div className="space-y-2 pt-2 border-t border-slate-100/50 w-full">
                                                    <div className="flex items-center justify-between text-[10px] font-black uppercase text-emerald-600 opacity-60">
                                                        <span>Horas: {fase.horas_registradas}h</span>
                                                        <span>Completado</span>
                                                    </div>
                                                    {fase.nombre_fase === 'Pruebas funcionales' && fase.comentarios?.includes('[CALIDAD: RECHAZADO]') && (
                                                        <button
                                                            onClick={() => handleRepeatFase(fase.id_fase)}
                                                            className="w-full flex items-center justify-center gap-2 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest transition-all shadow-md active:scale-95 mt-1.5"
                                                        >
                                                            Repetir Fase <RotateCcw className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeTab === 'refacciones' && (
                                <div className="space-y-6">
                                    {/* Sub-tab selector */}
                                    <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
                                        <button
                                            onClick={() => setRefaccionSubTab('internas')}
                                            className={cn(
                                                'flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all',
                                                refaccionSubTab === 'internas'
                                                    ? 'bg-white text-slate-900 shadow-sm'
                                                    : 'text-slate-400 hover:text-slate-600'
                                            )}
                                        >
                                            Refacciones Internas
                                        </button>
                                        <button
                                            onClick={() => setRefaccionSubTab('externas')}
                                            className={cn(
                                                'flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all',
                                                refaccionSubTab === 'externas'
                                                    ? 'bg-white text-slate-900 shadow-sm'
                                                    : 'text-slate-400 hover:text-slate-600'
                                            )}
                                        >
                                            Costos Externos
                                            {costosExternos.length > 0 && (
                                                <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500 text-white rounded text-[8px]">
                                                    {costosExternos.length}
                                                </span>
                                            )}
                                        </button>
                                    </div>

                                    {/* INTERNAL REFACCIONES */}
                                    {refaccionSubTab === 'internas' && (
                                    <div className="space-y-8">
                                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex flex-col gap-4">
                                        <div className="flex flex-col xl:flex-row gap-4 items-end">
                                            <div className="flex-1 space-y-2 w-full">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Área</label>
                                                <select
                                                    className="w-full px-4 py-3 bg-white border border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-red-500"
                                                    value={newRefaccion.area}
                                                    onChange={(e) => setNewRefaccion({ ...newRefaccion, area: e.target.value })}
                                                >
                                                    <option value="">Seleccionar área...</option>
                                                    <option value="Motores">Motores</option>
                                                    <option value="Electrónica">Electrónica</option>
                                                    <option value="Hidráulica">Hidráulica</option>
                                                    <option value="Pintura">Pintura</option>
                                                    <option value="Estructural">Estructural</option>
                                                    <option value="General">General</option>
                                                </select>
                                            </div>
                                            <div className="flex-1 xl:flex-[1.5] space-y-2 w-full relative">
                                                <div className="flex items-center justify-between mb-1 pr-1">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">No. Parte</label>
                                                    <button 
                                                        onClick={() => setShowCatalogModal(true)}
                                                        className="p-1 bg-white border border-slate-200 rounded-lg text-red-600 hover:bg-red-50 transition-colors shadow-sm"
                                                        title="Nueva refacción en catálogo"
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                <input
                                                    type="text"
                                                    list="catalogo-refacciones-list"
                                                    className="w-full px-4 py-3 bg-white border border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-red-500"
                                                    value={newRefaccion.descripcion}
                                                    onChange={(e) => setNewRefaccion({ ...newRefaccion, descripcion: e.target.value })}
                                                    placeholder="Escribir número de parte..."
                                                    autoComplete="off"
                                                />
                                                <datalist id="catalogo-refacciones-list">
                                                    {catalogoRefacciones.map(item => (
                                                        <option key={item.id_refaccion} value={item.refaccion} />
                                                    ))}
                                                </datalist>
                                            </div>

                                            {(() => {
                                                const selectedPart = catalogoRefacciones.find(p => p.refaccion === newRefaccion.descripcion);
                                                return (
                                                    <>
                                                        <div className="flex-1 xl:flex-[2] space-y-2 w-full">
                                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Descripción</label>
                                                            <div className="w-full px-4 py-3 bg-slate-200/50 border border-slate-200 rounded-xl font-bold text-[11px] text-slate-500 h-[46px] overflow-hidden whitespace-nowrap text-ellipsis flex items-center">
                                                                {selectedPart?.descripcion || '-'}
                                                            </div>
                                                        </div>
                                                        <div className="w-full xl:w-24 space-y-2">
                                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Stock Disp.</label>
                                                            <div className="w-full px-4 py-3 bg-slate-200/50 border border-slate-200 rounded-xl font-black text-sm text-slate-600 h-[46px] text-center flex items-center justify-center">
                                                                {selectedPart?.cantidad_disponible || 0}
                                                            </div>
                                                        </div>
                                                    </>
                                                );
                                            })()}

                                            <div className="w-full xl:w-24 space-y-2">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Cant. Req.</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    className="w-full px-4 py-3 bg-white border border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-red-500"
                                                    value={newRefaccion.cantidad || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setNewRefaccion({ 
                                                            ...newRefaccion, 
                                                            cantidad: val === '' ? 0 : parseInt(val) 
                                                        });
                                                    }}
                                                />
                                            </div>
                                            <button
                                                onClick={handleAddRefaccion}
                                                className="w-full xl:w-auto px-8 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-200 flex items-center justify-center gap-2 hover:bg-red-700 transition-all active:scale-95 h-[46px]"
                                            >
                                                <Plus className="w-4 h-4" /> Agregar
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
                                        <table className="w-full border-collapse">
                                            <thead className="bg-slate-50">
                                                <tr>
                                                    <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Área</th>
                                                    <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Refacción</th>
                                                    <th className="px-6 py-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Cant.</th>
                                                    <th className="px-6 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Precio Unit.</th>
                                                    <th className="px-6 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {solicitud?.refacciones?.map((r: any) => (
                                                    <tr key={r.id_refaccion} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-6 py-4 font-black text-xs text-slate-900 uppercase">{r.area}</td>
                                                        <td className="px-6 py-4 font-bold text-xs text-slate-600">{r.descripcion}</td>
                                                        <td className="px-6 py-4 text-center font-black text-xs text-slate-900">{r.cantidad}</td>
                                                        <td className="px-6 py-4 text-right font-bold text-xs text-slate-400">
                                                            ${(r as any).precio_unitario?.toLocaleString() || '0.00'}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <span className="text-sm font-black text-slate-900">
                                                                ${(((r as any).precio_unitario || 0) * r.cantidad).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {(solicitud?.refacciones?.length || 0) === 0 && (
                                                    <tr><td colSpan={5} className="py-12 text-center text-slate-300 font-bold uppercase text-[10px] italic">No hay refacciones solicitadas</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="flex justify-end pt-4">
                                        <button
                                            onClick={handleSendEmail}
                                            className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-slate-200 flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-95"
                                        >
                                            <Mail className="w-4 h-4" /> Enviar Lista por Correo
                                        </button>
                                    </div>
                                    </div>
                                    )} {/* end internas sub-tab */}

                                    {/* EXTERNAL COSTS */}
                                    {refaccionSubTab === 'externas' && (
                                    <div className="space-y-6">
                                        {/* Form */}
                                        <div className="bg-amber-50 border border-amber-100 rounded-[2rem] p-6 space-y-4">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="w-1.5 h-8 bg-amber-500 rounded-full" />
                                                <div>
                                                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">Registrar Costo Externo</h4>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Servicios, mano de obra o gastos sin refacción interna</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="md:col-span-1 space-y-1">
                                                    <label className="text-[9px] font-black text-amber-600 uppercase tracking-widest ml-1">Descripción *</label>
                                                    <input
                                                        type="text"
                                                        className="w-full px-4 py-3 bg-white border border-amber-100 rounded-xl font-bold text-sm outline-none focus:border-amber-400"
                                                        placeholder="Ej: Servicio soldadura, Mano de obra..."
                                                        value={newCostoExterno.descripcion}
                                                        onChange={e => setNewCostoExterno(p => ({ ...p, descripcion: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-amber-600 uppercase tracking-widest ml-1">Precio (MXN) *</label>
                                                    <div className="relative">
                                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">$</span>
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            className="w-full pl-8 pr-4 py-3 bg-white border border-amber-100 rounded-xl font-bold text-sm outline-none focus:border-amber-400"
                                                            placeholder="0.00"
                                                            value={newCostoExterno.precio}
                                                            onChange={e => {
                                                                const v = e.target.value.replace(/[^0-9.,]/g, '');
                                                                setNewCostoExterno(p => ({ ...p, precio: v }));
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-amber-600 uppercase tracking-widest ml-1">Observaciones</label>
                                                    <input
                                                        type="text"
                                                        className="w-full px-4 py-3 bg-white border border-amber-100 rounded-xl font-bold text-sm outline-none focus:border-amber-400"
                                                        placeholder="Opcional..."
                                                        value={newCostoExterno.observaciones}
                                                        onChange={e => setNewCostoExterno(p => ({ ...p, observaciones: e.target.value }))}
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex justify-end">
                                                <button
                                                    onClick={handleAddCostoExterno}
                                                    disabled={savingCosto}
                                                    className="px-8 h-11 bg-amber-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-amber-200 flex items-center gap-2 hover:bg-amber-600 transition-all active:scale-95 disabled:opacity-60"
                                                >
                                                    {savingCosto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                                    Registrar Costo
                                                </button>
                                            </div>
                                        </div>

                                        {/* Table */}
                                        <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
                                            <table className="w-full border-collapse">
                                                <thead className="bg-slate-50">
                                                    <tr>
                                                        <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Descripción</th>
                                                        <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Observaciones</th>
                                                        <th className="px-6 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Precio</th>
                                                        <th className="px-6 py-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Acción</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {costosExternos.map((c: any) => (
                                                        <tr key={c.id_costos_refacciones} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="px-6 py-4 font-bold text-sm text-slate-900">{c.descripcion}</td>
                                                            <td className="px-6 py-4 text-xs text-slate-400">{c.observaciones || '—'}</td>
                                                            <td className="px-6 py-4 text-right font-black text-sm text-amber-700">
                                                                ${Number(c.precio || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="px-6 py-4 text-center">
                                                                <button
                                                                    onClick={() => handleDeleteCostoExterno(c.id_costos_refacciones)}
                                                                    disabled={deletingCostoId === c.id_costos_refacciones}
                                                                    className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg transition-all"
                                                                    title="Eliminar"
                                                                >
                                                                    {deletingCostoId === c.id_costos_refacciones
                                                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                                                        : <Trash2 className="w-4 h-4" />}
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {costosExternos.length === 0 && (
                                                        <tr><td colSpan={4} className="py-12 text-center text-slate-300 font-bold uppercase text-[10px] italic">No hay costos externos registrados</td></tr>
                                                    )}
                                                </tbody>
                                                {costosExternos.length > 0 && (
                                                    <tfoot className="bg-amber-50">
                                                        <tr>
                                                            <td colSpan={2} className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-amber-700">Total Costos Externos</td>
                                                            <td className="px-6 py-4 text-right font-black text-lg text-amber-800">
                                                                ${costosExternos.reduce((s: number, c: any) => s + Number(c.precio || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                            </td>
                                                            <td />
                                                        </tr>
                                                    </tfoot>
                                                )}
                                            </table>
                                        </div>
                                    </div>
                                    )} {/* end externas sub-tab */}
                                </div>
                            )}

                            {activeTab === 'incidencias' && (
                                <div className="space-y-8">
                                    <div className="bg-red-50/50 p-6 rounded-[2rem] border border-red-100 grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-red-500 uppercase tracking-widest ml-1">Tipo de Paro</label>
                                            <select
                                                className="w-full px-4 py-3 bg-white border border-red-100 rounded-xl font-bold text-sm outline-none focus:border-red-500"
                                                value={newIncidencia.tipo}
                                                onChange={(e) => setNewIncidencia({ ...newIncidencia, tipo: e.target.value })}
                                            >
                                                <option value="SIN INCIDENCIAS">SIN INCIDENCIAS</option>
                                                <option value="ESTACION LIBRE">ESTACION LIBRE</option>
                                                <option value="SOPORTE REFACCIONES">SOPORTE REFACCIONES</option>
                                                <option value="SOPORTE TECNICO">SOPORTE TECNICO</option>
                                                <option value="REPARACION MAYOR">REPARACION MAYOR</option>
                                            </select>
                                        </div>
                                        <div className="md:col-span-2 space-y-2">
                                            <label className="text-[9px] font-black text-red-500 uppercase tracking-widest ml-1">Descripción del problema</label>
                                            <textarea
                                                className="w-full px-4 py-3 bg-white border border-red-100 rounded-xl font-bold text-sm outline-none focus:border-red-500 custom-scrollbar h-[60px]"
                                                placeholder="Describa el motivo del retraso..."
                                                value={newIncidencia.comentarios}
                                                onChange={(e) => setNewIncidencia({ ...newIncidencia, comentarios: e.target.value })}
                                            />
                                        </div>
                                        <button
                                            onClick={handleCreateIncidencia}
                                            className="mt-6 py-4 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-200 flex items-center justify-center gap-2 hover:bg-red-700 transition-all"
                                        >
                                            <AlertTriangle className="w-4 h-4" /> Reportar Paro
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        {solicitud?.incidencias?.filter((i: any) => i.tipo !== 'CAMBIO_ESTACION').map((inc: any) => (
                                            <div key={inc.id_incidencia} className="bg-white p-6 rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm relative overflow-hidden group">
                                                <div className={cn("absolute top-0 left-0 w-1.5 h-full", inc.fecha_fin ? "bg-emerald-400" : "bg-red-500")} />
                                                <div className="flex items-center gap-4">
                                                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", inc.fecha_fin ? "bg-emerald-50 text-emerald-500" : "bg-red-50 text-red-500 animate-pulse")}>
                                                        {inc.fecha_fin ? <CheckCircle2 /> : <Pause />}
                                                    </div>
                                                    <div>
                                                        <h5 className="font-black text-slate-800 text-sm">{inc.tipo}</h5>
                                                        <p className="text-xs font-bold text-slate-400">{inc.comentarios || 'Sin detalles'}</p>
                                                        <span className="text-[9px] font-black text-slate-300 uppercase mt-1 block">Iniciado: {format(new Date(inc.fecha_inicio), 'dd/MM HH:mm')}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    {inc.fecha_fin ? (
                                                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase">Horas: {inc.horas_laborales}h</span>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleCloseIncidencia(inc.id_incidencia)}
                                                            className="px-6 py-2 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100"
                                                        >
                                                            Finalizar Paro
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {(solicitud?.incidencias?.filter((i: any) => i.tipo !== 'CAMBIO_ESTACION').length || 0) === 0 && (
                                            <div className="text-center py-20 text-slate-200">
                                                <CheckCircle2 className="w-16 h-16 mx-auto mb-2 opacity-20" />
                                                <p className="font-black uppercase tracking-widest text-xs">Sin incidencias reportadas</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'historial' && (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3 px-1">
                                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
                                            <History className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-800 text-sm">Cambios de Técnico</h4>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Historial completo de asignaciones</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {techLogs.map((log, idx) => (
                                            <div key={log.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex items-start gap-4 hover:border-red-100 transition-all group shadow-sm">
                                                <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-400 group-hover:text-red-500 transition-colors">
                                                    {techLogs.length - idx}
                                                </div>
                                                <div className="flex-1 space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-slate-400 line-through text-xs font-bold">{log.tecnico_anterior || 'Inicio'}</span>
                                                            <ArrowRight className="w-3 h-3 text-red-500" />
                                                            <span className="text-slate-900 font-black text-sm">{log.tecnico_nuevo}</span>
                                                        </div>
                                                        <span className="text-[10px] font-bold text-slate-400">{format(new Date(log.fecha), 'dd MMM, HH:mm', { locale: es })}</span>
                                                    </div>
                                                    <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                                                        <p className="text-xs font-bold text-slate-600"><span className="text-slate-400 uppercase text-[9px] mr-1">Motivo:</span> {log.motivo}</p>
                                                    </div>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                        <User className="w-3 h-3" /> Cambiado por {log.usuario_que_cambia}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                        {techLogs.length === 0 && (
                                            <div className="py-20 text-center text-slate-300 font-bold uppercase text-[10px] italic">No hay cambios registrados</div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'estaciones' && (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3 px-1">
                                        <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500">
                                            <Flame className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-800 text-sm">Cambios de Estación</h4>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Historial completo de ubicaciones físicas</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {solicitud?.incidencias?.filter((i: any) => i.tipo === 'CAMBIO_ESTACION').map((log: any, idx: number, arr: any[]) => (
                                            <div key={log.id_incidencia} className="bg-white p-6 rounded-[2.5rem] border border-orange-100 flex items-start gap-4 hover:border-orange-200 transition-all group shadow-sm">
                                                <div className="w-8 h-8 rounded-full bg-orange-50 border border-orange-200 flex items-center justify-center text-[10px] font-black text-orange-400 group-hover:text-orange-600 transition-colors">
                                                    {arr.length - idx}
                                                </div>
                                                <div className="flex-1 space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-slate-900 font-bold text-sm">Registro de reubicación</span>
                                                        </div>
                                                        <span className="text-[10px] font-bold text-slate-400">{format(new Date(log.fecha_inicio), 'dd MMM, HH:mm', { locale: es })}</span>
                                                    </div>
                                                    <div className="bg-orange-50/30 p-3 rounded-2xl border border-orange-50">
                                                        <p className="text-xs font-bold text-slate-600 leading-relaxed">{log.comentarios}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {(solicitud?.incidencias?.filter((i: any) => i.tipo === 'CAMBIO_ESTACION').length || 0) === 0 && (
                                            <div className="py-20 text-center text-slate-300 font-bold uppercase text-[10px] italic">No hay cambios de estación registrados</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Main Footer */}
                <div className="p-8 border-t border-slate-50 bg-slate-50/30 flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-wrap">
                        {solicitud?.estado !== 'Por Iniciar' && (() => {
                            const totalInterno = solicitud?.refacciones?.reduce((sum: number, r: any) => sum + ((r.precio_unitario || 0) * r.cantidad), 0) || 0;
                            const totalExterno = costosExternos.reduce((s: number, c: any) => s + Number(c.precio || 0), 0);
                            const totalGlobal = totalInterno + totalExterno;
                            return (
                                <>
                                    <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Refacciones Internas</p>
                                        <p className="text-lg font-black text-slate-700 leading-none">${totalInterno.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    {totalExterno > 0 && (
                                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 shadow-sm">
                                            <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">Costos Externos</p>
                                            <p className="text-lg font-black text-amber-700 leading-none">${totalExterno.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                    )}
                                    <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 shadow-sm">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Costo Total</p>
                                        <p className="text-2xl font-black text-white leading-none">${totalGlobal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                    {(solicitud?.estado === 'En Proceso' || solicitud?.estado === 'Finalizado') && (
                        <button
                            onClick={() => {
                                // Only block if there are phases in "En proceso" state
                                const activePhases = solicitud?.fases?.filter((f: any) => f.estado === 'En proceso');
                                if (activePhases && activePhases.length > 0) {
                                    const names = activePhases.map((f: any) => f.nombre_fase).join(', ');
                                    toast.warning(`No se puede finalizar: Quedan fases activas sin cerrar (${names})`);
                                    return;
                                }
                                
                                const pruebasFase = solicitud?.fases?.find((f: any) => f.nombre_fase === 'Pruebas funcionales');
                                if (pruebasFase && pruebasFase.estado !== 'Sin iniciar') {
                                    const isApproved = pruebasFase.comentarios?.includes('[CALIDAD: APROBADO]');
                                    const isRejected = pruebasFase.comentarios?.includes('[CALIDAD: RECHAZADO]');

                                    if (isRejected) {
                                        toast.error('No se puede finalizar: Las pruebas funcionales han sido RECHAZADAS.');
                                        return;
                                    }

                                    if (!isApproved) {
                                        toast.warning('Debe registrar el resultado (Aprobado/Rechazado) de las Pruebas Funcionales antes de finalizar.');
                                        return;
                                    }
                                }

                                setShowFinalizeDialog(true);
                            }}
                            disabled={solicitud?.estado === 'Finalizado'}
                            className="px-10 py-5 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-emerald-600 transition-all flex items-center gap-3 active:scale-95 disabled:opacity-50"
                        >
                            {solicitud?.estado === 'Finalizado' ? 'Orden Cerrada' : 'Finalizar Servicio'} <CheckCircle2 className="w-5 h-5" />
                        </button>
                    )}
                    {solicitud?.estado === 'Por Iniciar' && solicitud?.tecnico_responsable && solicitud?.rel_estacion?.nombre && (
                        <button 
                            onClick={handleStartOrder}
                            className="px-10 py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all flex items-center gap-3 active:scale-95"
                        >
                            Comenzar Orden de Taller <CheckCircle2 className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Overlays */}
                {showChangeTech && (
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-[150] flex items-center justify-center p-8 animate-in fade-in duration-300">
                        <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 max-w-md w-full border border-slate-100 space-y-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
                            <div className="text-center">
                                <User className="w-12 h-12 text-red-500 mx-auto mb-2" />
                                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                                    {solicitud?.estado === 'Por Iniciar' ? 'Asignar Técnico' : 'Re-asignar Técnico'}
                                </h3>
                                <p className="text-sm text-slate-500 font-medium">
                                    {solicitud?.estado === 'Por Iniciar' ? 'Selecciona el responsable de esta orden' : 'Este cambio quedará registrado en el historial'}
                                </p>
                            </div>

                            <div className="space-y-4">
                                {showQuickAddTech ? (
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nuevo Técnico Rápido</p>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider ml-1">Nombre</label>
                                            <input 
                                                type="text"
                                                placeholder="Ej: Juan Pérez"
                                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-red-500"
                                                value={quickTechName}
                                                onChange={(e) => setQuickTechName(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider ml-1">Correo Electrónico</label>
                                            <input 
                                                type="email"
                                                placeholder="Ej: j.perez@raymond.com.mx"
                                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-red-500"
                                                value={quickTechEmail}
                                                onChange={(e) => setQuickTechEmail(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider ml-1">Rol del Usuario</label>
                                            <select
                                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-red-500"
                                                value={quickTechRole}
                                                onChange={(e) => setQuickTechRole(e.target.value)}
                                            >
                                                {['Administrador', 'Almacenista', 'Supervisor comercial', 'Comercial', 'Visitante'].map(rol => (
                                                    <option key={rol} value={rol}>{rol}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider ml-1">Lugar Asignado (Múltiple)</label>
                                            <div className="flex gap-2">
                                                {['R1', 'R2', 'R3'].map((ub) => {
                                                    const isSelected = quickTechSites.includes(ub);
                                                    return (
                                                        <button
                                                            key={ub}
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                setQuickTechSites(prev =>
                                                                    prev.includes(ub)
                                                                        ? prev.filter(u => u !== ub)
                                                                        : [...prev, ub]
                                                                )
                                                            }}
                                                            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all border ${isSelected
                                                                ? 'bg-red-50 text-red-600 border-red-200 shadow-sm'
                                                                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                                                }`}
                                                        >
                                                            {ub}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider ml-1">Contraseña</label>
                                            <input 
                                                type="password"
                                                placeholder="Contraseña"
                                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-red-500"
                                                value={quickTechPassword}
                                                onChange={(e) => handleQuickPasswordChange(e.target.value)}
                                            />
                                            {quickTechPassword && (
                                                <div className="mt-1.5 ml-1 space-y-0.5">
                                                    <div className={`flex items-center gap-1.5 text-[8px] font-black uppercase tracking-tighter ${quickTechPassword.length >= 8 ? 'text-green-500' : 'text-gray-400'}`}>
                                                        <div className={`w-1 h-1 rounded-full ${quickTechPassword.length >= 8 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                                        Mínimo 8 caracteres
                                                    </div>
                                                    <div className={`flex items-center gap-1.5 text-[8px] font-black uppercase tracking-tighter ${/\d/.test(quickTechPassword) ? 'text-green-500' : 'text-gray-400'}`}>
                                                        <div className={`w-1 h-1 rounded-full ${/\d/.test(quickTechPassword) ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                                        Al menos un número
                                                    </div>
                                                    <div className={`flex items-center gap-1.5 text-[8px] font-black uppercase tracking-tighter ${/[A-Z]/.test(quickTechPassword) ? 'text-green-500' : 'text-gray-400'}`}>
                                                        <div className={`w-1 h-1 rounded-full ${/[A-Z]/.test(quickTechPassword) ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                                        Al menos una mayúscula
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-2 pt-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowQuickAddTech(false);
                                                    setQuickTechName('');
                                                    setQuickTechEmail('');
                                                    setQuickTechRole('Administrador');
                                                    setQuickTechSites(['R1']);
                                                    setQuickTechPassword('');
                                                    setQuickTechPasswordError('');
                                                }}
                                                className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSaveQuickAddTech}
                                                disabled={!quickTechName.trim() || !quickTechEmail.trim() || !quickTechPassword || !!quickTechPasswordError || quickTechSites.length === 0 || createUsuario.isPending}
                                                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                                            >
                                                {createUsuario.isPending ? (
                                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                ) : 'Guardar'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-end mb-0.5 px-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nuevo Responsable</label>
                                            <button
                                                type="button"
                                                onClick={() => setShowQuickAddTech(true)}
                                                className="text-[10px] font-black uppercase text-slate-400 hover:text-red-600 transition-all flex items-center gap-1"
                                                title="Agregar nuevo técnico rápidamente"
                                            >
                                                <Plus className="w-3 h-3" /> Añadir Nuevo
                                            </button>
                                        </div>
                                        <select 
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-red-500"
                                            value={newTechData.tecnicoNuevo}
                                            onChange={(e) => setNewTechData({...newTechData, tecnicoNuevo: e.target.value})}
                                        >
                                            <option value="">Seleccionar técnico...</option>
                                            {usuarios.map(u => (
                                                <option key={u.IDUsuarios} value={u.Usuario}>{u.Usuario}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                {solicitud?.estado !== 'Por Iniciar' && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Motivo del Cambio</label>
                                        <textarea 
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-red-500 h-20 resize-none"
                                            placeholder="Ej: Cambio de turno, enfermedad, especialidad..."
                                            value={newTechData.motivo}
                                            onChange={(e) => setNewTechData({...newTechData, motivo: e.target.value})}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button 
                                    onClick={() => {
                                        setShowChangeTech(false);
                                        setShowQuickAddTech(false);
                                        setQuickTechName('');
                                        setQuickTechEmail('');
                                        setQuickTechRole('Administrador');
                                        setQuickTechSites(['R1']);
                                        setQuickTechPassword('');
                                        setQuickTechPasswordError('');
                                    }}
                                    className="flex-1 py-4 bg-slate-100 text-slate-400 hover:text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-700 disabled:opacity-50 transition-all"
                                    disabled={!newTechData.tecnicoNuevo || showQuickAddTech || (solicitud?.estado !== 'Por Iniciar' && !newTechData.motivo)}
                                    onClick={handleChangeTech}
                                >
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {showChangeStation && (
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-[150] flex items-center justify-center p-8 animate-in fade-in duration-300">
                        <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 max-w-md w-full border border-slate-100 space-y-6 animate-in zoom-in-95 duration-200">
                            <div className="text-center">
                                <LayoutDashboard className="w-12 h-12 text-red-500 mx-auto mb-2" />
                                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                                    {solicitud?.estado === 'Por Iniciar' ? 'Asignar Estación' : 'Re-asignar Estación'}
                                </h3>
                                <p className="text-sm text-slate-500 font-medium">
                                    {solicitud?.estado === 'Por Iniciar' ? 'Selecciona dónde se ubicará el equipo' : 'Este cambio quedará registrado en las incidencias'}
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nueva Estación</label>
                                    <select 
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-red-500"
                                        value={newStationData.estacionId}
                                        onChange={(e) => setNewStationData({...newStationData, estacionId: e.target.value})}
                                    >
                                        <option value="">Seleccionar estación...</option>
                                        {estaciones.filter(e => !e.ocupada).map(est => (
                                            <option key={est.id_estacion} value={est.id_estacion}>{est.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                                {solicitud?.estado !== 'Por Iniciar' && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Motivo / Autorización</label>
                                        <input 
                                            type="text" 
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-red-500"
                                            placeholder="Ej: Cambio por falta de espacio"
                                            value={newStationData.motivo}
                                            onChange={(e) => setNewStationData({...newStationData, motivo: e.target.value})}
                                        />
                                    </div>
                                )}

                                <div className="flex gap-3 pt-4">
                                    <button 
                                        className="flex-1 py-3 text-slate-400 hover:bg-slate-50 rounded-xl font-black text-xs uppercase tracking-widest transition-all"
                                        onClick={() => setShowChangeStation(false)}
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-700 disabled:opacity-50 transition-all"
                                        disabled={!newStationData.estacionId || (solicitud?.estado !== 'Por Iniciar' && !newStationData.motivo)}
                                        onClick={handleChangeStation}
                                    >
                                        Confirmar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                {showCatalogModal && (
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                        <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-slate-100">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600">
                                    <Plus className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900">Nueva Refacción</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Agregar al catálogo base</p>
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">No. Parte / Nombre</label>
                                    <input 
                                        type="text"
                                        className="w-full px-4 py-3 bg-slate-50 rounded-xl font-bold text-sm outline-none focus:bg-white border border-transparent focus:border-red-100 uppercase"
                                        placeholder="Ej: 123456-ABC"
                                        value={catalogFormData.refaccion}
                                        onChange={(e) => setCatalogFormData({...catalogFormData, refaccion: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descripción</label>
                                    <textarea 
                                        className="w-full px-4 py-3 bg-slate-50 rounded-xl font-bold text-sm outline-none focus:bg-white border border-transparent focus:border-red-100"
                                        placeholder="..."
                                        value={catalogFormData.descripcion}
                                        onChange={(e) => setCatalogFormData({...catalogFormData, descripcion: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Precio Estandar ($)</label>
                                    <input 
                                        type="number"
                                        className="w-full px-4 py-3 bg-slate-50 rounded-xl font-bold text-sm outline-none focus:bg-white border border-transparent focus:border-red-100"
                                        placeholder="0.00"
                                        value={catalogFormData.precio}
                                        onChange={(e) => setCatalogFormData({...catalogFormData, precio: parseFloat(e.target.value) || 0})}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button 
                                    onClick={() => setShowCatalogModal(false)}
                                    className="flex-1 py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleCreateCatalogItem}
                                    className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-100 hover:bg-red-700 transition-all font-black"
                                >
                                    Guardar en catálogo
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {showFinalizeDialog && (
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md z-[250] flex items-center justify-center p-6 animate-in fade-in duration-300">
                        <div className="bg-white rounded-[3rem] shadow-2xl p-10 max-w-md w-full border border-slate-100 space-y-8 animate-in zoom-in-95 duration-200 text-center">
                            <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mx-auto mb-2">
                                <CheckCircle2 className="w-12 h-12" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">¿Finalizar Servicio?</h3>
                                <p className="text-slate-500 font-medium">
                                    Esta acción cerrará la orden de taller de forma definitiva y liberará el equipo para su entrega.
                                </p>
                            </div>

                            <div className="flex flex-col gap-3">
                                <button 
                                    onClick={handleFinalize}
                                    className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-emerald-600 transition-all shadow-xl shadow-slate-200 active:scale-[0.98]"
                                >
                                    Sí, finalizar ahora
                                </button>
                                <button 
                                    onClick={() => setShowFinalizeDialog(false)}
                                    className="w-full py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600 transition-colors"
                                >
                                    Cancelar y revisar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>

            <style>{`
                .animate-spin-slow {
                    animation: spin 8s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}</style>
            
            {showEvaluacion && solicitud && (
                <EvaluacionModal
                    open={showEvaluacion}
                    onClose={() => setShowEvaluacion(false)}
                    item={{
                        id: solicitud.id_detalle || '',
                        serial: solicitud.serial_equipo,
                        modelo: solicitud.modelo || '',
                        tipo: 'equipo'
                    }}
                    evaluationId={solicitud.id_evaluacion || undefined}
                />
            )}
        </div>
        </>
    );
};
