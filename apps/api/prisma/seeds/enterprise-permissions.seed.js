"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedEnterprisePermissions = seedEnterprisePermissions;
async function seedEnterprisePermissions(prisma, organization_id) {
    const roles = await prisma.roles.findMany({
        where: { organization_id },
    });
    const roleMap = new Map(roles.map(r => [r.name, r]));
    const resources = [
        'users',
        'roles',
        'organizations',
        'settings',
        'projects',
        'tasks',
        'sprints',
        'time-tracking',
        'documents',
        'dispatches',
        'command-center',
        'finance',
        'finance.accounts',
        'finance.journal-entries',
        'finance.invoices',
        'finance.expenses',
        'finance.budgets',
        'finance.reports',
        'crm',
        'clients',
        'prospects',
        'suppliers',
        'inventory',
        'procurement',
        'analytics',
        'reports',
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
        'convert',
        'assign',
    ];
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
                },
            });
            permissions.push(permission);
        }
    }
    console.log(`✅ Created ${permissions.length} permissions`);
    const permissionMatrix = {
        'Superadmin': ['*:*'],
        'CEO': [
            'users:*', 'roles:read', 'organizations:*',
            'projects:*', 'tasks:*', 'sprints:*', 'time-tracking:*', 'documents:*',
            'finance.*:*',
            'crm:*', 'clients:*', 'prospects:*', 'suppliers:*', 'inventory:*', 'procurement:*',
            'analytics:*', 'reports:*',
            'audit-logs:read', 'notifications:*',
        ],
        'CFO': [
            'users:read',
            'projects:read',
            'finance:*',
            'finance.*:*',
            'clients:read', 'suppliers:read',
            'analytics:read', 'reports:read',
            'audit-logs:read',
        ],
        'Contador Senior': [
            'finance:*',
            'finance.*:*',
            'clients:read', 'suppliers:read',
            'analytics:read', 'reports:read',
        ],
        'Gerente Operaciones': [
            'users:read',
            'projects:*', 'tasks:*', 'sprints:*', 'time-tracking:*',
            'crm:*', 'clients:*', 'prospects:*', 'suppliers:*', 'inventory:read', 'procurement:read',
            'analytics:read',
        ],
        'Supervisor': [
            'users:read',
            'projects:read', 'projects:update',
            'tasks:*', 'sprints:read',
            'time-tracking:read', 'time-tracking:approve',
            'analytics:read',
        ],
        'Project Manager': [
            'users:read',
            'projects:read', 'projects:update',
            'tasks:*',
            'sprints:*',
            'time-tracking:read',
            'documents:*',
            'dispatches:*',
            'command-center:*',
            'prospects:read', 'prospects:update',
        ],
        'Developer': [
            'users:read',
            'projects:read',
            'tasks:read', 'tasks:update',
            'time-tracking:create', 'time-tracking:read',
            'documents:read',
        ],
        'Operario': [
            'users:read',
            'projects:read',
            'tasks:read', 'tasks:update',
            'time-tracking:create', 'time-tracking:read',
        ],
    };
    let assignedCount = 0;
    for (const [roleName, permissionPatterns] of Object.entries(permissionMatrix)) {
        const role = roleMap.get(roleName);
        if (!role || !role.id)
            continue;
        const roleId = role.id;
        await prisma.role_permissions.deleteMany({
            where: { role_id: roleId },
        });
        for (const pattern of permissionPatterns) {
            if (pattern === '*:*') {
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
            }
            else {
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
//# sourceMappingURL=enterprise-permissions.seed.js.map