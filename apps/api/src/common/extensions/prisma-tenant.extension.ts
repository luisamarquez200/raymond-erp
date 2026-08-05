import { PrismaClient } from '@prisma/client';
import { TenantContext } from '../context/tenant.context';
import { UserContext } from '../context/user.context';

export const prismaTenantExtension = (prisma: PrismaClient) => {
    return prisma.$extends({
        query: {
            $allModels: {
                async $allOperations({ model, operation, args, query }) {
                    const tenantId = TenantContext.getTenantId();
                    const userContext = UserContext.getUser();
                    const isSuperadmin = userContext?.isSuperadmin === true || userContext?.roles === 'Superadmin';

                    // Log for debugging - ALWAYS log in development
                    console.log(`[PrismaTenantExtension] Model: ${model}, Operation: ${operation}, TenantId: ${tenantId}, IsSuperadmin: ${isSuperadmin}, UserContext: ${JSON.stringify(userContext)}`);

                    // Models to exclude from tenant filtering (e.g., Organization itself, or System tables)
                    // Permission is global and not tenant-specific
                    // RolePermission is a junction table without organization_id (filtering is done through Role relation)
                    // Note: Prisma passes model name in lowercase (e.g., 'projects', 'users')
                    const globalModels = ['organizations', 'audit_logs', 'sessions', 'password_reset_tokens', 'permissions', 'role_permissions', 'documento', 'documentos', 'activo', 'renta', 'detallesrenta', 'cliente', 'sitio'];

                    // Global models bypass tenant filtering
                    if (model && globalModels.includes(model.toLowerCase())) {
                        console.log(`[PrismaTenantExtension] Bypassing tenant filter for global model: ${model}`);
                        return query(args);
                    }

                    // If no tenantId, bypass filtering (shouldn't happen in normal flow)
                    if (!tenantId) {
                        console.log(`[PrismaTenantExtension] WARNING: No tenantId, bypassing filter for model: ${model}, operation: ${operation}`);
                        return query(args);
                    }

                    // SUPERADMIN: Always apply tenant filtering when tenantId is set
                    // This allows SUPERADMIN to switch between organizations via header
                    if (isSuperadmin) {
                        console.log(`[PrismaTenantExtension] SUPERADMIN applying tenant filter: ${tenantId}, model: ${model}, operation: ${operation}`);
                        // Continue to apply filtering below
                    }

                    // Apply tenant filtering for read operations
                    if (operation === 'findUnique' || operation === 'findFirst' || operation === 'findMany' || operation === 'count' || operation === 'aggregate' || operation === 'groupBy') {
                        // Merge with existing where clause
                        if (!args.where) {
                            args.where = {};
                        }
                        const originalWhere = JSON.stringify(args.where);
                        const whereAny = args.where as any;
                        
                        // CRITICAL: Handle AND/OR clauses to ensure organization_id is always enforced
                        // If there's an AND clause, ensure organization_id is in it
                        // If there's an OR clause, wrap it in AND with organization_id
                        if (whereAny.AND && Array.isArray(whereAny.AND)) {
                            // Check if organization_id is already in AND array
                            const hasOrgIdInAnd = whereAny.AND.some((condition: any) => 
                                condition && typeof condition === 'object' && condition.organization_id
                            );
                            
                            if (!hasOrgIdInAnd) {
                                // Add organization_id to AND array
                                whereAny.AND.push({ organization_id: tenantId });
                                console.log(`[PrismaTenantExtension] ✅ Added organization_id to AND clause: ${tenantId}. Model: ${model}`);
                            } else {
                                // Verify all organization_id in AND match tenantId
                                whereAny.AND.forEach((condition: any, index: number) => {
                                    if (condition && typeof condition === 'object' && condition.organization_id) {
                                        if (condition.organization_id !== tenantId) {
                                            console.error(`[PrismaTenantExtension] 🚨 SECURITY: organization_id mismatch in AND[${index}]! Has: ${condition.organization_id}, but tenantId is: ${tenantId}. Overriding.`);
                                            condition.organization_id = tenantId;
                                        }
                                    }
                                });
                            }
                        } else if (whereAny.OR && Array.isArray(whereAny.OR)) {
                            // CRITICAL: OR clause without AND - wrap in AND to ensure organization_id is enforced
                            console.log(`[PrismaTenantExtension] ⚠️ OR clause detected without AND, wrapping to enforce organization_id`);
                            const orConditions = whereAny.OR;
                            delete whereAny.OR;
                            whereAny.AND = [
                                { organization_id: tenantId },
                                { OR: orConditions }
                            ];
                            console.log(`[PrismaTenantExtension] ✅ Wrapped OR in AND with organization_id: ${tenantId}. Model: ${model}`);
                        } else {
                            // Simple where clause - check organization_id directly
                            if (whereAny.organization_id && whereAny.organization_id !== tenantId) {
                                console.error(`[PrismaTenantExtension] 🚨 SECURITY: organization_id mismatch! Where clause has: ${whereAny.organization_id}, but tenantId is: ${tenantId}. Overriding for security.`);
                                whereAny.organization_id = tenantId;
                            } else if (!whereAny.organization_id) {
                                // Add organization_id filter if not present
                                whereAny.organization_id = tenantId;
                                console.log(`[PrismaTenantExtension] ✅ Added organization_id filter: ${tenantId}. Model: ${model}, Operation: ${operation}`);
                            } else if (whereAny.organization_id === tenantId) {
                                // organization_id matches tenantId - all good, no need to modify
                                console.log(`[PrismaTenantExtension] ✅ organization_id already matches tenant (${tenantId}). Model: ${model}`);
                            } else {
                                // This case shouldn't happen, but handle it just in case
                                console.warn(`[PrismaTenantExtension] ⚠️ Unexpected state: organization_id=${whereAny.organization_id}, tenantId=${tenantId}`);
                            }
                        }
                        
                        console.log(`[PrismaTenantExtension] Final where clause: ${JSON.stringify(args.where)}`);
                    }

                    if (operation === 'create' || operation === 'createMany') {
                        if (args.data) {
                            if (Array.isArray(args.data)) {
                                args.data.forEach((item: any) => {
                                    // CRITICAL: Always enforce tenant filtering for create operations
                                    if (item.organization_id && item.organization_id !== tenantId) {
                                        console.error(`[PrismaTenantExtension] 🚨 SECURITY: organization_id mismatch in createMany! Item has: ${item.organization_id}, but tenantId is: ${tenantId}. Overriding for security.`);
                                        item.organization_id = tenantId;
                                    } else {
                                        item.organization_id = tenantId;
                                    }
                                });
                            } else {
                                const dataAny = args.data as any;
                                // CRITICAL: Always enforce tenant filtering for create operations
                                if (dataAny.organization_id && dataAny.organization_id !== tenantId) {
                                    console.error(`[PrismaTenantExtension] 🚨 SECURITY: organization_id mismatch in create! Data has: ${dataAny.organization_id}, but tenantId is: ${tenantId}. Overriding for security.`);
                                    dataAny.organization_id = tenantId;
                                } else {
                                    dataAny.organization_id = tenantId;
                                }
                            }
                        }
                    }

                    if (operation === 'update' || operation === 'updateMany' || operation === 'delete' || operation === 'deleteMany') {
                        // CRITICAL: Always enforce tenant filtering for write operations
                        if (!args.where) {
                            args.where = {};
                        }
                        const whereAny = args.where as any;
                        
                        // If organization_id exists in where clause, verify it matches tenantId
                        if (whereAny.organization_id && whereAny.organization_id !== tenantId) {
                            console.error(`[PrismaTenantExtension] 🚨 SECURITY: organization_id mismatch in ${operation}! Where clause has: ${whereAny.organization_id}, but tenantId is: ${tenantId}. Overriding for security.`);
                            whereAny.organization_id = tenantId;
                        } else if (!whereAny.organization_id) {
                            // Add organization_id filter if not present
                            whereAny.organization_id = tenantId;
                            console.log(`[PrismaTenantExtension] ✅ Added organization_id filter to ${operation}: ${tenantId}. Model: ${model}`);
                        } else {
                            console.log(`[PrismaTenantExtension] ✅ organization_id already matches tenant (${tenantId}) in ${operation}. Model: ${model}`);
                        }
                    }

                    return query(args);
                },
            },
        },
    });
};
