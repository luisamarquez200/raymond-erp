import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { seedEnterprisePermissions } from '../../database/seeds/enterprise-permissions.seed';

@Injectable()
export class SuperadminService {
    private readonly logger = new Logger(SuperadminService.name);

    /**
     * Get all organizations in the system
     * CRITICAL: Uses direct PrismaClient to bypass tenant filtering
     */
    async getAllOrganizations() {
        const directPrisma = new PrismaClient();
        try {
            this.logger.log('[getAllOrganizations] Fetching all organizations (bypassing tenant filter)');

            const organizations = await directPrisma.organizations.findMany({
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    is_active: true,
                    created_at: true,
                    updated_at: true,
                },
                orderBy: {
                    created_at: 'desc',
                },
            });

            // CRITICAL: Count explicitly by organization_id to ensure correct filtering
            // Using _count might have issues, so we do explicit counts
            const organizationsWithCounts = await Promise.all(
                organizations.map(async (org) => {
                    const [usersCount, projectsCount, clientsCount, suppliersCount] = await Promise.all([
                        directPrisma.users.count({
                            where: {
                                organization_id: org.id,
                                deleted_at: null,
                            },
                        }),
                        directPrisma.projects.count({
                            where: {
                                organization_id: org.id,
                                deleted_at: null,
                            },
                        }),
                        directPrisma.clients.count({
                            where: {
                                organization_id: org.id,
                            },
                        }),
                        directPrisma.suppliers.count({
                            where: {
                                organization_id: org.id,
                            },
                        }),
                    ]);

                    this.logger.log(`[getAllOrganizations] Org ${org.name} (${org.id}): ${usersCount} users, ${projectsCount} projects, ${clientsCount} clients, ${suppliersCount} suppliers`);

                    return {
                        ...org,
                        _count: {
                            users: usersCount,
                            projects: projectsCount,
                            clients: clientsCount,
                            suppliers: suppliersCount,
                        },
                    };
                })
            );

            this.logger.log(`[getAllOrganizations] Found ${organizationsWithCounts.length} organizations`);
            return organizationsWithCounts;
        } finally {
            await directPrisma.$disconnect();
        }
    }

    /**
     * Get detailed information about a specific organization
     */
    async getOrganizationDetails(organizationId: string) {
        const directPrisma = new PrismaClient();
        try {
            this.logger.log(`[getOrganizationDetails] Fetching details for org: ${organizationId}`);

            const organization = await directPrisma.organizations.findUnique({
                where: { id: organizationId },
                include: {
                    users: {
                        select: {
                            id: true,
                            email: true,
                            first_name: true,
                            last_name: true,
                            is_active: true,
                            roles: {
                                select: {
                                    name: true,
                                },
                            },
                        },
                        take: 10,
                    },
                },
            });

            if (!organization) {
                throw new NotFoundException(`Organization with ID ${organizationId} not found`);
            }

            // CRITICAL: Count explicitly by organization_id to ensure correct filtering
            const [usersCount, projectsCount, clientsCount, suppliersCount, accountsPayableCount, accountsReceivableCount] = await Promise.all([
                directPrisma.users.count({
                    where: {
                        organization_id: organizationId,
                        deleted_at: null,
                    },
                }),
                directPrisma.projects.count({
                    where: {
                        organization_id: organizationId,
                        deleted_at: null,
                    },
                }),
                directPrisma.clients.count({
                    where: {
                        organization_id: organizationId,
                    },
                }),
                directPrisma.suppliers.count({
                    where: {
                        organization_id: organizationId,
                    },
                }),
                directPrisma.accounts_payable.count({
                    where: {
                        organization_id: organizationId,
                    },
                }),
                directPrisma.accounts_receivable.count({
                    where: {
                        organization_id: organizationId,
                    },
                }),
            ]);

            this.logger.log(`[getOrganizationDetails] Org ${organization.name} (${organizationId}): ${usersCount} users, ${projectsCount} projects, ${clientsCount} clients, ${suppliersCount} suppliers`);

            return {
                ...organization,
                _count: {
                    users: usersCount,
                    projects: projectsCount,
                    clients: clientsCount,
                    suppliers: suppliersCount,
                    accounts_payable: accountsPayableCount,
                    accounts_receivable: accountsReceivableCount,
                },
            };
        } finally {
            await directPrisma.$disconnect();
        }
    }

    /**
     * Create a new organization with an admin user
     * This is a transactional operation
     */
    async createOrganization(dto: CreateOrganizationDto) {
        const directPrisma = new PrismaClient();
        try {
            this.logger.log(`[createOrganization] Creating new organization: ${dto.name}`);

            // Generate slug if not provided
            const slug = dto.slug || dto.name.toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '') // Remove accents
                .replace(/[^a-z0-9-]/g, '-')
                .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

            // Validate slug format
            if (!/^[a-z0-9-]+$/.test(slug)) {
                throw new ConflictException(`Invalid slug format: "${slug}". Slug must contain only lowercase letters, numbers, and hyphens.`);
            }

            // Check if slug already exists
            const existingOrg = await directPrisma.organizations.findUnique({
                where: { slug },
            });

            if (existingOrg) {
                this.logger.warn(`[createOrganization] Slug "${slug}" already exists`);
                throw new ConflictException(`Organization with slug "${slug}" already exists`);
            }

            // Check if admin email already exists
            const existingUser = await directPrisma.users.findFirst({
                where: { email: dto.adminEmail },
            });

            if (existingUser) {
                this.logger.warn(`[createOrganization] Email "${dto.adminEmail}" already exists`);
                throw new ConflictException(`User with email "${dto.adminEmail}" already exists`);
            }

            // Hash admin password
            let hashedPassword: string;
            try {
                hashedPassword = await bcrypt.hash(dto.adminPassword, 10);
            } catch (error) {
                this.logger.error(`[createOrganization] Error hashing password:`, error);
                throw new Error('Failed to hash password');
            }

            // Create organization, admin role, and admin user in a transaction
            let result: any;
            try {
                result = await directPrisma.$transaction(async (tx) => {
                    // 1. Create organization
                    const organization = await tx.organizations.create({
                        data: {
                            id: randomUUID(),
                            name: dto.name,
                            slug,
                            is_active: true,
                            updated_at: new Date(),
                        } as any,
                    });

                    this.logger.log(`[createOrganization] Created organization: ${organization.id}`);

                    // 2. Create default roles for this organization
                    // IMPORTANT: Superadmin is a global system role, NOT created per organization
                    // CEO is the highest level role for organizations
                    const defaultRoles = [
                        { name: 'CEO', description: 'Chief Executive Officer - Full business access', level: 10, category: 'executive', is_system: false },
                        { name: 'CFO', description: 'Chief Financial Officer - Full financial access', level: 8, category: 'financial', is_system: false },
                        { name: 'Contador Senior', description: 'Senior Accountant - Full accounting access with approval rights', level: 7, category: 'financial', is_system: false },
                        { name: 'Gerente Operaciones', description: 'Operations Manager - Manages operations and projects', level: 7, category: 'operational', is_system: false },
                        { name: 'Supervisor', description: 'Supervisor - Oversees teams and projects', level: 6, category: 'operational', is_system: false },
                        { name: 'Project Manager', description: 'Project Manager - Manages assigned projects', level: 5, category: 'operational', is_system: false },
                        { name: 'Developer', description: 'Developer - Works on assigned tasks', level: 3, category: 'base', is_system: false },
                        { name: 'Operario', description: 'Operator - Executes operational tasks', level: 3, category: 'base', is_system: false },
                    ];

                    const createdRoles = [];
                    for (const roleData of defaultRoles) {
                        const role = await tx.roles.create({
                            data: {
                                id: randomUUID(),
                                name: roleData.name,
                                description: roleData.description,
                                level: roleData.level,
                                category: roleData.category,
                                is_system: roleData.is_system,
                                organization_id: organization.id,
                                updated_at: new Date(),
                            } as any,
                        });
                        createdRoles.push(role);
                    }

                    this.logger.log(`[createOrganization] Created ${createdRoles.length} default roles`);

                    // Find the CEO role to assign to the admin user (highest organizational role)
                    const ceoRole = createdRoles.find(r => r.name === 'CEO')!;

                    // 3. Create admin user with CEO role
                    const adminUser = await tx.users.create({
                        data: {
                            id: randomUUID(),
                            email: dto.adminEmail,
                            password: hashedPassword,
                            first_name: dto.adminFirstName,
                            last_name: dto.adminLastName,
                            organization_id: organization.id,
                            role_id: ceoRole.id,
                            is_active: true,
                            updated_at: new Date(),
                        } as any,
                    });

                    this.logger.log(`[createOrganization] Created admin user with CEO role: ${adminUser.id}`);

                    return { organization, adminRole: ceoRole, adminUser, allRoles: createdRoles };
                });
            } catch (error: any) {
                this.logger.error(`[createOrganization] Transaction failed:`, error);
                // Re-throw ConflictException as-is
                if (error instanceof ConflictException) {
                    throw error;
                }
                // Wrap other errors
                throw new Error(`Failed to create organization: ${error.message || 'Unknown error'}`);
            }

            // CRITICAL: Assign permissions to all roles after organization creation
            // This ensures the new organization has ALL functionalities available
            try {
                this.logger.log(`[createOrganization] Assigning permissions to roles for organization: ${result.organization.id}`);
                await seedEnterprisePermissions(directPrisma, result.organization.id);
                this.logger.log(`[createOrganization] Successfully assigned permissions to all roles`);
            } catch (error: any) {
                this.logger.error(`[createOrganization] Error assigning permissions:`, error);
                // Don't fail the entire operation if permissions fail, but log it
                // The organization and roles are already created, permissions can be assigned later
                this.logger.warn(`[createOrganization] Organization created but permissions assignment failed. You may need to assign permissions manually.`);
            }

            // CRITICAL: Initialize default modules for the new organization
            // Only essential modules are enabled by default, others can be added by SUPERADMIN
            try {
                this.logger.log(`[createOrganization] Initializing default modules for organization: ${result.organization.id}`);
                
                // Default modules configuration as requested
                const defaultModules = [
                    // MÓDULOS PRINCIPALES
                    'dashboard',        // Panel
                    'clients',          // Clientes
                    'suppliers',        // Proveedores
                    'projects',         // Proyectos
                    'sprints',          // Sprints
                    'tasks',            // Tareas
                    'command-center',   // Command Center
                    
                    // FINANZAS
                    'finance-ar',       // Cuentas por Cobrar
                    'finance-ap',       // Cuentas por Pagar
                    'finance-purchase-orders', // Órdenes de Compra
                    
                    // ADMINISTRACIÓN
                    'users',           // Usuarios
                    'roles',           // Roles y Permisos
                    'organization',    // Organización
                    
                    // HERRAMIENTAS
                    'calendar',         // Calendario
                    'settings',         // Configuración
                ];

                // Create default modules in database
                const modulesToCreate = defaultModules.map((moduleId) => ({
                    id: randomUUID(),
                    organization_id: result.organization.id,
                    module_id: moduleId,
                    is_enabled: true,
                    updated_at: new Date(),
                }));

                await directPrisma.organization_modules.createMany({
                    data: modulesToCreate as any,
                    skipDuplicates: true,
                });

                this.logger.log(`[createOrganization] Successfully initialized ${defaultModules.length} default modules`);
            } catch (error: any) {
                this.logger.error(`[createOrganization] Error initializing default modules:`, error);
                // Don't fail the entire operation if modules fail, but log it
                this.logger.warn(`[createOrganization] Organization created but default modules initialization failed. Modules can be configured manually.`);
            }

            this.logger.log(`[createOrganization] Successfully created organization: ${result.organization.id}`);

            return {
                organization: result.organization,
                admin: {
                    id: result.adminUser.id,
                    email: result.adminUser.email,
                    first_name: result.adminUser.first_name,
                    last_name: result.adminUser.last_name,
                },
            };
        } catch (error: any) {
            // Log the full error for debugging
            this.logger.error(`[createOrganization] Error:`, error);
            
            // Re-throw known exceptions as-is
            if (error instanceof ConflictException) {
                throw error;
            }
            if (error instanceof NotFoundException) {
                throw error;
            }
            
            // Wrap unknown errors with more context
            const errorMessage = error?.message || 'Unknown error occurred while creating organization';
            this.logger.error(`[createOrganization] Unexpected error: ${errorMessage}`, error?.stack);
            throw new Error(`Failed to create organization: ${errorMessage}`);
        } finally {
            await directPrisma.$disconnect();
        }
    }

    /**
     * Update an organization
     */
    async updateOrganization(organizationId: string, dto: UpdateOrganizationDto) {
        const directPrisma = new PrismaClient();
        try {
            this.logger.log(`[updateOrganization] Updating organization: ${organizationId}`);

            // Check if slug is changing and if it's already taken
            if (dto.slug) {
                const existingOrg = await directPrisma.organizations.findFirst({
                    where: {
                        slug: dto.slug,
                        id: { not: organizationId },
                    },
                });

                if (existingOrg) {
                    throw new ConflictException(`Slug "${dto.slug}" is already taken by another organization`);
                }
            }

            const organization = await directPrisma.organizations.update({
                where: { id: organizationId },
                data: dto,
            });

            this.logger.log(`[updateOrganization] Successfully updated organization: ${organizationId}`);
            return organization;
        } finally {
            await directPrisma.$disconnect();
        }
    }

    /**
     * Delete an organization and all its related data
     * CRITICAL: This operation is irreversible
     */
    async deleteOrganization(organizationId: string) {
        const directPrisma = new PrismaClient();
        try {
            this.logger.log(`[deleteOrganization] Deleting organization: ${organizationId}`);

            // Verify organization exists
            const organization = await directPrisma.organizations.findUnique({
                where: { id: organizationId },
                select: { id: true, name: true, slug: true },
            });

            if (!organization) {
                throw new NotFoundException(`Organization with ID ${organizationId} not found`);
            }

            this.logger.warn(`[deleteOrganization] WARNING: Deleting organization "${organization.name}" (${organization.slug}) and ALL related data`);

            // CRITICAL: Delete in correct order to avoid foreign key constraints
            // 1. First, delete journal_lines that reference accounts from this organization
            this.logger.log(`[deleteOrganization] Step 1: Deleting journal_lines...`);
            const journalEntriesFromOrg = await directPrisma.journal_entries.findMany({
                where: { organization_id: organizationId },
                select: { id: true },
            });
            const journalEntryIds = journalEntriesFromOrg.map(je => je.id);

            if (journalEntryIds.length > 0) {
                await directPrisma.journal_lines.deleteMany({
                    where: { journal_entry_id: { in: journalEntryIds } },
                });
                this.logger.log(`[deleteOrganization] Deleted journal_lines for ${journalEntryIds.length} journal entries`);
            }

            // 2. Now delete the organization - Prisma will cascade delete all other related records
            this.logger.log(`[deleteOrganization] Step 2: Deleting organization and cascading...`);
            await directPrisma.organizations.delete({
                where: { id: organizationId },
            });

            this.logger.log(`[deleteOrganization] Successfully deleted organization: ${organization.name}`);
            return {
                success: true,
                message: `Organization "${organization.name}" deleted successfully`,
            };
        } catch (error: any) {
            this.logger.error(`[deleteOrganization] Error deleting organization:`, error);
            throw error;
        } finally {
            await directPrisma.$disconnect();
        }
    }

    /**
     * Delete organizations by name or slug (for cleanup scripts)
     */
    async deleteOrganizationsByNames(namesOrSlugs: string[]) {
        const directPrisma = new PrismaClient();
        try {
            this.logger.log(`[deleteOrganizationsByNames] Deleting organizations: ${namesOrSlugs.join(', ')}`);

            const deleted = [];
            const notFound = [];

            for (const nameOrSlug of namesOrSlugs) {
                // Try to find by slug first, then by name
                const organization = await directPrisma.organizations.findFirst({
                    where: {
                        OR: [
                            { slug: nameOrSlug.toLowerCase().replace(/\s+/g, '-') },
                            { name: { contains: nameOrSlug, mode: 'insensitive' } },
                        ],
                    },
                    select: { id: true, name: true, slug: true },
                });

                if (organization) {
                    try {
                        await this.deleteOrganization(organization.id);
                        deleted.push(organization.name);
                    } catch (error: any) {
                        this.logger.error(`[deleteOrganizationsByNames] Failed to delete ${organization.name}:`, error);
                        notFound.push(`${organization.name} (error: ${error.message})`);
                    }
                } else {
                    notFound.push(nameOrSlug);
                }
            }

            return {
                success: true,
                deleted,
                notFound,
                message: `Deleted ${deleted.length} organization(s). ${notFound.length} not found or failed.`,
            };
        } finally {
            await directPrisma.$disconnect();
        }
    }

    /**
     * Get global system analytics
     */
    async getGlobalAnalytics() {
        const directPrisma = new PrismaClient();
        try {
            this.logger.log('[getGlobalAnalytics] Fetching global system stats');

            const [
                totalOrganizations,
                activeOrganizations,
                totalUsers,
                totalProjects,
                totalTasks,
                totalClients,
            ] = await Promise.all([
                directPrisma.organizations.count(),
                directPrisma.organizations.count({ where: { is_active: true } }),
                directPrisma.users.count(),
                directPrisma.projects.count(),
                directPrisma.tasks.count(),
                directPrisma.clients.count(),
            ]);

            return {
                organizations: {
                    total: totalOrganizations,
                    active: activeOrganizations,
                    inactive: totalOrganizations - activeOrganizations,
                },
                users: totalUsers,
                projects: totalProjects,
                tasks: totalTasks,
                clients: totalClients,
            };
        } finally {
            await directPrisma.$disconnect();
        }
    }

    /**
     * Separate organization data - assign shared data to target org or create test data
     * CRITICAL: This ensures organizations don't share clients, suppliers, etc.
     */
    async separateOrganizationData(targetOrgId: string, options: { createTestData?: boolean; reassignSharedData?: boolean } = {}) {
        const { createTestData = false, reassignSharedData = true } = options;
        const directPrisma = new PrismaClient();

        try {
            this.logger.log(`[separateOrganizationData] Separating data for organization: ${targetOrgId}`);

            // Verify organization exists
            const targetOrg = await directPrisma.organizations.findUnique({
                where: { id: targetOrgId },
            });

            if (!targetOrg) {
                throw new NotFoundException(`Organization with ID ${targetOrgId} not found`);
            }

            // Get all other organizations (to identify shared data)
            const otherOrgs = await directPrisma.organizations.findMany({
                where: { id: { not: targetOrgId } },
                select: { id: true, name: true },
            });

            const stats = {
                clientsReassigned: 0,
                suppliersReassigned: 0,
                testClientsCreated: 0,
                testSuppliersCreated: 0,
            };

            // CRITICAL: First, check if there are any clients/suppliers that should belong to target org
            // but are incorrectly assigned to another org (likely sharing RUN's org_id)
            // We'll identify and fix these by checking if they appear to belong to target org

            // 1. Check current clients count for target org (correctly assigned)
            const currentClientsCount = await directPrisma.clients.count({
                where: { organization_id: targetOrgId },
            });

            this.logger.log(`[separateOrganizationData] Target org ${targetOrg.name} currently has ${currentClientsCount} clients`);

            // CRITICAL FIX: The real problem is that ACME is seeing RUN's clients because
            // they might be sharing the same organization_id or the counts are being calculated incorrectly.
            // We need to verify that ALL clients/providers are correctly assigned.
            
            // Check ALL clients to see which orgs they're assigned to
            const allClients = await directPrisma.clients.findMany({
                select: {
                    id: true,
                    nombre: true,
                    organization_id: true,
                },
                take: 100, // Limit for performance
            });

            // Check ALL suppliers
            const allSuppliers = await directPrisma.suppliers.findMany({
                select: {
                    id: true,
                    nombre: true,
                    organization_id: true,
                },
                take: 100,
            });

            this.logger.log(`[separateOrganizationData] Total clients in DB: ${allClients.length}`);
            this.logger.log(`[separateOrganizationData] Total suppliers in DB: ${allSuppliers.length}`);
            
            // Verify counts match
            const clientsForTargetOrg = allClients.filter(c => c.organization_id === targetOrgId);
            const suppliersForTargetOrg = allSuppliers.filter(s => s.organization_id === targetOrgId);
            
            this.logger.log(`[separateOrganizationData] Clients for ${targetOrg.name} (${targetOrgId}): ${clientsForTargetOrg.length}`);
            this.logger.log(`[separateOrganizationData] Suppliers for ${targetOrg.name} (${targetOrgId}): ${suppliersForTargetOrg.length}`);
            
            // Log which orgs have which data
            const clientsByOrg = allClients.reduce((acc, c) => {
                acc[c.organization_id] = (acc[c.organization_id] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            
            const suppliersByOrg = allSuppliers.reduce((acc, s) => {
                acc[s.organization_id] = (acc[s.organization_id] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            
            this.logger.log(`[separateOrganizationData] Clients by organization_id:`, clientsByOrg);
            this.logger.log(`[separateOrganizationData] Suppliers by organization_id:`, suppliersByOrg);

            // 2. If reassignSharedData is true, remove duplicate clients/suppliers from target org
            // that already exist in other organizations (to prevent data duplication)
            if (reassignSharedData && otherOrgs.length > 0) {
                // Get all client names from other organizations (normalized for comparison)
                const otherOrgIds = otherOrgs.map(o => o.id);
                const otherOrgClients = await directPrisma.clients.findMany({
                    where: { organization_id: { in: otherOrgIds } },
                    select: { nombre: true },
                });
                
                // Create a map of normalized names to original names for case-insensitive comparison
                const otherOrgClientNamesNormalized = new Map<string, string[]>();
                otherOrgClients.forEach(c => {
                    const normalized = c.nombre.toLowerCase().trim();
                    if (!otherOrgClientNamesNormalized.has(normalized)) {
                        otherOrgClientNamesNormalized.set(normalized, []);
                    }
                    otherOrgClientNamesNormalized.get(normalized)!.push(c.nombre);
                });

                // Get all clients from target org and check for duplicates
                if (otherOrgClientNamesNormalized.size > 0) {
                    const targetOrgClients = await directPrisma.clients.findMany({
                        where: { organization_id: targetOrgId },
                        select: { id: true, nombre: true },
                    });

                    const duplicateClients = targetOrgClients.filter(c => {
                        const normalized = c.nombre.toLowerCase().trim();
                        return otherOrgClientNamesNormalized.has(normalized);
                    });

                    if (duplicateClients.length > 0) {
                        this.logger.log(`[separateOrganizationData] Found ${duplicateClients.length} duplicate clients in ${targetOrg.name} that exist in other orgs. Removing...`);
                        for (const client of duplicateClients) {
                            // Check if there are related records (projects, invoices, etc.) before deleting
                            const hasRelatedData = await Promise.all([
                                directPrisma.projects.count({ where: { client_id: client.id } }),
                                directPrisma.accounts_receivable.count({ where: { client_id: client.id } }),
                                directPrisma.invoices.count({ where: { client_id: client.id } }),
                            ]).then(results => results.some(count => count > 0));

                            if (!hasRelatedData) {
                                await directPrisma.clients.delete({ where: { id: client.id } });
                                stats.clientsReassigned++; // Track removals
                                this.logger.log(`[separateOrganizationData] Removed duplicate client: ${client.nombre}`);
                            } else {
                                this.logger.warn(`[separateOrganizationData] Cannot remove client ${client.nombre} - has related data. Consider renaming instead.`);
                            }
                        }
                    }
                }

                // Do the same for suppliers
                const otherOrgSuppliers = await directPrisma.suppliers.findMany({
                    where: { organization_id: { in: otherOrgIds } },
                    select: { nombre: true },
                });

                const otherOrgSupplierNamesNormalized = new Map<string, string[]>();
                otherOrgSuppliers.forEach(s => {
                    const normalized = s.nombre.toLowerCase().trim();
                    if (!otherOrgSupplierNamesNormalized.has(normalized)) {
                        otherOrgSupplierNamesNormalized.set(normalized, []);
                    }
                    otherOrgSupplierNamesNormalized.get(normalized)!.push(s.nombre);
                });

                if (otherOrgSupplierNamesNormalized.size > 0) {
                    const targetOrgSuppliers = await directPrisma.suppliers.findMany({
                        where: { organization_id: targetOrgId },
                        select: { id: true, nombre: true },
                    });

                    const duplicateSuppliers = targetOrgSuppliers.filter(s => {
                        const normalized = s.nombre.toLowerCase().trim();
                        return otherOrgSupplierNamesNormalized.has(normalized);
                    });

                    if (duplicateSuppliers.length > 0) {
                        this.logger.log(`[separateOrganizationData] Found ${duplicateSuppliers.length} duplicate suppliers in ${targetOrg.name} that exist in other orgs. Removing...`);
                        for (const supplier of duplicateSuppliers) {
                            // Check if there are related records before deleting
                            const hasRelatedData = await Promise.all([
                                directPrisma.accounts_payable.count({ where: { supplier_id: supplier.id } }),
                                directPrisma.purchase_orders.count({ where: { supplier_id: supplier.id } }),
                            ]).then(results => results.some(count => count > 0));

                            if (!hasRelatedData) {
                                await directPrisma.suppliers.delete({ where: { id: supplier.id } });
                                stats.suppliersReassigned++; // Track removals
                                this.logger.log(`[separateOrganizationData] Removed duplicate supplier: ${supplier.nombre}`);
                            } else {
                                this.logger.warn(`[separateOrganizationData] Cannot remove supplier ${supplier.nombre} - has related data. Consider renaming instead.`);
                            }
                        }
                    }
                }
            }

            // 3. Create test clients ONLY if target org has NO clients and createTestData is true
            // This ensures Acme gets its own test data without touching RUN's data
            if (createTestData && currentClientsCount === 0) {
                // Create test clients specifically for this organization
                const testClients = [
                    { nombre: `Cliente Prueba ${targetOrg.name} 1`, email: `cliente1@${targetOrg.slug}.test`, rfc: `${targetOrg.slug.toUpperCase().slice(0, 3)}010101ABC`, is_active: true },
                    { nombre: `Cliente Prueba ${targetOrg.name} 2`, email: `cliente2@${targetOrg.slug}.test`, rfc: `${targetOrg.slug.toUpperCase().slice(0, 3)}020202DEF`, is_active: true },
                    { nombre: `Cliente Prueba ${targetOrg.name} 3`, email: `cliente3@${targetOrg.slug}.test`, rfc: `${targetOrg.slug.toUpperCase().slice(0, 3)}030303GHI`, is_active: true },
                ];

                for (const client of testClients) {
                    await directPrisma.clients.create({
                        data: {
                            id: randomUUID(),
                            ...client,
                            organization_id: targetOrgId,
                            created_at: new Date(),
                            updated_at: new Date(),
                        } as any,
                    });
                }
                stats.testClientsCreated = testClients.length;
                this.logger.log(`[separateOrganizationData] Created ${testClients.length} test clients for ${targetOrg.name}`);
            }

            // 4. Check current suppliers count for target org (after potential cleanup)
            const currentSuppliersCount = await directPrisma.suppliers.count({
                where: { organization_id: targetOrgId },
            });

            this.logger.log(`[separateOrganizationData] Target org ${targetOrg.name} currently has ${currentSuppliersCount} suppliers`);

            // 5. Create test suppliers ONLY if target org has NO suppliers and createTestData is true
            // This ensures Acme gets its own test data without touching RUN's data
            if (createTestData && currentSuppliersCount === 0) {
                // Create test suppliers specifically for this organization
                const testSuppliers = [
                    { nombre: `Proveedor Prueba ${targetOrg.name} 1`, email: `proveedor1@${targetOrg.slug}.test`, rfc: `${targetOrg.slug.toUpperCase().slice(0, 3)}PROV001ABC`, is_active: true },
                    { nombre: `Proveedor Prueba ${targetOrg.name} 2`, email: `proveedor2@${targetOrg.slug}.test`, rfc: `${targetOrg.slug.toUpperCase().slice(0, 3)}PROV002DEF`, is_active: true },
                ];

                for (const supplier of testSuppliers) {
                    await directPrisma.suppliers.create({
                        data: {
                            id: randomUUID(),
                            ...supplier,
                            organization_id: targetOrgId,
                            created_at: new Date(),
                            updated_at: new Date(),
                        } as any,
                    });
                }
                stats.testSuppliersCreated = testSuppliers.length;
                this.logger.log(`[separateOrganizationData] Created ${testSuppliers.length} test suppliers for ${targetOrg.name}`);
            }

            this.logger.log(`[separateOrganizationData] Completed separation for ${targetOrg.name}`);
            return {
                success: true,
                organization: targetOrg,
                stats,
            };
        } finally {
            await directPrisma.$disconnect();
        }
    }
}
