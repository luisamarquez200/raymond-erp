'use client';

import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import AdminComercialSidebar from '@/components/navigation/AdminComercialSidebar';
import { useAuthStore } from '@/store/auth.store';
import { useRouter, usePathname, useParams } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

import NotificationBell from '@/components/navigation/NotificationBell';
import { useConfigStore } from '@/store/config.store';

const queryClient = new QueryClient();

export default function R4Layout({ children }: { children: React.ReactNode }) {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const { user, isLoading } = useAuthStore();
    const { roleColors } = useConfigStore();
    const router = useRouter();
    const pathname = usePathname();
    const params = useParams();
    const [isClient, setIsClient] = useState(false);

    const stringRole = (typeof user?.role === 'string' ? user.role : (user?.role as any)?.name || '')?.toLowerCase();
    const currentColor = roleColors[stringRole] || (stringRole.includes('gerent') ? '#16a34a' : roleColors.administrador);
    const subtitleText = stringRole.includes('gerent') 
        ? 'Gerencia Comercial' 
        : stringRole.includes('adc') 
            ? 'ADC Comercial' 
            : 'Admin Comercial';

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (isClient && !isLoading) {
            if (!user) {
                const locale = params.locale || 'es';
                router.push(`/${locale}/login`);
            } else {
                // Determine if user has R4 access
                const roleLower = user.role?.toLowerCase() || '';
                const hasR4Access = user.isSuperadmin || 
                    roleLower === 'administrador' || 
                    roleLower === 'admin' ||
                    roleLower === 'adc' ||
                    roleLower.includes('gerent') ||
                    roleLower.includes('coordinad') ||
                    roleLower.includes('coordinaci') ||
                    roleLower.includes('auxiliar') ||
                    roleLower.includes('r4') ||
                    (user as any).sitio?.includes('R4');
                
                if (!hasR4Access) {
                    const locale = params.locale || 'es';
                    // If no access, send to unauthorized or back to Taller R1 main
                    router.push(`/${locale}/r1/dashboard`);
                }
            }
        }
    }, [user, isLoading, router, isClient, params.locale]);

    if (!isClient) return null;
    if (!user && isLoading) return null;

    return (
        <QueryClientProvider client={queryClient}>
            <div className="flex min-h-screen force-light-mode w-full" data-theme="light">
                {/* Mobile Header */}
                <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-100 flex items-center px-4 z-40">
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="mr-2">
                                <Menu className="h-6 w-6 text-gray-600" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="p-0 w-64 border-none">
                            <div className="h-full bg-white [&>aside]:fixed-none [&>aside]:static [&>aside]:flex [&>aside]:w-full">
                                <AdminComercialSidebar
                                    isCollapsed={false}
                                    onToggle={() => { }}
                                />
                            </div>
                        </SheetContent>
                    </Sheet>
                    <div className="flex flex-col flex-1">
                        <span 
                            className="text-xl font-black font-brand tracking-tighter leading-none"
                            style={{ color: currentColor }}
                        >
                            RAYMOND
                        </span>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                            {subtitleText}
                        </span>
                    </div>
                    <NotificationBell />
                </div>

                <AdminComercialSidebar
                    isCollapsed={sidebarCollapsed}
                    onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
                />

                <div className={cn(
                    "flex-1 transition-all duration-300 w-full min-w-0",
                    "pt-16 lg:pt-0",
                    sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"
                )}>
                    <main className="p-0">
                        {children}
                    </main>
                </div>
            </div>
        </QueryClientProvider>
    );
}
