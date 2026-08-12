'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import FlotillaTab from '@/components/r4/FlotillaTab';
import RentasTab from '@/components/r4/RentasTab';
import { useConfigStore } from '@/store/config.store';
import { useAuthStore } from '@/store/auth.store';
import { PackageSearch, ReceiptText } from 'lucide-react';

export default function FlotillaRentasPage() {
  const [activeTab, setActiveTab] = useState<'activos' | 'rentas'>('activos');
  const [adminAdcScope, setAdminAdcScope] = useState<'todos' | 'mis_adcs'>('todos');
  
  const { user } = useAuthStore();
  let rawRole: any = user?.role;
  if (Array.isArray(rawRole)) rawRole = rawRole[0]?.name || rawRole[0]?.rol || rawRole[0];
  if (typeof rawRole === 'object' && rawRole !== null) rawRole = rawRole?.name || rawRole?.rol;
  const userRole = String(rawRole || 'administrador').toLowerCase();

  const isAdministrator = userRole === 'administrador' || userRole.includes('geren') || userRole.includes('coordinaci');
  const { roleColors } = useConfigStore();
  const currentColor = roleColors[userRole] || roleColors.administrador;

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col relative">
      {/* TABS NAVIGATION BAR WITH SHARED GLOBAL ADC SCOPE SELECTOR */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 pt-3 pb-0 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Tab Switcher */}
        <div className="flex items-end gap-6">
          <button
            onClick={() => setActiveTab('activos')}
            className={`pb-3 px-2 flex items-center gap-2 font-bold text-sm transition-colors border-b-2 ${
              activeTab === 'activos' 
                ? 'text-slate-900 border-b-2' 
                : 'text-slate-400 border-transparent hover:text-slate-600'
            }`}
            style={activeTab === 'activos' ? { borderBottomColor: currentColor } : {}}
          >
            <PackageSearch className={`w-4 h-4 ${activeTab === 'activos' ? '' : 'opacity-70'}`} style={activeTab === 'activos' ? { color: currentColor } : {}} />
            Base Flotilla
          </button>

          <button
            onClick={() => setActiveTab('rentas')}
            className={`pb-3 px-2 flex items-center gap-2 font-bold text-sm transition-colors border-b-2 ${
              activeTab === 'rentas' 
                ? 'text-slate-900 border-b-2' 
                : 'text-slate-400 border-transparent hover:text-slate-600'
            }`}
            style={activeTab === 'rentas' ? { borderBottomColor: currentColor } : {}}
          >
            <ReceiptText className={`w-4 h-4 ${activeTab === 'rentas' ? '' : 'opacity-70'}`} style={activeTab === 'rentas' ? { color: currentColor } : {}} />
            Contratos & Rentas
          </button>
        </div>

        {/* Right: Global ADC Scope Toggle (Preserved across both Flotilla and Rentas) */}
        {isAdministrator && (
          <div className="mb-2 self-end sm:self-auto flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200 shadow-inner">
            <button
              type="button"
              onClick={() => setAdminAdcScope('todos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                adminAdcScope === 'todos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Todos los ADC
            </button>
            <button
              type="button"
              onClick={() => setAdminAdcScope('mis_adcs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                adminAdcScope === 'mis_adcs' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Solo mis ADC
            </button>
          </div>
        )}
      </div>

      {/* TAB CONTENT */}
      <div className="flex-1 overflow-x-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'activos' ? (
            <motion.div
              key="activos"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <FlotillaTab adminAdcScope={adminAdcScope} setAdminAdcScope={setAdminAdcScope} />
            </motion.div>
          ) : (
            <motion.div
              key="rentas"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <RentasTab adminAdcScope={adminAdcScope} setAdminAdcScope={setAdminAdcScope} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
