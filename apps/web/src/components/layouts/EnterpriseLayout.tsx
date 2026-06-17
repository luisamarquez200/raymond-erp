'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import RaymondSidebar from '../navigation/RaymondSidebar'
import MobileSidebar from '../navigation/MobileSidebar'
import Navbar from '../navigation/Navbar'
import { useAuthStore } from '@/store/auth.store'
import { useOrganizationStore } from '@/store/organization.store'
import OrganizationProvider from '@/providers/organization-provider'
import Loader from '../ui/loader'
import Image from 'next/image'

const queryClient = new QueryClient()

export interface EnterpriseLayoutProps {
    children: React.ReactNode
}

export default function EnterpriseLayout({ children }: EnterpriseLayoutProps) {
    const router = useRouter()
    const { user, isLoading, restoreSession } = useAuthStore()
    const { currentOrganization } = useOrganizationStore()
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const pathname = usePathname()

    useEffect(() => {
        restoreSession()
    }, [restoreSession])

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/login')
        }
    }, [user, isLoading, router])

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gradient-to-br dark:from-black dark:to-gray-900">
                <Loader size="lg" text="Loading..." />
            </div>
        )
    }

    if (!user) {
        return null
    }

    // Modules that should have their own navigation or be isolated from main ERP UI
    const isIsolated = pathname.includes('/r1') ||
        pathname.includes('/r2') ||
        pathname.includes('/r3') ||
        pathname.includes('/r4') ||
        pathname.includes('/site-selection') ||
        pathname.includes('/administracion-comercial')

    return (
        <QueryClientProvider client={queryClient}>
            <OrganizationProvider>
                <div className={cn(
                    "min-h-screen",
                    !isIsolated ? "bg-gray-50 dark:bg-gradient-to-br dark:from-black dark:to-gray-900" : "bg-gray-50"
                )}>
                    {/* Desktop Sidebar - Hidden for Isolated Modules */}
                    {!isIsolated && (
                        <div className="hidden lg:block">
                            <RaymondSidebar
                                isCollapsed={sidebarCollapsed}
                                onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
                            />
                        </div>
                    )}

                    {/* Mobile Header & Sidebar */}
                    {!isIsolated && (
                        <div
                            className="lg:hidden fixed top-0 left-0 right-0 z-50 h-16 flex items-center px-3 sm:px-4 justify-between shadow-lg
                                bg-white dark:bg-gradient-to-b dark:from-[#1a1a1a] dark:to-[#0a0a0a]
                                border-b border-gray-200 dark:border-gray-800 dark:text-white"
                            style={{
                                backgroundImage: currentOrganization?.primaryColor
                                    ? `linear-gradient(to bottom, hsl(var(--primary) / 0.95), hsl(var(--primary) / 0.98), hsl(var(--primary-900) / 1))`
                                    : undefined,
                                borderBottomColor: currentOrganization?.primaryColor
                                    ? `hsl(var(--primary) / 0.3)`
                                    : undefined
                            }}
                        >
                            <div className="flex items-center gap-2 sm:gap-3">
                                <MobileSidebar />
                                <span className="font-semibold text-base sm:text-lg text-gray-900 dark:text-white">Raymond</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Navbar />
                            </div>
                        </div>
                    )}

                    {/* Main Content */}
                    <div
                        className={cn(
                            "transition-all duration-300 min-h-screen",
                            !isIsolated && "pt-16 lg:pt-0",
                            !isIsolated && (sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"),
                            isIsolated && "w-full"
                        )}
                    >
                        {/* Desktop Navbar */}
                        {!isIsolated && (
                            <div className="hidden lg:block">
                                <Navbar />
                            </div>
                        )}

                        {/* Page Content */}
                        <main className={cn(
                            "overflow-x-hidden w-full pb-10",
                            !isIsolated ? "p-3 sm:p-4 md:p-6" : "p-0"
                        )}>
                            <div className="max-w-full">
                                {children}
                            </div>
                        </main>
                    </div>

                    {/* Footer Banner */}
                    <div className={cn(
                        "fixed bottom-0 right-0 bg-red-500 text-white text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-center py-1.5 px-4 shadow-md z-40 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 h-auto min-h-[40px] transition-all duration-300",
                        !isIsolated && (sidebarCollapsed ? "lg:left-16 left-0" : "lg:left-64 left-0"),
                        isIsolated && "left-0"
                    )}>
                        <span>Ambiente SandBox solo destinado para pruebas</span>
                        <span className="hidden sm:inline opacity-50">•</span>
                        <span>Software Prueba Beta Funcionalidad Limitada</span>
                        <span className="hidden sm:inline opacity-50">•</span>
                        <a href="https://www.runsolutions-services.com" target="_blank" rel="noreferrer" className="hover:underline hover:text-red-100 transition-colors">
                            www.runsolutions-Services.com
                        </a>
                        <span className="hidden sm:inline opacity-50">•</span>
                        <span>Software v1.0 pruebas</span>
                        
                        {/* Logo without 'Desarrollado por' text */}
                        <div className="ml-0 sm:ml-2 bg-white px-2 py-0.5 rounded flex items-center justify-center">
                            <Image src="/logos/run-solutions.png" alt="RUN SOLUTIONS" width={90} height={20} className="h-4 w-auto object-contain" />
                        </div>
                    </div>

                </div>
            </OrganizationProvider>
        </QueryClientProvider>
    )
}
