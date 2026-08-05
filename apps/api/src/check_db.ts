import { PrismaClient } from '@prisma/client-comercial';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const db = new PrismaClient();

async function main() {
    const clientes = await db.cliente.count();
    const sitios = await db.sitio.count();
    console.log(`Clientes: ${clientes}, Sitios: ${sitios}`);
}

main().finally(() => db.$disconnect());
