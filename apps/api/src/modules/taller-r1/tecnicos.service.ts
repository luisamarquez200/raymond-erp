import { PrismaClient as PrismaR1 } from '@prisma/client-taller-r1';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaDynamicService } from '../../database/prisma-dynamic.service';

@Injectable()
export class TecnicosService {
    constructor(private prisma: PrismaDynamicService) {}

    private get db(): PrismaR1 {
        return this.prisma.r1;
    }

    async findAll() {
        return this.db.tecnicos.findMany({
            orderBy: { nombre: 'asc' },
        });
    }

    async findOne(id: string) {
        const tecnico = await this.db.tecnicos.findUnique({
            where: { id_tecnico: id },
        });
        if (!tecnico) throw new NotFoundException('Técnico no encontrado');
        return tecnico;
    }

    async create(data: { nombre: string; nivel_certificacion: string }) {
        return this.db.tecnicos.create({
            data,
        });
    }

    async update(id: string, data: { nombre?: string; nivel_certificacion?: string }) {
        return this.db.tecnicos.update({
            where: { id_tecnico: id },
            data,
        });
    }

    async remove(id: string) {
        return this.db.tecnicos.delete({
            where: { id_tecnico: id },
        });
    }
}
