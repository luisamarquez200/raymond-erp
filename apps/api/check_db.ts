import { PrismaClient } from '@prisma/client';

async function main() {
  // Conectar a la BD R4_SuperAdmin o la base principal
  const prisma = new PrismaClient();
  const orgId = "RAYMOND_MTY"; // Asumiendo el default que usamos
  
  try {
    const clientes = await prisma.cliente.count();
    const sites = await prisma.site.count();
    const rentas = await prisma.renta.count();
    const activos = await prisma.activo.count();
    
    console.log(JSON.stringify({ clientes, sites, rentas, activos }));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
