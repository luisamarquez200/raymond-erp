/**
 * clear-r4-db.js — Borra toda la data operativa de ComercialR4
 * Uso: node clear-r4-db.js
 */
const mysql = require('./apps/api/node_modules/mysql2/promise');

// Leer la URL del env file manualmente
const fs = require('fs');
const envContent = fs.readFileSync('./apps/api/.env', 'utf8');
const match = envContent.match(/COMERCIAL_R4_DATABASE_URL="?([^"\n]+)"?/);
if (!match) { console.error('No se encontró COMERCIAL_R4_DATABASE_URL'); process.exit(1); }
const DB_URL = match[1].trim();

function parseUrl(url) {
    const withoutProto = url.replace('mysql://', '');
    const qIdx = withoutProto.indexOf('?');
    const base = qIdx >= 0 ? withoutProto.substring(0, qIdx) : withoutProto;
    const atIdx = base.lastIndexOf('@');
    const userPass = base.substring(0, atIdx);
    const hostDb = base.substring(atIdx + 1);
    const colonIdx = userPass.indexOf(':');
    const user = userPass.substring(0, colonIdx);
    const pass = userPass.substring(colonIdx + 1);
    const slashIdx = hostDb.lastIndexOf('/');
    const hostPort = hostDb.substring(0, slashIdx);
    const db = hostDb.substring(slashIdx + 1);
    const [host, port] = hostPort.split(':');
    return {
        host,
        port: parseInt(port || '3306'),
        user: decodeURIComponent(user),
        password: decodeURIComponent(pass),
        database: db,
        ssl: { rejectUnauthorized: false }
    };
}

async function main() {
    const config = parseUrl(DB_URL);
    console.log('\n🔌 Conectando a ' + config.host + '/' + config.database + '...');
    const conn = await mysql.createConnection(config);
    console.log('✅ Conectado.\n');

    await conn.execute('SET FOREIGN_KEY_CHECKS = 0');
    await conn.execute('SET innodb_lock_wait_timeout = 5');

    const tables = [
        'tipos_cambio_historial',
        'detalles_renta',
        'ordenes_mensuales',
        'cargas_masivas_logs',
        'cambios_sitio',
        'activo_accesorios',
        'auditorias',
        'documentos',
        'tarifas',
        'rentas',
        'contratos',
        'activos',
        'sitios',
        'clientes',
    ];

    let total = 0;
    for (const t of tables) {
        try {
            await conn.execute('TRUNCATE TABLE `' + t + '`');
            total++;
            console.log('  🗑️  ' + t.padEnd(32) + 'limpiada');
        } catch(e) {
            console.log('  ⚠️  ' + t.padEnd(32) + 'ERROR: ' + e.message);
        }
    }

    await conn.execute('SET FOREIGN_KEY_CHECKS = 1');
    await conn.end();
    console.log('\n✅ Limpieza completa. Total: ' + total + ' registros eliminados.');
    console.log('📋 Ya puedes volver a subir el Excel desde la UI.\n');
}

main().catch(e => { console.error('\n❌ Error:', e.message); process.exit(1); });
