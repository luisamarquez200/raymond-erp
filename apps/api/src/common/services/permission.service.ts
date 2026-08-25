import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PermissionAction, PermissionScope, PermissionConfig } from '../decorators/permissions.decorator';

/**
 * Permission Service
 * Centralized permission logic with RBAC + PBAC + TBAC support
 */

@Injectable()
export class PermissionService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Check if user has specific permissions
     */
    async hasPermissions(user_id: string, requiredPermissions: string[]): Promise<boolean> {
        if (!user_id) return false;

        const user = await this.prisma.users.findUnique({
            where: { id: user_id },
            include: {
                roles: {
                    include: {
                        role_permissions: { // Fixed: use role_permissions instead of permissions
                            include: {
                                permissions: true, // Fixed: use permissions instead of permission
                            },
                        },
                    },
                },
            },
        });

        if (!user || !user.roles) return false;

        // Superadmin has all permissions
        if (user.roles.name === 'Superadmin') return true;

        const userPermissions = (user.roles.role_permissions || [])
            .filter(rp => rp?.permissions?.resource && rp?.permissions?.action)
            .map(rp => `${rp.permissions.resource}:${rp.permissions.action}`);

        // Check if user has all required permissions
        return requiredPermissions.every(required => {
            // Check for exact match
            if (userPermissions.includes(required)) return true;

            // Check for wildcard permissions
            const [resource, action] = required.split(':');

            // Check resource:* (all actions on resource)
            if (userPermissions.includes(`${resource}:*`)) return true;

            // Check *:action (action on all resources)
            if (userPermissions.includes(`*:${action}`)) return true;

            // Check *:* (all permissions)
            if (userPermissions.includes('*:*')) return true;

            // CRITICAL FIX: Check for finance:read -> finance.*:read pattern
            // This handles cases where controllers request "finance:read" but permissions
            // are stored as "finance.accounts:read", "finance.journal-entries:read", etc.
            // Also handles cases where user has "finance.*:*" pattern
            if (resource === 'finance' && !resource.includes('.')) {
                // Check if user has finance.*:* pattern (all finance permissions)
                if (userPermissions.includes('finance.*:*')) return true;
                
                // Check if user has any finance.* permission with the requested action
                const hasFinancePermission = userPermissions.some(perm => {
                    const [permResource, permAction] = perm.split(':');
                    // Match finance.*:action or finance.*:*
                    return permResource.startsWith('finance.') && 
                           (permAction === action || permAction === '*');
                });
                if (hasFinancePermission) return true;
            }

            // CRITICAL FIX: Check for resource.*:* pattern (e.g., finance.*:*)
            // This handles cases where roles have "finance.*:*" but controllers request "finance:read"
            const resourceWildcard = `${resource}.*:*`;
            if (userPermissions.includes(resourceWildcard)) return true;

            return false;
        });
    }

    /**
     * Check advanced permission with scope
     */
    async hasAdvancedPermission(
        user_id: string,
        config: PermissionConfig,
        resourceOwnerId?: string,
        resourceTeamIds?: string[]
    ): Promise<boolean> {
        if (!user_id) return false;

        const user = await this.prisma.users.findUnique({
            where: { id: user_id },
            include: { roles: true },
        });

        if (!user) return false;

        // Check basic permission first
        const hasBasicPermission = await this.hasPermissions(
            user_id,
            [`${config.resource}:${config.action}`]
        );

        if (!hasBasicPermission) return false;

        // Check scope if specified
        if (config.scope) {
            return this.checkScope(config.scope, user_id, resourceOwnerId, resourceTeamIds);
        }

        return true;
    }

    /**
     * Check scope-based access
     */
    private checkScope(
        scope: PermissionScope,
        user_id: string,
        resourceOwnerId?: string,
        resourceTeamIds?: string[]
    ): boolean {
        switch (scope) {
            case PermissionScope.OWN:
                return user_id === resourceOwnerId;

            case PermissionScope.TEAM:
                return resourceTeamIds?.includes(user_id) || user_id === resourceOwnerId;

            case PermissionScope.ALL:
                return true;

            default:
                return false;
        }
    }

    /**
     * Check if user has financial access
     */
    async hasFinancialAccess(user_id: string): Promise<boolean> {
        if (!user_id) return false;

        const user = await this.prisma.users.findUnique({
            where: { id: user_id },
            include: { roles: true },
        });

        if (!user || !user.roles) return false;

        const financialRoles = [
            'Superadmin',
            'CEO',
            'Owner',
            'CFO',
            'Contador Senior',
            'Contador',
        ];

        return financialRoles.includes(user.roles.name);
    }

    /**
     * Check minimum role level
     */
    async hasMinimumRoleLevel(user_id: string, minimumLevel: number): Promise<boolean> {
        if (!user_id) return false;

        const user = await this.prisma.users.findUnique({
            where: { id: user_id },
            include: { roles: true },
        });

        if (!user || !user.roles) return false;

        return user.roles.level >= minimumLevel;
    }

    /**
     * Check role category
     */
    async hasRoleCategory(user_id: string, categories: string[]): Promise<boolean> {
        if (!user_id) return false;

        const user = await this.prisma.users.findUnique({
            where: { id: user_id },
            include: { roles: true },
        });

        if (!user || !user.roles || !user.roles.category) return false;

        return categories.includes(user.roles.category);
    }

    /**
     * Get user's effective permissions
     */
    async getUserPermissions(user_id: string): Promise<string[]> {
        if (!user_id) return [];

        const user = await this.prisma.users.findUnique({
            where: { id: user_id },
            include: {
                roles: {
                    include: {
                        role_permissions: { // Fixed: use role_permissions instead of permissions
                            include: {
                                permissions: true, // Fixed: use permissions instead of permission
                            },
                        },
                    },
                },
            },
        });

        if (!user || !user.roles) return [];

        return (user.roles.role_permissions || [])
            .filter(rp => rp?.permissions?.resource && rp?.permissions?.action)
            .map(rp => `${rp.permissions.resource}:${rp.permissions.action}`);
    }

    /**
     * Check if user can approve (requires level 7+)
     */
    async canApprove(user_id: string): Promise<boolean> {
        return this.hasMinimumRoleLevel(user_id, 7);
    }

    /**
     * Check if user can manage (requires level 6+)
     */
    async canManage(user_id: string): Promise<boolean> {
        return this.hasMinimumRoleLevel(user_id, 6);
    }
}
