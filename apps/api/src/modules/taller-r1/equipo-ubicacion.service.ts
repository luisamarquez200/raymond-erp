import { PrismaClient as PrismaR1 } from '@prisma/client-taller-r1';
import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaDynamicService } from '../../database/prisma-dynamic.service';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

export interface CreateEquipoUbicacionDto {
    id_equipos?: string;
    id_ubicacion?: string;
    stock: string;
    id_sub_ubicacion?: string;
    estado?: string;
    fecha_entrada?: string;
    serial_equipo?: string;
    vendedor?: string;
}

export interface MoverEquipoDto {
    id_equipo_ubicacion: string;
    id_ubicacion_destino: string;
    id_sub_ubicacion_destino: string;
    usuario_movilizacion: string;
}

@Injectable()
export class EquipoUbicacionService {
    constructor(private prisma: PrismaDynamicService) { }

    private get db(): PrismaR1 {
        return this.prisma.client;
    }

    async findAll() {
        const equipoUbicaciones = await this.db.equipo_ubicacion.findMany();

        // 1. Extract raw unique keys to avoid N+1 queries
        const equipoIds = [...new Set(equipoUbicaciones.map((e) => e.id_equipos).filter(Boolean))] as string[];
        const ubicacionIds = [...new Set(equipoUbicaciones.map((e) => e.id_ubicacion).filter(Boolean))] as string[];
        const subUbicacionIds = [...new Set(equipoUbicaciones.map((e) => e.id_sub_ubicacion).filter(Boolean))] as string[];
        const serials = [...new Set(equipoUbicaciones.map((e) => e.serial_equipo).filter(Boolean))] as string[];

        // 2. Fetch master data in parallel
        const [
            equipos,
            ubicaciones,
            subUbicaciones,
            cargueMasivo,
            entradasDetalle,
            salidasDetalle
        ] = await Promise.all([
            this.db.equipos.findMany({ where: { id_equipos: { in: equipoIds } } }),
            this.db.ubicacion.findMany({ where: { id_ubicacion: { in: ubicacionIds } } }),
            this.db.sub_ubicaciones.findMany({ where: { id_sub_ubicacion: { in: subUbicacionIds } } }),
            this.db.cargueMasivo.findMany({ where: { SERIE: { in: serials } }, select: { SERIE: true, CLIENTE: true, UNIDAD_DE_VENTA: true } }),
            this.db.entrada_detalle.findMany({ where: { serial_equipo: { in: serials } } }),
            this.db.salida_detalle.findMany({ where: { serial_equipos: { in: serials } } })
        ]);

        // 3. Fetch folios based on the found details
        const entradaIds = [...new Set(entradasDetalle.map(e => e.id_entrada).filter(Boolean))] as string[];
        const salidaIds = [...new Set(salidasDetalle.map(e => e.id_salida).filter(Boolean))] as string[];

        const [entradas, salidas] = await Promise.all([
            this.db.entradas.findMany({ where: { id_entrada: { in: entradaIds } }, select: { id_entrada: true, folio: true, fecha_creacion: true } }),
            this.db.salidas.findMany({ where: { id_salida: { in: salidaIds } }, select: { id_salida: true, folio: true, fecha_creacion: true } })
        ]);

        // Create quick lookup maps for absolute performance
        const equiposMap = new Map(equipos.map(e => [e.id_equipos, e]));
        const ubicacionesMap = new Map(ubicaciones.map(e => [e.id_ubicacion, e.nombre_ubicacion]));
        const subUbicacionesMap = new Map(subUbicaciones.map(e => [e.id_sub_ubicacion, { nombre: e.nombre, ocupada: e.ubicacion_ocupada }]));
        const cargueMap = new Map(cargueMasivo.map(e => [e.SERIE, e]));

        // Group folios by serial for quick latest-folio retrieval
        const foliosEntradaMap = new Map<string, { folio: string, date: Date }>();
        entradasDetalle.forEach(det => {
            if (det.serial_equipo && det.id_entrada) {
                const ent = entradas.find(e => e.id_entrada === det.id_entrada);
                if (ent) {
                    const existing = foliosEntradaMap.get(det.serial_equipo);
                    if (!existing || new Date(ent.fecha_creacion).getTime() > existing.date.getTime()) {
                        foliosEntradaMap.set(det.serial_equipo, { folio: ent.folio, date: new Date(ent.fecha_creacion) });
                    }
                }
            }
        });

        const foliosSalidaMap = new Map<string, { folio: string, date: Date }>();
        salidasDetalle.forEach(det => {
            if (det.serial_equipos && det.id_salida) {
                const sal = salidas.find(e => e.id_salida === det.id_salida);
                if (sal && sal.fecha_creacion) {
                    const existing = foliosSalidaMap.get(det.serial_equipos);
                    if (!existing || new Date(sal.fecha_creacion).getTime() > existing.date.getTime()) {
                        foliosSalidaMap.set(det.serial_equipos, { folio: sal.folio, date: new Date(sal.fecha_creacion) });
                    }
                }
            }
        });

        // 4. Map final data object
        return equipoUbicaciones.map((eu) => {
            const eq = eu.id_equipos ? equiposMap.get(eu.id_equipos) : null;
            const subUbi = eu.id_sub_ubicacion ? subUbicacionesMap.get(eu.id_sub_ubicacion) : null;
            const masivo = eu.serial_equipo ? cargueMap.get(eu.serial_equipo) : null;

            let folio = 'N/D';
            if (eu.serial_equipo) {
                if (eu.estado === 'Retirado') {
                    folio = foliosSalidaMap.get(eu.serial_equipo)?.folio || 'N/D';
                } else {
                    folio = foliosEntradaMap.get(eu.serial_equipo)?.folio || 'N/D';
                }
            }

            return {
                id_equipo_ubicacion: eu.id_equipo_ubicacion,
                serial_equipo: eu.serial_equipo || 'S/N',
                marca: eq?.marca || 'N/D',
                modelo: eq?.modelo || 'N/D',
                clase: eq?.clase || 'N/D',
                ubicacion: eu.id_ubicacion ? ubicacionesMap.get(eu.id_ubicacion) || 'N/D' : 'N/D',
                sub_ubicacion: subUbi?.nombre || 'N/D',
                ubicacion_ocupada: subUbi?.ocupada || false,
                estado: eu.estado || 'N/D',
                fecha_entrada: eu.fecha_entrada || 'N/D',
                fecha_salida: eu.fecha_salida || 'N/D',
                cliente: masivo?.CLIENTE || 'N/D',
                unidad_venta: masivo?.UNIDAD_DE_VENTA || 'N/D',
                folio: folio
            };
        });
    }

    async findByDetailId(detailId: string) {
        const eu = await this.db.equipo_ubicacion.findFirst({
            where: {
                stock: detailId,
                estado: { not: 'Retirado' }
            }
        });

        if (!eu) return null;

        const [eq, ubi, sub] = await Promise.all([
            eu.id_equipos ? this.db.equipos.findUnique({ where: { id_equipos: eu.id_equipos } }) : null,
            eu.id_ubicacion ? this.db.ubicacion.findUnique({ where: { id_ubicacion: eu.id_ubicacion } }) : null,
            eu.id_sub_ubicacion ? this.db.sub_ubicaciones.findUnique({ where: { id_sub_ubicacion: eu.id_sub_ubicacion } }) : null
        ]);

        return {
            id_equipo_ubicacion: eu.id_equipo_ubicacion,
            serial_equipo: eu.serial_equipo,
            modelo: eq?.modelo || 'N/D',
            clase: eq?.clase || 'N/D',
            ubicacion: ubi?.nombre_ubicacion || 'N/D',
            sub_ubicacion: sub?.nombre || 'N/D',
            estado: eu.estado
        };
    }

    async create(data: CreateEquipoUbicacionDto) {
        // Check if serial number is already in "Ingresado" status
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

        return this.db.equipo_ubicacion.create({
            data: {
                id_equipo_ubicacion: uuidv4(),
                ...data,
            },
        });
    }

    async update(id: string, data: Partial<CreateEquipoUbicacionDto>) {
        return this.db.equipo_ubicacion.update({
            where: { id_equipo_ubicacion: id },
            data,
        });
    }

    async remove(id: string) {
        return this.db.equipo_ubicacion.delete({
            where: { id_equipo_ubicacion: id },
        });
    }

    async movilizarEquipo(data: MoverEquipoDto) {
        return this.db.$transaction(async (tx) => {
            // 1. Fetch current equipo_ubicacion details
            const current = await tx.equipo_ubicacion.findUnique({
                where: { id_equipo_ubicacion: data.id_equipo_ubicacion },
            });

            if (!current) {
                throw new Error('Equipo Ubicación no encontrado');
            }

            // 2. Validate destination sub-ubicacion is free
            const destSubUbicacion = await tx.sub_ubicaciones.findUnique({
                where: { id_sub_ubicacion: data.id_sub_ubicacion_destino }
            });

            if (!destSubUbicacion) {
                throw new Error('Sub-Ubicación destino no existe');
            }

            if (destSubUbicacion.ubicacion_ocupada) {
                throw new Error('La sub-ubicación de destino ya se encuentra ocupada');
            }

            // 3. Free original sub-ubicacion
            if (current.id_sub_ubicacion) {
                await tx.sub_ubicaciones.update({
                    where: { id_sub_ubicacion: current.id_sub_ubicacion },
                    data: { ubicacion_ocupada: false }
                });
            }

            // 4. Occupy new sub-ubicacion
            await tx.sub_ubicaciones.update({
                where: { id_sub_ubicacion: data.id_sub_ubicacion_destino },
                data: { ubicacion_ocupada: true }
            });

            // 5. Update equipo_ubicacion
            const updatedEquipoUbicacion = await tx.equipo_ubicacion.update({
                where: { id_equipo_ubicacion: data.id_equipo_ubicacion },
                data: {
                    id_ubicacion: data.id_ubicacion_destino,
                    id_sub_ubicacion: data.id_sub_ubicacion_destino
                }
            });

            // 6. Record in movilizaciones history
            await tx.movilizaciones.create({
                data: {
                    id_movilizacion: uuidv4().substring(0, 20),
                    fecha_movilizacion: new Date(),
                    usuario_movilizacion: data.usuario_movilizacion,
                    id_equipo_ubicacion: data.id_equipo_ubicacion,
                    id_equipo: current.id_equipos,
                    id_ubicacion_origen: current.id_ubicacion,
                    id_sub_ubicacion_origen: current.id_sub_ubicacion,
                    id_ubicacion_destino: data.id_ubicacion_destino,
                    id_sub_ubicacion_destino: data.id_sub_ubicacion_destino
                }
            });

            return updatedEquipoUbicacion;
        });
    }

    async getMovilizaciones(id_equipo_ubicacion: string) {
        const movilizaciones = await this.db.movilizaciones.findMany({
            where: { id_equipo_ubicacion },
            orderBy: { fecha_movilizacion: 'desc' }
        });

        // Hydrate names for origin and destination
        const ubiIds = [...new Set([
            ...movilizaciones.map(m => m.id_ubicacion_origen),
            ...movilizaciones.map(m => m.id_ubicacion_destino)
        ].filter(Boolean))] as string[];

        const subUbiIds = [...new Set([
            ...movilizaciones.map(m => m.id_sub_ubicacion_origen),
            ...movilizaciones.map(m => m.id_sub_ubicacion_destino)
        ].filter(Boolean))] as string[];

        const [ubicaciones, subUbicaciones] = await Promise.all([
            this.db.ubicacion.findMany({ where: { id_ubicacion: { in: ubiIds } } }),
            this.db.sub_ubicaciones.findMany({ where: { id_sub_ubicacion: { in: subUbiIds } } })
        ]);

        const ubiMap = new Map(ubicaciones.map(u => [u.id_ubicacion, u.nombre_ubicacion]));
        const subUbiMap = new Map(subUbicaciones.map(su => [su.id_sub_ubicacion, su.nombre]));

        return movilizaciones.map(m => ({
            ...m,
            nombre_ubicacion_origen: m.id_ubicacion_origen ? ubiMap.get(m.id_ubicacion_origen) : 'N/D',
            nombre_sub_ubicacion_origen: m.id_sub_ubicacion_origen ? subUbiMap.get(m.id_sub_ubicacion_origen) : 'N/D',
            nombre_ubicacion_destino: m.id_ubicacion_destino ? ubiMap.get(m.id_ubicacion_destino) : 'N/D',
            nombre_sub_ubicacion_destino: m.id_sub_ubicacion_destino ? subUbiMap.get(m.id_sub_ubicacion_destino) : 'N/D',
        }));
    }

    // Helper to get/set refacciones catalogo
    private getCatalogPath() {
        const dir = path.join(process.cwd(), 'uploads', 'renovados');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return path.join(dir, 'refacciones_catalogo.json');
    }

    private readCatalog(): any[] {
        const filePath = this.getCatalogPath();
        if (!fs.existsSync(filePath)) {
            // Seed a few default catalog items if file doesn't exist
            const defaults = [
                { refaccion: 'Filtro de Aceite', descripcion: 'Filtro aceite motor principal', precio: 350 },
                { refaccion: 'Filtro de Aire', descripcion: 'Filtro aire motor', precio: 450 },
                { refaccion: 'Batería 12V', descripcion: 'Batería de arranque Raymond', precio: 2800 },
                { refaccion: 'Horquillas Raymond', descripcion: 'Horquillas de carga estándar', precio: 8500 }
            ];
            fs.writeFileSync(filePath, JSON.stringify(defaults, null, 2), 'utf-8');
            return defaults;
        }
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(content);
        } catch {
            return [];
        }
    }

    private writeCatalog(catalog: any[]) {
        const filePath = this.getCatalogPath();
        fs.writeFileSync(filePath, JSON.stringify(catalog, null, 2), 'utf-8');
    }

    // Helper to get/set costos refacciones
    private getCostsPath() {
        const dir = path.join(process.cwd(), 'uploads', 'renovados');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return path.join(dir, 'costos_refacciones.json');
    }

    private readCosts(): any[] {
        const filePath = this.getCostsPath();
        if (!fs.existsSync(filePath)) return [];
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(content);
        } catch {
            return [];
        }
    }

    private writeCosts(costs: any[]) {
        const filePath = this.getCostsPath();
        fs.writeFileSync(filePath, JSON.stringify(costs, null, 2), 'utf-8');
    }

    // Exposed Service Methods
    async getRefaccionesCatalogo() {
        return this.readCatalog();
    }

    async createRefaccionCatalogo(dto: { refaccion: string; descripcion: string; precio: number }) {
        const catalog = this.readCatalog();
        const newItem = {
            ...dto,
            precio: Number(dto.precio || 0)
        };
        catalog.push(newItem);
        this.writeCatalog(catalog);
        return newItem;
    }

    async getCostosRefacciones(id_equipo_ubicacion: string) {
        const costs = this.readCosts();
        return costs.filter((c: any) => c.id_equipo_ubicacion === id_equipo_ubicacion);
    }

    async addCostoRefaccion(id_equipo_ubicacion: string, dto: { descripcion: string; precio: number; tipo: string; observaciones?: string }) {
        const costs = this.readCosts();
        const nextId = costs.length > 0 ? Math.max(...costs.map((c: any) => Number(c.id_costos_refacciones || 0))) + 1 : 1;
        const newItem = {
            id_costos_refacciones: nextId,
            id_equipo_ubicacion,
            ...dto,
            precio: Number(dto.precio || 0)
        };
        costs.push(newItem);
        this.writeCosts(costs);
        return newItem;
    }

    async deleteCostoRefaccion(id: number) {
        const costs = this.readCosts();
        const filtered = costs.filter((c: any) => Number(c.id_costos_refacciones) !== Number(id));
        this.writeCosts(filtered);
        return { success: true };
    }
}
