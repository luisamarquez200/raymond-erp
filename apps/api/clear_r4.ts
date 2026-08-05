import { PrismaClient } from '@prisma/client-comercial';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const db = new PrismaClient({
  datasources: {
    db: {
      url: process.env.COMERCIAL_R4_DATABASE_URL,
    },
  },
});

async function main() {
  console.log('--- Iniciando borrado de datos R4 (Conservando Usuarios) ---');
  
  try {
    console.log('Borrando CargaMasivaLog...');
    await db.cargaMasivaLog.deleteMany({});
    
    // console.log('Borrando ActivoAccesorio...');
    // await db.activoAccesorio.deleteMany({});
    
    console.log('Borrando CambioSitioLog...');
    await db.cambioSitioLog.deleteMany({});
    
    console.log('Borrando Documento...');
    await db.documento.deleteMany({});

    console.log('Borrando OrdenMensual...');
    await db.ordenMensual.deleteMany({});
    
    console.log('Borrando DetallesRenta...');
    await db.detallesRenta.deleteMany({});

    console.log('Borrando Renta...');
    await db.renta.deleteMany({});
    
    console.log('Borrando Contrato...');
    await db.contrato.deleteMany({});
    
    console.log('Borrando Tarifa...');
    await db.tarifa.deleteMany({});

    console.log('Borrando Activo (Flotilla)...');
    await db.activo.deleteMany({});
    
    console.log('Borrando Sitio...');
    await db.sitio.deleteMany({});
    
    console.log('Borrando Cliente...');
    await db.cliente.deleteMany({});

    console.log('Borrando Auditoria...');
    await db.auditoria.deleteMany({});

    console.log('--- ¡Borrado completado con éxito! ---');
  } catch (error) {
    console.error('Error durante el borrado:', error);
  } finally {
    await db.$disconnect();
  }
}

main();
