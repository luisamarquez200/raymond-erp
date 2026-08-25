/**
 * Limpieza de datos operativos de Comercial R4 (Flotilla, Rentas, Órdenes, Clientes, Sitios, etc.)
 * CONSERVA: Usuarios y Roles intactos.
 */
const mysql = require('mysql2/promise');
const fs = require('fs');

// Obtener URL de producción de Comercial R4
let dbUrl = process.env.COMERCIAL_R4_DATABASE_URL;

if (!dbUrl && fs.existsSync('./apps/api/.env')) {
    const envContent = fs.readFileSync('./apps/api/.env', 'utf8');
    const match = envContent.match(/COMERCIAL_R4_DATABASE_URL="?([^"\n]+)"?/);
    if (match) dbUrl = match[1].trim();
}

// Si se pasa como argumento o por defecto a ComercialR4PDN
if (process.argv[2]) {
    dbUrl = process.argv[2];
} else if (!dbUrl || dbUrl.includes('ComercialR4?')) {
    // Apuntar explícitamente a Producción si el usuario lo solicita
    dbUrl = "mysql://AppSheet:U%407qV%29F%28k%5D15qQ%254H%28ie@143.198.60.56:3306/ComercialR4PDN?ssl-mode=REQUIRED&accept-invalid-certs=true";
}

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
    const config = parseUrl(dbUrl);
    console.log('\n🔌 Conectando a Base de Datos R4: ' + config.host + ':' + config.port + '/' + config.database + '...');
    const conn = await mysql.createConnection(config);
    console.log('✅ Conexión establecida exitosamente.\n');

    await conn.execute('SET FOREIGN_KEY_CHECKS = 0');
    await conn.execute('SET innodb_lock_wait_timeout = 10');

    // Tablas operativas a limpiar (conservando usuarios)
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

    console.log('🧹 Limpiando tablas operativas (Flotilla, Rentas, Órdenes, Clientes, Sitios)...');
    let total = 0;
    for (const t of tables) {
        try {
            await conn.execute('TRUNCATE TABLE `' + t + '`');
            total++;
            console.log('  ✔️  ' + t.padEnd(28) + ' [LIMPIADA]');
        } catch (e) {
            console.log('  ⚠️   ' + t.padEnd(28) + ' [OMITIDA O ERROR]: ' + e.message);
        }
    }

    await conn.execute('SET FOREIGN_KEY_CHECKS = 1');
    await conn.end();

    console.log('\n✨ ¡Limpieza completada con éxito!');
    console.log('👥 Los usuarios y credenciales de acceso se conservaron intactos.');
    console.log('🚀 Base de datos lista para nuevas cargas masivas o capturas limpias.\n');
}

main().catch(e => {
    console.error('\n❌ Error al limpiar la BD:', e.message);
    process.exit(1);
});
