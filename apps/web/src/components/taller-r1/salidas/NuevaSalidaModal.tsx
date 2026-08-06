'use client';

import { useState, useEffect, useRef } from 'react';
import {
    X,
    ChevronRight,
    ChevronLeft,
    QrCode,
    Search,
    Trash2,
    Upload,
    Plus,
    Box,
    Truck,
    CheckCircle2,
    AlertCircle,
    Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { salidasApi, CreateSalidaDto, CreateDetalleDto, CreateAccesorioDto } from '@/services/taller-r1/salidas.service';
import { clientesApi, Cliente } from '@/services/taller-r1/clientes.service';
import { cn, getErrorMessage } from '@/lib/utils';
import { Scanner } from '@yudiel/react-qr-scanner';
import { useAuthTallerStore } from '@/store/auth-taller.store';
import { useAuthStore } from '@/store/auth.store';

const OBLIGATORY_PHOTOS = [
    { key: 'foto_llave', label: 'Llave' },
    { key: 'foto_kit_tapon', label: 'Kit Tapón' },
    { key: 'foto_compartimento_baterias', label: 'Compartimento Baterías' },
    { key: 'foto_compartimento_operador', label: 'Compartimento Operador' },
    { key: 'foto_pernos_horquillas', label: 'Pernos Horquillas' },
    { key: 'foto_frente_equipo', label: 'Frente del Equipo' },
    { key: 'foto_posterior_equipo', label: 'Posterior equipo' },
];

const OPTIONAL_PHOTOS = [
    { key: 'foto_lineas_vida', label: 'Líneas de vida' },
    { key: 'foto_clamp_opc', label: 'Clamp OPC' },
    { key: 'foto_kit_aceite', label: 'Kit de aceite' },
];

const CHECKLIST_CATEGORIES = [
    {
        name: '1 - OPERACIONAL',
        type: 'ok_no_ok',
        items: [
            { id: 'op_velocidades', label: 'A - Todas las Velocidades Adelante/Reversa' },
            { id: 'op_levante', label: 'B - Función de levante de horquillas' },
            { id: 'op_auxiliares', label: 'C - Opera Todas las Funciones Auxiliares' },
            { id: 'op_carro_ajustado', label: 'D - DR- CARRO AJUSTADO' }
        ]
    },
    {
        name: '2 - ESTRUCTURAL',
        type: 'nueva_buen_estado',
        items: [
            { id: 'est_ruedas', label: 'A - RUEDAS' },
            { id: 'est_cils_levante', label: 'B - CILS. LEVANTE' },
            { id: 'est_transmision', label: 'C - TRANSMISION' },
            { id: 'est_carro', label: 'D - CARRO' },
            { id: 'est_traccion', label: 'E - U.de TRACCION' },
            { id: 'est_tapas_bateria', label: 'F - TAPAS DE BATERIA Y RODILLOS' },
            { id: 'est_pintura', label: 'G - PINTURA' },
            { id: 'est_tapas_plasticas', label: 'H - TAPAS Y MOLDURAS PLASTICAS' }
        ]
    },
    {
        name: '3 - ELECTRONICA',
        type: 'nueva_buen_estado',
        items: [
            { id: 'elec_motores', label: 'A - MOTORES DE LEVANTE/ TRACCION/ AUX' },
            { id: 'elec_direccion', label: 'B - MOTOR DE DIRECCION' },
            { id: 'elec_palanca', label: 'C - PALANCA DE CONTROL' },
            { id: 'elec_tarjeta', label: 'D - TARJETA VEHICULE MANAGER' },
            { id: 'elec_ampl_traccion', label: 'E - AMPLIFICADOR TRACCION' },
            { id: 'elec_ampl_levante', label: 'F - AMPLIFICADOR LEVANTE' },
            { id: 'elec_monitor', label: 'G - MONITOR' }
        ]
    },
    {
        name: '3.- OPCIONES DE SEGURIDAD',
        type: 'nueva_buen_estado',
        items: [
            { id: 'seg_torreta', label: 'A - TORRETA' },
            { id: 'seg_luces_trabajo', label: 'B - LUCES DE TRABAJO' },
            { id: 'seg_alarma_reversa', label: 'C - ALARMA DE REVERSA' },
            { id: 'seg_poste_guarda', label: 'D - POSTE DE GUARDA TRASERO' },
            { id: 'seg_sensor_compart_operador', label: 'F - SENSOR COMPART OPERADOR' },
            { id: 'seg_guarda_carga', label: 'G - GUARDA DE CARGA' },
            { id: 'seg_medidor_altura', label: 'H - MEDIDOR DE ALTURA/INCLINACION' },
            { id: 'seg_encendido_keyless', label: 'I - ENCENDIDO KEYLESS' },
            { id: 'seg_luces_rojas', label: 'J - LUCES ROJAS' },
            { id: 'seg_luces_azules', label: 'K - LUCES AZULES' },
            { id: 'seg_battery_roller', label: 'L - BATTERY ROLLER' },
            { id: 'seg_arnes', label: 'M - ARNES Y LINEA DE VIDA (OPC)' },
            { id: 'seg_pallet_clamp', label: 'N - PALLET CLAMP (OPC)' },
            { id: 'seg_extensiones_plataforma', label: 'O - EXTENSIONES DE PLATAFORMA' },
            { id: 'seg_sensor_sidegates', label: 'P - SENSOR SIDEGATES' },
            { id: 'seg_claxon', label: 'Q - CLAXÓN' }
        ]
    },
    {
        name: 'OTROS',
        type: 'nueva_buen_estado',
        items: [
            { id: 'otros_llaves', label: 'A - Juego de Llaves' },
            { id: 'otros_tapones_hidraulico', label: 'B - Tapones en Hidraulico' }
        ]
    }
];

interface NuevaSalidaModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editingSalidaId?: string | null;
}

export default function NuevaSalidaModal({ isOpen, onClose, onSuccess, editingSalidaId }: NuevaSalidaModalProps) {
    const selectedSite = useAuthTallerStore(state => state.selectedSite);
    const { user } = useAuthStore();
    const evaluatorName = user ? `${user.firstName || (user as any).Usuario || ''} ${user.lastName || ''}`.trim() : 'Usuario';
    const [loading, setLoading] = useState(false);
    const [nextFolio, setNextFolio] = useState<string>('');
    const [availableEquipos, setAvailableEquipos] = useState<any[]>([]);
    const [availableAccesorios, setAvailableAccesorios] = useState<any[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [searchTermManual, setSearchTermManual] = useState('');

    // UI State for single-page layout
    const [isAddingItem, setIsAddingItem] = useState(false);
    const [addingType, setAddingType] = useState<'Equipos' | 'Accesorios' | null>(null);
    const [showScanner, setShowScanner] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [checklistModalFor, setChecklistModalFor] = useState<string | null>(null);
    const [confirmingItem, setConfirmingItem] = useState<any | null>(null);
    const [checklistValues, setChecklistValues] = useState<Record<string, string>>({});
    const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
    const [triedToSubmit, setTriedToSubmit] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<any | null>(null);
    const [showQuickAddClient, setShowQuickAddClient] = useState(false);
    const [showQuickAddConfirm, setShowQuickAddConfirm] = useState(false);
    const [quickAddValue, setQuickAddValue] = useState('');
    const [motivoSalida, setMotivoSalida] = useState<string>('RENTA');
    const [quickAddClientExtra, setQuickAddClientExtra] = useState({
        rfc: '',
        telefono: '',
        persona_contacto: ''
    });
    const [isSavingQuickAdd, setIsSavingQuickAdd] = useState(false);

    const [basicInfo, setBasicInfo] = useState<CreateSalidaDto>({
        tiene_remision: false,
        numero_remision: '',
        numero_transporte: '',
        pedido_venta: '',
        cliente: '',
        tipo_elemento: 'Equipos', // Default selection mode
        razon_social: '',
        direccion_cliente: '',
        rfc: '',
        contacto: '',
        destino: '',
        tipo_documento: '',
    });

    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [userSignature, setUserSignature] = useState<string | null>(null);

    const [selectedItems, setSelectedItems] = useState<any[]>([]);
    const [observations, setObservations] = useState('');
    const [evidencia, setEvidencia] = useState<string>('');

    useEffect(() => {
        if (isOpen) {
            loadAvailableItems();
            loadClientes();
            
            if (editingSalidaId) {
                loadSalidaToEdit(editingSalidaId);
            } else {
                loadNextFolio();
                // Reset states when modal opens
                setBasicInfo({
                    tiene_remision: false,
                    numero_remision: '',
                    numero_transporte: '',
                    pedido_venta: '',
                    cliente: '',
                    tipo_elemento: 'Equipos',
                    razon_social: '',
                    direccion_cliente: '',
                    rfc: '',
                    contacto: '',
                    telefono: '',
                    destino: 'Distribuidor', // Default destination as requested
                    tipo_documento: 'Remision',
                });
                setSelectedItems([]);
                setObservations('');
                setEvidencia('');
                setChecklistValues({});
                setConfirmingItem(null);
                setLoading(false);
                setIsAddingItem(false);
                setShowScanner(false);
                setScanning(false);
                setChecklistModalFor(null);
                setTriedToSubmit(false);
                setItemToDelete(null);
            }
        }
    }, [isOpen, editingSalidaId]);

    const loadSalidaToEdit = async (id: string) => {
        try {
            setLoading(true);
            const data = await salidasApi.getById(id);
            setBasicInfo({
                tiene_remision: data.remision_confirmacion === 1 || !!data.remision,
                numero_remision: data.remision || '',
                numero_transporte: data.numero_transporte || '',
                pedido_venta: data.pedido || '',
                cliente: data.cliente || '',
                tipo_elemento: (data.elemento as any) || 'Equipos',
                razon_social: data.razon_social || '',
                direccion_cliente: data.direccion_cliente || '',
                rfc: data.rfc || '',
                contacto: data.contacto || '',
                telefono: data.telefono || '',
                destino: data.destino || 'Distribuidor',
                tipo_documento: data.tipo_documento || 'Remision',
            });
            setObservations(data.observaciones || '');
            setNextFolio(data.folio);
            
            // Map existing items to selectedItems state
            const items: any[] = [];
            
            const detallesList = data.detalles || data.salida_detalle || [];
            console.log('[NuevaSalidaModal] Processing details:', detallesList.length);
            
            if (Array.isArray(detallesList)) {
                detallesList.forEach((d: any) => {
                    items.push({
                        ...d,
                        _type: 'equipo',
                        id_equipo: d.id_equipo,
                        id_detalles: d.id_detalle,
                        id_equipo_ubicacion: d.id_detalle,
                        serial_equipo: d.serial_equipos || d.serial || d.numero_serie,
                        modelo: d.modelo || d.filtro_modelo || '-',
                        clase: d.clase || d.filtro_clase || '-',
                        nombre_ubicacion: d.nombre_ubicacion || d.ubicacion || d.id_ubicacion || '-',
                        nombre_sub_ubicacion: d.nombre_sub_ubicacion || d.id_sub_ubicacion || '-',
                        photos: {
                            foto_llave: d.foto_llave,
                            foto_kit_tapon: d.foto_kit_tapon,
                            foto_compartimento_baterias: d.foto_compartimento_baterias,
                            foto_lineas_vida: d.foto_lineas_vida,
                            foto_compartimento_operador: d.foto_compartimento_operador,
                            foto_pernos_horquillas: d.foto_pernos_horquillas,
                            foto_clamp_opc: d.foto_clamp_opc,
                            foto_frente_equipo: d.foto_frente_equipo,
                            foto_posterior_equipo: d.foto_posterior_equipo,
                            foto_kit_aceite: d.foto_kit_aceite,
                        },
                        checklist_entrega: d.checklist_entrega || {}
                    });
                });
            }

            const accesoriosList = data.accesorios || data.salida_accesorios || [];
            console.log('[NuevaSalidaModal] Processing accessories:', accesoriosList.length);

            if (Array.isArray(accesoriosList)) {
                accesoriosList.forEach((a: any) => {
                    items.push({
                        ...a,
                        _type: 'accesorio',
                        id_accesorio: a.id_accesorio || a.id_sal_acc,
                        serial: a.serial || a.serial_accesorio || '-',
                        modelo: a.modelo || '-',
                        clase: a.clase || 'Batería',
                        nombre_ubicacion: a.nombre_ubicacion || '-',
                        nombre_sub_ubicacion: a.nombre_sub_ubicacion || '-'
                    });
                });
            }

            console.log('[NuevaSalidaModal] Total items to set:', items.length);
            setSelectedItems(items);            
        } catch (error) {
            console.error('Error loading salida for edit:', getErrorMessage(error));
            toast.error(getErrorMessage(error, 'Error al cargar datos para edición'));
        } finally {
            setLoading(false);
        }
    };

    const loadNextFolio = async () => {
        try {
            const res = await salidasApi.getNextFolio();
            setNextFolio(res.folio);
        } catch (error) {
            console.error('Error loading next folio:', error);
        }
    };

    const loadClientes = async () => {
        try {
            const res = await clientesApi.getAll();
            const sortedList = (Array.isArray(res) ? res : []).sort((a, b) => 
                (a.nombre_cliente || '').localeCompare(b.nombre_cliente || '')
            );
            setClientes(sortedList);
        } catch (error) {
            console.error('Error loading clientes:', error);
        }
    };

    const handleSaveQuickAddClient = async () => {
        if (!quickAddValue.trim()) return;
        try {
            setIsSavingQuickAdd(true);
            const payload: any = {
                nombre_cliente: quickAddValue.toUpperCase(),
            };
            if (quickAddClientExtra.rfc.trim()) payload.rfc = quickAddClientExtra.rfc.trim().toUpperCase();
            if (quickAddClientExtra.telefono.trim()) payload.telefono = Number(quickAddClientExtra.telefono.trim());
            if (quickAddClientExtra.persona_contacto.trim()) payload.persona_contacto = quickAddClientExtra.persona_contacto.trim();

            const newClient = await clientesApi.create(payload);
            
            setClientes(prev => {
                const newList = [...prev, newClient];
                return newList.sort((a, b) => (a.nombre_cliente || '').localeCompare(b.nombre_cliente || ''));
            });

            setBasicInfo(prev => ({ ...prev, cliente: newClient.id_cliente }));
            toast.success('Cliente añadido correctamente');
            setQuickAddValue('');
            setQuickAddClientExtra({ rfc: '', telefono: '', persona_contacto: '' });
            setShowQuickAddClient(false);
        } catch (error) {
            console.error('Error saving quick client:', getErrorMessage(error));
            toast.error(getErrorMessage(error, 'Error al guardar el cliente'));
        } finally {
            setIsSavingQuickAdd(false);
        }
    };

    const loadAvailableItems = async () => {
        try {
            const [equipos, accesorios] = await Promise.all([
                salidasApi.getAvailableEquipos(),
                salidasApi.getAvailableAccesorios()
            ]);
            setAvailableEquipos(Array.isArray(equipos) ? equipos : []);
            setAvailableAccesorios(Array.isArray(accesorios) ? accesorios : []);
        } catch (error) {
            console.error('Error loading available items:', error);
        }
    };

    const handleScan = async (result: any) => {
        if (!result) return;
        const serial = result[0].rawValue;
        
        setSearchTermManual(serial);
        setShowScanner(false);
        toast.info(`Filtro aplicado: ${serial}`);
    };

    const handleAddItem = (item: any) => {
        const itemId = item.id_equipo_ubicacion || item.id_accesorio;
        if (selectedItems.find(i => (i.id_equipo_ubicacion || i.id_accesorio) === itemId)) {
            toast.warning('Este elemento ya ha sido agregado');
            return;
        }
        const type = addingType === 'Equipos' ? 'equipo' : 'accesorio';
        setSelectedItems([...selectedItems, {
            ...item,
            _type: type,
            checklist_entrega: type === 'equipo' ? item.checklist_entrega : undefined,
            photos: item.photos || {}
        }]);
        setConfirmingItem(null);
        setIsAddingItem(false);
        setAddingType(null);
        setChecklistValues({});
        toast.success(`${addingType === 'Equipos' ? 'Equipo' : 'Accesorio'} añadido a la salida`);
    };

    // Filter available items based on search term and those already selected
    const getFilteredAvailableItems = () => {
        const items = addingType === 'Equipos' ? availableEquipos : availableAccesorios;
        if (!Array.isArray(items)) return [];

        return items.filter(item => {
            // Search filter
            if (searchTermManual) {
                const serial = (item.serial_equipo || item.serial || '').toLowerCase();
                if (!serial.includes(searchTermManual.toLowerCase())) return false;
            }

            // Exclude already selected
            const itemId = item.id_equipo_ubicacion || item.id_accesorio;
            return !selectedItems.some(selected => (selected.id_equipo_ubicacion || selected.id_accesorio) === itemId);
        });
    };

    const filteredAvailableItems = getFilteredAvailableItems();



    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                setEvidencia(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleChecklistPhotoUpload = (itemId: string, photoKey: string, file: File) => {
        const reader = new FileReader();
        reader.onload = () => {
            setSelectedItems(selectedItems.map(item => {
                if ((item.id_detalles || item.id_accesorio) === itemId) {
                    return {
                        ...item,
                        checklist: {
                            ...item.checklist,
                            [photoKey]: reader.result as string
                        }
                    };
                }
                return item;
            }));
        };
        reader.readAsDataURL(file);
    };

    const isChecklistComplete = (item: any) => {
        // R1 y R2 requieren checklist obligatorio
        const site = selectedSite?.toLowerCase();
        if (site !== 'r1' && site !== 'r2') return true;

        if (item._type !== 'equipo') return true;
        if (item.tipo_salida === 'SCRAP') return true;
        
        if (!item.photos) return false;

        for (const photo of OBLIGATORY_PHOTOS) {
            if (!item.photos[photo.key]) return false;
        }

        // Ensure checklist_entrega exists and has some data
        if (!item.checklist_entrega || Object.keys(item.checklist_entrega).length === 0) return false;

        return true;
    };

    const handleSave = async (signatures?: { firma?: string | null, firma_usuario?: string | null, nombre_recibe?: string | null }) => {
        if (selectedItems.length === 0) {
            toast.error('Debes seleccionar al menos un elemento');
            return;
        }

        const missingChecklists = selectedItems.filter(i => !isChecklistComplete(i));
        if (missingChecklists.length > 0) {
            toast.error('Faltan fotos obligatorias en el checklist de uno o más equipos');
            return;
        }

        // Strict Form Validation
        if (!basicInfo.numero_transporte) {
            toast.error('El Número de Transporte (Placas) es obligatorio');
            return;
        }
        if (!basicInfo.pedido_venta) {
            toast.error('El Pedido de Venta (Folio de venta) es obligatorio');
            return;
        }
        if (!basicInfo.cliente) {
            toast.error('Debes seleccionar un Cliente');
            return;
        }
        if (!basicInfo.destino) {
            toast.error('Debes seleccionar un Destino');
            return;
        }

        // If signatures are not provided, and it's required, show the signature modal
        if (!signatures && (basicInfo.tiene_remision || selectedSite?.toLowerCase() === 'r1')) {
            setShowSignatureModal(true);
            return;
        }

        setLoading(true);
        try {
            if (editingSalidaId) {
                // UPDATE
                const updateData: any = {
                    numero_transporte: basicInfo.numero_transporte,
                    pedido: basicInfo.pedido_venta,
                    cliente: basicInfo.cliente,
                    razon_social: basicInfo.razon_social,
                    direccion_cliente: basicInfo.direccion_cliente,
                    rfc: basicInfo.rfc,
                    contacto: basicInfo.contacto,
                    telefono: basicInfo.telefono,
                    destino: basicInfo.destino,
                    tipo_documento: basicInfo.tipo_documento,
                    observaciones: observations,
                    remision: basicInfo.numero_remision,
                    remision_confirmacion: basicInfo.tiene_remision ? 1 : 0,
                };

                if (signatures) {
                    updateData.firma = signatures.firma;
                    updateData.firma_usuario = signatures.firma_usuario;
                    updateData.nombre_recibe = signatures.nombre_recibe;
                }

                await salidasApi.update(editingSalidaId, updateData);
                toast.success(`Salida ${nextFolio} actualizada correctamente`);
            } else {
                // CREATE
                const salidaData: CreateSalidaDto = {
                    ...basicInfo,
                    observaciones: observations,
                    evidencia,
                    firma: signatures?.firma || undefined,
                    firma_usuario: signatures?.firma_usuario || undefined,
                    nombre_recibe: signatures?.nombre_recibe || undefined,
                };
                const newSalida = await salidasApi.create(salidaData);

                // 2. Add Items
                for (const item of selectedItems) {
                    if (item._type === 'equipo') {
                        const detalleData: CreateDetalleDto = {
                            id_equipo: item.id_detalles || item.id_equipo,
                            id_equipo_ubicacion: item.id_equipo_ubicacion,
                            tipo_salida: item.tipo_salida || 'Embarque',
                            serial_equipos: item.serial_equipo,
                            id_ubicacion: item.id_ubicacion,
                            id_sub_ubicacion: item.id_sub_ubicacion,
                            checklist_entrega: item.checklist_entrega,
                            ...item.photos // Spread the photo keys
                        };
                        await salidasApi.addDetalle(newSalida.id_salida, detalleData);
                    } else {
                        const accData: CreateAccesorioDto = {
                            id_accesorio: item.id_accesorio,
                            modelo: item.modelo,
                            serial: item.serial,
                            voltaje: item.voltaje,
                        };
                        await salidasApi.addAccesorio(newSalida.id_salida, accData);
                    }
                }

                toast.success(`Salida ${newSalida.folio} registrada correctamente`);
            }
            
            onSuccess();
            onClose();
        } catch (error) {
            toast.error(getErrorMessage(error, editingSalidaId ? 'Error al actualizar la salida' : 'Error al registrar la salida'));
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="relative bg-white w-full sm:max-w-4xl max-h-screen sm:max-h-[92vh] flex flex-col sm:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50 gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-black rounded-full uppercase tracking-wider">
                                Nueva Salida
                            </span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            Salida Taller {selectedSite?.toUpperCase() || 'R1'}
                        </h2>
                    </div>
                    <div className="flex justify-end">
                        <button
                            onClick={onClose}
                            className="p-3 text-slate-400 hover:text-slate-600 hover:bg-white rounded-2xl transition-all shadow-sm border border-transparent hover:border-slate-100"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Unified Content Container */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 custom-scrollbar scroll-smooth">

                    {/* Folio Banner */}
                    <div className="mb-8 p-8 bg-slate-900 rounded-[2.5rem] flex items-center justify-center border border-slate-800 shadow-2xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-red-600/5 to-transparent" />
                        <div className="flex flex-col items-center gap-2 z-10">
                            <span className="text-5xl font-black text-white tracking-[0.2em] drop-shadow-xl uppercase italic">
                                {nextFolio || '...'}
                            </span>
                            <div className="px-6 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-[10px] font-bold text-white uppercase tracking-[0.4em]">
                                {new Date().toLocaleDateString()}
                            </div>
                        </div>
                        <div className="absolute bottom-4 right-8 text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">
                            Folio de Salida {selectedSite?.toUpperCase() || 'R1'}
                        </div>
                    </div>

                    <div className="space-y-10 pb-20">
                        {/* SECTION 1: Business Info & Remission */}
                        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center gap-2 mb-6">
                                <Box className="w-5 h-5 text-red-600" />
                                <h3 className="text-lg font-bold text-slate-900 uppercase tracking-wider">Información del Cliente y Egreso</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-100">
                                <div className="space-y-6 col-span-2 md:col-span-1">
                                    <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                        <div>
                                            <h4 className="font-bold text-slate-900">¿Tiene remisión u orden?</h4>
                                            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Define si requiere número de folio externo</p>
                                        </div>
                                        <button
                                            onClick={() => setBasicInfo({ ...basicInfo, tiene_remision: !basicInfo.tiene_remision })}
                                            className={cn(
                                                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                                                basicInfo.tiene_remision ? "bg-red-600" : "bg-slate-200"
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-md",
                                                    basicInfo.tiene_remision ? "translate-x-6" : "translate-x-1"
                                                )}
                                            />
                                        </button>
                                    </div>

                                    {basicInfo.tiene_remision && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div className="col-span-2 sm:col-span-1">
                                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5 px-1">Tipo de Documento</label>
                                                <select
                                                    value={basicInfo.tipo_documento}
                                                    onChange={(e) => setBasicInfo({ ...basicInfo, tipo_documento: e.target.value })}
                                                    className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 transition-all font-medium text-slate-900 appearance-none"
                                                >
                                                    <option value="Remision">Remisión</option>
                                                    <option value="Orden de compra">Orden de compra</option>
                                                </select>
                                            </div>
                                            <div className="col-span-2 sm:col-span-1">
                                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5 px-1">Número de Folio</label>
                                                <input
                                                    type="text"
                                                    value={basicInfo.numero_remision}
                                                    onChange={(e) => setBasicInfo({ ...basicInfo, numero_remision: e.target.value })}
                                                    placeholder="Ej: R-45920"
                                                    className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 transition-all font-medium text-slate-900"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 gap-6 md:col-span-1">
                                    <div className="space-y-1">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 px-1 flex items-center gap-1.5">
                                            <Truck className="w-3 h-3 text-red-500" />
                                            Número de Transporte <span className="text-red-500 ml-1">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={basicInfo.numero_transporte}
                                            onChange={(e) => setBasicInfo({ ...basicInfo, numero_transporte: e.target.value })}
                                            placeholder="Placas o folio"
                                            className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 transition-all font-medium text-slate-900"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 px-1 flex items-center gap-1.5">
                                            <Search className="w-3 h-3 text-red-500" />
                                            Pedido de Venta <span className="text-red-500 ml-1">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={basicInfo.pedido_venta || ''}
                                            onChange={(e) => setBasicInfo({ ...basicInfo, pedido_venta: e.target.value })}
                                            placeholder="Folio de venta"
                                            className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 transition-all font-medium text-slate-900"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-end mb-1.5 px-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                                                Cliente <span className="text-red-500">*</span>
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => setShowQuickAddClient(true)}
                                                className="text-[10px] font-black uppercase text-slate-400 hover:text-red-600 transition-all flex items-center gap-1"
                                                title="Añadir nuevo cliente"
                                            >
                                                <Plus className="w-3 h-3" /> Añadir nuevo
                                            </button>
                                        </div>
                                        <select
                                            value={basicInfo.cliente || ''}
                                            onChange={(e) => setBasicInfo({ ...basicInfo, cliente: e.target.value })}
                                            className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 transition-all font-medium text-slate-900 appearance-none"
                                        >
                                            <option value="">Seleccione un cliente...</option>
                                            {clientes.map(c => (
                                                <option key={c.id_cliente} value={c.id_cliente}>
                                                    {c.nombre_cliente}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 px-1">
                                            Destino <span className="text-red-500 ml-1">*</span>
                                        </label>
                                        <select
                                            value={basicInfo.destino || 'Distribuidor'}
                                            onChange={(e) => setBasicInfo({ ...basicInfo, destino: e.target.value })}
                                            className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 transition-all font-medium text-slate-900 appearance-none"
                                        >
                                            <option value="Distribuidor">Distribuidor</option>
                                            <option value="R2">R2</option>
                                            <option value="Cliente directo">Cliente directo</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* SECTION 2: Items Selection (Inline List like Entradas) */}
                        <section className="bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <Plus className="w-5 h-5 text-red-600" />
                                    <h3 className="text-lg font-bold text-slate-900 uppercase tracking-wider">Elementos de Salida</h3>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => { setAddingType('Equipos'); setIsAddingItem(true); setSearchTermManual(''); }}
                                        className="h-10 px-4 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-slate-200"
                                    >
                                        <Box className="w-3.5 h-3.5" /> Equipo
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setAddingType('Accesorios'); setIsAddingItem(true); setSearchTermManual(''); }}
                                        className="h-10 px-4 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95 flex items-center gap-2 shadow-sm"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Accesorio
                                    </button>
                                </div>
                            </div>

                            {selectedItems.length === 0 ? (
                                <div className="py-20 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-[2rem] bg-white/50">
                                    <Box className="w-12 h-12 mb-4 text-slate-200" />
                                    <p className="font-black text-sm uppercase tracking-widest">No hay elementos seleccionados</p>
                                    <p className="text-[10px] mt-1 font-bold">Añade montacargas o consumibles para la salida</p>
                                </div>
                            ) : (
                                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 border-b border-slate-100">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</th>
                                                <th className="px-6 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Identificador</th>
                                                <th className="px-6 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Modelo / Ubicación</th>
                                                <th className="px-6 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {selectedItems.map((item, idx) => (
                                                <tr key={idx} className="group hover:bg-slate-50/50 transition-all">
                                                    <td className="px-6 py-4">
                                                        <span className={cn(
                                                            "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border",
                                                            item._type === 'equipo' ? "bg-red-50 text-red-600 border-red-100" : "bg-blue-50 text-blue-600 border-blue-100"
                                                        )}>
                                                            {item._type === 'equipo' ? 'EQUIPO' : 'ACCESORIO'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 font-black text-slate-900 tracking-tight">
                                                        <code className="bg-slate-100 px-2 py-1 rounded text-xs font-mono">
                                                            {item.serial_equipo || item.serial}
                                                        </code>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-slate-700 text-xs">{item.modelo}</span>
                                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{item.nombre_ubicacion || item.id_ubicacion || item.ubicacion || 'Sin Ubicación'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {item._type === 'equipo' && (['r1', 'r2'].includes(selectedSite?.toLowerCase() || '') || !selectedSite) && (
                                                                <div className={cn(
                                                                    "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border",
                                                                    isChecklistComplete(item) ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-orange-50 text-orange-600 border-orange-100"
                                                                )}>
                                                                    {isChecklistComplete(item) ? 'Checklist Completo ✓' : 'Faltan Datos/Fotos ⚠'}
                                                                </div>
                                                            )}
                                                            <button
                                                                onClick={() => setItemToDelete(item)}
                                                                className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>

                        {/* SECTION 3: Evidence & Observations */}
                        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
                            <div className="flex items-center gap-2 mb-6">
                                <Plus className="w-5 h-5 text-red-600" />
                                <h3 className="text-lg font-bold text-slate-900 uppercase tracking-wider">Notas y Evidencias</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100">
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Observaciones Generales</label>
                                    <textarea
                                        value={observations}
                                        onChange={(e) => setObservations(e.target.value)}
                                        rows={6}
                                        placeholder="Detalles adicionales, estado de la carga, personal de transporte..."
                                        className="w-full px-5 py-4 bg-white border border-slate-200 rounded-[2rem] focus:outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 transition-all font-medium text-slate-900 resize-none shadow-sm"
                                    />
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Evidencia Fotográfica (Remisión/Carga)</label>
                                    <label className={cn(
                                        "relative flex flex-col items-center justify-center w-full h-[180px] border-4 border-dashed rounded-[2.5rem] transition-all cursor-pointer group",
                                        evidencia ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300"
                                    )}>
                                        {evidencia ? (
                                            <>
                                                <img
                                                    src={evidencia}
                                                    alt="Evidencia"
                                                    className="absolute inset-0 w-full h-full object-cover rounded-[2.25rem] brightness-75 group-hover:brightness-50 transition-all"
                                                />
                                                <div className="absolute inset-0 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all font-black uppercase text-xs tracking-widest">
                                                    <Upload className="w-8 h-8 mb-2" />
                                                    Cambiar Foto
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        e.preventDefault();
                                                        setEvidencia('');
                                                    }}
                                                    className="absolute top-4 right-4 bg-red-600 text-white p-2 rounded-full shadow-xl hover:bg-red-700 transition-all z-10"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center">
                                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3 text-slate-300">
                                                    <Upload className="w-8 h-8" />
                                                </div>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Presiona para cargar</span>
                                            </div>
                                        )}
                                        <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
                                    </label>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>

                {/* SECTION: Evidence & Observations moved to footer or separate section if needed, but keeping it inside main scroll */}

                {/* NESTED MODAL FOR ADDING ITEMS WITH PREVIEW AND CHECKLIST */}
                {isAddingItem && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300">
                        <div className="bg-white rounded-[3rem] shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-100 animate-in zoom-in-95 duration-300 overflow-hidden">
                            {/* Header */}
                            <div className="p-8 border-b border-slate-50 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-10">
                                <div>
                                    <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                                        <div className="w-2 h-8 bg-red-600 rounded-full" />
                                        Añadir {addingType === 'Equipos' ? 'Equipo Montacargas' : 'Accesorio'}
                                    </h4>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-5 mt-1">Suministros y Activos {useAuthTallerStore.getState().selectedSite || 'R1'}</p>
                                </div>
                                <button
                                    onClick={() => {
                                        if (confirmingItem) {
                                            setShowCloseConfirmation(true);
                                        } else {
                                            setIsAddingItem(false);
                                            setShowScanner(false);
                                            setConfirmingItem(null);
                                        }
                                    }}
                                    className="p-3 hover:bg-slate-100 rounded-2xl transition-all text-slate-400"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                                {/* Search & interactive list section (Visible if not confirming) */}
                                {!confirmingItem && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                                        <div className="flex flex-col md:flex-row gap-4">
                                            {/* QR Scanner Trigger */}
                                            <button
                                                onClick={() => setShowScanner(!showScanner)}
                                                className={cn(
                                                    "flex items-center justify-center gap-3 p-6 rounded-[2rem] transition-all shadow-xl font-black text-xs uppercase tracking-widest border-2",
                                                    showScanner
                                                        ? "bg-red-50 border-red-200 text-red-600 shadow-red-100"
                                                        : "bg-red-600 border-red-600 text-white shadow-red-200 hover:bg-red-700"
                                                )}
                                            >
                                                <QrCode className="w-5 h-5" />
                                                {showScanner ? 'Cerrar Escáner' : 'Escáner QR'}
                                            </button>

                                            {/* Interactive Search Bar */}
                                            <div className="relative flex-1 group">
                                                <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                                                    <Search className="w-5 h-5 text-slate-300 group-focus-within:text-red-500 transition-colors" />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={searchTermManual}
                                                    onChange={(e) => setSearchTermManual(e.target.value)}
                                                    onFocus={() => {
                                                        // Ensure list is shown or handled
                                                    }}
                                                    placeholder={`Escribir serie de ${addingType === 'Equipos' ? 'equipo' : 'accesorio'}...`}
                                                    className="w-full pl-16 pr-8 py-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all font-black text-sm text-slate-900 placeholder:text-slate-300 uppercase tracking-widest"
                                                />

                                                {/* Floating Counter */}
                                                <div className="absolute right-6 top-1/2 -translate-y-1/2 px-3 py-1 bg-slate-200 rounded-full text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                                    {filteredAvailableItems.length} Disponibles
                                                </div>
                                            </div>
                                        </div>

                                        {showScanner && (
                                            <div className="relative rounded-[2.5rem] overflow-hidden border-4 border-slate-900 shadow-2xl animate-in zoom-in duration-500 max-w-sm mx-auto aspect-square">
                                                <Scanner
                                                    onScan={(result: any[]) => handleScan(result)}
                                                    onError={() => toast.error('Error con la cámara')}
                                                    styles={{ container: { width: '100%', height: '100%' } }}
                                                />
                                                <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none flex items-center justify-center">
                                                    <div className="w-full h-full border-2 border-dashed border-red-500 rounded-2xl animate-pulse" />
                                                </div>
                                            </div>
                                        )}

                                        {/* Result List (Interactive "tira" results) */}
                                        <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm divide-y divide-slate-50 max-h-[400px] overflow-y-auto custom-scrollbar">
                                            {filteredAvailableItems
                                                .map((item, index) => (
                                                    <button
                                                        key={`${item.id_detalles || item.id_accesorio}-${index}`}
                                                        onClick={() => {
                                                            setConfirmingItem(item);
                                                            setTriedToSubmit(false);
                                                            if (addingType === 'Equipos') {
                                                                const initialChecklist: Record<string, string> = {};
                                                                CHECKLIST_CATEGORIES.forEach(cat => {
                                                                    cat.items.forEach(check => {
                                                                        initialChecklist[check.id] = ''; // Start empty/off as requested
                                                                    });
                                                                });
                                                                setChecklistValues(initialChecklist);
                                                            }
                                                        }}
                                                        className="w-full px-8 py-5 flex items-center justify-between hover:bg-red-50 border-l-4 border-transparent hover:border-red-600 transition-all group"
                                                    >
                                                        <div className="flex items-center gap-6">
                                                            <div className="w-10 h-10 bg-slate-50 flex items-center justify-center rounded-xl group-hover:bg-white transition-colors">
                                                                {addingType === 'Equipos' ? <Box className="w-5 h-5 text-slate-400 group-hover:text-red-500" /> : <Plus className="w-5 h-5 text-slate-400 group-hover:text-red-500" />}
                                                            </div>
                                                            <div className="text-left">
                                                                <h5 className="font-black text-slate-900 uppercase tracking-wider text-sm">{item.serial_equipo || item.serial}</h5>
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.modelo || 'S/M'}</p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-4">
                                                            <div className="hidden sm:block text-right">
                                                                <div className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                                                    {item.nombre_ubicacion || item.id_ubicacion || item.ubicacion || 'ALMACÉN'}
                                                                </div>
                                                            </div>
                                                            <ChevronRight className="w-5 h-5 text-slate-200 group-hover:text-red-500 group-hover:translate-x-1 transition-all" />
                                                        </div>
                                                    </button>
                                                ))}

                                            {/* Empty State in List */}
                                            {filteredAvailableItems.length === 0 && (
                                                <div className="p-12 text-center flex flex-col items-center justify-center text-slate-300">
                                                    <Search className="w-8 h-8 mb-3 opacity-20" />
                                                    <p className="font-black text-[10px] uppercase tracking-[0.2em]">No se encontraron resultados</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Confirmation Section (Preview + Checklist + Photos) */}
                                {confirmingItem && (
                                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
                                        {/* Preview Card */}
                                        <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
                                            <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/20 rounded-full -mr-32 -mt-32 blur-[80px]" />
                                            <div className="relative z-10">
                                                <div className="flex items-center gap-6 mb-8">
                                                    <div className="w-16 h-16 bg-white/10 rounded-[1.5rem] flex items-center justify-center backdrop-blur-md border border-white/10 shadow-xl">
                                                        <Box className="w-8 h-8 text-white" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-2xl font-black uppercase tracking-tight">Previsualización del activo</h4>
                                                        <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Verificación mandatoria por normativa {selectedSite?.toUpperCase() || 'R1'}</p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                                                    <div className="space-y-1">
                                                        <p className="text-white/30 text-[10px] font-black uppercase tracking-widest">Número de Serie</p>
                                                        <p className="text-2xl font-black font-mono tracking-wider">{confirmingItem.serial_equipo || confirmingItem.serial}</p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-white/30 text-[10px] font-black uppercase tracking-widest">Modelo / Clase</p>
                                                        <p className="text-2xl font-black uppercase">{confirmingItem.modelo || 'N/A'} {confirmingItem.clase && <span className="text-sm font-medium text-white/50 ml-2">({confirmingItem.clase})</span>}</p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-white/30 text-[10px] font-black uppercase tracking-widest">Ubicación Actual</p>
                                                        <p className="text-xl font-black text-red-400 uppercase tracking-tight italic">{confirmingItem.nombre_ubicacion || confirmingItem.id_ubicacion || confirmingItem.ubicacion || 'PISO'}</p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-white/30 text-[10px] font-black uppercase tracking-widest">Estado</p>
                                                        <div className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-xs font-black uppercase tracking-widest w-fit mt-1">
                                                            {confirmingItem.estado || confirmingItem.estado_acc || 'LISTO'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {(() => {
                                            const site = selectedSite?.toLowerCase();
                                            const isChecklistSite = site === 'r1' || site === 'r2' || !site;
                                            if (isChecklistSite && addingType === 'Equipos') {
                                                return (
                                                    <div className="space-y-10">
                                                        {/* Evaluador Badge */}
                                                        <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                                                            <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center shrink-0">
                                                                <CheckCircle2 className="w-4 h-4 text-white" />
                                                            </div>
                                                            <div>
                                                                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.15em]">Evaluador de Salida</p>
                                                                <p className="text-sm font-black text-indigo-900">{evaluatorName}</p>
                                                            </div>
                                                        </div>
                                                        {/* Motivo de Salida */}
                                                        <div className="space-y-6">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-2 h-10 bg-red-600 rounded-full" />
                                                                <div>
                                                                    <h4 className="text-lg font-black text-slate-900 uppercase tracking-wide">Motivo de Salida</h4>
                                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clasificación de la operación</p>
                                                                </div>
                                                            </div>
                                                            <select 
                                                                value={motivoSalida} 
                                                                onChange={(e) => setMotivoSalida(e.target.value)}
                                                                className="w-full bg-white border border-slate-200 p-4 rounded-2xl font-black text-slate-700 outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
                                                            >
                                                                <option value="RENTA">RENTA</option>
                                                                <option value="VENTA">VENTA</option>
                                                                <option value="MANIOBRA">MANIOBRA</option>
                                                                <option value="DEMO">DEMO</option>
                                                                <option value="SCRAP">SCRAP</option>
                                                            </select>
                                                        </div>

                                                        {/* Category Checklist */}
                                                        {motivoSalida !== 'SCRAP' && (
                                                            <>
                                                                <div className="space-y-6">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-2 h-10 bg-red-600 rounded-full" />
                                                                <div>
                                                                    <h4 className="text-lg font-black text-slate-900 uppercase tracking-wide">Checklist Detallado</h4>
                                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estado funcional y estético</p>
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-1 gap-8">
                                                                {CHECKLIST_CATEGORIES.map((cat, catIdx) => (
                                                                    <div key={catIdx} className="bg-slate-50/50 rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                                                                        <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                                                                            <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
                                                                            {cat.name}
                                                                        </h5>
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                                                                            {cat.items.map((check) => (
                                                                                <div key={check.id} className={cn(
                                                                                    "flex flex-col sm:flex-row sm:items-center justify-between gap-4 group p-2 rounded-2xl transition-all border border-transparent",
                                                                                    triedToSubmit && !checklistValues[check.id] && "bg-red-50 border-red-200 shadow-sm animate-in fade-in duration-300"
                                                                                )}>
                                                                                    <span className="text-[11px] font-black text-slate-700 leading-snug uppercase tracking-tight group-hover:text-slate-900 transition-colors pl-2">{check.label}</span>
                                                                                    <div className="flex bg-white p-1 rounded-2xl shadow-inner border border-slate-100 shrink-0 self-end sm:self-center">
                                                                                        {cat.type === 'ok_no_ok' ? (
                                                                                            <>
                                                                                                <button
                                                                                                    onClick={() => setChecklistValues(prev => ({ ...prev, [check.id]: 'OK' }))}
                                                                                                    className={cn(
                                                                                                        "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                                                                                        checklistValues[check.id] === 'OK' ? "bg-green-600 text-white shadow-xl shadow-green-200" : "text-slate-300 hover:text-slate-500"
                                                                                                    )}
                                                                                                >
                                                                                                    OK
                                                                                                </button>
                                                                                                <button
                                                                                                    onClick={() => setChecklistValues(prev => ({ ...prev, [check.id]: 'NO OK' }))}
                                                                                                    className={cn(
                                                                                                        "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                                                                                        checklistValues[check.id] === 'NO OK' ? "bg-red-600 text-white shadow-xl shadow-red-200" : "text-slate-300 hover:text-slate-500"
                                                                                                    )}
                                                                                                >
                                                                                                    NO OK
                                                                                                </button>
                                                                                            </>
                                                                                        ) : (
                                                                                            <>
                                                                                                <button
                                                                                                    onClick={() => setChecklistValues(prev => ({ ...prev, [check.id]: 'NUEVAS' }))}
                                                                                                    className={cn(
                                                                                                        "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                                                                                        checklistValues[check.id] === 'NUEVAS' ? "bg-blue-600 text-white shadow-xl shadow-blue-200" : "text-slate-300 hover:text-slate-500"
                                                                                                    )}
                                                                                                >
                                                                                                    NUEVAS
                                                                                                </button>
                                                                                                <button
                                                                                                    onClick={() => setChecklistValues(prev => ({ ...prev, [check.id]: 'EN BUEN ESTADO' }))}
                                                                                                    className={cn(
                                                                                                        "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                                                                                        checklistValues[check.id] === 'EN BUEN ESTADO' ? "bg-red-600 text-white shadow-xl shadow-red-200" : "text-slate-300 hover:text-slate-500"
                                                                                                    )}
                                                                                                >
                                                                                                    BUEN ESTADO
                                                                                                </button>
                                                                                            </>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Photos Grid */}
                                                        <div className="space-y-6">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-2 h-10 bg-red-600 rounded-full" />
                                                                <div>
                                                                    <h4 className="text-lg font-black text-slate-900 uppercase tracking-wide">Evidencia Fotográfica Obligatoria</h4>
                                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Debes capturar las 7 perspectivas requeridas</p>
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                                                                {OBLIGATORY_PHOTOS.map((photo) => {
                                                                    const isUploaded = !!(confirmingItem as any).tempPhotos?.[photo.key];
                                                                    return (
                                                                        <div key={photo.key} className="space-y-3">
                                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 truncate">{photo.label}</p>
                                                                            <label className={cn(
                                                                                "aspect-[4/3] rounded-[2rem] flex flex-col items-center justify-center gap-3 border-4 border-dashed transition-all cursor-pointer overflow-hidden relative group shadow-sm",
                                                                                isUploaded ? "border-emerald-400 bg-emerald-50" : "border-slate-100 bg-slate-50 hover:border-red-400 hover:bg-white"
                                                                            )}>
                                                                                <input
                                                                                    type="file"
                                                                                    accept="image/*"
                                                                                    capture="environment"
                                                                                    className="hidden"
                                                                                    onChange={async (e) => {
                                                                                        const file = e.target.files?.[0];
                                                                                        if (file) {
                                                                                            const reader = new FileReader();
                                                                                            reader.onloadend = () => {
                                                                                                const base64 = reader.result as string;
                                                                                                setConfirmingItem((prev: any) => ({
                                                                                                    ...prev,
                                                                                                    tempPhotos: { ...(prev.tempPhotos || {}), [photo.key]: base64 }
                                                                                                }));
                                                                                            };
                                                                                            reader.readAsDataURL(file);
                                                                                        }
                                                                                    }}
                                                                                />
                                                                                {isUploaded ? (
                                                                                    <>
                                                                                        <img src={(confirmingItem as any).tempPhotos?.[photo.key]} className="absolute inset-0 w-full h-full object-cover brightness-95 group-hover:brightness-50 transition-all" />
                                                                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100">
                                                                                            <div className="bg-white/20 backdrop-blur-md p-4 rounded-full border border-white/30 text-white">
                                                                                                <Upload className="w-6 h-6" />
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="absolute top-4 right-4 bg-emerald-500 text-white p-2 rounded-2xl shadow-xl shadow-emerald-200">
                                                                                            <CheckCircle2 className="w-4 h-4" />
                                                                                        </div>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                e.preventDefault();
                                                                                                setConfirmingItem((prev: any) => ({
                                                                                                    ...prev,
                                                                                                    tempPhotos: { ...(prev.tempPhotos || {}), [photo.key]: '' }
                                                                                                }));
                                                                                            }}
                                                                                            className="absolute bottom-4 right-4 bg-red-600 text-white p-2 rounded-xl shadow-xl hover:bg-red-700 transition-all z-10"
                                                                                        >
                                                                                            <X className="w-4 h-4" />
                                                                                        </button>
                                                                                    </>
                                                                                ) : (
                                                                                    <>
                                                                                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-200 group-hover:text-red-500 group-hover:bg-red-50 transition-all shadow-sm">
                                                                                            <Upload className="w-6 h-6" />
                                                                                        </div>
                                                                                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest group-hover:text-red-600 transition-colors">CAPTURAR</span>
                                                                                    </>
                                                                                )}
                                                                            </label>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>

                                                        {/* Optional Photos Section */}
                                                        <div className="space-y-6">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-2 h-10 bg-slate-200 rounded-full" />
                                                                <div>
                                                                    <h4 className="text-lg font-black text-slate-900 uppercase tracking-wide">Imágenes Opcionales</h4>
                                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Evidencia adicional relevante</p>
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                                                                {OPTIONAL_PHOTOS.map((photo) => {
                                                                    const isUploaded = !!(confirmingItem as any).tempPhotos?.[photo.key];
                                                                    return (
                                                                        <div key={photo.key} className="space-y-3">
                                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 truncate">{photo.label}</p>
                                                                            <label className={cn(
                                                                                "aspect-[4/3] rounded-[2rem] flex flex-col items-center justify-center gap-3 border-4 border-dashed transition-all cursor-pointer overflow-hidden relative group shadow-sm",
                                                                                isUploaded ? "border-slate-400 bg-slate-50" : "border-slate-100 bg-slate-50 hover:border-slate-300 hover:bg-white"
                                                                            )}>
                                                                                <input
                                                                                    type="file"
                                                                                    accept="image/*"
                                                                                    capture="environment"
                                                                                    className="hidden"
                                                                                    onChange={async (e) => {
                                                                                        const file = e.target.files?.[0];
                                                                                        if (file) {
                                                                                            const reader = new FileReader();
                                                                                            reader.onloadend = () => {
                                                                                                const base64 = reader.result as string;
                                                                                                setConfirmingItem((prev: any) => ({
                                                                                                    ...prev,
                                                                                                    tempPhotos: { ...(prev.tempPhotos || {}), [photo.key]: base64 }
                                                                                                }));
                                                                                            };
                                                                                            reader.readAsDataURL(file);
                                                                                        }
                                                                                    }}
                                                                                />
                                                                                {isUploaded ? (
                                                                                    <>
                                                                                        <img src={(confirmingItem as any).tempPhotos?.[photo.key]} className="absolute inset-0 w-full h-full object-cover brightness-95 group-hover:brightness-50 transition-all" />
                                                                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100">
                                                                                            <Upload className="w-6 h-6 text-white" />
                                                                                        </div>
                                                                                        <button
                                                                                             type="button"
                                                                                             onClick={(e) => {
                                                                                                 e.stopPropagation();
                                                                                                 e.preventDefault();
                                                                                                 setConfirmingItem((prev: any) => ({
                                                                                                     ...prev,
                                                                                                     tempPhotos: { ...(prev.tempPhotos || {}), [photo.key]: '' }
                                                                                                 }));
                                                                                             }}
                                                                                             className="absolute top-4 right-4 bg-red-600 text-white p-2 rounded-xl shadow-xl hover:bg-red-700 transition-all z-10"
                                                                                          >
                                                                                              <X className="w-4 h-4" />
                                                                                          </button>
                                                                                    </>
                                                                                ) : (
                                                                                    <Upload className="w-6 h-6 text-slate-200 group-hover:text-slate-400 transition-all" />
                                                                                )}
                                                                            </label>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                        </>
                                                        )}
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}

                                        {/* Confirmation Exit Modal */}
                                        {showCloseConfirmation && (
                                            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                                                <div className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100">
                                                    <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-6">
                                                        <AlertCircle className="w-8 h-8" />
                                                    </div>
                                                    <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-4">¿Cancelar Selección?</h4>
                                                    <p className="text-sm text-slate-400 font-bold mb-8 leading-relaxed">
                                                        Se perderá el checklist y las imágenes capturadas para este equipo.
                                                    </p>
                                                    <div className="flex gap-4">
                                                        <button
                                                            onClick={() => setShowCloseConfirmation(false)}
                                                            className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-colors"
                                                        >
                                                            Continuar
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setShowCloseConfirmation(false);
                                                                setConfirmingItem(null);
                                                                setIsAddingItem(false);
                                                            }}
                                                            className="flex-1 py-4 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                                                        >
                                                            Sí, Cancelar
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Actions */}
                                        <div className="flex flex-col sm:flex-row gap-4 pt-10 border-t-2 border-slate-50">
                                            <button
                                                onClick={() => {
                                                    if (confirmingItem) {
                                                        setShowCloseConfirmation(true);
                                                    } else {
                                                        setConfirmingItem(null);
                                                    }
                                                }}
                                                className="flex-1 h-16 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-[2rem] font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98] border border-slate-100"
                                            >
                                                Volver al Listado
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const site = selectedSite?.toLowerCase();
                                                    const isChecklistSite = site === 'r1' || site === 'r2' || !site;

                                                    if (addingType === 'Equipos' && isChecklistSite && motivoSalida !== 'SCRAP') {
                                                        // Validate Checklist
                                                        const missingItems = [];
                                                        CHECKLIST_CATEGORIES.forEach(cat => {
                                                            cat.items.forEach(item => {
                                                                if (!checklistValues[item.id]) {
                                                                    missingItems.push(item.label);
                                                                }
                                                            });
                                                        });

                                                        if (missingItems.length > 0) {
                                                            setTriedToSubmit(true);
                                                            toast.error('Debes completar todo el checklist antes de añadir');
                                                            return;
                                                        }

                                                        const missingPhotos = OBLIGATORY_PHOTOS.filter(p => !(confirmingItem as any).tempPhotos?.[p.key]);
                                                        if (missingPhotos.length > 0) {
                                                            toast.error(`Faltan fotos reglamentarias: ${missingPhotos.map(p => p.label).join(', ')}`);
                                                            return;
                                                        }
                                                    }

                                                    handleAddItem({
                                                        ...confirmingItem,
                                                        tipo_salida: motivoSalida,
                                                        checklist_entrega: {
                                                            ...checklistValues,
                                                            _evaluador: evaluatorName,
                                                        },
                                                        photos: (confirmingItem as any).tempPhotos || {}
                                                    });
                                                }}
                                                className="flex-[2] h-16 bg-red-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-red-700 transition-all hover:scale-[1.02] active:scale-95 shadow-2xl shadow-red-200 flex items-center justify-center gap-4"
                                            >
                                                <CheckCircle2 className="w-6 h-6" /> Confirmar e Integrar a Salida
                                            </button>
                                        </div>
                                    </div>
                                )
                                }
                            </div>
                        </div>
                    </div>
                )}

                {/* Confirm Deletion Modal */}
                {itemToDelete && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                        <div className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100">
                            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-6">
                                <Trash2 className="w-8 h-8" />
                            </div>
                            <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">¿Quitar Elemento?</h4>
                            <p className="text-sm text-slate-400 font-bold mb-8 leading-relaxed">
                                Estás por remover <span className="text-slate-900">{itemToDelete.serial_equipo || itemToDelete.serial}</span> del listado de salida.
                            </p>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setItemToDelete(null)}
                                    className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => {
                                        const id = itemToDelete.id_equipo_ubicacion || itemToDelete.id_accesorio;
                                        setSelectedItems(selectedItems.filter(i => (i.id_equipo_ubicacion || i.id_accesorio) !== id));
                                        setItemToDelete(null);
                                        toast.success('Elemento removido');
                                    }}
                                    className="flex-1 py-4 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                                >
                                    Sí, Quitar
                                </button>
                            </div>
                        </div>
                    </div>
                )}



                {/* Main Modal Footer */}
                <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-4 shrink-0 mt-auto">
                    <button
                        onClick={onClose}
                        className="px-8 py-4 bg-white text-slate-400 hover:text-slate-600 border border-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => handleSave()}
                        disabled={loading || selectedItems.length === 0}
                        className="flex items-center gap-3 px-10 py-4 bg-red-600 text-white rounded-2xl hover:bg-red-700 transition-all shadow-xl shadow-red-500/20 font-black text-xs uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Registrando...
                            </>
                        ) : (
                            <>
                                Registrar Salida
                                <CheckCircle2 className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </div>
            </div>
            {/* Signature Capture Modal */}
            {showSignatureModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl max-w-2xl w-full p-8 border border-slate-100 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <h5 className="text-2xl font-black text-slate-900 mb-6 text-center">Firmas de Autorización</h5>

                        {/* User Signature */}
                        <div className="mb-8">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                                Firma del Usuario Entregó <span className="text-red-500">*</span>
                            </label>
                            <div className="border-2 border-slate-200 rounded-2xl overflow-hidden bg-white relative aspect-[2/1]">
                                <canvas
                                    ref={(el) => {
                                        if (el && !el.dataset.initialized) {
                                            const rect = el.getBoundingClientRect();
                                            el.width = el.offsetWidth * 2;
                                            el.height = el.offsetHeight * 2;
                                            el.dataset.initialized = 'true';
                                            const ctx = el.getContext('2d');
                                            if (ctx) {
                                                ctx.scale(2, 2);
                                                let drawing = false;
                                                
                                                const startDrawing = (e: any) => {
                                                    drawing = true;
                                                    ctx.beginPath();
                                                    const rect = el.getBoundingClientRect();
                                                    const x = (e.clientX || e.touches[0].clientX) - rect.left;
                                                    const y = (e.clientY || e.touches[0].clientY) - rect.top;
                                                    ctx.moveTo(x, y);
                                                };

                                                const draw = (e: any) => {
                                                    if (!drawing) return;
                                                    const rect = el.getBoundingClientRect();
                                                    const x = (e.clientX || e.touches[0].clientX) - rect.left;
                                                    const y = (e.clientY || e.touches[0].clientY) - rect.top;
                                                    ctx.lineTo(x, y);
                                                    ctx.stroke();
                                                };

                                                const stopDrawing = () => {
                                                    drawing = false;
                                                    ctx.closePath();
                                                };

                                                el.addEventListener('mousedown', startDrawing);
                                                el.addEventListener('mousemove', draw);
                                                el.addEventListener('mouseup', stopDrawing);
                                                el.addEventListener('mouseleave', stopDrawing);

                                                el.addEventListener('touchstart', (e) => { startDrawing(e); e.preventDefault(); }, { passive: false });
                                                el.addEventListener('touchmove', (e) => { draw(e); e.preventDefault(); }, { passive: false });
                                                el.addEventListener('touchend', (e) => { stopDrawing(); e.preventDefault(); }, { passive: false });

                                                ctx.lineWidth = 2.5;
                                                ctx.lineCap = 'round';
                                                ctx.lineJoin = 'round';
                                                ctx.strokeStyle = '#0f172a';
                                            }
                                        }
                                    }}
                                    className="w-full h-full cursor-crosshair touch-none"
                                    id="userSignatureCanvas"
                                />
                                <button
                                    onClick={() => {
                                        const canvas = document.getElementById('userSignatureCanvas') as HTMLCanvasElement;
                                        const ctx = canvas?.getContext('2d');
                                        if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
                                    }}
                                    className="absolute bottom-4 right-4 p-2 bg-white/80 hover:bg-white rounded-lg text-slate-400 hover:text-red-500 transition-all border border-slate-200 shadow-sm"
                                    title="Limpiar firma"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => setShowSignatureModal(false)}
                                className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-all border border-transparent hover:border-slate-200 uppercase tracking-widest text-[10px]"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    const userCanvas = document.getElementById('userSignatureCanvas') as HTMLCanvasElement;
                                    const userSig = userCanvas?.toDataURL('image/png');

                                    setShowSignatureModal(false);
                                    handleSave({
                                        firma_usuario: userSig,
                                    });
                                }}
                                className="flex-1 py-4 bg-red-600 text-white font-black rounded-2xl hover:bg-red-700 transition-all shadow-xl shadow-red-200 uppercase tracking-widest text-[10px]"
                            >
                                Confirmar y Guardar Salida
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Add Client Modal */}
            {showQuickAddClient && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <div 
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in"
                        onClick={() => {
                            const hasData = quickAddValue.trim() || quickAddClientExtra.rfc || quickAddClientExtra.telefono || quickAddClientExtra.persona_contacto;
                            if (hasData) setShowQuickAddConfirm(true);
                            else { setShowQuickAddClient(false); setQuickAddValue(''); setQuickAddClientExtra({ rfc: '', telefono: '', persona_contacto: '' }); }
                        }}
                    />
                    
                    <div className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] overflow-y-auto custom-scrollbar tracking-tight">
                        <h3 className="text-2xl font-black text-slate-900 mb-2">Nuevo Cliente</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8 border-b border-slate-100 pb-4">
                            Registro Rápido de Cliente
                        </p>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 px-1">
                                    Nombre / Razón Social <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    autoFocus
                                    value={quickAddValue}
                                    onChange={(e) => setQuickAddValue(e.target.value)}
                                    placeholder="Nombre de la empresa..."
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-red-500 transition-all outline-none font-bold text-slate-900 shadow-sm"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 px-1">RFC <span className="text-slate-300 font-bold normal-case tracking-normal">(opcional)</span></label>
                                    <input
                                        type="text"
                                        value={quickAddClientExtra.rfc}
                                        onChange={(e) => setQuickAddClientExtra(p => ({ ...p, rfc: e.target.value.toUpperCase() }))}
                                        placeholder="RFC..."
                                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-400 transition-all outline-none font-bold text-slate-700 placeholder:text-slate-300 text-sm"
                                        maxLength={13}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 px-1">Teléfono <span className="text-slate-300 font-bold normal-case tracking-normal">(opcional)</span></label>
                                    <input
                                        type="tel"
                                        value={quickAddClientExtra.telefono}
                                        onChange={(e) => setQuickAddClientExtra(p => ({ ...p, telefono: e.target.value.replace(/\D/g, '') }))}
                                        placeholder="10 dígitos..."
                                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-400 transition-all outline-none font-bold text-slate-700 placeholder:text-slate-300 text-sm"
                                        maxLength={15}
                                    />
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 px-1">Persona de Contacto <span className="text-slate-300 font-bold normal-case tracking-normal">(opcional)</span></label>
                                <input
                                    type="text"
                                    value={quickAddClientExtra.persona_contacto}
                                    onChange={(e) => setQuickAddClientExtra(p => ({ ...p, persona_contacto: e.target.value }))}
                                    placeholder="Nombre del contacto..."
                                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-400 transition-all outline-none font-bold text-slate-700 placeholder:text-slate-300 text-sm"
                                />
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    onClick={() => {
                                        const hasData = quickAddValue.trim() || quickAddClientExtra.rfc || quickAddClientExtra.telefono || quickAddClientExtra.persona_contacto;
                                        if (hasData) setShowQuickAddConfirm(true);
                                        else { setShowQuickAddClient(false); setQuickAddValue(''); setQuickAddClientExtra({ rfc: '', telefono: '', persona_contacto: '' }); }
                                    }}
                                    className="flex-1 px-6 py-4 bg-slate-50 text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-100 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveQuickAddClient}
                                    disabled={isSavingQuickAdd || !quickAddValue.trim()}
                                    className="flex-[2] px-8 py-4 bg-red-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-red-700 transition-all shadow-xl shadow-red-200 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isSavingQuickAdd ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-4 h-4" />}
                                    {isSavingQuickAdd ? 'Guardando...' : 'Guardar Cliente'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Quick Add Discard Confirmation */}
                    {showQuickAddConfirm && (
                        <div className="absolute inset-0 z-[160] flex items-center justify-center p-6 bg-slate-900/20 backdrop-blur-[2px]">
                            <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 w-full max-w-xs animate-in zoom-in-95 duration-150 space-y-6 border border-slate-100">
                                <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto">
                                    <AlertCircle className="w-8 h-8 text-rose-500" />
                                </div>
                                <div className="text-center space-y-2">
                                    <h4 className="text-lg font-black text-slate-900 tracking-tight">¿Descartar datos?</h4>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">Se perderá la información ingresada.</p>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => setShowQuickAddConfirm(false)}
                                        className="w-full py-4 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                                    >
                                        Continuar Editando
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowQuickAddConfirm(false);
                                            setShowQuickAddClient(false);
                                            setQuickAddValue('');
                                            setQuickAddClientExtra({ rfc: '', telefono: '', persona_contacto: '' });
                                        }}
                                        className="w-full py-4 text-rose-500 font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 rounded-2xl transition-all"
                                    >
                                        Sí, descartar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
