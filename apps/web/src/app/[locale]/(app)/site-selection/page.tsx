'use client';

import { useAuthTallerStore } from '@/store/auth-taller.store';
import { useAuthStore } from '@/store/auth.store';
import { useConfigStore } from '@/store/config.store';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Building2, Factory, Warehouse, ChevronRight, FileSpreadsheet, LayoutDashboard } from 'lucide-react';
import { toast } from 'sonner';

export default function SiteSelectionPage() {
    const { user: tallerUser, setSelectedSite } = useAuthTallerStore();
    const { user: mainUser } = useAuthStore();
    const user = tallerUser || mainUser;
    const { roleColors } = useConfigStore();

    const router = useRouter();

    const userRole = user?.role || (user as any)?.roles || (user as any)?.role_id || (user as any)?.firstName;
    const stringRole = (typeof userRole === 'string' ? userRole : (userRole as any)?.name || '')?.toLowerCase().trim();
    
    const isGerencia = stringRole.includes('geren') || (user as any)?.username?.toLowerCase()?.includes('geren') || (user as any)?.firstName?.toLowerCase()?.includes('geren') || user?.email?.toLowerCase()?.includes('geren');
    const isAdc = stringRole.includes('adc') || (user as any)?.username?.toLowerCase()?.includes('adc') || (user as any)?.firstName?.toLowerCase()?.includes('adc') || user?.email?.toLowerCase()?.includes('adc');

    const currentColor = isGerencia 
        ? (roleColors.gerencia || roleColors.gerente || '#16a34a')
        : isAdc 
            ? (roleColors.adc || '#2563eb')
            : (roleColors[stringRole] || roleColors.administrador || '#dc2626');

    // Mapping code to display names and descriptions
    const siteOptions = [
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
            isUpcoming: false,

        },
        {
            id: 'admin-comercial',
            code: 'ADMIN_COMERCIAL',
            name: isGerencia ? 'Gerencia Comercial' : isAdc ? 'Portal ADC Comercial' : 'Administración Comercial',
            description: 'Gestión comercial y cargue masivo de datos.',
            icon: FileSpreadsheet,
            color: '',
            borderColor: 'border-slate-100',
            bgLight: '',
            path: '/es/r4/flotilla',
            isUpcoming: false,

        },
    ];

    // Filter sites based on user permissions
    const userSites = user?.sitio ? user.sitio.split(',').map(s => s.trim().toUpperCase()) : ['R1'];
    const isAdmin = ['admin', 'administrador', 'superadmin', 'admin_comercial'].some(r => stringRole.includes(r));

    const availableOptions = siteOptions.filter(opt => {
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
        <div className="min-h-screen w-full flex flex-col lg:flex-row font-sans overflow-hidden bg-white">
            
            {/* Left Side - Content */}
            <div className="relative w-full lg:w-1/2 flex flex-col bg-white min-h-screen">
                
                {/* Main Content Centered */}
                <div className="flex-1 flex flex-col items-center justify-center p-6">
                    <div className="w-full max-w-xl relative z-10">
                        <div className="text-center mb-12">
                            <h1 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">
                                Selecciona un Centro de Control
                            </h1>
                            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                                Bienvenido, <span className="font-semibold text-gray-900">{(user as any).username || (user as any).firstName}</span>.
                                Por favor selecciona el sitio con el que deseas trabajar hoy.
                            </p>
                        </div>

                        <div className={cn(
                            "grid gap-8 mx-auto",
                            availableOptions.length === 1 ? "grid-cols-1 max-w-sm" :
                            availableOptions.length === 2 ? "grid-cols-1 md:grid-cols-2 max-w-2xl" :
                            availableOptions.length === 4 ? "grid-cols-1 md:grid-cols-4" : 
                            "grid-cols-1 md:grid-cols-3"
                        )}>
                            {availableOptions.map((site) => (
                                <button
                                    key={site.id}
                                    onClick={() => handleSelect(site)}
                                    disabled={false}
                                    className={cn(
                                        `group relative flex flex-col text-left bg-white rounded-3xl p-8 border border-slate-100 shadow-sm transition-all duration-300 ease-out overflow-hidden`,
                                        site.isUpcoming
                                            ? "opacity-60 grayscale cursor-not-allowed border-gray-100"
                                            : "hover:shadow-xl hover:-translate-y-1.5 hover:border-slate-200"
                                    )}
                                >
                                    {/* Accent Background Gradient */}
                                    {!site.isUpcoming && (
                                        <div 
                                            className="absolute top-0 right-0 w-36 h-36 rounded-bl-full transition-opacity duration-300 pointer-events-none group-hover:opacity-15"
                                            style={{ backgroundColor: currentColor, opacity: 0.08 }}
                                        />
                                    )}

                                    <div 
                                        className={cn(
                                            "w-16 h-16 rounded-2xl flex items-center justify-center mb-8 transition-transform duration-300",
                                            !site.isUpcoming && "group-hover:scale-105"
                                        )}
                                        style={{ backgroundColor: `${currentColor}15` }}
                                    >
                                        <site.icon 
                                            className="w-8 h-8 rounded-lg p-1.5"
                                            style={{ backgroundColor: currentColor, color: '#ffffff' }}
                                        />
                                    </div>

                                    <h3 className="text-xl font-black text-gray-900 mb-2 tracking-tight">
                                        {site.name}
                                    </h3>

                                    <div 
                                        className="mt-auto flex items-center text-sm font-bold transition-all"
                                        style={{ color: site.isUpcoming ? '#94a3b8' : currentColor }}
                                    >
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
            </div>

            {/* Right Side - Image */}
            <div className="hidden lg:block lg:w-1/2 relative bg-slate-900">
                <div className="absolute inset-0 bg-black/20 z-10" /> {/* Dark overlay for premium feel */}
                <img
                    src="https://images.unsplash.com/photo-1587293852726-70cdb56c2866?q=80&w=2070&auto=format&fit=crop"
                    alt="Logistics Background"
                    className="absolute inset-0 w-full h-full object-cover object-center"
                />
            </div>

        </div>
    );
}
