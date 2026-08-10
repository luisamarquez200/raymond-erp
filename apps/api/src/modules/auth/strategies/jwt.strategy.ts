import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthRepository } from '../auth.repository';
import { UserContext } from '../../../common/context/user.context';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private readonly configService: ConfigService,
        private readonly authRepository: AuthRepository,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('JWT_SECRET'),
        });
        // Security: Don't log secret information in production
        if (process.env.NODE_ENV === 'development') {
            const secret = configService.get<string>('JWT_SECRET');
            console.log(`[JwtStrategy] Initialized with secret: ${secret ? 'YES (Length: ' + secret.length + ')' : 'NO'}`);
        }
    }

    async validate(payload: any) {
        // Security: Don't log sensitive payload data in production
        if (process.env.NODE_ENV === 'development') {
            console.log(`[JwtStrategy] Validating payload: ${JSON.stringify(payload)}`);
        }

        // 1. Check structural integrity of payload
        // CRITICAL: orgId can be NULL for SuperAdmin global users
        if (!payload.sub || !payload.email) {
            throw new UnauthorizedException('Invalid token payload: Missing critical fields');
        }

        // 2. Real User Lookup (Security Critical)
        const user = await this.authRepository.findUserById(payload.sub);
        if (!user) {
            // Security: Log without exposing user ID in production
            if (process.env.NODE_ENV === 'development') {
                console.log(`[JwtStrategy] User not found for sub: ${payload.sub}`);
            }
            throw new UnauthorizedException('User not found or access revoked');
        }

        // 3. Integrity Check: Ensure Token Org matches User Org
        // CRITICAL: SUPERADMIN can have organization_id = NULL (global access)
        const isSuperadmin = user.roles?.name === 'Superadmin';
        const isCEO = user.roles?.name === 'CEO';

        // For SuperAdmin global users, organization_id can be NULL
        if (isSuperadmin && !user.organization_id) {
            // SuperAdmin global user - no organization constraint
            if (process.env.NODE_ENV === 'development') {
                console.log(`[JwtStrategy] SuperAdmin global user detected (no org constraint)`);
            }
        } else if (!isSuperadmin && !user.organization_id) {
            // Regular user MUST have an organization
            if (process.env.NODE_ENV === 'development') {
                console.log(`[JwtStrategy] Regular user has no organization_id`);
            }
            throw new UnauthorizedException('User has no organization assigned');
        } else if (!isSuperadmin && user.organization_id !== payload.orgId) {
            // Special case: isTaller tokens don't carry orgId in the payload.
            // If orgId is missing from the token but the user has an assigned organization
            // in the database, trust the DB value and allow the request.
            if (!payload.orgId && user.organization_id) {
                if (process.env.NODE_ENV === 'development') {
                    console.log(`[JwtStrategy] Token has no orgId (isTaller token). Trusting user org from DB: ${user.organization_id}`);
                }
                // Allow through - organization_id will be taken from user record below
            } else {
                // Regular user org must match token org
                if (process.env.NODE_ENV === 'development') {
                    console.log(`[JwtStrategy] Org mismatch. User: ${user.organization_id}, Token: ${payload.orgId}`);
                }
                throw new UnauthorizedException('Organization context mismatch');
            }
        }

        // 4. Return full context for Request
        // CRITICAL: For global SuperAdmin (org_id=NULL), use payload.orgId if present (allows switching)
        // For regular users, always use their assigned organization_id
        let organization_id: string | null;

        if (isSuperadmin && !user.organization_id) {
            // Global SuperAdmin - can use orgId from token (when switching orgs) or stay global (NULL)
            organization_id = payload.orgId || null;
        } else {
            // Regular user or org-assigned SuperAdmin - use their organization_id
            organization_id = user.organization_id || null;
        }

        const roleName = user.roles?.name || (typeof user.roles === 'string' ? user.roles : payload.role || 'Usuario');

        // CRITICAL: Set UserContext BEFORE returning user object
        // This ensures Prisma extension can access it
        UserContext.setUser({
            id: user.id,
            roles: roleName,
            isSuperadmin: isSuperadmin,
        });

        if (process.env.NODE_ENV === 'development') {
            console.log(`[JwtStrategy] UserContext set - id: ${user.id}, roles: ${roleName}, isSuperadmin: ${isSuperadmin}, isCEO: ${isCEO}, org: ${organization_id}`);
        }

        return {
            id: user.id,
            email: user.email,
            role_id: user.role_id,
            roles: roleName,
            first_name: user.first_name,
            last_name: user.last_name,
            adc_asociado_name: (user as any).adc_asociado_name,
            organization_id,
            isSuperadmin, // Add flag for guards and services
            isCEO, // Add CEO flag for role-specific validations
        };
    }
}
