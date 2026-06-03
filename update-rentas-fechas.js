const { PrismaClient } = require('@prisma/client-comercial');

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "mysql://AppSheet:U%407qV%29F%28k%5D15qQ%254H%28ie@143.198.60.56:3306/ComercialR4?ssl-mode=REQUIRED&accept-invalid-certs=true"
        }
    }
});

async function main() {
    console.log("Actualizando fechas de rentas basadas en sus órdenes mensuales...");
    
    // Obtenemos todas las rentas con sus órdenes
    const rentas = await prisma.renta.findMany({
        include: {
            ordenes: true
        }
    });

    let actualizadas = 0;

    for (const renta of rentas) {
        if (renta.ordenes && renta.ordenes.length > 0) {
            // Extraer periodos (ej. "2026-04")
            const periodos = renta.ordenes.map(o => o.periodo).sort();
            const primerPeriodo = periodos[0]; // "2026-04"
            const ultimoPeriodo = periodos[periodos.length - 1]; // "2026-06"

            const [pYearStr, pMonthStr] = primerPeriodo.split('-');
            const [uYearStr, uMonthStr] = ultimoPeriodo.split('-');

            const fechaInicio = new Date(parseInt(pYearStr), parseInt(pMonthStr) - 1, 1); // Primer día del primer mes
            
            // Último día del último mes
            const fechaFin = new Date(parseInt(uYearStr), parseInt(uMonthStr), 0); 

            await prisma.renta.update({
                where: { id: renta.id },
                data: {
                    fecha_inicio: fechaInicio,
                    fecha_fin: fechaFin
                }
            });
            actualizadas++;
        }
    }

    console.log(`Se actualizaron las fechas de ${actualizadas} rentas correctamente.`);
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
