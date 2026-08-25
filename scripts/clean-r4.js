const { PrismaClient } = require('@prisma/client-comercial');

const dbUrl = "mysql://AppSheet:U%407qV%29F%28k%5D15qQ%254H%28ie@143.198.60.56:3306/ComercialR4PDN?ssl-mode=REQUIRED&accept-invalid-certs=true";

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: dbUrl
        }
    }
});

async function main() {
    console.log('\n🔌 Conectando a Base de Datos Comercial R4 (ComercialR4PDN)...');

    console.log('🧹 Limpiando tablas operativas (Flotilla, Rentas, Órdenes, Clientes, Sitios)...');

    // Borrado en orden de dependencias para respetar relaciones
    const ops = [
        { name: 'TipoCambioHistorial', run: () => prisma.tipoCambioHistorial.deleteMany({}) },
        { name: 'CargaMasivaLog', run: () => prisma.cargaMasivaLog.deleteMany({}) },
        { name: 'CambioSitioLog', run: () => prisma.cambioSitioLog.deleteMany({}) },
        { name: 'ActivoAccesorio', run: () => prisma.activoAccesorio.deleteMany({}) },
        { name: 'DetallesRenta', run: () => prisma.detallesRenta.deleteMany({}) },
        { name: 'OrdenMensual', run: () => prisma.ordenMensual.deleteMany({}) },
        { name: 'Renta', run: () => prisma.renta.deleteMany({}) },
        { name: 'Contrato', run: () => prisma.contrato.deleteMany({}) },
        { name: 'Tarifa', run: () => prisma.tarifa.deleteMany({}) },
        { name: 'Activo (Flotilla)', run: () => prisma.activo.deleteMany({}) },
        { name: 'Sitio', run: () => prisma.sitio.deleteMany({}) },
        { name: 'Cliente', run: () => prisma.cliente.deleteMany({}) },
        { name: 'Documento', run: () => prisma.documento.deleteMany({}) },
        { name: 'Auditoria', run: () => prisma.auditoria.deleteMany({}) },
        { name: 'FacturacionMensual', run: () => prisma.facturacionMensual.deleteMany({}) },
    ];

    for (const op of ops) {
        try {
            const res = await op.run();
            console.log(`  ✔️  ${op.name.padEnd(25)} [${res.count} registros eliminados]`);
        } catch (e) {
            console.log(`  ⚠️  ${op.name.padEnd(25)} [ERROR/OMITIDO]: ${e.message}`);
        }
    }

    const remainingUsers = await prisma.usuario.count().catch(() => 0);
    console.log(`\n👥 Usuarios conservados en R4: ${remainingUsers}`);

    await prisma.$disconnect();
    console.log('\n✨ ¡Limpieza completada con éxito en ComercialR4PDN!');
    console.log('🚀 Ya puedes ingresar a la plataforma y realizar nuevas cargas/pruebas limpias.\n');
}

main().catch(e => {
    console.error('\n❌ Error:', e);
    process.exit(1);
});
