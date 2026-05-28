'use client';

import { LayoutDashboard } from 'lucide-react';

export default function ComercialDashboardPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-20 h-20 bg-violet-50 rounded-full flex items-center justify-center text-violet-500 mb-6">
        <LayoutDashboard className="w-10 h-10" />
      </div>
      <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
        Centro de Control
      </h2>
      <p className="text-slate-400 font-medium max-w-md">
        Módulo en construcción. Pronto estarán disponibles las herramientas de gestión comercial.
      </p>
    </div>
  );
}
