'use client';

import { useAuthTallerStore } from '@/store/auth-taller.store';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Building2, Factory, Warehouse, ChevronRight, FileSpreadsheet, LayoutDashboard } from 'lucide-react';
import { toast } from 'sonner';

export default function SiteSelectionPage() {
    const { user, setSelectedSite } = useAuthTallerStore();
    const router = useRouter();

    // Mapping code to display names and descriptions
    const siteOptions = [
        {
            id: 'r1',
            code: 'R1',
            name: 'R1 - Taller',
            description: 'Gestión de taller y reparaciones principales.',
            icon: Building2,
            color: 'from-red-500 to-red-700',
            borderColor: 'border-red-100',
            bgLight: 'bg-red-50',
        },
        {
            id: 'r2',
            code: 'R2',
            name: 'R2 - Naves (Próximamente)',
            description: 'Control de inventario y activos en Planta (Naves). Estará disponible pronto.',
            icon: Factory,
            color: 'from-blue-600 to-blue-800',
            borderColor: 'border-blue-100',
            bgLight: 'bg-blue-50',
        },
        {
            id: 'r3',
            code: 'R3',
            name: 'R3 - Frontera',
            description: 'Operaciones y logística en zona Frontera.',
            icon: Warehouse,
            color: 'from-emerald-600 to-emerald-800',
            borderColor: 'border-emerald-100',
            bgLight: 'bg-emerald-50',
        },
        {
            id: 'r4',
            code: 'R4',
            name: 'R4 - Centro de Control',
            description: 'Raymond Comercial — Centro de control empresarial.',
            icon: LayoutDashboard,
            color: 'from-violet-600 to-violet-800',
            borderColor: 'border-violet-100',
            bgLight: 'bg-violet-50',
            path: '/es/comercial/dashboard',
            restrictedEmail: 'it@runsolutions.com',
        },
        {
            id: 'admin-comercial',
            code: 'ADMIN_COMERCIAL',
            name: 'Administración Comercial (Próximamente)',
            description: 'Gestión comercial y cargue masivo de datos. Estará disponible pronto.',
            icon: FileSpreadsheet,
            color: 'from-amber-500 to-amber-700',
            borderColor: 'border-amber-100',
            bgLight: 'bg-amber-50',
            path: '/es/administracion-comercial/cargue-masivo',
            requiresAdmin: true,
            isUpcoming: true
        },
    ];

    // Filter sites based on user permissions
    const userSites = user?.sitio ? user.sitio.split(',').map(s => s.trim().toUpperCase()) : ['R1'];
    const userRole = typeof user?.role === 'string' ? user.role : (user?.role as any)?.name;
    const isAdmin = ['Admin', 'Administrador', 'Superadmin'].includes(userRole);

    const availableOptions = siteOptions.filter(opt => {
        if (opt.requiresAdmin && !isAdmin) return false;
        if (opt.code === 'ADMIN_COMERCIAL') return true;

        // Restriction: R2 only for it@runsolutions.com
        if (opt.id === 'r2' && user?.email !== 'it@runsolutions.com') return false;

        if (opt.restrictedEmail && user?.email !== opt.restrictedEmail) return false;
        if (opt.restrictedEmail) return true;

        return userSites.includes(opt.code);
    });

    // Debugging site access issues
    useEffect(() => {
        console.log('[SiteSelection] User from store:', user);
        console.log('[SiteSelection] Parsed userSites:', userSites);
        console.log('[SiteSelection] Available options based on siteOptions:', availableOptions);
    }, [user, userSites, availableOptions]);

    const handleSelect = (site: any) => {
        if (site.isUpcoming) {
            toast.info(`${site.name} estará disponible próximamente.`);
            return;
        }
        if (site.path) {
            if (site.id === 'r4') {
                setSelectedSite('r4');
            }
            router.push(site.path);
            return;
        }
        setSelectedSite(site.id);
        // Redirect to logical starting point using the site ID in the URL
        router.push(`/es/${site.id}/entradas`);
    };

    // Auto-selection disabled per user request to allow review/debugging
    /*
    useEffect(() => {
        if (availableOptions.length === 1) {
            handleSelect(availableOptions[0].id);
        }
    }, [availableOptions.length]);
    */

    if (!user) return null;

    return (
        <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background pattern */}
            <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none">
                <svg width="100%" height="100%">
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
                    </pattern>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
            </div>

            <div className="w-full max-w-5xl relative z-10">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">
                        Selecciona un Centro de Control
                    </h1>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                        Bienvenido, <span className="font-semibold text-gray-900">{user.username}</span>.
                        Por favor selecciona el sitio con el que deseas trabajar hoy.
                    </p>
                </div>

                <div className={cn(
                    "grid gap-8",
                    availableOptions.length === 4 ? "grid-cols-1 md:grid-cols-4" : "grid-cols-1 md:grid-cols-3"
                )}>
                    {availableOptions.map((site) => (
                        <button
                            key={site.id}
                            onClick={() => handleSelect(site)}
                            disabled={site.isUpcoming}
                            className={cn(
                                `group relative flex flex-col text-left bg-white rounded-3xl p-8 border ${site.borderColor} shadow-sm transition-all duration-300 ease-out overflow-hidden`,
                                site.isUpcoming
                                    ? "opacity-60 grayscale cursor-not-allowed border-gray-100"
                                    : "hover:shadow-xl hover:-translate-y-2"
                            )}
                        >
                            {/* Accent Background Gradient */}
                            {!site.isUpcoming && (
                                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${site.color} opacity-0 group-hover:opacity-5 rounded-bl-full transition-opacity duration-300`} />
                            )}

                            <div className={cn(
                                `w-16 h-16 rounded-2xl ${site.bgLight} flex items-center justify-center mb-8`,
                                !site.isUpcoming && "group-hover:scale-110 transition-transform duration-300"
                            )}>
                                <site.icon className={cn(
                                    `w-8 h-8 rounded-lg p-1.5`,
                                    site.isUpcoming
                                        ? "bg-gray-400 text-white"
                                        : `bg-gradient-to-br ${site.color} text-white`
                                )} fill="currentColor" />
                            </div>

                            <h3 className="text-xl font-bold text-gray-900 mb-2">
                                {site.name}
                            </h3>
                            {/* <p className="text-gray-500 text-sm leading-relaxed mb-8">
                                {site.description}
                            </p> */}

                            <div className={cn(
                                "mt-auto flex items-center text-sm font-semibold transition-colors",
                                site.isUpcoming
                                    ? "text-gray-400"
                                    : "text-gray-900 group-hover:text-red-600"
                            )}>
                                {site.isUpcoming ? "Bloqueado" : "Entrar ahora"}
                                {!site.isUpcoming && <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />}
                            </div>
                        </button>
                    ))}
                </div>

                {availableOptions.length === 0 && (
                    <div className="text-center mt-12 p-8 bg-red-50 rounded-2xl border border-red-100 italic text-red-600">
                        No tienes sitios asignados. Por favor, contacta al administrador.
                    </div>
                )}
            </div>

        </div>
    );
}
