import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Wiping R4 data...');
  // Delete in correct order to respect foreign key constraints
  await prisma.ordenMensual.deleteMany({});
  await prisma.renta.deleteMany({});
  await prisma.activo.deleteMany({});
  
  await prisma.sitio.deleteMany({});
  await prisma.clienteR4.deleteMany({});
  
  console.log('Wipe complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
