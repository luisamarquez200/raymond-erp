'use client';

import { useState } from 'react';
import NextImage from 'next/image';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import {
  LayoutDashboard,
  ArrowDownToLine,
  ArrowUpFromLine,
  Users,
  Forklift,
  MapPin,
  Map,
  User,
  Box,
  Wrench,
  Flame,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ClipboardList,
  RefreshCcw,
  ClipboardCheck,
  UserCheck,
  ShieldCheck,
  LayoutGrid,
  Settings,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { getInitials } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { AlertCircle } from 'lucide-react';
import { useAuthTallerStore } from '@/store/auth-taller.store';

interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

const siteNames: Record<string, string> = {
  'r1': 'Taller R1',
  'r2': 'Naves (R2)',
  'r3': 'R3',
};

const menuItems = [
  {
    label: 'Dashboards',
    icon: LayoutDashboard,
    path: 'dashboard',
  },
  {
    label: 'Entradas',
    icon: ArrowDownToLine,
    path: 'entradas',
  },
  {
    label: 'Entradas Rápidas',
    icon: Zap,
    path: 'entradas/rapida',
  },
  {
    label: 'Salidas',
    icon: ArrowUpFromLine,
    path: 'salidas',
  },
  {
    label: 'Salidas Rápidas',
    icon: Zap,
    path: 'salidas/rapida',
  },
  {
    label: 'Clientes',
    icon: Users,
    path: 'clientes',
  },
  {
    label: 'Equipos',
    icon: Forklift,
    path: 'equipos',
  },
  {
    label: 'Equipo Ubicación',
    icon: MapPin,
    path: 'equipo-ubicacion',
  },
  {
    label: 'Ubicaciones',
    icon: Map,
    path: 'ubicaciones',
  },
  {
    label: 'Usuarios',
    icon: User,
    path: 'usuarios',
  },
  {
    label: 'Técnicos',
    icon: Users,
    path: 'tecnicos',
  },
  {
    label: 'Solicitudes',
    icon: UserCheck,
    path: 'solicitudes',
  },
  {
    label: 'Modelos',
    icon: Box,
    path: 'modelos',
  },
  {
    label: 'Accesorios',
    icon: Wrench,
    path: 'accesorios',
  },
  {
    label: 'Auditoría Interna',
    icon: ClipboardCheck,
    path: 'auditoria',
  },
  {
    label: 'Evaluaciones',
    icon: ClipboardCheck,
    path: 'evaluaciones',
  },
  {
    label: 'Inventario',
    icon: ClipboardList,
    path: 'inventario',
  },
  {
    label: 'Solicitudes Taller',
    icon: Wrench,
    path: 'taller/solicitudes',
  },
  {
    label: 'Estaciones',
    icon: LayoutGrid,
    path: 'taller/estaciones',
  },
  {
    label: 'Refacciones',
    icon: Settings,
    path: 'refacciones',
  },
  {
    label: 'Alertas',
    icon: Flame,
    path: 'alertas',
  },
];
export default function TallerR1Sidebar({ isCollapsed: externalIsCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const params = useParams();
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const { user, signOut } = useAuthStore();
  const { selectedSite } = useAuthTallerStore();

  const currentSite = (params.site as string) || selectedSite || 'r1';
  const locale = (params.locale as string) || 'es';

  const handleConfirmLogout = async () => {
    await signOut();
    window.location.href = '/login';
  };

  const isCollapsed = externalIsCollapsed !== undefined ? externalIsCollapsed : internalIsCollapsed;

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen bg-white border-r border-gray-100 transition-all duration-300 z-50 flex flex-col',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
        {!isCollapsed && (
          <div className="flex flex-col">
            <span className="text-xl font-black text-red-600 font-brand tracking-tighter leading-none">
              RAYMOND
            </span>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">
              {(selectedSite || 'R1').toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1">
          {!isCollapsed && (
            <Link
              href={`/${locale}/site-selection`}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-red-600"
              title="Cambiar sitio"
            >
              <LayoutDashboard className="w-4 h-4" />
            </Link>
          )}
          <button
            onClick={onToggle}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5 text-gray-600" />
            ) : (
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            )}
          </button>
        </div>
      </div >

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {menuItems.map((item) => {
            // Evaluaciones, Alertas, Taller y Refacciones: solo en R1
            if (['alertas', 'evaluaciones', 'taller/solicitudes', 'taller/estaciones', 'refacciones'].includes(item.path) && currentSite !== 'r1') {
              return null;
            }

            // Condición especial para Auditorías: solo en R1, R2 y R3
            if (item.path === 'auditoria' && !['r1', 'r2', 'r3'].includes(currentSite.toLowerCase())) {
              return null;
            }

            // Roles restrictivos
            const isAdmin = user?.email === 'j.molina@runsolutions-services.com' ||
              (() => {
                const roleName = typeof user?.role === 'string'
                  ? user.role
                  : (user?.role as any)?.name;
                return roleName && ['Superadmin', 'Admin', 'Administrador'].includes(roleName);
              })();

            if (['usuarios', 'solicitudes', 'tecnicos', 'entradas/rapida', 'salidas/rapida'].includes(item.path) && !isAdmin) {
              return null;
            }

            const Icon = item.icon;
            const href = `/${locale}/${currentSite}/${item.path}`;
            const isActive = pathname === href;

            return (
              <li key={item.path}>
                <Link
                  href={href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                    isActive
                      ? 'bg-red-50 text-red-600 font-semibold'
                      : 'text-gray-700 hover:bg-gray-100',
                    isCollapsed && 'justify-center'
                  )}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-red-600')} />
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav >

      {/* Footer User Section */}
      < div className="mt-auto p-4 border-t border-gray-100 bg-white" >
        <button
          onClick={() => setShowLogoutConfirm(true)}
          title="Cerrar sesión"
          className={cn(
            "w-full flex items-center gap-3 p-2 rounded-xl transition-all h-12 text-left",
            !isCollapsed ? "hover:bg-red-50 group" : "justify-center hover:bg-red-50"
          )}>
          <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white font-black text-xs shrink-0 shadow-lg border-2 border-white group-hover:bg-red-700 transition-colors">
            {isCollapsed ? <LogOut className="w-5 h-5" /> : (user ? getInitials(user.firstName || (user as any).Usuario || user.email, user.lastName || '', user.email) : 'AD')}
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-gray-900 truncate leading-none group-hover:text-red-700 transition-colors">
                {user ? `${user.firstName || (user as any).Usuario || user.email.split('@')[0]} ${user.lastName || ''}`.trim() : 'Usuario Taller'}
              </p>
              <div className="flex items-center gap-1 mt-1 text-red-600">
                <p className="text-[10px] font-black uppercase tracking-widest flex-1 truncate">
                  {typeof user?.role === 'string' ? user.role : ((user?.role as any)?.name || 'Taller R1')}
                </p>
                <LogOut className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          )}
        </button>
      </div >

      {!isCollapsed && (
        <div className="p-4 pt-0 text-center space-y-1 opacity-40 hover:opacity-100 transition-opacity">
          <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Desarrollado por</p>
          <p className="text-[9px] font-black text-red-600 uppercase tracking-[0.1em]">RUN SOLUTIONS & SERVICES</p>
        </div>
      )}


      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-white border-none shadow-2xl rounded-[2rem]">
          <div className="p-8 space-y-6">
            <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="text-center space-y-2">
              <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">Cerrar Sesión Taller R1</DialogTitle>
              <DialogDescription className="text-sm text-slate-500 font-medium">
                ¿Estás seguro de que deseas salir del sistema? Deberás ingresar tus credenciales para volver a entrar.
              </DialogDescription>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmLogout}
                className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-200 transition-all"
              >
                Confirmar
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </aside >
  );
}
