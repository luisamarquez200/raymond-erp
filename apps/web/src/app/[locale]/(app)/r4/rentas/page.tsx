"use client";

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';

export default function R4RentasPage() {
  const t = useTranslations();
  const [rentas, setRentas] = useState([
    { id: 'REN-001', cliente: 'Logistica Corp', activo: '12345XYZ', vigencia: '2026-12-31', tarifa: '$15,000 MXN', estado: 'VIGENTE' },
    { id: 'REN-002', cliente: 'Almacenes del Norte', activo: '67890ABC', vigencia: '2026-06-30', tarifa: '$12,000 MXN', estado: 'PROXIMA A VENCER' },
  ]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rentas (R4)</h1>
          <p className="text-muted-foreground">Administra contratos de renta, vigencias y asignación de activos.</p>
        </div>
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90">
          + Nueva Renta
        </button>
      </div>

      <div className="border rounded-lg overflow-hidden bg-background">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted text-muted-foreground uppercase">
            <tr>
              <th className="px-6 py-3">ID Renta</th>
              <th className="px-6 py-3">Cliente</th>
              <th className="px-6 py-3">Serie de Activo</th>
              <th className="px-6 py-3">Fin Vigencia</th>
              <th className="px-6 py-3">Tarifa Mes</th>
              <th className="px-6 py-3">Estado</th>
              <th className="px-6 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rentas.map((renta) => (
              <tr key={renta.id} className="border-b hover:bg-muted/50">
                <td className="px-6 py-4 font-medium">{renta.id}</td>
                <td className="px-6 py-4">{renta.cliente}</td>
                <td className="px-6 py-4">{renta.activo}</td>
                <td className="px-6 py-4">{renta.vigencia}</td>
                <td className="px-6 py-4">{renta.tarifa}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    renta.estado === 'VIGENTE' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {renta.estado}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="text-sm text-primary hover:underline">Gestionar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
