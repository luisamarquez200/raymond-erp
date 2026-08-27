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

    private normalizeADCName(name: string | null | undefined): string {
        if (!name) return '';
        const cleanName = name.trim().replace(/\s+/g, ' ');
        const upperName = cleanName.toUpperCase();
        if (upperName === 'ALEJANDRA' || upperName.includes('ALEJANDRA ARELLANES')) return 'Alejandra Arellanes';
        if (upperName === 'ANDREA' || upperName.includes('ANDREA ESQUIVEL')) return 'Andrea Esquivel';
        if (upperName === 'DANIEL' || upperName.includes('DANIEL ROMERO')) return 'Daniel Romero';
        if (upperName === 'MONTSERRAT' || upperName.includes('MONTSERRAT COVARRUBIAS') || upperName.includes('MONTSE')) return 'Montserrat Covarrubias';
        if (upperName === 'SIMALÚ' || upperName === 'SIMALU' || upperName.includes('SIMALÚ LEÓN') || upperName.includes('SIMALU LEON') || upperName.includes('SIMALU') || upperName.includes('SIMALÚ')) return 'Simalú León';
        return cleanName;
    }

    private async findAdcUserAccount(adcName: string) {
        const targetNorm = this.normalizeADCName(adcName).toLowerCase();
        const rawTarget = adcName.trim().toLowerCase();

        // 1. Fetch PostgreSQL users
        const pgUsers = await this.prismaService.users.findMany({
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

        // 2. Fetch MySQL users
        let mysqlUsers: any[] = [];
        try {
            const db = this.getDb();
            mysqlUsers = await db.usuario.findMany({
                where: { bloqueado: false },
                select: { id: true, correo: true, nombre: true, rol: true }
            });
        } catch (e: any) {
            this.logger.warn(`Could not read MySQL usuarios for ADC matching: ${e.message}`);
        }

        // Check PostgreSQL users with role ADC whose name matches
        const pgAdc = pgUsers.find(u => {
            const role = (u.roles?.name || '').toLowerCase();
            if (!role.includes('adc')) return false;
            const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase();
            const normFullName = this.normalizeADCName(fullName).toLowerCase();
            return normFullName === targetNorm || fullName === rawTarget || (u.first_name && this.normalizeADCName(u.first_name).toLowerCase() === targetNorm);
        });
        if (pgAdc) {
            return {
                email: pgAdc.email,
                name: `${pgAdc.first_name || ''} ${pgAdc.last_name || ''}`.trim(),
                lastLoginAt: pgAdc.last_login_at
            };
        }

        // Check MySQL users with role ADC whose nombre matches
        const myAdc = mysqlUsers.find(u => {
            const role = (u.rol || '').toLowerCase();
            if (!role.includes('adc')) return false;
            const nombre = (u.nombre || '').trim().toLowerCase();
            const normNombre = this.normalizeADCName(nombre).toLowerCase();
            return normNombre === targetNorm || nombre === rawTarget;
        });
        if (myAdc) {
            return {
                email: myAdc.correo,
                name: myAdc.nombre,
                lastLoginAt: null
            };
        }

        // Check any PostgreSQL user who is NOT an administrator/gerente/supervisor whose name matches
        const pgAny = pgUsers.find(u => {
            const role = (u.roles?.name || '').toLowerCase();
            if (role.includes('admin') || role.includes('gerent') || role.includes('super') || role.includes('cfo') || role.includes('ceo')) return false;
            const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase();
            const normFullName = this.normalizeADCName(fullName).toLowerCase();
            return normFullName === targetNorm || fullName === rawTarget;
        });
        if (pgAny) {
            return {
                email: pgAny.email,
                name: `${pgAny.first_name || ''} ${pgAny.last_name || ''}`.trim(),
                lastLoginAt: pgAny.last_login_at
            };
        }

        return null;
    }

    async obtenerTodos() {
        try {
            const db = this.getDb();
            // Fetch unique ADCs from activos and sitios
            const activos = await db.activo.findMany({ select: { adc: true } });
            const sitios = await db.sitio.findMany({ select: { adc: true } });
            
            const adcNames = new Set<string>();
            activos.forEach(a => {
                if (a.adc && a.adc.trim()) adcNames.add(this.normalizeADCName(a.adc.trim()));
            });
            sitios.forEach(s => {
                if (s.adc && s.adc.trim()) adcNames.add(this.normalizeADCName(s.adc.trim()));
            });

            // Convert to array
            const uniqueAdcs = Array.from(adcNames).filter(Boolean).sort();

            const results = await Promise.all(uniqueAdcs.map(async (adcName) => {
                const user = await this.findAdcUserAccount(adcName);
                return {
                    name: adcName,
                    email: user?.email || null,
                    status: (user ? 'Usuario Creado' : 'Sin Usuario') as 'Usuario Creado' | 'Sin Usuario'
                };
            }));

            return results;
        } catch (error: any) {
            this.logger.error(`Error en obtenerTodos (ADCs): ${error.message}`);
            throw error;
        }
    }

    async obtenerResumenAdc(name: string) {
        try {
            const db = this.getDb();
            
            // 1. Get user details for this ADC specifically
            const user = await this.findAdcUserAccount(name);

            // 2. Get unique clients associated with this ADC from R4 database (from sitios and activos)
            const rawTarget = name.trim();
            const normTarget = this.normalizeADCName(name);

            const sitios = await db.sitio.findMany({
                where: {
                    OR: [
                        { adc: rawTarget },
                        { adc: normTarget }
                    ]
                },
                include: { cliente: true }
            });

            const activos = await db.activo.findMany({
                where: {
                    OR: [
                        { adc: rawTarget },
                        { adc: normTarget }
                    ]
                },
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
                lastLoginAt: user?.lastLoginAt || null,
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

            // Synchronize into ComercialR4PDN.usuarios for direct management & persistence
            try {
                const db = this.getDb();
                if (db) {
                    await db.usuario.upsert({
                        where: { correo: dto.email },
                        update: {
                            nombre: dto.name,
                            rol: 'ADC',
                            bloqueado: false,
                        },
                        create: {
                            id: newUser.id,
                            correo: dto.email,
                            nombre: dto.name,
                            rol: 'ADC',
                            bloqueado: false,
                        },
                    });
                }
            } catch (err: any) {
                this.logger.warn(`Could not mirror user to ComercialR4PDN: ${err.message}`);
            }

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

            // Also remove or block in ComercialR4PDN.usuarios
            try {
                const db = this.getDb();
                if (db && user.email) {
                    await db.usuario.deleteMany({
                        where: { correo: user.email }
                    });
                }
            } catch (err: any) {
                this.logger.warn(`Could not delete user from ComercialR4PDN: ${err.message}`);
            }

            return { success: true, message: 'Usuario eliminado correctamente' };
        } catch (error: any) {
            this.logger.error(`Error en eliminarUsuarioAdc: ${error.message}`);
            throw error;
        }
    }
}
