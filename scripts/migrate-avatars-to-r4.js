const mysql = require('mysql2/promise');
const { PrismaClient: PGClient } = require('@prisma/client');
require('dotenv').config({ path: __dirname + '/../apps/api/.env' });

async function main() {
    console.log('🚀 Iniciando migración de avatares/fotos a ComercialR4PDN...\n');

    // 1. Conectar a PostgreSQL
    const pg = new PGClient({
        datasources: {
            db: {
                url: process.env.DATABASE_URL || 'postgresql://raymond:raymond_password@localhost:5434/raymond_db'
            }
        }
    });

    // 2. Conectar a MySQL ComercialR4PDN
    const pdnUrl = 'mysql://AppSheet:U%407qV%29F%28k%5D15qQ%254H%28ie@143.198.60.56:3306/ComercialR4PDN';
    const mysqlConn = await mysql.createConnection(pdnUrl);

    try {
        // Asegurar que la columna avatar_url exista en MySQL usuarios (tipo LONGTEXT para soportar Base64)
        console.log('1️⃣ Verificando columna avatar_url en MySQL (ComercialR4PDN.usuarios)...');
        try {
            await mysqlConn.execute(`
                ALTER TABLE usuarios 
                ADD COLUMN avatar_url LONGTEXT NULL AFTER auxiliar_name
            `);
            console.log('  ✔️ Columna avatar_url agregada exitosamente.');
        } catch (colErr) {
            if (colErr.code === 'ER_DUP_FIELDNAME' || colErr.message?.includes('Duplicate column')) {
                console.log('  ℹ️ Columna avatar_url ya existe.');
            } else {
                console.log('  ⚠️ Nota sobre columna avatar_url:', colErr.message);
            }
        }

        // 3. Obtener usuarios de PostgreSQL
        console.log('\n2️⃣ Consultando usuarios en PostgreSQL...');
        const allPgUsers = await pg.users.findMany({
            select: {
                id: true,
                email: true,
                first_name: true,
                last_name: true,
                avatar_url: true,
            }
        });

        console.log(`  Total de usuarios en PostgreSQL: ${allPgUsers.length}`);
        const usersWithAvatar = allPgUsers.filter(u => u.avatar_url && u.avatar_url.trim().length > 0);
        console.log(`  Usuarios con foto/avatar en PostgreSQL: ${usersWithAvatar.length}`);

        for (const u of usersWithAvatar) {
            console.log(`   📸 ${u.email} (${u.first_name} ${u.last_name}) -> avatar tamaño: ${u.avatar_url.length} chars`);
        }

        // 4. Migrar a MySQL ComercialR4PDN
        console.log('\n3️⃣ Pasando avatares a MySQL ComercialR4PDN...');
        let updatedCount = 0;

        for (const u of allPgUsers) {
            if (u.avatar_url) {
                const [result] = await mysqlConn.execute(
                    `UPDATE usuarios SET avatar_url = ? WHERE correo = ? OR id = ?`,
                    [u.avatar_url, u.email, u.id]
                );
                if (result.affectedRows > 0) {
                    console.log(`  ✅ Avatar asignado a: ${u.email}`);
                    updatedCount++;
                } else {
                    console.log(`  ⚠️ Usuario ${u.email} con avatar no existe aún en ComercialR4PDN.usuarios`);
                }
            }
        }

        console.log(`\n🎉 Migración completada: ${updatedCount} avatares pasados a ComercialR4PDN.usuarios.`);

        // Comprobación final en MySQL
        const [rows] = await mysqlConn.execute(
            `SELECT correo, nombre, rol, CASE WHEN avatar_url IS NOT NULL THEN LENGTH(avatar_url) ELSE NULL END as avatar_len FROM usuarios`
        );
        console.log('\n📋 Estado actual en ComercialR4PDN.usuarios:');
        console.table(rows);

    } catch (err) {
        console.error('❌ Error durante la migración:', err);
    } finally {
        await pg.$disconnect();
        await mysqlConn.end();
    }
}

main();
