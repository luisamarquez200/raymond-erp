import { PrismaClient as PrismaR1 } from '@prisma/client-taller-r1';
import { Injectable, BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

export interface CreateEntradaDto {
    folio: string;
    distribuidor?: string;
    factura?: string;
    cliente_origen?: string;
    adc?: string;
    cliente?: string;
    fecha_creacion: Date;
    elemento?: string;
    comentario?: string;
    evidencia_1?: string;
    usuario_asignado?: string;
    estado: string;
    prioridad?: string;
    firma_entrega?: string;
    firma_recibo?: string;
    nombre_entrega?: string;
    comentario_1?: string;
    comentario_2?: string;
    evidencia_2?: string;
    evidencia_3?: string;
    fecha_asignacion?: Date;
    usuario_encargado?: string;
    bol?: string;
}

export interface UpdateEntradaDto {
    usuario_asignado?: string;
    comentario?: string;
    evidencia_1?: string;
    evidencia_2?: string;
    evidencia_3?: string;
    firma_entrega?: string;
    firma_recibo?: string;
    estado?: string;
    fecha_cierre?: Date;
    prioridad?: string;
    fecha_asignacion?: Date;
    usuario_encargado?: string;
    cliente?: string;
    bol?: string;
}

import { PrismaDynamicService } from '../../database/prisma-dynamic.service';
import { StorageService } from './storage.service';

@Injectable()
export class EntradasService {
    constructor(
        private prisma: PrismaDynamicService,
        private storageService: StorageService
    ) { }

    private get db(): PrismaR1 {
        return this.prisma.client;
    }



    // Obtener todas las entradas
    async findAll(estado?: string) {
        const where = estado ? { estado } : {};
        
        const includeQuery: any = {
            _count: {
                select: {
                    entrada_detalle: true,
                    entrada_accesorios: true,
                },
            },
        };

        // rel_cliente solo existe en Taller R1
        if (this.prisma.currentSite === 'r1') {
            includeQuery.rel_cliente = {
                select: {
                    nombre_cliente: true,
                },
            };
        }

        return this.db.entradas.findMany({
            where,
            include: includeQuery,
            orderBy: { fecha_creacion: 'desc' },
        });
    }


    // Obtener conteos de equipos y accesorios para todas las entradas
    async getCounts() {
        const [detalles, accesorios]: any[] = await Promise.all([
            this.db.$queryRaw`
                SELECT id_entrada, COUNT(*) as count
                FROM entrada_detalle
                GROUP BY id_entrada
            `,
            this.db.$queryRaw`
                SELECT id_entrada, COUNT(*) as count
                FROM entrada_accesorios
                GROUP BY id_entrada
            `,
        ]);

        const counts: Record<string, { equipos: number; accesorios: number }> = {};
        for (const row of detalles) {
            if (!counts[row.id_entrada]) counts[row.id_entrada] = { equipos: 0, accesorios: 0 };
            counts[row.id_entrada].equipos = Number(row.count);
        }
        for (const row of accesorios) {
            if (!counts[row.id_entrada]) counts[row.id_entrada] = { equipos: 0, accesorios: 0 };
            counts[row.id_entrada].accesorios = Number(row.count);
        }
        return counts;
    }

    async validateCrossSiteSerial(serial: string, tipo: string) {
        await PrismaDynamicService.ensureClientsInitialized();
        const cleanSerial = serial.trim();
        const upperSerial = cleanSerial.toUpperCase();

        const sites = [
            { id: 'R1', client: PrismaDynamicService.clients.r1 },
            { id: 'R2', client: PrismaDynamicService.clients.r2 },
            { id: 'R3', client: PrismaDynamicService.clients.r3 },
        ];

        let foundData: any = null;

        console.log(`[validateCrossSiteSerial] 🔍 Starting cross-site search for ${tipo}: ${cleanSerial}`);

        for (const site of sites) {
            try {
                const db = site.client;
                if (!db) {
                    console.log(`[validateCrossSiteSerial] ⚠️ Site ${site.id} client not available, skipping.`);
                    continue;
                }

                console.log(`[validateCrossSiteSerial] 🏭 Searching in SITE ${site.id}...`);

                if (tipo === 'Equipo') {
                    // 1. Check in equipo_ubicacion — ONLY block if actively 'Ingresado'
                    const inWarehouseActive = await db.equipo_ubicacion.findFirst({
                        where: { 
                            serial_equipo: { in: [cleanSerial, upperSerial] },
                            estado: 'Ingresado'
                        }
                    });

                    if (inWarehouseActive) {
                        console.log(`[validateCrossSiteSerial] ✅ Found ACTIVE in ${site.id} equipo_ubicacion. State: Ingresado`);
                        // Manual lookup for tech info
                        let modelo = null;
                        let clase = null;
                        try {
                            const eqInfo = await db.equipos.findFirst({
                                where: { id_equipos: inWarehouseActive.id_equipos },
                                select: { modelo: true, clase: true }
                            });
                            modelo = eqInfo?.modelo;
                            clase = eqInfo?.clase;
                        } catch (e: any) {
                            console.warn(`[validateCrossSiteSerial] Could not fetch tech info for ${site.id}:`, e.message);
                        }

                        return { 
                            exists: true, 
                            site: site.id, 
                            estado: 'Ingresado en almacén',
                            modelo,
                            clase
                        };
                    }

                    // 1b. If equipment is 'Retirado', collect historical info but don't block
                    if (!foundData) {
                        const inWarehouseRetired = await db.equipo_ubicacion.findFirst({
                            where: { 
                                serial_equipo: { in: [cleanSerial, upperSerial] },
                                estado: 'Retirado'
                            },
                            orderBy: { estado: 'asc' }
                        });
                        if (inWarehouseRetired) {
                            console.log(`[validateCrossSiteSerial] 💡 Found RETIRED in ${site.id} equipo_ubicacion — using as historical data.`);
                            try {
                                const eqInfo = await db.equipos.findFirst({
                                    where: { id_equipos: inWarehouseRetired.id_equipos },
                                    select: { modelo: true, clase: true }
                                });
                                if (eqInfo) {
                                    foundData = { modelo: eqInfo.modelo, clase: eqInfo.clase, site: site.id };
                                }
                            } catch (e: any) {
                                console.warn(`[validateCrossSiteSerial] Could not fetch tech info for retired equipo in ${site.id}:`, e.message);
                            }
                        }
                    }

                    // 2. Check in open Entrance (entrada_detalle)
                    const inPendingEntrada = await db.entrada_detalle.findFirst({
                        where: {
                            serial_equipo: { in: [cleanSerial, upperSerial] },
                            entradas: {
                                estado: { notIn: ['Cerrado', 'Cancelado'] }
                            }
                        }
                    });

                    if (inPendingEntrada) {
                        console.log(`[validateCrossSiteSerial] ✅ Found in ${site.id} entrada_detalle (Pending)`);
                        let modelo = null;
                        let clase = inPendingEntrada.clase;
                        try {
                            const eqInfo = await db.equipos.findFirst({
                                where: { id_equipos: inPendingEntrada.id_equipos },
                                select: { modelo: true, clase: true }
                            });
                            modelo = eqInfo?.modelo;
                            clase = clase || eqInfo?.clase;
                        } catch (e: any) {
                            console.warn(`[validateCrossSiteSerial] Could not fetch tech info from pending entrada for ${site.id}:`, e.message);
                        }

                        return { 
                            exists: true, 
                            site: site.id, 
                            estado: 'En Entrada pendiente (Por Ubicar)',
                            modelo,
                            clase
                        };
                    }

                    // 3. Fallback: Historical info in current site
                    if (!foundData) {
                        try {
                            const historical = await db.equipos.findFirst({
                                where: { numero_serie: { in: [cleanSerial, upperSerial] } },
                                select: { modelo: true, clase: true }
                            });
                            if (historical) {
                                console.log(`[validateCrossSiteSerial] 💡 Found historical info in ${site.id} equipos table.`);
                                foundData = { modelo: historical.modelo, clase: historical.clase, site: site.id };
                            }
                        } catch (e: any) {
                            console.warn(`[validateCrossSiteSerial] Historical search failed for ${site.id}:`, e.message);
                        }
                    }

                } else if (tipo === 'Accesorio') {
                    // Check if accessory is in warehouse or pending
                    const orConditions: any[] = [
                        { estado: 'Ingresado' },
                        { entradas: { estado: { notIn: ['Cerrado', 'Cancelado'] } } }
                    ];

                    if (site.id === 'R1') {
                        orConditions.push({ estado_acc: 'Ingresado' });
                    }

                    const acc = await db.entrada_accesorios.findFirst({
                        where: {
                            serial: { in: [cleanSerial, upperSerial] },
                            OR: orConditions
                        }
                    });

                    if (acc) {
                        console.log(`[validateCrossSiteSerial] ✅ Found accessory in ${site.id}`);
                        return { 
                            exists: true, 
                            site: site.id, 
                            estado: 'Ingresado o en Entrada',
                            modelo: acc.modelo,
                            tipo: acc.tipo
                        };
                    }

                    // Historical lookup for accessories
                    if (!foundData) {
                        try {
                            const histAcc = await db.entrada_accesorios.findFirst({
                                where: { serial: { in: [cleanSerial, upperSerial] } },
                                select: { modelo: true, tipo: true }
                            });
                            if (histAcc) {
                                console.log(`[validateCrossSiteSerial] 💡 Found historical accessory info in ${site.id}`);
                                foundData = { modelo: histAcc.modelo, tipo: histAcc.tipo, site: site.id };
                            }
                        } catch (e: any) {
                            console.warn(`[validateCrossSiteSerial] Accessory historical search failed for ${site.id}:`, e.message);
                        }
                    }
                }
            } catch (error: any) {
                console.error(`❌ [validateCrossSiteSerial] Fatal error in site ${site.id}:`, error.message);
            }
        }

        // SEARCH IN MASTER CARGUEMASIVO (ONLY IN R1) AS LAST RESORT
        if (!foundData && tipo === 'Equipo') {
            const r1 = PrismaDynamicService.clients.r1;
            if (r1) {
                console.log(`[validateCrossSiteSerial] 🌍 No site matches. Searching in Master Data (R1) for serial: ${cleanSerial}`);
                try {
                    // @ts-ignore
                    const master = await r1.orden_base_cargue.findFirst({
                        where: { 
                            serial_number: { in: [cleanSerial, upperSerial] }
                        }
                    });
                    if (master) {
                        return { 
                            exists: false, 
                            source: 'Master Data R1',
                            modelo: (master as any).MODELO || (master as any).modelo, 
                            clase: (master as any).clase 
                        };
                    }
                } catch (e: any) {
                    console.error('[validateCrossSiteSerial] Master search failed:', e.message);
                }
            }
        }

        if (foundData) {
            console.log(`[validateCrossSiteSerial] 🏁 Search finished. Using historical info from ${foundData.site}`);
        } else {
            console.log(`[validateCrossSiteSerial] 🏁 Search finished. No matches found for ${cleanSerial}`);
        }

        return foundData ? { exists: false, ...foundData } : { exists: false };
    }

    // Obtener una entrada por ID
    async findOne(id: string) {
        const includeQuery: any = {
            _count: {
                select: {
                    entrada_detalle: true,
                    entrada_accesorios: true,
                },
            },
        };

        // rel_cliente solo existe en Taller R1
        if (this.prisma.currentSite === 'r1') {
            includeQuery.rel_cliente = {
                select: {
                    nombre_cliente: true,
                },
            };
        }

        const entrada: any = await this.db.entradas.findUnique({
            where: { id_entrada: id },
            include: includeQuery,
        });

        if (!entrada) return null;

        // Fetch client name for r2/r3 to mock the rel_cliente format the frontend expects
        if (this.prisma.currentSite !== 'r1' && entrada.cliente) {
            const clienteData = await this.db.cliente.findUnique({ where: { id_cliente: entrada.cliente } });
            if (clienteData) {
                entrada.rel_cliente = { nombre_cliente: clienteData.nombre_cliente };
            }
        }

        // Fetch User Name globally from R1 for 'Encargado'
        if (entrada.usuario_asignado) {
            const usuarioData = await this.prisma.r1.usuarios.findUnique({
                where: { IDUsuarios: entrada.usuario_asignado },
                select: { Usuario: true }
            });
            if (usuarioData && usuarioData.Usuario) {
                entrada.usuario_asignado = usuarioData.Usuario;
            }
        }

        return entrada;
    }

    // Crear una nueva entrada
    async create(data: CreateEntradaDto) {
        console.log('[EntradasService] create called for folio:', data.folio);
        try {
            const id_entrada = `ENT-${Date.now()}`;

            // 1. Extract Base64 signatures and evidences for disk saving
            const filesToSave: any = {};
            if (data.firma_entrega?.startsWith('data:image')) filesToSave.firma_entrega = data.firma_entrega;
            if (data.firma_recibo?.startsWith('data:image')) filesToSave.firma_recibo = data.firma_recibo;
            if (data.evidencia_1?.startsWith('data:image')) filesToSave.evidencia_1 = data.evidencia_1;
            if (data.evidencia_2?.startsWith('data:image')) filesToSave.evidencia_2 = data.evidencia_2;
            if (data.evidencia_3?.startsWith('data:image')) filesToSave.evidencia_3 = data.evidencia_3;

            // 2. Save all files to disk
            let savedPaths = {};
            if (Object.keys(filesToSave).length > 0) {
                console.log('[EntradasService] Saving files to disk. Keys:', Object.keys(filesToSave));
                savedPaths = await this.saveImagesDirectly(data.folio, 'headers', filesToSave);
                console.log('[EntradasService] Saved paths result:', JSON.stringify(savedPaths));
            } else {
                console.log('[EntradasService] No files to save for headers');
            }

            // 3. Clean payload: Remove Base64 strings for fields to avoid truncation error
            const cleanData = { ...data };
            if (cleanData.firma_entrega?.startsWith('data:image')) delete cleanData.firma_entrega;
            if (cleanData.firma_recibo?.startsWith('data:image')) delete cleanData.firma_recibo;
            if (cleanData.evidencia_1?.startsWith('data:image')) delete cleanData.evidencia_1;
            if (cleanData.evidencia_2?.startsWith('data:image')) delete cleanData.evidencia_2;
            if (cleanData.evidencia_3?.startsWith('data:image')) delete cleanData.evidencia_3;

            // 4. Strip fields unavailable in R2/R3 schemas to prevent Prisma 500 error
            if (this.prisma.currentSite === 'r2' || this.prisma.currentSite === 'r3') {
                delete cleanData.distribuidor;
                delete cleanData.cliente_origen;
                delete cleanData.adc;
                delete cleanData.evidencia_3;
            }

            // 'bol' is for R2 and R3 only
            if (this.prisma.currentSite !== 'r2' && this.prisma.currentSite !== 'r3') {
                // @ts-ignore
                delete cleanData.bol;
            }

            console.log('[EntradasService] Creating entry in DB with id:', id_entrada);
            return await this.db.entradas.create({
                data: {
                    id_entrada,
                    ...cleanData,
                    ...savedPaths,
                    estado: data.estado || ((this.prisma.currentSite === 'r3' || this.prisma.currentSite === 'r2') ? 'Por Ubicar' : 'Recibido – En espera evaluación'),
                    usuario_asignado: cleanData.usuario_asignado || this.prisma.currentUser?.substring(0, 100),
                    usuario_encargado: cleanData.usuario_encargado || this.prisma.currentUser?.substring(0, 100),
                    fecha_asignacion: cleanData.fecha_asignacion ? new Date(cleanData.fecha_asignacion) : new Date(),
                },
            });
        } catch (error: any) {
            console.error('[EntradasService] Error in create:', error);
            if (error.code === 'P2003') {
                throw new BadRequestException('El cliente seleccionado o algún dato relacionado no es válido (Foreign Key Constraint).');
            }
            if (error.code === 'P2002') throw new ConflictException(`Ya existe un registro con el folio ${data.folio}`);
            throw new InternalServerErrorException(`Error Prisma: ${error.message || 'Error desconocido'}`);
        }
    }

    private async saveImagesDirectly(folio: string, subFolder: string, files: { [key: string]: string }) {
        const result: { [key: string]: string } = {};
        const site = this.prisma.currentSite?.toUpperCase() || 'R1';
        const folderPath = `${site}/Entradas/${folio}/${subFolder}`;

        for (const [key, base64] of Object.entries(files)) {
            if (base64 && base64.startsWith('data:image')) {
                try {
                    console.log(`[EntradasService] Uploading image for key: ${key} to path: ${folderPath}`);
                    const url = await this.storageService.uploadBase64Image(base64, folderPath, key);
                    if (url) {
                        console.log(`[EntradasService] Successfully uploaded ${key}. URL: ${url}`);
                        result[key] = url;
                    } else {
                        console.warn(`[EntradasService] uploadBase64Image returned null for ${key}`);
                    }
                } catch (error: any) {
                    console.error(`[EntradasService] Error saving image ${key} to storage:`, error.message);
                }
            } else {
                console.log(`[EntradasService] Skipping ${key} - not a base64 string or empty`);
            }
        }
        return result;
    }

    // Actualizar una entrada
    async update(id: string, data: UpdateEntradaDto) {
        console.log(`[EntradasService] update called for id: ${id}`);
        try {
            // Get original entry to know the folio
            const originalEntry = await this.db.entradas.findUnique({
                where: { id_entrada: id }
            });

            if (!originalEntry) {
                throw new BadRequestException(`Entrada no encontrada: ${id}`);
            }

            const folio = originalEntry.folio;

            // 1. Extract Base64 signatures and evidences for disk saving
            const filesToSave: any = {};
            if (data.firma_entrega?.startsWith('data:image')) filesToSave.firma_entrega = data.firma_entrega;
            if (data.firma_recibo?.startsWith('data:image')) filesToSave.firma_recibo = data.firma_recibo;
            if (data.evidencia_1?.startsWith('data:image')) filesToSave.evidencia_1 = data.evidencia_1;
            if (data.evidencia_2?.startsWith('data:image')) filesToSave.evidencia_2 = data.evidencia_2;
            if (data.evidencia_3?.startsWith('data:image')) filesToSave.evidencia_3 = data.evidencia_3;

            // 2. Save all files to disk
            let savedPaths = {};
            if (Object.keys(filesToSave).length > 0) {
                console.log('[EntradasService] Saving files to disk during update. Keys:', Object.keys(filesToSave));
                savedPaths = await this.saveImagesDirectly(folio, 'headers', filesToSave);
                console.log('[EntradasService] Update saved paths result:', JSON.stringify(savedPaths));
            }

            // 3. Clean payload: Remove Base64 strings for fields to avoid truncation error
            const cleanData = { ...data };
            const isBase64 = (str: any) => typeof str === 'string' && (str.startsWith('data:image') || str.length > 255);

            if (isBase64(cleanData.firma_entrega)) delete cleanData.firma_entrega;
            if (isBase64(cleanData.firma_recibo)) delete cleanData.firma_recibo;
            if (isBase64(cleanData.evidencia_1)) delete cleanData.evidencia_1;
            if (isBase64(cleanData.evidencia_2)) delete cleanData.evidencia_2;
            if (isBase64(cleanData.evidencia_3)) delete cleanData.evidencia_3;

            // 4. Strip fields unavailable in R2/R3 schemas to prevent Prisma 500 error
            if (this.prisma.currentSite === 'r2' || this.prisma.currentSite === 'r3') {
                // @ts-ignore
                if (cleanData.distribuidor !== undefined) delete cleanData.distribuidor;
                // @ts-ignore
                if (cleanData.cliente_origen !== undefined) delete cleanData.cliente_origen;
                // @ts-ignore
                if (cleanData.adc !== undefined) delete cleanData.adc;
                if (cleanData.evidencia_3 !== undefined) delete cleanData.evidencia_3;
            }

            // 'bol' is for R2 and R3 only
            if (this.prisma.currentSite !== 'r2' && this.prisma.currentSite !== 'r3') {
                // @ts-ignore
                delete cleanData.bol;
            }

            return await this.db.entradas.update({
                where: { id_entrada: id },
                data: {
                    ...cleanData,
                    ...savedPaths
                },
            });
        } catch (error: any) {
            console.error('[EntradasService] Error in update:', error);
            throw new InternalServerErrorException(`Error Prisma: ${error.message || 'Error desconocido'}`);
        }
    }

    // Eliminar una entrada (cascade manual requerido: relationMode = "prisma" no hace cascade a nivel BD)
    async remove(id: string) {
        return this.db.$transaction(async (tx) => {
            // 1. Obtener IDs de detalles y accesorios para poder borrar sus hijos primero
            const detalles = await tx.entrada_detalle.findMany({
                where: { id_entrada: id },
                select: { id_detalles: true },
            });
            const accesorios = await tx.entrada_accesorios.findMany({
                where: { id_entrada: id },
                select: { id_accesorio: true },
            });

            const idDetalles = detalles.map((d) => d.id_detalles);
            const idAccesorios = accesorios.map((a) => a.id_accesorio);

            // 2. Eliminar evaluaciones de equipos (hijos de entrada_detalle)
            // evaluaciones_checklist no existe en el schema de naves (R2)
            if (idDetalles.length > 0 && this.prisma.currentSite !== 'r2') {
                await tx.evaluaciones_checklist.deleteMany({
                    where: { id_detalle: { in: idDetalles } },
                });
            }

            // 3. Eliminar evaluaciones de accesorios (hijos de entrada_accesorios)
            if (idAccesorios.length > 0) {
                await tx.evaluaciones_accesorios.deleteMany({
                    where: { id_accesorio: { in: idAccesorios } },
                });
            }

            // 4. Eliminar detalles de equipos
            await tx.entrada_detalle.deleteMany({
                where: { id_entrada: id },
            });

            // 5. Eliminar accesorios
            await tx.entrada_accesorios.deleteMany({
                where: { id_entrada: id },
            });

            // 6. Eliminar la entrada principal
            return tx.entradas.delete({
                where: { id_entrada: id },
            });
        });
    }

    // Obtener detalles de una entrada
    async getDetalles(id_entrada: string) {
        const detalles = await this.db.entrada_detalle.findMany({
            where: { id_entrada },
            include: {
                rel_ubicacion: { select: { nombre_ubicacion: true } },
                rel_sub_ubicacion: { select: { nombre: true } },
                rel_equipo: true,
                // rel_serie_info removed from relation to allow unregistered serials
            }
        });

        // Manually populate rel_serie_info from CargueMasivo
        const serials = detalles
            .map(d => d.serial_equipo)
            .filter((s): s is string => !!s);

        if (serials.length > 0) {
            const infos = await this.db.cargueMasivo.findMany({
                where: { SERIE: { in: serials } }
            });
            const infoMap = new Map(infos.map(i => [i.SERIE, i]));

            return detalles.map(d => ({
                ...d,
                rel_serie_info: (d.serial_equipo && infoMap.get(d.serial_equipo)) || null
            }));
        }

        return detalles;
    }

    // Obtener accesorios de una entrada
    async getAccesorios(id_entrada: string) {
        return this.db.entrada_accesorios.findMany({
            where: { id_entrada },
            include: {
                rel_ubicacion: { select: { nombre_ubicacion: true } },
                rel_sub_ubicacion: { select: { nombre: true } },
                evaluaciones: true,
            }
        });
    }

    // Crear detalle de entrada (Equipo)
    async createDetalle(id_entrada: string, data: any) {
        console.log('[EntradasService] createDetalle called for header:', id_entrada);
        try {
            const id_detalles = `DET-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            // 1. Fetch Folio for file path
            const entrada = await this.db.entradas.findUnique({ where: { id_entrada }, select: { folio: true } });
            if (!entrada) {
                console.error(`[EntradasService] Entrada ${id_entrada} not found in DB`);
                throw new BadRequestException(`La entrada con ID ${id_entrada} no existe. No se puede crear el detalle.`);
            }

            // 1.1 Check if serial number is already in "Ingresado" status in equipo_ubicacion
            if (data.serial_equipo && data.serial_equipo !== 'S/N') {
                const existingInUbicacion = await this.db.equipo_ubicacion.findFirst({
                    where: {
                        serial_equipo: data.serial_equipo,
                        estado: 'Ingresado'
                    }
                });

                if (existingInUbicacion) {
                    throw new ConflictException(`Ya hay un equipo con el número de serie ${data.serial_equipo} en estado Ingresado en Producto ubicación.`);
                }
            }

            // 2. Process images - Extract Base64
            const imageFiles: any = {};
            if (typeof data.evidencia_1 === 'string' && data.evidencia_1.startsWith('data:image')) imageFiles.evidencia_1 = data.evidencia_1;
            if (typeof data.evidencia_2 === 'string' && data.evidencia_2.startsWith('data:image')) imageFiles.evidencia_2 = data.evidencia_2;
            if (typeof data.evidencia_3 === 'string' && data.evidencia_3.startsWith('data:image')) imageFiles.evidencia_3 = data.evidencia_3;
            if (typeof data.evidencia_4 === 'string' && data.evidencia_4.startsWith('data:image')) imageFiles.evidencia_4 = data.evidencia_4;

            console.log('[EntradasService] Saving images to disk if any...');
            // 3. Save to disk
            const savedPaths: any = await this.saveImagesDirectly(entrada.folio, id_detalles, imageFiles);

            console.log('[EntradasService] Finding automatic allocation for Evaluation...');
            let id_ubicacion = data.id_ubicacion;
            let id_sub_ubicacion = data.id_sub_ubicacion;

            // ONLY if it's an equipment (serial exists) and no location was manually set
            // For R3 (Naves), we skip the automatic Evaluation zone allocation
            if (!id_ubicacion && this.prisma.currentSite !== 'r3' && this.prisma.currentSite !== 'r2') {
                const evalZone = await this.db.ubicacion.findFirst({
                    where: { nombre_ubicacion: 'EVALUACIÓN' }
                });
                if (evalZone) {
                    id_ubicacion = evalZone.id_ubicacion;
                    const availableSub = await this.db.sub_ubicaciones.findFirst({
                        where: { id_ubicacion: evalZone.id_ubicacion, ubicacion_ocupada: false },
                        orderBy: { nombre: 'asc' }
                    });
                    if (availableSub) {
                        // id_sub_ubicacion column is VarChar(10) — only assign if it fits
                        if (availableSub.id_sub_ubicacion.length <= 10) {
                            id_sub_ubicacion = availableSub.id_sub_ubicacion;
                            // Mark as occupied
                            await this.db.sub_ubicaciones.update({
                                where: { id_sub_ubicacion: availableSub.id_sub_ubicacion },
                                data: { ubicacion_ocupada: true }
                            });
                            console.log(`[EntradasService] Auto-allocated to ${availableSub.nombre}`);
                        } else {
                            console.warn(`[EntradasService] Sub-location ID "${availableSub.id_sub_ubicacion}" exceeds VarChar(10) limit — skipping auto-allocation`);
                        }
                    }
                }
            }

            console.log('[EntradasService] Creating database record for detail:', id_detalles);

            let assignedIdEquipo = data.id_equipo;

            // 1. Try to resolve by Serial Number (Most Precise)
            if (!assignedIdEquipo && data.serial_equipo && data.serial_equipo !== 'S/N') {
                try {
                    const eqBySerial = await this.db.equipos.findFirst({
                        where: { numero_serie: data.serial_equipo }
                    });
                    if (eqBySerial) {
                        assignedIdEquipo = eqBySerial.id_equipos;
                        console.log(`[EntradasService] Found catalog equipo ${assignedIdEquipo} by serial ${data.serial_equipo}`);
                    }
                } catch (eqErr) {
                    console.error('[EntradasService] Error querying equipo by serial:', eqErr);
                }
            }

            // 2. Logic requested by user: Resolve by Model if we still don't have an ID
            // This acts as a generic join with the master table to pull the id_equipos based on model
            if (!assignedIdEquipo && data.modelo) {
                try {
                    const existingEquipo = await this.db.equipos.findFirst({
                        where: { modelo: data.modelo }
                    });

                    if (existingEquipo) {
                        assignedIdEquipo = existingEquipo.id_equipos;
                        console.log(`[EntradasService] Vinculado automáticamente al equipo ${assignedIdEquipo} por modelo ${data.modelo}`);
                    }
                } catch (eqErr) {
                    console.error('[EntradasService] Error querying equipo by modelo:', eqErr);
                }
            }

            // 3. Crear equipo en la tabla maestra si el modelo ingresado no existe en absoluto
            if (!assignedIdEquipo && (data.modelo || (data.serial_equipo && data.serial_equipo !== 'S/N'))) {
                try {
                    const newEquipoId = uuidv4();
                    await this.db.equipos.create({
                        data: {
                            id_equipos: newEquipoId,
                            numero_serie: null,
                            clase: data.clase || 'Manual',
                            modelo: data.modelo || 'Desconocido',
                            estado: 'Activo',
                            marca: 'Raymond' // Valor por defecto
                        }
                    });
                    assignedIdEquipo = newEquipoId;
                    console.log(`[EntradasService] Nuevo equipo maestro creado: ${assignedIdEquipo} (Modelo: ${data.modelo})`);
                } catch (eqErr) {
                    console.error('[EntradasService] Error creando nuevo equipo en maestro:', eqErr);
                }
            }

            // Validate and parse date safely
            let fechaIngreso = new Date();
            if (data.fecha) {
                const parsedDate = new Date(data.fecha);
                if (!isNaN(parsedDate.getTime())) {
                    fechaIngreso = parsedDate;
                }
            }

            // 4. Explicit mapping to avoid "Unknown Argument" errors
            const result = await this.db.entrada_detalle.create({
                data: {
                    id_detalles,
                    id_entrada,
                    id_equipo: assignedIdEquipo,
                    serial_equipo: data.serial_equipo || 'S/N',
                    id_ubicacion,
                    id_sub_ubicacion,
                    filtro_equipo: data.clase,
                    clase: data.clase,
                    tipo_entrada: data.tipo_entrada || 'Renta',
                    ...(this.prisma.currentSite === 'r1' && {
                        estado: data.estado || 'Recibido – En espera evaluación',
                        calificacion: null,
                        modelo: data.modelo,
                    }),
                    status_totvs: data.status_totvs || '999',
                    cte_origen: data.cte_origen,
                    producto: data.producto,
                    pdf: false,
                    fecha: fechaIngreso,
                    ...savedPaths,
                    comentario_1: data.comentario_1,
                    comentario_2: data.comentario_2,
                },
            });
            console.log('[EntradasService] Detail record created successfully');
            return result;
        } catch (error: any) {
            console.error('[EntradasService] Error in createDetalle:', error.stack || error);
            if (error.code === 'P2003') {
                throw new BadRequestException('Error de integridad: El ID de la entrada o un dato relacionado no existe en la BD.');
            }
            if (error.code === 'P2002') {
                throw new ConflictException('Ya existe un detalle con este ID.');
            }
            throw new InternalServerErrorException(`Error al crear el detalle: ${error.message || 'Error desconocido'}`);
        }
    }

    // Actualizar detalle de entrada
    async updateDetalle(id_detalle: string, data: any) {
        try {
            console.log(`[EntradasService] Updating detalle ${id_detalle}`);
            const updateData = { ...data };

            // 1. Fetch Folio via relationship
            const detalle = await this.db.entrada_detalle.findUnique({
                where: { id_detalles: id_detalle },
                include: { entradas: { select: { folio: true } } }
            });

            if (detalle?.entradas?.folio) {
                const folio = detalle.entradas.folio;
                
                // 2. Process images
                const imageFiles: any = {};
                for (let i = 1; i <= 4; i++) {
                    const field = `evidencia_${i}`;
                    if (typeof data[field] === 'string' && data[field].startsWith('data:image')) {
                        imageFiles[field] = data[field];
                    }
                }

                if (Object.keys(imageFiles).length > 0) {
                    console.log(`[EntradasService] Saving ${Object.keys(imageFiles).length} images for existing detalle ${id_detalle}`);
                    const savedPaths = await this.saveImagesDirectly(folio, id_detalle, imageFiles);
                    Object.assign(updateData, savedPaths);
                }
            }

            // 3. Clean fields not present in R2/R3
            if (this.prisma.currentSite !== 'r1') {
                delete updateData.estado;
                delete updateData.modelo;
                delete updateData.calificacion;
                delete updateData.semanas_renovacion;
                delete updateData.id_entrada; // Don't allow changing entry
            }
            delete updateData.id_detalles; // Don't allow changing ID

            return await this.db.entrada_detalle.update({
                where: { id_detalles: id_detalle },
                data: updateData,
            });
        } catch (error: any) {
            console.error(`[EntradasService] Error updating detalle ${id_detalle}:`, error);
            throw new InternalServerErrorException(`Error Prisma updating detalle: ${error.message}`);
        }
    }

    // Crear accesorio de entrada
    async createAccesorio(id_entrada: string, data: any) {
        console.log('[EntradasService] createAccesorio called for:', id_entrada);
        try {
            const id_accesorio = `ACC-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 1000)}`;

            // 1. Fetch Folio
            const entrada = await this.db.entradas.findUnique({ where: { id_entrada }, select: { folio: true } });
            if (!entrada) {
                console.error(`[EntradasService] Entrada ${id_entrada} not found in DB`);
                throw new BadRequestException(`La entrada con ID ${id_entrada} no existe. No se puede crear el accesorio.`);
            }

            // 2. Process evidence
            const imageFiles: any = {};
            if (typeof data.evidencia === 'string' && data.evidencia.startsWith('data:image')) {
                console.log('[EntradasService] Accessory evidence detected as base64');
                imageFiles.evidencia = data.evidencia;
            } else {
                console.log('[EntradasService] Accessory evidence is NOT base64:', typeof data.evidencia);
            }

            console.log('[EntradasService] Saving accessory images to disk...');
            // 3. Save to disk
            const savedPaths: any = await this.saveImagesDirectly(entrada.folio, id_accesorio, imageFiles);

            let fechaIngreso = new Date();
            if (data.fecha_ingreso) {
                const parsedDate = new Date(data.fecha_ingreso);
                if (!isNaN(parsedDate.getTime())) {
                    fechaIngreso = parsedDate;
                }
            }

            console.log('[EntradasService] Creating database record for accessory:', id_accesorio);
            // 4. Explicit mapping
            const result = await this.db.entrada_accesorios.create({
                data: {
                    id_accesorio,
                    id_entrada,
                    tipo: data.tipo,
                    modelo: data.modelo,
                    serial: data.serial,
                    fecha_ingreso: fechaIngreso,
                    estado: data.estado || (this.prisma.currentSite === 'r1' ? 'Pendiente' : 'En espera'),
                    ...(this.prisma.currentSite === 'r1' && {
                        estado_acc: data.estado_acc || 'Pendiente',
                    }),
                    evidencia: savedPaths.evidencia || (typeof data.evidencia === 'string' && data.evidencia.startsWith('data:image') ? null : data.evidencia),
                },
            });
            console.log('[EntradasService] Accessory record created successfully');
            return result;
        } catch (error: any) {
            console.error('[EntradasService] Error in createAccesorio:', error.stack || error);
            throw new InternalServerErrorException(`Error al crear el accesorio: ${error.message || 'Error desconocido'}`);
        }
    }

    // Actualizar accesorio de entrada
    async updateAccesorio(id_accesorio: string, data: any) {
        console.log(`[EntradasService] Updating accessory ${id_accesorio}`);
        const updateData: any = { ...data };

        // 1. Fetch Folio via relationship
        const acc = await this.db.entrada_accesorios.findUnique({
            where: { id_accesorio },
            include: { entradas: { select: { folio: true } } }
        });

        if (acc?.entradas?.folio) {
            const folio = acc.entradas.folio;

            // 2. Process evidence
            if (typeof data.evidencia === 'string' && data.evidencia.startsWith('data:image')) {
                console.log(`[EntradasService] Saving new evidence for existing accessory ${id_accesorio}`);
                const imageFiles = { evidencia: data.evidencia };
                const savedPaths: any = await this.saveImagesDirectly(folio, id_accesorio, imageFiles);
                if (savedPaths.evidencia) {
                    updateData.evidencia = savedPaths.evidencia;
                }
            }
        }

        if (data.fecha_ultima_carga !== undefined) {
            updateData.fecha_ultima_carga = data.fecha_ultima_carga ? new Date(data.fecha_ultima_carga) : null;
        }

        if (this.prisma.currentSite !== 'r1') {
            delete updateData.estado_acc;
        }

        delete updateData.id_accesorio;
        delete updateData.id_entrada;

        return this.db.entrada_accesorios.update({
            where: { id_accesorio },
            data: updateData,
        });
    }

    async ubicarEquipos(id_entrada: string, usuario: string) {
        console.log(`[EntradasService] ubicarEquipos called for entry: ${id_entrada} by user: ${usuario}`);

        return await this.db.$transaction(async (tx) => {
            // 1. Get entry with details and accessories
            const entrada = await tx.entradas.findUnique({
                where: { id_entrada },
                include: {
                    entrada_detalle: true,
                    entrada_accesorios: true
                }
            });

            if (!entrada) throw new BadRequestException(`Entrada ${id_entrada} no encontrada.`);

            // Generar fecha en zona horaria de México (CST/CDT)
            const now = new Intl.DateTimeFormat('sv-SE', {
                timeZone: 'America/Mexico_City',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
            }).format(new Date());

            // 2. Process Equipment (entrada_detalle)
            console.log(`[EntradasService] Processing ${entrada.entrada_detalle.length} equipment details`);
            for (const detalle of entrada.entrada_detalle) {
                if (!detalle.id_ubicacion || !detalle.id_sub_ubicacion) {
                    console.log(`[EntradasService] WARNING: Skipping equipment ${detalle.serial_equipo} due to missing location`);
                    continue;
                }

                // Identify if it was in EVALUACIÓN to free that sub-location later (if it's changing)
                // Note: We'll fetch the current state from DB just for this check if needed, 
                // but usually id_ubicacion here IS the new one.
                // Actually, 'detalle' here is the record in 'entrada_detalle' which HAS the location it WAS assigned to (EVALUACION).
                // When we 'ubicar', we are moving it to a PERMANENT location.

                // 1. Get current location name to see if it's EVALUACIÓN
                const prevLocation = await tx.ubicacion.findUnique({
                    where: { id_ubicacion: detalle.id_ubicacion },
                    select: { nombre_ubicacion: true }
                });

                // Create or find record in 'equipos' (Master Table)
                let id_equipo_final = detalle.id_equipo;

                if (!id_equipo_final && detalle.serial_equipo) {
                    const existingEquipo = await tx.equipos.findUnique({
                        where: { numero_serie: detalle.serial_equipo }
                    });

                    if (existingEquipo) {
                        id_equipo_final = existingEquipo.id_equipos;
                    } else {
                        // Create new equipment in master table
                        const newEquipoId = uuidv4();
                        await tx.equipos.create({
                            data: {
                                id_equipos: newEquipoId,
                                numero_serie: null,
                                clase: detalle.filtro_equipo || detalle.clase || 'Manual',
                                modelo: detalle.modelo || 'Desconocido',
                                estado: 'Activo',
                                marca: 'Raymond' // Default or based on logic if available
                            }
                        });
                        id_equipo_final = newEquipoId;
                    }
                }

                // Create record in equipo_ubicacion (the permanent home)
                await tx.equipo_ubicacion.create({
                    data: {
                        id_equipo_ubicacion: uuidv4(),
                        id_equipos: id_equipo_final,
                        id_ubicacion: detalle.id_ubicacion,
                        stock: detalle.id_detalles?.substring(0, 25) || '',
                        id_sub_ubicacion: detalle.id_sub_ubicacion,
                        estado: 'Ingresado',
                        fecha_entrada: now,
                        serial_equipo: detalle.serial_equipo,
                        usuario_entrada: this.prisma.currentUser || usuario || 'Sistema'
                    }
                });

                // 2. If it was in EVALUACIÓN, we should free it. 
                // Wait, if id_ubicacion is STILL EVALUACION, we shouldn't free it yet?
                // Usually 'ubicar' means moving to a permanent shelf.
                if (prevLocation?.nombre_ubicacion === 'EVALUACIÓN') {
                    await tx.sub_ubicaciones.update({
                        where: { id_sub_ubicacion: detalle.id_sub_ubicacion },
                        data: { ubicacion_ocupada: false }
                    });
                    console.log(`[EntradasService] Freed EVALUACIÓN sub-location ${detalle.id_sub_ubicacion}`);
                } else {
                    // Mark NEW sub-location as occupied if it's not evaluation
                    await tx.sub_ubicaciones.update({
                        where: { id_sub_ubicacion: detalle.id_sub_ubicacion },
                        data: { ubicacion_ocupada: true }
                    });
                }

                // Update detail status
                if (this.prisma.currentSite === 'r1') {
                    await tx.entrada_detalle.update({
                        where: { id_detalles: detalle.id_detalles },
                        data: { estado: 'Ingresado' }
                    });
                }
            }

            // 3. Process Accessories (entrada_accesorios)
            console.log(`[EntradasService] Processing ${entrada.entrada_accesorios.length} accessories`);
            for (const acc of entrada.entrada_accesorios) {
                if (!acc.ubicacion || !acc.sub_ubicacion) {
                    console.log(`[EntradasService] WARNING: Skipping accessory ${acc.tipo} due to missing location`);
                    continue;
                }

                // Accessory locations are not marked as occupied (allows multiple items)
                // Removed: tx.sub_ubicaciones.update({ ... ubicacion_ocupada: true })

                // Update accessory status using updateMany due to composite key
                await tx.entrada_accesorios.updateMany({
                    where: {
                        id_accesorio: acc.id_accesorio,
                        id_entrada: acc.id_entrada
                    },
                    data: {
                        estado: 'Ingresado',
                        ...(this.prisma.currentSite === 'r1' && { estado_acc: 'Ingresado' })
                    }
                });
            }

            // 4. Update Entry Status/Priority
            console.log(`[EntradasService] Finalizing entry status update`);
            return await tx.entradas.update({
                where: { id_entrada },
                data: {
                    prioridad: 'Cerrado',
                    estado: 'Cerrado'
                }
            });
        }, {
            timeout: 10000 // Increase timeout to 10s for remote DB latency
        });
    }

    // Sistema de Entradas Rápidas
    async createRapida(data: any) {
        console.log('[EntradasService] createRapida called with', data);
        return this.db.$transaction(async (tx) => {
            // --- Resolver ubicación: primero por ID, luego por nombre ---
            let id_ubicacion_final: string | null = null;
            if (data.ubicacion) {
                const byId = await tx.ubicacion.findUnique({
                    where: { id_ubicacion: data.ubicacion },
                    select: { id_ubicacion: true }
                });
                if (byId) {
                    id_ubicacion_final = byId.id_ubicacion;
                } else {
                    // Intentar por nombre
                    const byName = await tx.ubicacion.findFirst({
                        where: { nombre_ubicacion: { contains: data.ubicacion } },
                        select: { id_ubicacion: true }
                    });
                    if (byName) {
                        id_ubicacion_final = byName.id_ubicacion;
                        console.log(`[createRapida] Ubicación resuelta por nombre: "${data.ubicacion}" → ${id_ubicacion_final}`);
                    } else {
                        throw new BadRequestException(`Ubicación "${data.ubicacion}" no encontrada (ni por ID ni por nombre).`);
                    }
                }
            } else {
                throw new BadRequestException('La ubicación es requerida.');
            }

            // --- Buscar si ya existe una entrada con ese folio ---
            let entrada = await tx.entradas.findFirst({
                where: { folio: data.folio }
            });

            let id_entrada: string;

            if (entrada) {
                id_entrada = entrada.id_entrada;
                console.log(`[createRapida] Reutilizando entrada existente con folio: ${data.folio} (ID: ${id_entrada})`);
            } else {
                id_entrada = `ENT-RAPIDA-${Date.now()}`;

                // --- Resolver cliente: buscar por nombre, guardar id_cliente ---
                let id_cliente: string | null = null;
                if (data.cliente) {
                    const found = await tx.cliente.findFirst({
                        where: {
                            nombre_cliente: {
                                contains: data.cliente,
                            }
                        },
                        select: { id_cliente: true }
                    });
                    if (found) {
                        id_cliente = found.id_cliente;
                        console.log(`[createRapida] Cliente resuelto: "${data.cliente}" → ${id_cliente}`);
                    } else {
                        console.warn(`[createRapida] Cliente "${data.cliente}" no encontrado en BD. Se dejará null.`);
                    }
                }

                // 1. Crear Entrada
                await tx.entradas.create({
                    data: {
                        id_entrada,
                        folio: data.folio,
                        fecha_creacion: data.fecha ? new Date(data.fecha) : new Date(),
                        cliente: id_cliente,
                        estado: 'Cerrado',
                        prioridad: 'Cerrado',
                        usuario_asignado: this.prisma.currentUser || 'Sistema',
                        usuario_encargado: this.prisma.currentUser || 'Sistema',
                        comentario_1: `Entrada rápida automática${data.cliente && !id_cliente ? ` (cliente "${data.cliente}" no encontrado)` : ''}`
                    }
                });
            }

            if (data.tipo === 'equipo') {
                let id_equipo_final: string | null = null;

                // Paso 1: buscar por número de serie exacto
                if (data.numero_serie && data.numero_serie !== 'S/N') {
                    const eqBySerial = await tx.equipos.findUnique({
                        where: { numero_serie: data.numero_serie }
                    });
                    if (eqBySerial) {
                        id_equipo_final = eqBySerial.id_equipos;
                        console.log(`[createRapida] Equipo encontrado por serie: ${id_equipo_final}`);
                    }
                }

                // Paso 2: buscar en catálogo por modelo (si no se encontró por serie)
                if (!id_equipo_final && data.modelo) {
                    const eqByModelo = await tx.equipos.findFirst({
                        where: { modelo: { contains: data.modelo } },
                        orderBy: { estado: 'asc' }
                    });
                    if (eqByModelo) {
                        id_equipo_final = eqByModelo.id_equipos;
                        console.log(`[createRapida] Equipo encontrado por modelo "${data.modelo}": ${id_equipo_final}`);
                    }
                }

                // Paso 3: crear nuevo equipo si no existe en catálogo
                if (!id_equipo_final) {
                    id_equipo_final = uuidv4();
                    await tx.equipos.create({
                        data: {
                            id_equipos: id_equipo_final,
                            numero_serie: data.numero_serie && data.numero_serie !== 'S/N' ? data.numero_serie : null,
                            clase: data.clase || 'Manual',
                            modelo: data.modelo || 'Desconocido',
                            marca: data.marca || 'Desconocida',
                            estado: 'Activo'
                        }
                    });
                    console.log(`[createRapida] Nuevo equipo creado: ${id_equipo_final} (${data.modelo})`);
                }

                // Auto-resolve sub_ubicacion: primera disponible en la ubicación resuelta
                let id_sub_ubicacion: string | null = data.sub_ubicacion || null;
                if (!id_sub_ubicacion && id_ubicacion_final) {
                    const availableSub = await tx.sub_ubicaciones.findFirst({
                        where: { id_ubicacion: id_ubicacion_final, ubicacion_ocupada: false },
                        orderBy: { nombre: 'asc' }
                    });
                    if (availableSub) {
                        id_sub_ubicacion = availableSub.id_sub_ubicacion;
                        await tx.sub_ubicaciones.update({
                            where: { id_sub_ubicacion: availableSub.id_sub_ubicacion },
                            data: { ubicacion_ocupada: true }
                        });
                        console.log(`[createRapida] Sub-ubicación auto-asignada: ${availableSub.nombre}`);
                    } else {
                        console.warn(`[createRapida] Sin sub-ubicaciones disponibles en ${id_ubicacion_final}`);
                    }
                }

                const id_detalles = `DET-RAP-${Date.now()}`;
                await tx.entrada_detalle.create({
                    data: {
                        id_detalles,
                        id_entrada,
                        id_equipo: id_equipo_final,
                        serial_equipo: data.numero_serie || 'S/N',
                        id_ubicacion: id_ubicacion_final,
                        id_sub_ubicacion,
                        clase: data.clase,
                        modelo: data.modelo,
                        tipo_entrada: 'Renta',
                        estado: 'Ingresado',
                        status_totvs: '999',
                        cte_origen: data.cte_origen,
                        producto: data.producto,
                        pdf: false,
                        fecha: data.fecha ? new Date(data.fecha) : new Date()
                    }
                });

                const fechaMx = new Intl.DateTimeFormat('sv-SE', {
                    timeZone: 'America/Mexico_City',
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                }).format(new Date());

                await tx.equipo_ubicacion.create({
                    data: {
                        id_equipo_ubicacion: uuidv4(),
                        id_equipos: id_equipo_final,
                        id_ubicacion: id_ubicacion_final,
                        id_sub_ubicacion,
                        stock: id_detalles.substring(0, 25),
                        estado: 'Ingresado',
                        fecha_entrada: fechaMx,
                        serial_equipo: data.numero_serie || 'S/N',
                        usuario_entrada: this.prisma.currentUser || 'Sistema'
                    }
                });

            } else {
                // Accesorios comparten sub-ubicación — tomar la primera sin bloquearla
                let id_sub_acc: string | null = data.sub_ubicacion || null;
                if (!id_sub_acc && id_ubicacion_final) {
                    const anySub = await tx.sub_ubicaciones.findFirst({
                        where: { id_ubicacion: id_ubicacion_final },
                        orderBy: { nombre: 'asc' }
                    });
                    if (anySub) id_sub_acc = anySub.id_sub_ubicacion;
                }

                const id_accesorio = `ACC-RAP-${Date.now()}`;
                await tx.entrada_accesorios.create({
                    data: {
                        id_accesorio,
                        id_entrada,
                        tipo: data.clase || 'Accesorio',
                        modelo: data.modelo,
                        serial: data.numero_serie,
                        fecha_ingreso: data.fecha ? new Date(data.fecha) : new Date(),
                        estado: 'Ingresado',
                        estado_acc: 'Ingresado',
                        ubicacion: id_ubicacion_final,
                        sub_ubicacion: id_sub_acc
                    }
                });
            }

            return { success: true, id_entrada };
        });
    }

    // Obtener el último folio generado (Formato E-n)
    async getLastFolio() {
        const lastEntrada = await this.db.entradas.findFirst({
            where: {
                folio: {
                    startsWith: 'E-',
                },
            },
            orderBy: {
                fecha_creacion: 'desc',
            },
        });

        if (!lastEntrada) return 'E-1';

        const lastFolio = lastEntrada.folio;
        const lastNumber = parseInt(lastFolio.replace('E-', ''), 10);

        if (isNaN(lastNumber)) {
            // If the last one wasn't a number, find any with number
            const allFolios = await this.db.entradas.findMany({
                where: { folio: { startsWith: 'E-' } },
                select: { folio: true }
            });
            const numbers = allFolios
                .map(e => parseInt(e.folio.replace('E-', ''), 10))
                .filter(n => !isNaN(n));
            const max = numbers.length > 0 ? Math.max(...numbers) : 0;
            return `E-${max + 1}`;
        }

        return `E-${lastNumber + 1}`;
    }
}
