'use client'

import { useState, useRef } from 'react'
import { User, Lock, Bell, Upload, X, Mail, Shield, Eye, EyeOff } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ImageCropper } from '@/components/ui/image-cropper'
import { useAuthStore } from '@/store/auth.store'
import { getInitials } from '@/lib/utils'
import { useUpdateProfile, useChangePassword } from '@/hooks/useProfile'
import { toast } from 'sonner'

export default function SettingsPage() {
    const { user, setUser } = useAuthStore()
    const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications'>('profile')
    const updateProfile = useUpdateProfile()
    const changePassword = useChangePassword()
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Helper to get avatar URL (handles base64 and regular URLs)
    const getAvatarUrl = (url?: string | null): string | undefined => {
        if (!url) return undefined;
        // If it's already a full URL (http/https), return as is
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        // If it's base64, return as is (data:image/...)
        if (url.startsWith('data:image/')) {
            return url;
        }
        // Otherwise, assume it's a relative path or base64 without prefix
        return url;
    }

    const [profileData, setProfileData] = useState({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        avatarUrl: user?.avatarUrl || '',
    })

    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    })

    const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
    const [showCropper, setShowCropper] = useState(false)
    const [imageToCrop, setImageToCrop] = useState<string | null>(null)
    const [showCurrentPassword, setShowCurrentPassword] = useState(false)
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('image/')) {
            toast.error('Por favor selecciona un archivo de imagen')
            return
        }

        if (file.size > 10 * 1024 * 1024) {
            toast.error('La imagen debe ser menor a 10MB')
            return
        }

        const reader = new FileReader()
        reader.onload = (event) => {
            const imageData = event.target?.result as string
            setImageToCrop(imageData)
            setShowCropper(true)
        }
        reader.onerror = () => {
            toast.error('Error al leer la imagen')
        }
        reader.readAsDataURL(file)
    }

    const handleCropComplete = (croppedImage: string) => {
        // Validate base64 image size (max 5MB)
        const base64Size = (croppedImage.length * 3) / 4 / 1024 / 1024 // Approximate size in MB
        if (base64Size > 5) {
            toast.error('La imagen recortada es demasiado grande. Por favor, intenta con una imagen más pequeña.')
            setShowCropper(false)
            setImageToCrop(null)
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
            return
        }
        
        setAvatarPreview(croppedImage)
        setProfileData({ ...profileData, avatarUrl: croppedImage })
        setShowCropper(false)
        setImageToCrop(null)
        toast.success('Imagen recortada exitosamente')
    }

    const handleCropCancel = () => {
        setShowCropper(false)
        setImageToCrop(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const handleRemoveAvatar = () => {
        setAvatarPreview(null)
        setProfileData({ ...profileData, avatarUrl: '' })
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
        toast.success('Foto de perfil eliminada')
    }

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        
        // Validate required fields
        if (!profileData.firstName || !profileData.lastName) {
            toast.error('Nombre y apellido son requeridos')
            return
        }
        
        try {
            const updatedUser = await updateProfile.mutateAsync({
                firstName: profileData.firstName,
                lastName: profileData.lastName,
                avatarUrl: profileData.avatarUrl || avatarPreview || undefined,
            })
            if (updatedUser && user) {
                // Update local state with transformed data
                const transformedUser = {
                    ...user,
                    firstName: updatedUser.firstName || updatedUser.first_name || user.firstName,
                    lastName: updatedUser.lastName || updatedUser.last_name || user.lastName,
                    avatarUrl: updatedUser.avatarUrl || updatedUser.avatar_url || user.avatarUrl,
                }
                setUser(transformedUser)
                // Update profileData to reflect saved state
                setProfileData({
                    firstName: transformedUser.firstName || '',
                    lastName: transformedUser.lastName || '',
                    avatarUrl: transformedUser.avatarUrl || '',
                })
                // Clear preview after successful save
                setAvatarPreview(null)
            }
        } catch (error: any) {
            // Error handling is done in the hook, but log for debugging
            // Error handled by toast notification
            // The hook will show the toast error
        }
    }

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            toast.error('Las contraseñas no coinciden')
            return
        }

        if (passwordData.newPassword.length < 8) {
            toast.error('La contraseña debe tener al menos 8 caracteres')
            return
        }

        try {
            await changePassword.mutateAsync({
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword,
                confirmPassword: passwordData.confirmPassword,
            })
            setPasswordData({
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
            })
        } catch (error) {
            // Error handling is done in the hook
        }
    }

    return (
        <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
            {/* Header Simple */}
            <div className="mb-4 sm:mb-6">
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100">Configuración</h1>
            </div>

            {/* Tabs Horizontal - Scroll on mobile */}
            <div className="mb-4 sm:mb-6 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                <nav className="flex space-x-4 sm:space-x-8 min-w-max sm:min-w-0">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                            activeTab === 'profile'
                                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                    >
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span>Perfil</span>
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('security')}
                        className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                            activeTab === 'security'
                                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                    >
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span>Seguridad</span>
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('notifications')}
                        className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                            activeTab === 'notifications'
                                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                    >
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span>Notificaciones</span>
                        </div>
                    </button>
                </nav>
            </div>

            {/* Content - Compact and Visible */}
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
                {activeTab === 'profile' && (
                    <div className="p-4 sm:p-6">
                        <form onSubmit={handleProfileSubmit} className="space-y-4 sm:space-y-6">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleAvatarChange}
                                className="hidden"
                            />
                            {/* Avatar Row - Horizontal Layout */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 pb-4 sm:pb-6 border-b border-gray-200 dark:border-gray-700">
                                <Avatar className="h-16 w-16 sm:h-20 sm:w-20 shrink-0">
                                    <AvatarImage 
                                        src={getAvatarUrl(avatarPreview || profileData.avatarUrl || user?.avatarUrl)} 
                                        alt={`${profileData.firstName || user?.firstName || ''} ${profileData.lastName || user?.lastName || ''}`}
                                        onError={(e) => {
                                            // Hide image on error, show fallback
                                            e.currentTarget.style.display = 'none';
                                        }}
                                    />
                                    <AvatarFallback className="text-lg sm:text-xl">
                                        {getInitials(profileData.firstName || user?.firstName || '', profileData.lastName || user?.lastName || '')}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 w-full sm:w-auto">
                                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                                        Foto de Perfil
                                    </Label>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <Upload className="w-4 h-4 mr-2" />
                                            Cambiar
                                        </Button>
                                        {(avatarPreview || profileData.avatarUrl) && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={handleRemoveAvatar}
                                            >
                                                <X className="w-4 h-4 mr-2" />
                                                Eliminar
                                            </Button>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                        JPG, PNG o GIF. Máximo 10MB
                                    </p>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleAvatarChange}
                                        className="hidden"
                                    />
                                </div>
                            </div>

                            {/* Form Fields - 2 Columns */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                <div>
                                    <Label htmlFor="firstName" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Nombre
                                    </Label>
                                    <Input
                                        id="firstName"
                                        type="text"
                                        value={profileData.firstName}
                                        onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                                        required
                                        className="mt-1.5"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="lastName" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Apellido
                                    </Label>
                                    <Input
                                        id="lastName"
                                        type="text"
                                        value={profileData.lastName}
                                        onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                                        required
                                        className="mt-1.5"
                                    />
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                    <Mail className="w-4 h-4" />
                                    Email
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={user?.email || ''}
                                    disabled
                                    className="mt-1.5 bg-gray-50 dark:bg-gray-800"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                                    El email no puede ser modificado
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <Button 
                                    type="button" 
                                    variant="outline"
                                    onClick={() => {
                                        setProfileData({
                                            firstName: user?.firstName || '',
                                            lastName: user?.lastName || '',
                                            avatarUrl: user?.avatarUrl || '',
                                        })
                                        setAvatarPreview(null)
                                        if (fileInputRef.current) {
                                            fileInputRef.current.value = ''
                                        }
                                    }}
                                >
                                    Cancelar
                                </Button>
                                <Button 
                                    type="submit"
                                    disabled={updateProfile.isPending}
                                >
                                    {updateProfile.isPending ? 'Guardando...' : 'Guardar Cambios'}
                                </Button>
                            </div>
                        </form>
                    </div>
                )}

                {activeTab === 'security' && (
                    <div className="p-6">
                        <form onSubmit={handlePasswordSubmit} className="space-y-6 max-w-2xl">
                            <div className="space-y-2">
                                <Label htmlFor="currentPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Contraseña Actual
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="currentPassword"
                                        type={showCurrentPassword ? 'text' : 'password'}
                                        value={passwordData.currentPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                        required
                                        placeholder="Ingresa tu contraseña actual"
                                        className="mt-1.5 pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                                    >
                                        {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="newPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Nueva Contraseña
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="newPassword"
                                        type={showNewPassword ? 'text' : 'password'}
                                        value={passwordData.newPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                        required
                                        minLength={8}
                                        placeholder="Mínimo 8 caracteres"
                                        className="mt-1.5 pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                                    >
                                        {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Debe tener al menos 8 caracteres
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Confirmar Nueva Contraseña
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="confirmPassword"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        value={passwordData.confirmPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                        required
                                        minLength={8}
                                        placeholder="Confirma tu nueva contraseña"
                                        className="mt-1.5 pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                                    >
                                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <Button 
                                    type="button" 
                                    variant="outline"
                                    onClick={() => setPasswordData({
                                        currentPassword: '',
                                        newPassword: '',
                                        confirmPassword: '',
                                    })}
                                >
                                    Cancelar
                                </Button>
                                <Button 
                                    type="submit"
                                    disabled={changePassword.isPending}
                                >
                                    {changePassword.isPending ? 'Actualizando...' : 'Actualizar Contraseña'}
                                </Button>
                            </div>
                        </form>
                    </div>
                )}

                {activeTab === 'notifications' && (
                    <div className="p-6">
                        <div className="space-y-3 max-w-2xl">
                            {[
                                { name: 'Notificaciones por Email', desc: 'Recibe actualizaciones por correo electrónico' },
                                { name: 'Notificaciones Push', desc: 'Recibe notificaciones en tiempo real' },
                                { name: 'Actualizaciones de Tareas', desc: 'Notificaciones sobre cambios en tus tareas' },
                                { name: 'Actualizaciones de Proyectos', desc: 'Notificaciones sobre proyectos asignados' },
                                { name: 'Alertas Financieras', desc: 'Notificaciones importantes del módulo financiero' },
                            ].map((item) => (
                                <div 
                                    key={item.name} 
                                    className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                                >
                                    <div>
                                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                            {item.name}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            {item.desc}
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer ml-4">
                                        <input type="checkbox" className="sr-only peer" defaultChecked />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Image Cropper Dialog */}
            {showCropper && imageToCrop && (
                <ImageCropper
                    image={imageToCrop}
                    onCrop={handleCropComplete}
                    onCancel={handleCropCancel}
                    aspectRatio={1}
                    circularCrop={true}
                />
            )}
        </div>
    )
}
