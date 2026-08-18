import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaDynamicService } from '../../../database/prisma-dynamic.service';
import { MinioService } from '../minio/minio.service';
import { CreateRentaDto } from './dto/create-renta.dto';
import { UpdateRentaDto, UpdateDetallesRentaDto } from './dto/update-renta.dto';

@Injectable()
export class RentasService {
    private readonly logger = new Logger(RentasService.name);

    constructor(
        private readonly prismaService: PrismaDynamicService,
        private readonly minioService: MinioService,
    ) {}

    private getDb() {
        const db = PrismaDynamicService.clients.r4;
        if (!db) throw new Error('Database client for R4 not initialized');
        return db;
    }

    private mapRenta(renta: any) {
        let po = renta.orden_compra || renta.detalles?.oc_cliente;
        if (!po && renta.ordenes && renta.ordenes.length > 0) {
            const ordersWithPo = renta.ordenes.filter((o: any) => o.po && o.po.trim() !== '');
            if (ordersWithPo.length > 0) {
                const latestOrder = [...ordersWithPo].sort((a, b) => b.periodo.localeCompare(a.periodo))[0];
                po = latestOrder.po;
            }
        }

        return {
            id: renta.id,
            orden_compra: po,
            estado: renta.estado,
            origen: renta.origen,
            cliente: renta.cliente ? {
                id: renta.cliente.id,
                razonSocial: renta.cliente.razon_social,
                rfc: renta.cliente.rfc,
            } : null,
            sitio: renta.sitio ? {
                id: renta.sitio.id,
                nombre: renta.sitio.nombre,
                ciudad: renta.sitio.ciudad,
            } : null,
            activo: renta.activo ? {
                id: renta.activo.id,
                serie: renta.activo.serie,
                clase: renta.activo.clase,
                modelo: renta.activo.modelo,
                tipo: renta.activo.tipo,
                estatus: renta.activo.estatus,
                oach: renta.activo.oach,
                altura: renta.activo.altura,
                bc: renta.activo.bc,
                propietario: renta.activo.propietario,
                accesorios: renta.activo.accesorios ? renta.activo.accesorios.map((a: any) => ({
                    id: a.accesorio_id,
                    tipo_relacion: a.tipo_relacion,
                    cantidad: a.cantidad,
                    notas: a.notas,
                    serie: a.accesorio?.serie,
                    modelo: a.accesorio?.modelo,
                    tipo: a.accesorio?.tipo
                })) : []
            } : null,
            cuenta: renta.cuenta,
            adc: renta.adc,
            distribuidor: renta.distribuidor,
            no_registro_totvs: renta.no_registro_totvs,
            fecha_recepcion: renta.fecha_recepcion,
            fecha_pedido_totvs: renta.fecha_pedido_totvs,
            fecha_inicio: renta.fecha_inicio,
            fecha_fin: renta.fecha_fin,
            tarifa: renta.tarifa,
            condiciones: renta.condiciones ?? null,
            propietario: renta.propietario || renta.activo?.propietario || '-',
            detalles: renta.detalles ?? null,
            ordenes: renta.ordenes ?? [],
        };
    }

    async obtenerRentas(user?: any) {
        try {
            const db = this.getDb();
            const rentas = await db.renta.findMany({
                include: { 
                    cliente: true, 
                    sitio: true, 
                    activo: {
                        include: {
                            accesorios: { include: { accesorio: true } }
                        }
                    }, 
                    detalles: true,
                    ordenes: {
                        orderBy: { periodo: 'desc' }
                    }
                },
                orderBy: { created_at: 'desc' },
            });
            
            let mapped = rentas.map(r => this.mapRenta(r));

            const roleStr = String(user?.roles || user?.role || '').toLowerCase();
            const isAdministrator = ['administrador', 'admin', 'superadmin', 'gerente', 'coordinacion', 'coordinador'].some(r => roleStr.includes(r));
            const isAdc = !isAdministrator && !!user;

            if (isAdc) {
                const rawTarget = (user?.adc_asociado_name || user?.adcAsociadoName || `${user?.first_name || user?.firstName || ''} ${user?.last_name || user?.lastName || ''}`.trim() || user?.first_name || user?.firstName || user?.email || '').toLowerCase();
                const adcKeywords = rawTarget.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
                const firstName = (user?.first_name || user?.firstName || '').toLowerCase().trim();

                mapped = mapped.filter(r => {
                    const rAdc = (r.adc || '').toLowerCase();
                    const clientComercial = (r.cliente?.datos_comerciales as any) || {};
                    const clientAdc = (clientComercial.adc || '').toLowerCase();
                    const siteAdc = (r.sitio?.adc || '').toLowerCase();
                    return adcKeywords.some(kw => 
                        rAdc === kw || rAdc.includes(kw) || kw.includes(rAdc) ||
                        clientAdc === kw || clientAdc.includes(kw) || kw.includes(clientAdc) ||
                        siteAdc === kw || siteAdc.includes(kw) || kw.includes(siteAdc)
                    ) || (firstName && (rAdc.includes(firstName) || clientAdc.includes(firstName) || siteAdc.includes(firstName)));
                });
            }

            return mapped;
        } catch (error: any) {
            this.logger.error(`Error en obtenerRentas: ${error.message}`);
            throw error;
        }
    }

    async obtenerRentaPorId(id: string) {
        const db = this.getDb();
        const renta = await db.renta.findUnique({
            where: { id },
            include: { 
                cliente: true, 
                sitio: true, 
                activo: {
                    include: {
                        accesorios: { include: { accesorio: true } }
                    }
                }, 
                detalles: true,
                ordenes: {
                    orderBy: { periodo: 'desc' }
                }
            },
        });
        if (!renta) throw new NotFoundException(`Renta ${id} no encontrada`);
        return this.mapRenta(renta);
    }

    async previewRenta(dto: CreateRentaDto) {
        const db = this.getDb();

        const [cliente, sitio, activo] = await Promise.all([
            db.cliente.findUnique({ where: { id: dto.cliente_id } }),
            db.sitio.findUnique({ where: { id: dto.sitio_id } }),
            db.activo.findUnique({ where: { id: dto.activo_id } }),
        ]);

        if (!cliente) throw new NotFoundException(`Cliente ${dto.cliente_id} no encontrado`);
        if (!sitio) throw new NotFoundException(`Sitio ${dto.sitio_id} no encontrado`);
        if (!activo) throw new NotFoundException(`Activo ${dto.activo_id} no encontrado`);

        const rentaBase = dto.detalles?.renta_base ?? 0;
        const descuento = dto.detalles?.descuento_dias_caidos ?? 0;
        const pagoMant = dto.detalles?.mantenimiento ? (dto.detalles?.pago_mantenimiento ?? 0) : 0;
        const rentaReal = rentaBase - descuento;
        const totalConMantenimiento = rentaReal + pagoMant;

        return {
            cliente: { id: cliente.id, razonSocial: cliente.razon_social, rfc: cliente.rfc },
            sitio: { id: sitio.id, nombre: sitio.nombre, ciudad: sitio.ciudad },
            activo: { id: activo.id, serie: activo.serie, clase: activo.clase, modelo: activo.modelo },
            cuenta: dto.cuenta ?? sitio.cuenta,
            adc: dto.adc ?? sitio.adc,
            distribuidor: dto.distribuidor ?? sitio.distribuidor,
            no_registro_totvs: dto.no_registro_totvs,
            fecha_recepcion: dto.fecha_recepcion,
            fecha_pedido_totvs: dto.fecha_pedido_totvs,
            fecha_inicio: dto.fecha_inicio,
            fecha_fin: dto.fecha_fin,
            detalles: {
                ...dto.detalles,
                moneda: dto.detalles?.moneda ?? 'MXN',
                renta_base: rentaBase,
                renta_real: rentaReal,
                pago_mantenimiento: pagoMant,
                total_con_mantenimiento: totalConMantenimiento,
            },
        };
    }

    async crearRenta(dto: CreateRentaDto) {
        const db = this.getDb();

        const [activo, sitio] = await Promise.all([
            db.activo.findUnique({ where: { id: dto.activo_id } }),
            db.sitio.findUnique({ where: { id: dto.sitio_id } }),
        ]);

        if (!activo) throw new NotFoundException(`Activo ${dto.activo_id} no encontrado`);
        if (!sitio) throw new NotFoundException(`Sitio ${dto.sitio_id} no encontrado`);

        const rentaVigente = await db.renta.findFirst({
            where: { activo_id: dto.activo_id, estado: 'VIGENTE' },
        });
        if (rentaVigente) {
            throw new ConflictException(
                `El activo (serie: ${activo.serie}) ya tiene una renta VIGENTE (id: ${rentaVigente.id}). Cancélala antes de crear una nueva.`,
            );
        }

        const renta = await db.renta.create({
            data: {
                cliente_id: dto.cliente_id,
                sitio_id: dto.sitio_id,
                activo_id: dto.activo_id,
                contrato_id: dto.contrato_id ?? null,
                cuenta: dto.cuenta ?? sitio.cuenta ?? null,
                adc: dto.adc ?? sitio.adc ?? activo.adc ?? null,
                distribuidor: dto.distribuidor ?? sitio.distribuidor ?? activo.distribuidor ?? null,
                no_registro_totvs: dto.no_registro_totvs ?? null,
                fecha_recepcion: dto.fecha_recepcion ? new Date(dto.fecha_recepcion) : null,
                fecha_pedido_totvs: dto.fecha_pedido_totvs ? new Date(dto.fecha_pedido_totvs) : null,
                fecha_inicio: new Date(dto.fecha_inicio),
                fecha_fin: new Date(dto.fecha_fin),
                estado: 'VIGENTE',
                origen: 'MANUAL',
                condiciones: {
                    plazo_meses: dto.plazo_meses ?? null,
                    ...(dto.condiciones || {})
                }
            },
        });

        let detalles = null;
        if (dto.detalles) {
            const d = dto.detalles;
            const rentaReal = d.renta_real ?? ((d.renta_base ?? 0) - (d.descuento_dias_caidos ?? 0));
            detalles = await db.detallesRenta.create({
                data: {
                    renta_id: renta.id,
                    periodo_cobro: d.periodo_cobro ?? null,
                    mes_cobro: d.mes_cobro ?? null,
                    oc_cliente: d.oc_cliente ?? null,
                    tipo_renta: d.tipo_renta ?? null,
                    moneda: d.moneda ?? 'MXN',
                    renta_base: d.renta_base ?? null,
                    renta_real: rentaReal,
                    comentarios: d.comentarios ?? null,
                    mantenimiento: d.mantenimiento ?? false,
                    pago_mantenimiento: d.mantenimiento ? (d.pago_mantenimiento ?? null) : null,
                    descuento_dias_caidos: d.descuento_dias_caidos ?? 0,
                    importe_recuperado: d.importe_recuperado ?? 0,
                },
            });
        }

        this.logger.log(`Renta creada: ${renta.id} para activo ${activo.serie}`);
        return { ...renta, detalles };
    }

    async actualizarRenta(id: string, dto: UpdateRentaDto) {
        const db = this.getDb();
        const existente = await db.renta.findUnique({ where: { id } });
        if (!existente) throw new NotFoundException(`Renta ${id} no encontrada`);

        return db.renta.update({
            where: { id },
            data: {
                ...(dto.cuenta !== undefined && { cuenta: dto.cuenta }),
                ...(dto.adc !== undefined && { adc: dto.adc }),
                ...(dto.distribuidor !== undefined && { distribuidor: dto.distribuidor }),
                ...(dto.no_registro_totvs !== undefined && { no_registro_totvs: dto.no_registro_totvs }),
                ...(dto.fecha_recepcion && { fecha_recepcion: new Date(dto.fecha_recepcion) }),
                ...(dto.fecha_pedido_totvs && { fecha_pedido_totvs: new Date(dto.fecha_pedido_totvs) }),
                ...(dto.fecha_inicio && { fecha_inicio: new Date(dto.fecha_inicio) }),
                ...(dto.fecha_fin && { fecha_fin: new Date(dto.fecha_fin) }),
                ...(dto.estado && { estado: dto.estado }),
            },
        });
    }

    async actualizarDetalles(rentaId: string, dto: UpdateDetallesRentaDto) {
        const db = this.getDb();
        const renta = await db.renta.findUnique({ where: { id: rentaId } });
        if (!renta) throw new NotFoundException(`Renta ${rentaId} no encontrada`);

        const existente = await db.detallesRenta.findUnique({ where: { renta_id: rentaId } });

        const rentaBase = dto.renta_base ?? existente?.renta_base ?? 0;
        const descuento = dto.descuento_dias_caidos ?? existente?.descuento_dias_caidos ?? 0;
        const rentaReal = dto.renta_real ?? (rentaBase - descuento);
        const mantenimiento = dto.mantenimiento ?? existente?.mantenimiento ?? false;

        const data = {
            ...(dto.periodo_cobro !== undefined && { periodo_cobro: dto.periodo_cobro }),
            ...(dto.mes_cobro !== undefined && { mes_cobro: dto.mes_cobro }),
            ...(dto.oc_cliente !== undefined && { oc_cliente: dto.oc_cliente }),
            ...(dto.tipo_renta !== undefined && { tipo_renta: dto.tipo_renta }),
            ...(dto.moneda !== undefined && { moneda: dto.moneda }),
            ...(dto.renta_base !== undefined && { renta_base: dto.renta_base }),
            renta_real: rentaReal,
            ...(dto.comentarios !== undefined && { comentarios: dto.comentarios }),
            mantenimiento,
            pago_mantenimiento: mantenimiento ? (dto.pago_mantenimiento ?? existente?.pago_mantenimiento ?? null) : null,
            ...(dto.descuento_dias_caidos !== undefined && { descuento_dias_caidos: dto.descuento_dias_caidos }),
            ...(dto.importe_recuperado !== undefined && { importe_recuperado: dto.importe_recuperado }),
        };

        if (dto.renta_base !== undefined) {
            await db.renta.update({
                where: { id: rentaId },
                data: { tarifa: dto.renta_base }
            });
        }

        if (existente) {
            return db.detallesRenta.update({ where: { renta_id: rentaId }, data });
        }

        return db.detallesRenta.create({ data: { renta_id: rentaId, ...data } });
    }

    async cancelarRenta(id: string) {
        const db = this.getDb();
        const existente = await db.renta.findUnique({ where: { id } });
        if (!existente) throw new NotFoundException(`Renta ${id} no encontrada`);
        return db.renta.update({ where: { id }, data: { estado: 'CANCELADA' } });
    }

    async subirDocumento(rentaId: string, file: Express.Multer.File) {
        const db = this.getDb();
        const renta = await db.renta.findUnique({ where: { id: rentaId } });
        if (!renta) throw new NotFoundException(`Renta ${rentaId} no encontrada`);

        const ext = file.originalname.split('.').pop() || '';
        const objectKey = `rentas/${rentaId}/${Date.now()}_${file.originalname}`;

        await this.minioService.uploadFile(objectKey, file.buffer, file.mimetype);

        const documento = await db.documento.create({
            data: {
                tipo_documento: file.mimetype.startsWith('image') ? 'imagen' : 'pdf',
                modulo_relacionado: 'rentas',
                registro_id: rentaId,
                archivo_url: objectKey,
                nombre_archivo: file.originalname,
                formato: ext,
                tamano_kb: Math.round(file.size / 1024),
            },
        });

        const url_firmada = await this.minioService.getSignedUrl(objectKey);

        this.logger.log(`Documento subido para renta ${rentaId}: ${objectKey}`);
        return { ...documento, url_firmada };
    }

    async obtenerDocumentos(rentaId: string) {
        const db = this.getDb();
        const renta = await db.renta.findUnique({ where: { id: rentaId } });
        if (!renta) throw new NotFoundException(`Renta ${rentaId} no encontrada`);

        const documentos = await db.documento.findMany({
            where: { modulo_relacionado: 'rentas', registro_id: rentaId },
            orderBy: { fecha: 'desc' },
        });

        return Promise.all(
            documentos.map(async doc => ({
                id: doc.id,
                nombre_archivo: doc.nombre_archivo,
                tipo_documento: doc.tipo_documento,
                formato: doc.formato,
                tamano_kb: doc.tamano_kb,
                fecha: doc.fecha,
                url_firmada: await this.minioService.getSignedUrl(doc.archivo_url),
            })),
        );
    }
}
