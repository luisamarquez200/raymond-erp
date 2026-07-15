import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { entradasApi, Entrada } from '@/services/taller-r1/entradas.service';
import { ubicacionesApi, Ubicacion } from '@/services/taller-r1/ubicaciones.service';
import { Loader2, Calendar, User, UserCheck, AlertCircle, FileText, Package, Wrench, MessageSquare, CheckCircle2, Image as ImageIcon, X, MapPin, Tag, Truck, ShoppingBag, QrCode, Move, Printer, PackageCheck, Star, Trash2, Edit, Mail } from 'lucide-react';
import { EvaluacionModal } from '@/components/taller-r1/evaluaciones/EvaluacionModal';
import { MovilizacionModal } from '../equipo-ubicacion/MovilizacionModal';
import { equipoUbicacionApi } from '@/services/taller-r1/equipo-ubicacion.service';
import { generateQRLabel, generateMultipleQRLabels } from '@/lib/generateQRLabel';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';
import HistoryView from '@/components/taller-r1/evaluaciones/HistoryView';
import { useAuthTallerStore } from '@/store/auth-taller.store';


interface EntradaDetailsModalProps {
    entradaId: string | null;
    open: boolean;
    onClose: () => void;
    onEdit?: (id: string) => void;
    onDeleteSuccess?: () => void;
    onSuccess?: () => void;
}

const getImageUrl = (path?: string) => {
    if (!path) return '';
    if (path.startsWith('data:image')) return path;
    if (path.startsWith('http')) return path;

    let baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api').replace('/api', '');

    // Dynamic localhost fix for mobile/ip access
    if (typeof window !== 'undefined' && baseUrl.includes('localhost') && !window.location.hostname.includes('localhost')) {
        baseUrl = baseUrl.replace('localhost', window.location.hostname);
    }

    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `${baseUrl}/${cleanPath}`;
};

export function EntradaDetailsModal({ entradaId, open, onClose, onEdit, onDeleteSuccess, onSuccess }: EntradaDetailsModalProps) {
    const [loading, setLoading] = useState(false);
    const [entrada, setEntrada] = useState<Entrada | null>(null);
    const [detalles, setDetalles] = useState<any[]>([]);
    const [accesorios, setAccesorios] = useState<any[]>([]);
    const [ubicarModalOpen, setUbicarModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<{ id: string, tipo: 'equipo' | 'accesorio' } | null>(null);

    // Estados para Ubicación logic
    const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
    const [selectedUbicacion, setSelectedUbicacion] = useState<string>('');
    const [selectedRack, setSelectedRack] = useState<string>('');
    const [subUbicacionSugerida, setSubUbicacionSugerida] = useState<any>(null);
    const [availableSubLocations, setAvailableSubLocations] = useState<any[]>([]);
    const [loadingSubLocation, setLoadingSubLocation] = useState(false);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    const [showUbicarConfirm, setShowUbicarConfirm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isUbiking, setIsUbiking] = useState(false);
    // Sub-ubicaciones ya reservadas en esta sesión (asignadas a otros ítems aún no formalizados)
    const [reservedSubIds, setReservedSubIds] = useState<Set<string>>(new Set());
    const [evalModalOpen, setEvalModalOpen] = useState(false);
    const [evalItem, setEvalItem] = useState<any>(null);
    const [evalId, setEvalId] = useState<string | undefined>(undefined);

    // Estados para Movilización
    const [movilizacionModalOpen, setMovilizacionModalOpen] = useState(false);
    const [movilizacionData, setMovilizacionData] = useState<any>(null);

    const { user } = useAuthStore();
    const { selectedSite } = useAuthTallerStore();

    useEffect(() => {
        if (open && entradaId) {
            loadDetails(entradaId);
            loadUbicaciones();
        } else {
            setEntrada(null);
            setDetalles([]);
            setAccesorios([]);
            setUbicarModalOpen(false);
            setSelectedItem(null);
            resetUbicarState();
            setReservedSubIds(new Set());
        }
    }, [open, entradaId]);

    const loadUbicaciones = async () => {
        try {
            const data = await ubicacionesApi.getAll();
            setUbicaciones(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error loading locations:', error);
        }
    };

    const resetUbicarState = () => {
        setSelectedItem(null);
        setSelectedUbicacion('');
        setSelectedRack('');
        setSubUbicacionSugerida(null);
        setAvailableSubLocations([]);
        setLoadingSubLocation(false);
    };

    const handleUbicarEquipos = () => {
        if (!entradaId) return;
        setShowUbicarConfirm(true);
    };

    const exportToExcelTotal = async (entradaData: Entrada, detallesData: any[], accesoriosData: any[], returnBase64: boolean = false) => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Resumen Entrada');

        // Column widths
        worksheet.columns = [
            { width: 15 }, // A
            { width: 15 }, // B
            { width: 20 }, // C
            { width: 20 }, // D
            { width: 15 }, // E
            { width: 15 }, // F
            { width: 15 }, // G
            { width: 15 }, // H
        ];

        // Styles
        const headerFill: any = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCC0000' } };
        const whiteFont = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
        const centerAlignment: any = { vertical: 'middle', horizontal: 'center' };
        const borderFull: any = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };

        // 1. CORPORACIÓN RAYMOND DE MÉXICO
        worksheet.mergeCells('A1:H1');
        const mainHeader = worksheet.getCell('A1');
        mainHeader.value = 'CORPORACIÓN RAYMOND DE MÉXICO';
        mainHeader.fill = headerFill;
        mainHeader.font = whiteFont;
        mainHeader.alignment = centerAlignment;

        // 2. ENTRADAS R3
        worksheet.mergeCells('A2:H2');
        const subHeader = worksheet.getCell('A2');
        const siteName = (selectedSite || 'R1').toUpperCase();
        subHeader.value = `ENTRADAS ${siteName}`;
        subHeader.font = { bold: true, size: 14 };
        subHeader.alignment = centerAlignment;

        // Spacer
        let currentRow = 4;

        // 3. Info Section (Folio, Date, Cliente)
        worksheet.getCell(`A${currentRow}`).value = entradaData.folio;
        worksheet.getCell(`A${currentRow}`).border = borderFull;
        worksheet.getCell(`C${currentRow}`).value = new Date(entradaData.fecha_creacion).toLocaleString();

        worksheet.getCell(`G${currentRow}`).value = 'CLIENTE';
        worksheet.getCell(`G${currentRow}`).font = { bold: true };
        worksheet.mergeCells(`H${currentRow}:J${currentRow}`); // Extends slightly beyond H
        const clienteCell = worksheet.getCell(`H${currentRow}`);
        clienteCell.value = entradaData.rel_cliente?.nombre_cliente || entradaData.cliente || '-';
        clienteCell.border = { bottom: { style: 'thin' } };

        currentRow += 2;

        // 4. Equipment Table
        if (detallesData.length > 0) {
            worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
            const title = worksheet.getCell(`A${currentRow}`);
            title.value = 'Equipos';
            title.font = { color: { argb: 'FFCC0000' }, bold: true, size: 12 };
            title.alignment = centerAlignment;
            currentRow++;

            const headers = ['Marca', 'Modelo', 'Numero Serie', 'Clase', 'Ubicacion', 'Sub Ubicacion'];
            headers.forEach((h, i) => {
                const cell = worksheet.getCell(`${String.fromCharCode(65 + i)}${currentRow}`);
                cell.value = h;
                cell.fill = headerFill;
                cell.font = whiteFont;
                cell.alignment = centerAlignment;
                cell.border = borderFull;
            });
            currentRow++;

            detallesData.forEach(d => {
                worksheet.getCell(`A${currentRow}`).value = d.rel_serie_info?.MARCA || 'Raymond';
                worksheet.getCell(`B${currentRow}`).value = d.modelo || d.rel_equipo?.modelo || d.rel_serie_info?.MODELO || '-';
                worksheet.getCell(`C${currentRow}`).value = d.serial_equipo || d.serial || '-';
                worksheet.getCell(`D${currentRow}`).value = d.clase || d.rel_equipo?.clase || d.rel_serie_info?.clase || '-';
                worksheet.getCell(`E${currentRow}`).value = d.rel_ubicacion?.nombre_ubicacion || '-';
                worksheet.getCell(`F${currentRow}`).value = d.rel_sub_ubicacion?.nombre || '-';

                // Borders for data
                for (let i = 0; i < 6; i++) {
                    worksheet.getCell(`${String.fromCharCode(65 + i)}${currentRow}`).border = borderFull;
                }
                currentRow++;
            });
            currentRow += 2;
        }

        // 5. Accessories Table
        if (accesoriosData.length > 0) {
            worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
            const title = worksheet.getCell(`A${currentRow}`);
            title.value = 'Accesorios';
            title.font = { color: { argb: 'FFCC0000' }, bold: true, size: 12 };
            title.alignment = centerAlignment;
            currentRow++;

            const headers = ['Modelo', 'Numero Serie', 'Clase', 'Ubicacion', 'Sub Ubicacion'];
            headers.forEach((h, i) => {
                const cell = worksheet.getCell(`${String.fromCharCode(65 + i)}${currentRow}`);
                cell.value = h;
                cell.fill = headerFill;
                cell.font = whiteFont;
                cell.alignment = centerAlignment;
                cell.border = borderFull;
            });
            currentRow++;

            accesoriosData.forEach(a => {
                worksheet.getCell(`A${currentRow}`).value = a.modelo || '-';
                worksheet.getCell(`B${currentRow}`).value = a.serial || '-';
                worksheet.getCell(`C${currentRow}`).value = a.clase || 'Batería';
                worksheet.getCell(`D${currentRow}`).value = a.rel_ubicacion?.nombre_ubicacion || '-';
                worksheet.getCell(`E${currentRow}`).value = a.rel_sub_ubicacion?.nombre || '-';

                // Borders for data
                for (let i = 0; i < 5; i++) {
                    worksheet.getCell(`${String.fromCharCode(65 + i)}${currentRow}`).border = borderFull;
                }
                currentRow++;
            });
            currentRow += 2;
        }

        // 6. Comments
        worksheet.getCell(`A${currentRow}`).value = 'Comentarios';
        worksheet.getCell(`A${currentRow}`).font = { bold: true };
        currentRow += 2;

        // 7. Signatures (Simplified: Recibio only)
        worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
        const recibioHeader = worksheet.getCell(`A${currentRow}`);
        recibioHeader.value = 'RECIBIO';
        recibioHeader.fill = headerFill;
        recibioHeader.font = whiteFont;
        recibioHeader.alignment = centerAlignment;
        currentRow++;

        worksheet.getCell(`A${currentRow}`).value = 'NOMBRE:';
        worksheet.getCell(`B${currentRow}`).value = entradaData.usuario_asignado || 'Sistema';
        worksheet.getCell(`B${currentRow}`).border = { bottom: { style: 'thin' } };

        const buffer = await workbook.xlsx.writeBuffer();
        if (returnBase64) {
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            return new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });
        }
        saveAs(new Blob([buffer]), `Resumen_${entradaData.folio}_${new Date().getTime()}.xlsx`);
    };

    const getBase64ImageFromUrl = async (imageUrl: string): Promise<string> => {
        try {
            // If it's already a data URL, return it
            if (imageUrl.startsWith('data:')) return imageUrl;

            let finalUrl = imageUrl;
            // Si la imagen es externa (S3/DigitalOcean), usamos el proxy del backend para evitar CORS
            if (imageUrl.startsWith('http') && !imageUrl.includes(window.location.hostname)) {
                const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api');
                finalUrl = `${apiBase}/taller-r1/proxy-image?url=${encodeURIComponent(imageUrl)}`;
            }

            const response = await fetch(finalUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('Error fetching image for PDF:', imageUrl, error);
            // Return a placeholder or empty if it fails to avoid breaking the PDF generation
            return '';
        }
    };

    const exportToPDFTotal = async (entradaData: Entrada, detallesData: any[], accesoriosData: any[], returnBase64: boolean = false) => {
        const doc = new jsPDF();
        const siteName = (selectedSite || 'R1').toUpperCase();

        // 1. Pre-fetch all necessary images
        const logoUrl = window.location.origin + '/fsimage.png';
        const logoBase64 = await getBase64ImageFromUrl(logoUrl);

        const firmaReciboBase64 = entradaData.firma_recibo ? await getBase64ImageFromUrl(getImageUrl(entradaData.firma_recibo)) : null;

        const detallesConImagenes = await Promise.all(detallesData.map(async (d) => ({
            ...d,
            img1: d.evidencia_1 ? await getBase64ImageFromUrl(getImageUrl(d.evidencia_1)) : null,
            img2: d.evidencia_2 ? await getBase64ImageFromUrl(getImageUrl(d.evidencia_2)) : null,
            img3: d.evidencia_3 ? await getBase64ImageFromUrl(getImageUrl(d.evidencia_3)) : null,
        })));

        const accesoriosConImagenes = await Promise.all(accesoriosData.map(async (a) => ({
            ...a,
            img: a.evidencia ? await getBase64ImageFromUrl(getImageUrl(a.evidencia)) : null,
        })));

        // 2. Define Header Helper (Standardized borders to ~1px)
        const drawHeader = () => {
            doc.setLineWidth(0.4);
            doc.setDrawColor(0);

            // Logo column
            if (logoBase64) {
                doc.addImage(logoBase64, 'PNG', 12, 12, 65, 16);
            } else {
                doc.setFontSize(18);
                doc.setTextColor(204, 34, 41);
                doc.text('RAYMOND', 45, 22, { align: 'center' });
            }

            // Vertical line divider
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
            doc.text(`ENTRADAS ${siteName}`, 142.5, 27, { align: 'center' });

            // Main box border for header
            doc.rect(10, 10, 190, 20);

            // Info section
            doc.setFontSize(10);
            doc.setTextColor(0);
            doc.setFont('helvetica', 'normal');
            doc.text('FECHA:', 110, 38);
            doc.text(new Date(entradaData.fecha_creacion).toLocaleString(), 145, 38);
            doc.line(145, 39, 195, 39);

            doc.text('CLIENTE:', 110, 48);
            const clienteNombre = entradaData.rel_cliente?.nombre_cliente || entradaData.cliente || 'Desconocido';
            doc.text(clienteNombre, 145, 48);
            doc.line(145, 49, 195, 49);

            // Folio box
            doc.rect(15, 40, 50, 10);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(entradaData.folio, 40, 47, { align: 'center' });

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text('FACTURA /', 15, 54);
            doc.text('EMBARQUE:', 15, 58);
            doc.text(entradaData.factura || '-', 60, 56);
        };

        drawHeader();

        let startY = 65;

        // 3. Equipment Table
        if (detallesConImagenes.length > 0) {
            doc.setTextColor(204, 34, 41);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text('Equipos', 105, startY, { align: 'center' });
            startY += 4;

            const bodyRows: any[] = [];
            detallesConImagenes.forEach((d, index) => {
                // Header row for each equipment (provides clear separation)
                bodyRows.push([
                    { content: 'Marca', styles: { fillColor: [204, 34, 41], textColor: 255, fontStyle: 'bold' } },
                    { content: 'Modelo', styles: { fillColor: [204, 34, 41], textColor: 255, fontStyle: 'bold' } },
                    { content: 'Numero Serie', styles: { fillColor: [204, 34, 41], textColor: 255, fontStyle: 'bold' } },
                    { content: 'Clase', styles: { fillColor: [204, 34, 41], textColor: 255, fontStyle: 'bold' } },
                    { content: 'Ubicación', styles: { fillColor: [204, 34, 41], textColor: 255, fontStyle: 'bold' } },
                    { content: 'Sub Ubicación', styles: { fillColor: [204, 34, 41], textColor: 255, fontStyle: 'bold' } }
                ]);

                // Standard info row
                bodyRows.push([
                    d.rel_serie_info?.MARCA || 'Raymond',
                    d.modelo || d.rel_equipo?.modelo || d.rel_serie_info?.MODELO || '-',
                    d.serial_equipo || d.serial || '-',
                    d.clase || d.rel_equipo?.clase || d.rel_serie_info?.clase || d.filtro_equipo || '-',
                    d.rel_ubicacion?.nombre_ubicacion || '-',
                    d.rel_sub_ubicacion?.nombre || '-'
                ]);

                // Evidence Labels row
                bodyRows.push([
                    { content: 'Evidencia 1', styles: { fillColor: [180, 0, 0], textColor: 255, fontStyle: 'bold' } },
                    { content: 'Comentario', styles: { fillColor: [180, 0, 0], textColor: 255, fontStyle: 'bold' } },
                    { content: 'Evidencia 2', styles: { fillColor: [180, 0, 0], textColor: 255, fontStyle: 'bold' } },
                    { content: 'Comentario', styles: { fillColor: [180, 0, 0], textColor: 255, fontStyle: 'bold' } },
                    { content: 'Evidencia 3', styles: { fillColor: [180, 0, 0], textColor: 255, fontStyle: 'bold' } },
                    { content: 'Comentario', styles: { fillColor: [180, 0, 0], textColor: 255, fontStyle: 'bold' } }
                ]);

                // Evidence Images/Comments row
                bodyRows.push([
                    { content: '', styles: { minCellHeight: 25 } },
                    { content: d.comentario_1 || '-', styles: { fontSize: 7, halign: 'left' } },
                    { content: '', styles: { minCellHeight: 25 } },
                    { content: d.comentario_2 || '-', styles: { fontSize: 7, halign: 'left' } },
                    { content: '', styles: { minCellHeight: 25 } },
                    { content: d.comentario_3 || '-', styles: { fontSize: 7, halign: 'left' } }
                ]);

                // Small spacer row
                if (index < detallesConImagenes.length - 1) {
                    bodyRows.push([
                        { content: '', colSpan: 6, styles: { fillColor: [255, 255, 255], minCellHeight: 4, lineWidth: 0 } }
                    ]);
                }
            });

            autoTable(doc, {
                startY: startY,
                body: bodyRows,
                theme: 'grid',
                styles: { fontSize: 8, halign: 'center', valign: 'middle', lineWidth: 0.4, lineColor: [0, 0, 0] },
                didDrawCell: (data) => {
                    const row = data.row;
                    const cell = data.cell;

                    if (cell.styles.minCellHeight === 25 && data.section === 'body') {
                        if ([0, 2, 4].includes(data.column.index)) {
                            // Each block is 4 rows + 1 spacer = 5 rows.
                            const eqIdx = Math.floor(row.index / 5);

                            const d = detallesConImagenes[eqIdx];
                            if (d) {
                                let img = null;
                                if (data.column.index === 0) img = d.img1;
                                else if (data.column.index === 2) img = d.img2;
                                else if (data.column.index === 4) img = d.img3;

                                if (img) {
                                    doc.addImage(img, 'JPEG', cell.x + 1, cell.y + 1, cell.width - 2, cell.height - 2);
                                }
                            }
                        }
                    }
                }
            });

            startY = (doc as any).lastAutoTable.finalY + 10;
        }

        // 4. Accessories Table
        if (accesoriosConImagenes.length > 0) {
            // Page break check for accessories header
            if (startY > 230) {
                doc.addPage();
                startY = 20;
            }

            doc.setTextColor(204, 34, 41);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text('Accesorios', 105, startY, { align: 'center' });
            startY += 4;

            autoTable(doc, {
                startY: startY,
                head: [['Modelo', 'Numero Serie', 'Tipo/Clase', 'Ubicación', 'Sub Ubicación', 'Foto']],
                body: accesoriosConImagenes.map(a => [
                    a.modelo || '-',
                    a.serial || '-',
                    a.tipo || a.clase || 'Batería',
                    a.rel_ubicacion?.nombre_ubicacion || (a.ubicacion && a.ubicacion.length > 20 ? 'Asignada' : a.ubicacion) || 'Almacen Acc.',
                    a.rel_sub_ubicacion?.nombre || (a.sub_ubicacion && a.sub_ubicacion.length > 20 ? 'Asignada' : a.sub_ubicacion) || 'General',
                    ''
                ]),
                theme: 'grid',
                headStyles: { fillColor: [204, 34, 41], textColor: 255, lineWidth: 0.4, lineColor: [0, 0, 0] },
                styles: { fontSize: 8, halign: 'center', valign: 'middle', lineWidth: 0.4, lineColor: [0, 0, 0], minCellHeight: 15 },
                didDrawCell: (data) => {
                    if (data.column.index === 5 && data.section === 'body') {
                        const acc = accesoriosConImagenes[data.row.index];
                        if (acc.img) {
                            try {
                                doc.addImage(acc.img, 'JPEG', data.cell.x + 1, data.cell.y + 1, data.cell.width - 2, data.cell.height - 2);
                            } catch (e) {
                                console.error('Error adding accessory image:', e);
                            }
                        }
                    }
                }
            });
            startY = (doc as any).lastAutoTable.finalY + 10;
        }

        // 5. Signatures (Auto Page Break Refined)
        const signatureHeight = 40;
        const pageHeight = doc.internal.pageSize.getHeight();

        if (startY + signatureHeight > pageHeight - 10) {
            doc.addPage();
            startY = 30;
        } else {
            // Space between table and signatures
            startY += 10;
        }

        doc.setTextColor(0);
        doc.setLineWidth(0.4);
        doc.setDrawColor(0);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);

        // Signatures images
        if (firmaReciboBase64) {
            try {
                doc.addImage(firmaReciboBase64, 'PNG', 30, startY + 2, 30, 15);
            } catch (e) {
                console.error('Error adding firma_recibo:', e);
            }
        }

        doc.line(20, startY + 20, 80, startY + 20);
        doc.text('FIRMA RECIBIÓ', 50, startY + 25, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(entradaData.usuario_asignado || '-', 50, startY + 29, { align: 'center' });

        if (returnBase64) {
            return doc.output('datauristring');
        }
        doc.save(`Resumen_${entradaData.folio}_${new Date().getTime()}.pdf`);
    };



    ;

    const confirmUbicarEquipos = async () => {
        if (!entradaId) return;
        setShowUbicarConfirm(false);
        setIsUbiking(true);
        try {
            const userName = user ? `${user.firstName || (user as any).Usuario || ''} ${user.lastName || ''}`.trim() : (entrada?.usuario_asignado || 'Sistema');
            await entradasApi.ubicarEquipos(entradaId, userName);
            toast.success('Equipos ubicados correctamente. Entrada cerrada.');

            // Re-fetch data to get the latest state with Cerrado status
            await loadDetails(entradaId);
            const entry = await entradasApi.getById(entradaId);
            setEntrada(entry);
            onSuccess?.();

            // Generate Documents and Send Email
            if (entry) {
                try {
                    toast.info('Generando y enviando correos...');
                    const pdfBase64 = await exportToPDFTotal(entry, detalles, accesorios, true);
                    const excelBase64 = await exportToExcelTotal(entry, detalles, accesorios, true);
                    
                    await entradasApi.sendMail({
                        tipo: 'Entrada',
                        folio: entry.folio,
                        fecha: new Date().toLocaleDateString(),
                        site: selectedSite || 'R1',
                        pdfBase64,
                        excelBase64
                    });
                    toast.success('Correos enviados correctamente');
                } catch (e) {
                    console.error('Error al enviar correos:', e);
                    toast.error('Error al enviar correos');
                }
            }
        } catch (error) {
            console.error('Error ubking items:', error);
            toast.error('Error al ubicar equipos.');
        } finally {
            setIsUbiking(false);
        }
    };

    const handleReSendEmail = async () => {
        if (!entrada) return;
        try {
            toast.info('Generando y reenviando correos...');
            const pdfBase64 = await exportToPDFTotal(entrada, detalles, accesorios, true);
            const excelBase64 = await exportToExcelTotal(entrada, detalles, accesorios, true);
            
            await entradasApi.sendMail({
                tipo: 'Entrada',
                folio: entrada.folio,
                fecha: entrada.fecha_creacion ? new Date(entrada.fecha_creacion).toLocaleDateString() : new Date().toLocaleDateString(),
                site: selectedSite || 'R1',
                pdfBase64,
                excelBase64
            });
            toast.success('Correos reenviados correctamente');
        } catch (e) {
            console.error('Error al reenviar correos:', e);
            toast.error('Error al reenviar correos');
        }
    };

    // Handler for selecting a location
    const handleUbicacionChange = async (ubicacionId: string) => {
        const item = getSelectedItemDetails();
        const locations = item ? ubicaciones.filter(u => {
            if (item.tipo === 'accesorio') {
                return u.Clase === 'Accesorio';
            } else {
                const itemClase = (item as any).clase || (item as any).filtro_equipo;
                return u.Clase === itemClase || u.Clase === 'Todas las clases';
            }
        }) : ubicaciones;

        // Find if this location requires Rack (e.g. if it is an Accessory location)
        // Actually the logic is simpler: if selectedItem is accessory, we show Rack selector.

        setSelectedUbicacion(ubicacionId);
        setSubUbicacionSugerida(null);
        setAvailableSubLocations([]);

        // If it's an accessory and just changed location, we might wait for rack if it's required
        // But let's check availability anyway to show the list of sub-locations
        checkAvailability(ubicacionId, selectedRack || undefined);
    };

    const handleRackChange = (rack: string) => {
        setSelectedRack(rack);
        setSubUbicacionSugerida(null);
        setAvailableSubLocations([]);

        if (selectedUbicacion) {
            checkAvailability(selectedUbicacion, rack);
        }
    }

    const checkAvailability = async (ubicacionId: string, rack?: string) => {
        if (!ubicacionId || !entradaId) return;

        setLoadingSubLocation(true);
        try {
            const [suggested, all] = await Promise.all([
                ubicacionesApi.getNextSubLocation(ubicacionId, entradaId, rack),
                ubicacionesApi.getSubLocations(ubicacionId, rack)
            ]);

            // Natural sort on frontend as failsafe
            const sortedAll = Array.isArray(all) ? [...all].sort((a, b) =>
                (a.nombre || '').localeCompare(b.nombre || '', undefined, { numeric: true, sensitivity: 'base' })
            ) : [];

            setSubUbicacionSugerida(suggested);
            setAvailableSubLocations(sortedAll);
        } catch (error) {
            console.error('Error getting next sub-location:', error);
            toast.error('Error al obtener sub-ubicación disponible');
        } finally {
            setLoadingSubLocation(false);
        }
    }

    // Handler for saving location
    const handleSaveUbicacion = async () => {
        if (!selectedItem || !entradaId || !selectedUbicacion) return;

        try {
            const dataToUpdate = {
                id_ubicacion: selectedUbicacion,
                id_sub_ubicacion: subUbicacionSugerida?.id_sub_ubicacion || null,
                estado: 'En Espera',
            };

            if (selectedItem.tipo === 'equipo') {
                await entradasApi.updateDetalle(selectedItem.id, dataToUpdate);
            } else {
                const accessoryData = {
                    ubicacion: selectedUbicacion,
                    sub_ubicacion: subUbicacionSugerida?.id_sub_ubicacion || null,
                    estado: 'En Espera',
                    rack: selectedRack ? `Rack ${selectedRack}` : undefined
                };
                await entradasApi.updateAccesorio(selectedItem.id, accessoryData);
            }

            toast.success('Ubicación asignada correctamente');
            // Marcar la sub-ubicación recién asignada como reservada en esta sesión (SOLO PARA EQUIPOS)
            const assignedSubId = subUbicacionSugerida?.id_sub_ubicacion || subUbicacionSugerida?.id_sububicacion;
            if (assignedSubId && selectedItem.tipo === 'equipo') {
                setReservedSubIds(prev => new Set([...prev, assignedSubId]));
            }
            setUbicarModalOpen(false);
            loadDetails(entradaId); // Reload details to show new location
            onSuccess?.();
            resetUbicarState();
        } catch (error) {
            console.error('Error saving location:', error);
            toast.error('Error al guardar la ubicación');
        }
    };

    const getSelectedItemDetails = () => {
        if (!selectedItem) return null;
        if (selectedItem.tipo === 'equipo') {
            return detalles.find(d => d.id_detalles === selectedItem.id);
        }
        return accesorios.find(a => a.id_accesorio === selectedItem.id);
    };

    const getFilteredLocations = () => {
        const item = getSelectedItemDetails();
        if (!item) return ubicaciones;

        return ubicaciones.filter(u => {
            if (selectedItem?.tipo === 'accesorio') {
                return u.Clase === 'Accesorio';
            } else {
                // Equipment: Match Class OR "Todas las clases"
                const itemClase = item.clase || item.filtro_equipo;
                return u.Clase === itemClase || u.Clase === 'Todas las clases';
            }
        });
    };

    const handleAttemptCloseUbicar = () => {
        if (selectedUbicacion) {
            setShowCloseConfirm(true);
        } else {
            setUbicarModalOpen(false);
            resetUbicarState();
        }
    };

    const confirmCloseUbicar = () => {
        setShowCloseConfirm(false);
        setUbicarModalOpen(false);
        resetUbicarState();
    };

    const loadDetails = async (id: string) => {
        try {
            setLoading(true);
            const [entradaData, detallesData, accesoriosData] = await Promise.all([
                entradasApi.getById(id),
                entradasApi.getDetalles(id),
                entradasApi.getAccesorios(id)
            ]);
            setEntrada(entradaData);
            const detallesList = Array.isArray(detallesData) ? detallesData : [];
            const accesoriosList = Array.isArray(accesoriosData) ? accesoriosData : [];
            setDetalles(detallesList);
            setAccesorios(accesoriosList);
            // Reconstruir reservedSubIds desde los ítems que ya tienen sub-ubicación asignada pero entrada aún no cerrada
            const reserved = new Set<string>();
            detallesList.forEach((d: any) => { if (d.id_sub_ubicacion) reserved.add(d.id_sub_ubicacion); });
            // Los accesorios no reservan ubicación (pueden compartir)
            // accesoriosList.forEach((a: any) => { if (a.sub_ubicacion) reserved.add(a.sub_ubicacion); });
            setReservedSubIds(reserved);
        } catch (error) {
            console.error('Error loading entrada details:', error);
            toast.error('Error al cargar los detalles de la entrada');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateQR = async (item: any) => {
        try {
            await generateQRLabel({
                serial: item.serial_equipo || item.serial,
                site: selectedSite || undefined,
                date: entrada?.fecha_creacion ? new Date(entrada.fecha_creacion).toISOString() : undefined
            });
            toast.success('Etiqueta generada correctamente');
        } catch (error) {
            console.error('Error generating QR:', error);
            toast.error('Error al generar la etiqueta');
        }
    };

    const handleGenerateAllLabels = async () => {
        try {
            const allItems = [
                ...detalles.map(d => ({ 
                    serial: d.serial_equipo || d.serial, 
                    site: selectedSite || undefined, 
                    date: entrada?.fecha_creacion ? new Date(entrada.fecha_creacion).toISOString() : undefined 
                })),
                ...accesorios.map(a => ({ 
                    serial: a.serial, 
                    site: selectedSite || undefined, 
                    date: entrada?.fecha_creacion ? new Date(entrada.fecha_creacion).toISOString() : undefined 
                }))
            ].filter(i => i.serial);

            if (allItems.length === 0) {
                toast.error('No hay números de serie para generar etiquetas');
                return;
            }

            toast.info(`Generando ${allItems.length} etiquetas...`);
            await generateMultipleQRLabels(allItems, `Etiquetas_Entrada_${entrada?.folio || 'Exp'}.pdf`);
            toast.success('Libro de etiquetas generado correctamente');
        } catch (error) {
            console.error('Error generating all labels:', error);
            toast.error('Error al generar el lote de etiquetas');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Por Ubicar': return 'bg-amber-50 text-amber-700 border-amber-100/50';
            case 'Cerrado': return 'bg-emerald-50 text-emerald-700 border-emerald-100/50';
            default: return 'bg-slate-50 text-slate-700 border-slate-100/50';
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
                <DialogContent className="max-w-[95vw] md:max-w-6xl h-[90vh] p-0 overflow-hidden flex flex-col bg-slate-50/95 backdrop-blur-xl border-slate-200/50 shadow-2xl rounded-3xl md:rounded-[2.5rem]">
                    <div className="flex flex-col flex-1 min-h-0">
                        {/* Header Premium */}
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between p-5 lg:p-8 border-b border-slate-200/50 bg-slate-50/50 gap-4 lg:gap-6">
                            <div className="flex items-center gap-3 lg:gap-6">
                                <div className="w-10 h-10 lg:w-16 lg:h-16 rounded-[1rem] lg:rounded-[2rem] bg-slate-900 flex items-center justify-center shadow-xl shadow-slate-200 shrink-0">
                                    <FileText className="w-6 h-6 lg:w-8 lg:h-8 text-white" />
                                </div>
                                <div>
                                    <DialogTitle className="flex items-center gap-2 mb-0.5 text-xl lg:text-3xl font-black text-slate-900 tracking-tighter">
                                        Folio <span className="text-slate-400">#{entrada?.folio || '...'}</span>
                                    </DialogTitle>
                                    <p className="text-slate-500 text-[10px] lg:text-sm font-medium">Gestión de entradas</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 lg:gap-4 justify-end">
                                {entrada?.estado !== 'Cerrado' && entrada?.estado === 'Por Ubicar' && (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            onClick={() => setShowDeleteConfirm(true)}
                                            className="flex items-center gap-2 px-4 lg:px-6 py-3 lg:py-4 bg-white border border-slate-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200 text-slate-700 rounded-2xl font-black text-[10px] lg:text-xs uppercase tracking-widest transition-all active:scale-95"
                                        >
                                            <Trash2 className="w-4 h-4" /> Eliminar
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (onEdit) {
                                                    onClose();
                                                    setTimeout(() => onEdit(entradaId!), 100);
                                                }
                                            }}
                                            className="flex items-center gap-2 px-4 lg:px-6 py-3 lg:py-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl font-black text-[10px] lg:text-xs uppercase tracking-widest transition-all active:scale-95"
                                        >
                                            <Edit className="w-4 h-4" /> Editar
                                        </button>
                                    </div>
                                )}
                                {entrada?.estado !== 'Cerrado' && entrada?.estado === 'Por Ubicar' && (detalles.length > 0 || accesorios.length > 0) && detalles.every(d => d.id_sub_ubicacion) && accesorios.every(a => a.sub_ubicacion) && (
                                    <button
                                        onClick={handleUbicarEquipos}
                                        disabled={isUbiking}
                                        className="flex items-center gap-3 px-6 lg:px-8 py-3 lg:py-4 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 text-white rounded-2xl font-black text-[10px] lg:text-xs uppercase tracking-widest shadow-xl shadow-red-100 transition-all hover:scale-105 active:scale-95 animate-in zoom-in-95 duration-300"
                                    >
                                        {isUbiking ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-5 h-5" />}
                                        {(accesorios.length > 0 && detalles.length === 0) ? 'Formalizar entrada' : 'Ubicar equipos'}
                                    </button>
                                )}
                                {entrada?.estado === 'Cerrado' && (
                                    <div className="flex flex-wrap items-center gap-2 lg:gap-3">
                                        <button
                                            onClick={() => entrada && exportToPDFTotal(entrada, detalles, accesorios)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold text-[10px] uppercase tracking-wide transition-all active:scale-95 shadow-sm"
                                        >
                                            <FileText className="w-3.5 h-3.5 text-red-500" /> PDF
                                        </button>
                                        <button
                                            onClick={handleGenerateAllLabels}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold text-[10px] uppercase tracking-wide transition-all active:scale-95 shadow-sm"
                                        >
                                            <QrCode className="w-3.5 h-3.5 text-slate-900" /> Etiquetas
                                        </button>
                                        <button
                                            onClick={() => entrada && exportToExcelTotal(entrada, detalles, accesorios)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold text-[10px] uppercase tracking-wide transition-all active:scale-95 shadow-sm"
                                        >
                                            <FileText className="w-3.5 h-3.5 text-emerald-500" /> Excel
                                        </button>
                                        <button
                                            onClick={handleReSendEmail}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-100 hover:bg-red-100 text-red-600 rounded-xl font-bold text-[10px] uppercase tracking-wide transition-all active:scale-95 shadow-sm"
                                        >
                                            <Mail className="w-3.5 h-3.5 text-blue-600" /> Correo
                                        </button>
                                        <div className="px-3 py-1.5 bg-slate-900 text-white rounded-xl font-bold text-[10px] uppercase tracking-wide shadow-md flex items-center gap-1.5">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Cerrada
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto min-h-0">
                            <div className="p-5 sm:p-10 space-y-8 sm:space-y-12">
                                {loading ? (
                                    <div className="flex flex-col items-center justify-center h-full space-y-6">
                                        <div className="relative">
                                            <Loader2 className="w-16 h-16 animate-spin text-slate-900 relative z-10" />
                                            <div className="absolute inset-0 w-16 h-16 rounded-full bg-slate-200 animate-ping opacity-25"></div>
                                        </div>
                                        <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-xs">Sincronizando expedientes...</p>
                                    </div>
                                ) : entrada ? (
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                                        {/* Left Column: Info & Evidence */}
                                        <div className="lg:col-span-8 space-y-8 sm:space-y-12">
                                            {/* Info Cards Grid */}
                                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                                {[
                                                    {
                                                        label: 'Cliente',
                                                        value: entrada.rel_cliente?.nombre_cliente || (
                                                            entrada.cliente && !entrada.cliente.startsWith('CLI-')
                                                                ? entrada.cliente
                                                                : '-'
                                                        ),
                                                        icon: User
                                                    },
                                                    { label: 'Registro', value: new Date(entrada.fecha_creacion).toLocaleDateString(), icon: Calendar },
                                                    { label: 'Encargado', value: entrada.usuario_asignado, icon: UserCheck },
                                                    { label: 'Factura', value: entrada.factura || 'Sin factura', icon: FileText },
                                                    ...(selectedSite === 'r1' ? [
                                                        { label: 'Distribuidor', value: entrada.distribuidor || '-', icon: Package },
                                                        { label: 'ADC', value: entrada.adc || '-', icon: Truck },
                                                    ] : []),
                                                    ...((selectedSite === 'r2' || selectedSite === 'r3') ? [
                                                        { label: 'BOL', value: (entrada as any).bol || '-', icon: ShoppingBag },
                                                    ] : []),
                                                ].map((item, i) => (
                                                    <div key={i} className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 transition-all hover:shadow-md hover:border-slate-200 min-w-0">
                                                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
                                                            <item.icon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{item.label}</p>
                                                            <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">{item.value || '-'}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Comentarios Section */}
                                            {entrada.comentario && (
                                                <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-[5rem] -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
                                                    <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em] mb-4 flex items-center gap-3">
                                                        <MessageSquare className="w-4 h-4" /> Observaciones Generales
                                                    </p>
                                                    <p className="text-white/90 text-lg font-medium italic leading-relaxed">
                                                        "{entrada.comentario}"
                                                    </p>
                                                </div>
                                            )}

                                            {/* Evidencias Visuales */}
                                            {(entrada.evidencia_1 || entrada.evidencia_2 || entrada.evidencia_3) && (
                                                <section className="space-y-6">
                                                    <div className="flex items-center justify-between px-2">
                                                        <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                                                            <ImageIcon className="w-6 h-6 text-slate-400" />
                                                            Evidencias del Ingreso
                                                        </h3>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                        {[entrada.evidencia_1, entrada.evidencia_2, entrada.evidencia_3]
                                                            .filter(Boolean)
                                                            .map((evidencia, i) => (
                                                                <div key={i} className="group relative aspect-square bg-white rounded-[2.5rem] p-3 border border-slate-100 shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden">
                                                                    <div className="w-full h-full rounded-[1.8rem] overflow-hidden">
                                                                        <img
                                                                            src={getImageUrl(evidencia)}
                                                                            alt={`Evidencia ${i + 1}`}
                                                                            className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-110 bg-slate-900"
                                                                        />
                                                                    </div>
                                                                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px] flex items-center justify-center p-6 text-center">
                                                                        <a
                                                                            href={getImageUrl(evidencia)}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="bg-white text-slate-900 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-all duration-500"
                                                                        >
                                                                            Ver Original
                                                                        </a>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                    </div>
                                                </section>
                                            )}

                                            {/* Inventario de Equipos Section */}
                                            <section className="space-y-6">
                                                <div className="flex items-center justify-between px-2">
                                                    <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                                                        <Package className="w-6 h-6 text-slate-400" />
                                                        Inventario de Equipos ({detalles.length})
                                                    </h3>
                                                </div>
                                                <div className="space-y-4">
                                                    {detalles.map((detalle, idx) => (
                                                        <div key={idx} className="bg-white p-5 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-200/60 shadow-sm hover:shadow-2xl hover:border-slate-300 transition-all group relative overflow-hidden">
                                                            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 group-hover:bg-slate-100/50 rounded-bl-[5rem] -mr-10 -mt-10 -z-0 transition-colors"></div>

                                                            <div className="relative z-10 space-y-6 sm:space-y-8">
                                                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                                                    <div className="flex items-start gap-4 sm:gap-6">
                                                                        {/* Imagen Principal Equipo */}
                                                                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl bg-slate-50 border border-slate-100 overflow-hidden flex-shrink-0 shadow-sm group-hover:shadow-md transition-all">
                                                                            {detalle.evidencia_1 ? (
                                                                                <img src={getImageUrl(detalle.evidencia_1)} className="w-full h-full object-contain bg-slate-900" alt={detalle.modelo} />
                                                                            ) : (
                                                                                <div className="w-full h-full flex items-center justify-center text-slate-200">
                                                                                    <Package className="w-8 h-8 sm:w-10 sm:h-10" />
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        <div className="min-w-0 flex-1">
                                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Modelo y Clase</p>
                                                                            <h4 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter flex flex-wrap items-center gap-2 sm:gap-3">
                                                                                {detalle.modelo || detalle.rel_equipo?.modelo || detalle.rel_serie_info?.MODELO || '—'}
                                                                                {(detalle.clase || detalle.rel_equipo?.clase || detalle.rel_serie_info?.clase) && (
                                                                                    <span className="text-[9px] sm:text-xs font-black bg-slate-900 text-white px-2 sm:px-3 py-1 rounded-lg sm:rounded-xl uppercase tracking-widest shadow-lg shadow-slate-200">
                                                                                        {detalle.clase || detalle.rel_equipo?.clase || detalle.rel_serie_info?.clase}
                                                                                    </span>
                                                                                )}
                                                                            </h4>
                                                                            <p className="font-black text-slate-800 text-base sm:text-lg tracking-tight mt-1">Serial: {detalle.serial_equipo || detalle.serial}</p>
                                                                        </div>
                                                                    </div>

                                                                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                                                        <div className="bg-slate-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 min-w-0">
                                                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                                                                <MapPin className="w-2.5 h-2.5" /> Ubicación
                                                                            </p>
                                                                            <p className="text-[10px] sm:text-[11px] font-bold text-slate-700 truncate">{detalle.rel_ubicacion?.nombre_ubicacion || 'N/A'}</p>
                                                                            <p className="text-[8px] sm:text-[9px] text-slate-400 font-medium truncate">Posición: {detalle.rel_sub_ubicacion?.nombre || 'General'}</p>
                                                                        </div>
                                                                        <div className="bg-slate-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 min-w-0">
                                                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                                                                <Tag className="w-2.5 h-2.5" /> Estatus
                                                                            </p>
                                                                            <p className="text-[10px] sm:text-[11px] font-bold text-slate-700 truncate">{detalle.estado || 'Recibido'}</p>
                                                                            <p className="text-[8px] sm:text-[9px] text-slate-400 font-medium truncate">{detalle.calificacion || '-'}</p>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Acciones para el Equipo */}
                                                                <div className="flex flex-wrap gap-3 pt-2">
                                                                    {entrada?.estado !== 'Cerrado' && !detalle.calificacion && selectedSite !== 'r3' && selectedSite !== 'r2' && (
                                                                        <button
                                                                            onClick={() => {
                                                                                setEvalItem({
                                                                                    id: detalle.id_detalles,
                                                                                    serial: detalle.serial_equipo || detalle.serial,
                                                                                    modelo: detalle.modelo,
                                                                                    tipo: 'equipo',
                                                                                    clase: detalle.clase,
                                                                                    distribuidor: entrada?.distribuidor,
                                                                                    cliente_origen: entrada?.rel_cliente?.nombre_cliente || entrada?.cliente_origen || entrada?.cliente
                                                                                });
                                                                                setEvalModalOpen(true);
                                                                            }}
                                                                            className="flex items-center gap-2 px-6 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-sm active:scale-95 border border-red-200"
                                                                        >
                                                                            <Star className="w-3.5 h-3.5" /> Calificar
                                                                        </button>
                                                                    )}
                                                                     {entrada?.estado !== 'Cerrado' && (entrada?.estado === 'Por Ubicar' || !!detalle.calificacion) && (
                                                                        <button
                                                                            onClick={() => {
                                                                                setSelectedItem({ id: detalle.id_detalles, tipo: 'equipo' });
                                                                                setUbicarModalOpen(true);
                                                                            }}
                                                                            className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 ${
                                                                                detalle.id_sub_ubicacion
                                                                                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-200'
                                                                                    : 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-200'
                                                                            }`}
                                                                        >
                                                                            <Move className="w-3.5 h-3.5" /> {detalle.id_sub_ubicacion ? 'Re-ubicar' : 'Ubicar'}
                                                                        </button>
                                                                    )}

                                                                    <button
                                                                        onClick={() => handleGenerateQR(detalle)}
                                                                        className="flex items-center gap-2 px-6 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-sm active:scale-95"
                                                                    >
                                                                        <QrCode className="w-3.5 h-3.5" /> Generar QR
                                                                    </button>
                                                                </div>

                                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-slate-100">
                                                                    <div className="space-y-1">
                                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                                            <Truck className="w-3 h-3" /> Origen
                                                                        </p>
                                                                        <p className="text-xs font-bold text-slate-600 truncate">{detalle.tipo_entrada || detalle.rel_serie_info?.LUGAR_DE_ENTRADA || '-'}</p>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                                            <User className="w-3 h-3" /> Cliente Final
                                                                        </p>
                                                                        <p className="text-xs font-bold text-slate-600 truncate">{detalle.rel_serie_info?.CLIENTE || '-'}</p>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                                            <ShoppingBag className="w-3 h-3" /> Unidad de Venta
                                                                        </p>
                                                                        <p className="text-xs font-bold text-slate-600 truncate">{detalle.rel_serie_info?.UNIDAD_DE_VENTA || '-'}</p>
                                                                    </div>
                                                                </div>

                                                                {detalle.comentarios && (
                                                                    <div className="bg-slate-50/50 p-4 rounded-2xl border-l-4 border-slate-900 italic">
                                                                        <p className="text-xs text-slate-600 font-medium leading-relaxed">
                                                                            "{detalle.comentarios}"
                                                                        </p>
                                                                    </div>
                                                                )}

                                                                {/* Historial Section */}
                                                                {selectedSite !== 'r3' && selectedSite !== 'r2' && (
                                                                    <div className="mt-8 pt-8 border-t border-slate-50">
                                                                        <HistoryView
                                                                            item={{
                                                                                id: detalle.id_detalles,
                                                                                serial: detalle.serial_equipo || detalle.serial || '',
                                                                                tipo: 'equipo'
                                                                            }}
                                                                            onViewEvaluation={(evaluationId) => {
                                                                                setEvalItem({
                                                                                    id: detalle.id_detalles,
                                                                                    serial: detalle.serial_equipo || detalle.serial || '',
                                                                                    modelo: detalle.modelo,
                                                                                    tipo: 'equipo' as const,
                                                                                    clase: detalle.clase,
                                                                                    distribuidor: entrada?.distribuidor,
                                                                                    cliente_origen: entrada?.rel_cliente?.nombre_cliente || entrada?.cliente_origen || entrada?.cliente
                                                                                });
                                                                                setEvalId(evaluationId);
                                                                                setEvalModalOpen(true);
                                                                            }}
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </section>

                                            {/* Inventario de Accesorios Section */}
                                            {accesorios.length > 0 && (
                                                <section className="space-y-6 pt-6 border-t border-slate-100">
                                                    <div className="flex items-center justify-between px-2">
                                                        <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                                                            <Wrench className="w-6 h-6 text-slate-400" />
                                                            Accesorios Vinculados ({accesorios.length})
                                                        </h3>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        {accesorios.map((acc, idx) => (
                                                            <div key={idx} className="bg-white p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200/60 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group">
                                                                <div className="absolute top-0 left-0 w-2 h-full bg-slate-100 group-hover:bg-slate-900 transition-colors"></div>
                                                                <div className="relative z-10 space-y-4">
                                                                    <div className="flex justify-between items-start">
                                                                        <div className="flex items-start gap-4">
                                                                            {/* Imagen Accesorio */}
                                                                            <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden flex-shrink-0">
                                                                                {acc.evidencia ? (
                                                                                    <img src={getImageUrl(acc.evidencia)} className="w-full h-full object-contain bg-slate-900" alt={acc.modelo} />
                                                                                ) : (
                                                                                    <div className="w-full h-full flex items-center justify-center text-slate-200">
                                                                                        <Wrench className="w-8 h-8" />
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <div>
                                                                                <div className="flex items-center gap-2 mb-1">
                                                                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{acc.tipo}</p>
                                                                                    {(acc.evaluaciones && acc.evaluaciones.length > 0) && (
                                                                                        <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded text-[7px] font-black uppercase tracking-tighter">
                                                                                            Evaluado
                                                                                        </span>
                                                                                    )}
                                                                                    {(acc.estado === 'Ingresado') && (
                                                                                        <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded text-[7px] font-black uppercase tracking-tighter">
                                                                                            En Stock
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <p className="font-black text-slate-800 text-lg tracking-tight">Serial: {acc.serial}</p>
                                                                                <p className="text-[10px] font-mono font-bold text-slate-400">Modelo:  {acc.modelo}</p>
                                                                            </div>
                                                                        </div>                                                                    </div>

                                                                    <div className="flex items-center gap-4 pt-2">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <MapPin className="w-3 h-3 text-slate-300" />
                                                                            <span className="text-[10px] font-bold text-slate-500">{acc.rel_ubicacion?.nombre_ubicacion || 'Almacen Acc.'}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5">
                                                                            <Tag className="w-3 h-3 text-slate-300" />
                                                                            <span className="text-[10px] font-bold text-slate-500">{acc.rel_sub_ubicacion?.nombre || 'General'}</span>
                                                                        </div>
                                                                    </div>

                                                                    {/* Acciones para Accesorio */}
                                                                    <div className="flex gap-2 pt-2">
                                                                        {entrada?.estado !== 'Cerrado' && (!acc.evaluaciones || acc.evaluaciones.length === 0) && selectedSite !== 'r3' && selectedSite !== 'r2' && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setEvalItem({
                                                                                        id: acc.id_accesorio,
                                                                                        serial: acc.serial,
                                                                                        modelo: acc.modelo,
                                                                                        tipo: 'accesorio',
                                                                                        distribuidor: entrada?.distribuidor,
                                                                                        cliente_origen: entrada?.rel_cliente?.nombre_cliente || entrada?.cliente_origen || entrada?.cliente
                                                                                    });
                                                                                    setEvalModalOpen(true);
                                                                                }}
                                                                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all"
                                                                            >
                                                                                <Star className="w-3 h-3" /> Calificar
                                                                            </button>
                                                                        )}
                                                                         {entrada?.estado !== 'Cerrado' && (entrada?.estado === 'Por Ubicar' || (acc.evaluaciones && acc.evaluaciones.length > 0)) && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setSelectedItem({ id: acc.id_accesorio, tipo: 'accesorio' });
                                                                                    setUbicarModalOpen(true);
                                                                                }}
                                                                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${
                                                                                    acc.sub_ubicacion
                                                                                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-600'
                                                                                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                                                                                }`}
                                                                            >
                                                                                <MapPin className="w-3 h-3" /> {acc.sub_ubicacion ? 'Re-ubicar' : 'Ubicar'}
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            onClick={() => handleGenerateQR(acc)}
                                                                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-white hover:bg-slate-50 border border-slate-100 text-slate-400 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all"
                                                                        >
                                                                            <QrCode className="w-3 h-3" /> QR
                                                                        </button>
                                                                    </div>

                                                                    {/* Historial Section */}
                                                                    {selectedSite !== 'r3' && selectedSite !== 'r2' && (
                                                                        <div className="mt-4 pt-4 border-t border-slate-50">
                                                                            <HistoryView
                                                                                item={{
                                                                                    id: acc.id_accesorio,
                                                                                    serial: acc.serial || '',
                                                                                    tipo: 'accesorio'
                                                                                }}
                                                                                onViewEvaluation={(evaluationId) => {
                                                                                    setEvalItem({
                                                                                        id: acc.id_accesorio,
                                                                                        serial: acc.serial || '',
                                                                                        modelo: acc.modelo,
                                                                                        tipo: 'accesorio' as const,
                                                                                        distribuidor: entrada?.distribuidor,
                                                                                        cliente_origen: entrada?.rel_cliente?.nombre_cliente || entrada?.cliente_origen || entrada?.cliente
                                                                                    });
                                                                                    setEvalId(evaluationId);
                                                                                    setEvalModalOpen(true);
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </section>
                                            )}
                                        </div>

                                        {/* Right Column: Signatures & Legal */}
                                        <div className="lg:col-span-4 space-y-12">
                                            <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3 px-2">
                                                <CheckCircle2 className="w-6 h-6 text-slate-400" />
                                                Formalización
                                            </h3>

                                            <div className="space-y-6">
                                                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-xl space-y-8 relative overflow-hidden">
                                                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-slate-50 rounded-tl-[8rem] -mr-12 -mb-12 -z-0 opacity-50"></div>

                                                    <div className="relative z-10 space-y-10">
                                                        {/* Firma Recibo */}
                                                        <div className="space-y-4 text-center text-slate-900">
                                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">RECEPCIÓN ALMACÉN</p>
                                                            <div className="w-full aspect-[4/3] bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 flex items-center justify-center p-6 group transition-all hover:bg-white hover:border-slate-300">
                                                                {entrada.firma_recibo ? (
                                                                    <img src={getImageUrl(entrada.firma_recibo)} className="max-h-full max-w-full object-contain mix-blend-multiply opacity-80 group-hover:opacity-100 transition-opacity" alt="Firma Recibo" />
                                                                ) : (
                                                                    <div className="flex flex-col items-center gap-2 opacity-20">
                                                                        <AlertCircle className="w-8 h-8" />
                                                                        <span className="text-[10px] font-bold uppercase">Captura pendiente</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="font-black text-slate-900 border-b-2 border-slate-100 inline-block pb-1 text-base">{entrada.usuario_asignado || '-'}</p>
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Almacén Raymond</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-300 bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-200 p-12">
                                        <div className="w-24 h-24 bg-white rounded-[2rem] shadow-xl flex items-center justify-center mb-8 border border-slate-100">
                                            <AlertCircle className="w-12 h-12 text-slate-200" />
                                        </div>
                                        <h3 className="text-2xl font-black text-slate-400 tracking-tighter mb-2 uppercase italic">Folio no localizado</h3>
                                        <p className="text-sm font-medium opacity-60 max-w-[200px] text-center">Verifique el folio e intente nuevamente el acceso.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </DialogContent >
            </Dialog >

            {/* Modal Ubicar */}
            < Dialog open={ubicarModalOpen} onOpenChange={(open) => {
                if (!open) handleAttemptCloseUbicar();
                else setUbicarModalOpen(true);
            }
            }>
                <DialogContent className="max-w-xl h-auto max-h-[90vh] p-0 bg-white rounded-[2.5rem] shadow-2xl border-slate-100 overflow-hidden flex flex-col">
                    <div className="shrink-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-[5rem] -mr-10 -mt-10"></div>
                        <DialogHeader>
                            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm shadow-inner">
                                <Move className="w-8 h-8 text-slate-200" />
                            </div>
                            <DialogTitle className="text-3xl font-black tracking-tighter text-white">
                                Asignar Ubicación
                            </DialogTitle>
                            <DialogDescription className="text-slate-200 font-medium text-lg">
                                {getSelectedItemDetails()?.modelo || 'Elemento'}
                                <span className="opacity-60 text-sm ml-2 font-normal">
                                    {getSelectedItemDetails()?.serial_equipo || getSelectedItemDetails()?.serial || 'SN: ---'}
                                </span>
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 space-y-8">
                        {/* Info del Item */}
                        {getSelectedItemDetails() && (
                            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="w-12 h-12 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                                    {selectedItem?.tipo === 'equipo' ? <Package className="w-6 h-6 text-slate-400" /> : <Wrench className="w-6 h-6 text-slate-400" />}
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Clase / Tipo</p>
                                    <p className="font-bold text-slate-700">
                                        {getSelectedItemDetails()?.clase || getSelectedItemDetails()?.filtro_equipo || getSelectedItemDetails()?.tipo || 'General'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Selector de Ubicación */}
                        <div className="space-y-4">
                            <label className="text-sm font-black text-slate-700 uppercase tracking-wide">Seleccionar Zona</label>
                            <select
                                value={selectedUbicacion}
                                onChange={(e) => handleUbicacionChange(e.target.value)}
                                className="w-full px-4 py-4 bg-white border-2 border-slate-200 rounded-2xl text-slate-700 font-bold focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all outline-none"
                            >
                                <option value="">-- Seleccionar --</option>
                                {getFilteredLocations()
                                    .map(u => (
                                        <option key={u.id_ubicacion} value={u.id_ubicacion}>
                                            {u.nombre_ubicacion} {u.Clase ? `(Clase ${u.Clase})` : ''}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        {/* Selector de Rack (Solo Accesorios) */}
                        {selectedItem?.tipo === 'accesorio' && selectedUbicacion && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                                <label className="text-sm font-black text-slate-700 uppercase tracking-wide">Seleccionar Rack</label>
                                <select
                                    value={selectedRack}
                                    onChange={(e) => handleRackChange(e.target.value)}
                                    className="w-full px-4 py-4 bg-white border-2 border-slate-200 rounded-2xl text-slate-700 font-bold focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all outline-none"
                                >
                                    <option value="">-- Seleccionar Rack --</option>
                                    {Array.from({ length: 15 }, (_, i) => i + 1).map(num => (
                                        <option key={num} value={num}>Rack {num}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Resultado de Sub-Ubicación */}
                        <div className={`transition-all duration-300 ${selectedUbicacion ? 'opacity-100 translate-y-0' : 'opacity-50 translate-y-4 grayscale pointer-events-none'}`}>
                            <label className="text-sm font-black text-slate-700 uppercase tracking-wide mb-3 block">Posición Sugerida</label>

                            {loadingSubLocation ? (
                                <div className="h-24 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center gap-3 text-slate-400 animate-pulse">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span className="font-bold text-xs uppercase tracking-widest">Buscando disponibilidad...</span>
                                </div>
                            ) : availableSubLocations.length > 0 ? (
                                <div className="bg-white rounded-2xl border border-emerald-100 p-6 shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                                                <MapPin className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                                                    {subUbicacionSugerida ? 'Posición Sugerida' : 'Seleccionar Posición'}
                                                </p>
                                                <p className="text-xs text-slate-400 font-medium">
                                                    {subUbicacionSugerida ? 'Hemos encontrado un espacio libre' : 'Selecciona un espacio manualmente'}
                                                </p>
                                            </div>
                                        </div>
                                        {subUbicacionSugerida && (
                                            <div className="h-8 w-8 bg-emerald-100 rounded-full flex items-center justify-center">
                                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                            </div>
                                        )}
                                    </div>

                                    <select
                                        value={subUbicacionSugerida?.id_sub_ubicacion || subUbicacionSugerida?.id_sububicacion || ''}
                                        onChange={(e) => {
                                            const selected = availableSubLocations.find(sub =>
                                                (sub.id_sub_ubicacion === e.target.value) || (sub.id_sububicacion === e.target.value)
                                            );
                                            setSubUbicacionSugerida(selected);
                                        }}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm"
                                    >
                                        <option value="" disabled>-- Seleccionar Posición --</option>
                                        {availableSubLocations.map((sub) => {
                                            const subId = sub.id_sub_ubicacion || sub.id_sububicacion;
                                            const isAccesoriosZone = selectedUbicacion === 'ba0cae1e';
                                            const isOccupied = sub.ubicacion_ocupada && !isAccesoriosZone && selectedItem?.tipo !== 'accesorio';
                                            // Reservada en esta sesión por otro ítem de la misma entrada
                                            const isCurrentItem = subId === (getSelectedItemDetails()?.id_sub_ubicacion || getSelectedItemDetails()?.sub_ubicacion);
                                            // Los accesorios ignoran la reserva (pueden compartir)
                                            const isReserved = reservedSubIds.has(subId) && !isCurrentItem && selectedItem?.tipo === 'equipo';

                                            return (
                                                <option key={subId} value={subId} disabled={isOccupied || isReserved}>
                                                    {sub.nombre}
                                                    {isOccupied ? ' (Ocupado)' : ''}
                                                    {isReserved && !isOccupied ? ' (Reservado)' : ''}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            ) : selectedUbicacion ? (
                                <div className="p-6 bg-rose-50 rounded-[2rem] border border-rose-100 shadow-sm flex items-start gap-4 animate-in fade-in slide-in-from-top-4">
                                    <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center text-rose-500 shrink-0 shadow-inner">
                                        <AlertCircle className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-rose-900 uppercase tracking-widest mt-1">Zona Saturada</p>
                                        <p className="text-sm font-bold text-rose-700/80 leading-tight">Sin posiciones disponibles</p>
                                        <p className="text-[10px] text-rose-600/60 font-medium mt-1">No se encontraron posiciones libres en esta zona.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-32 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-2 transition-all">
                                    <MapPin className="w-6 h-6 opacity-20" />
                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Seleccione una zona para continuar</span>
                                </div>
                            )}

                            <div className="flex gap-4 pt-6 mt-8 border-t border-slate-100">
                                <button
                                    onClick={handleAttemptCloseUbicar}
                                    className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveUbicacion}
                                    disabled={!subUbicacionSugerida}
                                    className="flex-[2] py-4 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-red-200 disabled:shadow-none transition-all active:scale-[0.98]"
                                >
                                    Confirmar Ubicación
                                </button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog >

            {/* Modal de Confirmación de Ubicación Masiva */}
            < Dialog open={showUbicarConfirm} onOpenChange={setShowUbicarConfirm} >
                <DialogContent className="max-w-md p-0 overflow-hidden bg-white border-none shadow-2xl rounded-[2rem]">
                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-[5rem] -mr-10 -mt-10"></div>
                        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm shadow-inner">
                            <PackageCheck className="w-8 h-8 text-slate-50" />
                        </div>
                        <DialogTitle className="text-2xl font-black tracking-tighter text-white">
                            ¿Ubicar todos los equipos?
                        </DialogTitle>
                        <DialogDescription className="text-slate-50/80 font-medium text-sm mt-2">
                            Esta acción los marcará como <span className="text-white font-black italic">"Ingresado"</span> y ocupará sus posiciones en el almacén.
                        </DialogDescription>
                    </div>
                    <div className="p-8 flex gap-3 bg-slate-50/50">
                        <button
                            onClick={() => setShowUbicarConfirm(false)}
                            className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all active:scale-95"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={confirmUbicarEquipos}
                            className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-200 transition-all active:scale-95"
                        >
                            Ubicar ahora
                        </button>
                    </div>
                </DialogContent>
            </Dialog >

            {/* Modal de Confirmación de Cierre */}
            < Dialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm} >
                <DialogContent className="max-w-md p-0 overflow-hidden bg-white border-none shadow-2xl rounded-[2rem]">
                    <div className="p-8 space-y-6">
                        <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mx-auto">
                            <AlertCircle className="w-8 h-8" />
                        </div>
                        <div className="text-center space-y-2">
                            <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">¿Descartar cambios?</DialogTitle>
                            <DialogDescription className="text-sm text-slate-500 font-medium">
                                Tienes una ubicación seleccionada que no ha sido guardada. Si sales ahora, perderás estos cambios.
                            </DialogDescription>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowCloseConfirm(false)}
                                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                            >
                                Continuar
                            </button>
                            <button
                                onClick={confirmCloseUbicar}
                                className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-200 transition-all"
                            >
                                Descartar
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog >

            {/* Modal de Confirmación de Eliminación */}
            <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <DialogContent className="max-w-md p-0 overflow-hidden bg-white border-none shadow-2xl rounded-[2rem]">
                    <div className="bg-gradient-to-br from-red-700 to-rose-900 p-8 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-[5rem] -mr-10 -mt-10" />
                        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm shadow-inner">
                            <Trash2 className="w-8 h-8 text-white" />
                        </div>
                        <DialogTitle className="text-2xl font-black tracking-tighter text-white">
                            ¿Eliminar esta entrada?
                        </DialogTitle>
                        <DialogDescription className="text-rose-100/80 font-medium text-sm mt-2">
                            Esta acción es <span className="text-white font-black italic">permanente</span>. Se eliminarán todos los equipos, accesorios y evaluaciones asociadas.
                        </DialogDescription>
                    </div>
                    <div className="p-8 flex gap-3 bg-slate-50/50">
                        <button
                            onClick={() => setShowDeleteConfirm(false)}
                            disabled={isDeleting}
                            className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all active:scale-95 disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            disabled={isDeleting}
                            onClick={async () => {
                                setIsDeleting(true);
                                try {
                                    await entradasApi.delete(entradaId!);
                                    toast.success('Entrada eliminada correctamente');
                                    setShowDeleteConfirm(false);
                                    onDeleteSuccess?.();
                                    onClose();
                                } catch {
                                    toast.error('Error al eliminar la entrada');
                                } finally {
                                    setIsDeleting(false);
                                }
                            }}
                            className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-200 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            {isDeleting ? 'Eliminando...' : 'Sí, eliminar'}
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            <EvaluacionModal
                open={evalModalOpen}
                onClose={() => {
                    setEvalModalOpen(false);
                    setEvalItem(null);
                    setEvalId(undefined);
                }}
                item={evalItem}
                evaluationId={evalId}
                onSuccess={() => {
                    loadDetails(entradaId!);
                    onSuccess?.();
                }}
            />

            {/* Modal de Movilización */}
            <MovilizacionModal
                open={movilizacionModalOpen}
                onOpenChange={setMovilizacionModalOpen}
                onSuccess={() => {
                    if (entradaId) loadDetails(entradaId);
                    toast.success('Equipo movilizado con éxito');
                    onSuccess?.();
                }}
                equipo={movilizacionData}
            />
        </>
    );
}
