'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { SuperadminService } from '@/services/superadmin.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'

const createOrganizationSchema = z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    slug: z
        .string()
        .optional()
        .refine(
            (val) => !val || /^[a-z0-9-]+$/.test(val),
            'El slug solo puede contener letras minúsculas, números y guiones'
        ),
    adminEmail: z.string().email('Email inválido'),
    adminFirstName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    adminLastName: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
    adminPassword: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
})

type CreateOrganizationFormData = z.infer<typeof createOrganizationSchema>

export default function CreateOrganizationPage() {
    const [showPassword, setShowPassword] = useState(false)
    const router = useRouter()
    const queryClient = useQueryClient()

    const { register, handleSubmit, formState: { errors }, watch } = useForm<CreateOrganizationFormData>({
        resolver: zodResolver(createOrganizationSchema),
    })

    const organizationName = watch('name')

    // Auto-generate slug from name
    const generateSlug = (name: string) => {
        return name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove accents
            .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
            .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    }

    const createOrganization = useMutation({
        mutationFn: (data: CreateOrganizationFormData) => {
            const payload = {
                ...data,
                slug: data.slug || generateSlug(data.name),
            }
            return SuperadminService.createOrganization(payload)
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['superadmin', 'organizations'] })
            queryClient.invalidateQueries({ queryKey: ['superadmin', 'analytics'] })
            toast.success(`Organización "${data.organization.name}" creada exitosamente`)
            router.push('/superadmin/organizations')
        },
        onError: (error: any) => {
            console.error('[createOrganization] Error:', error)
            let message = 'Error al crear la organización'
            
            if (error?.response?.status === 409) {
                // Conflict - slug or email already exists
                message = error?.response?.data?.message || 'La organización o el email ya existen'
            } else if (error?.response?.status === 400) {
                // Bad request - validation error
                const validationErrors = error?.response?.data?.message
                if (Array.isArray(validationErrors)) {
                    message = validationErrors.join(', ')
                } else {
                    message = validationErrors || 'Datos inválidos. Por favor, revisa el formulario.'
                }
            } else if (error?.response?.status === 500) {
                // Internal server error
                message = error?.response?.data?.message || 'Error interno del servidor. Por favor, intenta nuevamente.'
            } else if (error?.response?.data?.message) {
                message = error.response.data.message
            } else if (error?.message) {
                message = error.message
            }
            
            toast.error(message)
        },
    })

    const onSubmit = async (data: CreateOrganizationFormData) => {
        createOrganization.mutate(data)
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <Button
                    variant="ghost"
                    onClick={() => router.back()}
                    className="mb-4"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Volver
                </Button>
                <div className="flex items-center mb-2">
                    <Building2 className="h-8 w-8 text-blue-600 mr-3" />
                    <h1 className="text-3xl font-bold text-gray-900">Crear Nueva Organización</h1>
                </div>
                <p className="text-gray-600 mt-2">
                    Crea una nueva organización con un usuario administrador
                </p>
            </div>

            <Card className="p-6">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {/* Organization Information */}
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Información de la Organización</h2>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nombre de la Organización *</Label>
                                <Input
                                    id="name"
                                    {...register('name')}
                                    type="text"
                                    placeholder="Mi Organización"
                                />
                                {errors.name && (
                                    <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="slug">Slug (opcional)</Label>
                                <Input
                                    id="slug"
                                    {...register('slug')}
                                    type="text"
                                    placeholder={organizationName ? generateSlug(organizationName) : 'mi-organizacion'}
                                />
                                <p className="text-xs text-gray-500">
                                    Se generará automáticamente desde el nombre si se deja vacío. Solo letras minúsculas, números y guiones.
                                </p>
                                {errors.slug && (
                                    <p className="text-red-500 text-xs mt-1">{errors.slug.message}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Admin User Information */}
                    <div className="border-t pt-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Usuario Administrador</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="adminFirstName">Nombre *</Label>
                                    <Input
                                        id="adminFirstName"
                                        {...register('adminFirstName')}
                                        type="text"
                                        placeholder="Juan"
                                    />
                                    {errors.adminFirstName && (
                                        <p className="text-red-500 text-xs mt-1">{errors.adminFirstName.message}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="adminLastName">Apellido *</Label>
                                    <Input
                                        id="adminLastName"
                                        {...register('adminLastName')}
                                        type="text"
                                        placeholder="Pérez"
                                    />
                                    {errors.adminLastName && (
                                        <p className="text-red-500 text-xs mt-1">{errors.adminLastName.message}</p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="adminEmail">Email *</Label>
                                <Input
                                    id="adminEmail"
                                    {...register('adminEmail')}
                                    type="email"
                                    placeholder="admin@organizacion.com"
                                />
                                {errors.adminEmail && (
                                    <p className="text-red-500 text-xs mt-1">{errors.adminEmail.message}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="adminPassword">Contraseña *</Label>
                                <div className="relative">
                                    <Input
                                        id="adminPassword"
                                        {...register('adminPassword')}
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Mínimo 8 caracteres"
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                {errors.adminPassword && (
                                    <p className="text-red-500 text-xs mt-1">{errors.adminPassword.message}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end space-x-3 pt-4 border-t">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => router.back()}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={createOrganization.isPending}
                        >
                            {createOrganization.isPending ? 'Creando...' : 'Crear Organización'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    )
}

