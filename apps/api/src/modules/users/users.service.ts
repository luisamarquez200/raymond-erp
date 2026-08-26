import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException, UnauthorizedException, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PrismaDynamicService } from '../../database/prisma-dynamic.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService implements OnModuleInit {
    private readonly logger = new Logger(UsersService.name);

    constructor(private prisma: PrismaService) { }

    async onModuleInit() {
        // Automatic background sync on startup/deployment to guarantee avatars & users in ComercialR4PDN
        setTimeout(async () => {
            try {
                await this.syncAllUsersToR4();
            } catch (e: any) {
                this.logger.warn(`Startup sync to ComercialR4PDN: ${e?.message}`);
            }
        }, 5000);
    }

    async syncAllUsersToR4() {
        try {
            await PrismaDynamicService.ensureClientsInitialized();
            const dbR4 = PrismaDynamicService.clients.r4;
            if (!dbR4) return;

            const users = await this.prisma.users.findMany({
                where: {
                    deleted_at: null,
                },
                include: {
                    roles: true,
                },
            });

            for (const user of users) {
                if (user.email) {
                    await dbR4.usuario.upsert({
                        where: { correo: user.email },
                        update: {
                            nombre: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
                            rol: user.roles?.name || 'USUARIO',
                            adc_asociado_name: user.adc_asociado_name || null,
                            auxiliar_name: user.auxiliar_name || null,
                            avatar_url: user.avatar_url || null,
                            bloqueado: !user.is_active,
                        },
                        create: {
                            id: user.id,
                            correo: user.email,
                            nombre: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
                            rol: user.roles?.name || 'USUARIO',
                            adc_asociado_name: user.adc_asociado_name || null,
                            auxiliar_name: user.auxiliar_name || null,
                            avatar_url: user.avatar_url || null,
                            bloqueado: !user.is_active,
                        },
                    });
                }
            }
            this.logger.log(`✔️ Sincronización automática de usuarios y avatares completada en ComercialR4PDN (${users.length} usuarios)`);
        } catch (err: any) {
            this.logger.warn(`Error en sincronización inicial de usuarios a ComercialR4PDN: ${err?.message}`);
        }
    }

    async create(createUserDto: CreateUserDto, organization_id: string, currentUser?: any) {
        // Validate if user exists in the organization (active or soft-deleted)
        const existingAnyUser = await this.prisma.users.findFirst({
            where: {
                email: createUserDto.email,
                ...(organization_id ? { organization_id } : {}),
            },
        });

        if (existingAnyUser && existingAnyUser.deleted_at === null) {
            throw new ConflictException('El correo ya se encuentra registrado en el sistema');
        }

        // Validate that role exists in the organization
        const role = await this.prisma.roles.findFirst({
            where: {
                id: createUserDto.role_id,
                ...(organization_id ? { organization_id } : {}),
            },
        });

        if (!role) {
            throw new BadRequestException('Role not found or does not belong to this organization');
        }

        // CRITICAL SECURITY: Only Superadmin can assign Superadmin role
        if (role.name === 'Superadmin' && (!currentUser || !currentUser.isSuperadmin)) {
            throw new ForbiddenException('Only Superadmin users can assign the Superadmin role');
        }

        // SECURITY: CEO cannot create users with roles higher than level 90
        if (currentUser && currentUser.isCEO && !currentUser.isSuperadmin && (role.level || 0) > 90) {
            throw new ForbiddenException('CEO cannot create users with roles higher than level 90');
        }

        // SECURITY: CEO cannot create users with level 100+ roles
        if ((role.level || 0) >= 100 && (!currentUser || !currentUser.isSuperadmin)) {
            throw new ForbiddenException('Only Superadmin can create users with level 100 or higher roles');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

        // Sanitize optional fields to avoid PostgreSQL UUID / FK violations with empty strings
        const supervisor_id = createUserDto.supervisor_id && createUserDto.supervisor_id.trim() !== '' ? createUserDto.supervisor_id.trim() : null;
        const auxiliar_id = createUserDto.auxiliar_id && createUserDto.auxiliar_id.trim() !== '' ? createUserDto.auxiliar_id.trim() : null;
        const supervisor_name = createUserDto.supervisor_name && createUserDto.supervisor_name.trim() !== '' ? createUserDto.supervisor_name.trim() : null;
        const auxiliar_name = createUserDto.auxiliar_name && createUserDto.auxiliar_name.trim() !== '' ? createUserDto.auxiliar_name.trim() : null;
        const adc_asociado_name = createUserDto.adc_asociado_name && createUserDto.adc_asociado_name.trim() !== '' && createUserDto.adc_asociado_name.trim() !== 'ninguno' ? createUserDto.adc_asociado_name.trim() : null;
        const ubicacion = createUserDto.ubicacion && createUserDto.ubicacion.trim() !== '' ? createUserDto.ubicacion.trim() : null;

        let user: any;

        try {
            // If previously soft-deleted, reactivate and update the record
            if (existingAnyUser && existingAnyUser.deleted_at !== null) {
                user = await this.prisma.users.update({
                    where: { id: existingAnyUser.id },
                    data: {
                        email: createUserDto.email,
                        password: hashedPassword,
                        first_name: createUserDto.first_name,
                        last_name: createUserDto.last_name,
                        role_id: createUserDto.role_id,
                        is_active: true,
                        deleted_at: null,
                        ubicacion,
                        adc_asociado_name,
                        supervisor_id,
                        supervisor_name,
                        auxiliar_id,
                        auxiliar_name,
                        updated_at: new Date(),
                    } as any,
                    include: {
                        roles: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                });
            } else {
                // Create brand new user
                user = await this.prisma.users.create({
                    data: {
                        id: require('crypto').randomUUID(),
                        email: createUserDto.email,
                        password: hashedPassword,
                        first_name: createUserDto.first_name,
                        last_name: createUserDto.last_name,
                        organization_id: organization_id || null,
                        role_id: createUserDto.role_id,
                        is_active: true,
                        ubicacion,
                        adc_asociado_name,
                        supervisor_id,
                        supervisor_name,
                        auxiliar_id,
                        auxiliar_name,
                        updated_at: new Date(),
                    } as any,
                    include: {
                        roles: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                });
            }

            // Synchronize into ComercialR4PDN.usuarios for direct management & persistence
            try {
                const dbR4 = PrismaDynamicService.clients.r4;
                if (dbR4 && user.email) {
                    await dbR4.usuario.upsert({
                        where: { correo: user.email },
                        update: {
                            nombre: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
                            rol: role.name || 'USUARIO',
                            adc_asociado_name: user.adc_asociado_name || null,
                            auxiliar_name: user.auxiliar_name || null,
                            avatar_url: user.avatar_url || null,
                            bloqueado: !user.is_active,
                        },
                        create: {
                            id: user.id,
                            correo: user.email,
                            nombre: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
                            rol: role.name || 'USUARIO',
                            adc_asociado_name: user.adc_asociado_name || null,
                            auxiliar_name: user.auxiliar_name || null,
                            avatar_url: user.avatar_url || null,
                            bloqueado: false,
                        },
                    });
                }
            } catch (err: any) {
                // Non-blocking sync warning
            }

            // Remove password from response
            const { password, ...userWithoutPassword } = user;
            return userWithoutPassword;
        } catch (error: any) {
            if (error.code === 'P2002') {
                throw new ConflictException('El correo ya se encuentra registrado en el sistema');
            }
            if (error.code === 'P2003') {
                throw new BadRequestException('Uno de los identificadores asociados (supervisor, auxiliar o rol) no es válido');
            }
            throw error;
        }
    }

    async findAll(organization_id: string) {
        console.log(`[UsersService.findAll] Querying users for organization: ${organization_id}`);

        // CRITICAL: Verify tenant context is set correctly
        const { TenantContext } = await import('../../common/context/tenant.context');
        const currentTenant = TenantContext.getTenantId();
        console.log(`[UsersService.findAll] ⚠️ TENANT CHECK - Expected org: ${organization_id}, TenantContext: ${currentTenant}`);

        if (currentTenant !== organization_id) {
            console.error(`[UsersService.findAll] 🚨 CRITICAL: Tenant mismatch! Expected: ${organization_id}, Got: ${currentTenant}`);
        }

        const users = await this.prisma.users.findMany({
            where: {
                organization_id,
                deleted_at: null, // Fixed: snake_case
            },
            include: {
                roles: {
                    select: {
                        id: true,
                        name: true,
                        level: true, // Fixed: snake_case (not hierarchy_level)
                    },
                },
                supervisor: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                    },
                },
                auxiliar: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                    },
                },
            },
            orderBy: {
                created_at: 'desc', // Fixed: snake_case
            },
        });

        // Remove passwords and map roles to match frontend expectation
        return users.map(user => {
            const { password, roles, ...userWithoutPassword } = user;
            return {
                ...userWithoutPassword,
                role: roles ? {
                    id: roles.id,
                    name: roles.name,
                    level: roles.level, // Fixed: snake_case (not hierarchy_level)
                } : null,
            };
        });
    }

    async findOne(id: string, organization_id: string) {
        const user = await this.prisma.users.findFirst({
            where: {
                id,
                organization_id,
                deleted_at: null, // Fixed: snake_case
            },
            include: {
                roles: {
                    select: {
                        id: true,
                        name: true,
                        level: true, // Fixed: snake_case (not hierarchy_level)
                        description: true,
                    },
                },
                supervisor: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true,
                    },
                },
                auxiliar: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true,
                    },
                },
                organizations: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Remove password and map roles to match frontend expectation
        const { password, roles, organizations, ...userWithoutPassword } = user;
        return {
            ...userWithoutPassword,
            role: roles ? {
                id: roles.id,
                name: roles.name,
                level: roles.level, // Fixed: snake_case (not hierarchy_level)
                description: roles.description,
            } : null,
            organization: organizations,
        };
    }

    async update(id: string, updateUserDto: UpdateUserDto, organization_id: string, currentUser?: any) {
        // Find user and verify it belongs to the organization
        const user = await this.prisma.users.findFirst({
            where: {
                id,
                organization_id,
                deleted_at: null, // Fixed: snake_case
            },
            include: {
                roles: true,
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // If email is being updated, check that it's unique
        if (updateUserDto.email && updateUserDto.email !== user.email) {
            const existingUser = await this.prisma.users.findFirst({
                where: {
                    email: updateUserDto.email,
                    organization_id,
                    deleted_at: null, // Fixed: snake_case
                    id: { not: id },
                },
            });

            if (existingUser) {
                throw new ConflictException('Email already exists in this organization');
            }
        }

        // If role is being updated, validate it
        if (updateUserDto.role_id) {
            const role = await this.prisma.roles.findFirst({
                where: {
                    id: updateUserDto.role_id,
                    organization_id,
                },
            });

            if (!role) {
                throw new BadRequestException('Role not found or does not belong to this organization');
            }

            // CRITICAL SECURITY: Only Superadmin can assign Superadmin role
            if (role.name === 'Superadmin' && (!currentUser || !currentUser.isSuperadmin)) {
                throw new ForbiddenException('Only Superadmin users can assign the Superadmin role');
            }

            // SECURITY: CEO cannot assign roles higher than level 90
            if (currentUser && currentUser.isCEO && !currentUser.isSuperadmin && (role.level || 0) > 90) {
                throw new ForbiddenException('CEO cannot assign roles higher than level 90');
            }

            // SECURITY: CEO cannot assign level 100+ roles
            if ((role.level || 0) >= 100 && (!currentUser || !currentUser.isSuperadmin)) {
                throw new ForbiddenException('Only Superadmin can assign level 100 or higher roles');
            }
        }

        // Password changes must go through the dedicated change-password endpoint
        if (updateUserDto.password) {
            throw new BadRequestException('Password cannot be updated through this endpoint. Use /users/:id/change-password instead.');
        }

        const updateData: any = { ...updateUserDto };
        
        // Sanitize empty strings to null for relation fields
        if (updateData.supervisor_id === "") updateData.supervisor_id = null;
        if (updateData.auxiliar_id === "") updateData.auxiliar_id = null;
        if (updateData.supervisor_name === "") updateData.supervisor_name = null;
        if (updateData.auxiliar_name === "") updateData.auxiliar_name = null;
        if (updateData.adc_asociado_name === "" || updateData.adc_asociado_name === "ninguno") updateData.adc_asociado_name = null;
        if (updateData.ubicacion === "") updateData.ubicacion = null;

        // Update user
        const updatedUser = await this.prisma.users.update({
            where: { id },
            data: updateData,
            include: {
                roles: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        // Synchronize into ComercialR4PDN.usuarios
        try {
            const dbR4 = PrismaDynamicService.clients.r4;
            if (dbR4 && updatedUser.email) {
                await dbR4.usuario.upsert({
                    where: { correo: updatedUser.email },
                    update: {
                        nombre: `${updatedUser.first_name || ''} ${updatedUser.last_name || ''}`.trim() || updatedUser.email,
                        rol: updatedUser.roles?.name || 'USUARIO',
                        adc_asociado_name: updatedUser.adc_asociado_name || null,
                        auxiliar_name: updatedUser.auxiliar_name || null,
                        avatar_url: updatedUser.avatar_url || null,
                        bloqueado: updatedUser.is_active === false,
                    },
                    create: {
                        id: updatedUser.id,
                        correo: updatedUser.email,
                        nombre: `${updatedUser.first_name || ''} ${updatedUser.last_name || ''}`.trim() || updatedUser.email,
                        rol: updatedUser.roles?.name || 'USUARIO',
                        adc_asociado_name: updatedUser.adc_asociado_name || null,
                        auxiliar_name: updatedUser.auxiliar_name || null,
                        avatar_url: updatedUser.avatar_url || null,
                        bloqueado: updatedUser.is_active === false,
                    },
                });
            }
        } catch (err: any) {}

        // Remove password from response
        const { password, ...userWithoutPassword } = updatedUser;
        return userWithoutPassword;
    }

    async changePassword(id: string, changePasswordDto: ChangePasswordDto, organization_id: string) {
        // Find user and verify it belongs to the organization
        const user = await this.prisma.users.findFirst({
            where: {
                id,
                organization_id,
                deleted_at: null,
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Validate current password
        const isCurrentPasswordValid = await bcrypt.compare(changePasswordDto.currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            throw new UnauthorizedException('Current password is incorrect');
        }

        // Validate new password is different from current
        const isSamePassword = await bcrypt.compare(changePasswordDto.newPassword, user.password);
        if (isSamePassword) {
            throw new BadRequestException('New password must be different from current password');
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);

        // Update password
        await this.prisma.users.update({
            where: { id },
            data: { password: hashedPassword },
        });

        return {
            success: true,
            message: 'Password changed successfully',
        };
    }

    async remove(id: string, organization_id: string, currentUserId: string) {
        // Find user and verify it belongs to the organization
        const user = await this.prisma.users.findFirst({
            where: {
                id,
                organization_id,
                deleted_at: null, // Fixed: snake_case
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Prevent self-deletion
        if (id === currentUserId) {
            throw new ForbiddenException('You cannot delete your own account');
        }

        // Soft delete: mark as inactive and set deletedAt
        const deletedUser = await this.prisma.users.update({
            where: { id },
            data: {
                is_active: false,
                deleted_at: new Date(), // Fixed: snake_case
            },
            include: {
                roles: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        // Also mark as blocked/removed in ComercialR4PDN.usuarios
        try {
            const dbR4 = PrismaDynamicService.clients.r4;
            if (dbR4 && deletedUser.email) {
                await dbR4.usuario.deleteMany({
                    where: { correo: deletedUser.email }
                });
            }
        } catch (err: any) {}

        // Remove password from response
        const { password, ...userWithoutPassword } = deletedUser;
        return userWithoutPassword;
    }
}
