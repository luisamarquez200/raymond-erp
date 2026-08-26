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
                        include: { activos: true, rentas: true },
                        orderBy: { nombre: 'asc' }
                    },
                    activos: true,
                    rentas: true
                },
                orderBy: { razon_social: 'asc' }
            });

            let filteredClientes = clientes;

            const roleStr = String(user?.roles || user?.role || '').toLowerCase();
            const isAdministrator = ['administrador', 'admin', 'superadmin', 'gerente', 'coordinacion', 'coordinador'].some(r => roleStr.includes(r));
            const isAdc = !isAdministrator && !!user;

            const buildAdcKeywords = (u: any): string[] => {
                if (!u) return [];
                const rawPieces = [
                    u.adc_asociado_name,
                    u.adcAsociadoName,
                    `${u.first_name || u.firstName || ''} ${u.last_name || u.lastName || ''}`.trim(),
                    u.first_name,
                    u.firstName,
                    u.last_name,
                    u.lastName,
                    u.email ? u.email.split('@')[0] : '',
                ].filter(Boolean);

                const keywords = new Set<string>();
                for (const piece of rawPieces) {
                    const parts = String(piece).split(',').map(p => p.trim().toLowerCase()).filter(p => p.length >= 2);
                    parts.forEach(p => keywords.add(p));
                }
                return Array.from(keywords);
            };

            const matchesKeyword = (val: string | null | undefined, keywords: string[]): boolean => {
                if (!val) return false;
                const clean = String(val).trim().toLowerCase();
                if (!clean || clean === '-' || clean === 'ninguno' || clean === 'sin adc' || clean === 'null' || clean === 'undefined') return false;
                return keywords.some(kw => clean === kw || clean.includes(kw) || kw.includes(clean));
            };

            if (isAdc) {
                const adcKeywords = buildAdcKeywords(user);

                filteredClientes = clientes.filter(cliente => {
                    const comercial = (cliente.datos_comerciales as any) || {};
                    const clientAdcMatch = matchesKeyword(comercial.adc, adcKeywords);
                    const hasMatchingSitio = cliente.sitios?.some(s => {
                        return matchesKeyword(s.adc, adcKeywords) ||
                            s.activos?.some((a: any) => matchesKeyword(a.adc, adcKeywords)) ||
                            s.rentas?.some((r: any) => matchesKeyword(r.adc, adcKeywords));
                    });
                    const hasMatchingActivo = cliente.activos?.some(a => matchesKeyword(a.adc, adcKeywords));
                    const hasMatchingRenta = cliente.rentas?.some(r => matchesKeyword(r.adc, adcKeywords));

                    return clientAdcMatch || hasMatchingSitio || hasMatchingActivo || hasMatchingRenta;
                });
            }

            let mapped = filteredClientes.map(cliente => {
                const comercial = (cliente.datos_comerciales as any) || {};
                const fiscal = (cliente.datos_fiscales as any) || {};
                
                // If user is ADC, filter sitios to only those that belong to this ADC
                let relevantSitios = cliente.sitios || [];
                let relevantActivos = cliente.activos || [];

                if (isAdc) {
                    const adcKeywords = buildAdcKeywords(user);
                    const clientAdcMatch = matchesKeyword(comercial.adc, adcKeywords);

                    relevantSitios = relevantSitios.filter((s: any) => {
                        const sMatch = matchesKeyword(s.adc, adcKeywords);
                        const sActivoMatch = s.activos?.some((a: any) => matchesKeyword(a.adc, adcKeywords));
                        const sRentaMatch = s.rentas?.some((r: any) => matchesKeyword(r.adc, adcKeywords));
                        return sMatch || sActivoMatch || sRentaMatch || (clientAdcMatch && (!s.adc || s.adc === '-'));
                    });

                    relevantActivos = relevantActivos.filter((a: any) => {
                        const aMatch = matchesKeyword(a.adc, adcKeywords);
                        return aMatch || (clientAdcMatch && (!a.adc || a.adc === '-'));
                    });
                }

                const firstSiteWithAdc = relevantSitios.find(s => s.adc);
                const firstActivoWithAdc = relevantActivos.find(a => a.adc);
                
                return {
                    id: cliente.id,
                    razonSocial: cliente.razon_social,
                    rfc: cliente.rfc || '-',
                    estatus: cliente.estado || 'ACTIVO',
                    adc: comercial.adc || firstSiteWithAdc?.adc || firstActivoWithAdc?.adc || '-',
                    moneda: comercial.moneda || 'MXN',
                    ciudad: fiscal.ciudad || '-',
                    estado_fiscal: fiscal.estado || '-',
                    sitiosCount: relevantSitios.length,
                    activosCount: relevantActivos.length,
                    sitios: relevantSitios.map(s => {
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

                        const cleanStr = (val: any): string => {
                            if (val === null || val === undefined) return '-';
                            if (typeof val === 'object') {
                                if ('text' in val && typeof val.text === 'string') return val.text.trim();
                                if ('hyperlink' in val && typeof val.hyperlink === 'string') return val.hyperlink.replace(/^mailto:/i, '').trim();
                                return '-';
                            }
                            const str = String(val).trim();
                            if (str === '[object Object]' || str === '' || str === 'null' || str === 'undefined') return '-';
                            return str;
                        };

                        // Extract distribuidor string safely
                        let distName = cleanStr(s.distribuidor);

                        // Extract contact info
                        const cNombre = cleanStr(contacto.distribuidor_contacto_nombre || contacto.contacto_nombre || contacto.nombre || contacto.tecnico);
                        const cTelefono = cleanStr(contacto.distribuidor_contacto_telefono || contacto.telefono || contacto.tel);
                        const cCorreo = cleanStr(contacto.distribuidor_contacto_correo || contacto.contacto_correo || contacto.correo || contacto.email);

                        return {
                            id: s.id,
                            nombre: s.nombre,
                            tienda: s.tienda || '-',
                            cuenta: s.cuenta || '-',
                            ciudad: s.ciudad || '-',
                            direccion: s.direccion || '-',
                            no_totvs: s.no_totvs || '-',
                            adc: cleanStr(siteAdc),
                            region: cleanStr(contacto.region),
                            responsable: cleanStr(contacto.responsable),
                            distribuidor: distName,
                            distribuidor_contacto_nombre: cNombre,
                            distribuidor_contacto_telefono: cTelefono,
                            distribuidor_contacto_correo: cCorreo,
                            contacto_operativo: {
                                ...contacto,
                                adc_correo: cleanStr(contacto.adc_correo),
                                adc_telefono: cleanStr(contacto.adc_telefono),
                                distribuidor_contacto_correo: cCorreo,
                                distribuidor_contacto_telefono: cTelefono,
                                distribuidor_contacto_nombre: cNombre
                            },
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

    async fusionarClientes(sourceId: string, targetId: string) {
        const db = this.getDb();

        if (sourceId === targetId) {
            throw new ConflictException('No puedes fusionar un cliente consigo mismo');
        }

        const [source, target] = await Promise.all([
            db.cliente.findUnique({ where: { id: sourceId }, include: { sitios: true, activos: true } }),
            db.cliente.findUnique({ where: { id: targetId } }),
        ]);

        if (!source) throw new NotFoundException(`Cliente origen ${sourceId} no encontrado`);
        if (!target) throw new NotFoundException(`Cliente destino ${targetId} no encontrado`);

        this.logger.log(`[Fusión] Migrando "${source.razon_social}" → "${target.razon_social}"`);

        // 1. Mover sitios: renombrar si ya existe uno igual en el destino
        for (const sitio of source.sitios) {
            const existe = await db.sitio.findFirst({ where: { cliente_id: targetId, nombre: sitio.nombre } });
            const nombreFinal = existe ? `${sitio.nombre} (fusionado)` : sitio.nombre;
            await db.sitio.update({ where: { id: sitio.id }, data: { cliente_id: targetId, nombre: nombreFinal } });
        }

        // 2. Mover activos
        await db.activo.updateMany({ where: { cliente_id: sourceId }, data: { cliente_id: targetId } });

        // 3. Mover rentas
        await db.renta.updateMany({ where: { cliente_id: sourceId }, data: { cliente_id: targetId } });

        // 4. Mover contratos
        await db.contrato.updateMany({ where: { cliente_id: sourceId }, data: { cliente_id: targetId } });

        // 5. Mover ordenes
        await db.ordenMensual.updateMany({ where: { cliente_id: sourceId }, data: { cliente_id: targetId } });

        // 6. Mover tarifas (si existen)
        try {
            await db.tarifa.updateMany({ where: { cliente_id: sourceId }, data: { cliente_id: targetId } });
        } catch (_) { /* tabla puede no tener este campo */ }

        // 7. Eliminar cliente origen (ya sin relaciones)
        await db.cliente.delete({ where: { id: sourceId } });

        this.logger.log(`[Fusión] Completada. Cliente "${source.razon_social}" fusionado en "${target.razon_social}"`);

        return {
            success: true,
            message: `"${source.razon_social}" fusionado exitosamente en "${target.razon_social}"`,
            targetId,
            sitiosMigrados: source.sitios.length,
            activosMigrados: source.activos.length,
        };
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

    async exportarExcel(user?: any) {
        const db = this.getDb();
        const clientes = await db.cliente.findMany({
            include: {
                sitios: {
                    include: { activos: true, rentas: true },
                    orderBy: { nombre: 'asc' }
                },
                activos: true,
                rentas: true
            },
            orderBy: { razon_social: 'asc' }
        });

        const roleStr = String(user?.roles || user?.role || '').toLowerCase();
        const isAdministrator = ['administrador', 'admin', 'superadmin', 'gerente', 'coordinacion', 'coordinador'].some(r => roleStr.includes(r));
        const isAdc = !isAdministrator && !!user;

        const buildAdcKeywords = (u: any): string[] => {
            if (!u) return [];
            const rawPieces = [
                u.adc_asociado_name,
                u.adcAsociadoName,
                `${u.first_name || u.firstName || ''} ${u.last_name || u.lastName || ''}`.trim(),
                u.first_name,
                u.firstName,
                u.last_name,
                u.lastName,
                u.email ? u.email.split('@')[0] : '',
            ].filter(Boolean);

            const keywords = new Set<string>();
            for (const piece of rawPieces) {
                const parts = String(piece).split(',').map(p => p.trim().toLowerCase()).filter(p => p.length >= 2);
                parts.forEach(p => keywords.add(p));
            }
            return Array.from(keywords);
        };

        const matchesKeyword = (val: string | null | undefined, keywords: string[]): boolean => {
            if (!val) return false;
            const clean = String(val).trim().toLowerCase();
            if (!clean || clean === '-' || clean === 'ninguno' || clean === 'sin adc' || clean === 'null' || clean === 'undefined') return false;
            return keywords.some(kw => clean === kw || clean.includes(kw) || kw.includes(clean));
        };

        let filteredClientes = clientes;
        if (isAdc) {
            const adcKeywords = buildAdcKeywords(user);

            filteredClientes = clientes.filter(cliente => {
                const comercial = (cliente.datos_comerciales as any) || {};
                const clientAdcMatch = matchesKeyword(comercial.adc, adcKeywords);
                const hasMatchingSitio = cliente.sitios?.some(s => {
                    return matchesKeyword(s.adc, adcKeywords) ||
                        s.activos?.some((a: any) => matchesKeyword(a.adc, adcKeywords)) ||
                        s.rentas?.some((r: any) => matchesKeyword(r.adc, adcKeywords));
                });
                const hasMatchingActivo = cliente.activos?.some(a => matchesKeyword(a.adc, adcKeywords));
                const hasMatchingRenta = cliente.rentas?.some(r => matchesKeyword(r.adc, adcKeywords));

                return clientAdcMatch || hasMatchingSitio || hasMatchingActivo || hasMatchingRenta;
            });
        }

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

        filteredClientes.forEach(c => {
            const comercial = (c.datos_comerciales as any) || {};
            const fiscal = (c.datos_fiscales as any) || {};

            let relevantSitios = c.sitios || [];
            let relevantActivos = c.activos || [];

            if (isAdc) {
                const rawTarget = (user?.adc_asociado_name || user?.adcAsociadoName || `${user?.first_name || user?.firstName || ''} ${user?.last_name || user?.lastName || ''}`.trim() || user?.first_name || user?.firstName || user?.email || '').toLowerCase();
                const adcKeywords = rawTarget.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
                const firstName = (user?.first_name || user?.firstName || '').toLowerCase().trim();
                const clientAdc = (comercial.adc || '').toLowerCase();
                const clientMatches = adcKeywords.some((kw: string) => clientAdc === kw || clientAdc.includes(kw) || kw.includes(clientAdc)) || (firstName && clientAdc.includes(firstName));

                relevantSitios = relevantSitios.filter((s: any) => {
                    const sAdc = (s.adc || '').toLowerCase();
                    const sActivoMatch = s.activos?.some((a: any) => {
                        const aAdc = (a.adc || '').toLowerCase();
                        return adcKeywords.some((kw: string) => aAdc === kw || aAdc.includes(kw) || kw.includes(aAdc)) || (firstName && aAdc.includes(firstName));
                    });
                    const sMatch = adcKeywords.some((kw: string) => sAdc === kw || sAdc.includes(kw) || kw.includes(sAdc)) || (firstName && sAdc.includes(firstName));
                    return sMatch || sActivoMatch || (clientMatches && (!sAdc || sAdc === '-'));
                });

                relevantActivos = relevantActivos.filter((a: any) => {
                    const aAdc = (a.adc || '').toLowerCase();
                    const aMatch = adcKeywords.some((kw: string) => aAdc === kw || aAdc.includes(kw) || kw.includes(aAdc)) || (firstName && aAdc.includes(firstName));
                    return aMatch || (clientMatches && (!aAdc || aAdc === '-'));
                });
            }

            sheetClientes.addRow({
                id: c.id,
                razonSocial: c.razon_social,
                rfc: c.rfc || '-',
                estatus: c.estado || 'ACTIVO',
                adc: comercial.adc || '-',
                moneda: comercial.moneda || 'MXN',
                ciudad: fiscal.ciudad || '-',
                estado_fiscal: fiscal.estado || '-',
                sitiosCount: relevantSitios.length,
                activosCount: relevantActivos.length,
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

        filteredClientes.forEach(c => {
            const comercial = (c.datos_comerciales as any) || {};
            let relevantSitios = c.sitios || [];
            let relevantActivos = c.activos || [];

            if (isAdc) {
                const rawTarget = (user?.adc_asociado_name || user?.adcAsociadoName || `${user?.first_name || user?.firstName || ''} ${user?.last_name || user?.lastName || ''}`.trim() || user?.first_name || user?.firstName || user?.email || '').toLowerCase();
                const adcKeywords = rawTarget.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
                const firstName = (user?.first_name || user?.firstName || '').toLowerCase().trim();
                const clientAdc = (comercial.adc || '').toLowerCase();
                const clientMatches = adcKeywords.some((kw: string) => clientAdc === kw || clientAdc.includes(kw) || kw.includes(clientAdc)) || (firstName && clientAdc.includes(firstName));

                relevantSitios = relevantSitios.filter((s: any) => {
                    const sAdc = (s.adc || '').toLowerCase();
                    const sActivoMatch = s.activos?.some((a: any) => {
                        const aAdc = (a.adc || '').toLowerCase();
                        return adcKeywords.some((kw: string) => aAdc === kw || aAdc.includes(kw) || kw.includes(aAdc)) || (firstName && aAdc.includes(firstName));
                    });
                    const sMatch = adcKeywords.some((kw: string) => sAdc === kw || sAdc.includes(kw) || kw.includes(sAdc)) || (firstName && sAdc.includes(firstName));
                    return sMatch || sActivoMatch || (clientMatches && (!sAdc || sAdc === '-'));
                });

                relevantActivos = relevantActivos.filter((a: any) => {
                    const aAdc = (a.adc || '').toLowerCase();
                    const aMatch = adcKeywords.some((kw: string) => aAdc === kw || aAdc.includes(kw) || kw.includes(aAdc)) || (firstName && aAdc.includes(firstName));
                    return aMatch || (clientMatches && (!aAdc || aAdc === '-'));
                });
            }

            relevantSitios.forEach(s => {
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
                    total_sitios: relevantSitios.length,
                    total_activos: relevantActivos.length,
                    moneda: comercial.moneda || 'MXN'
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
