import { PrismaClient as PrismaR1 } from '@prisma/client-taller-r1';
import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { IsString, IsBoolean, IsOptional, IsEnum, IsNumber, IsNotEmpty, IsIn } from 'class-validator';

export class CreateSalidaDto {
    @IsBoolean()
    tiene_remision: boolean;

    @IsString()
    @IsOptional()
    numero_remision?: string;

    @IsString()
    @IsOptional()
    numero_transporte?: string;

    @IsString()
    @IsOptional()
    pedido_venta?: string;

    @IsString()
    @IsOptional()
    cliente?: string;

    @IsIn(['Equipos', 'Accesorios'])
    tipo_elemento: 'Equipos' | 'Accesorios';

    @IsString()
    @IsOptional()
    observaciones?: string;

    @IsString()
    @IsOptional()
    evidencia?: string;

    @IsString()
    @IsOptional()
    razon_social?: string;

    @IsString()
    @IsOptional()
    direccion_cliente?: string;

    @IsString()
    @IsOptional()
    rfc?: string;

    @IsString()
    @IsOptional()
    contacto?: string;

    @IsString()
    @IsOptional()
    telefono?: string;

    @IsString()
    @IsOptional()
    destino?: string;

    @IsString()
    @IsOptional()
    tipo_documento?: string;

    @IsString()
    @IsOptional()
    firma?: string;

    @IsString()
    @IsOptional()
    firma_usuario?: string;

    @IsString()
    @IsOptional()
    nombre_recibe?: string;
}

export class UpdateSalidaDto {
    @IsOptional()
    fecha_transporte?: Date;

    @IsString()
    @IsOptional()
    numero_transporte?: string;

    @IsString()
    @IsOptional()
    estado?: string;

    @IsString()
    @IsOptional()
    cliente?: string;

    @IsString()
    @IsOptional()
    firma?: string;

    @IsString()
    @IsOptional()
    evidencia?: string;

    @IsString()
    @IsOptional()
    usuario_asignado?: string;

    @IsString()
    @IsOptional()
    firma_usuario?: string;

    @IsString()
    @IsOptional()
    comentario?: string;

    @IsString()
    @IsOptional()
    nombre_recibe?: string;

    @IsString()
    @IsOptional()
    elemento?: string;

    @IsString()
    @IsOptional()
    carta_instruccion?: string;

    @IsString()
    @IsOptional()
    pedido?: string;

    @IsString()
    @IsOptional()
    razon_social?: string;

    @IsString()
    @IsOptional()
    direccion_cliente?: string;

    @IsString()
    @IsOptional()
    rfc?: string;

    @IsString()
    @IsOptional()
    contacto?: string;

    @IsString()
    @IsOptional()
    telefono?: string;

    @IsString()
    @IsOptional()
    remision?: string;

    @IsString()
    @IsOptional()
    adc?: string;

    @IsString()
    @IsOptional()
    oc?: string;

    @IsString()
    @IsOptional()
    observaciones?: string;

    @IsNumber()
    @IsOptional()
    remision_confirmacion?: number;

    @IsString()
    @IsOptional()
    destino?: string;

    @IsString()
    @IsOptional()
    tipo_documento?: string;
}

export class CreateDetalleDto {
    @IsString()
    id_equipo: string;

    @IsString()
    @IsOptional()
    id_equipo_ubicacion?: string;

    @IsIn(['Renta', 'Venta', 'Embarque', 'RENTA', 'VENTA', 'MANIOBRA', 'DEMO', 'SCRAP', 'EMBARQUE', 'Maniobra', 'Demo', 'Scrap'])
    tipo_salida: string;

    @IsString()
    @IsOptional()
    serial_equipos?: string;

    @IsString()
    @IsOptional()
    id_ubicacion?: string;

    @IsString()
    @IsOptional()
    id_sub_ubicacion?: string;

    @IsString()
    @IsOptional()
    aditamentos?: string;

    @IsString()
    @IsOptional()
    foto_llave?: string;

    @IsString()
    @IsOptional()
    foto_kit_tapon?: string;

    @IsString()
    @IsOptional()
    foto_compartimento_baterias?: string;

    @IsString()
    @IsOptional()
    foto_lineas_vida?: string;

    @IsString()
    @IsOptional()
    foto_compartimento_operador?: string;

    @IsString()
    @IsOptional()
    foto_pernos_horquillas?: string;

    @IsString()
    @IsOptional()
    foto_clamp_opc?: string;

    @IsString()
    @IsOptional()
    foto_frente_equipo?: string;

    @IsString()
    @IsOptional()
    foto_posterior_equipo?: string;

    @IsString()
    @IsOptional()
    foto_kit_aceite?: string;

    @IsOptional()
    checklist_entrega?: any;
}

export class CreateAccesorioDto {
    @IsString()
    id_accesorio: string;

    @IsString()
    @IsOptional()
    modelo?: string;

    @IsString()
    @IsOptional()
    serial?: string;

    @IsNumber()
    @IsOptional()
    voltaje?: number;

    @IsString()
    @IsOptional()
    aditamentos?: string;
}

import { PrismaDynamicService } from '../../database/prisma-dynamic.service';
import { StorageService } from './storage.service';

@Injectable()
export class SalidasService {
    constructor(
        private prisma: PrismaDynamicService,
        private storageService: StorageService
    ) { }

    private get db(): PrismaR1 {
        return this.prisma.client;
    }

    // Generate next folio with S- prefix
    async generateFolio(): Promise<string> {
        const lastSalida = await this.db.salidas.findFirst({
            orderBy: { fecha_creacion: 'desc' },
            select: { folio: true }
        });

        if (!lastSalida || !lastSalida.folio) {
            return 'S-001';
        }

        const match = lastSalida.folio.match(/S-(\d+)/);
        if (!match) {
            return 'S-001';
        }

        const nextNumber = parseInt(match[1], 10) + 1;
        return `S-${String(nextNumber).padStart(3, '0')}`;
    }

    private async saveImagesDirectly(folio: string, subFolder: string, files: { [key: string]: string }) {
        const result: { [key: string]: string } = {};
        const site = this.prisma.currentSite?.toUpperCase() || 'R1';
        const folderPath = `${site}/Salidas/${folio}/${subFolder}`;

        for (const [key, base64] of Object.entries(files)) {
            if (base64 && base64.startsWith('data:image')) {
                try {
                    const url = await this.storageService.uploadBase64Image(base64, folderPath, key);
                    if (url) {
                        result[key] = url;
                    }
                } catch (error: any) {
                    console.error(`[SalidasService] Error saving image ${key} to storage:`, error.message);
                }
            }
        }
        return result;
    }

    // Obtener todas las salidas con detalles
    async findAll(estado?: string) {
        try {
            const where = estado ? { estado } : {};
            return await this.db.salidas.findMany({
                where,
                orderBy: { fecha_creacion: 'desc' },
            });
        } catch (error) {
            console.error('[SalidasService] Error in findAll:', error);
            throw error;
        }
    }

    async cancelarDetalle(id_salida: string, id_detalle: string, id_ubicacion_nueva: string, id_sub_ubicacion_nueva: string, usuario: string) {
        const detalle = await this.db.salida_detalle.findUnique({ where: { id_detalle } });
        if (!detalle) throw new NotFoundException(`Detalle ${id_detalle} no encontrado`);
        if (detalle.id_salida !== id_salida) throw new BadRequestException('El detalle no pertenece a la salida especificada');

        const salida = await this.db.salidas.findUnique({ where: { id_salida } });
        if (!salida || salida.estado !== 'Entregado') throw new BadRequestException('Solo se pueden cancelar equipos de salidas cerradas');

        const equipoUbicacionId = detalle.id_equipo_ubicacion;
        const equipoId = detalle.id_equipo;

        if (equipoUbicacionId) {
            // Free the old sub-location before moving to the new one
            const oldRecord = await this.db.equipo_ubicacion.findUnique({
                where: { id_equipo_ubicacion: equipoUbicacionId },
                select: { id_sub_ubicacion: true }
            });

            if (oldRecord?.id_sub_ubicacion) {
                await this.db.sub_ubicaciones.update({
                    where: { id_sub_ubicacion: oldRecord.id_sub_ubicacion },
                    data: { ubicacion_ocupada: false }
                });
            }

            await this.db.equipo_ubicacion.update({
                where: { id_equipo_ubicacion: equipoUbicacionId },
                data: {
                    estado: 'Ingresado',
                    fecha_salida: null,
                    usuario_salida: null,
                    id_ubicacion: id_ubicacion_nueva,
                    id_sub_ubicacion: id_sub_ubicacion_nueva,
                }
            });
        }

        if (id_sub_ubicacion_nueva) {
             await this.db.sub_ubicaciones.update({
                 where: { id_sub_ubicacion: id_sub_ubicacion_nueva },
                 data: { ubicacion_ocupada: true }
             });
        }

        if (detalle.serial_equipos && this.prisma.currentSite === 'r1') {
            await this.db.entrada_detalle.updateMany({
                where: { serial_equipo: detalle.serial_equipos, estado: 'Retirado' },
                data: { estado: 'Ingresado' }
            });
        }

        await this.db.logs_cancelacion_equipos.create({
            data: {
                id_detalle,
                id_salida,
                id_equipo: equipoId || '',
                usuario: usuario || this.prisma.currentUser?.substring(0, 50) || 'Sistema',
                id_ubicacion_nueva,
                id_sub_ubicacion_nueva
            }
        });

        await this.db.salida_detalle.delete({ where: { id_detalle } });

        return { success: true, message: 'Equipo cancelado y devuelto a inventario' };
    }

    // Obtener una salida por ID con todos los detalles
    async findOne(id: string) {
        const salida = await this.db.salidas.findUnique({
            where: { id_salida: id },
        });

        if (!salida) {
            throw new NotFoundException(`Salida ${id} no encontrada`);
        }

        // Fetch client name if not already in salida record
        let clientName = salida.razon_social;
        if (!clientName && salida.cliente) {
            const client = await this.db.cliente.findUnique({
                where: { id_cliente: salida.cliente },
                select: { razon_social: true, nombre_cliente: true }
            });
            clientName = client?.razon_social || client?.nombre_cliente || salida.cliente;
        }

        const detallesRaw = await this.db.salida_detalle.findMany({
            where: { id_salida: id },
        });

        const accesoriosRaw = await this.db.salida_accesorios.findMany({
            where: {
                id_detalle: {
                    in: detallesRaw.map(d => d.id_detalle)
                }
            },
        });

        // Fetch all location names at once for performance
        const ubicacionIds = [...new Set([
            ...detallesRaw.map(d => d.id_ubicacion).filter(Boolean),
            // Accessories don't have location directly in salida_accesorios schema but might be needed if structure changes
        ] as string[])];

        const subUbicacionIds = [...new Set([
            ...detallesRaw.map(d => d.id_sub_ubicacion).filter(Boolean),
        ] as string[])];

        const equipoIds = [...new Set([
            ...detallesRaw.map(d => d.id_equipo).filter(Boolean),
        ] as string[])];

        const serials = detallesRaw.map(d => d.serial_equipos).filter(Boolean) as string[];

        const [ubicaciones, subUbicaciones, equiposInfo, brandInfo] = await Promise.all([
            this.db.ubicacion.findMany({
                where: { id_ubicacion: { in: ubicacionIds } },
                select: { id_ubicacion: true, nombre_ubicacion: true }
            }),
            this.db.sub_ubicaciones.findMany({
                where: { id_sub_ubicacion: { in: subUbicacionIds } },
                select: { id_sub_ubicacion: true, nombre: true }
            }),
            this.db.equipos.findMany({
                where: { id_equipos: { in: equipoIds } },
                select: { id_equipos: true, clase: true, modelo: true }
            }),
            this.db.cargueMasivo.findMany({
                where: { SERIE: { in: serials } }
            })
        ]);

        const ubicacionMap = new Map(ubicaciones.map(u => [u.id_ubicacion, u.nombre_ubicacion]));
        const subUbicacionMap = new Map(subUbicaciones.map(s => [s.id_sub_ubicacion, s.nombre]));
        const equipoMap = new Map(equiposInfo.map(e => [e.id_equipos, { clase: e.clase, modelo: e.modelo }]));
        const brandMap = new Map(brandInfo.map(b => [b.SERIE, b]));

        const detalles = detallesRaw.map(d => {
            const eqInfo = d.id_equipo ? equipoMap.get(d.id_equipo) : null;
            return {
                ...d,
                nombre_ubicacion: (d.id_ubicacion && ubicacionMap.get(d.id_ubicacion)) || d.id_ubicacion,
                nombre_sub_ubicacion: (d.id_sub_ubicacion && subUbicacionMap.get(d.id_sub_ubicacion)) || d.id_sub_ubicacion,
                filtro_clase: d.filtro_clase || eqInfo?.clase || null,
                filtro_modelo: d.filtro_modelo || eqInfo?.modelo || null,
                clase: d.filtro_clase || eqInfo?.clase || null,
                modelo: d.filtro_modelo || eqInfo?.modelo || null,
                rel_serie_info: (d.serial_equipos && brandMap.get(d.serial_equipos)) || null
            };
        });

        // Enrich accessories with location info from their parent detail
        const accesorios = accesoriosRaw.map(acc => {
            const parentDetail = detalles.find(d => d.id_detalle === acc.id_detalle);
            return {
                ...acc,
                nombre_ubicacion: parentDetail?.nombre_ubicacion || '-',
                nombre_sub_ubicacion: parentDetail?.nombre_sub_ubicacion || '-'
            };
        });

        return {
            ...salida,
            razon_social: clientName,
            detalles,
            accesorios
        };
    }

    // Crear una nueva salida
    async create(data: CreateSalidaDto) {
        console.log('[SalidasService] Entering create with data keys:', Object.keys(data));
        try {
            const id_salida = uuidv4();
            const folio = await this.generateFolio();
            const fecha_creacion = new Date();
            const fecha_transporte = new Date();

            // 1. Extract and save images if they are base64 (evidencia, firma, firma_usuario)
            const imageFiles: any = {};
            const photoFields = ['evidencia', 'firma', 'firma_usuario'];

            photoFields.forEach(field => {
                if (data[field]?.startsWith('data:image')) {
                    imageFiles[field] = data[field];
                }
            });

            let savedPaths = {};
            if (Object.keys(imageFiles).length > 0) {
                console.log('[SalidasService] Saving files to disk for header. Keys:', Object.keys(imageFiles));
                savedPaths = await this.saveImagesDirectly(folio, 'header', imageFiles);
                console.log('[SalidasService] Saved paths result:', JSON.stringify(savedPaths));
            }

            // 2. Clean base64 from data
            const cleanData = { ...data };
            photoFields.forEach(field => {
                if (cleanData[field]?.startsWith('data:image')) delete cleanData[field];
            });

            // Determine initial status
            const estado = data.tiene_remision ? 'Por Entregar' : 'En espera de remisión';

            return await this.db.salidas.create({
                data: {
                    id_salida,
                    folio,
                    fecha_creacion,
                    fecha_transporte,
                    estado,
                    numero_transporte: data.numero_transporte,
                    pedido: data.pedido_venta,
                    cliente: data.cliente,
                    elemento: data.tipo_elemento,
                    observaciones: data.observaciones,
                    ...savedPaths,
                    remision: data.numero_remision,
                    remision_confirmacion: data.tiene_remision ? 1 : 0,
                    razon_social: data.razon_social,
                    direccion_cliente: data.direccion_cliente,
                    rfc: data.rfc,
                    contacto: data.contacto,
                    telefono: data.telefono,
                    destino: data.destino,
                    tipo_documento: data.tipo_documento,
                    nombre_recibe: data.nombre_recibe,
                    usuario_asignado: this.prisma.currentUser?.substring(0, 100),
                },
            });
        } catch (error: any) {
            console.error('[SalidasService] Error in create:', error.message);
            throw error;
        }
    }

    // Agregar equipo a la salida
    async createDetalle(id_salida: string, data: CreateDetalleDto) {
        console.log('[createDetalle] id_salida:', id_salida);
        console.log('[createDetalle] data keys:', Object.keys(data));

        const salida = await this.db.salidas.findUnique({
            where: { id_salida },
            select: { folio: true }
        });

        if (!salida) {
            throw new NotFoundException(`Salida ${id_salida} no encontrada`);
        }

        const id_detalle = uuidv4();

        try {
            // Validation: Ensure equipment is NOT in "Renovación"
            if (data.id_equipo_ubicacion) {
                const equipoUbicacion = await this.db.equipo_ubicacion.findUnique({
                    where: { id_equipo_ubicacion: data.id_equipo_ubicacion }
                });

                if (this.prisma.currentSite === 'r1' && equipoUbicacion?.estado === 'Renovación') {
                    throw new BadRequestException('El equipo seleccionado se encuentra en proceso de Renovación y no se puede dar salida');
                }
                
                if (equipoUbicacion?.estado === 'Retirado') {
                    throw new BadRequestException('El equipo seleccionado ya se encuentra Retirado y no se puede dar salida');
                }
            }

            // Validar que el equipo no esté ya en una salida activa
            if (data.serial_equipos) {
                const activeSalidas = await this.db.salidas.findMany({
                    where: { estado: { not: 'Entregado' } },
                    select: { id_salida: true, folio: true }
                });
                
                if (activeSalidas.length > 0) {
                     const activeSalidaIds = activeSalidas.map(s => s.id_salida);
                     const existingDetalle = await this.db.salida_detalle.findFirst({
                         where: {
                             id_salida: { in: activeSalidaIds },
                             serial_equipos: data.serial_equipos
                         }
                     });
                     
                     if (existingDetalle) {
                          const associatedSalida = activeSalidas.find(s => s.id_salida === existingDetalle.id_salida);
                          throw new BadRequestException(`El equipo con serial ${data.serial_equipos} ya se encuentra asignado a la salida en proceso ${associatedSalida?.folio}`);
                     }
                }
            }
            // 1. Extract and save all photos if they are base64
            const imageFiles: any = {};
            const photoFields = [
                'foto_llave', 'foto_kit_tapon', 'foto_compartimento_baterias',
                'foto_lineas_vida', 'foto_compartimento_operador', 'foto_pernos_horquillas',
                'foto_clamp_opc', 'foto_frente_equipo', 'foto_posterior_equipo', 'foto_kit_aceite'
            ];

            photoFields.forEach(field => {
                if (data[field]?.startsWith('data:image')) {
                    imageFiles[field] = data[field];
                }
            });

            let savedPaths = {};
            if (Object.keys(imageFiles).length > 0) {
                console.log('[SalidasService] Saving files to disk for detail. Keys:', Object.keys(imageFiles));
                savedPaths = await this.saveImagesDirectly(salida.folio, id_detalle, imageFiles);
                console.log('[SalidasService] Saved paths result for detail:', JSON.stringify(savedPaths));
            }

            // 2. Clean base64 from data
            const cleanData = { ...data } as any;
            photoFields.forEach(field => {
                if (cleanData[field]?.startsWith('data:image')) delete cleanData[field];
            });

            const detalleData: any = {
                id_detalle,
                id_salida,
                id_equipo: data.id_equipo,
                id_equipo_ubicacion: data.id_equipo_ubicacion,
                tipo_salida: data.tipo_salida,
                serial_equipos: data.serial_equipos,
                id_ubicacion: data.id_ubicacion,
                id_sub_ubicacion: data.id_sub_ubicacion || 'N/A', // naves.prisma requires id_sub_ubicacion
                aditamentos: data.aditamentos,
                cantidad_salida: 1,
            };

            // Only add photo paths and checklist in R1 since they don't exist in other databases yet
            if (this.prisma.currentSite === 'r1') {
                Object.assign(detalleData, savedPaths);
                detalleData.checklist_entrega = data.checklist_entrega;
            }

            const newDetalle = await this.db.salida_detalle.create({
                data: detalleData,
            });

            if (data.id_equipo) {
                await this.db.logs_salida_movimientos.create({
                    data: {
                        id_equipo: data.id_equipo,
                        serial: data.serial_equipos || null,
                        folio: salida.folio,
                        usuario: this.prisma.currentUser?.substring(0, 100) || 'Sistema',
                        accion: 'AGREGAR',
                    }
                });
            }

            return newDetalle;
        } catch (err: any) {
            console.error('[createDetalle] Error:', err?.message);
            throw err;
        }
    }

    // Agregar accesorio a la salida
    async createAccesorio(id_salida: string, data: CreateAccesorioDto) {
        // First, get a detalle from this salida to link the accessory
        const detalles = await this.db.salida_detalle.findMany({
            where: { id_salida },
            take: 1
        });

        let id_detalle: string;

        if (detalles.length === 0) {
            // Create a dummy detalle for accessories
            const newDetalle = await this.db.salida_detalle.create({
                data: {
                    id_detalle: uuidv4(),
                    id_salida,
                    cantidad_salida: 0,
                    id_sub_ubicacion: 'N/A', // naves.prisma requires id_sub_ubicacion
                }
            });
            id_detalle = newDetalle.id_detalle;
        } else {
            id_detalle = detalles[0].id_detalle;
        }

        const id_accesorio_salida = uuidv4();

        return this.db.salida_accesorios.create({
            data: {
                id_accesorio: id_accesorio_salida,
                accesorio_id: data.id_accesorio,
                id_detalle,
                modelo: data.modelo,
                serial: data.serial,
                voltaje: data.voltaje,
                aditamentos: data.aditamentos,
            },
        });
    }

    // Get available equipment (estado = Ingresado and not in active Salida)
    async getAvailableEquipos() {
        // Find active Salidas
        const activeSalidas = await this.db.salidas.findMany({
            where: { estado: { not: 'Entregado' } },
            select: { id_salida: true }
        });
        const activeSalidaIds = activeSalidas.map(s => s.id_salida);

        // Find equipment currently in active Salidas
        const activeDetalles = await this.db.salida_detalle.findMany({
            where: { id_salida: { in: activeSalidaIds } },
            select: { id_equipo_ubicacion: true, serial_equipos: true }
        });
        const excludedUbicacionIds = activeDetalles.map(d => d.id_equipo_ubicacion).filter(Boolean) as string[];
        const excludedSerials = activeDetalles.map(d => d.serial_equipos).filter(Boolean) as string[];

        const equipos_ubicacion = await this.db.equipo_ubicacion.findMany({
            where: {
                estado: {
                    in: ['Ingresado', 'INGRESADO', 'Ubicado', 'Ingresados', 'INGRESADOS', 'Ubicados']
                },
                id_equipo_ubicacion: excludedUbicacionIds.length > 0 ? { notIn: excludedUbicacionIds } : undefined,
                serial_equipo: excludedSerials.length > 0 ? { notIn: excludedSerials } : undefined
            },
            orderBy: { fecha_entrada: 'desc' }
        });

        if (equipos_ubicacion.length === 0) return [];

        // Batch IDs to avoid O(N) queries
        const equipoIds = [...new Set(equipos_ubicacion.map(e => e.id_equipos).filter(Boolean) as string[])];
        const ubicacionIds = [...new Set(equipos_ubicacion.map(e => e.id_ubicacion).filter(Boolean) as string[])];
        const subUbicacionIds = [...new Set(equipos_ubicacion.map(e => e.id_sub_ubicacion).filter(Boolean) as string[])];

        // Fetch all related info at once
        const [equiposInfo, ubicacionesInfo, subUbicacionesInfo] = await Promise.all([
            this.db.equipos.findMany({
                where: { id_equipos: { in: equipoIds } },
                select: { id_equipos: true, modelo: true, clase: true }
            }),
            this.db.ubicacion.findMany({
                where: { id_ubicacion: { in: ubicacionIds } },
                select: { id_ubicacion: true, nombre_ubicacion: true }
            }),
            this.db.sub_ubicaciones.findMany({
                where: { id_sub_ubicacion: { in: subUbicacionIds } },
                select: { id_sub_ubicacion: true, nombre: true }
            })
        ]);

        // Maps for O(1) lookups
        const equipoMap = new Map(equiposInfo.map(e => [e.id_equipos, { modelo: e.modelo, clase: e.clase }]));
        const ubicacionMap = new Map(ubicacionesInfo.map(u => [u.id_ubicacion, u.nombre_ubicacion]));
        const subUbicacionMap = new Map(subUbicacionesInfo.map(s => [s.id_sub_ubicacion, s.nombre]));

        return equipos_ubicacion.map(e => {
            const uName = (e.id_ubicacion && ubicacionMap.get(e.id_ubicacion)) || e.id_ubicacion || 'ALMACÉN';
            const sName = (e.id_sub_ubicacion && subUbicacionMap.get(e.id_sub_ubicacion)) || e.id_sub_ubicacion || '';
            const fullLocation = sName ? `${uName} - ${sName}` : uName;

            const eqInfo = equipoMap.get(e.id_equipos || '');
            
            return {
                id_detalles: e.id_equipos,
                id_equipo_ubicacion: e.id_equipo_ubicacion,
                serial_equipo: e.serial_equipo,
                id_ubicacion: e.id_ubicacion,
                nombre_ubicacion: fullLocation,
                id_sub_ubicacion: e.id_sub_ubicacion,
                estado: e.estado,
                modelo: eqInfo?.modelo || 'S/M',
                clase: eqInfo?.clase || 'S/C'
            };
        });
    }

    // Get available accessories (estado_acc = Ingresado and not in active Salida)
    async getAvailableAccesorios() {
        const activeSalidas = await this.db.salidas.findMany({
            where: { estado: { not: 'Entregado' } },
            select: { id_salida: true }
        });
        const activeSalidaIds = activeSalidas.map(s => s.id_salida);

        const activeDetalles = await this.db.salida_detalle.findMany({
            where: { id_salida: { in: activeSalidaIds } },
            select: { id_detalle: true }
        });
        const activeDetalleIds = activeDetalles.map(d => d.id_detalle);

        const activeAccesorios = await this.db.salida_accesorios.findMany({
            where: { id_detalle: { in: activeDetalleIds } },
            select: { accesorio_id: true, serial: true }
        });
        const excludedAccesorioIds = activeAccesorios.map(a => a.accesorio_id).filter(Boolean) as string[];
        const excludedSerials = activeAccesorios.map(a => a.serial).filter(Boolean) as string[];

        const accesorios = await this.db.entrada_accesorios.findMany({
            where: {
                OR: this.prisma.currentSite === 'r1'
                    ? [
                        { estado_acc: 'Ingresado' },
                        { estado: 'Ingresado' },
                        { estado_acc: 'Ubicado' },
                        { estado: 'Ubicado' }
                    ]
                    : [
                        { estado: 'Ingresado' },
                        { estado: 'Ubicado' },
                        { estado: 'INGRESADO' },
                        { estado: 'UBICADO' }
                    ],
                id_accesorio: excludedAccesorioIds.length > 0 ? { notIn: excludedAccesorioIds } : undefined,
                serial: excludedSerials.length > 0 ? { notIn: excludedSerials } : undefined
            },
            orderBy: { fecha_ingreso: 'desc' }
        });

        if (accesorios.length === 0) return [];

        const ubicacionIds = [...new Set(accesorios.map(a => a.ubicacion).filter(Boolean) as string[])];
        const subUbicacionIds = [...new Set(accesorios.map(a => a.sub_ubicacion).filter(Boolean) as string[])];

        const [ubicacionesInfo, subUbicacionesInfo] = await Promise.all([
            this.db.ubicacion.findMany({
                where: { id_ubicacion: { in: ubicacionIds } },
                select: { id_ubicacion: true, nombre_ubicacion: true }
            }),
            this.db.sub_ubicaciones.findMany({
                where: { id_sub_ubicacion: { in: subUbicacionIds } },
                select: { id_sub_ubicacion: true, nombre: true }
            })
        ]);

        const ubicacionMap = new Map(ubicacionesInfo.map(u => [u.id_ubicacion, u.nombre_ubicacion]));
        const subUbicacionMap = new Map(subUbicacionesInfo.map(s => [s.id_sub_ubicacion, s.nombre]));

        return accesorios.map(a => {
            const uName = (a.ubicacion && ubicacionMap.get(a.ubicacion)) || a.ubicacion || 'ALMACÉN';
            const sName = (a.sub_ubicacion && subUbicacionMap.get(a.sub_ubicacion)) || a.sub_ubicacion || '';
            const fullLocation = sName ? `${uName} - ${sName}` : uName;

            return {
                ...a,
                nombre_ubicacion: fullLocation
            };
        });
    }

    // Scan QR - lookup by serial
    async scanSerial(serial: string) {
        // Find if it's already in an active Salida
        const activeSalidas = await this.db.salidas.findMany({
            where: { estado: { not: 'Entregado' } },
            select: { id_salida: true }
        });
        const activeSalidaIds = activeSalidas.map(s => s.id_salida);

        const activeDetalles = await this.db.salida_detalle.findMany({
            where: { id_salida: { in: activeSalidaIds } },
            select: { id_detalle: true, id_equipo: true, serial_equipos: true }
        });
        const activeDetalleIds = activeDetalles.map(d => d.id_detalle);

        const activeAccesorios = await this.db.salida_accesorios.findMany({
            where: { id_detalle: { in: activeDetalleIds } },
            select: { accesorio_id: true, serial: true }
        });

        const isEquipoActive = activeDetalles.some(d => d.serial_equipos === serial);
        const isAccesorioActive = activeAccesorios.some(a => a.serial === serial);

        if (isEquipoActive || isAccesorioActive) {
            throw new BadRequestException(`El elemento con serial ${serial} ya se encuentra asignado a una Salida en proceso`);
        }

        // Try to find in equipment first
        const equipoEnStock = await this.db.equipo_ubicacion.findFirst({
            where: { serial_equipo: serial }
        });

        if (equipoEnStock?.estado === 'Renovación') {
            throw new BadRequestException(`El equipo con serial ${serial} se encuentra en proceso de Renovación y no se puede dar salida`);
        }

        const equipo = await this.db.equipo_ubicacion.findFirst({
            where: {
                serial_equipo: serial,
                estado: {
                    in: ['Ingresado', 'INGRESADO', 'Ubicado', 'Ingresados', 'INGRESADOS', 'Ubicados']
                }
            }
        });

        if (equipo) {
            // Get detailed info for scan
            let nombre_ubicacion = equipo.id_ubicacion;
            if (equipo.id_ubicacion) {
                const u = await this.db.ubicacion.findUnique({
                    where: { id_ubicacion: equipo.id_ubicacion },
                    select: { nombre_ubicacion: true }
                });
                if (u) nombre_ubicacion = u.nombre_ubicacion;
            }

            let modelo = 'S/M';
            let clase = 'S/C';
            if (equipo.id_equipos) {
                const eq = await this.db.equipos.findUnique({
                    where: { id_equipos: equipo.id_equipos },
                    select: { modelo: true, clase: true }
                });
                if (eq) {
                    modelo = eq.modelo || 'S/M';
                    clase = eq.clase || 'S/C';
                }
            }

            return {
                type: 'equipo',
                data: {
                    id_detalles: equipo.id_equipos,
                    id_equipo_ubicacion: equipo.id_equipo_ubicacion,
                    serial_equipo: equipo.serial_equipo,
                    id_ubicacion: equipo.id_ubicacion,
                    nombre_ubicacion: nombre_ubicacion,
                    id_sub_ubicacion: equipo.id_sub_ubicacion,
                    estado: equipo.estado,
                    modelo: modelo,
                    clase: clase
                }
            };
        }

        // Try accessories
        const accesorio = await this.db.entrada_accesorios.findFirst({
            where: {
                serial,
                estado_acc: 'Ingresado'
            }
        });

        if (accesorio) {
            return {
                type: 'accesorio',
                data: accesorio
            };
        }

        throw new NotFoundException(`No se encontró ningún elemento con serial ${serial} en estado Ingresado`);
    }

    // Update remission info and change status
    async updateRemision(id: string, remision: string) {
        // Verificar si la salida ya había sido "cerrada" (equipos retirados) pero estaba esperando remisión
        const detalles = await this.db.salida_detalle.findMany({ where: { id_salida: id } });
        let yaDespachado = false;
        
        if (detalles.length > 0) {
            const ubicacionIDs = detalles.map(d => d.id_equipo_ubicacion).filter(Boolean) as string[];
            if (ubicacionIDs.length > 0) {
                const eu = await this.db.equipo_ubicacion.findFirst({ where: { id_equipo_ubicacion: ubicacionIDs[0] } });
                if (eu && eu.estado === 'Retirado') yaDespachado = true;
            }

            if (!yaDespachado) {
                const accesorios = await this.db.salida_accesorios.findMany({ where: { id_detalle: { in: detalles.map(d => d.id_detalle) } } });
                if (accesorios.length > 0) {
                    const acc = await this.db.entrada_accesorios.findFirst({ where: { id_accesorio: accesorios[0].accesorio_id } });
                    if (acc && acc.estado === 'Retirado') yaDespachado = true;
                }
            }
        }

        return this.db.salidas.update({
            where: { id_salida: id },
            data: {
                remision,
                remision_confirmacion: 1,
                estado: yaDespachado ? 'Entregado' : 'Por Entregar'
            },
        });
    }

    // Close folio - update equipment/accessories to Retirados
    async cerrarFolio(id: string) {
        const salida = await this.findOne(id);

        if (!salida) {
            throw new NotFoundException(`Salida ${id} no encontrada`);
        }

        if (salida.estado === 'Entregado') {
            throw new BadRequestException('Esta salida ya está cerrada');
        }

        // Update all equipment in this exit to Retirados
        const serialsEquipos = salida.detalles
            .filter(d => Boolean(d.serial_equipos))
            .map(d => d.serial_equipos) as string[];

        const equipoUbicacionIDs = salida.detalles
            .filter(d => Boolean(d.id_equipo_ubicacion))
            .map(d => d.id_equipo_ubicacion) as string[];

        if (serialsEquipos.length > 0 || equipoUbicacionIDs.length > 0) {
            // Generar fecha en formato YYYY-MM-DD HH:mm:ss (19 caracteres) para que quepa en VarChar(20)
            const mxDate = new Date().toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' }).replace('T', ' ');
            const dateStr = mxDate.substring(0, 19);

            try {
                const eqCondition = {
                    OR: [
                        ...(equipoUbicacionIDs.length > 0 ? [{ id_equipo_ubicacion: { in: equipoUbicacionIDs } }] : []),
                        ...(serialsEquipos.length > 0 ? [{ serial_equipo: { in: serialsEquipos } }] : [])
                    ]
                };

                // Find current sublocations of these equipments to free them up
                const eqUbicaciones = await this.db.equipo_ubicacion.findMany({
                    where: eqCondition,
                    select: { id_sub_ubicacion: true }
                });

                const subUbiIds = eqUbicaciones.map(eu => eu.id_sub_ubicacion).filter(Boolean) as string[];

                if (subUbiIds.length > 0) {
                    // Free the sublocations ("van a quedar vacias")
                    await this.db.sub_ubicaciones.updateMany({
                        where: { id_sub_ubicacion: { in: subUbiIds } },
                        data: { ubicacion_ocupada: false }
                    });
                }

                const nuevoEstado = 'Retirado';

                // Update equipo_ubicacion
                await this.db.equipo_ubicacion.updateMany({
                    where: eqCondition,
                    data: {
                        estado: nuevoEstado,
                        fecha_salida: dateStr,
                        usuario_salida: this.prisma.currentUser?.substring(0, 20) || 'Sistema',
                    }
                });

                // Keep entrada_detalle updated for legacy reasons (Only for R1 as R2/R3 don't have this field)
                if (serialsEquipos.length > 0 && this.prisma.currentSite === 'r1') {
                    await this.db.entrada_detalle.updateMany({
                        where: {
                            serial_equipo: { in: serialsEquipos }
                        },
                        data: {
                            estado: 'Retirado'
                        }
                    });
                }
            } catch (error: any) {
                console.error('[SalidasService] Error updating equipment status:', error.message);
                throw new InternalServerErrorException(`Error al actualizar estado de equipos: ${error.message}`);
            }
        }

        // Update all accessories to Retirados or Por Ubicar (R3)
        const accesorioIds = salida.accesorios.map(a => a.accesorio_id);

        if (accesorioIds.length > 0) {

            const accRecords = await this.db.entrada_accesorios.findMany({
                where: { id_accesorio: { in: accesorioIds } },
                select: { sub_ubicacion: true }
            });
            const subUbiAccIds = accRecords.map(a => a.sub_ubicacion).filter(Boolean) as string[];

            if (subUbiAccIds.length > 0) {
                await this.db.sub_ubicaciones.updateMany({
                    where: { id_sub_ubicacion: { in: subUbiAccIds } },
                    data: { ubicacion_ocupada: false }
                });
            }

            const nuevoEstadoAcc = 'Retirado';

            const accUpdateData: any = {
                estado: nuevoEstadoAcc,
            };

            // Only R1 has estado_acc field
            if (this.prisma.currentSite === 'r1') {
                accUpdateData.estado_acc = nuevoEstadoAcc;
            }

            await this.db.entrada_accesorios.updateMany({
                where: {
                    id_accesorio: { in: accesorioIds }
                },
                data: accUpdateData
            });
        }

        // Update salida status
        const hasRemision = salida.remision_confirmacion === 1 || Boolean(salida.remision);
        const finalEstado = hasRemision ? 'Entregado' : salida.estado;

        return this.db.salidas.update({
            where: { id_salida: id },
            data: {
                estado: finalEstado
            },
        });
    }

    // Actualizar una salida
    async update(id: string, data: UpdateSalidaDto) {
        try {
            const original = await this.db.salidas.findUnique({
                where: { id_salida: id },
                select: { folio: true }
            });

            if (!original) throw new NotFoundException(`Salida ${id} no encontrada`);

            // 1. Process images (evidencia, firma, firma_usuario, carta_instruccion)
            const imageFiles: any = {};
            const photoFields = ['evidencia', 'firma', 'firma_usuario', 'carta_instruccion'];

            photoFields.forEach(field => {
                if (data[field]?.startsWith('data:image')) {
                    imageFiles[field] = data[field];
                }
            });

            let savedPaths = {};
            if (Object.keys(imageFiles).length > 0) {
                savedPaths = await this.saveImagesDirectly(original.folio, 'header_update', imageFiles);
            }

            // 2. Clean base64 from data
            const cleanData = { ...data } as any;
            photoFields.forEach(field => {
                if (cleanData[field]?.startsWith('data:image')) delete cleanData[field];
            });

            return await this.db.salidas.update({
                where: { id_salida: id },
                data: {
                    ...cleanData,
                    ...savedPaths
                },
            });
        } catch (error: any) {
            console.error('[SalidasService] Error in update:', error.message);
            throw new InternalServerErrorException(error.message);
        }
    }

    // Quitar un detalle (equipo) de la salida
    async removeDetalle(id_salida: string, id_detalle: string) {
        const salida = await this.findOne(id_salida);
        if (!salida) throw new NotFoundException('Salida no encontrada');
        if (salida.estado === 'Entregado') throw new BadRequestException('No se puede modificar una salida entregada');

        const detalle = await this.db.salida_detalle.findFirst({
            where: { id_detalle, id_salida }
        });
        if (!detalle) throw new NotFoundException('Elemento no encontrado en esta salida');

        if (detalle.id_equipo) {
            await this.db.logs_salida_movimientos.create({
                data: {
                    id_equipo: detalle.id_equipo,
                    serial: detalle.serial_equipos || null,
                    folio: salida.folio,
                    usuario: this.prisma.currentUser?.substring(0, 100) || 'Sistema',
                    accion: 'QUITAR',
                }
            });
        }

        // Delete associated accessories that used this id_detalle as parent
        await this.db.salida_accesorios.deleteMany({
            where: { id_detalle }
        });

        // Delete the detail itself
        return this.db.salida_detalle.delete({
            where: { id_detalle }
        });
    }

    // Quitar un accesorio de la salida
    async removeAccesorio(id_salida: string, id_accesorio: string) {
        const salida = await this.findOne(id_salida);
        if (!salida) throw new NotFoundException('Salida no encontrada');
        if (salida.estado === 'Entregado') throw new BadRequestException('No se puede modificar una salida entregada');

        // Note: id_accesorio here is the PK of salida_accesorios, OR we just delete by accesorio_id
        // The frontend will likely pass the accesorio_id (from the original accessory) or the id_accesorio (the link ID)
        // We'll delete by whichever matches either field for safety, ensuring it belongs to a detalle in this salida
        const detalleIds = salida.detalles.map(d => d.id_detalle);

        if (detalleIds.length === 0) throw new NotFoundException('El accesorio no pertenece a esta salida');

        const acc = await this.db.salida_accesorios.findFirst({
            where: {
                id_detalle: { in: detalleIds },
                OR: [
                    { id_accesorio: id_accesorio },
                    { accesorio_id: id_accesorio }
                ]
            }
        });

        if (!acc) throw new NotFoundException('Accesorio no encontrado en esta salida');

        return this.db.salida_accesorios.delete({
            where: { id_accesorio: acc.id_accesorio }
        });
    }

    // Eliminar una salida completa
    async createRapida(data: any) {
        console.log('[SalidasService] createRapida called with', data);
        return this.db.$transaction(async (tx) => {
            const id_salida = uuidv4();
            const folio = data.folio || await this.generateFolio();
            const dateStr = new Date().toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' }).replace('T', ' ').substring(0, 19);

            if (!data.numero_serie) {
                throw new BadRequestException('El número de serie es requerido.');
            }

            // 1. Try equipment first
            const equipoUbicacion = await tx.equipo_ubicacion.findFirst({
                where: {
                    serial_equipo: data.numero_serie,
                    estado: { not: 'Retirado' }
                },
                include: {
                    equipos: { select: { id_equipos: true } }
                }
            });

            if (equipoUbicacion) {
                // ---- EQUIPO PATH ----
                await tx.salidas.create({
                    data: {
                        id_salida, folio,
                        fecha_transporte: data.fecha ? new Date(data.fecha) : new Date(),
                        fecha_creacion: new Date(),
                        estado: 'Entregado',
                        cliente: data.cliente || null,
                        destino: data.destino || null,
                        remision: data.remision || null,
                        elemento: 'Equipos',
                        usuario_asignado: this.prisma.currentUser?.substring(0, 100) || 'Sistema',
                    }
                });

                const id_detalle = uuidv4();
                await tx.salida_detalle.create({
                    data: {
                        id_detalle, id_salida,
                        id_equipo: equipoUbicacion.id_equipos || equipoUbicacion.equipos?.id_equipos || null,
                        id_equipo_ubicacion: equipoUbicacion.id_equipo_ubicacion,
                        serial_equipos: data.numero_serie,
                        id_ubicacion: equipoUbicacion.id_ubicacion,
                        id_sub_ubicacion: equipoUbicacion.id_sub_ubicacion || 'N/A',
                        tipo_salida: 'Venta',
                        cantidad_salida: 1,
                    }
                });

                if (equipoUbicacion.id_sub_ubicacion) {
                    await tx.sub_ubicaciones.update({
                        where: { id_sub_ubicacion: equipoUbicacion.id_sub_ubicacion },
                        data: { ubicacion_ocupada: false }
                    });
                }

                await tx.equipo_ubicacion.update({
                    where: { id_equipo_ubicacion: equipoUbicacion.id_equipo_ubicacion },
                    data: {
                        estado: 'Retirado',
                        fecha_salida: dateStr,
                        usuario_salida: this.prisma.currentUser?.substring(0, 20) || 'Sistema',
                    }
                });

                if (this.prisma.currentSite === 'r1') {
                    await tx.entrada_detalle.updateMany({
                        where: { serial_equipo: data.numero_serie },
                        data: { estado: 'Retirado' }
                    });
                }

                await tx.logs_salida_movimientos.create({
                    data: {
                        id_equipo: equipoUbicacion.id_equipos || '',
                        serial: data.numero_serie, folio,
                        usuario: this.prisma.currentUser?.substring(0, 100) || 'Sistema',
                        accion: 'CREAR_RAPIDA',
                    }
                });

                return { success: true, id_salida, folio, tipo: 'equipo' };
            }

            // 2. Try accessory
            const accesorio = await tx.entrada_accesorios.findFirst({
                where: {
                    serial: data.numero_serie,
                    estado: { not: 'Retirado' }
                }
            });

            if (!accesorio) {
                throw new BadRequestException(
                    `No se encontró equipo ni accesorio con serial "${data.numero_serie}" en estado disponible.`
                );
            }

            // ---- ACCESORIO PATH ----
            await tx.salidas.create({
                data: {
                    id_salida, folio,
                    fecha_transporte: data.fecha ? new Date(data.fecha) : new Date(),
                    fecha_creacion: new Date(),
                    estado: 'Entregado',
                    cliente: data.cliente || null,
                    destino: data.destino || null,
                    remision: data.remision || null,
                    elemento: 'Accesorios',
                    usuario_asignado: this.prisma.currentUser?.substring(0, 100) || 'Sistema',
                }
            });

            const id_detalle = uuidv4();
            await tx.salida_detalle.create({
                data: {
                    id_detalle, id_salida,
                    cantidad_salida: 0,
                    id_sub_ubicacion: accesorio.sub_ubicacion || 'N/A',
                }
            });

            await tx.salida_accesorios.create({
                data: {
                    id_accesorio: uuidv4(),
                    accesorio_id: accesorio.id_accesorio,
                    id_detalle,
                    modelo: accesorio.modelo,
                    serial: data.numero_serie,
                }
            });

            if (accesorio.sub_ubicacion) {
                await tx.sub_ubicaciones.update({
                    where: { id_sub_ubicacion: accesorio.sub_ubicacion },
                    data: { ubicacion_ocupada: false }
                });
            }

            const accUpdateData: any = {
                estado: 'Retirado',
            };
            if (this.prisma.currentSite === 'r1') {
                accUpdateData.estado_acc = 'Retirado';
            }
            await tx.entrada_accesorios.update({
                where: { id_accesorio: accesorio.id_accesorio },
                data: accUpdateData,
            });

            return { success: true, id_salida, folio, tipo: 'accesorio' };
        });
    }

    async remove(id: string) {
        // First delete related detalles and accesorios
        const detalles = await this.db.salida_detalle.findMany({
            where: { id_salida: id }
        });

        const detalleIds = detalles.map(d => d.id_detalle);

        if (detalleIds.length > 0) {
            await this.db.salida_accesorios.deleteMany({
                where: { id_detalle: { in: detalleIds } }
            });

            await this.db.salida_detalle.deleteMany({
                where: { id_salida: id }
            });
        }

        return this.db.salidas.delete({
            where: { id_salida: id },
        });
    }

    // Obtener detalles de una salida
    async getDetalles(id_salida: string) {
        return this.db.salida_detalle.findMany({
            where: { id_salida },
        });
    }

    // Obtener accesorios de una salida
    async getAccesorios(id_detalle: string) {
        return this.db.salida_accesorios.findMany({
            where: { id_detalle },
        });
    }
}
