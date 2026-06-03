const { PrismaClient } = require('@prisma/client-comercial');

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "mysql://AppSheet:U%407qV%29F%28k%5D15qQ%254H%28ie@143.198.60.56:3306/ComercialR4?ssl-mode=REQUIRED&accept-invalid-certs=true"
        }
    }
});

async function main() {
    console.log("Limpiando la base de datos R4...");
    // The order of deletion is important to avoid foreign key constraint errors
    await prisma.ordenMensual.deleteMany();
    await prisma.detallesRenta.deleteMany();
    await prisma.renta.deleteMany();
    await prisma.activo.deleteMany();
    await prisma.contrato.deleteMany();
    await prisma.sitio.deleteMany();
    await prisma.cliente.deleteMany();
    await prisma.cargaMasivaLog.deleteMany();
    console.log("Datos eliminados correctamente.");
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
