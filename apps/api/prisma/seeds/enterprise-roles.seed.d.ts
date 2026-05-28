import { PrismaClient } from '@prisma/client';
export declare function seedEnterpriseRoles(prisma: PrismaClient, organization_id: string): Promise<any[]>;
export declare const ROLE_HIERARCHY: {
    CEO: number;
    CFO: number;
    'Contador Senior': number;
    'Gerente Operaciones': number;
    Supervisor: number;
    'Project Manager': number;
    Developer: number;
    Operario: number;
};
export declare const FINANCIAL_ROLES: string[];
export declare const TECHNICAL_ROLES: string[];
export declare const OPERATIONAL_ROLES: string[];
