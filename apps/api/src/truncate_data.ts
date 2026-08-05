import { PrismaClient } from '@prisma/client-comercial';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const db = new PrismaClient();

async function main() {
  console.log('--- Iniciando borrado TRUNCATE de datos R4 ---');
  try {
    await db.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS = 0;`);
    const tables = [
      'cargas_masivas_logs',
      'activo_accesorios',
      'cambios_sitio',
      'documentos',
      'ordenes_mensuales',
      'detalles_renta',
      'rentas',
      'contratos',
      'tarifas',
      'activos',
      'sitios',
      'clientes',
      'auditorias'
    ];
    for (const table of tables) {
      await db.$executeRawUnsafe(`TRUNCATE TABLE \`${table}\`;`);
      console.log(`Truncada la tabla: ${table}`);
    }
    await db.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS = 1;`);
    console.log('--- ¡Borrado completado con éxito! ---');
    
    const count = await db.cliente.count();
    console.log(`Clientes count despues de truncate: ${count}`);
  } catch (error) {
    console.error('Error durante el borrado:', error);
  } finally {
    await db.$disconnect();
  }
}

main();
