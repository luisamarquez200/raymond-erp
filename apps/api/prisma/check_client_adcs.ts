import { PrismaClient } from '@prisma/client-comercial';

const prisma = new PrismaClient();

async function main() {
    const clients = await prisma.cliente.findMany({
        include: {
            sitios: true
        }
    });

    console.log("CLIENTS_DATA_START");
    clients.forEach(c => {
        console.log(`Client: ${c.razon_social}`);
        console.log(`  Comercial ADC: ${(c.datos_comerciales as any)?.adc || 'None'}`);
        c.sitios.forEach(s => {
            console.log(`    Site: ${s.nombre} | ADC: ${s.adc || 'None'}`);
        });
    });
    console.log("CLIENTS_DATA_END");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
