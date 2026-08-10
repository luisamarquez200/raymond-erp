import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaDynamicService } from '../../../database/prisma-dynamic.service';
import { CreateClienteDto, UpdateClienteDto } from './dto/create-cliente.dto';
import { CreateSitioDto } from './dto/create-sitio.dto';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ClientesService {
    private readonly logger = new Logger(ClientesService.name);

    constructor(private readonly prismaService: PrismaDynamicService) { }

    private getDb() {
        const db = PrismaDynamicService.clients.r4;
        if (!db) throw new Error('Database client for R4 not initialized');
        return db;
    }

    async obtenerClientes(user?: any) {
        try {
            const db = this.getDb();

            const clientes = await db.cliente.findMany({
                include: {
                    sitios: {
                        include: { activos: true },
                        orderBy: { nombre: 'asc' }
                    },
                    activos: true
                },
                orderBy: { razon_social: 'asc' }
            });

            let filteredClientes = clientes;

            if ((user?.roles === 'ADC' || user?.roles === 'AUXILIAR') && (user?.first_name || user?.adc_asociado_name)) {
                const target = (user?.adc_asociado_name || user?.first_name).toLowerCase();
                filteredClientes = clientes.filter(cliente => {
                    const comercial = (cliente.datos_comerciales as any) || {};
                    const clientAdc = (comercial.adc || '').toLowerCase();
                    const hasMatchingSitio = cliente.sitios?.some(s => (s.adc || '').toLowerCase().includes(target));
                    const hasMatchingActivo = cliente.activos?.some(a => (a.adc || '').toLowerCase().includes(target));
                    return clientAdc.includes(target) || hasMatchingSitio || hasMatchingActivo;
                });
            }

            let mapped = filteredClientes.map(cliente => {
                const comercial = (cliente.datos_comerciales as any) || {};
                const fiscal = (cliente.datos_fiscales as any) || {};
                const firstSiteWithAdc = cliente.sitios?.find(s => s.adc);
                
                return {
                    id: cliente.id,
                    razonSocial: cliente.razon_social,
                    rfc: cliente.rfc || '-',
                    estatus: cliente.estado || 'ACTIVO',
                    adc: comercial.adc || firstSiteWithAdc?.adc || '-',
                    moneda: comercial.moneda || 'MXN',
                    ciudad: fiscal.ciudad || '-',
                    estado_fiscal: fiscal.estado || '-',
                    sitiosCount: cliente.sitios?.length || 0,
                    activosCount: cliente.activos?.length || 0,
                    sitios: cliente.sitios?.map(s => {
                        let contacto: any = {};
                        try {
                            if (typeof s.contacto_operativo === 'string' && s.contacto_operativo.startsWith('{')) {
                                contacto = JSON.parse(s.contacto_operativo);
                            } else if (typeof s.contacto_operativo === 'object' && s.contacto_operativo !== null) {
                                contacto = s.contacto_operativo;
                            }
                        } catch (e) {
                            contacto = {};
                        }

                        // Cross-reference ADC from site, site contact, site assets operating in Flotilla, or client comercial
                        const siteActivoAdc = s.activos?.find((a: any) => a.adc && a.adc !== '-' && a.adc !== 'Sin ADC')?.adc;
                        const siteAdc = s.adc || contacto.adc || siteActivoAdc || comercial.adc || '-';

                        // Extract distribuidor string safely
                        let distName = '-';
                        if (typeof s.distribuidor === 'string') {
                            distName = s.distribuidor;
                        } else if (typeof s.distribuidor === 'object' && s.distribuidor !== null) {
                            distName = (s.distribuidor as any).nombre || (s.distribuidor as any).razon_social || '-';
                        }

                        // Extract contact info
                        const cNombre = typeof contacto.distribuidor_contacto_nombre === 'string' ? contacto.distribuidor_contacto_nombre
                            : (typeof contacto.contacto_nombre === 'string' ? contacto.contacto_nombre
                            : (typeof contacto.nombre === 'string' ? contacto.nombre
                            : (typeof contacto.tecnico === 'string' ? contacto.tecnico : '-')));

                        const cTelefono = typeof contacto.distribuidor_contacto_telefono === 'string' ? contacto.distribuidor_contacto_telefono
                            : (typeof contacto.telefono === 'string' ? contacto.telefono
                            : (typeof contacto.tel === 'string' ? contacto.tel : '-'));

                        const cCorreo = typeof contacto.distribuidor_contacto_correo === 'string' ? contacto.distribuidor_contacto_correo
                            : (typeof contacto.correo === 'string' ? contacto.correo
                            : (typeof contacto.email === 'string' ? contacto.email : '-'));

                        return {
                            id: s.id,
                            nombre: s.nombre,
                            tienda: s.tienda,
                            cuenta: s.cuenta,
                            ciudad: s.ciudad,
                            direccion: s.direccion,
                            no_totvs: s.no_totvs,
                            adc: siteAdc,
                            region: contacto.region || '-',
                            responsable: contacto.responsable || '-',
                            distribuidor: distName,
                            distribuidor_contacto_nombre: cNombre,
                            distribuidor_contacto_telefono: cTelefono,
                            distribuidor_contacto_correo: cCorreo,
                            contacto_operativo: contacto,
                            activosCount: s.activos?.length || 0
                        };
                    })
                };
            });

            return mapped;
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
                        include: { activos: true },
                        orderBy: { nombre: 'asc' }
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
                        tienda: s.tienda,
                        cuenta: s.cuenta,
                        ciudad: s.ciudad,
                        direccion: s.direccion,
                        no_totvs: s.no_totvs,
                        region: contacto.region || '-',
                        responsable: contacto.responsable || '-',
                        distribuidor: s.distribuidor || '-',
                        distribuidor_contacto_nombre: contacto.distribuidor_contacto_nombre || '-',
                        distribuidor_contacto_telefono: contacto.distribuidor_contacto_telefono || '-',
                        distribuidor_contacto_correo: contacto.distribuidor_contacto_correo || '-',
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
                            distribuidor: sitioDto.distribuidor || null,
                            contacto_operativo: {
                                region: sitioDto.region || null,
                                responsable: sitioDto.responsable || null,
                                distribuidor_contacto_nombre: sitioDto.distribuidor_contacto_nombre || null,
                                distribuidor_contacto_telefono: sitioDto.distribuidor_contacto_telefono || null,
                                distribuidor_contacto_correo: sitioDto.distribuidor_contacto_correo || null,
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
                    distribuidor: dto.distribuidor || null,
                    contacto_operativo: {
                        region: dto.region || null,
                        responsable: dto.responsable || null,
                        distribuidor_contacto_nombre: dto.distribuidor_contacto_nombre || null,
                        distribuidor_contacto_telefono: dto.distribuidor_contacto_telefono || null,
                        distribuidor_contacto_correo: dto.distribuidor_contacto_correo || null,
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
                distribuidor: sitio.distribuidor || '-',
                distribuidor_contacto_nombre: contacto.distribuidor_contacto_nombre || '-',
                distribuidor_contacto_telefono: contacto.distribuidor_contacto_telefono || '-',
                distribuidor_contacto_correo: contacto.distribuidor_contacto_correo || '-',
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
                    ...(dto.distribuidor !== undefined && { distribuidor: dto.distribuidor }),
                    contacto_operativo: {
                        ...contactoActual,
                        ...(dto.region !== undefined && { region: dto.region }),
                        ...(dto.responsable !== undefined && { responsable: dto.responsable }),
                        ...(dto.distribuidor_contacto_nombre !== undefined && { distribuidor_contacto_nombre: dto.distribuidor_contacto_nombre }),
                        ...(dto.distribuidor_contacto_telefono !== undefined && { distribuidor_contacto_telefono: dto.distribuidor_contacto_telefono }),
                        ...(dto.distribuidor_contacto_correo !== undefined && { distribuidor_contacto_correo: dto.distribuidor_contacto_correo }),
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
                distribuidor: sitio.distribuidor || '-',
                distribuidor_contacto_nombre: contacto.distribuidor_contacto_nombre || '-',
                distribuidor_contacto_telefono: contacto.distribuidor_contacto_telefono || '-',
                distribuidor_contacto_correo: contacto.distribuidor_contacto_correo || '-',
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

    async exportarExcel() {
        const db = this.getDb();
        const clientes = await db.cliente.findMany({
            include: {
                sitios: {
                    include: { activos: true },
                    orderBy: { nombre: 'asc' }
                },
                activos: true
            },
            orderBy: { razon_social: 'asc' }
        });

        const workbook = new ExcelJS.Workbook();
        const sheetClientes = workbook.addWorksheet('Clientes');
        sheetClientes.columns = [
            { header: 'ID Cliente', key: 'id', width: 25 },
            { header: 'Razón Social', key: 'razonSocial', width: 35 },
            { header: 'RFC', key: 'rfc', width: 20 },
            { header: 'Estatus', key: 'estatus', width: 15 },
            { header: 'Clave ADC', key: 'adc', width: 15 },
            { header: 'Moneda Preferida', key: 'moneda', width: 15 },
            { header: 'Ciudad', key: 'ciudad', width: 20 },
            { header: 'Estado', key: 'estado_fiscal', width: 20 },
            { header: 'Total Sitios', key: 'sitiosCount', width: 15 },
            { header: 'Total Activos', key: 'activosCount', width: 15 },
        ];

        clientes.forEach(c => {
            const comercial = (c.datos_comerciales as any) || {};
            const fiscal = (c.datos_fiscales as any) || {};
            sheetClientes.addRow({
                id: c.id,
                razonSocial: c.razon_social,
                rfc: c.rfc || '-',
                estatus: c.estado || 'ACTIVO',
                adc: comercial.adc || '-',
                moneda: comercial.moneda || 'MXN',
                ciudad: fiscal.ciudad || '-',
                estado_fiscal: fiscal.estado || '-',
                sitiosCount: c.sitios?.length || 0,
                activosCount: c.activos?.length || 0,
            });
        });

        const sheetDistribuidores = workbook.addWorksheet('Distribuidores y Sitios');
        sheetDistribuidores.columns = [
            { header: 'Cliente', key: 'cliente', width: 30 },
            { header: 'Sitio', key: 'sitio', width: 25 },
            { header: 'No. TOTVS', key: 'no_totvs', width: 15 },
            { header: 'Dirección', key: 'direccion', width: 35 },
            { header: 'Responsable', key: 'responsable', width: 25 },
            { header: 'Distribuidor', key: 'distribuidor', width: 25 },
            { header: 'Contacto Distribuidor', key: 'contacto_nombre', width: 25 },
            { header: 'Tel. Distribuidor', key: 'contacto_telefono', width: 20 },
            { header: 'Correo Distribuidor', key: 'contacto_correo', width: 25 },
            { header: 'Total Sitios (Cliente)', key: 'total_sitios', width: 20 },
            { header: 'Total Activos (Cliente)', key: 'total_activos', width: 20 },
            { header: 'Moneda (Cliente)', key: 'moneda', width: 15 },
        ];

        clientes.forEach(c => {
            c.sitios?.forEach(s => {
                const contacto = (s.contacto_operativo as any) || {};
                sheetDistribuidores.addRow({
                    cliente: c.razon_social,
                    sitio: s.nombre,
                    no_totvs: s.no_totvs || '-',
                    direccion: s.direccion || '-',
                    responsable: contacto.responsable || '-',
                    distribuidor: s.distribuidor || '-',
                    contacto_nombre: contacto.distribuidor_contacto_nombre || '-',
                    contacto_telefono: contacto.distribuidor_contacto_telefono || '-',
                    contacto_correo: contacto.distribuidor_contacto_correo || '-',
                    total_sitios: c.sitios?.length || 0,
                    total_activos: c.activos?.length || 0,
                    moneda: ((c.datos_comerciales as any) || {}).moneda || 'MXN'
                });
            });
        });

        // Style headers
        [sheetClientes, sheetDistribuidores].forEach(sheet => {
            sheet.getRow(1).font = { bold: true };
            sheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE5222D' }, // Red theme
            };
            sheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
        });

        return workbook;
    }
}
