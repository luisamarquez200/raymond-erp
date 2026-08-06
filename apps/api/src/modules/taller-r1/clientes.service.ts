import { PrismaClient as PrismaR1 } from '@prisma/client-taller-r1';
import { Injectable } from '@nestjs/common';
import { PrismaDynamicService } from '../../database/prisma-dynamic.service';
import { v4 as uuidv4 } from 'uuid';

export interface CreateClienteDto {
    id_documento?: string;
    nombre_cliente: string;
    rfc?: string;
    persona_contacto?: string;
    telefono?: number;
    razon_social?: string;
    calle?: string;
    numero_calle?: string;
    ciudad?: string;
    cp?: string;
}

@Injectable()
export class ClientesService {
    constructor(private prisma: PrismaDynamicService) { }

    private get db(): PrismaR1 {
        return this.prisma.client;
    }

    async findAll() {
        return this.db.cliente.findMany({
            orderBy: { nombre_cliente: 'asc' }
        });
    }

    async findOne(id: string) {
        return this.db.cliente.findUnique({
            where: { id_cliente: id },
        });
    }

    async create(data: CreateClienteDto) {
        return this.db.cliente.create({
            data: {
                id_cliente: uuidv4(),
                ...data,
            },
        });
    }

    async update(id: string, data: Partial<CreateClienteDto>) {
        return this.db.cliente.update({
            where: { id_cliente: id },
            data,
        });
    }

    async remove(id: string) {
        return this.db.cliente.delete({
            where: { id_cliente: id },
        });
    }
}
