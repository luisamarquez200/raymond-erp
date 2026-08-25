/**
 * clear-r4-db.js — Borra toda la data operativa de ComercialR4 y ComercialR4PDN
 * Uso: node clear-r4-db.js
 */
const mysql = require('./apps/api/node_modules/mysql2/promise');
const fs = require('fs');

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
    'facturacion_mensual'
];

async function cleanDatabase(dbUrl, label) {
    const config = parseUrl(dbUrl);
    console.log(`\n🔌 Conectando a [${label}] ${config.host}/${config.database}...`);
    const conn = await mysql.createConnection(config);
    console.log(`✅ Conectado a [${label}].\n`);

    await conn.execute('SET FOREIGN_KEY_CHECKS = 0');
    await conn.execute('SET innodb_lock_wait_timeout = 10');

    let total = 0;
    for (const t of tables) {
        try {
            await conn.execute('TRUNCATE TABLE `' + t + '`');
            total++;
            console.log('  🗑️  ' + t.padEnd(32) + 'limpiada');
        } catch(e) {
            console.log('  ⚠️  ' + t.padEnd(32) + 'ERROR / NO EXISTE: ' + e.message);
        }
    }

    await conn.execute('SET FOREIGN_KEY_CHECKS = 1');
    await conn.end();
    console.log(`\n✅ Limpieza de [${label}] completa. Total tablas: ${total}.`);
}

async function main() {
    // 1. URL de Dev
    const devUrl = "mysql://AppSheet:U%407qV%29F%28k%5D15qQ%254H%28ie@143.198.60.56:3306/ComercialR4?ssl-mode=REQUIRED&accept-invalid-certs=true";
    // 2. URL de Producción
    const pdnUrl = "mysql://AppSheet:U%407qV%29F%28k%5D15qQ%254H%28ie@143.198.60.56:3306/ComercialR4PDN?ssl-mode=REQUIRED&accept-invalid-certs=true";

    await cleanDatabase(devUrl, 'DEV (ComercialR4)');
    await cleanDatabase(pdnUrl, 'PDN (ComercialR4PDN)');

    console.log('\n✨ ¡Ambas bases de datos (Dev y PDN) quedaron limpias exitosamente!');
    console.log('📋 Los usuarios y roles se conservaron intactos.\n');
}

main().catch(e => { console.error('\n❌ Error:', e.message); process.exit(1); });

