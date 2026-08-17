import { PrismaClient } from '@prisma/client-comercial';

const prisma = new PrismaClient();

async function main() {
    console.log('Iniciando limpieza de base de datos comercial-r4...');

    try {
        await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=0;');

        const tablas = [
            'ordenes_mensuales',
            'detalles_renta',
            'rentas',
            'activo_accesorios',
            'cambios_sitio',
            'activos',
            'sitios',
            'clientes',
            'cargas_masivas_logs',
            'auditorias' // Opcional, pero se generan auditorías en la carga
        ];

        for (const tabla of tablas) {
            console.log(`Vaciando tabla: ${tabla}`);
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tabla};`);
        }

        await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=1;');
        
        console.log('¡Limpieza completada con éxito!');
    } catch (error) {
        console.error('Error durante la limpieza:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
