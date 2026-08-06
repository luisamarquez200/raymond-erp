import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SUPERADMIN_ROLES, getRoleLevel } from '../constants/roles.constants';

/**
 * Guard para gestión de roles y permisos con separación SUPERADMIN vs CEO
 *
 * Reglas:
 * - Solo SUPERADMIN puede:
 *   - Crear/modificar/eliminar permisos marcados como is_superadmin_only
 *   - Modificar o eliminar el rol "Superadmin"
 *   - Asignar permisos is_superadmin_only a roles
 *   - Crear roles con nivel >= 100
 *
 * - CEO puede:
 *   - Crear/modificar roles de nivel <= 90
 *   - Asignar permisos NO marcados como is_superadmin_only
 *   - Ver todos los roles excepto "Superadmin"
 */
@Injectable()
export class RoleManagementGuard implements CanActivate {
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            throw new ForbiddenException('Authentication required');
        }

        // Obtener el nombre del rol del usuario
        const roleName = typeof user.roles === 'string'
            ? user.roles
            : user.roles?.name || user.roleName || '';

        if (!roleName) {
            throw new ForbiddenException('User role not found');
        }

        const normalizedRole = roleName.toUpperCase().trim();

        // Verificar si es SUPERADMIN
        const isSuperadmin = SUPERADMIN_ROLES.some(
            role => role.toUpperCase() === normalizedRole
        );

        // Verificar si es CEO
        const isCEO = normalizedRole === 'CEO';
        
        // Verificar si es ADMINISTRADOR
        const isAdministrador = normalizedRole === 'ADMINISTRADOR';
 
        // Solo SUPERADMIN, CEO o ADMINISTRADOR pueden acceder a endpoints de gestión de roles
        if (!isSuperadmin && !isCEO && !isAdministrador) {
            throw new ForbiddenException(
                'Access denied. Only Superadmin, CEO and Administrador can manage roles and permissions.'
            );
        }
 
        // Agregar flags al request para uso posterior
        request.user.isSuperadmin = isSuperadmin;
        request.user.isCEO = isCEO;
        request.user.isAdministrador = isAdministrador;
        request.user.roleLevel = getRoleLevel(roleName);

        return true;
    }
}
