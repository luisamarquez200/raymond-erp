const { PrismaClient } = require('@prisma/client-comercial');

const dbUrl = "mysql://AppSheet:U%407qV%29F%28k%5D15qQ%254H%28ie@143.198.60.56:3306/ComercialR4PDN?ssl-mode=REQUIRED&accept-invalid-certs=true";

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: dbUrl
        }
    }
});

async function main() {
    console.log('\n🔌 Agregando columnas adc_asociado_name y auxiliar_name a ComercialR4PDN.usuarios...');

    try {
        await prisma.$executeRawUnsafe(`
            ALTER TABLE usuarios 
            ADD COLUMN IF NOT EXISTS adc_asociado_name VARCHAR(255) NULL AFTER rol,
            ADD COLUMN IF NOT EXISTS auxiliar_name VARCHAR(255) NULL AFTER adc_asociado_name;
        `);
        console.log('✔️ Columnas agregadas exitosamente en MySQL ComercialR4PDN.usuarios!');
    } catch (e) {
        // In older MySQL versions without IF NOT EXISTS on ADD COLUMN, try individually
        try {
            await prisma.$executeRawUnsafe(`ALTER TABLE usuarios ADD COLUMN adc_asociado_name VARCHAR(255) NULL;`);
        } catch (e2) {
            console.log('  adc_asociado_name ya existe o fue añadido');
        }
        try {
            await prisma.$executeRawUnsafe(`ALTER TABLE usuarios ADD COLUMN auxiliar_name VARCHAR(255) NULL;`);
        } catch (e2) {
            console.log('  auxiliar_name ya existe o fue añadido');
        }
        console.log('✔️ Proceso de columnas completado.');
    }

    await prisma.$disconnect();
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
