const { PrismaClient: PGClient } = require('@prisma/client');
const { PrismaClient: MySQLClient } = require('@prisma/client-comercial');

async function main() {
    const pg = new PGClient({
        datasources: {
            db: { url: process.env.DATABASE_URL || 'postgresql://raymond:raymond_password@localhost:5434/raymond_db' }
        }
    });

    const pdnUrl = 'mysql://AppSheet:U%407qV%29F%28k%5D15qQ%254H%28ie@143.198.60.56:3306/ComercialR4PDN?ssl-mode=REQUIRED&accept-invalid-certs=true';
    const mysql = new MySQLClient({
        datasources: {
            db: { url: pdnUrl }
        }
    });

    try {
        console.log('--- Consultando usuarios con avatar en PostgreSQL ---');
        const usersWithAvatar = await pg.users.findMany({
            where: {
                avatar_url: {
                    not: null
                }
            },
            select: { id: true, email: true, first_name: true, last_name: true, avatar_url: true }
        });

        console.log(`Encontrados en PostgreSQL: ${usersWithAvatar.length} usuarios con avatar.`);
        for (const u of usersWithAvatar) {
            console.log(`- ${u.email} (${u.first_name} ${u.last_name}): avatar largo=${u.avatar_url?.length} chars`);
        }

        console.log('\n--- Estructura de tabla usuarios en ComercialR4PDN (MySQL) ---');
        const columns = await mysql.$queryRawUnsafe('DESCRIBE usuarios');
        console.log(columns);

        const r4Users = await mysql.$queryRawUnsafe('SELECT id, correo, nombre FROM usuarios');
        console.log(`Usuarios en ComercialR4PDN: ${r4Users.length}`);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pg.$disconnect();
        await mysql.$disconnect();
    }
}

main();
