import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import path from 'path';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  devIndicators: false,
  // Configuración para Turbopack en monorepo
  // La raíz del workspace está en el directorio padre (raíz del monorepo)
  turbopack: {
    root: path.join(__dirname, '../..'),
  },
};

export default withNextIntl(nextConfig);
