'use client';

import { useState, useRef } from 'react';
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
    Settings,
    Camera,
    Upload,
    Trash2,
    Loader2,
    Check
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
import api from '@/lib/api';
import { toast } from 'sonner';

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
    const [showAvatarModal, setShowAvatarModal] = useState(false);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [isSavingAvatar, setIsSavingAvatar] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { user, setUser, signOut } = useAuthStore();
    const { roleColors } = useConfigStore();

    const userRole = user?.role || (user as any)?.roles || (user as any)?.role_id || (user as any)?.firstName;
    const stringRole = (typeof userRole === 'string' ? userRole : (userRole as any)?.name || '')?.toLowerCase().trim();
    
    const isGerencia = stringRole.includes('geren') || (user as any)?.username?.toLowerCase()?.includes('geren') || (user as any)?.firstName?.toLowerCase()?.includes('geren') || user?.email?.toLowerCase()?.includes('geren');
    const isAdc = stringRole.includes('adc') || (user as any)?.username?.toLowerCase()?.includes('adc') || (user as any)?.firstName?.toLowerCase()?.includes('adc') || user?.email?.toLowerCase()?.includes('adc');

    const currentColor = isGerencia 
        ? (roleColors.gerencia || roleColors.gerente || '#16a34a') 
        : isAdc 
            ? (roleColors.adc || '#2563eb')
            : (roleColors[stringRole] || roleColors.administrador || '#dc2626');

    const subtitleText = isGerencia 
        ? 'Gerencia Comercial' 
        : isAdc 
            ? 'ADC Comercial' 
            : 'Admin Comercial';

    const handleConfirmLogout = async () => {
        await signOut();
        window.location.href = '/login';
    };

    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Por favor selecciona un archivo de imagen (PNG, JPG, WEBP).');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            toast.error('La imagen no debe superar los 10 MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const rawDataUrl = event.target?.result as string;
            // Optimize image via Canvas (max 400x400)
            const img = new window.Image();
            img.src = rawDataUrl;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxSize = 400;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxSize) {
                        height = Math.round((height * maxSize) / width);
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width = Math.round((width * maxSize) / height);
                        height = maxSize;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    const optimizedBase64 = canvas.toDataURL('image/jpeg', 0.85);
                    setAvatarPreview(optimizedBase64);
                } else {
                    setAvatarPreview(rawDataUrl);
                }
            };
        };
        reader.readAsDataURL(file);
    };

    const handleSaveAvatar = async () => {
        if (!avatarPreview) {
            toast.error('Selecciona una imagen primero.');
            return;
        }

        setIsSavingAvatar(true);
        try {
            await api.patch('/users/me', { avatar_url: avatarPreview });
            if (user) {
                setUser({ ...user, avatarUrl: avatarPreview });
            }
            toast.success('Foto de perfil actualizada exitosamente');
            setShowAvatarModal(false);
        } catch (error: any) {
            console.error('Error saving avatar:', error);
            // Fallback: save to localStorage/auth store even if offline
            if (user) {
                setUser({ ...user, avatarUrl: avatarPreview });
                toast.success('Foto de perfil guardada localmente');
                setShowAvatarModal(false);
            } else {
                toast.error(error.response?.data?.message || 'Error al guardar la foto');
            }
        } finally {
            setIsSavingAvatar(false);
        }
    };

    const handleRemoveAvatar = async () => {
        setIsSavingAvatar(true);
        try {
            await api.patch('/users/me', { avatar_url: null });
            if (user) {
                setUser({ ...user, avatarUrl: undefined });
            }
            setAvatarPreview(null);
            toast.info('Foto de perfil eliminada');
            setShowAvatarModal(false);
        } catch (error: any) {
            console.error('Error removing avatar:', error);
            if (user) {
                setUser({ ...user, avatarUrl: undefined });
                setAvatarPreview(null);
                setShowAvatarModal(false);
            }
        } finally {
            setIsSavingAvatar(false);
        }
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
            <div className="mt-auto p-3 border-t border-gray-100 bg-white">
                <div className={cn(
                    "flex items-center gap-3 p-1.5 rounded-2xl transition-all",
                    !isCollapsed ? "hover:bg-slate-50" : "justify-center"
                )}>
                    {/* Avatar with Camera Trigger */}
                    <div 
                        onClick={() => {
                            setAvatarPreview(user?.avatarUrl || null);
                            setShowAvatarModal(true);
                        }}
                        title="Cambiar foto de perfil"
                        className="relative group/avatar cursor-pointer shrink-0"
                    >
                        <div 
                            className="w-11 h-11 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0 shadow-md border-2 border-white overflow-hidden transition-all duration-200 group-hover/avatar:ring-2 group-hover/avatar:ring-red-500/50"
                            style={{ backgroundColor: user?.role ? (roleColors[user.role.toLowerCase()] || roleColors.administrador) : roleColors.administrador }}
                        >
                            {user?.avatarUrl ? (
                                <img 
                                    src={user.avatarUrl} 
                                    alt="Foto de perfil" 
                                    className="w-full h-full object-cover" 
                                />
                            ) : (
                                <span>{user ? getInitials(user.firstName || user.email, user.lastName || '', user.email) : 'A'}</span>
                            )}
                        </div>

                        {/* Hover Camera Icon Badge */}
                        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                            <Camera className="w-4 h-4 text-white drop-shadow" />
                        </div>
                    </div>

                    {!isCollapsed && (
                        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                            <div 
                                onClick={() => {
                                    setAvatarPreview(user?.avatarUrl || null);
                                    setShowAvatarModal(true);
                                }}
                                className="min-w-0 cursor-pointer flex-1"
                                title="Editar foto de perfil"
                            >
                                <p className="text-sm font-extrabold text-slate-900 truncate leading-tight hover:text-red-600 transition-colors">
                                    {user ? `${user.firstName || user.email.split('@')[0]} ${user.lastName || ''}`.trim() : 'Administrador'}
                                </p>
                                <p 
                                    className="text-[10px] font-black uppercase tracking-wider truncate mt-0.5"
                                    style={{ color: user?.role ? (roleColors[user.role.toLowerCase()] || roleColors.administrador) : roleColors.administrador }}
                                >
                                    {user?.role || 'ADMINISTRADOR'}
                                </p>
                            </div>

                            {/* Logout Action Button */}
                            <button
                                type="button"
                                onClick={() => setShowLogoutConfirm(true)}
                                title="Cerrar sesión"
                                className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL: SUBIR / CAMBIAR FOTO DE PERFIL */}
            <Dialog open={showAvatarModal} onOpenChange={setShowAvatarModal}>
                <DialogContent className="max-w-md p-0 overflow-hidden bg-white border-none shadow-2xl rounded-[2rem]">
                    <div className="p-6 sm:p-8 space-y-6">
                        <div className="text-center space-y-1">
                            <DialogTitle className="text-xl font-extrabold text-slate-900 tracking-tight">
                                Foto de Perfil
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-500 font-medium">
                                Sube o actualiza la foto de tu cuenta para personalizar tu avatar en el sistema.
                            </DialogDescription>
                        </div>

                        {/* Avatar Preview Display */}
                        <div className="flex flex-col items-center justify-center gap-4 py-2">
                            <div className="relative group">
                                <div 
                                    className="w-28 h-28 rounded-full flex items-center justify-center text-white font-black text-2xl shadow-xl border-4 border-slate-100 overflow-hidden"
                                    style={{ backgroundColor: user?.role ? (roleColors[user.role.toLowerCase()] || roleColors.administrador) : roleColors.administrador }}
                                >
                                    {avatarPreview ? (
                                        <img 
                                            src={avatarPreview} 
                                            alt="Preview" 
                                            className="w-full h-full object-cover" 
                                        />
                                    ) : user?.avatarUrl ? (
                                        <img 
                                            src={user.avatarUrl} 
                                            alt="Foto actual" 
                                            className="w-full h-full object-cover" 
                                        />
                                    ) : (
                                        <span>{user ? getInitials(user.firstName || user.email, user.lastName || '', user.email) : 'A'}</span>
                                    )}
                                </div>
                            </div>

                            {/* Hidden File Input */}
                            <input 
                                ref={fileInputRef}
                                type="file" 
                                accept="image/png,image/jpeg,image/jpg,image/webp" 
                                onChange={handleFileSelected} 
                                className="hidden" 
                            />

                            {/* Upload Trigger Button */}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition-all shadow-xs cursor-pointer"
                            >
                                <Upload className="w-4 h-4 text-slate-500" />
                                <span>{avatarPreview || user?.avatarUrl ? 'Elegir otra imagen' : 'Seleccionar imagen'}</span>
                            </button>
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
                            {(avatarPreview || user?.avatarUrl) && (
                                <button
                                    type="button"
                                    onClick={handleRemoveAvatar}
                                    disabled={isSavingAvatar}
                                    className="w-full sm:w-auto px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                                    title="Quitar foto y usar inicial"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    <span>Quitar foto</span>
                                </button>
                            )}

                            <div className="flex items-center gap-2 w-full sm:flex-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAvatarPreview(null);
                                        setShowAvatarModal(false);
                                    }}
                                    disabled={isSavingAvatar}
                                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer text-center"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveAvatar}
                                    disabled={isSavingAvatar || (!avatarPreview && !user?.avatarUrl)}
                                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 shadow-lg shadow-red-600/20 active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
                                >
                                    {isSavingAvatar ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Guardando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4" />
                                            <span>Guardar foto</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* MODAL: CONFIRMAR CIERRE DE SESIÓN */}
            <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
                <DialogContent className="max-w-md p-0 overflow-hidden bg-white border-none shadow-2xl rounded-[2rem]">
                    <div className="p-8 space-y-6">
                        <div 
                            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto transition-all"
                            style={{ backgroundColor: `${currentColor}15`, color: currentColor }}
                        >
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
                                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmLogout}
                                className="flex-1 py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer shadow-lg hover:brightness-110 active:scale-98"
                                style={{ 
                                    backgroundColor: currentColor,
                                    boxShadow: `0 10px 25px -5px ${currentColor}40`
                                }}
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
