import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions, SkipPermissions } from '../../common/decorators/permissions.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';

@ApiTags('Users')
@ApiBearerAuth('JWT')
@Controller('users')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @Permissions('users:create')
    @ApiOperation({ summary: 'Create a new user' })
    @ApiResponse({ status: 201, description: 'User created successfully' })
    @ApiResponse({ status: 400, description: 'Invalid input data' })
    @ApiResponse({ status: 409, description: 'Email already exists' })
    @ApiResponse({ status: 403, description: 'Only Superadmin can assign Superadmin role' })
    create(@Request() req, @Body() createUserDto: CreateUserDto) {
        return this.usersService.create(createUserDto, req.user.organization_id, req.user);
    }

    @Get()
    @Permissions('users:read')
    @ApiOperation({ summary: 'Get all users in organization' })
    @ApiResponse({ status: 200, description: 'List of users' })
    findAll(@Request() req) {
        return this.usersService.findAll(req.user.organization_id);
    }

    @Patch('me')
    @SkipPermissions()
    @ApiOperation({ summary: 'Update own profile (no permission required)' })
    @ApiResponse({ status: 200, description: 'Profile updated successfully' })
    @ApiResponse({ status: 404, description: 'User not found' })
    @ApiResponse({ status: 400, description: 'Cannot update restricted fields through this endpoint' })
    async updateOwnProfile(@Body() updateUserDto: UpdateUserDto, @Request() req) {
        // Users can always update their own profile (name, avatar)
        // But restrict sensitive fields
        const restrictedFields = ['email', 'role_id', 'is_active'];
        const hasRestrictedFields = restrictedFields.some(field => updateUserDto[field as keyof UpdateUserDto] !== undefined);
        
        if (hasRestrictedFields) {
            throw new BadRequestException('Cannot update email, role, or active status through this endpoint. Use /users/:id with proper permissions.');
        }
        
        return this.usersService.update(req.user.id, updateUserDto, req.user.organization_id || null, req.user);
    }

    @Get('me')
    @SkipPermissions()
    @ApiOperation({ summary: 'Get own profile (no permission required)' })
    @ApiResponse({ status: 200, description: 'Own user details' })
    @ApiResponse({ status: 404, description: 'User not found' })
    findMe(@Request() req) {
        return this.usersService.findOne(req.user.id, req.user.organization_id);
    }

    @Get(':id')
    @Permissions('users:read')
    @ApiOperation({ summary: 'Get user by ID' })
    @ApiResponse({ status: 200, description: 'User details' })
    @ApiResponse({ status: 404, description: 'User not found' })
    findOne(@Param('id') id: string, @Request() req) {
        return this.usersService.findOne(id, req.user.organization_id);
    }

    @Patch(':id')
    @Permissions('users:update')
    @ApiOperation({ summary: 'Update user' })
    @ApiResponse({ status: 200, description: 'User updated successfully' })
    @ApiResponse({ status: 404, description: 'User not found' })
    @ApiResponse({ status: 409, description: 'Email already exists' })
    @ApiResponse({ status: 403, description: 'Cannot deactivate own account or only Superadmin can assign Superadmin role' })
    update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @Request() req) {
        return this.usersService.update(id, updateUserDto, req.user.organization_id || null, req.user);
    }

    @Patch(':id/change-password')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Change user password (requires current password validation)' })
    @ApiResponse({ status: 200, description: 'Password changed successfully' })
    @ApiResponse({ status: 400, description: 'Invalid current password or weak new password' })
    @ApiResponse({ status: 404, description: 'User not found' })
    @ApiResponse({ status: 403, description: 'Cannot change password for other users' })
    async changePassword(
        @Param('id') id: string,
        @Body() changePasswordDto: ChangePasswordDto,
        @Request() req,
    ) {
        // Security: Users can only change their own password
        if (id !== req.user.id) {
            throw new BadRequestException('You can only change your own password');
        }
        return this.usersService.changePassword(id, changePasswordDto, req.user.organization_id);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @Permissions('users:delete')
    @ApiOperation({ summary: 'Delete user (soft delete)' })
    @ApiResponse({ status: 200, description: 'User deleted successfully' })
    @ApiResponse({ status: 404, description: 'User not found' })
    @ApiResponse({ status: 403, description: 'Cannot delete own account' })
    remove(@Param('id') id: string, @Request() req) {
        return this.usersService.remove(id, req.user.organization_id, req.user.id);
    }
}
