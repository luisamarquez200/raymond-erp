"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPERATIONAL_ROLES = exports.TECHNICAL_ROLES = exports.FINANCIAL_ROLES = exports.ROLE_HIERARCHY = void 0;
exports.seedEnterpriseRoles = seedEnterpriseRoles;
async function seedEnterpriseRoles(prisma, organization_id) {
    const roles = [
        {
            name: 'CEO',
            description: 'Chief Executive Officer - Full business access',
            level: 9,
            category: 'executive',
            is_system: false,
        },
        {
            name: 'CFO',
            description: 'Chief Financial Officer - Full financial access',
            level: 8,
            category: 'financial',
            is_system: false,
        },
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
        {
            name: 'Supervisor',
            description: 'Supervisor - Oversees teams and projects',
            level: 6,
            category: 'operational',
            is_system: false,
        },
        {
            name: 'Project Manager',
            description: 'Project Manager - Manages assigned projects',
            level: 5,
            category: 'operational',
            is_system: false,
        },
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
            },
        });
        createdRoles.push(role);
        console.log(`✅ Created/Updated roles: ${role.name} (Level ${role.level})`);
    }
    return createdRoles;
}
exports.ROLE_HIERARCHY = {
    'CEO': 9,
    'CFO': 8,
    'Contador Senior': 7,
    'Gerente Operaciones': 7,
    'Supervisor': 6,
    'Project Manager': 5,
    'Developer': 3,
    'Operario': 3,
};
exports.FINANCIAL_ROLES = [
    'CEO',
    'CFO',
    'Contador Senior',
];
exports.TECHNICAL_ROLES = [
    'Developer',
];
exports.OPERATIONAL_ROLES = [
    'CEO',
    'Gerente Operaciones',
    'Supervisor',
    'Project Manager',
    'Developer',
    'Operario',
];
//# sourceMappingURL=enterprise-roles.seed.js.map