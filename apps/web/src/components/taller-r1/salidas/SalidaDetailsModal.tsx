'use client';
import { useState, useEffect } from 'react';
import {
    X,
    Trash2,
    CheckCircle2,
    AlertCircle,
    Truck,
    Box,
    FileText,
    Calendar,
    User,
    ExternalLink,
    Save,
    Mail,
    Edit,
    Edit2,
    Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { salidasApi, Salida } from '@/services/taller-r1/salidas.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { ubicacionesApi, Ubicacion } from '@/services/taller-r1/ubicaciones.service';
import { cn, getErrorMessage } from '@/lib/utils';
import { useAuthTallerStore } from '@/store/auth-taller.store';

interface SubUbicacion {
    id_sub_ubicacion: string;
    nombre: string;
    ubicacion_ocupada: boolean;
}

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

interface SalidaDetailsModalProps {
    id: string | null;
    isOpen: boolean;
    onClose: () => void;
    onRefresh: () => void;
    onEdit?: (id: string) => void;
}

export default function SalidaDetailsModal({ id, isOpen, onClose, onRefresh, onEdit }: SalidaDetailsModalProps) {
    const [salida, setSalida] = useState<Salida | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditingRemision, setIsEditingRemision] = useState(false);
    const [newRemision, setNewRemision] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [checklistModalFor, setChecklistModalFor] = useState<string | null>(null);
    const [itemToRemove, setItemToRemove] = useState<{ id: string, type: 'equipo' | 'accesorio' } | null>(null);
    const { selectedSite, user } = useAuthTallerStore();

    // Cancellation states
    const [cancelEquipoId, setCancelEquipoId] = useState<string | null>(null);
    const [cancelEquipoClase, setCancelEquipoClase] = useState<string | null>(null);
    const [cancelDetalleId, setCancelDetalleId] = useState<string | null>(null);
    const [selectedUbicacionId, setSelectedUbicacionId] = useState<string>('');
    const [selectedSubUbicacionId, setSelectedSubUbicacionId] = useState<string>('');
    const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
    const [subUbicaciones, setSubUbicaciones] = useState<SubUbicacion[]>([]);

    const getBase64ImageFromUrl = async (imageUrl: string): Promise<string> => {
        try {
            let finalUrl = imageUrl;
            // Si la imagen es externa (S3/DigitalOcean), usamos el proxy del backend para evitar CORS
            if (imageUrl.startsWith('http') && !imageUrl.includes(window.location.hostname)) {
                const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api');
                finalUrl = `${apiBase}/taller-r1/proxy-image?url=${encodeURIComponent(imageUrl)}`;
            }

            const response = await fetch(finalUrl);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('Error fetching image for PDF:', imageUrl, error);
            return '';
        }
    };

    const exportToPDF = async (salidaData: Salida, returnBase64: boolean = false) => {
        const doc = new jsPDF();
        const siteName = (selectedSite || 'R1').toUpperCase();

        const logoUrl = window.location.origin + '/fsimage.png';
        const logoBase64 = logoUrl ? await getBase64ImageFromUrl(logoUrl) : null;

        const getBase64 = async (path?: string) => {
            const url = getImageUrl(path);
            if (!url) return null;
            return await getBase64ImageFromUrl(url);
        };

        const firmaReciboBase64 = await getBase64(salidaData.firma);
        const firmaEntregaBase64 = await getBase64(salidaData.firma_usuario);

        // 1. Header (Precise sync with Entradas)
        doc.setLineWidth(0.4);
        doc.setDrawColor(0);

        // Logo column
        if (logoBase64) {
            try {
                doc.addImage(logoBase64, 'PNG', 12, 12, 65, 16);
            } catch (e) {
                console.error('Error adding logo:', e);
            }
        }

        // Vertical line divider at 85
        doc.line(85, 10, 85, 30);

        // Red banner column
        doc.setFillColor(204, 34, 41);
        doc.rect(85, 10, 115, 10, 'F');
        doc.setTextColor(255);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('CORPORACIÓN RAYMOND DE MÉXICO', 142.5, 16.5, { align: 'center' });

        // Title section
        doc.rect(85, 20, 115, 10);
        doc.setTextColor(0);
        doc.setFontSize(14);
        doc.text(`SALIDAS ${siteName}`, 142.5, 27, { align: 'center' });

        // Main box border for header
        doc.rect(10, 10, 190, 20);

        // Info section
        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.setFont('helvetica', 'normal');
        doc.text('FECHA:', 110, 38);
        doc.text(new Date().toLocaleDateString(), 145, 38);
        doc.line(145, 39, 195, 39);

        doc.text('CLIENTE:', 110, 48);
        doc.text(salidaData.razon_social || salidaData.cliente || '-', 145, 48);
        doc.line(145, 49, 195, 49);

        doc.text('PEDIDO VENTA:', 110, 58);
        doc.text(salidaData.pedido || '-', 145, 58);
        doc.line(145, 59, 195, 59);

        doc.text('REMISIÓN:', 110, 68);
        doc.text(salidaData.remision || 'PENDIENTE DE REMISIÓN', 145, 68);
        doc.line(145, 69, 195, 69);

        // Folio box
        doc.rect(15, 40, 50, 10);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(salidaData.folio, 40, 47, { align: 'center' });

        let startY = 80;

        // Equipos
        if (salidaData.detalles && salidaData.detalles.length > 0) {
            doc.setTextColor(204, 0, 0);
            doc.setFontSize(10);
            doc.text('Equipos', 105, startY, { align: 'center' });
            startY += 4;

            autoTable(doc, {
                startY: startY,
                head: [['Marca', 'Modelo', 'Numero Serie', 'Clase', 'Ubicación', 'Sub Ubicación']],
                body: salidaData.detalles.map(d => [
                    d.rel_serie_info?.MARCA || 'Raymond',
                    d.modelo || d.rel_equipo?.modelo || d.rel_serie_info?.MODELO || '-',
                    d.serial_equipos || d.serial || '-',
                    d.clase || d.rel_equipo?.clase || d.rel_serie_info?.clase || '-',
                    d.nombre_ubicacion || d.id_ubicacion || '-',
                    d.nombre_sub_ubicacion || d.id_sub_ubicacion || '-'
                ]),
                theme: 'grid',
                headStyles: { fillColor: [204, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', lineWidth: 0.1, lineColor: [0, 0, 0] },
                styles: { fontSize: 8, halign: 'center', lineWidth: 0.1, lineColor: [0, 0, 0], textColor: [0, 0, 0] },
                margin: { left: 15, right: 15 }
            });
            startY = (doc as any).lastAutoTable.finalY + 10;
        }

        // Accesorios
        if (salidaData.accesorios && salidaData.accesorios.length > 0) {
            doc.setTextColor(204, 0, 0);
            doc.setFontSize(10);
            doc.text('Accesorios', 105, startY, { align: 'center' });
            startY += 4;

            autoTable(doc, {
                startY: startY,
                head: [['Modelo', 'Numero Serie', 'Clase', 'Ubicación', 'Sub Ubicación']],
                body: salidaData.accesorios.map(a => [
                    a.modelo || '-',
                    a.serial || '-',
                    a.clase || 'Batería',
                    a.nombre_ubicacion || '-',
                    a.nombre_sub_ubicacion || '-'
                ]),
                theme: 'grid',
                headStyles: { fillColor: [204, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', lineWidth: 0.1, lineColor: [0, 0, 0] },
                styles: { fontSize: 8, halign: 'center', lineWidth: 0.1, lineColor: [0, 0, 0], textColor: [0, 0, 0] },
                margin: { left: 15, right: 15 }
            });
            startY = (doc as any).lastAutoTable.finalY + 10;
        }

        // Observations
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text('Comentarios', 15, startY);
        startY += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        const splitObs = doc.splitTextToSize(salidaData.observaciones || '-', 180);
        doc.text(splitObs, 15, startY);
        startY += (splitObs.length * 4) + 15;

        // 6. Signatures (Precise sync with Entradas)
        const signatureHeight = 40;
        const pageHeight = doc.internal.pageSize.getHeight();

        if (startY + signatureHeight > pageHeight - 10) {
            doc.addPage();
            startY = 30;
        } else {
            startY += 10;
        }

        doc.setTextColor(0);
        doc.setLineWidth(0.4);
        doc.setDrawColor(0);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);

        // Signature images
        if (firmaReciboBase64) {
            try {
                doc.addImage(firmaReciboBase64, 'PNG', 30, startY + 2, 30, 15);
            } catch (e) {
                console.error('Error adding firma_recibo:', e);
            }
        }
        if (firmaEntregaBase64) {
            try {
                doc.addImage(firmaEntregaBase64, 'PNG', 140, startY + 2, 30, 15);
            } catch (e) {
                console.error('Error adding firma_entrega:', e);
            }
        }

        doc.line(20, startY + 20, 80, startY + 20);
        doc.line(130, startY + 20, 190, startY + 20);

        doc.text('FIRMA RECIBIÓ', 50, startY + 25, { align: 'center' });
        doc.text('FIRMA ENTREGÓ', 160, startY + 25, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(salidaData.nombre_recibe || '-', 50, startY + 29, { align: 'center' });
        doc.text(salidaData.usuario_asignado || '-', 160, startY + 29, { align: 'center' });

        if (returnBase64) {
            return doc.output('datauristring');
        }
        doc.save(`Resumen_Salida_${salidaData.folio}_${new Date().getTime()}.pdf`);
    };

    const exportToExcel = async (salidaData: Salida, returnBase64: boolean = false) => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Resumen Salida');
        const siteName = (selectedSite || 'R1').toUpperCase();

        worksheet.columns = [{ width: 15 }, { width: 15 }, { width: 20 }, { width: 20 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }];

        const headerFill: any = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCC0000' } };
        const whiteFont = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
        const centerAlignment: any = { vertical: 'middle', horizontal: 'center' };
        const borderFull: any = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

        worksheet.mergeCells('A1:H1');
        const mainHeader = worksheet.getCell('A1');
        mainHeader.value = 'CORPORACIÓN RAYMOND DE MÉXICO';
        mainHeader.fill = headerFill;
        mainHeader.font = whiteFont;
        mainHeader.alignment = centerAlignment;

        worksheet.mergeCells('A2:H2');
        worksheet.getCell('A2').value = `SALIDAS ${siteName}`;
        worksheet.getCell('A2').font = { bold: true, size: 14 };
        worksheet.getCell('A2').alignment = centerAlignment;

        let currentRow = 4;
        worksheet.getCell(`A${currentRow}`).value = salidaData.folio;
        worksheet.getCell(`A${currentRow}`).border = borderFull;
        worksheet.getCell(`C${currentRow}`).value = new Date(salidaData.fecha_creacion!).toLocaleString();
        worksheet.getCell(`G${currentRow}`).value = 'CLIENTE';
        worksheet.getCell(`H${currentRow}`).value = salidaData.razon_social || salidaData.cliente || '-';
        worksheet.getCell(`H${currentRow}`).border = { bottom: { style: 'thin' } };

        currentRow += 2;
        worksheet.getCell(`A${currentRow}`).value = 'Pedido de venta';
        worksheet.getCell(`B${currentRow}`).value = salidaData.pedido || 'N/A';
        worksheet.getCell(`D${currentRow}`).value = 'Remisión';
        worksheet.getCell(`E${currentRow}`).value = salidaData.remision || 'PENDIENTE';

        currentRow += 2;
        if (salidaData.detalles && salidaData.detalles.length > 0) {
            worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
            worksheet.getCell(`A${currentRow}`).value = 'Equipos';
            worksheet.getCell(`A${currentRow}`).font = { color: { argb: 'FFCC0000' }, bold: true };
            worksheet.getCell(`A${currentRow}`).alignment = centerAlignment;
            currentRow++;
            ['Marca', 'Modelo', 'Numero Serie', 'Clase', 'Ubicación', 'Sub Ubicación'].forEach((h, i) => {
                const cell = worksheet.getCell(`${String.fromCharCode(65 + i)}${currentRow}`);
                cell.value = h; cell.fill = headerFill; cell.font = whiteFont; cell.alignment = centerAlignment; cell.border = borderFull;
            });
            currentRow++;
            salidaData.detalles.forEach(d => {
                const row = [
                    d.rel_serie_info?.MARCA || 'Raymond',
                    d.modelo || d.rel_equipo?.modelo || d.rel_serie_info?.MODELO || '-',
                    d.serial_equipos || d.serial || '-',
                    d.clase || d.rel_equipo?.clase || d.rel_serie_info?.clase || '-',
                    d.nombre_ubicacion || d.id_ubicacion || '-',
                    d.nombre_sub_ubicacion || d.id_sub_ubicacion || '-'
                ];
                row.forEach((v, i) => { const c = worksheet.getCell(`${String.fromCharCode(65 + i)}${currentRow}`); c.value = v; c.border = borderFull; });
                currentRow++;
            });
            currentRow += 2;
        }

        if (salidaData.accesorios && salidaData.accesorios.length > 0) {
            worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
            worksheet.getCell(`A${currentRow}`).value = 'Accesorios';
            worksheet.getCell(`A${currentRow}`).font = { color: { argb: 'FFCC0000' }, bold: true };
            worksheet.getCell(`A${currentRow}`).alignment = centerAlignment;
            currentRow++;
            ['Modelo', 'Numero Serie', 'Clase', 'Ubicación', 'Sub Ubicación'].forEach((h, i) => {
                const cell = worksheet.getCell(`${String.fromCharCode(65 + i)}${currentRow}`);
                cell.value = h; cell.fill = headerFill; cell.font = whiteFont; cell.alignment = centerAlignment; cell.border = borderFull;
            });
            currentRow++;
            salidaData.accesorios.forEach(a => {
                const row = [a.modelo || '-', a.serial || '-', a.clase || 'Batería', a.nombre_ubicacion || '-', a.nombre_sub_ubicacion || '-'];
                row.forEach((v, i) => { const c = worksheet.getCell(`${String.fromCharCode(65 + i)}${currentRow}`); c.value = v; c.border = borderFull; });
                currentRow++;
            });
            currentRow += 2;
        }

        worksheet.getCell(`A${currentRow}`).value = 'Comentarios';
        worksheet.getCell(`A${currentRow}`).font = { bold: true };
        worksheet.getCell(`A${currentRow + 1}`).value = salidaData.observaciones || '-';

        currentRow += 4;
        worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
        worksheet.getCell(`A${currentRow}`).value = 'RECIBIÓ';
        worksheet.getCell(`A${currentRow}`).fill = headerFill;
        worksheet.getCell(`A${currentRow}`).font = whiteFont;
        worksheet.getCell(`A${currentRow}`).alignment = centerAlignment;

        worksheet.mergeCells(`F${currentRow}:H${currentRow}`);
        worksheet.getCell(`F${currentRow}`).value = 'ENTREGÓ';
        worksheet.getCell(`F${currentRow}`).fill = headerFill;
        worksheet.getCell(`F${currentRow}`).font = whiteFont;
        worksheet.getCell(`F${currentRow}`).alignment = centerAlignment;

        currentRow++;
        worksheet.getCell(`A${currentRow}`).value = 'NOMBRE:';
        worksheet.getCell(`B${currentRow}`).value = salidaData.nombre_recibe || '-';
        worksheet.getCell(`F${currentRow}`).value = 'NOMBRE:';
        worksheet.getCell(`G${currentRow}`).value = salidaData.usuario_asignado || '-';

        const buffer = await workbook.xlsx.writeBuffer();
        if (returnBase64) {
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            return new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });
        }
        saveAs(new Blob([buffer]), `Resumen_Salida_${salidaData.folio}_${new Date().getTime()}.xlsx`);
    };

    const itemIdToRemove = itemToRemove?.id || null;
    const [confirmingAction, setConfirmingAction] = useState<'delete_salida' | 'cerrar_folio' | null>(null);

    useEffect(() => {
        if (id && isOpen) {
            loadSalida();
        }
    }, [id, isOpen]);

    const isSubLibre = (s: SubUbicacion) => {
        const oc: any = s.ubicacion_ocupada;
        return oc === false || oc === 0 || oc === "0" || oc === "false" || oc === null || oc === undefined;
    };

    useEffect(() => {
        if (cancelEquipoId) {
            ubicacionesApi.getAll().then((ubs) => {
                if (cancelEquipoClase) {
                    setUbicaciones(ubs.filter((u: any) => {
                        const claseValue = (u.Clase || '').toLowerCase();
                        return claseValue === cancelEquipoClase.toLowerCase() || 
                               claseValue === '' || 
                               claseValue === 'todas' || 
                               claseValue === 'todas las ubicaciones';
                    }));
                } else {
                    setUbicaciones(ubs);
                }
            });
        } else {
            setSelectedUbicacionId('');
            setSelectedSubUbicacionId('');
            setSubUbicaciones([]);
            setCancelEquipoClase(null);
        }
    }, [cancelEquipoId, cancelEquipoClase]);

    useEffect(() => {
        if (selectedUbicacionId) {
            ubicacionesApi.getSubLocations(selectedUbicacionId).then((subs: SubUbicacion[]) => {
                setSubUbicaciones(subs);
            });
        } else {
            setSubUbicaciones([]);
        }
        setSelectedSubUbicacionId('');
    }, [selectedUbicacionId]);

    const loadSalida = async () => {
        if (!id) return;
        try {
            setLoading(true);
            const data = await salidasApi.getById(id);
            setSalida(data);
            setNewRemision(data.remision || '');
        } catch (error) {
            toast.error(getErrorMessage(error, 'Error al cargar detalles de la salida'));
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateRemision = async () => {
        if (!id || !newRemision) {
            toast.error('Ingresa un número de remisión');
            return;
        }

        setActionLoading(true);
        try {
            await salidasApi.updateRemision(id, newRemision);
            toast.success('Remisión actualizada y estado cambiado a Por Entregar');
            setIsEditingRemision(false);
            loadSalida();
            onRefresh();
        } catch (error) {
            toast.error(getErrorMessage(error, 'Error al actualizar remisión'));
        } finally {
            setActionLoading(false);
        }
    };

    const handleCerrarFolio = async (firma_usuario?: string) => {
        if (!id) return;

        setActionLoading(true);
        try {
            if (firma_usuario) {
                await salidasApi.update(id, { firma_usuario });
                if (salida) salida.firma_usuario = firma_usuario;
            }

            await salidasApi.cerrarFolio(id);
            toast.success('Folio cerrado correctamente');
            
            if (salida) {
                try {
                    toast.info('Generando y enviando correos...');
                    const pdfBase64 = await exportToPDF(salida, true);
                    const excelBase64 = await exportToExcel(salida, true);
                    
                        await salidasApi.sendMail({
                            tipo: 'Salida',
                            folio: salida.folio,
                            fecha: new Date().toLocaleDateString(),
                            site: selectedSite || 'R1',
                            pdfBase64,
                            excelBase64,
                            remision: salida.remision // Pasamos la remisión para el asunto del correo
                        });
                    toast.success('Correos enviados correctamente');
                } catch (e) {
                    console.error('Error al enviar correos:', getErrorMessage(e));
                    toast.error(getErrorMessage(e, 'Error al enviar correos'));
                }
            }

            loadSalida();
            onRefresh();
            setConfirmingAction(null);
        } catch (error) {
            toast.error(getErrorMessage(error, 'Error al cerrar folio'));
        } finally {
            setActionLoading(false);
        }
    };
    
    const handleResendEmail = async () => {
        if (!salida) return;
        setActionLoading(true);
        try {
            toast.info('Generando y enviando correos...');
            const pdfBase64 = await exportToPDF(salida, true);
            const excelBase64 = await exportToExcel(salida, true);
            
            await salidasApi.sendMail({
                tipo: 'Salida',
                folio: salida.folio,
                fecha: new Date().toLocaleDateString(),
                site: selectedSite || 'R1',
                pdfBase64,
                excelBase64,
                remision: salida.remision
            });
            toast.success('Correo reenviado correctamente');
        } catch (error) {
            console.error('Error al reenviar correo:', getErrorMessage(error));
            toast.error(getErrorMessage(error, 'Error al reenviar correo'));
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!id) return;

        setActionLoading(true);
        try {
            await salidasApi.delete(id);
            toast.success('Salida eliminada correctamente');
            onRefresh();
            setConfirmingAction(null);
            onClose();
        } catch (error) {
            toast.error(getErrorMessage(error, 'Error al eliminar salida'));
        } finally {
            setActionLoading(false);
        }
    };
    
    const handleRemoveItem = async () => {
        if (!id || !itemToRemove) return;
        const { id: itemId, type } = itemToRemove;

        setActionLoading(true);
        try {
            if (type === 'equipo') {
                await salidasApi.removeDetalle(id, itemId);
            } else {
                await salidasApi.removeAccesorio(id, itemId);
            }
            toast.success(`${type === 'equipo' ? 'Equipo' : 'Accesorio'} eliminado de la salida`);
            await loadSalida();
            onRefresh();
        } catch (error) {
            toast.error(getErrorMessage(error, `Error al quitar el ${type}`));
        } finally {
            setActionLoading(false);
            setItemToRemove(null);
        }
    };

    const handleConfirmCancelEquipo = async () => {
        if (!id || !cancelEquipoId || !selectedUbicacionId || !selectedSubUbicacionId) {
            toast.error('Selecciona ubicación y sub-ubicación');
            return;
        }

        setActionLoading(true);
        try {
            const userName = user ? `${(user as any).firstName || (user as any).Usuario || ''} ${(user as any).lastName || ''}`.trim() : 'Sistema';
            await salidasApi.cancelarDetalle(id, cancelEquipoId, selectedUbicacionId, selectedSubUbicacionId, userName);
            toast.success('Equipo cancelado y devuelto a inventario correctamente');
            setCancelEquipoId(null);
            loadSalida();
            onRefresh();
        } catch (error: any) {
            toast.error(getErrorMessage(error, 'Error al cancelar equipo'));
        } finally {
            setActionLoading(false);
        }
    };

    const getImageUrl = (path?: string | null) => {
        if (!path) return null;
        if (path.startsWith('http') || path.startsWith('data:')) return path;
        const REMOTE_SERVER = '143.198.60.56';
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        return `http://${REMOTE_SERVER}/${cleanPath}`;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-[32px] shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-white/20">

                {/* Loading Overlay */}
                {(loading || actionLoading) && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-50 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-slate-900 font-black text-xs uppercase tracking-widest">
                                {loading ? 'Cargando detalles...' : 'Procesando...'}
                            </span>
                        </div>
                    </div>
                )}

                {/* Header Premium */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between p-5 lg:p-8 border-b border-slate-200/50 bg-slate-50/50 gap-4 lg:gap-6 relative">
                    <div className="flex items-center gap-3 lg:gap-6">
                        <div className="w-10 h-10 lg:w-16 lg:h-16 rounded-[1rem] lg:rounded-[2rem] bg-slate-900 flex items-center justify-center shadow-xl shadow-slate-200 shrink-0">
                            <FileText className="w-6 h-6 lg:w-8 lg:h-8 text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-0.5">
                                <h2 className="text-xl lg:text-3xl font-black text-slate-900 tracking-tighter">
                                    Folio <span className="text-slate-400">#{salida?.folio || '...'}</span>
                                </h2>
                                <span className={cn(
                                    "px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wide border shadow-sm",
                                    salida?.estado === 'Entregado' ? "bg-green-50 text-green-700 border-green-100" :
                                    (salida?.estado?.toLowerCase() === 'en espera de remisión') ? "bg-red-50 text-red-700 border-red-100" :
                                    "bg-orange-50 text-orange-700 border-orange-100"
                                )}>
                                    {salida?.estado}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-500 text-[10px] lg:text-sm font-medium">
                                <Calendar className="w-3.5 h-3.5" />
                                {salida?.fecha_creacion ? new Date(salida.fecha_creacion).toLocaleDateString() : '---'}
                                <span className="text-slate-300">|</span>
                                <User className="w-3.5 h-3.5" />
                                {salida?.razon_social || salida?.cliente || 'Sin Cliente'}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 lg:gap-4 justify-end">
                        {salida?.estado !== 'Entregado' && (
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={() => setConfirmingAction('delete_salida')}
                                    className="flex items-center gap-2 px-4 lg:px-6 py-3 lg:py-4 bg-white border border-slate-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200 text-slate-700 rounded-2xl font-black text-[10px] lg:text-xs uppercase tracking-widest transition-all active:scale-95"
                                >
                                    <Trash2 className="w-4 h-4" /> Eliminar
                                </button>
                                <button
                                    onClick={() => {
                                        if (onEdit) {
                                            onClose();
                                            setTimeout(() => onEdit(id!), 100);
                                        }
                                    }}
                                    className="flex items-center gap-2 px-4 lg:px-6 py-3 lg:py-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl font-black text-[10px] lg:text-xs uppercase tracking-widest transition-all active:scale-95"
                                >
                                    <Edit className="w-4 h-4" /> Editar
                                </button>
                            </div>
                        )}

                        {(salida?.estado?.toLowerCase() === 'por entregar' || salida?.estado?.toLowerCase() === 'en espera de remisión' || salida?.estado?.toLowerCase() === 'en espera de remision') && (
                            <button
                                onClick={() => setConfirmingAction('cerrar_folio')}
                                disabled={actionLoading}
                                className="flex items-center gap-3 px-6 lg:px-8 py-3 lg:py-4 bg-green-600 hover:bg-green-700 disabled:bg-slate-200 text-white rounded-2xl font-black text-[10px] lg:text-xs uppercase tracking-widest shadow-xl shadow-green-100 transition-all hover:scale-105 active:scale-95 animate-in zoom-in-95 duration-300"
                            >
                                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                                Cerrar Folio
                            </button>
                        )}

                        {salida?.estado === 'Entregado' && (
                            <div className="flex flex-wrap items-center gap-2 lg:gap-3">
                                <button
                                    onClick={() => salida && exportToPDF(salida)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold text-[10px] uppercase tracking-wide transition-all active:scale-95 shadow-sm"
                                >
                                    <FileText className="w-3.5 h-3.5 text-red-500" /> PDF
                                </button>
                                <button
                                    onClick={() => salida && exportToExcel(salida)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold text-[10px] uppercase tracking-wide transition-all active:scale-95 shadow-sm"
                                >
                                    <Box className="w-3.5 h-3.5 text-emerald-500" /> Excel
                                </button>
                                <button
                                    onClick={handleResendEmail}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-100 hover:bg-blue-200 text-blue-600 rounded-xl font-bold text-[10px] uppercase tracking-wide transition-all active:scale-95 shadow-sm"
                                >
                                    <Mail className="w-3.5 h-3.5 text-blue-600" /> Correo
                                </button>
                                <div className="px-3 py-1.5 bg-slate-900 text-white rounded-xl font-bold text-[10px] uppercase tracking-wide shadow-md flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Entregado
                                </div>
                            </div>
                        )}

                        <button
                            onClick={onClose}
                            className="p-2 bg-white border border-slate-200 text-slate-500 rounded-full hover:bg-slate-100 hover:text-red-600 transition-all shadow-sm shrink-0"
                        >
                            <X className="w-5 h-5 stroke-[3px]" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-white grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Left Column: Details */}
                    <div className="lg:col-span-8 space-y-8">

                        {/* Remision / OC Section */}
                        <div className="p-5 sm:p-6 bg-slate-50 rounded-[24px] border border-slate-100">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-red-500" />
                                    Información de Remisión / OC
                                </h3>
                                {salida?.estado?.toLowerCase() === 'en espera de remisión' && !isEditingRemision && (
                                    <button
                                        onClick={() => setIsEditingRemision(true)}
                                        className="flex items-center gap-1.5 text-[10px] font-black text-red-600 uppercase tracking-widest hover:bg-red-50 px-2 py-1 rounded-lg transition-all border border-red-100"
                                    >
                                        <Edit2 className="w-3 h-3" />
                                        Asignar remisión
                                    </button>
                                )}
                            </div>

                            {isEditingRemision ? (
                                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
                                    <div className="flex-1">
                                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">Nuevo Número de Remisión</label>
                                        <input
                                            type="text"
                                            value={newRemision}
                                            onChange={(e) => setNewRemision(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-red-500 font-bold"
                                            placeholder="Ej: R-12345"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleUpdateRemision}
                                            className="flex-1 sm:flex-none p-3 bg-red-600 text-white rounded-xl hover:bg-red-700 shadow-lg shadow-red-500/20 flex justify-center"
                                        >
                                            <Save className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => setIsEditingRemision(false)}
                                            className="flex-1 sm:flex-none p-3 bg-slate-200 text-slate-600 rounded-xl hover:bg-slate-300 flex justify-center"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Remisión / OC</p>
                                        <p className="font-black text-slate-900 tracking-tight">{salida?.remision || 'PENDIENTE'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Pedido de Venta</p>
                                        <p className="font-black text-slate-900 tracking-tight">{salida?.pedido || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Transporte</p>
                                        <p className="font-black text-slate-900 tracking-tight">{salida?.numero_transporte || 'N/A'}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Items Section */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-2">
                                <Box className="w-4 h-4 text-red-500" />
                                Elementos en esta Salida ({(salida?.detalles?.length || 0) + (salida?.accesorios?.length || 0)})
                            </h3>

                            <div className="grid grid-cols-1 gap-3">
                                {/* Equipos */}
                                {salida?.detalles?.filter(d => d.serial_equipos || d.id_equipo || d.cantidad_salida > 0).map((item, idx) => (
                                    <div key={`eq-${idx}`} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between shadow-sm">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-red-500">
                                                <Box className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="font-black text-slate-900 tracking-tight leading-none">{item.serial_equipos || 'Sin Serial'}</p>
                                                    {(item.modelo || item.rel_serie_info?.MODELO || item.clase || item.rel_serie_info?.clase) && (
                                                        <span className="px-1.5 py-0.5 bg-slate-900 text-white text-[7px] font-black rounded uppercase tracking-wider">
                                                            {item.modelo || item.rel_serie_info?.MODELO || '-'} | {item.clase || item.rel_serie_info?.clase || '-'}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                    {item.tipo_salida} • {(item as any).nombre_ubicacion || item.id_ubicacion} {(item as any).nombre_sub_ubicacion || item.id_sub_ubicacion}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right flex flex-col items-end gap-2">
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[8px] font-black rounded uppercase tracking-wider">EQUIPO</span>
                                            <div className="flex gap-2">
                                                {(item.foto_llave || item.foto_kit_tapon || item.foto_compartimento_baterias) && (
                                                    <button
                                                        onClick={() => setChecklistModalFor(item.id_detalle)}
                                                        className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-colors"
                                                    >
                                                        Ver Checklist
                                                    </button>
                                                )}
                                                {salida?.estado !== 'Entregado' && (
                                                    <button
                                                        onClick={() => setItemToRemove({ id: item.id_detalle, type: 'equipo' })}
                                                        className="px-2 py-1 bg-red-50 text-red-600 border border-red-100 rounded-lg hover:bg-red-100 transition-colors"
                                                        title="Quitar equipo de la salida"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                                {salida?.estado === 'Entregado' && (selectedSite === 'r3' || selectedSite === 'r2') && (
                                                    <button
                                                        onClick={() => {
                                                            setCancelEquipoId(item.id_detalle);
                                                            setCancelEquipoClase(item.filtro_clase || null);
                                                        }}
                                                        className="px-2 py-1 bg-red-50 text-red-600 border border-red-100 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-colors"
                                                        title="Cancelar salida de este equipo"
                                                    >
                                                        Cancelar Salida
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Accesorios */}
                                {salida?.accesorios?.map((item, idx) => (
                                    <div key={`acc-${idx}`} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between shadow-sm">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-blue-500">
                                                <Box className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-900 tracking-tight leading-none mb-1">{item.serial || 'Sin Serial'}</p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                    {item.modelo} • {item.voltaje}V
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right flex flex-col items-end gap-2">
                                            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-black rounded uppercase tracking-wider">ACCESORIO</span>
                                            {salida?.estado !== 'Entregado' && (
                                                <button
                                                    onClick={() => setItemToRemove({ id: item.id_accesorio, type: 'accesorio' })}
                                                    className="px-2 py-1 bg-red-50 text-red-600 border border-red-100 rounded-lg hover:bg-red-100 transition-colors"
                                                    title="Quitar accesorio de la salida"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>

                    {/* Right Column: Sidebar */}
                    <div className="lg:col-span-4 space-y-6">

                        {/* Evidence Section */}
                        <div className="space-y-3">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Evidencia</h3>
                            <div className="aspect-square w-full bg-slate-100 rounded-[24px] overflow-hidden border border-slate-200">
                                {salida?.evidencia ? (
                                    <img
                                        src={getImageUrl(salida.evidencia)!}
                                        className="w-full h-full object-cover"
                                        alt="Evidencia"
                                    />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                                        <FileText className="w-12 h-12 mb-2" />
                                        <span className="font-bold text-xs">Sin evidencia</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Observations Section */}
                        <div className="space-y-3">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Observaciones</h3>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 min-h-[100px]">
                                <p className="text-xs text-slate-600 font-medium whitespace-pre-wrap">
                                    {salida?.observaciones || 'Sin observaciones registradas.'}
                                </p>
                            </div>
                        </div>

                        {/* Signatures Section */}
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Firmas de Autorización</h3>
                            <div className="grid grid-cols-1 gap-4">
                                {/* User Signature */}
                                <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">Entregó: {salida?.usuario_asignado || '---'}</p>
                                    <div className="aspect-[2/1] bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center border border-slate-50">
                                        {salida?.firma_usuario ? (
                                            <img src={getImageUrl(salida.firma_usuario)!} className="h-full object-contain" alt="Firma Entregó" />
                                        ) : (
                                            <span className="text-[10px] text-slate-300 font-bold uppercase">Sin firma</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>



                    </div>

                </div>

            </div>

            {/* NESTED MODAL FOR CHECKLIST VIEWER */}
            {checklistModalFor && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-100 animate-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-50 flex items-center justify-between sticky top-0 bg-white z-10">
                            <div>
                                <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                                    <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                                    Checklist Fotográfico
                                </h4>
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mt-1 ml-4">
                                    Registro fotográfico de salida del equipo
                                </p>
                                {(() => {
                                    const item = salida?.detalles?.find(i => i.id_detalle === checklistModalFor);
                                    const evaluador = (item as any)?.checklist_entrega?._evaluador;
                                    return evaluador ? (
                                        <div className="mt-2 ml-4 flex items-center gap-2">
                                            <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center shrink-0">
                                                <CheckCircle2 className="w-3 h-3 text-white" />
                                            </div>
                                            <p className="text-[10px] font-black text-indigo-700 uppercase tracking-wider">
                                                Evaluado por: <span className="normal-case tracking-normal">{evaluador}</span>
                                            </p>
                                        </div>
                                    ) : null;
                                })()}
                            </div>
                            <button onClick={() => setChecklistModalFor(null)} className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
                            {/* OBLIGATORY PHOTOS */}
                            <div>
                                <h5 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    Fotografías Obligatorias
                                </h5>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                    {OBLIGATORY_PHOTOS.map(photo => {
                                        const item = salida?.detalles?.find(i => i.id_detalle === checklistModalFor);
                                        const photoData = item?.[photo.key];
                                        return (
                                            <div key={photo.key} className="flex flex-col gap-2">
                                                <div className={cn(
                                                    "relative flex flex-col items-center justify-center w-full aspect-square border border-slate-200 rounded-2xl overflow-hidden shadow-sm group",
                                                    !photoData && "bg-slate-50 opacity-50"
                                                )}>
                                                    {photoData ? (
                                                        <>
                                                            <img src={getImageUrl(photoData)!} alt={photo.label} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                                            <a href={getImageUrl(photoData)!} target="_blank" rel="noopener noreferrer" className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/20 transition-colors flex items-center justify-center">
                                                                <ExternalLink className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            </a>
                                                        </>
                                                    ) : (
                                                        <div className="text-slate-300 flex flex-col items-center">
                                                            <X className="w-6 h-6 mb-1" />
                                                            <span className="text-[8px] font-bold uppercase">Sin Foto</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-600 text-center uppercase leading-tight tracking-wider">{photo.label}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* OPTIONAL PHOTOS */}
                            <div>
                                <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Box className="w-4 h-4 text-slate-400" />
                                    Fotografías Opcionales
                                </h5>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                    {OPTIONAL_PHOTOS.map(photo => {
                                        const item = salida?.detalles?.find(i => i.id_detalle === checklistModalFor);
                                        const photoData = item?.[photo.key];
                                        if (!photoData) return null; // Only render provided optional photos

                                        return (
                                            <div key={photo.key} className="flex flex-col gap-2">
                                                <div className="relative flex flex-col items-center justify-center w-full aspect-square border border-slate-200 rounded-2xl overflow-hidden shadow-sm group">
                                                    <img src={getImageUrl(photoData)!} alt={photo.label} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                                    <a href={getImageUrl(photoData)!} target="_blank" rel="noopener noreferrer" className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/20 transition-colors flex items-center justify-center">
                                                        <ExternalLink className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </a>
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-500 text-center uppercase leading-tight tracking-wider">{photo.label}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* NESTED MODAL FOR CANCELING EQUIPO */}
            {cancelEquipoId && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 min-h-[50vh]">
                    <div className="bg-white rounded-[24px] shadow-2xl max-w-md w-full overflow-hidden border border-slate-100">
                        <div className="p-6 text-center border-b border-slate-100">
                            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-red-100/50">
                                <AlertCircle className="w-8 h-8 text-red-500" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">
                                Cancelar Salida de Equipo
                            </h3>
                            <p className="text-sm text-slate-500 font-medium">
                                Esta acción devolverá el equipo al inventario disponible. Por favor, selecciona la nueva ubicación donde será almacenado.
                            </p>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                    Nueva Ubicación <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={selectedUbicacionId}
                                    onChange={(e) => setSelectedUbicacionId(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 font-medium text-sm transition-all text-slate-700"
                                >
                                    <option value="">Selecciona una ubicación</option>
                                    {ubicaciones.map(u => (
                                        <option key={u.id_ubicacion} value={u.id_ubicacion}>
                                            {u.nombre_ubicacion}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {selectedUbicacionId && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex justify-between">
                                        Sub Ubicación <span className="text-red-500">*</span>
                                        <span className="text-emerald-500/80 normal-case tracking-normal font-semibold">
                                            {subUbicaciones.filter(isSubLibre).length} disponibles
                                        </span>
                                    </label>
                                    <select
                                        value={selectedSubUbicacionId}
                                        onChange={(e) => setSelectedSubUbicacionId(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 font-medium text-sm transition-all text-slate-700 disabled:opacity-50"
                                        disabled={subUbicaciones.length === 0}
                                    >
                                        <option value="">Selecciona una sub ubicación</option>
                                        {subUbicaciones.map(s => (
                                            <option key={s.id_sub_ubicacion} value={s.id_sub_ubicacion} disabled={!isSubLibre(s)}>
                                                {s.nombre} {!isSubLibre(s) ? '(Ocupada)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                    
                                    {subUbicaciones.length === 0 && selectedUbicacionId && (
                                        <p className="text-xs text-red-500 mt-2 font-medium">
                                            No hay subUbicaciones en esta ubicación.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-slate-100 flex gap-3 bg-slate-50/50">
                            <button
                                onClick={() => setCancelEquipoId(null)}
                                className="flex-1 px-6 py-3.5 text-slate-600 bg-white border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-colors shadow-sm"
                            >
                                CANCELAR
                            </button>
                            <button
                                onClick={handleConfirmCancelEquipo}
                                disabled={!selectedUbicacionId || !selectedSubUbicacionId || actionLoading}
                                className="flex-1 px-6 py-3.5 bg-red-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {actionLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        PROCESANDO
                                    </>
                                ) : (
                                    'CONFIRMAR'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Remove Item Confirmation Modal */}
            {itemToRemove && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100">
                        <div className="p-6">
                            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mb-4">
                                <Trash2 className="w-6 h-6" />
                            </div>
                            <h4 className="text-xl font-black text-slate-900 mb-2">
                                Quitar {itemToRemove?.type === 'equipo' ? 'Equipo' : 'Accesorio'}
                            </h4>
                            <p className="text-sm font-medium text-slate-500 leading-relaxed">
                                ¿Estás seguro de que deseas quitar este {itemToRemove?.type} de la salida?
                                Esta acción lo desvinculará de la salida actual.
                            </p>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                            <button
                                onClick={() => setItemToRemove(null)}
                                disabled={actionLoading}
                                className="flex-1 px-4 py-2.5 bg-white text-slate-700 font-bold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors uppercase tracking-wider text-xs"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleRemoveItem}
                                disabled={actionLoading}
                                className="flex-1 px-4 py-2.5 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 transition-all uppercase tracking-wider text-xs shadow-lg shadow-red-200 flex items-center justify-center gap-2"
                            >
                                {actionLoading ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>Quitar Elemento</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* General Action Confirmation Modal (Delete / Close) */}
            {confirmingAction && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100">
                        <div className="p-6">
                            <div className={cn(
                                "w-12 h-12 rounded-2xl flex items-center justify-center mb-4",
                                confirmingAction === 'delete_salida' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                            )}>
                                {confirmingAction === 'delete_salida' ? <Trash2 className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                            </div>
                            <h4 className="text-xl font-black text-slate-900 mb-2">
                                {confirmingAction === 'delete_salida' ? 'Eliminar Salida' : 'Completar Salida'}
                            </h4>
                            <p className="text-sm font-medium text-slate-500 leading-relaxed">
                                {confirmingAction === 'delete_salida'
                                    ? '¿Estás seguro de eliminar esta salida? Esta acción borrará el registro y no se puede deshacer.'
                                    : '¿Estás seguro de cerrar este folio? Todos los equipos y accesorios asociados cambiarán su estado a RETIRADOS y la salida no podrá modificarse.'}
                            </p>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                            <button
                                onClick={() => setConfirmingAction(null)}
                                disabled={actionLoading}
                                className="flex-1 px-4 py-2.5 bg-white text-slate-700 font-bold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors uppercase tracking-wider text-xs"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    if (confirmingAction === 'delete_salida') {
                                        handleDelete();
                                    } else {
                                        setConfirmingAction(null);
                                        setShowSignatureModal(true);
                                    }
                                }}
                                disabled={actionLoading}
                                className={cn(
                                    "flex-1 px-4 py-2.5 text-white font-black rounded-xl transition-all uppercase tracking-wider text-xs flex items-center justify-center gap-2",
                                    confirmingAction === 'delete_salida'
                                        ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200'
                                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200'
                                )}
                            >
                                {actionLoading ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>{confirmingAction === 'delete_salida' ? 'Eliminar' : 'Confirmar'}</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        {/* Signature Capture Modal */}
        {showSignatureModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
                <div className="bg-white rounded-[2rem] shadow-2xl max-w-2xl w-full p-8 border border-slate-100 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <h5 className="text-2xl font-black text-slate-900 mb-6 text-center">Firma de Entrega Final</h5>

                    {/* User Signature */}
                    <div className="mb-8">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                            Firma del Usuario que Entrega <span className="text-red-500">*</span>
                        </label>
                        <div className="border-2 border-slate-200 rounded-2xl overflow-hidden bg-slate-50 relative aspect-[2/1]">
                            <canvas
                                ref={(el) => {
                                    if (el && !el.dataset.initialized) {
                                        el.width = el.offsetWidth;
                                        el.height = el.offsetHeight;
                                        el.dataset.initialized = 'true';
                                        const ctx = el.getContext('2d');
                                        if (ctx) {
                                            let drawing = false;
                                            const startDrawing = (e: any) => {
                                                drawing = true;
                                                ctx.beginPath();
                                                const rect = el.getBoundingClientRect();
                                                const x = (e.clientX || e.touches[0].clientX) - rect.left;
                                                const y = (e.clientY || e.touches[0].clientY) - rect.top;
                                                ctx.moveTo(x, y);
                                            };
                                            const stopDrawing = () => drawing = false;
                                            const draw = (e: any) => {
                                                if (!drawing) return;
                                                const rect = el.getBoundingClientRect();
                                                const x = (e.clientX || e.touches[0].clientX) - rect.left;
                                                const y = (e.clientY || e.touches[0].clientY) - rect.top;
                                                ctx.lineTo(x, y);
                                                ctx.stroke();
                                                if (e.touches) e.preventDefault();
                                            };

                                            el.addEventListener('mousedown', startDrawing);
                                            el.addEventListener('mouseup', stopDrawing);
                                            el.addEventListener('mousemove', draw);
                                            el.addEventListener('touchstart', startDrawing);
                                            el.addEventListener('touchend', stopDrawing);
                                            el.addEventListener('touchmove', draw);

                                            ctx.lineWidth = 3;
                                            ctx.lineCap = 'round';
                                            ctx.strokeStyle = '#0f172a';
                                        }
                                    }
                                }}
                                className="w-full h-full cursor-crosshair"
                                id="finalSignatureCanvas"
                            />
                            <button
                                onClick={() => {
                                    const canvas = document.getElementById('finalSignatureCanvas') as HTMLCanvasElement;
                                    const ctx = canvas?.getContext('2d');
                                    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
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
                                const userCanvas = document.getElementById('finalSignatureCanvas') as HTMLCanvasElement;
                                const userSig = userCanvas?.toDataURL('image/png');

                                setShowSignatureModal(false);
                                handleCerrarFolio(userSig);
                            }}
                            className="flex-1 py-4 bg-red-600 text-white font-black rounded-2xl hover:bg-red-700 transition-all shadow-xl shadow-red-200 uppercase tracking-widest text-[10px]"
                        >
                            Firmar y Cerrar Folio
                        </button>
                    </div>
                </div>
            </div>
        )}

        </div>
    );
}
