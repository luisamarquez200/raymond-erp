import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PrismaDynamicService } from '../../database/prisma-dynamic.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    async create(createUserDto: CreateUserDto, organization_id: string, currentUser?: any) {
        // Validate if user exists in the organization (active or soft-deleted)
        const existingAnyUser = await this.prisma.users.findFirst({
            where: {
                email: createUserDto.email,
                organization_id,
            },
        });

        if (existingAnyUser && existingAnyUser.deleted_at === null) {
            throw new ConflictException('El correo ya se encuentra registrado en el sistema');
        }

        // Validate that role belongs to the organization
        const role = await this.prisma.roles.findFirst({
            where: {
                id: createUserDto.role_id,
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

        // SECURITY: CEO cannot create users with roles higher than level 90
        if (currentUser && currentUser.isCEO && !currentUser.isSuperadmin && role.level > 90) {
            throw new ForbiddenException('CEO cannot create users with roles higher than level 90');
        }

        // SECURITY: CEO cannot create users with level 100+ roles
        if (role.level >= 100 && (!currentUser || !currentUser.isSuperadmin)) {
            throw new ForbiddenException('Only Superadmin can create users with level 100 or higher roles');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

        // Sanitize optional fields
        const supervisor_id = createUserDto.supervisor_id && createUserDto.supervisor_id.trim() !== '' ? createUserDto.supervisor_id.trim() : null;
        const auxiliar_id = createUserDto.auxiliar_id && createUserDto.auxiliar_id.trim() !== '' ? createUserDto.auxiliar_id.trim() : null;
        const supervisor_name = createUserDto.supervisor_name && createUserDto.supervisor_name.trim() !== '' ? createUserDto.supervisor_name.trim() : null;
        const auxiliar_name = createUserDto.auxiliar_name && createUserDto.auxiliar_name.trim() !== '' ? createUserDto.auxiliar_name.trim() : null;
        const adc_asociado_name = createUserDto.adc_asociado_name && createUserDto.adc_asociado_name.trim() !== '' && createUserDto.adc_asociado_name.trim() !== 'ninguno' ? createUserDto.adc_asociado_name.trim() : null;
        const ubicacion = createUserDto.ubicacion && createUserDto.ubicacion.trim() !== '' ? createUserDto.ubicacion.trim() : null;

        let user: any;

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
                    organization_id,
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

        // Synchronize into ComercialR4PDN.usuarios
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
                        bloqueado: !user.is_active,
                    },
                    create: {
                        id: user.id,
                        correo: user.email,
                        nombre: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
                        rol: role.name || 'USUARIO',
                        adc_asociado_name: user.adc_asociado_name || null,
                        auxiliar_name: user.auxiliar_name || null,
                        bloqueado: false,
                    },
                });
            }
        } catch (err: any) {}

        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
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
                    },
                },
            },
            orderBy: {
                created_at: 'desc', // Fixed: snake_case
            },
        });

        console.log(`[UsersService.findAll] Found ${users.length} users`);

        // Remove passwords from response
        return users.map(({ password, ...user }) => user);
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
                    },
                },
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }

    async update(id: string, updateUserDto: UpdateUserDto, organization_id: string | null, currentUser: any) {
        // CRITICAL: Handle SuperAdmin without organization context
        const isSuperadmin = currentUser?.isSuperadmin === true || currentUser?.roles === 'Superadmin';

        // Build where clause - handle SuperAdmin without org
        const where: any = {
            id,
            deleted_at: null,
        };

        // For SuperAdmin, allow updating their own profile even without organization
        if (isSuperadmin && !organization_id && id === currentUser?.id) {
            // SuperAdmin updating their own profile - no organization filter
            where.organization_id = null;
        } else if (organization_id) {
            // Regular user or SuperAdmin with org - filter by organization
            where.organization_id = organization_id;
        } else {
            // Regular user without organization - should not happen, but handle gracefully
            throw new BadRequestException('User has no organization assigned');
        }

        // Find user
        const user = await this.prisma.users.findFirst({
            where,
        });

        if (!user) {
            // More detailed error message
            if (isSuperadmin && !organization_id) {
                throw new NotFoundException(`User with ID ${id} not found. SuperAdmin users may need to select an organization.`);
            }
            throw new NotFoundException(`User with ID ${id} not found in your organization`);
        }

        // Prevent self-deactivation (users can't deactivate themselves)
        if (updateUserDto.is_active === false && id === currentUser.id) {
            throw new ForbiddenException('You cannot deactivate your own account');
        }

        // If email is being updated, check uniqueness
        if (updateUserDto.email && updateUserDto.email !== user.email) {
            // Build where clause for email uniqueness check
            const emailCheckWhere: any = {
                email: updateUserDto.email,
                deleted_at: null,
                NOT: { id },
            };

            // For SuperAdmin without org, check globally
            if (isSuperadmin && !organization_id) {
                // Check if email exists in any organization
                emailCheckWhere.organization_id = null;
            } else if (organization_id) {
                emailCheckWhere.organization_id = organization_id;
            }

            const existingUser = await this.prisma.users.findFirst({
                where: emailCheckWhere,
            });

            if (existingUser) {
                throw new ConflictException('Email already exists');
            }
        }

        // If role is being updated, validate it belongs to organization
        if (updateUserDto.role_id && updateUserDto.role_id !== user.role_id) {
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

            // SECURITY: CEO cannot assign users to roles higher than level 90
            if (currentUser && currentUser.isCEO && !currentUser.isSuperadmin && role.level > 90) {
                throw new ForbiddenException('CEO cannot assign users to roles higher than level 90');
            }

            // SECURITY: Only Superadmin can assign level 100+ roles
            if (role.level >= 100 && (!currentUser || !currentUser.isSuperadmin)) {
                throw new ForbiddenException('Only Superadmin can assign users to level 100 or higher roles');
            }
        }

        // SECURITY: Prevent password updates through regular update endpoint
        // Password changes must go through the dedicated change-password endpoint
        if (updateUserDto.password) {
            throw new BadRequestException('Password cannot be updated through this endpoint. Use /users/:id/change-password instead.');
        }

        const updateData: any = { ...updateUserDto };
        
        // Sanitize empty strings to null for relation fields
        if (updateData.supervisor_id === "") updateData.supervisor_id = null;
        if (updateData.auxiliar_id === "") updateData.auxiliar_id = null;
        // Optionally sanitize empty names if they shouldn't be empty strings
        if (updateData.supervisor_name === "") updateData.supervisor_name = null;
        if (updateData.auxiliar_name === "") updateData.auxiliar_name = null;
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
                        bloqueado: updatedUser.is_active === false,
                    },
                    create: {
                        id: updatedUser.id,
                        correo: updatedUser.email,
                        nombre: `${updatedUser.first_name || ''} ${updatedUser.last_name || ''}`.trim() || updatedUser.email,
                        rol: updatedUser.roles?.name || 'USUARIO',
                        adc_asociado_name: updatedUser.adc_asociado_name || null,
                        auxiliar_name: updatedUser.auxiliar_name || null,
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
