import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const require = createRequire(import.meta.url);

// Leer .env
const envPath = resolve(process.cwd(), 'apps/api/.env');
let envContent = '';
try { envContent = readFileSync(envPath, 'utf8'); } catch {}
for (const line of envContent.split('\n')) {
  const eqIdx = line.indexOf('=');
  if (eqIdx < 0) continue;
  const key = line.slice(0, eqIdx).trim();
  const val = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
  if (key && !process.env[key]) process.env[key] = val;
}

const { PrismaClient } = require('@prisma/client-comercial');

const PENDIENTES_JULIO = [
  { razon_social: 'AUTOZONE',       moneda: 'USD', importe: 1350.00 },
  { razon_social: 'BACHOCO',        moneda: 'USD', importe: 4688.70 },
  { razon_social: 'EXPRESS',        moneda: 'USD', importe: 52282.62 },
  { razon_social: 'MERCADOLIBRE',   moneda: 'MXN', importe: 535443.22 },
  { razon_social: 'AMAZON',         moneda: 'MXN', importe: 1874626.02 },
  { razon_social: 'GXO',            moneda: 'MXN', importe: 159371.24 },
  { razon_social: 'HNI',            moneda: 'USD', importe: 4204.00 },
  { razon_social: 'SORIANA',        moneda: 'MXN', importe: 41500.00 },
  { razon_social: 'CEVAFREIGHT',    moneda: 'USD', importe: 15905.49 },
  { razon_social: 'DSV',            moneda: 'USD', importe: 16587.31 },
  { razon_social: 'KUEHNE+NAGEL',   moneda: 'USD', importe: 271.82 },
  { razon_social: 'DHL SC',         moneda: 'MXN', importe: 49102.48 },
];

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.COMERCIAL_R4_DATABASE_URL } }
});

async function main() {
  console.log('🚀 Cargando valores de Pendiente Acumulado Inicial (Julio 2026) con batching...\n');

  for (const entry of PENDIENTES_JULIO) {
    const { razon_social, moneda, importe } = entry;

    const cliente = await prisma.cliente.findFirst({
      where: { razon_social: { contains: razon_social } },
      select: { id: true, razon_social: true }
    });

    if (!cliente) {
      console.log(`❌ NO ENCONTRADO: "${razon_social}" (${moneda})`);
      continue;
    }

    const rentasConDetalles = await prisma.renta.findMany({
      where: {
        cliente_id: cliente.id,
        estado: { in: ['VIGENTE', 'IMPORTADA', 'ACTIVA', 'ACTIVO'] },
        detalles: { moneda: { equals: moneda.toUpperCase() } }
      },
      include: { detalles: true },
      orderBy: { detalles: { renta_real: 'desc' } }
    });

    if (rentasConDetalles.length === 0) {
      console.log(`⚠️ Sin rentas en ${moneda}: "${cliente.razon_social}"`);
      continue;
    }

    const firstDetailId = rentasConDetalles[0].detalles?.id;
    const restDetailIds = rentasConDetalles.slice(1).map(r => r.detalles?.id).filter(Boolean);

    if (restDetailIds.length > 0) {
      await prisma.detallesRenta.updateMany({
        where: { id: { in: restDetailIds } },
        data: { importe_recuperado: 0 }
      });
    }

    if (firstDetailId) {
      await prisma.detallesRenta.update({
        where: { id: firstDetailId },
        data: { importe_recuperado: importe }
      });
    }

    console.log(`✅ OK: ${cliente.razon_social} (${moneda}): $${importe.toLocaleString('es-MX')} (${rentasConDetalles.length} rentas procesadas)`);
  }

  console.log('\n✨ ¡Carga de julio completada exitosamente!');
}

main()
  .catch(e => { console.error('Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
