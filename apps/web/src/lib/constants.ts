import {
    LayoutDashboard,
    FolderKanban,
    CheckSquare,
    Clock,
    Receipt,
    DollarSign,
    Users,
    Shield,
    Building2,
    Settings,
    FileText,
    BarChart3,
    Calendar,
    Zap,
    BookOpen,
    Target,
    TrendingUp,
    UserCheck,
    Truck,
    CreditCard,
    Banknote,
    Repeat,
    FileSpreadsheet,
    ShoppingCart,
    Radio
} from 'lucide-react'

export interface Module {
    id: string
    name: string
    path: string
    icon: any
    description: string
    category: 'core' | 'finance' | 'admin' | 'tools'
    requiredRole?: string[]
    requiredPermission?: string
}

export const MODULES: Module[] = [
    // Core Modules - Ordered as requested

    // 2. Clientes
    {
        id: 'clients',
        name: 'Clients',
        path: '/clients',
        icon: UserCheck,
        description: 'Client management',
        category: 'core',
        requiredRole: ['Admin', 'Superadmin', 'CEO', 'CFO', 'Contador Senior', 'Gerente Operaciones', 'Supervisor'],
    },
    // 3. Administración Comercial
    {
        id: 'administracion-comercial',
        name: 'Administración Comercial',
        path: '/administracion-comercial/cargue-masivo',
        icon: FileSpreadsheet,
        description: 'Gestión comercial y cargue masivo',
        category: 'core',
        requiredRole: ['Admin', 'Administrador', 'Superadmin', 'CEO', 'CFO', 'Gerente Operaciones'],
    },
    // R4 Comercial
    {
        id: 'r4-flotilla',
        name: 'Flotilla / Activos',
        path: '/r4/flotilla',
        icon: Truck,
        description: 'Gestión de activos de flotilla',
        category: 'core',
        requiredRole: ['Admin', 'Administrador', 'Superadmin', 'Gerente Operaciones'],
    },
    {
        id: 'r4-rentas',
        name: 'Rentas',
        path: '/r4/rentas',
        icon: Receipt,
        description: 'Gestión de rentas de equipos',
        category: 'core',
        requiredRole: ['Admin', 'Administrador', 'Superadmin', 'Gerente Operaciones'],
    },
    {
        id: 'r4-carga-masiva',
        name: 'Carga Masiva',
        path: '/r4/carga-masiva',
        icon: FileSpreadsheet,
        description: 'Importación masiva Excel',
        category: 'core',
        requiredRole: ['Admin', 'Administrador', 'Superadmin', 'Gerente Operaciones'],
    },
    // Other Core Modules



    // Admin Modules - EXCLUSIVE FOR CEO
    {
        id: 'users',
        name: 'Users',
        path: '/users',
        icon: Users,
        description: 'User management',
        category: 'admin',
        requiredRole: ['Admin', 'Superadmin', 'CEO'],
    },
    {
        id: 'roles',
        name: 'Roles & Permissions',
        path: '/roles',
        icon: Shield,
        description: 'Role management',
        category: 'admin',
        requiredRole: ['Admin', 'Superadmin', 'CEO'],
    },
    {
        id: 'organization',
        name: 'Organization',
        path: '/organization',
        icon: Building2,
        description: 'Organization settings',
        category: 'admin',
        requiredRole: ['Admin', 'Superadmin', 'CEO'],
    },
    {
        id: 'audit',
        name: 'Audit Logs',
        path: '/audit',
        icon: FileText,
        description: 'System audit logs',
        category: 'admin',
        requiredRole: ['Admin', 'Superadmin', 'CEO', 'CFO', 'Contador Senior'],
    },
    {
        id: 'modules-management',
        name: 'Modules Management',
        path: '/admin/modules',
        icon: Settings,
        description: 'Control module visibility',
        category: 'admin',
        requiredRole: ['Super Admin', 'Superadmin'],
    },

    // Tools
    {
        id: 'analytics',
        name: 'Analytics',
        path: '/analytics',
        icon: BarChart3,
        description: 'Custom analytics',
        category: 'tools',
        requiredRole: ['Admin', 'Superadmin', 'CEO', 'CFO', 'Contador Senior', 'Gerente Operaciones', 'Supervisor'],
    },
    {
        id: 'calendar',
        name: 'Calendar',
        path: '/calendar',
        icon: Calendar,
        description: 'Calendar and events',
        category: 'tools',
    },
    {
        id: 'settings',
        name: 'Settings',
        path: '/settings',
        icon: Settings,
        description: 'User settings',
        category: 'tools',
    },
]

export const STATUS_COLORS = {
    ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    INACTIVE: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
    PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    COMPLETED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    ON_HOLD: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
}

export const PRIORITY_COLORS = {
    LOW: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
    MEDIUM: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
    URGENT: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
}

export const APP_NAME = 'Revenue Management'
export const APP_DESCRIPTION = 'Revenue Management System'
export const APP_VERSION = '2.0.0'

export const checkModuleAccess = (moduleId: string, user: any): boolean => {
    if (!user) return false

    // CRITICAL: Superadmin users have access to ALL modules
    if (user.isSuperadmin) {
        return true;
    }

    const module = MODULES.find(m => m.id === moduleId)
    if (!module) return true // If module not found in config, assume public or handle elsewhere
    if (!module.requiredRole) return true

    const userRole = typeof user.role === 'object' ? (user.role as any).name : user.role

    // SUPERADMIN has access to all modules
    if (userRole === 'Superadmin' || userRole === 'Super Admin' || userRole?.toUpperCase() === 'SUPERADMIN') {
        return true;
    }

    return module.requiredRole.includes(userRole)
}
