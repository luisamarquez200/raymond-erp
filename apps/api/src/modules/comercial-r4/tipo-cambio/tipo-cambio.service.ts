import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaDynamicService } from '../../../database/prisma-dynamic.service';
import { UpsertTipoCambioDto } from './dto/tipo-cambio.dto';

const DEFAULT_FALLBACK_RATE = 18.0;

@Injectable()
export class TipoCambioService {
    private readonly logger = new Logger(TipoCambioService.name);

    constructor(private readonly prismaService: PrismaDynamicService) {}

    private getDb() {
        const db = PrismaDynamicService.clients.r4;
        if (!db) throw new Error('Database client for R4 not initialized');
        return db;
    }

    /**
     * Get configured exchange rate for a specific (year, month).
     * If not configured, returns the latest active rate or fallback (18.0).
     */
    async getRateForPeriod(year: number, month: number): Promise<number> {
        try {
            const db = this.getDb();
            const config = await db.tipoCambioMensual.findUnique({
                where: {
                    year_month: { year: Number(year), month: Number(month) }
                }
            });

            if (config && config.activo && config.tipo_cambio > 0) {
                return config.tipo_cambio;
            }

            // Try to find latest active rate
            const latest = await db.tipoCambioMensual.findFirst({
                where: { activo: true },
                orderBy: [{ year: 'desc' }, { month: 'desc' }]
            });

            return latest?.tipo_cambio || DEFAULT_FALLBACK_RATE;
        } catch (error) {
            this.logger.error(`Error fetching exchange rate for ${year}-${month}:`, error);
            return DEFAULT_FALLBACK_RATE;
        }
    }

    /**
     * List all registered monthly exchange rates with optional filter by year.
     */
    async findAll(year?: number) {
        try {
            const db = this.getDb();
            const whereClause = year ? { year: Number(year) } : {};
            return await db.tipoCambioMensual.findMany({
                where: whereClause,
                orderBy: [{ year: 'desc' }, { month: 'desc' }],
                include: {
                    historial: {
                        orderBy: { fecha: 'desc' },
                        take: 5
                    }
                }
            });
        } catch (error) {
            this.logger.error('Error fetching all monthly exchange rates:', error);
            return [];
        }
    }

    /**
     * Upsert (Create or Update) exchange rate for (year, month).
     * Audits change in TipoCambioHistorial.
     */
    async upsertRate(dto: UpsertTipoCambioDto, userId?: string, userName?: string) {
        const db = this.getDb();
        const year = Number(dto.year);
        const month = Number(dto.month);
        const newRate = Number(dto.tipo_cambio);

        const existing = await db.tipoCambioMensual.findUnique({
            where: {
                year_month: { year, month }
            }
        });

        const previousRate = existing ? existing.tipo_cambio : null;
        const finalUserName = userName || dto.usuario_nombre || 'Sistema';

        let record;
        if (existing) {
            record = await db.tipoCambioMensual.update({
                where: { id: existing.id },
                data: {
                    tipo_cambio: newRate,
                    activo: dto.activo !== undefined ? dto.activo : existing.activo,
                    usuario_modificacion_id: userId || null,
                    usuario_nombre: finalUserName
                }
            });
        } else {
            record = await db.tipoCambioMensual.create({
                data: {
                    year,
                    month,
                    tipo_cambio: newRate,
                    activo: dto.activo !== undefined ? dto.activo : true,
                    usuario_modificacion_id: userId || null,
                    usuario_nombre: finalUserName
                }
            });
        }

        // Record Audit Trail in TipoCambioHistorial
        await db.tipoCambioHistorial.create({
            data: {
                tipo_cambio_id: record.id,
                year,
                month,
                valor_anterior: previousRate,
                valor_nuevo: newRate,
                usuario_id: userId || null,
                usuario_nombre: finalUserName,
                motivo: dto.motivo || (existing ? 'Actualización de tipo de cambio' : 'Registro inicial de tipo de cambio')
            }
        });

        return record;
    }

    /**
     * Retrieve full audit history of exchange rate changes.
     */
    async getHistorial(year?: number, month?: number) {
        try {
            const db = this.getDb();
            const whereClause: any = {};
            if (year) whereClause.year = Number(year);
            if (month) whereClause.month = Number(month);

            return await db.tipoCambioHistorial.findMany({
                where: whereClause,
                orderBy: { fecha: 'desc' },
                take: 100
            });
        } catch (error) {
            this.logger.error('Error fetching exchange rate history:', error);
            return [];
        }
    }
}
