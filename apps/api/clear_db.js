const { PrismaClient } = require('@prisma/client-comercial');

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing database...');
  
  // Delete in correct order to avoid foreign key constraint errors
  await prisma.documento.deleteMany();
  await prisma.cambioSitioLog.deleteMany();
  await prisma.detallesRenta.deleteMany();
  await prisma.ordenMensual.deleteMany();
  await prisma.renta.deleteMany();
  await prisma.contrato.deleteMany();
  await prisma.tarifa.deleteMany();
  await prisma.activo.deleteMany();
  await prisma.sitio.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.cargaMasivaLog.deleteMany();
  
  console.log('✅ All data cleared! (ADCs / Usuarios were kept intact)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
