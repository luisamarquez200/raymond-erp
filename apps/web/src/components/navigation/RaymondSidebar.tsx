'use client'

import { useState, useEffect, useMemo } from 'react'
import { Link, usePathname } from '@/i18n/routing'
import { cn } from '@/lib/utils'
import { MODULES, APP_NAME } from '@/lib/constants'
import { ChevronDown, ChevronRight, Menu, X, LogOut } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useTranslations } from 'next-intl'
import { useEnabledModules } from '@/hooks/useOrganizationModules'
import { useOrganizationStore } from '@/store/organization.store'
import Image from 'next/image'

export interface RaymondSidebarProps {
    isCollapsed?: boolean
    onToggle?: () => void
}

export default function RaymondSidebar({ isCollapsed = false, onToggle }: RaymondSidebarProps) {
    const pathname = usePathname()
    const { user, signOut } = useAuthStore()
    const { currentOrganization } = useOrganizationStore()
    const [expandedSections, setExpandedSections] = useState<string[]>(['core', 'finance', 'admin', 'tools'])
    const t = useTranslations('navigation')
    const { data: enabledModules } = useEnabledModules()

    // Create a Set of enabled module IDs for quick lookup
    const enabledModuleIds = useMemo(() => {
        if (!enabledModules || !Array.isArray(enabledModules) || enabledModules.length === 0) {
            // If no modules configured, show all modules
            return null
        }
        // Only include modules that are enabled
        const enabledIds = enabledModules
            .filter((m) => m.isEnabled)
            .map((m) => m.moduleId);
        return new Set(enabledIds);
    }, [enabledModules])

    const toggleSection = (section: string) => {
        setExpandedSections(prev =>
            prev.includes(section)
                ? prev.filter(s => s !== section)
                : [...prev, section]
        )
    }

    const canAccessModule = (module: typeof MODULES[0]) => {
        // STEP 1: Check if module is enabled in organization settings
        // CRITICAL: This applies to ALL users including SUPERADMIN
        if (enabledModuleIds !== null && !enabledModuleIds.has(module.id)) {
            // Bypass for special modules that might not be in the DB yet during development
            if (module.id !== 'administracion-comercial') {
                return false
            }
        }

        // STEP 2: Check role-based access (only for enabled modules)
        if (!module.requiredRole) {
            return true
        }
        if (!user) {
            return false
        }

        // STEP 3: SUPERADMIN has access to ALL ENABLED modules
        if (user.isSuperadmin) {
            return true;
        }

        const userRole = user.role;

        // SUPERADMIN role has access to all enabled modules
        if (userRole === 'Superadmin' || userRole === 'Super Admin' || userRole?.toUpperCase() === 'SUPERADMIN') {
            return true;
        }

        // STEP 4: Check if user's role is in the required roles list
        const hasAccess = module.requiredRole.includes(userRole);
        return hasAccess;
    }

    const modulesByCategory = {
        core: MODULES.filter(m => m.category === 'core' && canAccessModule(m)),
        finance: MODULES.filter(m => m.category === 'finance' && canAccessModule(m)),
        admin: MODULES.filter(m => m.category === 'admin' && canAccessModule(m)),
        tools: MODULES.filter(m => m.category === 'tools' && canAccessModule(m)),
    }

    return (
        <aside
            className={cn(
                'fixed left-0 top-0 z-40 h-screen transition-all duration-300 border-r hidden lg:flex flex-col',
                'bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950',
                'border-gray-800/50',
                'text-gray-100',
                isCollapsed ? 'w-16' : 'w-64'
            )}
            style={{
                // Use custom primary color for sidebar gradient if set
                backgroundImage: currentOrganization?.primaryColor
                    ? `linear-gradient(to bottom, hsl(var(--primary) / 0.95), hsl(var(--primary) / 0.98), hsl(var(--primary-900) / 1))`
                    : undefined
            }}
        >
            {/* Header */}
            <div
                className="flex items-center justify-between h-16 px-4 border-b flex-shrink-0"
                style={{
                    borderBottomColor: currentOrganization?.primaryColor
                        ? `hsl(var(--primary) / 0.3)`
                        : 'rgb(31 41 55)'
                }}
            >
                {!isCollapsed && (
                    <Link
                        href="/site-selection"
                        className="flex items-center gap-3 group flex-1 min-w-0"
                        title={currentOrganization?.name || "RAYMOND"}
                    >
                        <div className="flex flex-col flex-1 min-w-0">
                            <span className="text-xl font-black text-red-600 font-brand tracking-tighter leading-none truncate">
                                RAYMOND
                            </span>
                            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-widest mt-1">
                                {currentOrganization?.name || "Logística"}
                            </span>
                        </div>
                    </Link>
                )}
                <button
                    onClick={onToggle}
                    className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                    aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {isCollapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
                </button>
            </div>

            {/* Navigation - Scrollable */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-1 sidebar-scrollbar">
                {Object.entries(modulesByCategory).map(([category, modules]) => {
                    if (modules.length === 0) return null

                    const isExpanded = expandedSections.includes(category)

                    return (
                        <div key={category} className="space-y-1">
                            {/* Category Header */}
                            {!isCollapsed && (
                                <button
                                    onClick={() => toggleSection(category)}
                                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-200"
                                    style={{
                                        color: currentOrganization?.accentColor
                                            ? `hsl(var(--accent))`
                                            : 'rgb(156 163 175)'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (currentOrganization?.accentColor) {
                                            e.currentTarget.style.color = `hsl(var(--accent-foreground))`;
                                            e.currentTarget.style.backgroundColor = `hsl(var(--accent) / 0.1)`;
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (currentOrganization?.accentColor) {
                                            e.currentTarget.style.color = `hsl(var(--accent))`;
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                        }
                                    }}
                                >
                                    <span>{t(`categories.${category}`)}</span>
                                    {isExpanded ? (
                                        <ChevronDown className="w-4 h-4" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4" />
                                    )}
                                </button>
                            )}

                            {/* Module Links */}
                            {(isCollapsed || isExpanded) && modules.map((module) => {
                                const Icon = module.icon
                                const isActive = pathname === module.path || pathname.startsWith(module.path + '/')

                                return (
                                    <Link
                                        key={module.id}
                                        href={module.path}
                                        className={cn(
                                            'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group relative overflow-hidden',
                                            isActive
                                                ? 'text-white font-medium shadow-lg'
                                                : 'text-gray-300 hover:text-white',
                                            isCollapsed && 'justify-center'
                                        )}
                                        style={isActive ? {
                                            background: currentOrganization?.primaryColor
                                                ? `linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-600)))`
                                                : '#2563eb'
                                        } : undefined}
                                        title={isCollapsed ? t(module.id) : undefined}
                                        onMouseEnter={(e) => {
                                            if (!isActive && currentOrganization?.primaryColor) {
                                                e.currentTarget.style.backgroundColor = `hsl(var(--primary) / 0.1)`;
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isActive) {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                            }
                                        }}
                                    >
                                        <Icon className={cn('flex-shrink-0', isCollapsed ? 'w-5 h-5' : 'w-5 h-5')} />
                                        {!isCollapsed && (
                                            <span className="text-sm font-medium truncate">{t(module.id)}</span>
                                        )}
                                        {!isCollapsed && isActive && (
                                            <div
                                                className="ml-auto w-1.5 h-1.5 rounded-full animate-pulse"
                                                style={{
                                                    backgroundColor: currentOrganization?.accentColor || '#60a5fa'
                                                }}
                                            />
                                        )}
                                    </Link>
                                )
                            })}
                        </div>
                    )
                })}
            </nav>

            {/* Footer */}
            {user && (
                <div
                    className={cn(
                        "border-t p-4 flex-shrink-0 bg-black/10",
                        isCollapsed ? "flex flex-col items-center" : "flex items-center gap-3"
                    )}
                    style={{
                        borderTopColor: currentOrganization?.primaryColor
                            ? `hsl(var(--primary) / 0.3)`
                            : 'rgb(31 41 55)'
                    }}
                >
                    <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-xs shadow-lg border-2 border-white/10 shrink-0"
                        style={{
                            background: currentOrganization?.secondaryColor
                                ? `linear-gradient(135deg, hsl(var(--secondary)), hsl(var(--accent)))`
                                : 'linear-gradient(135deg, #ef4444, #991b1b)'
                        }}
                    >
                        {user.firstName?.[0] || 'U'}
                    </div>

                    {!isCollapsed && (
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-white truncate leading-none">
                                {user.firstName} {user.lastName}
                            </p>
                            <p
                                className="text-[10px] font-black uppercase tracking-widest mt-1 truncate"
                                style={{
                                    color: currentOrganization?.accentColor
                                        ? `hsl(var(--accent))`
                                        : '#ef4444'
                                }}
                            >
                                {user.role || 'Usuario'}
                            </p>
                        </div>
                    )}

                    <button
                        onClick={() => signOut()}
                        title="Cerrar sesión"
                        className={cn(
                            "p-2 rounded-lg transition-all duration-200",
                            isCollapsed ? "mt-2 hover:bg-red-500/20 text-red-500" : "hover:bg-white/10 text-gray-400 hover:text-white"
                        )}
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            )}
            <div className="px-4 py-2 text-[10px] text-gray-500 font-medium text-center border-t border-gray-800/30 flex-shrink-0">
                {!isCollapsed ? `Raymond ERP V.3.0.3` : `V3.0.3`}
            </div>
        </aside>
    )
}
