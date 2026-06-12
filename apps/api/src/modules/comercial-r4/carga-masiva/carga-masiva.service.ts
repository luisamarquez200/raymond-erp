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

            const worksheet = workbook.worksheets[0];
            if (!worksheet) {
                throw new HttpException('El archivo Excel está vacío o no tiene hojas.', HttpStatus.BAD_REQUEST);
            }

            const headerRow = worksheet.getRow(1);
            const headers: string[] = [];
            headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                // Normalize: trim + collapse multiple spaces into one
                headers[colNumber] = (cell.value?.toString() || '').trim().toUpperCase().replace(/\s+/g, ' ');
            });

            if (headers.filter(Boolean).length === 0) {
                throw new HttpException('No se encontraron encabezados en la primera fila.', HttpStatus.BAD_REQUEST);
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
            let clientesNuevos = 0;
            let sitiosNuevos = 0;
            const errorDetails: string[] = [];

            this.logger.log('Iniciando procesamiento de filas...');

            for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
                const row = worksheet.getRow(rowNumber);

                let isEmpty = true;
                row.eachCell({ includeEmpty: false }, () => { isEmpty = false; });
                if (isEmpty) continue;

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
                        if (!cliente) {
                            cliente = await db.cliente.create({
                                data: {
                                    razon_social: clienteName,
                                    codigo_cliente: `CLI-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
                                    estado: 'ACTIVO',
                                },
                            });
                            clientesNuevos++;
                        }
                        clienteCache.set(clienteName, cliente);
                    }

                    // B: SITIO
                    const sitioName = getVal(row, 'SITE') || 'Sin Sitio';
                    const sitioCacheKey = `${cliente.id}::${sitioName}`;
                    let sitio = sitioCache.get(sitioCacheKey);
                    if (!sitio) {
                        sitio = await db.sitio.findFirst({
                            where: { cliente_id: cliente.id, nombre: sitioName },
                        });
                        const sitioData = {
                            ciudad: getVal(row, 'MUNICIPIO'),
                            cuenta: getVal(row, 'CUENTA'),
                            adc: getVal(row, 'ADC'),
                            distribuidor: getVal(row, 'DISTRIBUIDOR'),
                        };
                        if (!sitio) {
                            sitio = await db.sitio.create({
                                data: { cliente_id: cliente.id, nombre: sitioName, ...sitioData },
                            });
                            sitiosNuevos++;
                        } else {
                            sitio = await db.sitio.update({ where: { id: sitio.id }, data: sitioData });
                        }
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
                            estatus_operativo: getVal(row, 'ESTATUS') || 'OPERATIVO',
                            cliente_id: cliente.id,
                            sitio_id: sitio.id,
                            cuenta: getVal(row, 'CUENTA'),
                            adc: getVal(row, 'ADC'),
                            distribuidor: getVal(row, 'DISTRIBUIDOR'),
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
                    if (!renta) {
                        renta = await db.renta.findFirst({ where: { activo_id: activo.id } });
                        const codRentaCli = getVal(row, 'CÓD RENTA CLI') || getVal(row, 'COD RENTA CLI') || `RENTA-${serie}`;
                        const tarifaStr = getVal(row, 'PRECIO RENTA CLIENTE') || getVal(row, 'RENTA') || getVal(row, 'TARIFA');
                        const tarifaParsed = parseCurrency(tarifaStr);
                        
                        const rentaData = {
                            cuenta: getVal(row, 'CUENTA'),
                            adc: getVal(row, 'ADC'),
                            distribuidor: getVal(row, 'DISTRIBUIDOR'),
                            ...(tarifaParsed !== null && !isNaN(tarifaParsed) && { tarifa: tarifaParsed })
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
                                    condiciones: {
                                        codigo_renta_cli: codRentaCli,
                                        moneda: getVal(row, 'MONEDA'),
                                        tipo: getVal(row, 'TIPO'),
                                        plazo_meses: getVal(row, 'PLAZO DE RENTA (MESES)'),
                                        tipo_poliza: getVal(row, 'CFPM / SMP'),
                                        costo_poliza_distribuidor: parseCurrency(getVal(row, 'PRECIO RENTA DEALER')),
                                        moneda_pago_distribuidor: getVal(row, 'MONEDA2'),
                                    },
                                    fecha_inicio: getDateVal(row, ['FECHA ENTREGADO', 'FECHA INICIO', 'INICIO'], new Date()),
                                    fecha_fin: getDateVal(row, ['FECHA VENCIMIENTO', 'FECHA FIN', 'FIN VIGENCIA', 'VENCIMIENTO'], defaultFin),
                                    detalles: {
                                        create: {
                                            renta_base: (!isNaN(tarifaParsed as any) ? tarifaParsed : null),
                                            moneda: getVal(row, 'MONEDA') || 'MXN',
                                            tipo_renta: getVal(row, 'TIPO') || 'MENSUAL'
                                        }
                                    }
                                },
                            });
                        } else {
                            renta = await db.renta.update({
                                where: { id: renta.id },
                                data: {
                                    ...rentaData,
                                    condiciones: {
                                        ...(typeof renta.condiciones === 'object' ? renta.condiciones : {}),
                                        moneda: getVal(row, 'MONEDA') || (renta.condiciones as any)?.moneda,
                                        tipo: getVal(row, 'TIPO') || (renta.condiciones as any)?.tipo,
                                        tipo_poliza: getVal(row, 'CFPM / SMP') || (renta.condiciones as any)?.tipo_poliza,
                                        costo_poliza_distribuidor: parseCurrency(getVal(row, 'PRECIO RENTA DEALER')) ?? (renta.condiciones as any)?.costo_poliza_distribuidor,
                                        moneda_pago_distribuidor: getVal(row, 'MONEDA2') || (renta.condiciones as any)?.moneda_pago_distribuidor,
                                    },
                                    detalles: {
                                        upsert: {
                                            create: {
                                                renta_base: (!isNaN(tarifaParsed as any) ? tarifaParsed : null),
                                                moneda: getVal(row, 'MONEDA') || 'MXN',
                                                tipo_renta: getVal(row, 'TIPO') || 'MENSUAL'
                                            },
                                            update: {
                                                renta_base: (!isNaN(tarifaParsed as any) ? tarifaParsed : null),
                                                moneda: getVal(row, 'MONEDA') || 'MXN',
                                                tipo_renta: getVal(row, 'TIPO') || 'MENSUAL'
                                            }
                                        }
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
