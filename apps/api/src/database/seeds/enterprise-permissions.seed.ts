import { PrismaClient } from '@prisma/client';
import { FINANCIAL_ROLES } from './enterprise-roles.seed';

/**
 * Enterprise Permission Matrix Seeds
 * 
 * Creates comprehensive permissions for all 12 roles across all modules
 */

export async function seedEnterprisePermissions(prisma: PrismaClient, organization_id: string) {
    // Get all roles
    const roles = await prisma.roles.findMany({
        where: { organization_id },
    });

    const roleMap = new Map(roles.map(r => [r.name, r]));

    // Define all resources and actions
    const resources = [
        // Core
        'users',
        'roles',
        'organizations',
        'settings',

        // Projects
        'projects',
        'tasks',
        'sprints',
        'time-tracking',
        'documents',

        // Command Center / Dispatches
        'dispatches',
        'command-center',

        // Finance
        'finance', // Generic finance permission for backward compatibility
        'finance.accounts',
        'finance.journal-entries',
        'finance.invoices',
        'finance.expenses',
        'finance.budgets',
        'finance.reports',

        // Operations
        'crm',
        'clients',
        'prospects',
        'suppliers',
        'inventory',
        'procurement',

        // Analytics
        'analytics',
        'reports',

        // System
        'audit-logs',
        'notifications',
        'webhooks',
    ];

    const actions = [
        'read',
        'create',
        'update',
        'delete',
        'export',
        'approve',
        'manage',
        'admin',
        'convert', // For prospects: convert to client
        'assign', // For prospects: assign to user
    ];

    // Create all permissions
    const permissions = [];
    for (const resource of resources) {
        for (const action of actions) {
            const permission = await prisma.permissions.upsert({
                where: {
                    resource_action: {
                        resource,
                        action,
                    },
                },
                update: {},
                create: {
                    id: require('crypto').randomUUID(),
                    resource,
                    action,
                    description: `${action} access to ${resource}`,
                    updated_at: new Date(),
                } as any,
            });
            permissions.push(permission);
        }
    }

    console.log(`✅ Created ${permissions.length} permissions`);

    // Permission Matrix by Role
    const permissionMatrix: Record<string, string[]> = {
        // Superadmin: ALL permissions
        'Superadmin': ['*:*'],

        // CEO: All except system admin
        'CEO': [
            'users:*', 'roles:read', 'organizations:*',
            'projects:*', 'tasks:*', 'sprints:*', 'time-tracking:*', 'documents:*',
            'finance.*:*',
            'crm:*', 'clients:*', 'prospects:*', 'suppliers:*', 'inventory:*', 'procurement:*',
            'analytics:*', 'reports:*',
            'audit-logs:read', 'notifications:*',
        ],

        // CFO: Full financial access
        'CFO': [
            'users:read',
            'projects:read', // Only project names/budgets
            'finance:*', // Generic finance permission for backward compatibility
            'finance.*:*', // All specific finance permissions
            'clients:read', 'suppliers:read', // Need to see client/supplier info for invoices/payments
            'analytics:read', 'reports:read',
            'audit-logs:read',
        ],

        // Contador Senior: Full accounting with approval
        'Contador Senior': [
            'finance:*', // Generic finance permission for backward compatibility
            'finance.*:*', // All specific finance permissions
            'clients:read', 'suppliers:read', // Need to see client/supplier info for accounting
            'analytics:read', 'reports:read',
        ],

        // Gerente Operaciones: Operations management
        'Gerente Operaciones': [
            'users:read',
            'projects:*', 'tasks:*', 'sprints:*', 'time-tracking:*',
            'crm:*', 'clients:*', 'prospects:*', 'suppliers:*', 'inventory:read', 'procurement:read',
            'analytics:read',
        ],

        // Supervisor: Team oversight, no finance
        'Supervisor': [
            'users:read',
            'projects:read', 'projects:update',
            'tasks:*', 'sprints:read',
            'time-tracking:read', 'time-tracking:approve',
            'analytics:read',
        ],

        // Project Manager: Own projects only + Command Center access
        'Project Manager': [
            'users:read',
            'projects:read', 'projects:update', // Own projects
            'tasks:*', // Own project tasks
            'sprints:*', // Own project sprints
            'time-tracking:read',
            'documents:*',
            'dispatches:*', // Command Center access
            'command-center:*', // Command Center access
            'prospects:read', 'prospects:update', // Can read and update prospects
        ],

        // Developer: Own tasks only
        'Developer': [
            'users:read',
            'projects:read',
            'tasks:read', 'tasks:update', // Own tasks
            'time-tracking:create', 'time-tracking:read', // Own time
            'documents:read',
        ],

        // Operario: Same as Developer
        'Operario': [
            'users:read',
            'projects:read',
            'tasks:read', 'tasks:update',
            'time-tracking:create', 'time-tracking:read',
        ],
    };

    // Assign permissions to roles
    let assignedCount = 0;
    for (const [roleName, permissionPatterns] of Object.entries(permissionMatrix)) {
        const role = roleMap.get(roleName);
        if (!role || !role.id) continue;

        const roleId = role.id;

        // Clear existing permissions
        await prisma.role_permissions.deleteMany({
            where: { role_id: roleId },
        });

        for (const pattern of permissionPatterns) {
            if (pattern === '*:*') {
                // Assign ALL permissions
                for (const permission of permissions) {
                    await prisma.role_permissions.upsert({
                        where: {
                            role_id_permission_id: {
                                role_id: roleId,
                                permission_id: permission.id,
                            },
                        },
                        update: {},
                        create: {
                            role_id: roleId,
                            permission_id: permission.id,
                        },
                    });
                    assignedCount++;
                }
            } else {
                // Parse pattern (e.g., "projects:*" or "finance.*:*")
                const [resourcePattern, actionPattern] = pattern.split(':');

                const matchingPermissions = permissions.filter(p => {
                    const resourceMatch = resourcePattern.endsWith('.*')
                        ? p.resource.startsWith(resourcePattern.replace('.*', ''))
                        : resourcePattern === '*' || p.resource === resourcePattern;

                    const actionMatch = actionPattern === '*' || p.action === actionPattern;

                    return resourceMatch && actionMatch;
                });

                for (const permission of matchingPermissions) {
                    await prisma.role_permissions.upsert({
                        where: {
                            role_id_permission_id: {
                                role_id: roleId,
                                permission_id: permission.id,
                            },
                        },
                        update: {},
                        create: {
                            role_id: roleId,
                            permission_id: permission.id,
                        },
                    });
                    assignedCount++;
                }
            }
        }

        console.log(`✅ Assigned permissions to ${roleName}`);
    }

    console.log(`✅ Total permissions assigned: ${assignedCount}`);
}
