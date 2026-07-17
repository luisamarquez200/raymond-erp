'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useCreateUser } from '@/hooks/useUsers';
import { Eye, EyeOff } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { useAuthStore } from '@/store/auth.store';

const createUserSchema = z.object({
    firstName: z.string().min(2, 'El nombre es requerido'),
    lastName: z.string().min(2, 'El apellido es requerido'),
    email: z.string().email('Email inválido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    roleId: z.string().min(1, 'El rol es requerido'),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;

export default function CreateUserPage() {
    const router = useRouter();
    const createUser = useCreateUser();
    const { user } = useAuthStore();

    // Check if current user is Superadmin
    const isSuperadmin = user?.isSuperadmin === true ||
                        (typeof user?.role === 'object' && (user?.role as any)?.name === 'Superadmin') ||
                        (typeof user?.role === 'string' && user?.role === 'Superadmin');

    // Allowed roles for user creation/editing
    // NOTE: Superadmin can ONLY be assigned by other Superadmins
    // Regular users cannot see or assign the Superadmin role
    const ALLOWED_ROLES = isSuperadmin ? [
        'Superadmin', // ONLY visible to Superadmins
        'CEO',
        'CFO',
        'Contador Senior',
        'Gerente Operaciones',
        'Supervisor',
        'Project Manager',
        'Developer',
        'Operario',
    ] : [
        // Regular users - highest role is CEO
        'CEO',
        'CFO',
        'Contador Senior',
        'Gerente Operaciones',
        'Supervisor',
        'Project Manager',
        'Developer',
        'Operario',
    ];

    // Fetch roles and filter to only allowed ones
    const { data: allRoles = [] } = useQuery({
        queryKey: ['roles'],
        queryFn: async () => {
            const response = await api.get('/roles');
            const body = response.data;
            if (Array.isArray(body)) return body;
            if (body?.data && Array.isArray(body.data)) return body.data;
            return [];
        },
    });

    // Filter roles to only show allowed ones
    const roles = allRoles.filter((role: { id: string; name: string }) => 
        ALLOWED_ROLES.some(allowed => 
            role.name.toLowerCase() === allowed.toLowerCase()
        )
    );

    const { register, handleSubmit, control, formState: { errors } } = useForm<CreateUserFormData>({
        resolver: zodResolver(createUserSchema),
    });
    const [showPassword, setShowPassword] = useState(false);

    const onSubmit = async (data: CreateUserFormData) => {
        try {
            await createUser.mutateAsync(data);
            router.push('/users');
        } catch (error) {
            // Error handling is done in the hook
        }
    };

    return (
        <div className="container max-w-2xl mx-auto py-8 px-4">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Crear Nuevo Usuario</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Completa la información para crear un nuevo usuario</p>
            </div>

            <Card className="p-6">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="firstName">Nombre *</Label>
                            <Input
                                id="firstName"
                                {...register('firstName')}
                                type="text"
                                placeholder="Juan"
                            />
                            {errors.firstName && (
                                <p className="text-red-500 text-xs mt-1">{errors.firstName.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="lastName">Apellido *</Label>
                            <Input
                                id="lastName"
                                {...register('lastName')}
                                type="text"
                                placeholder="Pérez"
                            />
                            {errors.lastName && (
                                <p className="text-red-500 text-xs mt-1">{errors.lastName.message}</p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                            id="email"
                            {...register('email')}
                            type="email"
                            placeholder="usuario@ejemplo.com"
                        />
                        {errors.email && (
                            <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Contraseña *</Label>
                        <div className="relative">
                            <Input
                                id="password"
                                {...register('password')}
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Mínimo 8 caracteres"
                                className="pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        {errors.password && (
                            <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="roleId">Rol *</Label>
                        <Controller
                            name="roleId"
                            control={control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar rol" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {roles.map((role: { id: string; name: string }) => (
                                            <SelectItem key={role.id} value={role.id}>
                                                {role.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        {errors.roleId && (
                            <p className="text-red-500 text-xs mt-1">{errors.roleId.message}</p>
                        )}
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => router.back()}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={createUser.isPending}
                        >
                            {createUser.isPending ? 'Creando...' : 'Crear Usuario'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
}
