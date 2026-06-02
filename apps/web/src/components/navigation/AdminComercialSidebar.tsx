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
    Receipt
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';

interface SidebarProps {
    isCollapsed?: boolean;
    onToggle?: () => void;
}

const menuItems = [
    {
        label: 'Flotilla',
        icon: Truck,
        href: '/es/r4/flotilla',
    },
    {
        label: 'Clientes y Sitios',
        icon: FileSpreadsheet,
        href: '/es/r4/clientes-sitios',
    },
    {
        label: 'Rentas',
        icon: Receipt,
        href: '/es/r4/rentas',
    }
];

export default function AdminComercialSidebar({ isCollapsed: externalIsCollapsed, onToggle }: SidebarProps) {
    const pathname = usePathname();
    const [internalIsCollapsed, setInternalIsCollapsed] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const { user, signOut } = useAuthStore();

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
                        <span className="text-2xl font-black text-amber-600 font-brand tracking-tighter leading-none">RAYMOND</span>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">
                            Admin Comercial
                        </span>
                    </div>
                )}
                <div className="flex items-center gap-1">
                    {!isCollapsed && (
                        <Link
                            href="/es/site-selection"
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-amber-600"
                            title="Volver a selección"
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
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4">
                <ul className="space-y-1 px-2">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;

                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    className={cn(
                                        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                                        isActive
                                            ? 'bg-amber-50 text-amber-600 font-semibold'
                                            : 'text-gray-700 hover:bg-gray-100',
                                        isCollapsed && 'justify-center'
                                    )}
                                    title={isCollapsed ? item.label : undefined}
                                >
                                    <Icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-amber-600')} />
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
                        !isCollapsed ? "hover:bg-amber-50 group" : "justify-center hover:bg-amber-50"
                    )}>
                    <div className="w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center text-white font-black text-xs shrink-0 shadow-lg border-2 border-white group-hover:bg-amber-700 transition-colors">
                        {isCollapsed ? <LogOut className="w-5 h-5" /> : (user ? getInitials(user.firstName || user.email, user.lastName || '', user.email) : 'AC')}
                    </div>
                    {!isCollapsed && (
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-gray-900 truncate leading-none group-hover:text-amber-700 transition-colors">
                                {user ? `${user.firstName || user.email.split('@')[0]} ${user.lastName || ''}`.trim() : 'Admin'}
                            </p>
                            <div className="flex items-center gap-1 mt-1 text-amber-600">
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
                        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mx-auto">
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
                                className="flex-1 py-4 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-amber-200 transition-all"
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
