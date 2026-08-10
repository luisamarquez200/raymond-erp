'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    FileSpreadsheet,
    LayoutDashboard,
    LogOut,
    ChevronLeft,
    ChevronRight,
    AlertCircle,
    Truck,
    Receipt,
    CircleDollarSign,
    Users,
    Settings
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { useConfigStore } from '@/store/config.store';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';

import NotificationBell from './NotificationBell';

interface SidebarProps {
    isCollapsed?: boolean;
    onToggle?: () => void;
}

const menuItems = [
    {
        label: 'Dashboard',
        icon: LayoutDashboard,
        href: '/es/r4/dashboard',
    },
    {
        label: 'Flotilla & Rentas',
        icon: Truck,
        href: '/es/r4/flotilla',
    },
    {
        label: 'Presupuestos',
        icon: CircleDollarSign,
        href: '/es/r4/presupuestos',
    },
    {
        label: 'Clientes y Sitios',
        icon: FileSpreadsheet,
        href: '/es/r4/clientes-sitios',
    },

    {
        label: 'Configuración',
        icon: Settings,
        href: '/es/r4/configuracion',
    }
];

export default function AdminComercialSidebar({ isCollapsed: externalIsCollapsed, onToggle }: SidebarProps) {
    const pathname = usePathname();
    const [internalIsCollapsed, setInternalIsCollapsed] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const { user, signOut } = useAuthStore();
    const { roleColors } = useConfigStore();

    const stringRole = (typeof user?.role === 'string' ? user.role : (user?.role as any)?.name || '')?.toLowerCase();
    const currentColor = roleColors[stringRole] || (stringRole.includes('gerent') ? '#16a34a' : roleColors.administrador);
    const subtitleText = stringRole.includes('gerent') 
        ? 'Gerencia Comercial' 
        : stringRole.includes('adc') 
            ? 'ADC Comercial' 
            : 'Admin Comercial';

    const handleConfirmLogout = async () => {
        await signOut();
        window.location.href = '/login';
    };

    const isCollapsed = externalIsCollapsed !== undefined ? externalIsCollapsed : internalIsCollapsed;

    return (
        <aside
            className={cn(
                'fixed left-0 top-0 h-screen bg-white border-r border-gray-100 transition-all duration-300 z-50 hidden lg:flex flex-col',
                isCollapsed ? 'w-16' : 'w-64'
            )}
        >
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
                {!isCollapsed && (
                    <div className="flex flex-col -gap-1">
                        <span 
                            className="text-2xl font-black font-brand tracking-tighter leading-none"
                            style={{ color: currentColor }}
                        >
                            RAYMOND
                        </span>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">
                            {subtitleText}
                        </span>
                    </div>
                )}
                <div className="flex items-center gap-1">
                    {!isCollapsed && (
                        <>
                            <NotificationBell align="popout" />
                            <Link
                                href="/es/site-selection"
                                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-red-600"
                                title="Volver a selección"
                            >
                                <LayoutDashboard className="w-4 h-4" />
                            </Link>
                        </>
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
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4">
                <ul className="space-y-1 px-2">
                    {menuItems.filter(item => {
                        if (item.label === 'Configuración') {
                            return user?.role?.toLowerCase() === 'administrador' || user?.isSuperadmin;
                        }
                        return true;
                    }).map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;

                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    className={cn(
                                        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                                        isActive
                                            ? 'font-semibold'
                                            : 'text-gray-700 hover:bg-gray-100',
                                        isCollapsed && 'justify-center'
                                    )}
                                    style={isActive ? {
                                        backgroundColor: `${user?.role ? (roleColors[user.role.toLowerCase()] || roleColors.administrador) : roleColors.administrador}15`,
                                        color: user?.role ? (roleColors[user.role.toLowerCase()] || roleColors.administrador) : roleColors.administrador
                                    } : {}}
                                    title={isCollapsed ? item.label : undefined}
                                >
                                    <Icon 
                                        className={cn('w-5 h-5 flex-shrink-0')} 
                                        style={isActive ? { color: user?.role ? (roleColors[user.role.toLowerCase()] || roleColors.administrador) : roleColors.administrador } : {}}
                                    />
                                    {!isCollapsed && <span>{item.label}</span>}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* Footer User Section */}
            <div className="mt-auto p-4 border-t border-gray-100 bg-white">
                <button
                    onClick={() => setShowLogoutConfirm(true)}
                    title="Cerrar sesión"
                    className={cn(
                        "w-full flex items-center gap-3 p-2 rounded-xl transition-all h-12 text-left",
                        !isCollapsed ? "hover:bg-slate-50 group" : "justify-center hover:bg-slate-50"
                    )}>
                    <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-xs shrink-0 shadow-lg border-2 border-white transition-opacity hover:opacity-80"
                        style={{ backgroundColor: user?.role ? (roleColors[user.role.toLowerCase()] || roleColors.administrador) : roleColors.administrador }}
                    >
                        {isCollapsed ? <LogOut className="w-5 h-5" /> : (user ? getInitials(user.firstName || user.email, user.lastName || '', user.email) : 'AC')}
                    </div>
                    {!isCollapsed && (
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-gray-900 truncate leading-none transition-colors">
                                {user ? `${user.firstName || user.email.split('@')[0]} ${user.lastName || ''}`.trim() : 'Admin'}
                            </p>
                            <div 
                                className="flex items-center gap-1 mt-1"
                                style={{ color: user?.role ? (roleColors[user.role.toLowerCase()] || roleColors.administrador) : roleColors.administrador }}
                            >
                                <p className="text-[10px] font-black uppercase tracking-widest flex-1 truncate">
                                    {user?.role || 'Admin'}
                                </p>
                                <LogOut className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </div>
                    )}
                </button>
            </div>

            <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
                <DialogContent className="max-w-md p-0 overflow-hidden bg-white border-none shadow-2xl rounded-[2rem]">
                    <div className="p-8 space-y-6">
                        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mx-auto">
                            <AlertCircle className="w-8 h-8" />
                        </div>
                        <div className="text-center space-y-2">
                            <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">Cerrar Sesión</DialogTitle>
                            <DialogDescription className="text-sm text-slate-500 font-medium">
                                ¿Estás seguro de que deseas salir del sistema?
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
                                className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-200 transition-all"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </aside>
    );
}
