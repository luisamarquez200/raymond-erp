import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaDynamicService } from '../../../database/prisma-dynamic.service';
import { PrismaService } from '../../../database/prisma.service';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AdcsService {
    private readonly logger = new Logger(AdcsService.name);

    constructor(
        private readonly prismaService: PrismaService,
    ) { }

    private getDb() {
        const db = PrismaDynamicService.clients.r4;
        if (!db) throw new Error('Database client for R4 not initialized');
        return db;
    }

    async obtenerTodos() {
        try {
            const db = this.getDb();
            // Fetch unique ADCs from activos and sitios
            const activos = await db.activo.findMany({ select: { adc: true } });
            const sitios = await db.sitio.findMany({ select: { adc: true } });
            
            const adcNames = new Set<string>();
            activos.forEach(a => {
                if (a.adc && a.adc.trim()) adcNames.add(a.adc.trim());
            });
            sitios.forEach(s => {
                if (s.adc && s.adc.trim()) adcNames.add(s.adc.trim());
            });

            // Convert to array
            const uniqueAdcs = Array.from(adcNames).sort();

            // Fetch all users to check status
            const allUsers = await this.prismaService.users.findMany({
                where: { is_active: true },
                select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                    adc_asociado_name: true,
                    email: true,
                    roles: { select: { name: true } }
                }
            });

            return uniqueAdcs.map(adcName => {
                const target = adcName.trim().toLowerCase();
                const userExists = allUsers.some(u => {
                    const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase();
                    const firstName = (u.first_name || '').trim().toLowerCase();
                    const adcAsoc = (u.adc_asociado_name || '').trim().toLowerCase();
                    const email = (u.email || '').trim().toLowerCase();

                    return fullName === target ||
                           firstName === target ||
                           (adcAsoc && (adcAsoc === target || adcAsoc.includes(target) || target.includes(adcAsoc))) ||
                           (firstName && target.startsWith(firstName)) ||
                           email === target;
                });
                return {
                    name: adcName,
                    status: userExists ? 'Usuario Creado' : 'Sin Usuario'
                };
            });
        } catch (error: any) {
            this.logger.error(`Error en obtenerTodos (ADCs): ${error.message}`);
            throw error;
        }
    }

    async obtenerResumenAdc(name: string) {
        try {
            const db = this.getDb();
            
            // 1. Get user details from main database with flexible matching
            const allUsers = await this.prismaService.users.findMany({
                where: { is_active: true },
                select: {
                    id: true,
                    email: true,
                    first_name: true,
                    last_name: true,
                    adc_asociado_name: true,
                    last_login_at: true,
                    roles: { select: { name: true } }
                }
            });

            const target = name.trim().toLowerCase();
            const user = allUsers.find(u => {
                const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase();
                const firstName = (u.first_name || '').trim().toLowerCase();
                const adcAsoc = (u.adc_asociado_name || '').trim().toLowerCase();
                const email = (u.email || '').trim().toLowerCase();

                return fullName === target || 
                       firstName === target ||
                       (adcAsoc && (adcAsoc === target || adcAsoc.includes(target) || target.includes(adcAsoc))) ||
                       (firstName && target.startsWith(firstName)) ||
                       email === target;
            });

            // 2. Get unique clients associated with this ADC from R4 database (from sitios and activos)
            const sitios = await db.sitio.findMany({
                where: { adc: name },
                include: { cliente: true }
            });

            const activos = await db.activo.findMany({
                where: { adc: name },
                include: { cliente: true }
            });

            const uniqueClientNames = new Set<string>();
            
            sitios.forEach(s => {
                if (s.cliente?.razon_social) {
                    uniqueClientNames.add(s.cliente.razon_social);
                }
            });

            activos.forEach(a => {
                if (a.cliente?.razon_social) {
                    uniqueClientNames.add(a.cliente.razon_social);
                }
            });

            return {
                name,
                email: user?.email || null,
                lastLoginAt: user?.last_login_at || null,
                clientesAsociados: Array.from(uniqueClientNames).sort(),
                totalClientes: uniqueClientNames.size
            };

        } catch (error: any) {
            this.logger.error(`Error en obtenerResumenAdc: ${error.message}`);
            throw error;
        }
    }

    async crearUsuarioAdc(dto: { name: string, email: string, password: string }, organizationId: string) {
        try {
            // First, find if the ADC role exists in this organization
            let role = await this.prismaService.roles.findFirst({
                where: { name: 'ADC', organization_id: organizationId }
            });

            if (!role) {
                // Create role if it doesn't exist
                role = await this.prismaService.roles.create({
                    data: {
                        id: uuidv4(),
                        name: 'ADC',
                        description: 'Asesor Comercial',
                        level: 2,
                        organization_id: organizationId,
                        updated_at: new Date()
                    }
                });
            }

            // Check if user email exists
            const existingEmail = await this.prismaService.users.findFirst({
                where: { email: dto.email }
            });
            if (existingEmail) {
                throw new ConflictException(`El correo ${dto.email} ya está registrado`);
            }

            // Check if user with this name already exists as ADC
            const existingName = await this.prismaService.users.findFirst({
                where: { first_name: dto.name, roles: { name: 'ADC' } }
            });
            if (existingName) {
                throw new ConflictException(`Ya existe un usuario ADC con el nombre ${dto.name}`);
            }

            const hashedPassword = await bcrypt.hash(dto.password, 10);

            const newUser = await this.prismaService.users.create({
                data: {
                    id: uuidv4(),
                    email: dto.email,
                    password: hashedPassword,
                    first_name: dto.name,
                    last_name: '', // We store the full ADC string in first_name for simplicity matching
                    role_id: role.id,
                    organization_id: organizationId,
                    is_active: true,
                    updated_at: new Date()
                }
            });

            return {
                id: newUser.id,
                name: newUser.first_name,
                email: newUser.email,
                role: 'ADC'
            };

        } catch (error: any) {
            this.logger.error(`Error en crearUsuarioAdc: ${error.message}`);
            throw error;
        }
    }

    async eliminarUsuarioAdc(name: string) {
        try {
            const user = await this.prismaService.users.findFirst({
                where: { 
                    first_name: name,
                    roles: { name: 'ADC' }
                }
            });

            if (!user) {
                throw new NotFoundException(`No se encontró un usuario ADC con el nombre ${name}`);
            }

            await this.prismaService.users.delete({
                where: { id: user.id }
            });

            return { success: true, message: 'Usuario eliminado correctamente' };
        } catch (error: any) {
            this.logger.error(`Error en eliminarUsuarioAdc: ${error.message}`);
            throw error;
        }
    }
}
