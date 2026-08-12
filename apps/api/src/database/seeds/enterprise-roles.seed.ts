import { PrismaClient } from '@prisma/client';

/**
 * Enterprise Role Seeds
 * 
 * Seeds the specific roles requested by the user with hierarchy levels and categories
 */

export async function seedEnterpriseRoles(prisma: PrismaClient, organization_id: string) {
    // NOTE: Superadmin is NOT included here because it's a GLOBAL role,
    // not an organization-specific role. Superadmin users exist outside of organizations.
    // The highest role within an organization is CEO (Level 9).
    const roles = [
        // Level 9: C-Level Executives (HIGHEST IN ORGANIZATION)
        {
            name: 'CEO',
            description: 'Chief Executive Officer - Full business access',
            level: 9,
            category: 'executive',
            is_system: false,
        },

        // Level 8: Department Heads
        {
            name: 'CFO',
            description: 'Chief Financial Officer - Full financial access',
            level: 8,
            category: 'financial',
            is_system: false,
        },

        // Level 7: Senior Management
        {
            name: 'Contador Senior',
            description: 'Senior Accountant - Full accounting access with approval rights',
            level: 7,
            category: 'financial',
            is_system: false,
        },
        {
            name: 'Gerente Operaciones',
            description: 'Operations Manager - Manages operations and projects',
            level: 7,
            category: 'operational',
            is_system: false,
        },

        // Level 6: Mid-Level Management
        {
            name: 'Supervisor',
            description: 'Supervisor - Oversees teams and projects',
            level: 6,
            category: 'operational',
            is_system: false,
        },

        // Level 5: Project Management
        {
            name: 'Project Manager',
            description: 'Project Manager - Manages assigned projects',
            level: 5,
            category: 'operational',
            is_system: false,
        },

        // Level 3: Base Users
        {
            name: 'Developer',
            description: 'Developer - Works on assigned tasks',
            level: 3,
            category: 'base',
            is_system: false,
        },
        {
            name: 'Operario',
            description: 'Operator - Executes operational tasks',
            level: 3,
            category: 'base',
            is_system: false,
        },
        {
            name: 'Administrador',
            description: 'Administrator - Full system access',
            level: 9,
            category: 'executive',
            is_system: false,
        },
        {
            name: 'ADC',
            description: 'Asesor Comercial',
            level: 2,
            category: 'operational',
            is_system: false,
        },
        {
            name: 'Gerente',
            description: 'Gerente - Merged manager role',
            level: 7,
            category: 'operational',
            is_system: false,
        },
        {
            name: 'Auxiliar',
            description: 'Auxiliar / Becario CN',
            level: 1,
            category: 'operational',
            is_system: false,
        },
    ];

    const createdRoles = [];

    for (const roleData of roles) {
        const role = await prisma.roles.upsert({
            where: {
                name_organization_id: {
                    name: roleData.name,
                    organization_id,
                },
            },
            update: {
                description: roleData.description,
                level: roleData.level,
                category: roleData.category,
                is_system: roleData.is_system,
            },
            create: {
                id: require('crypto').randomUUID(),
                name: roleData.name,
                description: roleData.description,
                level: roleData.level,
                category: roleData.category,
                is_system: roleData.is_system,
                organization_id,
                updated_at: new Date(),
            } as any,
        });

        createdRoles.push(role);
        console.log(`✅ Created/Updated roles: ${role.name} (Level ${role.level})`);
    }

    return createdRoles;
}

/**
 * Role Hierarchy Helper (Organization Roles Only)
 * NOTE: Superadmin is NOT included as it's a global role, not an organization role
 */
export const ROLE_HIERARCHY = {
    'CEO': 9,
    'CFO': 8,
    'Contador Senior': 7,
    'Gerente Operaciones': 7,
    'Supervisor': 6,
    'Project Manager': 5,
    'Developer': 3,
    'Operario': 3,
};

/**
 * Financial Roles (have access to financial data within organization)
 * NOTE: Superadmin is handled separately as a global role
 */
export const FINANCIAL_ROLES = [
    'CEO',
    'CFO',
    'Contador Senior',
];

/**
 * Technical Roles (have access to technical modules)
 */
export const TECHNICAL_ROLES = [
    'Developer',
];

/**
 * Operational Roles (have access to operations)
 */
export const OPERATIONAL_ROLES = [
    'CEO',
    'Gerente Operaciones',
    'Supervisor',
    'Project Manager',
    'Developer',
    'Operario',
];
