import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaDynamicService } from '../../../database/prisma-dynamic.service';
import { CreateClienteDto, UpdateClienteDto } from './dto/create-cliente.dto';
import { CreateSitioDto } from './dto/create-sitio.dto';

@Injectable()
export class ClientesService {
    private readonly logger = new Logger(ClientesService.name);

    constructor(private readonly prismaService: PrismaDynamicService) { }

    private getDb() {
        const db = PrismaDynamicService.clients.r4;
        if (!db) throw new Error('Database client for R4 not initialized');
        return db;
    }

    async obtenerClientes() {
        try {
            const db = this.getDb();

            const clientes = await db.cliente.findMany({
                include: {
                    sitios: {
                        include: { activos: true }
                    },
                    activos: true
                },
                orderBy: { created_at: 'desc' }
            });

            return clientes.map(cliente => {
                const comercial = (cliente.datos_comerciales as any) || {};
                const fiscal = (cliente.datos_fiscales as any) || {};
                return {
                    id: cliente.id,
                    razonSocial: cliente.razon_social,
                    rfc: cliente.rfc || '-',
                    estatus: cliente.estado || 'ACTIVO',
                    adc: comercial.adc || '-',
                    moneda: comercial.moneda || 'MXN',
                    ciudad: fiscal.ciudad || '-',
                    estado_fiscal: fiscal.estado || '-',
                    sitiosCount: cliente.sitios?.length || 0,
                    activosCount: cliente.activos?.length || 0,
                    sitios: cliente.sitios?.map(s => {
                        const contacto = (s.contacto_operativo as any) || {};
                        return {
                            id: s.id,
                            nombre: s.nombre,
                            ciudad: s.ciudad,
                            direccion: s.direccion,
                            no_totvs: s.no_totvs,
                            region: contacto.region || '-',
                            responsable: contacto.responsable || '-',
                            activosCount: s.activos?.length || 0
                        };
                    })
                };
            });
        } catch (error: any) {
            this.logger.error(`Error en obtenerClientes: ${error.message}`);
            throw error;
        }
    }

    async obtenerClientePorId(id: string) {
        try {
            const db = this.getDb();

            const cliente = await db.cliente.findUnique({
                where: { id },
                include: {
                    sitios: {
                        include: { activos: true }
                    },
                    activos: true
                }
            });

            if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);

            const comercial = (cliente.datos_comerciales as any) || {};
            const fiscal = (cliente.datos_fiscales as any) || {};

            return {
                id: cliente.id,
                razonSocial: cliente.razon_social,
                rfc: cliente.rfc || '-',
                estatus: cliente.estado || 'ACTIVO',
                adc: comercial.adc || '-',
                moneda: comercial.moneda || 'MXN',
                datos_fiscales: {
                    calle: fiscal.calle,
                    numero: fiscal.numero,
                    cp: fiscal.cp,
                    ciudad: fiscal.ciudad,
                    estado: fiscal.estado,
                },
                sitiosCount: cliente.sitios?.length || 0,
                activosCount: cliente.activos?.length || 0,
                sitios: cliente.sitios?.map(s => {
                    const contacto = (s.contacto_operativo as any) || {};
                    return {
                        id: s.id,
                        nombre: s.nombre,
                        ciudad: s.ciudad,
                        direccion: s.direccion,
                        no_totvs: s.no_totvs,
                        region: contacto.region || '-',
                        responsable: contacto.responsable || '-',
                        activosCount: s.activos?.length || 0
                    };
                })
            };
        } catch (error: any) {
            this.logger.error(`Error en obtenerClientePorId: ${error.message}`);
            throw error;
        }
    }

    async crearCliente(dto: CreateClienteDto) {
        try {
            const db = this.getDb();

            const duplicadoRazon = await db.cliente.findFirst({ where: { razon_social: dto.razon_social } });
            if (duplicadoRazon) throw new ConflictException(`Ya existe un cliente con la razón social "${dto.razon_social}"`);

            if (dto.rfc) {
                const duplicadoRfc = await db.cliente.findFirst({ where: { rfc: dto.rfc } });
                if (duplicadoRfc) throw new ConflictException(`Ya existe un cliente con el RFC "${dto.rfc}"`);
            }

            const cliente = await db.cliente.create({
                data: {
                    razon_social: dto.razon_social,
                    rfc: dto.rfc,
                    datos_comerciales: {
                        adc: dto.adc || null,
                        moneda: dto.moneda || 'MXN',
                    },
                    datos_fiscales: dto.datos_fiscales ? {
                        calle: dto.datos_fiscales.calle,
                        numero: dto.datos_fiscales.numero,
                        cp: dto.datos_fiscales.cp,
                        ciudad: dto.datos_fiscales.ciudad,
                        estado: dto.datos_fiscales.estado,
                    } : null,
                    estado: 'ACTIVO',
                }
            });

            const sitiosCreados = [];
            if (dto.sitios?.length) {
                const nombresVistos = new Set<string>();
                for (const sitioDto of dto.sitios) {
                    if (!sitioDto.nombre) continue;
                    if (nombresVistos.has(sitioDto.nombre)) {
                        throw new ConflictException(`El nombre de sitio "${sitioDto.nombre}" está duplicado en la solicitud`);
                    }
                    nombresVistos.add(sitioDto.nombre);
                    const sitio = await db.sitio.create({
                        data: {
                            cliente_id: cliente.id,
                            nombre: sitioDto.nombre,
                            direccion: sitioDto.direccion || null,
                            no_totvs: sitioDto.no_totvs || null,
                            contacto_operativo: {
                                region: sitioDto.region || null,
                                responsable: sitioDto.responsable || null,
                            },
                        }
                    });
                    sitiosCreados.push(sitio);
                }
            }

            this.logger.log(`Cliente creado: ${cliente.id} — ${cliente.razon_social}`);

            return { ...cliente, sitios: sitiosCreados };
        } catch (error: any) {
            this.logger.error(`Error en crearCliente: ${error.message}`);
            throw error;
        }
    }

    async actualizarCliente(id: string, dto: UpdateClienteDto) {
        try {
            const db = this.getDb();

            const existente = await db.cliente.findUnique({ where: { id } });
            if (!existente) throw new NotFoundException(`Cliente ${id} no encontrado`);

            if (dto.razon_social && dto.razon_social !== existente.razon_social) {
                const dup = await db.cliente.findFirst({ where: { razon_social: dto.razon_social } });
                if (dup) throw new ConflictException(`Ya existe un cliente con la razón social "${dto.razon_social}"`);
            }

            if (dto.rfc && dto.rfc !== existente.rfc) {
                const dup = await db.cliente.findFirst({ where: { rfc: dto.rfc } });
                if (dup) throw new ConflictException(`Ya existe un cliente con el RFC "${dto.rfc}"`);
            }

            const comercialActual = (existente.datos_comerciales as any) || {};
            const fiscalActual = (existente.datos_fiscales as any) || {};

            const cliente = await db.cliente.update({
                where: { id },
                data: {
                    ...(dto.razon_social && { razon_social: dto.razon_social }),
                    ...(dto.rfc !== undefined && { rfc: dto.rfc }),
                    ...(dto.estado && { estado: dto.estado }),
                    datos_comerciales: {
                        ...comercialActual,
                        ...(dto.adc !== undefined && { adc: dto.adc }),
                        ...(dto.moneda !== undefined && { moneda: dto.moneda }),
                    },
                    datos_fiscales: dto.datos_fiscales ? {
                        ...fiscalActual,
                        ...dto.datos_fiscales,
                    } : existente.datos_fiscales,
                }
            });

            return cliente;
        } catch (error: any) {
            this.logger.error(`Error en actualizarCliente: ${error.message}`);
            throw error;
        }
    }

    async agregarSitio(clienteId: string, dto: CreateSitioDto) {
        try {
            const db = this.getDb();

            const cliente = await db.cliente.findUnique({ where: { id: clienteId } });
            if (!cliente) throw new NotFoundException(`Cliente ${clienteId} no encontrado`);

            const dupSitio = await db.sitio.findFirst({ where: { cliente_id: clienteId, nombre: dto.nombre } });
            if (dupSitio) throw new ConflictException(`El cliente ya tiene un sitio con el nombre "${dto.nombre}"`);

            const sitio = await db.sitio.create({
                data: {
                    cliente_id: clienteId,
                    nombre: dto.nombre,
                    direccion: dto.direccion || null,
                    no_totvs: dto.no_totvs || null,
                    contacto_operativo: {
                        region: dto.region || null,
                        responsable: dto.responsable || null,
                    },
                }
            });

            this.logger.log(`Sitio creado: ${sitio.id} para cliente ${clienteId}`);

            const contacto = (sitio.contacto_operativo as any) || {};
            return {
                id: sitio.id,
                clienteId: sitio.cliente_id,
                nombre: sitio.nombre,
                direccion: sitio.direccion,
                no_totvs: sitio.no_totvs,
                region: contacto.region || '-',
                responsable: contacto.responsable || '-',
            };
        } catch (error: any) {
            this.logger.error(`Error en agregarSitio: ${error.message}`);
            throw error;
        }
    }

    async actualizarSitio(sitioId: string, dto: CreateSitioDto) {
        try {
            const db = this.getDb();

            const existente = await db.sitio.findUnique({ where: { id: sitioId } });
            if (!existente) throw new NotFoundException(`Sitio ${sitioId} no encontrado`);

            if (dto.nombre && dto.nombre !== existente.nombre) {
                const dup = await db.sitio.findFirst({ where: { cliente_id: existente.cliente_id, nombre: dto.nombre } });
                if (dup) throw new ConflictException(`El cliente ya tiene un sitio con el nombre "${dto.nombre}"`);
            }

            const contactoActual = (existente.contacto_operativo as any) || {};

            const sitio = await db.sitio.update({
                where: { id: sitioId },
                data: {
                    ...(dto.nombre && { nombre: dto.nombre }),
                    ...(dto.direccion !== undefined && { direccion: dto.direccion }),
                    ...(dto.no_totvs !== undefined && { no_totvs: dto.no_totvs }),
                    contacto_operativo: {
                        ...contactoActual,
                        ...(dto.region !== undefined && { region: dto.region }),
                        ...(dto.responsable !== undefined && { responsable: dto.responsable }),
                    },
                }
            });

            const contacto = (sitio.contacto_operativo as any) || {};
            return {
                id: sitio.id,
                clienteId: sitio.cliente_id,
                nombre: sitio.nombre,
                direccion: sitio.direccion,
                no_totvs: sitio.no_totvs,
                region: contacto.region || '-',
                responsable: contacto.responsable || '-',
            };
        } catch (error: any) {
            this.logger.error(`Error en actualizarSitio: ${error.message}`);
            throw error;
        }
    }

    async eliminarCliente(id: string) {
        try {
            const db = this.getDb();
            const existente = await db.cliente.findUnique({ where: { id } });
            if (!existente) throw new NotFoundException(`Cliente ${id} no encontrado`);
            await db.ordenMensual.deleteMany({ where: { cliente_id: id } });

            // Delete related rentas and their detalles
            const rentas = await db.renta.findMany({ where: { cliente_id: id }, select: { id: true } });
            const rentaIds = rentas.map(r => r.id);
            if (rentaIds.length > 0) {
                await db.detallesRenta.deleteMany({ where: { renta_id: { in: rentaIds } } });
                await db.renta.deleteMany({ where: { id: { in: rentaIds } } });
            }

            // Delete contratos
            await db.contrato.deleteMany({ where: { cliente_id: id } });

            // Unlink activos
            await db.activo.updateMany({ where: { cliente_id: id }, data: { cliente_id: null, sitio_id: null } });

            // Delete related sitios first to prevent relation violation
            await db.sitio.deleteMany({ where: { cliente_id: id } });

            // Now delete the cliente
            await db.cliente.delete({ where: { id } });
            return true;
        } catch (error: any) {
            this.logger.error(`Error en eliminarCliente: ${error.message}`);
            throw error;
        }
    }

    async eliminarSitio(sitioId: string) {
        try {
            const db = this.getDb();
            const existente = await db.sitio.findUnique({ where: { id: sitioId } });
            if (!existente) throw new NotFoundException(`Sitio ${sitioId} no encontrado`);

            await db.sitio.delete({ where: { id: sitioId } });
            return true;
        } catch (error: any) {
            this.logger.error(`Error en eliminarSitio: ${error.message}`);
            throw error;
        }
    }
}
