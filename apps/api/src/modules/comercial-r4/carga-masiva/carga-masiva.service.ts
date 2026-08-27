import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaDynamicService } from '../../../database/prisma-dynamic.service';
import * as ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid'; // Fallback for IDs if needed

// Mapeo de nombre completo del mes (como viene en el Excel) → número de mes
const MONTH_NAME_MAP: Record<string, string> = {
    'ENERO': '01', 'ENE': '01', 'JAN': '01',
    'FEBRERO': '02', 'FEB': '02',
    'MARZO': '03', 'MAR': '03',
    'ABRIL': '04', 'ABR': '04', 'APR': '04',
    'MAYO': '05', 'MAY': '05',
    'JUNIO': '06', 'JUN': '06',
    'JULIO': '07', 'JUL': '07',
    'AGOSTO': '08', 'AGO': '08', 'AUG': '08',
    'SEPTIEMBRE': '09', 'SEP': '09', 'SEPT': '09',
    'OCTUBRE': '10', 'OCT': '10',
    'NOVIEMBRE': '11', 'NOV': '11',
    'DICIEMBRE': '12', 'DIC': '12', 'DEC': '12',
};
const normalizeADCName = (name: string | null | undefined): string | null => {
    if (!name) return null;
    const cleanName = name.trim();
    const upperName = cleanName.toUpperCase();
    
    if (upperName === 'ALEJANDRA') return 'Alejandra Arellanes';
    if (upperName === 'ANDREA') return 'Andrea Esquivel';
    if (upperName === 'DANIEL') return 'Daniel Romero';
    if (upperName === 'MONTSERRAT') return 'Montserrat Covarrubias';
    if (upperName === 'SIMALÚ' || upperName === 'SIMALU') return 'Simalú León';
    
    return cleanName;
};

/**
 * Normaliza un nombre de cliente para comparación fuzzy.
 * Elimina espacios, acentos, puntuación y convierte a mayúsculas.
 * Ejemplo: "Mercado Libre" → "MERCADOLIBRE"
 *          "MERCADO LIBRE S.A. DE C.V." → "MERCADOLIBREDECV"
 */
const normalizeClientName = (name: string | null | undefined): string => {
    if (!name) return '';
    return name
        .toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // quitar acentos
        .replace(/[^A-Z0-9]/g, '');  // quitar espacios, puntos, comas, S.A., etc.
};

/**
 * Determina dinámicamente si una fila corresponde a un aditamento, batería, plataforma o accesorio.
 * Los montacargas industriales pertenecen a las clases estándar (Clase I, II, III, IV, V).
 * Los aditamentos y accesorios (Clase "Others", tipos de batería/stand/clamp, o donde la Serie es igual al Modelo)
 * no cuentan con número de serie único de fabricante y pueden repetirse en el inventario.
 */
const isAditamentoOrAccesorio = (tipo?: string | null, clase?: string | null, modelo?: string | null, serie?: string | null): boolean => {
    const t = (tipo || '').toLowerCase().trim();
    const c = (clase || '').toLowerCase().trim();
    const m = (modelo || '').toLowerCase().trim();
    const s = (serie || '').toLowerCase().trim();

    // 1. Por Clasificación: Si la clase es "Others", "Accesorios" o "Aditamentos"
    if (c.includes('other') || c.includes('accesorio') || c.includes('aditamento')) return true;

    // 2. Por Tipo de equipo: Componentes de soporte, baterías, plataformas, cargadores, aditamentos
    const tiposAditamentos = ['battery', 'bater', 'stand', 'plataforma', 'aditamento', 'cargador', 'clamp', 'pushpull', 'caseta', 'patin', 'patín', 'accesorio'];
    if (tiposAditamentos.some(tipoAdit => t.includes(tipoAdit))) return true;

    // 3. Cuando la Serie registrada es idéntica al Modelo (típico en accesorios genéricos sin serie de fábrica)
    // y no pertenece a las clases principales de montacargas (Clase I, II, III, IV, V)
    const esClaseMontacargas = /\b(i|ii|iii|iv|v)\b/i.test(c) || c.includes('clase 1') || c.includes('clase 2') || c.includes('clase 3');
    if (s && m && s === m && !esClaseMontacargas) return true;

    return false;
};

@Injectable()
export class CargaMasivaService {
    private readonly logger = new Logger(CargaMasivaService.name);

    constructor(private readonly prismaService: PrismaDynamicService) {}

    async procesarArchivo(file: Express.Multer.File, userId: string, adcFilter?: string) {
        try {
            const db = PrismaDynamicService.clients.r4;
            if (!db) {
                throw new Error('Database client for R4 no inicializado');
            }

            this.logger.log('Iniciando lectura de Excel...');

            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(file.buffer as any);

            let worksheet: ExcelJS.Worksheet | undefined;
            // Primero buscar por nombre
            const targetSheetNames = ['FLOTILLA', 'RESUMEN FLOTILLA', 'RENTAS', 'BASE DE DATOS'];
            for (const name of targetSheetNames) {
                const sheet = workbook.worksheets.find(ws => ws.name.toUpperCase().includes(name));
                if (sheet) {
                    worksheet = sheet;
                    break;
                }
            }
            
            // Si no encuentra por nombre, buscar la que tenga SERIE en la fila 1
            if (!worksheet) {
                for (const ws of workbook.worksheets) {
                    const hRow = ws.getRow(1);
                    let hasSerie = false;
                    hRow.eachCell(c => {
                        if (c.value?.toString().toUpperCase().includes('SERIE')) hasSerie = true;
                    });
                    if (hasSerie) {
                        worksheet = ws;
                        break;
                    }
                }
            }
            
            // Fallback a la primera hoja
            if (!worksheet) {
                worksheet = workbook.worksheets[0];
            }

            if (!worksheet) {
                throw new HttpException('El archivo Excel está vacío o no tiene hojas.', HttpStatus.BAD_REQUEST);
            }

            // Buscar la fila de encabezados (primeras 10 filas)
            let headerRowIndex = 1;
            let bestMatchCount = 0;
            
            for (let i = 1; i <= 10; i++) {
                const row = worksheet.getRow(i);
                const matchedSet = new Set<string>();
                row.eachCell({ includeEmpty: false }, (cell) => {
                    const val = cell.value?.toString().toUpperCase() || '';
                    if (val.includes('CLIENTE')) matchedSet.add('CLIENTE');
                    if (val.includes('SERIE')) matchedSet.add('SERIE');
                    if (val.includes('OACH')) matchedSet.add('OACH');
                    if (val.includes('SITIO')) matchedSet.add('SITIO');
                });
                const matchCount = matchedSet.size;
                if (matchCount > bestMatchCount) {
                    bestMatchCount = matchCount;
                    headerRowIndex = i;
                }
            }

            const headerRow = worksheet.getRow(headerRowIndex);
            const headers: string[] = [];
            headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                // Normalize: trim + collapse multiple spaces into one
                headers[colNumber] = (cell.value?.toString() || '').trim().toUpperCase().replace(/\s+/g, ' ');
            });

            if (headers.filter(Boolean).length === 0 || bestMatchCount === 0) {
                throw new HttpException(`No se encontraron encabezados válidos en las primeras 10 filas de la hoja ${worksheet.name}.`, HttpStatus.BAD_REQUEST);
            }


            const currentYear = new Date().getFullYear();
            const activeMonths: { name: string; period: string }[] = [];

            for (const [monthName, monthNum] of Object.entries(MONTH_NAME_MAP)) {
                const hasPO = headers.some(h => h === `PO ${monthName}` || h.startsWith(`PO ${monthName}`));
                if (hasPO) {
                    activeMonths.push({ name: monthName, period: `${currentYear}-${monthNum}` });
                }
            }

            this.logger.log(`Meses detectados: ${activeMonths.map(m => m.name).join(', ')}`);

            const extractCellValue = (cell: ExcelJS.Cell): string | null => {
                let val = cell.value;
                if (val === null || val === undefined) return null;
                if (val instanceof Date) {
                    return val.toISOString().split('T')[0];
                }
                if (typeof val === 'object') {
                    if ('result' in val && val.result !== undefined && val.result !== null) {
                        val = val.result;
                        if (val instanceof Date) return val.toISOString().split('T')[0];
                    } else if ('text' in val && typeof (val as any).text === 'string') {
                        val = (val as any).text;
                    } else if ('hyperlink' in val && typeof (val as any).hyperlink === 'string') {
                        val = (val as any).hyperlink.replace(/^mailto:/i, '');
                    } else if ('richText' in val && Array.isArray((val as any).richText)) {
                        val = (val as any).richText.map((rt: any) => rt.text).join('');
                    }
                }
                const str = val ? val.toString().trim() : '';
                if (str === '[object Object]' || str === '' || str === 'null' || str === 'undefined') return null;
                return str;
            };

            const getStrictColVal = (row: ExcelJS.Row, headersList: string[], candidates: string[], excludeWords: string[] = []): string | null => {
                // 1. Exact match first
                for (const cand of candidates) {
                    const upperCand = cand.toUpperCase().trim();
                    const idx = headersList.findIndex(h => h === upperCand);
                    if (idx > 0) {
                        const val = extractCellValue(row.getCell(idx));
                        if (val) return val;
                    }
                }
                // 2. Partial match without excluded words
                for (const cand of candidates) {
                    const upperCand = cand.toUpperCase().trim();
                    const idx = headersList.findIndex(h => {
                        if (!h) return false;
                        if (!h.includes(upperCand)) return false;
                        return !excludeWords.some(w => h.includes(w.toUpperCase()));
                    });
                    if (idx > 0) {
                        const val = extractCellValue(row.getCell(idx));
                        if (val) return val;
                    }
                }
                return null;
            };

            const getVal = (row: ExcelJS.Row, colName: string): string | null => {
                return getStrictColVal(row, headers, [colName]);
            };

            const getDateVal = (row: ExcelJS.Row, colNames: string[], defaultDate: Date): Date => {
                for (const colName of colNames) {
                    const upperName = colName.toUpperCase();
                    let idx = headers.findIndex(h => h === upperName);
                    if (idx < 0) idx = headers.findIndex(h => h && h.includes(upperName));
                    if (idx > 0) {
                        const cell = row.getCell(idx);
                        const val = cell.value;
                        if (val) {
                            if (val instanceof Date) return val;
                            const valStr = val.toString().trim();
                            // Detect DD/MM/YY or DD/MM/YYYY
                            if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(valStr)) {
                                const parts = valStr.split(' ')[0].split('/');
                                const year = parseInt(parts[2]) < 100 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);
                                return new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]));
                            }
                            const parsed = new Date(valStr);
                            if (!isNaN(parsed.getTime())) return parsed;
                        }
                    }
                }
                return defaultDate;
            };

            const parseCurrency = (valStr: string | null | undefined): number | null => {
                if (!valStr) return null;
                let clean = valStr.trim().replace(/[$'\s]/g, '');
                if (!clean) return null;

                const hasDot = clean.includes('.');
                const hasComma = clean.includes(',');

                if (hasDot && hasComma) {
                    const firstDot = clean.indexOf('.');
                    const firstComma = clean.indexOf(',');
                    if (firstDot < firstComma) {
                        // Spanish format: 22.462,00 -> 22462.00
                        clean = clean.replace(/\./g, '').replace(/,/g, '.');
                    } else {
                        // English format: 22,462.00 -> 22462.00
                        clean = clean.replace(/,/g, '');
                    }
                } else if (hasComma) {
                    // Only comma exists: e.g. 22462,00 or 22,462
                    const parts = clean.split(',');
                    if (parts.length === 2 && parts[1].length <= 2) {
                        clean = clean.replace(/,/g, '.');
                    } else {
                        clean = clean.replace(/,/g, '');
                    }
                } else if (hasDot) {
                    // Only dot exists: e.g. 22.462 or 22462.00
                    const parts = clean.split('.');
                    if (parts.length === 2 && parts[1].length === 3) {
                        clean = clean.replace(/\./g, '');
                    }
                }

                clean = clean.replace(/[^0-9.-]/g, '');
                const parsed = parseFloat(clean);
                return isNaN(parsed) ? null : parsed;
            };

            // Caches en memoria
            const clienteCache = new Map<string, any>();
            const sitioCache = new Map<string, any>();
            const activoCache = new Map<string, any>();
            const rentaCache = new Map<string, any>();
            const ordenesMensualesSet = new Set<string>();

            let clientesNuevos = 0;
            let sitiosNuevos = 0;

            // PROCESAR DIRECTORIO SI EXISTE
            const candDistContactoNombre = [
                'CONTACTO DEL DISTRIBUIDOR', 'CONTACTO DE DISTRIBUIDOR', 'CONTACTO DISTRIBUIDOR', 'CONTACTO DIST',
                'CONTACTO TECNICO DEL DISTRIBUIDOR', 'CONTACTO TÉCNICO DEL DISTRIBUIDOR',
                'CONTACTO TECNICO', 'CONTACTO TÉCNICO', 'CONTACTO DEALER', 'CONTACTO DEL DEALER',
                'PERSONA DEALER', 'RESPONSABLE DEALER', 'TECNICO DEALER', 'TÉCNICO DEALER',
                'TECNICO', 'TÉCNICO', 'ASESOR DEALER', 'ASESOR TECNICO', 'ASESOR TÉCNICO',
                'NOMBRE DEL CONTACTO', 'NOMBRE CONTACTO DISTRIBUIDOR', 'NOMBRE CONTACTO', 'CONTACTO'
            ];
            const candDistContactoTel = [
                'TEL DEL CONTACTO DEL DISTRIBUIDOR', 'TEL. DEL CONTACTO DEL DISTRIBUIDOR', 'TELEFONO DEL CONTACTO DEL DISTRIBUIDOR', 'TELÉFONO DEL CONTACTO DEL DISTRIBUIDOR',
                'TELEFONO DISTRIBUIDOR', 'TELÉFONO DISTRIBUIDOR', 'TEL DISTRIBUIDOR', 'TEL. DISTRIBUIDOR',
                'TELEFONO DEALER', 'TELÉFONO DEALER', 'TEL DEALER', 'TEL. DEALER',
                'TELEFONO TECNICO', 'TELÉFONO TÉCNICO', 'TEL TECNICO', 'TEL. TECNICO',
                'TEL CONTACTO', 'TELEFONO CONTACTO', 'TELÉFONO CONTACTO', 'TELÉFONO', 'TELEFONO', 'TEL'
            ];
            const candDistContactoMail = [
                'MAIL DEL CONTACTO DEL DISTRIBUIDOR', 'CORREO DEL CONTACTO DEL DISTRIBUIDOR', 'EMAIL DEL CONTACTO DEL DISTRIBUIDOR',
                'CORREO DISTRIBUIDOR', 'EMAIL DISTRIBUIDOR', 'MAIL DISTRIBUIDOR',
                'CORREO DEALER', 'EMAIL DEALER', 'MAIL DEALER',
                'CORREO TECNICO', 'EMAIL TECNICO', 'MAIL TECNICO', 'CORREO TÉCNICO', 'EMAIL TÉCNICO', 'MAIL TÉCNICO',
                'MAIL CONTACTO', 'CORREO CONTACTO', 'EMAIL CONTACTO', 'MAIL', 'CORREO', 'EMAIL'
            ];
            const candDistSucursal = [
                'SUCURSAL', 'SUCURSAL DISTRIBUIDOR', 'SUCURSAL DEALER', 'AGENCIA', 'PLAZA'
            ];

            const directorioSheet = workbook.worksheets.find(ws => ws.name.toUpperCase().includes('DIRECTORIO'));
            if (directorioSheet) {
                this.logger.log('Hoja de Directorio detectada, pre-cargando clientes y sitios...');
                
                // Buscar la fila de encabezados
                let dirHeaderRowIndex = 1;
                let dirBestMatchCount = 0;
                
                for (let i = 1; i <= 10; i++) {
                    const row = directorioSheet.getRow(i);
                    const matchedSet = new Set<string>();
                    row.eachCell({ includeEmpty: false }, (cell) => {
                        const val = cell.value?.toString().toUpperCase() || '';
                        if (val.includes('CLIENTE')) matchedSet.add('CLIENTE');
                        if (val.includes('SITE') || val.includes('SITIO')) matchedSet.add('SITE');
                        if (val.includes('RFC')) matchedSet.add('RFC');
                        if (val.includes('MAIL') || val.includes('CORREO')) matchedSet.add('MAIL');
                        if (val.includes('TELÉFONO') || val.includes('TELEFONO')) matchedSet.add('TELEFONO');
                        if (val.includes('RAZÓN SOCIAL') || val.includes('RAZON SOCIAL')) matchedSet.add('RAZON SOCIAL');
                    });
                    const matchCount = matchedSet.size;
                    if (matchCount > dirBestMatchCount) {
                        dirBestMatchCount = matchCount;
                        dirHeaderRowIndex = i;
                    }
                }

                const dirHeaders: string[] = [];
                directorioSheet.getRow(dirHeaderRowIndex).eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    dirHeaders[colNumber] = (cell.value?.toString() || '').trim().toUpperCase().replace(/\s+/g, ' ');
                });

                const getDirVal = (row: ExcelJS.Row, candidates: string | string[], excludeWords: string[] = []): string | null => {
                    const candArray = Array.isArray(candidates) ? candidates : [candidates];
                    return getStrictColVal(row, dirHeaders, candArray, excludeWords);
                };

                let dirConsecutiveEmpty = 0;
                for (let i = dirHeaderRowIndex + 1; i <= directorioSheet.rowCount; i++) {
                    const row = directorioSheet.getRow(i);
                    let hasData = false;
                    row.eachCell({ includeEmpty: false }, (cell) => { 
                        if (cell.value && cell.value.toString().trim() !== '') {
                            hasData = true;
                        }
                    });
                    
                    if (!hasData) {
                        dirConsecutiveEmpty++;
                        if (dirConsecutiveEmpty >= 20) {
                            this.logger.log('Se detectaron 20 filas sin datos consecutivas en el Directorio, terminando lectura.');
                            break;
                        }
                        continue;
                    }
                    dirConsecutiveEmpty = 0;

                    const clientName = getDirVal(row, ['CLIENTE', 'RAZON SOCIAL', 'RAZÓN SOCIAL', 'NOMBRE CLIENTE', 'CUENTA']);
                    const siteName = getDirVal(row, ['SITIO', 'SITE', 'SUCURSAL', 'TIENDA']);
                    
                    if (clientName) {
                        const rfc = getDirVal(row, ['RFC', 'R.F.C.', 'RFC CLIENTE']);
                        // Correo del CLIENTE (excluyendo dealer, distribuidor, adc, tecnico)
                        const correoCliente = getDirVal(row, ['CORREO CLIENTE', 'EMAIL CLIENTE', 'MAIL CLIENTE', 'CORREO FACTURACION', 'CORREO', 'EMAIL', 'MAIL'], ['DISTRIBUIDOR', 'DEALER', 'ADC', 'RESPONSABLE', 'TECNICO']);
                        const telefonoCliente = getDirVal(row, ['TELEFONO CLIENTE', 'TELÉFONO CLIENTE', 'TEL CLIENTE', 'TELEFONO', 'TELÉFONO'], ['DISTRIBUIDOR', 'DEALER', 'ADC', 'RESPONSABLE', 'TECNICO']);
                        const contactoCliente = getDirVal(row, ['CONTACTO CLIENTE', 'ATENCION', 'ATENCIÓN', 'CONTACTO DE CLIENTE', 'CONTACTO'], ['DISTRIBUIDOR', 'DEALER', 'ADC', 'RESPONSABLE', 'TECNICO']);
                        const direccionCliente = getDirVal(row, ['DIRECCION CLIENTE', 'DIRECCIÓN CLIENTE', 'DOMICILIO FISCAL', 'DIRECCION FISCAL', 'DOMICILIO CLIENTE']);

                        let cliente = clienteCache.get(normalizeClientName(clientName));
                        if (!cliente) {
                            // Búsqueda fuzzy: traemos todos y comparamos normalizado
                            const allClientes = await db.cliente.findMany({ select: { id: true, razon_social: true, rfc: true, datos_comerciales: true } });
                            const normalizedInput = normalizeClientName(clientName);
                            cliente = allClientes.find(c => normalizeClientName(c.razon_social) === normalizedInput) || null;
                            if (!cliente) {
                                cliente = await db.cliente.create({ 
                                    data: { 
                                        razon_social: clientName,
                                        rfc: rfc,
                                        datos_comerciales: {
                                            correo: correoCliente,
                                            telefono: telefonoCliente,
                                            contacto: contactoCliente,
                                            direccion: direccionCliente
                                        }
                                    } 
                                });
                                clientesNuevos++;
                            } else {
                                // Update existing client if it was missing these fields
                                cliente = await db.cliente.update({
                                    where: { id: cliente.id },
                                    data: {
                                        rfc: rfc || cliente.rfc,
                                        datos_comerciales: {
                                            correo: correoCliente || (cliente.datos_comerciales as any)?.correo,
                                            telefono: telefonoCliente || (cliente.datos_comerciales as any)?.telefono,
                                            contacto: contactoCliente || (cliente.datos_comerciales as any)?.contacto,
                                            direccion: direccionCliente || (cliente.datos_comerciales as any)?.direccion
                                        }
                                    }
                                });
                            }
                            clienteCache.set(normalizeClientName(clientName), cliente);
                        }
                        
                        if (siteName) {
                            const region = getDirVal(row, ['REGION', 'REGIÓN']);
                            const responsable = normalizeADCName(getDirVal(row, ['RESPONSABLE', 'ADC', 'EJECUTIVO ADC', 'EJECUTIVO']));
                            const distribuidor = getDirVal(row, ['DISTRIBUIDOR', 'DISTRIBUIDOR AUTORIZADO', 'DEALER', 'DEALER ASIGNADO', 'AGENCIA', 'PROVEEDOR']);
                            const sucursal = getDirVal(row, candDistSucursal);
                            const contactoNombre = getDirVal(row, candDistContactoNombre);
                            const contactoTelefono = getDirVal(row, candDistContactoTel);
                            const contactoCorreo = getDirVal(row, candDistContactoMail);
                            
                            const adcCorreo = getDirVal(row, ['CORREO ADC', 'EMAIL ADC', 'MAIL ADC', 'CORREO RESPONSABLE', 'EMAIL RESPONSABLE']);
                            const adcTelefono = getDirVal(row, ['TELEFONO ADC', 'TELÉFONO ADC', 'TEL ADC', 'TELEFONO RESPONSABLE', 'TELÉFONO RESPONSABLE']);
                            const distribuidorDireccion = getDirVal(row, ['DIRECCION DISTRIBUIDOR', 'DIRECCIÓN DISTRIBUIDOR', 'DIRECCION DEALER', 'DIRECCIÓN DEALER', 'DOMICILIO DISTRIBUIDOR']);
                            const adcDireccion = getDirVal(row, ['DIRECCION ADC', 'DIRECCIÓN ADC']);
                            const cuentaDir = getDirVal(row, ['CUENTA', 'NO. CUENTA', 'NUMERO CUENTA']);

                            const sitioData = {
                                cliente_id: cliente.id,
                                nombre: siteName,
                                direccion: getDirVal(row, ['DIRECCION', 'DIRECCIÓN', 'CALLE', 'CALLE Y NUMERO', 'DOMICILIO', 'DIRECCION SITIO']),
                                distribuidor: distribuidor || null,
                                adc: responsable || null,
                                cuenta: cuentaDir || null,
                                contacto_operativo: {
                                    ...(region ? { region } : {}),
                                    ...(responsable ? { responsable } : {}),
                                    ...(adcCorreo ? { adc_correo: adcCorreo } : {}),
                                    ...(adcTelefono ? { adc_telefono: adcTelefono } : {}),
                                    ...(adcDireccion ? { adc_direccion: adcDireccion } : {}),
                                    ...(sucursal ? { distribuidor_sucursal: sucursal } : {}),
                                    ...(contactoNombre ? { distribuidor_contacto_nombre: contactoNombre } : {}),
                                    ...(contactoTelefono ? { distribuidor_contacto_telefono: contactoTelefono } : {}),
                                    ...(contactoCorreo ? { distribuidor_contacto_correo: contactoCorreo } : {}),
                                    ...(distribuidorDireccion ? { distribuidor_direccion: distribuidorDireccion } : {})
                                }
                            };

                            const cacheKey1 = `${cliente.id}::${normalizeClientName(siteName)}`;
                            const cacheKey2 = `${cliente.id}::${siteName.trim()}`;
                            let sitio = sitioCache.get(cacheKey1) || sitioCache.get(cacheKey2);

                            if (!sitio) {
                                sitio = await db.sitio.findFirst({ where: { cliente_id: cliente.id, nombre: siteName } });
                                if (!sitio) {
                                    sitio = await db.sitio.create({ data: sitioData });
                                    sitiosNuevos++;
                                } else {
                                    const mergedContacto = {
                                        ...((sitio.contacto_operativo as any) || {}),
                                        ...sitioData.contacto_operativo
                                    };
                                    sitio = await db.sitio.update({
                                        where: { id: sitio.id },
                                        data: {
                                            ...(sitioData.direccion ? { direccion: sitioData.direccion } : {}),
                                            ...(sitioData.distribuidor ? { distribuidor: sitioData.distribuidor } : {}),
                                            ...(sitioData.adc ? { adc: sitioData.adc } : {}),
                                            ...(sitioData.cuenta ? { cuenta: sitioData.cuenta } : {}),
                                            contacto_operativo: mergedContacto
                                        }
                                    });
                                }
                            } else {
                                const mergedContacto = {
                                    ...((sitio.contacto_operativo as any) || {}),
                                    ...sitioData.contacto_operativo
                                };
                                sitio = await db.sitio.update({
                                    where: { id: sitio.id },
                                    data: {
                                        ...(sitioData.direccion ? { direccion: sitioData.direccion } : {}),
                                        ...(sitioData.adc ? { adc: sitioData.adc } : {}),
                                        ...(sitioData.distribuidor ? { distribuidor: sitioData.distribuidor } : {}),
                                        ...(sitioData.cuenta ? { cuenta: sitioData.cuenta } : {}),
                                        contacto_operativo: mergedContacto
                                    }
                                });
                            }
                            sitioCache.set(cacheKey1, sitio);
                            sitioCache.set(cacheKey2, sitio);
                        }
                    }
                }
            }

            // Precarga de la base de datos para evitar repeticiones de previas cargas
            const existentesOrdenes = await db.ordenMensual.findMany({ select: { activo_id: true, periodo: true, po: true } });
            existentesOrdenes.forEach(o => {
                ordenesMensualesSet.add(`M::${o.activo_id}::${o.periodo}`);
                ordenesMensualesSet.add(`B::${o.activo_id}::${o.periodo}::${o.po || ''}`);
            });

            const ordenesMensualesParaInsertar: any[] = [];

            let processed = 0;
            let errors = 0;
            let rentasCreadas = 0;
            const errorDetails: string[] = [];
            const seenSeriesMap = new Map<string, { rows: number[]; clientes: Set<string>; modelos: Set<string>; adcs: Set<string> }>();
            const aditamentoCountMap = new Map<string, number>();

            this.logger.log('Iniciando procesamiento de filas...');
            let consecutiveEmpty = 0;

            for (let rowNumber = headerRowIndex + 1; rowNumber <= worksheet.rowCount; rowNumber++) {
                const row = worksheet.getRow(rowNumber);

                let hasData = false;
                row.eachCell({ includeEmpty: false }, (cell) => { 
                    if (cell.value && cell.value.toString().trim() !== '') {
                        hasData = true;
                    }
                });
                
                if (!hasData) {
                    consecutiveEmpty++;
                    if (consecutiveEmpty >= 20) {
                        this.logger.log(`Se detectaron 20 filas sin datos consecutivas a partir de la fila ${rowNumber - 20}, terminando procesamiento.`);
                        break;
                    }
                    continue;
                }
                
                consecutiveEmpty = 0;

                try {
                    const clienteName = getStrictColVal(row, headers, ['CLIENTE', 'RAZON SOCIAL', 'RAZÓN SOCIAL', 'CLIENTE / RAZÓN SOCIAL', 'CUENTA']);
                    const serie = getStrictColVal(row, headers, ['SERIE', 'NÚMERO DE SERIE', 'NUMERO DE SERIE', 'NO. SERIE', 'SERIE EQUIPO', 'S/N', 'SN']);

                    if (!clienteName || !serie) {
                        // Se omite el logger para no saturar la consola en caso de filas mal formateadas
                        continue;
                    }

                    const rawTipo = getVal(row, 'TIPO');
                    const rawClase = getVal(row, 'CLASE');
                    const rawModelo = getVal(row, 'MODELO');

                    // Regla de Aditamentos / Accesorios: si no tienen serie única de fábrica y repiten nombre en Excel,
                    // se genera un identificador correlativo (ej. "IS-3-21 #2") para que se guarden como activos independientes.
                    let effectiveSerie = serie;
                    const isAdit = isAditamentoOrAccesorio(rawTipo, rawClase, rawModelo, serie);
                    if (isAdit) {
                        const count = (aditamentoCountMap.get(serie) || 0) + 1;
                        aditamentoCountMap.set(serie, count);
                        if (count > 1) {
                            effectiveSerie = `${serie} #${count}`;
                        }
                    }

                    const rawRowAdc = getStrictColVal(row, headers, ['RESPONSABLE', 'ADC', 'EJECUTIVO ADC', 'EJECUTIVO']);
                    const adc = normalizeADCName(rawRowAdc);
                    
                    // CARGA PARCIAL: si se especificó un ADC filter, ignorar filas de otros ADCs
                    if (adcFilter) {
                        const normRowAdc = (adc || '').toLowerCase().trim();
                        const normFilter = normalizeADCName(adcFilter)?.toLowerCase().trim() || adcFilter.toLowerCase().trim();
                        if (normRowAdc && normFilter && normRowAdc !== normFilter && !normRowAdc.includes(normFilter) && !normFilter.includes(normRowAdc)) {
                            this.logger.log(`Fila ${rowNumber}: ADC "${adc}" omitido (carga parcial para "${adcFilter}")`);
                            continue;
                        }
                    }

                    // Registrar serie para conteo de únicos y detección de duplicados
                    if (!seenSeriesMap.has(effectiveSerie)) {
                        seenSeriesMap.set(effectiveSerie, {
                            rows: [rowNumber],
                            clientes: new Set([clienteName]),
                            modelos: new Set([rawModelo || '-']),
                            adcs: new Set([adc || 'Sin ADC']),
                        });
                    } else {
                        const entry = seenSeriesMap.get(effectiveSerie)!;
                        entry.rows.push(rowNumber);
                        if (clienteName) entry.clientes.add(clienteName);
                        if (rawModelo) entry.modelos.add(rawModelo);
                        if (adc) entry.adcs.add(adc);
                    }

                    // A: CLIENTE (con búsqueda fuzzy para evitar duplicados como "MERCADO LIBRE" vs "MERCADOLIBRE")
                    let cliente = clienteCache.get(normalizeClientName(clienteName));
                    if (!cliente) {
                        const allClientes = await db.cliente.findMany({ select: { id: true, razon_social: true, rfc: true, datos_comerciales: true } });
                        const normalizedInput = normalizeClientName(clienteName);
                        cliente = allClientes.find(c => normalizeClientName(c.razon_social) === normalizedInput) || null;
                        const rfc = getStrictColVal(row, headers, ['RFC', 'RFC CLIENTE', 'R.F.C.']);
                        const correoCliente = getStrictColVal(row, headers, ['CORREO CLIENTE', 'MAIL CLIENTE', 'EMAIL CLIENTE', 'CORREO FACTURACION'], ['DISTRIBUIDOR', 'DEALER', 'ADC', 'RESPONSABLE', 'TECNICO']);
                        const telefonoCliente = getStrictColVal(row, headers, ['TELEFONO CLIENTE', 'TELÉFONO CLIENTE', 'TEL CLIENTE'], ['DISTRIBUIDOR', 'DEALER', 'ADC', 'RESPONSABLE', 'TECNICO']);
                        const direccionCliente = getStrictColVal(row, headers, ['DIRECCION CLIENTE', 'DIRECCIÓN CLIENTE', 'DOMICILIO FISCAL', 'DOMICILIO CLIENTE']);
                        const contactoCliente = getStrictColVal(row, headers, ['CONTACTO CLIENTE', 'CONTACTO_CLIENTE', 'ATENCION', 'ATENCIÓN'], ['DISTRIBUIDOR', 'DEALER', 'ADC', 'RESPONSABLE', 'TECNICO']);

                        if (!cliente) {
                            cliente = await db.cliente.create({
                                data: {
                                    razon_social: clienteName,
                                    codigo_cliente: `CLI-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
                                    estado: 'ACTIVO',
                                    rfc: rfc,
                                    datos_comerciales: {
                                        correo: correoCliente,
                                        telefono: telefonoCliente,
                                        direccion: direccionCliente,
                                        contacto: contactoCliente
                                    }
                                },
                            });
                            clientesNuevos++;
                        } else {
                            cliente = await db.cliente.update({
                                where: { id: cliente.id },
                                data: {
                                    rfc: rfc || cliente.rfc,
                                    datos_comerciales: {
                                        correo: correoCliente || (cliente.datos_comerciales as any)?.correo,
                                        telefono: telefonoCliente || (cliente.datos_comerciales as any)?.telefono,
                                        direccion: direccionCliente || (cliente.datos_comerciales as any)?.direccion,
                                        contacto: contactoCliente || (cliente.datos_comerciales as any)?.contacto
                                    }
                                }
                            });
                        }
                        clienteCache.set(normalizeClientName(clienteName), cliente);
                    }

                    // B: SITIO
                    const sitioName = getStrictColVal(row, headers, ['SITE', 'SITIO', 'SUCURSAL', 'TIENDA']) || 'Sin Sitio';
                    const sitioCacheKey1 = `${cliente.id}::${normalizeClientName(sitioName)}`;
                    const sitioCacheKey2 = `${cliente.id}::${sitioName.trim()}`;
                    let sitio = sitioCache.get(sitioCacheKey1) || sitioCache.get(sitioCacheKey2);
                    
                    const distribuidor = getStrictColVal(row, headers, ['DISTRIBUIDOR', 'DISTRIBUIDOR AUTORIZADO', 'DEALER', 'DEALER ASIGNADO', 'AGENCIA', 'PROVEEDOR']);
                    
                    const mainContactoNombre = getStrictColVal(row, headers, candDistContactoNombre);
                    const mainContactoCorreo = getStrictColVal(row, headers, candDistContactoMail);
                    const mainContactoTel = getStrictColVal(row, headers, candDistContactoTel);
                    const mainAdcCorreo = getStrictColVal(row, headers, ['CORREO ADC', 'MAIL ADC', 'EMAIL ADC', 'CORREO RESPONSABLE']);
                    const mainAdcTel = getStrictColVal(row, headers, ['TELEFONO ADC', 'TELÉFONO ADC', 'TELEFONO RESPONSABLE']);
                    const mainAdcDir = getStrictColVal(row, headers, ['DIRECCION ADC', 'DIRECCIÓN ADC']);
                    const mainDistDir = getStrictColVal(row, headers, ['DIRECCION DISTRIBUIDOR', 'DIRECCIÓN DISTRIBUIDOR', 'DIRECCION DEALER', 'DIRECCIÓN DEALER', 'DOMICILIO DISTRIBUIDOR']);
                    const mainCiudad = getStrictColVal(row, headers, ['MUNICIPIO', 'CIUDAD', 'PLAZA']);
                    const mainDireccion = getStrictColVal(row, headers, ['DIRECCION', 'DIRECCIÓN', 'CALLE', 'CALLE Y NUMERO', 'DOMICILIO', 'DIRECCION SITIO']);
                    const mainCuenta = getStrictColVal(row, headers, ['CUENTA', 'NO. CUENTA', 'NUMERO CUENTA']);

                    if (!sitio) {
                        sitio = await db.sitio.findFirst({
                            where: { cliente_id: cliente.id, nombre: sitioName },
                        });
                        
                        if (!sitio) {
                            sitio = await db.sitio.create({
                                data: {
                                    cliente_id: cliente.id,
                                    nombre: sitioName,
                                    ciudad: mainCiudad,
                                    direccion: mainDireccion,
                                    cuenta: mainCuenta,
                                    adc: adc,
                                    distribuidor: distribuidor,
                                    contacto_operativo: {
                                        ...(mainAdcCorreo ? { adc_correo: mainAdcCorreo } : {}),
                                        ...(mainAdcTel ? { adc_telefono: mainAdcTel } : {}),
                                        ...(mainAdcDir ? { adc_direccion: mainAdcDir } : {}),
                                        ...(mainContactoNombre ? { distribuidor_contacto_nombre: mainContactoNombre } : {}),
                                        ...(mainContactoCorreo ? { distribuidor_contacto_correo: mainContactoCorreo } : {}),
                                        ...(mainContactoTel ? { distribuidor_contacto_telefono: mainContactoTel } : {}),
                                        ...(mainDistDir ? { distribuidor_direccion: mainDistDir } : {}),
                                    }
                                },
                            });
                            sitiosNuevos++;
                        } else {
                            // Update existing site
                            sitio = await db.sitio.update({
                                where: { id: sitio.id },
                                data: {
                                    ciudad: mainCiudad || sitio.ciudad,
                                    direccion: mainDireccion || sitio.direccion,
                                    cuenta: mainCuenta || sitio.cuenta,
                                    adc: adc || sitio.adc,
                                    distribuidor: distribuidor || sitio.distribuidor,
                                    contacto_operativo: {
                                        ...((sitio.contacto_operativo as any) || {}),
                                        ...(mainAdcCorreo ? { adc_correo: mainAdcCorreo } : {}),
                                        ...(mainAdcTel ? { adc_telefono: mainAdcTel } : {}),
                                        ...(mainAdcDir ? { adc_direccion: mainAdcDir } : {}),
                                        ...(mainContactoNombre ? { distribuidor_contacto_nombre: mainContactoNombre } : {}),
                                        ...(mainContactoCorreo ? { distribuidor_contacto_correo: mainContactoCorreo } : {}),
                                        ...(mainContactoTel ? { distribuidor_contacto_telefono: mainContactoTel } : {}),
                                        ...(mainDistDir ? { distribuidor_direccion: mainDistDir } : {}),
                                    }
                                }
                            });
                        }
                    } else {
                        // Site was found in cache (e.g. from Directorio): ONLY update non-empty fields and MERGE contacto_operativo
                        const existingContacto = (sitio.contacto_operativo as any) || {};
                        const mergedContacto = {
                            ...existingContacto,
                            ...(mainAdcCorreo ? { adc_correo: mainAdcCorreo } : {}),
                            ...(mainAdcTel ? { adc_telefono: mainAdcTel } : {}),
                            ...(mainAdcDir ? { adc_direccion: mainAdcDir } : {}),
                            ...(mainContactoNombre ? { distribuidor_contacto_nombre: mainContactoNombre } : {}),
                            ...(mainContactoCorreo ? { distribuidor_contacto_correo: mainContactoCorreo } : {}),
                            ...(mainContactoTel ? { distribuidor_contacto_telefono: mainContactoTel } : {}),
                            ...(mainDistDir ? { distribuidor_direccion: mainDistDir } : {}),
                        };
                        const updateData: any = { contacto_operativo: mergedContacto };
                        if (mainCiudad) updateData.ciudad = mainCiudad;
                        if (mainDireccion && (!sitio.direccion || sitio.direccion === '-')) updateData.direccion = mainDireccion;
                        if (mainCuenta) updateData.cuenta = mainCuenta;
                        if (adc) updateData.adc = adc;
                        if (distribuidor) updateData.distribuidor = distribuidor;

                        sitio = await db.sitio.update({ where: { id: sitio.id }, data: updateData });
                    }
                    sitioCache.set(sitioCacheKey1, sitio);
                    sitioCache.set(sitioCacheKey2, sitio);

                    // C: ACTIVO
                    let activo = activoCache.get(effectiveSerie);
                    if (!activo) {
                        const activoData = {
                            id: effectiveSerie.substring(0, 50),
                            tipo: rawTipo?.substring(0, 100) || null,
                            clase: rawClase?.substring(0, 100) || null,
                            modelo: rawModelo?.substring(0, 100) || null,
                            oach: getVal(row, 'OACH')?.substring(0, 100) || null,
                            altura: getVal(row, 'ALTURA')?.substring(0, 50) || null,
                            bc: getVal(row, 'BC')?.substring(0, 50) || null,
                            estatus: getVal(row, 'ESTATUS')?.substring(0, 100) || 'Activo',
                            estatus_operativo: getVal(row, 'ESTATUS')?.substring(0, 50) || 'OPERATIVO',
                            cliente_id: cliente.id,
                            sitio_id: sitio.id,
                            cuenta: getVal(row, 'CUENTA')?.substring(0, 100) || null,
                            adc: normalizeADCName(getVal(row, 'RESPONSABLE') || getVal(row, 'ADC'))?.substring(0, 100) || null,
                            distribuidor: getVal(row, 'DISTRIBUIDOR')?.substring(0, 100) || null,
                            propietario: getVal(row, 'PROPIETARIO')?.substring(0, 100) || null,
                            info_tecnica: {
                                iwarehouse: getVal(row, 'IWAREHOUSE S/N') || getVal(row, 'IWAREHOUSE') || null
                            },
                        };
                        activo = await db.activo.upsert({
                            where: { id: effectiveSerie },
                            update: activoData,
                            create: { serie: effectiveSerie, ...activoData },
                        });
                        activoCache.set(effectiveSerie, activo);
                    }

                    // D: RENTA
                    let renta = rentaCache.get(activo.id);
                    const tarifaStr = getVal(row, 'PRECIO RENTA CLIENTE') || getVal(row, 'RENTA') || getVal(row, 'TARIFA');
                    const tarifaParsed = parseCurrency(tarifaStr);
                    
                    if (tarifaParsed !== null && !isNaN(tarifaParsed)) {
                        if (!renta) {
                            renta = await db.renta.findFirst({ where: { activo_id: activo.id } });
                            const codRentaCli = getVal(row, 'CÓD RENTA CLI') || getVal(row, 'COD RENTA CLI') || `RENTA-${effectiveSerie}`;
                            
                            const rentaData = {
                                cuenta: getVal(row, 'CUENTA'),
                                adc: normalizeADCName(getVal(row, 'RESPONSABLE') || getVal(row, 'ADC')),
                                distribuidor: getVal(row, 'DISTRIBUIDOR'),
                                tarifa: tarifaParsed
                            };

                            if (!renta) {
                                const defaultFin = new Date();
                                defaultFin.setFullYear(defaultFin.getFullYear() + 1);
                                renta = await db.renta.create({
                                    data: {
                                        id: codRentaCli,
                                        activo_id: activo.id,
                                        cliente_id: cliente.id,
                                        sitio_id: sitio.id,
                                        ...rentaData,
                                        estado: 'IMPORTADA',
                                        origen: 'IMPORTADA',
                                        fecha_inicio: getDateVal(row, ['F. ENTREGADO', 'ENTREGADO', 'F. ENT', 'F ENT', 'FECHA DE INICIO', 'INICIO'], new Date()),
                                        fecha_fin: getDateVal(row, ['F. VENC', 'F VENC', 'VENCIMIENTO', 'FIN'], defaultFin),
                                        condiciones: {
                                            moneda: getVal(row, 'MONEDA') || 'MXN',
                                            tipo_poliza: getVal(row, 'CFPM / SMP') || 'SMP',
                                            plazo_meses: parseCurrency(getVal(row, 'PLAZO')),
                                            costo_poliza_distribuidor: parseCurrency(getVal(row, 'COSTO POLIZA') || getVal(row, 'COSTO PÓLIZA') || getVal(row, 'COSTO SMP DIST.') || getVal(row, 'COSTO SERVICIO')),
                                            moneda_pago_distribuidor: getVal(row, 'MONEDA PAGO') || 'MXN',
                                        },
                                        detalles: {
                                            create: {
                                                renta_base: tarifaParsed,
                                                renta_real: tarifaParsed,
                                                moneda: getVal(row, 'MONEDA') || 'MXN',
                                                tipo_renta: 'MENSUAL',
                                            }
                                        }
                                    }
                                });
                                // Registrar auditoría para la nueva renta
                                await db.auditoria.create({
                                    data: {
                                        modulo: 'RENTAS',
                                        registro_id: renta.id,
                                        accion: 'CREACION_MASIVA',
                                        usuario_id: userId,
                                        valor_anterior: null,
                                        valor_nuevo: { activo_id: activo.id, tarifa: tarifaParsed },
                                        observaciones: `Renta importada masivamente desde Excel`
                                    }
                                });
                            } else {
                                // Actualizar renta existente con datos del excel
                                renta = await db.renta.update({
                                    where: { id: renta.id },
                                    data: {
                                        cliente_id: cliente.id,
                                        sitio_id: sitio.id,
                                        ...rentaData,
                                        condiciones: {
                                            ...(renta.condiciones as any || {}),
                                            tipo_poliza: getVal(row, 'CFPM / SMP') || (renta.condiciones as any)?.tipo_poliza || 'SMP',
                                            plazo_meses: parseCurrency(getVal(row, 'PLAZO')) || (renta.condiciones as any)?.plazo_meses,
                                        }
                                    }
                                });
                            }
                            rentaCache.set(activo.id, renta);
                        }

                        // E: ÓRDENES MENSUALES (Acumular en memoria)
                        for (const { name: monthName, period } of activeMonths) {
                            const po = getVal(row, `PO ${monthName}`);
                            const monto = getVal(row, `MONTO ${monthName}`);

                            if (!po && !monto) continue;

                            const isMensual = getVal(row, 'TIPO')?.toLowerCase().trim() === 'mensual';
                            const cacheKeyM = `M::${activo.id}::${period}`;
                            const cacheKeyB = `B::${activo.id}::${period}::${po || ''}`;

                            if (isMensual && ordenesMensualesSet.has(cacheKeyM)) {
                                continue;
                            } else if (!isMensual && ordenesMensualesSet.has(cacheKeyB)) {
                                continue;
                            }

                            // Añadir al set para evitar duplicados en el mismo archivo
                            ordenesMensualesSet.add(cacheKeyM);
                            ordenesMensualesSet.add(cacheKeyB);

                            const parsedMonto = parseCurrency(monto);
                            const moneda = getVal(row, `MONEDA ${monthName}`);
                            const fechaOc = getVal(row, `FECHA OC ${monthName}`);

                            ordenesMensualesParaInsertar.push({
                                cliente_id: cliente.id,
                                renta_id: renta.id,
                                activo_id: activo.id,
                                periodo: period,
                                po,
                                tarifa: (!isNaN(parsedMonto as any) ? parsedMonto : null),
                                moneda: (moneda || getVal(row, 'MONEDA') || 'MXN').toString().substring(0, 20),
                                estado: 'IMPORTADA',
                                condiciones: {
                                    fecha_oc: fechaOc,
                                    pedido: getVal(row, `PEDIDO ${monthName}`),
                                    fecha_ped: getVal(row, `FECHA PED ${monthName}`),
                                    aplica_smp: getVal(row, `APLICA SMP ${monthName}`),
                                    realizado: getVal(row, `REALIZADO ${monthName}`),
                                    comentarios: getVal(row, `COMENTARIOS ${monthName}`),
                                },
                            });
                            rentasCreadas++;
                        }
                    }


                    processed++;
                } catch (err: any) {
                    errors++;
                    const msg = `Fila ${rowNumber}: ${err.message}`;
                    errorDetails.push(msg);
                }
            }

            // Inserción masiva final
            this.logger.log(`Insertando ${ordenesMensualesParaInsertar.length} ordenes mensuales por lotes...`);
            const chunkSize = 1000;
            for (let i = 0; i < ordenesMensualesParaInsertar.length; i += chunkSize) {
                await db.ordenMensual.createMany({
                    data: ordenesMensualesParaInsertar.slice(i, i + chunkSize),
                    skipDuplicates: true,
                });
            }

            // Calcular series duplicadas y equipos únicos consolidados
            const duplicados: Array<{ serie: string; count: number; rows: number[]; clientes: string[]; modelos: string[]; adcs: string[] }> = [];
            let totalFilasDuplicadas = 0;

            for (const [s, data] of seenSeriesMap.entries()) {
                if (data.rows.length > 1) {
                    duplicados.push({
                        serie: s,
                        count: data.rows.length,
                        rows: data.rows,
                        clientes: Array.from(data.clientes),
                        modelos: Array.from(data.modelos),
                        adcs: Array.from(data.adcs),
                    });
                    totalFilasDuplicadas += (data.rows.length - 1);
                }
            }

            const equiposUnicos = seenSeriesMap.size;

            // --- 7. Registrar historial de carga ---
            await db.cargaMasivaLog.create({
                data: {
                    modulo: 'FLOTILLA_RENTAS',
                    usuario_id: userId,
                    total_registros: processed + errors,
                    procesados: processed,
                    errores: errors,
                    resumen: {
                        clientesNuevos,
                        sitiosNuevos,
                        rentasCreadas,
                        equiposUnicos,
                        totalFilasDuplicadas,
                        duplicados,
                        mesesProcesados: activeMonths.map(m => m.name),
                        errorDetails,
                    },
                },
            });

            this.logger.log(`Proceso finalizado. Procesados: ${processed}, Equipos Únicos: ${equiposUnicos}, Duplicados: ${duplicados.length}, Creados: ${rentasCreadas}`);

            return {
                success: true,
                message: `Carga masiva completada: ${processed} filas procesadas, ${equiposUnicos} equipos únicos registrados (${duplicados.length} series con filas duplicadas consolidadas).`,
                processed,
                errors,
                details: {
                    clientesNuevos,
                    sitiosNuevos,
                    rentasCreadas,
                    equiposUnicos,
                    totalFilasDuplicadas,
                    duplicados,
                },
                errorDetails,
            };

        } catch (error: any) {
            this.logger.error(`Error en procesarArchivo: ${error.message}`);
            throw new HttpException(error.message || 'Error procesando el archivo', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
