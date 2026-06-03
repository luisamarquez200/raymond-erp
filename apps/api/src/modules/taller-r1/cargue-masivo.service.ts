import { PrismaClient as PrismaR1 } from '@prisma/client-taller-r1';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaDynamicService } from '../../database/prisma-dynamic.service';

@Injectable()
export class CargueMasivoService {
    private readonly logger = new Logger(CargueMasivoService.name);

    constructor(private prisma: PrismaDynamicService) { }

    private get db(): PrismaR1 {
        return this.prisma.client;
    }

    async getAll() {
        // @ts-ignore
        return this.db.orden_base_cargue.findMany({
            orderBy: { created_at: 'desc' },
        });
    }

    async createBatch(data: any[]): Promise<void> {
        try {
            // Remove id to allow auto-increment and filter out unknown fields (basic filter)
            // Prisma createMany throws if unknown fields are present.
            // We generally can't know all valid fields at runtime easily without reflecting on the model type,
            // but we can try to facilitate common ones or accept that the frontend normalized them.

            const cleanData = data.map((row) => {
                const { id, ...rest } = row;
                // UNIFIED ACTION: Attribute the action to the currently logged in user
                if (!rest.responsable) {
                    rest.responsable = this.prisma.currentUser;
                }
                return rest;
            });

            this.logger.log(`Inserting ${cleanData.length} rows into orden_base_cargue by ${this.prisma.currentUser}`);

            // @ts-ignore
            await this.db.orden_base_cargue.createMany({
                data: cleanData,
                skipDuplicates: true,
            });
        } catch (error) {
            this.logger.error('Error in createBatch', error);
            throw error;
        }
    }

    async update(id: number, data: any) {
        const { id: _, ...updateData } = data;
        // Attribute the update action
        if (!updateData.responsable) {
            updateData.responsable = this.prisma.currentUser;
        }
        // @ts-ignore
        return this.db.orden_base_cargue.update({
            where: { id: Number(id) },
            data: updateData,
        });
    }

    async create(data: any) {
        // UNIFIED ACTION: Attribute the action to the currently logged in user
        if (!data.responsable) {
            data.responsable = this.prisma.currentUser;
        }
        // @ts-ignore
        return this.db.orden_base_cargue.create({
            data: data,
        });
    }

    async delete(id: number) {
        // @ts-ignore
        return this.db.orden_base_cargue.delete({
            where: { id: Number(id) },
        });
    }

    async deleteAll() {
        // @ts-ignore
        return this.db.orden_base_cargue.deleteMany({});
    }

    async getBySerial(serial: string) {
        // @ts-ignore
        return this.db.orden_base_cargue.findFirst({
            where: {
                OR: [
                    { serial_number: serial },
                    { serial_lot: serial }
                ]
            }
        });
    }
}
