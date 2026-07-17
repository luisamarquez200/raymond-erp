import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const hashedPassword = await bcrypt.hash('Raymond2025!', 10);
    const org = await prisma.organizations.findFirst();

    if (!org) {
        console.log("No organization found. Please run regular seed first.");
        return;
    }

    // Create Administrador role
    const adminRole = await prisma.roles.upsert({
        where: { name_organization_id: { name: 'Administrador', organization_id: org.id } },
        update: {},
        create: {
            id: require('crypto').randomUUID(),
            name: 'Administrador',
            description: 'Administrador Comercial R4',
            level: 10,
            is_system: false,
            organization_id: org.id,
            updated_at: new Date()
        } as any,
    });

    // Create ADC role
    const adcRole = await prisma.roles.upsert({
        where: { name_organization_id: { name: 'ADC', organization_id: org.id } },
        update: {},
        create: {
            id: require('crypto').randomUUID(),
            name: 'ADC',
            description: 'ADC Comercial R4',
            level: 5,
            is_system: false,
            organization_id: org.id,
            updated_at: new Date()
        } as any,
    });

    // Create GERENCIA role
    const gerenciaRole = await prisma.roles.upsert({
        where: { name_organization_id: { name: 'GERENCIA', organization_id: org.id } },
        update: {},
        create: {
            id: require('crypto').randomUUID(),
            name: 'GERENCIA',
            description: 'Gerencia R4',
            level: 20,
            is_system: false,
            organization_id: org.id,
            updated_at: new Date()
        } as any,
    });

    // Create comercial.admin2@run.com
    await prisma.users.upsert({
        where: { email_organization_id: { email: 'comercial.admin2@run.com', organization_id: org.id } },
        update: {
            password: hashedPassword,
            role_id: adminRole.id,
            first_name: 'Admin',
            last_name: 'Comercial 2',
            updated_at: new Date(),
        },
        create: {
            id: '5b74fb17-1981-4711-9611-d5a816cbf99b', // Force the exact UUID from the token
            email: 'comercial.admin2@run.com',
            password: hashedPassword,
            first_name: 'Admin',
            last_name: 'Comercial 2',
            role_id: adminRole.id,
            organization_id: org.id,
            is_active: true,
            updated_at: new Date(),
        } as any,
    });

    // Create comercial.adc2@run.com
    await prisma.users.upsert({
        where: { email_organization_id: { email: 'comercial.adc2@run.com', organization_id: org.id } },
        update: {
            password: hashedPassword,
            role_id: adcRole.id,
            first_name: 'ADC',
            last_name: 'Comercial 2',
            updated_at: new Date(),
        },
        create: {
            id: require('crypto').randomUUID(),
            email: 'comercial.adc2@run.com',
            password: hashedPassword,
            first_name: 'ADC',
            last_name: 'Comercial 2',
            role_id: adcRole.id,
            organization_id: org.id,
            is_active: true,
            updated_at: new Date(),
        } as any,
    });

    // Create gerencia@run.com
    await prisma.users.upsert({
        where: { email_organization_id: { email: 'gerencia@run.com', organization_id: org.id } },
        update: {
            password: hashedPassword,
            role_id: gerenciaRole.id,
            first_name: 'Gerencia',
            last_name: 'General',
            updated_at: new Date(),
        },
        create: {
            id: '3f303c01-91a3-4601-816b-7a76542c9535', // Force the exact UUID from the token
            email: 'gerencia@run.com',
            password: hashedPassword,
            first_name: 'Gerencia',
            last_name: 'General',
            role_id: gerenciaRole.id,
            organization_id: org.id,
            is_active: true,
            updated_at: new Date(),
        } as any,
    });

    console.log("Created comercial.admin2@run.com (Administrador), comercial.adc2@run.com (ADC) and gerencia@run.com (GERENCIA)");
}

main().catch(console.error).finally(() => prisma.$disconnect());
