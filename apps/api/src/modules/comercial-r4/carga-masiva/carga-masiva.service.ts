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

@Injectable()
export class CargaMasivaService {
    private readonly logger = new Logger(CargaMasivaService.name);

    constructor(private readonly prismaService: PrismaDynamicService) {}

    async procesarArchivo(file: Express.Multer.File, userId: string) {
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

            const getVal = (row: ExcelJS.Row, colName: string): string | null => {
                const upperName = colName.toUpperCase();
                let idx = headers.findIndex(h => h === upperName);
                if (idx < 0) idx = headers.findIndex(h => h && h.includes(upperName));
                if (idx > 0) {
                    const cell = row.getCell(idx);
                    const val = cell.value;
                    if (val === null || val === undefined) return null;
                    return val.toString().trim() || null;
                }
                return null;
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

                const getDirVal = (row: ExcelJS.Row, colName: string): string | null => {
                    const upperName = colName.toUpperCase();
                    let idx = dirHeaders.findIndex(h => h === upperName);
                    if (idx < 0) idx = dirHeaders.findIndex(h => h && h.includes(upperName));
                    if (idx > 0) {
                        const cell = row.getCell(idx);
                        return cell.value ? cell.value.toString().trim() : null;
                    }
                    return null;
                };

                let dirConsecutiveEmpty = 0;
                for (let i = dirHeaderRowIndex + 1; i <= directorioSheet.rowCount; i++) {
                    const row = directorioSheet.getRow(i);
                    let isEmpty = true;
                    row.eachCell({ includeEmpty: false }, () => { isEmpty = false; });
                    
                    if (isEmpty) {
                        dirConsecutiveEmpty++;
                        if (dirConsecutiveEmpty >= 20) break;
                        continue;
                    }
                    dirConsecutiveEmpty = 0;

                    const clientName = getDirVal(row, 'CLIENTE') || getDirVal(row, 'RAZON SOCIAL') || getDirVal(row, 'RAZÓN SOCIAL');
                    const siteName = getDirVal(row, 'SITIO') || getDirVal(row, 'SITE');
                    
                    if (clientName) {
                        const rfc = getDirVal(row, 'RFC');
                        const correoCliente = getDirVal(row, 'CORREO') || getDirVal(row, 'EMAIL') || getDirVal(row, 'MAIL') || getDirVal(row, 'CORREO CLIENTE');
                        const telefonoCliente = getDirVal(row, 'TELEFONO') || getDirVal(row, 'TELÉFONO') || getDirVal(row, 'TELEFONO CLIENTE');
                        const contactoCliente = getDirVal(row, 'CONTACTO CLIENTE') || getDirVal(row, 'CONTACTO');
                        const direccionCliente = getDirVal(row, 'DIRECCION CLIENTE') || getDirVal(row, 'DIRECCIÓN CLIENTE') || getDirVal(row, 'DOMICILIO CLIENTE');

                        let cliente = clienteCache.get(clientName);
                        if (!cliente) {
                            cliente = await db.cliente.findFirst({ where: { razon_social: clientName } });
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
                                            correo: correoCliente,
                                            telefono: telefonoCliente,
                                            contacto: contactoCliente,
                                            direccion: direccionCliente
                                        }
                                    }
                                });
                            }
                            clienteCache.set(clientName, cliente);
                        }
                        
                        if (siteName) {
                            const cacheKey = `${clientName}::${siteName}`;
                            let sitio = sitioCache.get(cacheKey);
                            const region = getDirVal(row, 'REGION') || getDirVal(row, 'REGIÓN');
                            const responsable = normalizeADCName(getDirVal(row, 'RESPONSABLE') || getDirVal(row, 'ADC'));
                            const distribuidor = getDirVal(row, 'DISTRIBUIDOR') || getDirVal(row, 'DISTRIBUIDOR AUTORIZADO');
                            const contactoNombre = getDirVal(row, 'CONTACTO') || getDirVal(row, 'CONTACTO TECNICO') || getDirVal(row, 'CONTACTO TÉCNICO') || getDirVal(row, 'CONTACTO DISTRIBUIDOR');
                            const contactoTelefono = getDirVal(row, 'TELEFONO') || getDirVal(row, 'TELÉFONO') || getDirVal(row, 'TELEFONO DISTRIBUIDOR');
                            const contactoCorreo = getDirVal(row, 'CORREO') || getDirVal(row, 'EMAIL') || getDirVal(row, 'MAIL') || getDirVal(row, 'CORREO DISTRIBUIDOR');
                            
                            const adcCorreo = getDirVal(row, 'CORREO ADC') || getDirVal(row, 'EMAIL ADC') || getDirVal(row, 'MAIL ADC') || getDirVal(row, 'CORREO RESPONSABLE');
                            const adcTelefono = getDirVal(row, 'TELEFONO ADC') || getDirVal(row, 'TELÉFONO ADC') || getDirVal(row, 'TELEFONO RESPONSABLE');
                            const distribuidorDireccion = getDirVal(row, 'DIRECCION DISTRIBUIDOR') || getDirVal(row, 'DIRECCIÓN DISTRIBUIDOR');
                            const adcDireccion = getDirVal(row, 'DIRECCION ADC') || getDirVal(row, 'DIRECCIÓN ADC');

                            const sitioData = {
                                cliente_id: cliente.id,
                                nombre: siteName,
                                direccion: getDirVal(row, 'DIRECCION') || getDirVal(row, 'DIRECCIÓN') || getDirVal(row, 'CALLE') || getDirVal(row, 'CALLE Y NUMERO') || getDirVal(row, 'DOMICILIO') || getDirVal(row, 'DIRECCION SITIO'),
                                distribuidor: distribuidor,
                                adc: responsable,
                                contacto_operativo: {
                                    region,
                                    responsable,
                                    adc_correo: adcCorreo,
                                    adc_telefono: adcTelefono,
                                    adc_direccion: adcDireccion,
                                    distribuidor_contacto_nombre: contactoNombre,
                                    distribuidor_contacto_telefono: contactoTelefono,
                                    distribuidor_contacto_correo: contactoCorreo,
                                    distribuidor_direccion: distribuidorDireccion
                                }
                            };

                            if (!sitio) {
                                sitio = await db.sitio.findFirst({ where: { cliente_id: cliente.id, nombre: siteName } });
                                if (!sitio) {
                                    sitio = await db.sitio.create({ data: sitioData });
                                    sitiosNuevos++;
                                } else {
                                    // Update existing site with directory info
                                    sitio = await db.sitio.update({ where: { id: sitio.id }, data: { direccion: sitioData.direccion || sitio.direccion, distribuidor: sitioData.distribuidor, contacto_operativo: sitioData.contacto_operativo } });
                                }
                                sitioCache.set(cacheKey, sitio);
                            } else {
                                // Update existing cached site in db
                                sitio = await db.sitio.update({ where: { id: sitio.id }, data: { direccion: sitioData.direccion || sitio.direccion, adc: sitioData.adc || sitio.adc, distribuidor: sitioData.distribuidor || sitio.distribuidor, contacto_operativo: sitioData.contacto_operativo } });
                                sitioCache.set(cacheKey, sitio);
                            }
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

            this.logger.log('Iniciando procesamiento de filas...');
            let consecutiveEmpty = 0;

            for (let rowNumber = headerRowIndex + 1; rowNumber <= worksheet.rowCount; rowNumber++) {
                const row = worksheet.getRow(rowNumber);

                let isEmpty = true;
                row.eachCell({ includeEmpty: false }, () => { isEmpty = false; });
                
                if (isEmpty) {
                    consecutiveEmpty++;
                    if (consecutiveEmpty >= 20) {
                        this.logger.log('Se detectaron 20 filas vacías consecutivas, terminando lectura.');
                        break;
                    }
                    continue;
                }
                
                consecutiveEmpty = 0;

                try {
                    const clienteName = getVal(row, 'CLIENTE');
                    const serie = getVal(row, 'SERIE');

                    if (!clienteName || !serie) {
                        this.logger.warn(`Fila ${rowNumber}: Faltan campos (CLIENTE o SERIE).`);
                        continue;
                    }

                    // A: CLIENTE
                    let cliente = clienteCache.get(clienteName);
                    if (!cliente) {
                        cliente = await db.cliente.findFirst({ where: { razon_social: clienteName } });
                        const rfc = getVal(row, 'RFC') || getVal(row, 'RFC CLIENTE');
                        const correoCliente = getVal(row, 'CORREO CLIENTE') || getVal(row, 'MAIL CLIENTE') || getVal(row, 'EMAIL CLIENTE');
                        const telefonoCliente = getVal(row, 'TELEFONO CLIENTE') || getVal(row, 'TELÉFONO CLIENTE');
                        const direccionCliente = getVal(row, 'DIRECCION CLIENTE') || getVal(row, 'DIRECCIÓN CLIENTE');
                        const contactoCliente = getVal(row, 'CONTACTO CLIENTE');

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
                                        correo: correoCliente,
                                        telefono: telefonoCliente,
                                        direccion: direccionCliente,
                                        contacto: contactoCliente
                                    }
                                }
                            });
                        }
                        clienteCache.set(clienteName, cliente);
                    }

                    // B: SITIO
                    const sitioName = getVal(row, 'SITE') || getVal(row, 'SITIO') || 'Sin Sitio';
                    const sitioCacheKey = `${cliente.id}::${sitioName}`;
                    let sitio = sitioCache.get(sitioCacheKey);
                    
                    const adc = normalizeADCName(getVal(row, 'RESPONSABLE') || getVal(row, 'ADC'));
                    const distribuidor = getVal(row, 'DISTRIBUIDOR') || getVal(row, 'DISTRIBUIDOR AUTORIZADO');
                    const sitioData = {
                        ciudad: getVal(row, 'MUNICIPIO') || getVal(row, 'CIUDAD'),
                        direccion: getVal(row, 'DIRECCION') || getVal(row, 'DIRECCIÓN') || getVal(row, 'CALLE') || getVal(row, 'CALLE Y NUMERO') || getVal(row, 'DOMICILIO') || getVal(row, 'DIRECCION SITIO'),
                        cuenta: getVal(row, 'CUENTA'),
                        adc: adc,
                        distribuidor: distribuidor,
                        contacto_operativo: {
                            adc_correo: getVal(row, 'CORREO ADC') || getVal(row, 'MAIL ADC') || getVal(row, 'EMAIL ADC') || getVal(row, 'CORREO RESPONSABLE'),
                            adc_telefono: getVal(row, 'TELEFONO ADC') || getVal(row, 'TELÉFONO ADC') || getVal(row, 'TELEFONO RESPONSABLE'),
                            adc_direccion: getVal(row, 'DIRECCION ADC') || getVal(row, 'DIRECCIÓN ADC'),
                            distribuidor_contacto_nombre: getVal(row, 'CONTACTO DISTRIBUIDOR') || getVal(row, 'CONTACTO TECNICO') || getVal(row, 'CONTACTO TÉCNICO') || getVal(row, 'CONTACTO'),
                            distribuidor_contacto_correo: getVal(row, 'CORREO DISTRIBUIDOR') || getVal(row, 'MAIL DISTRIBUIDOR') || getVal(row, 'EMAIL DISTRIBUIDOR'),
                            distribuidor_contacto_telefono: getVal(row, 'TELEFONO DISTRIBUIDOR') || getVal(row, 'TELÉFONO DISTRIBUIDOR'),
                            distribuidor_direccion: getVal(row, 'DIRECCION DISTRIBUIDOR') || getVal(row, 'DIRECCIÓN DISTRIBUIDOR')
                        }
                    };

                    if (!sitio) {
                        sitio = await db.sitio.findFirst({
                            where: { cliente_id: cliente.id, nombre: sitioName },
                        });
                        
                        if (!sitio) {
                            sitio = await db.sitio.create({
                                data: { cliente_id: cliente.id, nombre: sitioName, ...sitioData },
                            });
                            sitiosNuevos++;
                        } else {
                            sitio = await db.sitio.update({ where: { id: sitio.id }, data: sitioData });
                        }
                        sitioCache.set(sitioCacheKey, sitio);
                    } else {
                        // Ensure cache handles updates within same file if new fields appear
                        sitio = await db.sitio.update({ where: { id: sitio.id }, data: sitioData });
                        sitioCache.set(sitioCacheKey, sitio);
                    }

                    // C: ACTIVO
                    let activo = activoCache.get(serie);
                    if (!activo) {
                        const activoData = {
                            id: serie,
                            clase: getVal(row, 'CLASE'),
                            modelo: getVal(row, 'MODELO'),
                            oach: getVal(row, 'OACH'),
                            altura: getVal(row, 'ALTURA'),
                            bc: getVal(row, 'BC'),
                            estatus: getVal(row, 'ESTATUS') || 'Activo',
                            estatus_operativo: getVal(row, 'ESTATUS') || 'OPERATIVO',
                            cliente_id: cliente.id,
                            sitio_id: sitio.id,
                            cuenta: getVal(row, 'CUENTA'),
                            adc: normalizeADCName(getVal(row, 'RESPONSABLE') || getVal(row, 'ADC')),
                            distribuidor: getVal(row, 'DISTRIBUIDOR'),
                            propietario: getVal(row, 'PROPIETARIO'),
                        };
                        activo = await db.activo.upsert({
                            where: { id: serie },
                            update: activoData,
                            create: { serie, ...activoData },
                        });
                        activoCache.set(serie, activo);
                    }

                    // D: RENTA
                    let renta = rentaCache.get(activo.id);
                    const tarifaStr = getVal(row, 'PRECIO RENTA CLIENTE') || getVal(row, 'RENTA') || getVal(row, 'TARIFA');
                    const tarifaParsed = parseCurrency(tarifaStr);
                    
                    if (tarifaParsed !== null && !isNaN(tarifaParsed)) {
                        if (!renta) {
                            renta = await db.renta.findFirst({ where: { activo_id: activo.id } });
                            const codRentaCli = getVal(row, 'CÓD RENTA CLI') || getVal(row, 'COD RENTA CLI') || `RENTA-${serie}`;
                            
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
                        mesesProcesados: activeMonths.map(m => m.name),
                        errorDetails,
                    },
                },
            });

            this.logger.log(`Proceso finalizado. Procesados: ${processed}, Creados: ${rentasCreadas}`);

            return {
                success: true,
                message: `Carga masiva completada: ${processed} filas procesadas, ${rentasCreadas} rentas detectadas.`,
                processed,
                errors,
                details: { clientesNuevos, sitiosNuevos, rentasCreadas },
                errorDetails,
            };

        } catch (error: any) {
            this.logger.error(`Error en procesarArchivo: ${error.message}`);
            throw new HttpException(error.message || 'Error procesando el archivo', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
