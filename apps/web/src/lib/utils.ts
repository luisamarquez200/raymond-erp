import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
    }).format(amount)
}

export function formatDate(date: Date | string | null | undefined, format: 'short' | 'long' | 'relative' = 'short'): string {
    if (!date) return '-'
    const d = typeof date === 'string' ? new Date(date) : date

    if (format === 'relative') {
        const now = new Date()
        const diff = now.getTime() - d.getTime()
        const seconds = Math.floor(diff / 1000)
        const minutes = Math.floor(seconds / 60)
        const hours = Math.floor(minutes / 60)
        const days = Math.floor(hours / 24)

        if (days > 7) return d.toLocaleDateString()
        if (days > 0) return `${days}d ago`
        if (hours > 0) return `${hours}h ago`
        if (minutes > 0) return `${minutes}m ago`
        return 'Just now'
    }

    if (format === 'long') {
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    })
}

export function formatNumber(num: number): string {
    return new Intl.NumberFormat('en-US').format(num)
}

export function getInitials(firstName?: string | null, lastName?: string | null, email?: string | null): string {
    const first = firstName?.charAt(0) || ''
    const last = lastName?.charAt(0) || ''
    const initials = `${first}${last}`.toUpperCase()

    // If no name, use first letter of email or default to 'U'
    if (!initials || initials.length === 0) {
        return email?.charAt(0).toUpperCase() || 'U'
    }

    return initials
}

export function truncate(str: string, length: number): string {
    if (str.length <= length) return str
    return str.slice(0, length) + '...'
}

export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null

    return function executedFunction(...args: Parameters<T>) {
        const later = () => {
            timeout = null
            func(...args)
        }

        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(later, wait)
    }
}

export function getErrorMessage(error: unknown, fallback?: string): string {
    if (typeof error === 'string') return error;

    if (error && typeof error === 'object') {
        const err = error as any;

        if (err.response?.data?.message) {
            const msg = err.response.data.message;
            return Array.isArray(msg) ? msg.join(', ') : String(msg);
        }

        if (err.response?.data?.error) return String(err.response.data.error);
        if (err.message) return String(err.message);
    }

    return fallback || 'Error inesperado. Intenta de nuevo.';
}
