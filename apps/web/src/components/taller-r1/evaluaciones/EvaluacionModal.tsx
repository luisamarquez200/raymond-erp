import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    CheckCircle2,
    Image as ImageIcon,
    Save,
    X,
    Star,
    Zap,
    ShieldCheck,
    Settings,
    Circle,
    Loader2,
    Check,
    AlertCircle,
    FileText
} from 'lucide-react';
import { evaluacionesApi } from '@/services/taller-r1/evaluaciones.service';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import axios from 'axios';

interface EvaluacionModalProps {
    open: boolean;
    onClose: () => void;
    item: {
        id: string; // id_detalles or id_accesorio
        serial: string;
        modelo: string;
        tipo: 'equipo' | 'accesorio';
        clase?: string;
        distribuidor?: string;
        cliente_origen?: string;
    } | null;
    evaluationId?: string; // If provided, load this specific evaluation
    onSuccess?: () => void;
}

const PILLARES = [
    {
        id: 'basicos',
        label: 'BASICOS',
        items: [
            { id: '1', label: '1- El vehiculo Enciende sin problema y es funcional.' },
            { id: '2', label: '2- Los Motores No necesitan servicio Externo' },
            { id: '3', label: '3- El equipo Viene completo sin desmantelamiento' },
            { id: '4', label: '4- El Vehiculo llega sin Suciedad Excesiva y la carroceria en buenas condiciones y completa' }
        ]
    },
    {
        id: 'direccion',
        label: 'DIRECCION Y RUEDAS',
        items: [
            { id: '5', label: '5- Las Ruedas tienen al menos Media Vida y se encuentran sin cortes e Incrustaciones' },
            { id: '6', label: '6- El Freno del vehiculo funciona correctamente' },
            { id: '7', label: '7- La Direccion del vehiculo funciona de manera correcta, y no muestra fugas de aceite.' }
        ]
    },
    {
        id: 'hidraulico',
        label: 'SISTEMA HIDRAULICO Y DE CARGA',
        items: [
            { id: '8', label: '8- Se necesitan cambio de mangueras hidraulicas (rotas o con fugas)' },
            { id: '9', label: '9- La bomba hidraulica no presenta fugas de aceite' },
            { id: '10', label: '10- El equipo trae su tapon, Respirador y vayoneta' },
            { id: '11', label: '11- El sistema de elevacion/ descenso de horquilla funciona correctamente' },
            { id: '12', label: '12- El Mastil se encuentra en buenas condiciones al igual que las cadenas' },
            { id: '13', label: '13- El Sistema REACH, se encuentra en buen estado, sin Juego' }
        ]
    },
    {
        id: 'seguridad',
        label: 'CONTROLES Y SISTEMA DE SEGURIDAD',
        items: [
            { id: '14', label: '14- Los controles de manejo y Operación se encuentran completos y en buen estado.' },
            { id: '15', label: '15- Los sistemas de Seguridad como Alarma, Torreta, claxon funcionan correctamente' },
            { id: '16', label: '16- El equipo trae codigos de funcionamiento (Especificar en resultado)' }
        ]
    }
];

export function EvaluacionModal({
    open,
    onClose,
    item,
    evaluationId,
    onSuccess
}: EvaluacionModalProps) {
    const { user } = useAuthStore();
    const evaluatorName = user ? `${user.firstName || (user as any).Usuario || ''} ${user.lastName || ''}`.trim() : 'Usuario Actual';

    const [activeTab, setActiveTab] = useState('pillares');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [scores, setScores] = useState<Record<string, string>>({}); // 0-10 strings
    const [photos, setPhotos] = useState<Record<string, string>>({}); // Base64 or URLs
    const [porcentaje, setPorcentaje] = useState('');
    const [semanas, setSemanas] = useState('');
    const [estadoMontacargas, setEstadoMontacargas] = useState('');
    const [evaluator, setEvaluator] = useState('');
    const [dateCreated, setDateCreated] = useState<string>('');

    const isHistory = !!evaluationId;

    // Accessory states
    const [voltaje, setVoltaje] = useState('');
    const [condiciones, setCondiciones] = useState('');
    const [nivelElectrolitos, setNivelElectrolitos] = useState('');
    const [fugas, setFugas] = useState(false);
    const [danosFisicos, setDanosFisicos] = useState('');
    const [pruebaCarga, setPruebaCarga] = useState<any>({});
    const [celdasBuenEstado, setCeldasBuenEstado] = useState('');
    const [fechaUltimaCarga, setFechaUltimaCarga] = useState('');
    const [notasAccesorios, setNotasAccesorios] = useState('');
    const [calificacionDesc, setCalificacionDesc] = useState('');
    const [notasEquipo, setNotasEquipo] = useState(''); // Códigos
    const [horometro, setHorometro] = useState('');
    const [anioFabricacion, setAnioFabricacion] = useState('');
    const [faltantePiezas, setFaltantePiezas] = useState('');
    const [fotosFaltantes, setFotosFaltantes] = useState<Record<string, string>>({}); // id: 1, 2, 3
    const [observaciones, setObservaciones] = useState<{ obs1: string; obs2: string; obs3: string }>({ obs1: '', obs2: '', obs3: '' });
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);


    // Automatic calculation for Equipment
    useEffect(() => {
        if (item?.tipo === 'equipo') {
            const totalScore = Object.values(scores).reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
            const maxScore = 160;
            const computedPorcentaje = Math.round((totalScore * 100) / maxScore);
            setPorcentaje(String(computedPorcentaje));

            let computedSemanas = '';
            let computedEstado = '';
            let computedDesc = '';

            if (computedPorcentaje >= 86) {
                computedSemanas = '1';
                computedEstado = 'Nuevo';
                computedDesc = '1 SEMANA';
            } else if (computedPorcentaje >= 80) {
                computedSemanas = '2';
                computedEstado = 'Renovación';
                computedDesc = '2 SEMANAS';
            } else if (computedPorcentaje >= 51) {
                computedSemanas = '3';
                computedEstado = 'Renovación';
                computedDesc = '3 SEMANAS';
            } else if (computedPorcentaje >= 30) {
                computedSemanas = '4'; // 4-6 range
                computedEstado = 'Venta as is';
                computedDesc = '4 A 6 SEMANAS';
            } else {
                computedSemanas = '0';
                computedEstado = 'Venta as is';
                computedDesc = 'POR DEFINIR CADA CASO';
            }

            setSemanas(computedSemanas);
            setEstadoMontacargas(`${computedPorcentaje}% - ${computedEstado}`);
            setCalificacionDesc(computedDesc);
        }
    }, [scores, item?.tipo]);

    useEffect(() => {
        if (open && item) {
            loadExistingEvaluation();
        } else {
            resetForm();
        }
    }, [open, item, evaluationId]);

    const resetForm = () => {
        setScores({});
        setPhotos({});
        setPorcentaje('');
        setSemanas('');
        setEstadoMontacargas('');
        setVoltaje('');
        setCondiciones('');
        setNivelElectrolitos('');
        setFugas(false);
        setDanosFisicos('');
        setPruebaCarga({});
        setCeldasBuenEstado('');
        setFechaUltimaCarga('');
        setNotasAccesorios('');
        setNotasEquipo('');
        setHorometro('');
        setAnioFabricacion('');
        setFaltantePiezas('');
        setFotosFaltantes({});
        setObservaciones({ obs1: '', obs2: '', obs3: '' });
    };

    const loadExistingEvaluation = async () => {
        if (!item) return;
        setLoading(true);
        try {
            let data;
            if (isHistory) {
                data = await evaluacionesApi.getEvaluationById(evaluationId!);
                if (data) {
                    setScores(data.puntajes || {});
                    setPhotos(data.fotos || {});
                    setPorcentaje(data.porcentaje_total !== null ? String(data.porcentaje_total) : '');
                    setSemanas(data.semanas_renovacion !== null ? String(data.semanas_renovacion) : '');
                    setEstadoMontacargas(data.estado_montacargas || '');
                    setNotasEquipo(data.id_evaluacion ? (data as any).notas || '' : '');
                    setHorometro(data.id_evaluacion ? String((data as any).horometro || '') : '');
                    setAnioFabricacion(data.id_evaluacion && (data as any).anio_fabricacion != null ? String((data as any).anio_fabricacion) : '');
                    setFaltantePiezas(data.id_evaluacion ? (data as any).faltante_piezas || '' : '');
                    setFotosFaltantes(data.id_evaluacion ? (data as any).fotos_faltantes || {} : {});
                    setObservaciones(data.id_evaluacion ? (data as any).observaciones || { obs1: '', obs2: '', obs3: '' } : { obs1: '', obs2: '', obs3: '' });
                    setEvaluator(data.usuario_evaluador || '');
                    setDateCreated(data.fecha_creacion);
                }
            } else if (item.tipo === 'equipo') {
                data = await evaluacionesApi.getEquipoEvaluation(item.id);
                if (data) {
                    setScores(data.puntajes || {});
                    setPhotos(data.fotos || {});
                    setPorcentaje(data.porcentaje_total !== null ? String(data.porcentaje_total) : '');
                    setSemanas(data.semanas_renovacion !== null ? String(data.semanas_renovacion) : '');
                    setEstadoMontacargas(data.estado_montacargas || '');
                    setNotasEquipo(data.id_evaluacion ? (data as any).notas || '' : '');
                    setHorometro(data.id_evaluacion ? String((data as any).horometro || '') : '');
                    setAnioFabricacion(data.id_evaluacion && (data as any).anio_fabricacion != null ? String((data as any).anio_fabricacion) : '');
                    setFaltantePiezas(data.id_evaluacion ? (data as any).faltante_piezas || '' : '');
                    setFotosFaltantes(data.id_evaluacion ? (data as any).fotos_faltantes || {} : {});
                    setObservaciones(data.id_evaluacion ? (data as any).observaciones || { obs1: '', obs2: '', obs3: '' } : { obs1: '', obs2: '', obs3: '' });
                    // Load who previously evaluated (display in badge)
                    if (data.usuario_evaluador) setEvaluator(data.usuario_evaluador);
                    if ((data as any).fecha_creacion) setDateCreated((data as any).fecha_creacion);
                }
            } else {
                data = await evaluacionesApi.getAccesorioEvaluation(item.id);
                if (data) {
                    setVoltaje(data.voltaje !== null ? String(data.voltaje) : '');
                    setCondiciones(data.condiciones || '');
                    setNivelElectrolitos(data.nivel_electrolitos || '');
                    setFugas(Boolean(data.fugas));
                    setDanosFisicos(data.danos_fisicos || '');
                    setPruebaCarga(data.prueba_carga || {});
                    setCeldasBuenEstado(data.celdas_buen_estado != null ? String(data.celdas_buen_estado) : '');
                    setFechaUltimaCarga(data.fecha_ultima_carga ? String(data.fecha_ultima_carga) : '');
                    setNotasAccesorios(data.notas || '');
                    setEvaluator((data as any).usuario_evaluador || '');
                    setDateCreated((data as any).fecha_creacion || '');
                }
            }
        } catch (error: any) {
            if (error?.response?.status !== 404) {
                console.error('Error loading evaluation:', getErrorMessage(error));
                toast.error(getErrorMessage(error, 'Error al cargar la evaluación existente.'));
            }
        } finally {
            setLoading(false);
        }
    };

    const handlePhotoUpload = (criterioId: string, e: React.ChangeEvent<HTMLInputElement>, isFaltante = false) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            if (isFaltante) {
                setFotosFaltantes(prev => ({ ...prev, [criterioId]: reader.result as string }));
            } else {
                setPhotos(prev => ({ ...prev, [criterioId]: reader.result as string }));
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        if (!item) return;

        // Validation for Equipment: 16 criteria and their photos
        if (item.tipo === 'equipo') {
            const missingScores = [];

            const allCriteriaIds = PILLARES.flatMap(p => p.items.map(i => i.id));

            for (const id of allCriteriaIds) {
                if (!scores[id]) missingScores.push(id);
            }

            if (missingScores.length > 0) {
                toast.error('Calificación incompleta', {
                    description: `Faltan ${missingScores.length} puntuaciones obligatorias.`,
                });
                return;
            }
        }

        setSaving(true);
        try {
            if (item.tipo === 'equipo') {
                await evaluacionesApi.saveEquipoEvaluation({
                    id_detalle: item.id,
                    puntajes: scores,
                    fotos: photos,
                    porcentaje_total: porcentaje ? parseFloat(porcentaje) : undefined,
                    semanas_renovacion: semanas ? parseInt(semanas) : undefined,
                    estado_montacargas: estadoMontacargas,
                    notas: notasEquipo,
                    horometro: horometro ? parseInt(horometro) : undefined,
                    anio_fabricacion: anioFabricacion ? parseInt(anioFabricacion) : undefined,
                    faltante_piezas: faltantePiezas,
                    fotos_faltantes: fotosFaltantes,
                    observaciones: observaciones,
                    usuario_evaluador: evaluatorName
                });

                try {
                    const pdfBase64 = await exportToPDF(true);
                    if (pdfBase64) {
                        await axios.post('/api/taller-r1/mail/evaluacion', {
                            serial: item.serial,
                            resultado: porcentaje ? `${porcentaje}%` : 'N/A',
                            pdfBase64: pdfBase64
                        });
                    }
                } catch (e) {
                    console.error("Error sending evaluation email", getErrorMessage(e));
                }
            } else {
                await evaluacionesApi.saveAccesorioEvaluation({
                    id_accesorio: item.id,
                    voltaje: voltaje ? parseFloat(voltaje) : undefined,
                    condiciones,
                    nivel_electrolitos: nivelElectrolitos,
                    fugas,
                    danos_fisicos: danosFisicos,
                    prueba_carga: pruebaCarga,
                    celdas_buen_estado: celdasBuenEstado ? parseInt(celdasBuenEstado) : undefined,
                    fecha_ultima_carga: fechaUltimaCarga || undefined,
                    notas: notasAccesorios,
                    usuario_evaluador: evaluatorName,
                });
            }
            toast.success('Calificación guardada correctamente.');
            onSuccess?.();
            onClose();
        } catch (error) {
            console.error('Error saving evaluation:', getErrorMessage(error));
            toast.error(getErrorMessage(error, 'Error al guardar la calificación.'));
        } finally {
            setSaving(false);
        }
    };

    const exportToExcel = async () => {
        if (!item) return;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Evaluación');

        // Header Structure based on user image
        worksheet.mergeCells('B1:C1'); worksheet.getCell('B1').value = 'SERIE:';
        worksheet.mergeCells('D1:E1'); worksheet.getCell('D1').value = item.serial;

        worksheet.mergeCells('F1:I2');
        const titleCell = worksheet.getCell('F1');
        titleCell.value = 'EVALUACION DE EQUIPOS\nRETORNO DE RENTA';
        titleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF444444' } };
        titleCell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 14 };

        worksheet.mergeCells('J1:L1');
        worksheet.getCell('J1').value = 'RAYMOND';
        worksheet.getCell('J1').alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getCell('J1').font = { bold: true, size: 16, color: { argb: 'FFCC0000' } };

        worksheet.mergeCells('B2:C2'); worksheet.getCell('B2').value = 'MODELO:';
        worksheet.mergeCells('D2:E2'); worksheet.getCell('D2').value = item.modelo;

        worksheet.mergeCells('J2:L2');
        worksheet.getCell('J2').value = `FECHA: ${dateCreated ? new Date(dateCreated).toLocaleDateString() : new Date().toLocaleDateString()}`;
        worksheet.getCell('J2').alignment = { horizontal: 'center', vertical: 'middle' };

        worksheet.mergeCells('B3:E3');
        worksheet.getCell('B3').value = `% CALIFICACION DE RECIBO: ${porcentaje}%`;

        worksheet.mergeCells('F3:H4');
        worksheet.getCell('F3').value = `SEMANAS DE RESTAURACION: ${semanas}`;
        worksheet.getCell('F3').alignment = { vertical: 'middle', horizontal: 'center' };

        worksheet.mergeCells('I3:L3');
        worksheet.getCell('I3').value = `DISTRIBUIDOR: ${item.distribuidor || '-'}`;

        worksheet.mergeCells('I4:L4');
        worksheet.getCell('I4').value = `CTE ORIGEN: ${item.cliente_origen || '-'}`;

        // Instruction
        worksheet.mergeCells('B6:L6');
        worksheet.getCell('B6').value = 'INSTRUCCIÓN: A la llegada del equipo de Renta, Evaluar las condiciones listadas en que se recibe el equipo, Utilizar el siguiente Criterio de Evaluacion:';
        worksheet.getCell('B6').font = { size: 9, italic: true };

        // Legend
        worksheet.mergeCells('B7:C7'); worksheet.getCell('B7').value = '0= No Funciona o daño Severo';
        worksheet.mergeCells('F7:H7'); worksheet.getCell('F7').value = '5= Funciona pero tiene desgaste considerable';
        worksheet.mergeCells('B8:C8'); worksheet.getCell('B8').value = '7= Funciona pero necesita Mtto preventivo';
        worksheet.mergeCells('F8:G8'); worksheet.getCell('F8').value = '10= Se encuentra en perfecto estado';

        // Table Header
        const tableHeaderRow = 10;
        worksheet.getCell(`B${tableHeaderRow}`).value = 'PILAR';
        worksheet.mergeCells(`C${tableHeaderRow}:I${tableHeaderRow}`);
        worksheet.getCell(`C${tableHeaderRow}`).value = 'DESCRIPCION';
        worksheet.getCell(`J${tableHeaderRow}`).value = 'Ideal';
        worksheet.getCell(`K${tableHeaderRow}`).value = 'VALORACION';

        ['B', 'C', 'J', 'K'].forEach(col => {
            const cell = worksheet.getCell(`${col}${tableHeaderRow}`);
            cell.font = { bold: true };
            cell.alignment = { horizontal: 'center' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        let currentRow = tableHeaderRow + 1;

        // Pillars Data
        PILLARES.forEach(pilar => {
            const pilarStartRow = currentRow;
            pilar.items.forEach((crit) => {
                worksheet.mergeCells(`C${currentRow}:I${currentRow}`);
                worksheet.getCell(`C${currentRow}`).value = crit.label;
                worksheet.getCell(`J${currentRow}`).value = 10;
                worksheet.getCell(`K${currentRow}`).value = scores[crit.id] || "0";

                // Borders
                [`C`, `J`, `K`].forEach(col => {
                    const cell = worksheet.getCell(`${col}${currentRow}`);
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                });
                currentRow++;
            });
            worksheet.mergeCells(`B${pilarStartRow}:B${currentRow - 1}`);
            const pilarCell = worksheet.getCell(`B${pilarStartRow}`);
            pilarCell.value = pilar.label;
            pilarCell.alignment = { vertical: 'middle', horizontal: 'center', textRotation: 90 };
            pilarCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        // Software/Resultado Footer
        worksheet.mergeCells(`B${currentRow}:I${currentRow}`);
        worksheet.getCell(`B${currentRow}`).value = 'SOFTWARE';
        worksheet.getCell(`B${currentRow}`).alignment = { horizontal: 'center' };
        worksheet.getCell(`J${currentRow}`).value = 160;

        currentRow++;
        worksheet.mergeCells(`B${currentRow}:I${currentRow + 1}`);
        worksheet.getCell(`B${currentRow}`).value = `16- El equipo llega con los Siguientes codigos: ${notasEquipo || '-'}`;

        worksheet.mergeCells(`J${currentRow}:K${currentRow}`);
        worksheet.getCell(`J${currentRow}`).value = 'RESULTADO:';
        worksheet.mergeCells(`J${currentRow + 1}:L${currentRow + 1}`);
        worksheet.getCell(`J${currentRow + 1}`).value = `${porcentaje}%`;
        worksheet.getCell(`J${currentRow + 1}`).alignment = { horizontal: 'center' };

        currentRow += 3;
        // Observations and Lookup Table
        worksheet.getCell(`B${currentRow}`).value = 'OBSERVACIONES:';
        worksheet.getCell(`B${currentRow + 1}`).value = observaciones.obs1 || '-';
        worksheet.getCell(`B${currentRow + 2}`).value = observaciones.obs2 || '-';
        worksheet.getCell(`B${currentRow + 3}`).value = observaciones.obs3 || '-';

        // Lookup Table
        const lookupStartRow = currentRow;
        worksheet.mergeCells(`F${lookupStartRow}:I${lookupStartRow}`);
        worksheet.getCell(`F${lookupStartRow}`).value = 'PROMEDIO';
        worksheet.mergeCells(`J${lookupStartRow}:L${lookupStartRow}`);
        worksheet.getCell(`J${lookupStartRow}`).value = 'SEMANAS DE RESTAURACIÓN';

        const lookupData = [
            ['0 AL 19%', 'NO RECOMENDADA, EQUIPO OBSOLETO'],
            ['20 AL 29%', 'POR DEFINIR CADA CASO'],
            ['30 AL 50%', '4 A 6 SEMANAS'],
            ['50 AL 79%', '3 SEMANAS'],
            ['80 AL 85%', '2 SEMANAS'],
            ['>86%', '1 SEMANA']
        ];

        lookupData.forEach((row, i) => {
            worksheet.mergeCells(`F${lookupStartRow + 1 + i}:I${lookupStartRow + 1 + i}`);
            worksheet.getCell(`F${lookupStartRow + 1 + i}`).value = row[0];
            worksheet.mergeCells(`J${lookupStartRow + 1 + i}:L${lookupStartRow + 1 + i}`);
            worksheet.getCell(`J${lookupStartRow + 1 + i}`).value = row[1];
        });

        currentRow += 8;
        worksheet.mergeCells(`B${currentRow}:C${currentRow}`);
        worksheet.getCell(`B${currentRow}`).value = `NOMBRE DE QUIEN EVALUO: ${evaluator || evaluatorName}`;
        worksheet.mergeCells(`D${currentRow}:F${currentRow}`);
        worksheet.getCell(`B${currentRow}`).font = { bold: true };

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Evaluacion_${item.serial}_${new Date().getTime()}.xlsx`);
    };

    const exportToPDF = async (returnBase64Only = false): Promise<string | void> => {
        if (!item) return;

        const doc = new jsPDF();

        const logoUrl = window.location.origin + '/fsimage.png';
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

        const logoBase64 = await getBase64ImageFromUrl(logoUrl);

        // Header
        if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', 160, 10, 40, 10);
        } else {
            doc.setFontSize(18);
            doc.setTextColor(200, 0, 0);
            doc.text('RAYMOND', 160, 20);
        }

        doc.setDrawColor(0);
        doc.setFillColor(68, 68, 68);
        doc.rect(70, 10, 80, 20, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.text('EVALUACIÓN DE EQUIPOS', 110, 18, { align: 'center' });
        doc.text('RETORNO DE RENTA', 110, 26, { align: 'center' });

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.text(`SERIE: ${item.serial}`, 10, 20);
        doc.text(`MODELO: ${item.modelo}`, 10, 30);
        doc.text(`FECHA: ${dateCreated ? new Date(dateCreated).toLocaleDateString() : new Date().toLocaleDateString()}`, 160, 30);

        doc.text(`% CALIFICACIÓN DE RECIBO: ${porcentaje}%`, 10, 45);
        doc.text(`SEMANAS DE RESTAURACIÓN: ${semanas}`, 80, 45);
        doc.text(`DISTRIBUIDOR: ${item.distribuidor || '-'}`, 140, 45);
        doc.text(`CTE ORIGEN: ${item.cliente_origen || '-'}`, 140, 52);

        // Instruction
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text('INSTRUCCIÓN: A la llegada del equipo de Renta, Evaluar las condiciones listadas en que se recibe el equipo, Utilizar el siguiente Criterio de Evaluacion:', 10, 65);
        doc.text('0= No Funciona o daño Severo | 5= Funciona pero tiene desgaste | 7= Necesita Mantenimiento | 10= Perfecto estado', 10, 70);

        // Table
        const tableBody: any[] = [];
        PILLARES.forEach(pilar => {
            pilar.items.forEach((crit, idx) => {
                if (idx === 0) {
                    tableBody.push([
                        { content: pilar.label, rowSpan: pilar.items.length, styles: { valign: 'middle', halign: 'center' } },
                        crit.label,
                        '10',
                        scores[crit.id] || '0'
                    ]);
                } else {
                    tableBody.push([
                        crit.label,
                        '10',
                        scores[crit.id] || '0'
                    ]);
                }
            });
        });

        autoTable(doc, {
            startY: 75,
            head: [['PILAR', 'DESCRIPCIÓN', 'IDEAL', 'VALORACIÓN']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [68, 68, 68], textColor: 255 },
            styles: { fontSize: 8, cellPadding: 2 },
            columnStyles: {
                0: { cellWidth: 30, fontStyle: 'bold' },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 20, halign: 'center' },
                3: { cellWidth: 30, halign: 'center' }
            }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 10;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`RESULTADO TOTAL: ${porcentaje}%`, 150, finalY);

        doc.setFont('helvetica', 'normal');
        doc.text('OBSERVACIONES:', 10, finalY);
        doc.setFontSize(8);
        doc.text(observaciones.obs1 || '-', 10, finalY + 5);
        doc.text(observaciones.obs2 || '-', 10, finalY + 10);
        doc.text(observaciones.obs3 || '-', 10, finalY + 15);

        doc.setFontSize(10);
        doc.line(10, finalY + 25, 80, finalY + 25);
        doc.text(`EVALUADO POR: ${evaluator || evaluatorName}`, 10, finalY + 30);

        // Evidencia Fotográfica
        const allPhotos: string[] = [];
        Object.values(photos).forEach(val => val && allPhotos.push(val));
        Object.values(fotosFaltantes).forEach(val => val && allPhotos.push(val));

        if (allPhotos.length > 0) {
            doc.addPage();
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('EVIDENCIA FOTOGRÁFICA', 105, 20, { align: 'center' });
            
            let imgX = 20;
            let imgY = 30;
            const imgWidth = 80;
            const imgHeight = 60;
            let count = 0;

            for (const photo of allPhotos) {
                let base64 = photo;
                if (photo.startsWith('http')) {
                    base64 = await getBase64ImageFromUrl(photo);
                }
                
                if (!base64) continue;
                
                if (count > 0 && count % 6 === 0) {
                    doc.addPage();
                    imgX = 20;
                    imgY = 20;
                }
                
                const isPng = base64.toLowerCase().includes('image/png') || photo.toLowerCase().endsWith('.png');
                try {
                    doc.addImage(base64, isPng ? 'PNG' : 'JPEG', imgX, imgY, imgWidth, imgHeight);
                } catch (e) {
                    console.error("Error adding photo to PDF", e);
                }
                
                if (imgX === 20) {
                    imgX += 90;
                } else {
                    imgX = 20;
                    imgY += 70;
                }
                count++;
            }
        }

        if (returnBase64Only) {
            return doc.output('datauristring');
        } else {
            doc.save(`Evaluacion_${item.serial}_${new Date().getTime()}.pdf`);
        }
    };

    if (!item) return null;

    return (
        <>
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent
                    className="max-w-2xl p-0 overflow-y-auto bg-slate-50 border-none shadow-2xl rounded-[2.5rem] max-h-[90vh] block"
                    onInteractOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    {/* Header Section */}
                    <div className="p-10 pb-0 relative">
                        <div className="flex items-center justify-between gap-4 mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                                    <CheckCircle2 className="text-white" size={24} />
                                </div>
                                <div>
                                    <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100">
                                        Evaluación de Entrada
                                    </span>
                                </div>
                            </div>
                            <span className="text-slate-400 text-xs font-mono font-bold bg-white px-3 py-1 rounded-lg border border-slate-100 shadow-sm">{item.serial}</span>
                        </div>
                        <DialogTitle className="text-3xl font-black tracking-tighter text-slate-900">
                            Calificación de {item.tipo === 'equipo' ? 'Equipo' : 'Accesorio'}
                        </DialogTitle>
                        <DialogDescription className="text-slate-500 font-medium text-sm mt-2 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                            {item.modelo}
                            {item.clase && (
                                <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                    {item.clase}
                                </>
                            )}
                        </DialogDescription>
                        {/* Evaluator Badge */}
                        <div className="mt-4 flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-2xl">
                            <div className="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center shrink-0">
                                <CheckCircle2 size={14} className="text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.15em]">Evaluador</p>
                                <p className="text-sm font-black text-indigo-900 truncate">
                                    {isHistory ? (evaluator || 'No registrado') : evaluatorName}
                                </p>
                            </div>
                            {dateCreated && (
                                <span className="text-[9px] font-bold text-indigo-400 shrink-0">
                                    {new Date(dateCreated).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="p-8">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-4 text-slate-400">
                                <Loader2 className="animate-spin" size={40} />
                                <p className="font-medium animate-pulse">Cargando datos previos...</p>
                            </div>
                        ) : item.tipo === 'equipo' ? (
                            <div className="space-y-12">
                                {/* Checklist Section */}
                                {PILLARES.map(pilar => (
                                    <div key={pilar.id} className="space-y-4">
                                        <div className="flex items-center gap-2 px-2">
                                            <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">{pilar.label}</h4>
                                        </div>
                                        <div className="grid grid-cols-1 gap-4">
                                            {pilar.items.map(crit => (
                                                <div key={crit.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 group transition-all hover:shadow-md">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                        <div className="flex-1">
                                                            <Label className="text-sm font-bold text-slate-700 leading-tight block mb-1">
                                                                {crit.label} <span className="text-rose-500 font-black ml-1">*</span>
                                                            </Label>
                                                            {crit.id === '16' && (
                                                                <div className="mt-2 text-[10px] text-slate-400 font-medium">
                                                                    * Si existen códigos, captúrelos en las notas o descripción del resultado.
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-4">
                                                            <div className="relative w-32 shrink-0">
                                                                <select
                                                                    disabled={isHistory}
                                                                    className="w-full h-11 px-4 bg-slate-50 rounded-xl border-none font-bold text-indigo-600 focus:ring-2 focus:ring-indigo-500 appearance-none text-center disabled:opacity-100"
                                                                    value={scores[crit.id] || ''}
                                                                    onChange={(e) => setScores(prev => ({ ...prev, [crit.id]: e.target.value }))}
                                                                >
                                                                    <option value="">Calificar...</option>
                                                                    <option value="0">0 (Severo)</option>
                                                                    <option value="5">5 (Desgaste)</option>
                                                                    <option value="7">7 (Preventivo)</option>
                                                                    <option value="10">10 (Perfecto)</option>
                                                                </select>
                                                                                                         <div className="relative group/photo shrink-0">
                                                                {photos[crit.id] ? (
                                                                    <div className="relative w-20 h-20 rounded-2xl overflow-hidden shadow-inner group-hover/photo:opacity-90 transition-opacity">
                                                                        <img src={photos[crit.id]} alt={crit.id} className="w-full h-full object-cover" />
                                                                        {!isHistory && (
                                                                            <button
                                                                                onClick={() => setPhotos(prev => {
                                                                                    const n = { ...prev };
                                                                                    delete n[crit.id];
                                                                                    return n;
                                                                                })}
                                                                                className="absolute top-1 right-1 p-1 bg-rose-500 text-white rounded-full shadow-lg opacity-0 group-hover/photo:opacity-100 transition-opacity"
                                                                            >
                                                                                <X size={10} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ) : !isHistory ? (
                                                                    <label className="flex flex-col items-center justify-center w-20 h-20 border-2 border-dashed border-slate-200 bg-slate-50 rounded-2xl cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 transition-all text-slate-400 hover:text-indigo-500">
                                                                        <ImageIcon size={20} className="mb-1 opacity-50" />
                                                                        <span className="text-[8px] font-black uppercase tracking-tight">Foto</span>
                                                                        <input
                                                                            type="file"
                                                                            capture="environment"
                                                                            accept="image/*"
                                                                            className="hidden"
                                                                            onChange={(e) => handlePhotoUpload(crit.id, e, false)}
                                                                        />
                                                                    </label>
                                                                ) : (
                                                                    <div className="flex flex-col items-center justify-center w-20 h-20 border border-slate-100 bg-slate-50 rounded-2xl text-slate-300">
                                                                        <ImageIcon size={20} className="opacity-30" />
                                                                        <span className="text-[8px] font-black uppercase tracking-tight">Sin Foto</span>
                                                                    </div>
                                                                )}
                                                            </div>
                 </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                {/* New Fields Section */}

                                {/* Horometro */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase text-slate-500 px-1">Horómetro HD</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        disabled={isHistory}
                                        placeholder="Horas"
                                        className="h-14 bg-white rounded-2xl border-slate-200 font-bold text-xl px-4 focus-visible:ring-indigo-500 shadow-sm text-slate-900"
                                        value={horometro}
                                        onChange={(e) => setHorometro(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase text-slate-500 px-1">Año de Fabricación</Label>
                                    <select
                                        disabled={isHistory}
                                        className="w-full h-14 bg-white rounded-2xl border border-slate-200 font-bold text-xl px-4 focus-visible:ring-indigo-500 shadow-sm appearance-none text-slate-900 disabled:opacity-100"
                                        value={anioFabricacion}
                                        onChange={(e) => setAnioFabricacion(e.target.value)}
                                    >
                                        <option value="">Seleccionar año...</option>
                                        {Array.from({ length: new Date().getFullYear() - 1980 + 2 }, (_, i) => 1980 + i)
                                            .reverse()
                                            .map(year => (
                                                <option key={year} value={year}>{year}</option>
                                            ))
                                        }
                                    </select>
                                </div>

                                {/* Faltante de Piezas */}
                                <div className="bg-orange-50 p-6 rounded-[2rem] border border-orange-100 space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black uppercase text-orange-800 px-1">Faltante de Piezas</Label>
                                        <Textarea
                                            disabled={isHistory}
                                            placeholder="Describa las refacciones faltantes..."
                                            className="min-h-[100px] bg-white rounded-2xl border-orange-200 p-4 font-medium focus-visible:ring-orange-500 shadow-sm placeholder:text-orange-300 text-slate-900"
                                            value={faltantePiezas}
                                            onChange={(e) => setFaltantePiezas(e.target.value)}
                                        />
                                    </div>

                                    <Label className="text-[10px] font-black uppercase text-orange-800 px-1">Fotos Faltantes (3 espacios)</Label>
                                    <div className="flex gap-4 overflow-x-auto pb-2">
                                        {[1, 2, 3].map((num) => (
                                            <div key={`faltante-${num}`} className="relative group/photo shrink-0">
                                                {fotosFaltantes[num] ? (
                                                    <div className="relative w-24 h-24 rounded-2xl overflow-hidden shadow-sm border-2 border-orange-200 group-hover/photo:opacity-90 transition-opacity">
                                                        <img src={fotosFaltantes[num]} alt={`Faltante ${num}`} className="w-full h-full object-cover" />
                                                        {!isHistory && (
                                                            <button
                                                                onClick={() => setFotosFaltantes(prev => {
                                                                    const n = { ...prev };
                                                                    delete n[num];
                                                                    return n;
                                                                })}
                                                                className="absolute top-1 right-1 p-1 bg-rose-500 text-white rounded-full shadow-lg opacity-0 group-hover/photo:opacity-100 transition-opacity"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : !isHistory ? (
                                                    <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-orange-200 bg-white rounded-2xl cursor-pointer hover:bg-orange-100 hover:border-orange-300 transition-all text-orange-300 hover:text-orange-500">
                                                        <div className="p-2 bg-orange-100 rounded-full mb-1">
                                                            <ImageIcon size={16} />
                                                        </div>
                                                        <span className="text-[8px] font-black uppercase">Foto {num}</span>
                                                        <input
                                                            type="file"
                                                            capture="environment"
                                                            accept="image/*"
                                                            className="hidden"
                                                            onChange={(e) => handlePhotoUpload(String(num), e, true)}
                                                        />
                                                    </label>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center w-24 h-24 border border-orange-100 bg-white rounded-2xl text-orange-200">
                                                        <ImageIcon size={16} className="opacity-50" />
                                                        <span className="text-[8px] font-black uppercase">Sin Foto</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Equipment Notes (Codes) */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase text-slate-500 px-1">El equipo llega con los Siguientes codigos en su software</Label>
                                    <Textarea
                                        disabled={isHistory}
                                        placeholder="Ingrese códigos..."
                                        className="min-h-[100px] bg-white rounded-2xl border-slate-200 p-4 font-medium focus-visible:ring-indigo-500 shadow-sm text-slate-900"
                                        value={notasEquipo}
                                        onChange={(e) => setNotasEquipo(e.target.value)}
                                    />
                                </div>

                                {/* Observaciones (3 fields) */}
                                <div className="space-y-3">
                                    <Label className="text-xs font-black uppercase text-slate-500 px-1">Observaciones Generales</Label>
                                    <Input
                                        disabled={isHistory}
                                        placeholder="Observación 1..."
                                        className="h-12 bg-white rounded-xl border-slate-200 px-4 focus-visible:ring-indigo-500 shadow-sm text-slate-900"
                                        value={observaciones.obs1}
                                        onChange={(e) => setObservaciones(prev => ({ ...prev, obs1: e.target.value }))}
                                    />
                                    <Input
                                        disabled={isHistory}
                                        placeholder="Observación 2..."
                                        className="h-12 bg-white rounded-xl border-slate-200 px-4 focus-visible:ring-indigo-500 shadow-sm text-slate-900"
                                        value={observaciones.obs2}
                                        onChange={(e) => setObservaciones(prev => ({ ...prev, obs2: e.target.value }))}
                                    />
                                    <Input
                                        disabled={isHistory}
                                        placeholder="Observación 3..."
                                        className="h-12 bg-white rounded-xl border-slate-200 px-4 focus-visible:ring-indigo-500 shadow-sm text-slate-900"
                                        value={observaciones.obs3}
                                        onChange={(e) => setObservaciones(prev => ({ ...prev, obs3: e.target.value }))}
                                    />
                                </div>

                                {/* Summary Section */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-8 border-t border-slate-200">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black uppercase text-slate-500 px-1">Porcentaje (%)</Label>
                                        <Input
                                            type="number"
                                            placeholder="0-100"
                                            className="h-14 bg-white rounded-2xl border-slate-200 font-black text-xl text-indigo-600 px-4 focus-visible:ring-indigo-500 shadow-sm"
                                            value={porcentaje}
                                            onChange={(e) => setPorcentaje(e.target.value)}
                                            readOnly
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black uppercase text-slate-500 px-1">Semanas Renovación</Label>
                                        <Input
                                            type="number"
                                            disabled={isHistory}
                                            placeholder="Weeks"
                                            className="h-14 bg-white rounded-2xl border-slate-200 font-black text-xl text-indigo-600 px-4 focus-visible:ring-indigo-500 shadow-sm"
                                            value={semanas}
                                            onChange={(e) => setSemanas(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black uppercase text-slate-500 px-1">Estado</Label>
                                        <Input
                                            disabled={isHistory}
                                            placeholder="Estado..."
                                            className="h-14 bg-white rounded-2xl border-slate-200 font-black text-xl text-indigo-600 px-4 focus-visible:ring-indigo-500 shadow-sm"
                                            value={estadoMontacargas}
                                            onChange={(e) => setEstadoMontacargas(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className={`p-6 rounded-[2rem] border flex items-start gap-4 transition-all ${porcentaje && parseInt(porcentaje) < 30 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                    <div className={`p-3 rounded-2xl shadow-lg ${porcentaje && parseInt(porcentaje) < 30 ? 'bg-rose-600' : 'bg-emerald-600'} text-white`}>
                                        <ShieldCheck size={20} />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className={`font-black leading-none ${porcentaje && parseInt(porcentaje) < 30 ? 'text-rose-900' : 'text-emerald-900'}`}>Calificación Automática</h4>
                                        <p className={`text-sm font-bold leading-relaxed ${porcentaje && parseInt(porcentaje) < 30 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                            {calificacionDesc || 'Sin calificación calculada'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Accessory Section */}
                                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-black uppercase text-slate-500 px-1">Voltaje (Parámetro Real)</Label>
                                            <Input
                                                type="number"
                                                placeholder="Volts"
                                                className="h-14 bg-slate-50/50 rounded-2xl border-none font-black text-xl px-6 focus-visible:ring-indigo-500 text-slate-900"
                                                value={voltaje}
                                                onChange={(e) => setVoltaje(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-black uppercase text-slate-500 px-1">Nivel de Electrolitos</Label>
                                            <div className="flex gap-2">
                                                {['Alto', 'Medio', 'Bajo'].map(c => (
                                                    <button
                                                        key={c}
                                                        onClick={() => setNivelElectrolitos(c)}
                                                        className={`flex-1 h-14 rounded-2xl font-bold text-xs transition-all ${nivelElectrolitos === c
                                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                                            : 'bg-white border border-slate-200 text-slate-500 hover:border-indigo-300'
                                                            }`}
                                                    >
                                                        {c}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2 flex flex-col justify-center">
                                            <Label className="text-xs font-black uppercase text-slate-500 px-1 mb-2">Estado de la Batería</Label>
                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <div className="relative">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only"
                                                        checked={fugas}
                                                        onChange={(e) => setFugas(e.target.checked)}
                                                    />
                                                    <div className={`w-12 h-6 bg-slate-200 rounded-full transition-colors ${fugas ? 'bg-rose-500' : 'bg-slate-300'}`}></div>
                                                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform transform ${fugas ? 'translate-x-6' : ''}`}></div>
                                                </div>
                                                <span className="text-sm font-bold text-slate-700 select-none group-hover:text-slate-900">¿Presenta Fugas?</span>
                                            </label>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-black uppercase text-slate-500 px-1">Fecha de Última Carga</Label>
                                            <input
                                                type="date"
                                                className="w-full h-14 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all"
                                                value={fechaUltimaCarga ? new Date(fechaUltimaCarga).toISOString().split('T')[0] : ''}
                                                onChange={(e) => setFechaUltimaCarga(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs font-black uppercase text-slate-500 px-1">Condición / Daños Físicos</Label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-black uppercase text-slate-400 px-1">Condiciones / Parámetros</Label>
                                                <Textarea
                                                    placeholder="Condiciones actuales..."
                                                    className="w-full min-h-[100px] bg-slate-50/50 rounded-2xl border-none p-4 font-medium focus-visible:ring-indigo-500 text-slate-900"
                                                    value={condiciones}
                                                    onChange={(e) => setCondiciones(e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] font-black uppercase text-slate-400 px-1">Daños Físicos o Golpes</Label>
                                                <Textarea
                                                    placeholder="Descripción de daños..."
                                                    className="w-full min-h-[100px] bg-slate-50/50 rounded-2xl border-none p-4 font-medium focus-visible:ring-indigo-500 text-slate-900"
                                                    value={danosFisicos}
                                                    onChange={(e) => setDanosFisicos(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs font-black uppercase text-slate-500 px-1">Número de celdas en buen estado</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            max="18"
                                            placeholder="0 - 18"
                                            className="h-14 bg-slate-50/50 rounded-2xl border-none font-black text-xl px-6 focus-visible:ring-indigo-500 text-slate-900"
                                            value={celdasBuenEstado}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value);
                                                if (e.target.value === '' || (!isNaN(val) && val >= 0 && val <= 18)) {
                                                    setCeldasBuenEstado(e.target.value);
                                                }
                                            }}
                                        />
                                        <p className="text-[10px] font-bold text-slate-400 px-1">Se permiten valores de 0 a 18 celdas.</p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs font-black uppercase text-slate-500 px-1">Notas Adicionales / Celdas Obstruidas</Label>
                                        <Textarea
                                            placeholder="Describa cualquier otra observación o las celdas afectadas..."
                                            className="min-h-[100px] bg-slate-50/50 rounded-3xl border-none p-6 font-medium focus-visible:ring-indigo-500 text-slate-900"
                                            value={notasAccesorios}
                                            onChange={(e) => setNotasAccesorios(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="p-6 sm:p-8 flex flex-col sm:flex-row gap-3 bg-slate-50 border-t border-slate-200 mt-8 rounded-b-[2.5rem] -mx-8 -mb-8">
                            <Button
                                variant="ghost"
                                onClick={() => setShowCancelConfirm(true)}
                                className="w-full sm:w-auto h-14 rounded-2xl border-none bg-white font-black text-slate-600 hover:bg-slate-100 shadow-sm shrink-0"
                            >
                                {isHistory ? 'Cerrar' : 'Cancelar'}
                            </Button>

                            {isHistory && (
                                <div className="flex flex-col sm:flex-row gap-3 w-full sm:ml-auto">
                                    <Button
                                        onClick={() => exportToPDF(false)}
                                        className="flex-1 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl px-8 h-14 font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-rose-200"
                                    >
                                        <FileText className="mr-2" size={16} />
                                        Exportar PDF
                                    </Button>
                                    <Button
                                        onClick={exportToExcel}
                                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl px-8 h-14 font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-200"
                                    >
                                        <Save className="mr-2" size={16} />
                                        Exportar Excel
                                    </Button>
                                </div>
                            )}

                            {!isHistory && (
                                <Button
                                    disabled={saving}
                                    onClick={handleSave}
                                    className="flex-1 h-14 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-800 text-white font-black shadow-xl shadow-indigo-200 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                                >
                                    {saving ? (
                                        <Loader2 className="animate-spin mr-2" />
                                    ) : (
                                        <Save className="mr-2" />
                                    )}
                                    Guardar Calificación
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
                <DialogContent className="max-w-md p-0 overflow-hidden bg-white border-none shadow-2xl rounded-[2rem]">
                    <div className="p-8 space-y-6">
                        <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mx-auto">
                            <AlertCircle className="w-8 h-8" />
                        </div>
                        <div className="text-center space-y-2">
                            <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">¿Descartar evaluación?</DialogTitle>
                            <DialogDescription className="text-sm text-slate-500 font-medium">
                                Si sales ahora, perderás los datos capturados en este formulario.
                            </DialogDescription>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowCancelConfirm(false)}
                                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                            >
                                Continuar
                            </button>
                            <button
                                onClick={() => {
                                    setShowCancelConfirm(false);
                                    onClose();
                                }}
                                className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-200 transition-all"
                            >
                                Descartar
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
