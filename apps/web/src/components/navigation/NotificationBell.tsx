'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, CheckCircle2, XCircle, Info, AlertTriangle, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface NotificationItem {
    id: string;
    title: string;
    message: string;
    type: 'INFO' | 'SUCCESS' | 'ERROR' | 'WARNING';
    read: boolean;
    created_at: string;
}

interface NotificationBellProps {
    align?: 'left' | 'right' | 'popout';
}

export default function NotificationBell({ align = 'right' }: NotificationBellProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const popoverRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = async () => {
        try {
            const [resNotifs, resCount] = await Promise.all([
                api.get('/notifications'),
                api.get('/notifications/unread-count')
            ]);
            const notifData = resNotifs.data?.data || resNotifs.data || [];
            setNotifications(Array.isArray(notifData) ? notifData : []);
            setUnreadCount(resCount.data?.unreadCount || 0);
        } catch (error) {
            // silent fail on poll
        }
    };

    const handleOpenBell = async () => {
        const willOpen = !isOpen;
        setIsOpen(willOpen);
        if (willOpen) {
            await fetchNotifications();
            // Automatically mark all as read when opening so unread badge clears
            if (unreadCount > 0) {
                try {
                    await api.put('/notifications/mark-all-read');
                    setUnreadCount(0);
                    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                } catch (e) {}
            }
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 8000); // poll every 8s
        return () => clearInterval(interval);
    }, []);

    // Close popover when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleMarkAllRead = async () => {
        try {
            await api.put('/notifications/mark-all-read');
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
            toast.success('Todas las notificaciones marcadas como leídas');
        } catch (error) {
            toast.error('Error al marcar notificaciones');
        }
    };

    const handleDeleteSingle = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await api.delete(`/notifications/${id}`);
            setNotifications(prev => prev.filter(n => n.id !== id));
            toast.success('Notificación eliminada');
        } catch (error) {
            toast.error('Error al eliminar notificación');
        }
    };

    const handleDeleteAll = async () => {
        try {
            await api.delete('/notifications');
            setNotifications([]);
            setUnreadCount(0);
            toast.success('Historial de notificaciones vaciado');
        } catch (error) {
            toast.error('Error al vaciar notificaciones');
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'SUCCESS':
                return <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />;
            case 'ERROR':
                return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
            case 'WARNING':
                return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />;
            default:
                return <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />;
        }
    };

    const formatTime = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffMins < 1) return 'Ahora mismo';
            if (diffMins < 60) return `Hace ${diffMins} min`;
            if (diffHours < 24) return `Hace ${diffHours} h`;
            if (diffDays < 7) return `Hace ${diffDays} d`;
            return date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return '';
        }
    };

    return (
        <div className="relative inline-block" ref={popoverRef}>
            <button
                type="button"
                onClick={handleOpenBell}
                className={cn(
                    "relative p-2 rounded-xl transition-all flex items-center justify-center border",
                    isOpen 
                        ? "bg-slate-100 border-slate-300 text-slate-900" 
                        : "bg-transparent hover:bg-slate-100 border-transparent text-slate-500 hover:text-slate-900"
                )}
                title="Notificaciones"
                aria-label="Campana de Notificaciones"
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-black text-white shadow-md animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className={cn(
                    "absolute w-80 md:w-96 rounded-2xl bg-white shadow-2xl border-2 border-slate-100 z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-150",
                    align === 'left' && "left-0 top-full mt-2",
                    align === 'popout' && "left-0 sm:left-full top-full sm:top-0 mt-2 sm:mt-0 sm:ml-3",
                    align === 'right' && "right-0 top-full mt-2"
                )}>
                    {/* Header */}
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-slate-700" />
                            <h3 className="font-black text-xs uppercase tracking-wider text-slate-900">Notificaciones</h3>
                            {unreadCount > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-black">
                                    {unreadCount} nuevas
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            {notifications.length > 0 && (
                                <button
                                    type="button"
                                    onClick={handleDeleteAll}
                                    className="text-[10px] font-black text-red-600 hover:text-red-800 flex items-center gap-1 hover:underline transition-colors"
                                    title="Vaciar todas las notificaciones"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Vaciar
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Notifications List */}
                    <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-xs font-medium space-y-1">
                                <Bell className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
                                <p>No tienes notificaciones por el momento.</p>
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <div
                                    key={n.id}
                                    className={cn(
                                        "p-4 transition-colors relative group flex gap-3 items-start",
                                        n.read ? "bg-white hover:bg-slate-50/80" : "bg-slate-50/70 hover:bg-slate-100/80"
                                    )}
                                >
                                    {!n.read && (
                                        <span className="absolute top-4 left-2 w-1.5 h-1.5 rounded-full bg-red-600" />
                                    )}
                                    <div className="mt-0.5">
                                        {getTypeIcon(n.type)}
                                    </div>
                                    <div className="flex-1 min-w-0 pr-6">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <h4 className={cn("text-xs font-black truncate", n.read ? "text-slate-800" : "text-slate-900 font-black")}>
                                                {n.title}
                                            </h4>
                                            <span className="text-[9px] font-bold text-slate-400 flex-shrink-0">
                                                {formatTime(n.created_at)}
                                            </span>
                                        </div>
                                        <p className="text-[11px] font-medium text-slate-600 mt-1 whitespace-pre-line leading-relaxed">
                                            {n.message}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => handleDeleteSingle(n.id, e)}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all absolute top-3 right-3"
                                        title="Eliminar notificación"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
