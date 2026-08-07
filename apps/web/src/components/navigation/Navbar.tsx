'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Settings, LogOut, User, Building2, X } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useOrganizationStore } from '@/store/organization.store'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import ThemeSwitcher from '../system/ThemeSwitcher'
import LanguageSwitcher from '../system/LanguageSwitcher'
import OrganizationSelector from '../organization/OrganizationSelector'
import OrganizationBadge from '../organization/OrganizationBadge'
import { getInitials } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import api from '@/lib/api'

interface SearchResult {
    id: string
    type: string
    title: string
    subtitle: string
    url: string
}

import NotificationBell from './NotificationBell'

export default function Navbar() {
    const router = useRouter()
    const { user, signOut } = useAuthStore()
    const { currentOrganization } = useOrganizationStore()
    const { theme, resolvedTheme } = useTheme()
    const [showUserMenu, setShowUserMenu] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<SearchResult[]>([])
    const [showResults, setShowResults] = useState(false)
    const [isSearching, setIsSearching] = useState(false)
    const searchRef = useRef<HTMLDivElement>(null)
    const t = useTranslations('navigation')

    // Determine if we're in dark mode
    const currentTheme = theme === 'system' ? resolvedTheme : theme
    const isDark = currentTheme === 'dark'

    const handleLogout = async () => {
        await signOut()
        router.push('/')
    }

    // Handle search
    useEffect(() => {
        const performSearch = async () => {
            if (!searchQuery.trim()) {
                setSearchResults([])
                setShowResults(false)
                return
            }

            setIsSearching(true)
            try {
                // Search across multiple endpoints
                const [projectsRes, tasksRes, clientsRes, suppliersRes] = await Promise.allSettled([
                    api.get(`/projects?search=${encodeURIComponent(searchQuery)}&limit=5`),
                    api.get(`/tasks?search=${encodeURIComponent(searchQuery)}&limit=5`),
                    api.get(`/clients?search=${encodeURIComponent(searchQuery)}&limit=5`),
                    api.get(`/suppliers?search=${encodeURIComponent(searchQuery)}&limit=5`),
                ])

                const results: SearchResult[] = []

                if (projectsRes.status === 'fulfilled') {
                    const projects = Array.isArray(projectsRes.value.data)
                        ? projectsRes.value.data
                        : (projectsRes.value.data?.data || [])
                    projects.forEach((p: { id: string; name: string; client?: { nombre: string } }) => {
                        results.push({
                            id: p.id,
                            type: 'project',
                            title: p.name,
                            subtitle: p.client?.nombre || 'No client',
                            url: `/projects`
                        })
                    })
                }

                if (tasksRes.status === 'fulfilled') {
                    const tasks = Array.isArray(tasksRes.value.data)
                        ? tasksRes.value.data
                        : (tasksRes.value.data?.data || [])
                    tasks.forEach((task: { id: string; title: string; project?: { name: string } }) => {
                        results.push({
                            id: task.id,
                            type: 'task',
                            title: task.title,
                            subtitle: task.project?.name || 'No project',
                            url: `/tasks`
                        })
                    })
                }

                if (clientsRes.status === 'fulfilled') {
                    const clients = Array.isArray(clientsRes.value.data)
                        ? clientsRes.value.data
                        : (clientsRes.value.data?.data || [])
                    clients.forEach((c: { id: string; nombre: string; contacto?: string; email?: string }) => {
                        results.push({
                            id: c.id,
                            type: 'client',
                            title: c.nombre,
                            subtitle: c.contacto || c.email || 'No contact',
                            url: `/clients`
                        })
                    })
                }

                if (suppliersRes.status === 'fulfilled') {
                    const suppliers = Array.isArray(suppliersRes.value.data)
                        ? suppliersRes.value.data
                        : (suppliersRes.value.data?.data || [])
                    suppliers.forEach((s: { id: string; nombre: string; contacto?: string; email?: string }) => {
                        results.push({
                            id: s.id,
                            type: 'supplier',
                            title: s.nombre,
                            subtitle: s.contacto || s.email || 'No contact',
                            url: `/suppliers`
                        })
                    })
                }

                setSearchResults(results.slice(0, 8))
                setShowResults(results.length > 0)
            } catch (error) {
                console.error('Search error:', error)
                setSearchResults([])
                setShowResults(false)
            } finally {
                setIsSearching(false)
            }
        }

        const debounceTimer = setTimeout(performSearch, 300)
        return () => clearTimeout(debounceTimer)
    }, [searchQuery])

    // Close search results when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleResultClick = (url: string) => {
        setSearchQuery('')
        setShowResults(false)
        router.push(url)
    }

    const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            project: t('projects'),
            task: t('tasks'),
            client: t('clients'),
            supplier: t('suppliers'),
        }
        return labels[type] || type
    }

    return (
        <>
            {/* Mobile Navbar - Integrated with dark header */}
            <div className="lg:hidden flex items-center gap-1 sm:gap-2">
                {/* Mobile Search Button */}
                <button
                    onClick={() => {
                        // Could open a mobile search modal
                        const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement
                        if (searchInput) searchInput.focus()
                    }}
                    className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                    aria-label="Search"
                >
                    <Search className="w-5 h-5 text-gray-300" />
                </button>

                {/* Theme Switcher - Mobile */}
                <div className="block [&>button]:bg-gray-800 [&>button]:border-gray-700 [&>button:hover]:bg-gray-700 [&>button]:text-gray-300 [&>button]:shadow-none">
                    <ThemeSwitcher />
                </div>

                <NotificationBell />

                {/* Language Switcher - Mobile */}
                <div className="block [&>div>button]:bg-gray-800 [&>div>button]:border-gray-700 [&>div>button:hover]:bg-gray-700 [&>div>button]:text-gray-300 [&>div>button]:px-2 [&>div>button]:py-1.5 [&>div>button]:text-xs [&>div>button]:border [&>div>button]:shadow-none">
                    <LanguageSwitcher />
                </div>

                {/* User Menu */}
                <div className="relative">
                    <button
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-800 transition-colors"
                    >
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={user?.avatarUrl || undefined} alt={user?.firstName} />
                            <AvatarFallback className="text-xs bg-gray-700 text-white">{getInitials(user?.firstName || '', user?.lastName || '')}</AvatarFallback>
                        </Avatar>
                    </button>

                    {/* Dropdown */}
                    {showUserMenu && (
                        <>
                            <div
                                className="fixed inset-0 z-10"
                                onClick={() => setShowUserMenu(false)}
                            />
                            <div className="absolute right-0 mt-2 w-56 sm:w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {user?.firstName} {user?.lastName}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                        {user?.email}
                                    </p>
                                </div>

                                <button
                                    onClick={() => {
                                        router.push('/settings')
                                        setShowUserMenu(false)
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    <User className="w-4 h-4" />
                                    {t('profile')}
                                </button>

                                <button
                                    onClick={() => {
                                        router.push('/organization')
                                        setShowUserMenu(false)
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    <Building2 className="w-4 h-4" />
                                    {t('organization')}
                                </button>

                                {/* SuperAdmin Panel - Only visible to SuperAdmin users */}
                                {user?.isSuperadmin && (
                                    <button
                                        onClick={() => {
                                            router.push('/superadmin')
                                            setShowUserMenu(false)
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2 text-sm bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 text-purple-700 dark:text-purple-300 hover:from-purple-100 hover:to-blue-100 dark:hover:from-purple-900/30 dark:hover:to-blue-900/30 border-y border-purple-200 dark:border-purple-800"
                                    >
                                        <Settings className="w-4 h-4" />
                                        <span className="font-semibold">SuperAdmin Panel</span>
                                    </button>
                                )}

                                <button
                                    onClick={() => {
                                        router.push('/settings')
                                        setShowUserMenu(false)
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    <Settings className="w-4 h-4" />
                                    {t('settings')}
                                </button>

                                <div className="border-t border-gray-200 dark:border-gray-700 my-1" />

                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    <LogOut className="w-4 h-4" />
                                    {t('signOut')}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Desktop Navbar */}
            <header
                className="hidden lg:flex h-16 border-b items-center justify-between px-2 sm:px-3 md:px-6 gap-1 sm:gap-2 md:gap-3"
                style={{
                    backgroundColor: isDark && currentOrganization?.primaryColor
                        ? `hsl(var(--primary) / 0.95)`
                        : isDark
                            ? '#1f2937' // gray-800
                            : '#ffffff', // white
                    borderBottomColor: isDark && currentOrganization?.primaryColor
                        ? `hsl(var(--primary) / 0.3)`
                        : isDark
                            ? 'rgb(55 65 81)' // gray-700
                            : 'rgb(229 231 235)' // gray-200
                }}
            >
                {/* Organization Selector - Desktop */}
                <div className="hidden xl:block">
                    <OrganizationSelector variant="compact" />
                </div>

                {/* Search - Hidden on mobile, shown on tablet+ */}
                <div className="flex flex-1 max-w-xl relative" ref={searchRef}>
                    <div className="relative w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder={t('searchPlaceholder') || "Search projects, tasks, users..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => searchQuery && setShowResults(true)}
                            className="w-full pl-10 pr-10 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => {
                                    setSearchQuery('')
                                    setShowResults(false)
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            >
                                <X className="w-4 h-4 text-gray-400" />
                            </button>
                        )}
                    </div>

                    {/* Search Results Dropdown */}
                    {showResults && (
                        <div className="absolute top-full mt-2 w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto z-50">
                            {isSearching ? (
                                <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                    Searching...
                                </div>
                            ) : searchResults.length > 0 ? (
                                <div className="py-2">
                                    {searchResults.map((result) => (
                                        <button
                                            key={`${result.type}-${result.id}`}
                                            onClick={() => handleResultClick(result.url)}
                                            className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                                        {result.title}
                                                    </p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                                        {result.subtitle}
                                                    </p>
                                                </div>
                                                <span className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 shrink-0">
                                                    {getTypeLabel(result.type)}
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                    No results found
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Section - Desktop */}
                <div className="flex items-center gap-1 sm:gap-2">
                    {/* Theme Switcher */}
                    <div className="block">
                        <ThemeSwitcher />
                    </div>
                    {/* Language Switcher */}
                    <div className="block">
                        <LanguageSwitcher />
                    </div>
                    {/* User Menu */}
                    <div className="relative">
                        <button
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            className="flex items-center gap-1 sm:gap-2 p-1 sm:p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <Avatar className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9">
                                <AvatarImage src={user?.avatarUrl || undefined} alt={user?.firstName} />
                                <AvatarFallback className="text-[10px] sm:text-xs md:text-sm">{getInitials(user?.firstName || '', user?.lastName || '')}</AvatarFallback>
                            </Avatar>
                            <div className="text-left hidden xl:block">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {user?.firstName} {user?.lastName}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {typeof user?.role === 'object' ? (user?.role as { name: string })?.name : user?.role}
                                </p>
                            </div>
                        </button>

                        {/* Dropdown - Responsive positioning */}
                        {showUserMenu && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setShowUserMenu(false)}
                                />
                                <div className="absolute right-0 mt-2 w-56 sm:w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                            {user?.firstName} {user?.lastName}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                            {user?.email}
                                        </p>
                                        <div className="mt-2">
                                            <OrganizationBadge variant="compact" />
                                        </div>
                                    </div>

                                    {/* Organization Selector */}
                                    <div className="px-2 py-2 border-b border-gray-200 dark:border-gray-700">
                                        <OrganizationSelector variant="compact" showSearch={false} />
                                    </div>

                                    <button
                                        onClick={() => {
                                            router.push('/settings')
                                            setShowUserMenu(false)
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
                                        <User className="w-4 h-4" />
                                        {t('profile')}
                                    </button>

                                    <button
                                        onClick={() => {
                                            router.push('/organization')
                                            setShowUserMenu(false)
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
                                        <Building2 className="w-4 h-4" />
                                        {t('organization')}
                                    </button>

                                    {/* SuperAdmin Panel - Only visible to SuperAdmin users */}
                                    {user?.isSuperadmin && (
                                        <button
                                            onClick={() => {
                                                router.push('/superadmin')
                                                setShowUserMenu(false)
                                            }}
                                            className="w-full flex items-center gap-3 px-4 py-2 text-sm bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 text-purple-700 dark:text-purple-300 hover:from-purple-100 hover:to-blue-100 dark:hover:from-purple-900/30 dark:hover:to-blue-900/30 border-y border-purple-200 dark:border-purple-800"
                                        >
                                            <Settings className="w-4 h-4" />
                                            <span className="font-semibold">SuperAdmin Panel</span>
                                        </button>
                                    )}

                                    <button
                                        onClick={() => {
                                            router.push('/settings')
                                            setShowUserMenu(false)
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
                                        <Settings className="w-4 h-4" />
                                        {t('settings')}
                                    </button>

                                    <div className="border-t border-gray-200 dark:border-gray-700 my-1" />

                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        {t('signOut')}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </header>
        </>
    )
}
