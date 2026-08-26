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
    console.log('\n🔌 Conectando a ComercialR4PDN (MySQL) para poblar tabla usuarios...');

    const initialUsers = [
        {
            correo: 'admin.comercial@raymond.com.mx',
            nombre: 'Admin Comercial',
            rol: 'Administrador',
            bloqueado: false
        },
        {
            correo: 'admin@raymond.com',
            nombre: 'Super Administrador',
            rol: 'Superadmin',
            bloqueado: false
        }
    ];

    for (const u of initialUsers) {
        const user = await prisma.usuario.upsert({
            where: { correo: u.correo },
            update: {
                nombre: u.nombre,
                rol: u.rol,
                bloqueado: u.bloqueado
            },
            create: {
                id: require('crypto').randomUUID(),
                correo: u.correo,
                nombre: u.nombre,
                rol: u.rol,
                bloqueado: u.bloqueado
            }
        });
        console.log(`✔️ Usuario sincronizado en ComercialR4PDN.usuarios: ${user.correo} (${user.rol})`);
    }

    const count = await prisma.usuario.count();
    console.log(`\n🎉 Total de usuarios en ComercialR4PDN.usuarios: ${count}`);
    await prisma.$disconnect();
}

main().catch(err => {
    console.error('Error sincronizando usuarios:', err);
    process.exit(1);
});
