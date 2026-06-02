import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaDynamicService } from '../../../database/prisma-dynamic.service';
import * as ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid'; // Fallback for IDs if needed

// Mapeo de nombre completo del mes (como viene en el Excel) → número de mes
const MONTH_NAME_MAP: Record<string, string> = {
    'ENERO': '01', 'FEBRERO': '02', 'MARZO': '03', 'ABRIL': '04',
    'MAYO': '05', 'JUNIO': '06', 'JULIO': '07', 'AGOSTO': '08',
    'SEPTIEMBRE': '09', 'OCTUBRE': '10', 'NOVIEMBRE': '11', 'DICIEMBRE': '12',
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
                headers[colNumber] = (cell.value?.toString() || '').trim().toUpperCase();
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
                            clase: getVal(row, 'CLASE'),
                            modelo: getVal(row, 'MODELO'),
                            estatus_operativo: getVal(row, 'ESTATUS') || 'OPERATIVO',
                            cliente_id: cliente.id,
                            sitio_id: sitio.id,
                            cuenta: getVal(row, 'CUENTA'),
                            adc: getVal(row, 'ADC'),
                            distribuidor: getVal(row, 'DISTRIBUIDOR'),
                        };
                        activo = await db.activo.upsert({
                            where: { serie },
                            update: activoData,
                            create: { serie, ...activoData },
                        });
                        activoCache.set(serie, activo);
                    }

                    // D: RENTA
                    let renta = rentaCache.get(activo.id);
                    if (!renta) {
                        renta = await db.renta.findFirst({ where: { activo_id: activo.id } });
                        if (!renta) {
                            const codRentaCli = getVal(row, 'CÓD RENTA CLI') || getVal(row, 'COD RENTA CLI') || `RENTA-${serie}`;
                            renta = await db.renta.create({
                                data: {
                                    activo_id: activo.id,
                                    cliente_id: cliente.id,
                                    sitio_id: sitio.id,
                                    estado: 'IMPORTADA',
                                    origen: 'IMPORTADA',
                                    condiciones: {
                                        codigo_renta_cli: codRentaCli,
                                        moneda: getVal(row, 'MONEDA'),
                                        tipo: getVal(row, 'TIPO'),
                                    },
                                    fecha_inicio: new Date(),
                                    fecha_fin: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
                                },
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

                        const parsedMonto = monto ? parseFloat(monto.replace(/,/g, '')) : null;
                        const moneda = getVal(row, `MONEDA ${monthName}`);
                        const fechaOc = getVal(row, `FECHA OC ${monthName}`);

                        ordenesMensualesParaInsertar.push({
                            activo_id: activo.id,
                            renta_id: renta.id,
                            cliente_id: cliente.id,
                            periodo: period,
                            po,
                            tarifa: parsedMonto,
                            moneda: moneda || getVal(row, 'MONEDA'),
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
                    data: ordenesMensualesParaInsertar.slice(i, i + chunkSize)
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
