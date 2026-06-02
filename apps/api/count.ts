import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const c = await prisma.clienteR4.count();
  const s = await prisma.sitio.count();
  const a = await prisma.activo.count();
  const r = await prisma.renta.count();
  const om = await prisma.ordenMensual.count();
  
  console.log(`Clientes: ${c}`);
  console.log(`Sitios: ${s}`);
  console.log(`Activos: ${a}`);
  console.log(`Rentas: ${r}`);
  console.log(`OrdenesMensuales: ${om}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
