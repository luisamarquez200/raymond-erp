import { Injectable, Logger } from '@nestjs/common';
import { PrismaDynamicService } from '../../database/prisma-dynamic.service';
import * as https from 'https';

@Injectable()
export class TotvsSyncService {
    private readonly logger = new Logger(TotvsSyncService.name);

    constructor(
        private prisma: PrismaDynamicService,
    ) { }

    private get db() {
        return this.prisma.client;
    }

    async syncRefacciones() {
        const productos = await this.fetchProductos();

        const grouped = new Map<string, number>();
        for (const prod of productos) {
            const codigo = (prod.producto || '').trim();
            if (!codigo) continue;
            grouped.set(codigo, (grouped.get(codigo) || 0) + (Number(prod.cantidadTotal) || 0));
        }

        const existingList: any[] = await this.db.refacciones.findMany({
            where: { refaccion: { in: Array.from(grouped.keys()) } },
        });
        const existingMap = new Map(existingList.map((r: any) => [r.refaccion, r]));

        const toCreate: { refaccion: string; descripcion: string; precio: number; cantidad_disponible: number }[] = [];
        const toUpdate: { id: number; cantidad_disponible: number }[] = [];

        for (const [refaccion, cantidadTotal] of grouped) {
            const existing = existingMap.get(refaccion);
            if (existing) {
                toUpdate.push({ id: existing.id_refaccion, cantidad_disponible: cantidadTotal });
            } else {
                toCreate.push({ refaccion, descripcion: '', precio: 0, cantidad_disponible: cantidadTotal });
            }
        }

        let creados = 0;
        let actualizados = 0;

        if (toCreate.length > 0) {
            await this.db.refacciones.createMany({ data: toCreate });
            creados = toCreate.length;
        }

        for (const u of toUpdate) {
            await this.db.refacciones.update({
                where: { id_refaccion: u.id },
                data: { cantidad_disponible: u.cantidad_disponible },
            });
        }
        actualizados = toUpdate.length;

        return { creados, actualizados, total: productos.length, agrupados: grouped.size };
    }

    private async fetchProductos(): Promise<any[]> {
        const apiUrl = process.env.TOTVS_API_URL || '';
        const username = process.env.TOTVS_TOKEN_USERNAME || '';
        const password = process.env.TOTVS_TOKEN_PASSWORD || '';

        const basicAuth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

        const bodyData = JSON.stringify({
            de_producto: '           ',
            a_producto: '           ',
            de_deposito: '',
            a_deposito: '01',
            de_ubicacion: '',
            a_ubicacion: '',
        });

        this.logger.log(`Calling API: GET ${apiUrl}`);

        const { hostname, port, pathname } = new URL(apiUrl);

        const response = await new Promise<{ status: number; data: any }>((resolve, reject) => {
            const req = https.request(
                {
                    hostname,
                    port: Number(port) || 12405,
                    path: pathname,
                    method: 'GET',
                    rejectUnauthorized: false,
                    timeout: 60000,
                    headers: {
                        'Authorization': basicAuth,
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(bodyData),
                    },
                },
                (res) => {
                    const chunks: Buffer[] = [];
                    res.on('data', (chunk: Buffer) => chunks.push(chunk));
                    res.on('end', () => {
                        const raw = Buffer.concat(chunks).toString('utf-8');
                        resolve({ status: res.statusCode || 0, data: raw });
                    });
                },
            );
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('TOTVS API request timed out')); });
            req.write(bodyData);
            req.end();
        });

        this.logger.log(`API response status: ${response.status}`);

        if (response.status >= 400) {
            throw new Error(`TOTVS API returned ${response.status}: ${response.data}`);
        }

        const parsed = JSON.parse(response.data);
        if (Array.isArray(parsed)) return parsed;

        return [];
    }
}
