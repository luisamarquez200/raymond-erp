'use client'

import { useState } from 'react'
import { Edit, Shield, X, AlertCircle, Plus, Search, UserCheck, ShieldCheck, Mail, Lock, Unlock, CheckCircle2, User, ChevronRight, Save, Eye, EyeOff } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import Loader from '@/components/ui/loader'
import { useTallerUsuarios, useCreateTallerUsuario, useUpdateTallerUsuario, type TallerUsuario } from '@/hooks/taller-r1/useTallerUsuarios'
import { getInitials } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const ALLOWED_TALLER_ROLES = [
    'Administrador',
    'Almacenista',
    'Supervisor comercial',
    'Comercial',
    'Visitante'
]

export default function TallerR1UsuariosPage() {
    const { user: currentUser } = useAuthStore()
    const { data: usuarios = [], isLoading } = useTallerUsuarios()
    const createUsuario = useCreateTallerUsuario()
    const updateUsuario = useUpdateTallerUsuario()

    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isCreateMode, setIsCreateMode] = useState(false)
    const [selectedUsuario, setSelectedUsuario] = useState<TallerUsuario | null>(null)
    const [searchQuery, setSearchQuery] = useState('')

    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmCancel, setShowConfirmCancel] = useState(false)
    const [passwordError, setPasswordError] = useState('')
    const [passwordInput, setPasswordInput] = useState('')
    const [showDetailModal, setShowDetailModal] = useState(false)
    const [isEditingUsuario, setIsEditingUsuario] = useState(false)
    const [selectedTalleres, setSelectedTalleres] = useState<string[]>([])

    const canManageUsers = currentUser?.email === 'j.molina@runsolutions-services.com' ||
        (() => {
            const roleName = typeof currentUser?.role === 'string'
                ? currentUser.role
                : (currentUser?.role as any)?.name;
            return roleName && ['Superadmin', 'Admin', 'Administrador'].includes(roleName);
        })()

    const handleCreate = () => {
        setSelectedUsuario(null)
        setIsCreateMode(true)
        setPasswordError('')
        setPasswordInput('')
        setSelectedTalleres([])
        setShowConfirmCancel(false)
        setIsDialogOpen(true)
    }

    const handleEdit = (usuario: TallerUsuario) => {
        setSelectedUsuario(usuario)
        setIsCreateMode(false)
        setPasswordError('')
        setPasswordInput('')
        setSelectedTalleres(usuario.sitio ? usuario.sitio.split(',').map((s: string) => s.trim()) : [])
        setShowConfirmCancel(false)
        setIsDialogOpen(true)
        setShowDetailModal(false)
    }

    const handleViewDetails = (usuario: TallerUsuario) => {
        setSelectedUsuario(usuario)
        setIsEditingUsuario(false)
        setPasswordInput('')
        setPasswordError('')
        setSelectedTalleres(usuario.sitio ? usuario.sitio.split(',').map((s: string) => s.trim()) : [])
        setShowDetailModal(true)
    }
    const handleToggleActive = async (usuario: TallerUsuario) => {
        if (!canManageUsers) return;
        try {
            await updateUsuario.mutateAsync({
                id: usuario.IDUsuarios,
                data: { UsuarioBloqueado: !usuario.UsuarioBloqueado }
            });
        } catch (error) {
            console.error(error);
        }
    }

    const requestClose = () => {
        // If editing in either dialog or detail modal, show cancel prompt
        setShowConfirmCancel(true);
    }

    const confirmClose = () => {
        setShowConfirmCancel(false);
        setIsDialogOpen(false);
        setIsEditingUsuario(false);
        setSelectedUsuario(null);
        setPasswordInput('')
    }

    const cancelClose = () => {
        setShowConfirmCancel(false);
    }

    const validatePassword = (password: string) => {
        if (!password) return true; // Optional on edit
        const hasUpperCase = /[A-Z]/.test(password);
        const hasNumber = /\d/.test(password);
        if (!hasUpperCase || !hasNumber || password.length < 8) {
            return false;
        }
        return true;
    }

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setPasswordInput(val);

        if (val.length > 0) {
            if (!validatePassword(val)) {
                setPasswordError("Mínimo 8 caracteres, 1 mayúscula y 1 número");
            } else {
                setPasswordError("");
            }
        } else {
            setPasswordError("");
        }
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        const password = passwordInput;

        if (password) {
            if (!validatePassword(password)) {
                setPasswordError("Mínimo 8 caracteres, 1 mayúscula y 1 número");
                return;
            } else {
                setPasswordError('');
            }
        } else if (isCreateMode) {
            setPasswordError("La contraseña es requerida.");
            return;
        }

        const data: Partial<TallerUsuario> & { ContrasenaUsuario?: string } = {
            Usuario: formData.get('Usuario') as string,
            Correo: formData.get('Correo') as string,
            Rol: formData.get('Rol') as string,
            sitio: selectedTalleres.length > 0 ? selectedTalleres.join(',') : '',
        }

        if (password) {
            data.ContrasenaUsuario = password
        }

        try {
            if (isCreateMode) {
                await createUsuario.mutateAsync(data as any)
            } else if (selectedUsuario) {
                await updateUsuario.mutateAsync({ id: selectedUsuario.IDUsuarios, data })
            }
            setIsDialogOpen(false)
            setIsEditingUsuario(false)
            setSelectedUsuario({ ...selectedUsuario, ...data, IDUsuarios: selectedUsuario?.IDUsuarios || '' } as TallerUsuario)
            setPasswordInput('')
            setPasswordError('')
        } catch (error) {
            // Error handling is done in the hooks
        }
    }

    const filteredUsuarios = usuarios.filter(usuario => {
        if (!searchQuery) return true
        const query = searchQuery.toLowerCase()
        return (
            usuario.Usuario.toLowerCase().includes(query) ||
            usuario.Correo.toLowerCase().includes(query) ||
            usuario.Rol.toLowerCase().includes(query)
        )
    }).filter(usuario => {
        // Si el usuario puede manejar a otros (ej. Admin), ve a todos.
        // Si no puede, SOLO se ve a sí mismo mediante el cruce de correo.
        if (canManageUsers) return true;
        return currentUser?.email === usuario.Correo;
    });

    return (
        <div className="space-y-4 sm:space-y-6 lg:p-6 p-4 max-w-7xl mx-auto w-full">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex-1 w-full relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por usuario, correo o rol..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 bg-white border-none rounded-2xl shadow-sm text-sm font-medium focus:ring-2 focus:ring-blue-500 transition-shadow transition-colors outline-none"
                    />
                </div>
                {canManageUsers && (
                    <Button onClick={handleCreate} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white rounded-xl px-6 h-12 shadow-md shadow-red-500/20 transition-all font-bold">
                        <Plus className="w-5 h-5 mr-2" />
                        Nuevo Usuario
                    </Button>
                )}
            </div>

            {isLoading ? (
                <div className="p-8 sm:p-12">
                    <Loader size="lg" text="Cargando usuarios de Taller R1..." />
                </div>
            ) : filteredUsuarios.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-gray-200">
                    <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">
                        {searchQuery ? 'No se encontraron usuarios que coincidan con la búsqueda' : 'No hay usuarios registrados en Taller R1'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredUsuarios.map((usuario) => {
                        const isAdmin = ['Administrador'].includes(usuario.Rol);
                        const isActive = !usuario.UsuarioBloqueado;

                        return (
                            <div
                                key={usuario.IDUsuarios}
                                onClick={() => handleViewDetails(usuario)}
                                className={`group bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm hover:shadow-2xl hover:border-red-100 transition-all cursor-pointer relative overflow-hidden ${!isActive ? 'opacity-75 grayscale-[0.5]' : ''}`}
                            >
                                {/* Status Badges */}
                                <div className="absolute top-6 right-8 flex gap-2">
                                    {!isActive && (
                                        <span className="bg-red-50 text-red-600 p-1.5 rounded-lg border border-red-100 shadow-sm">
                                            <Lock className="w-3 h-3" />
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-4 mb-6">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border group-hover:scale-105 transition-transform ${isAdmin ? 'bg-red-50 border-red-100 text-red-600' : 'bg-gray-100 border-gray-200 text-gray-700'}`}>
                                        <User className="w-6 h-6" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-lg font-black text-gray-900 leading-none group-hover:text-[#D8262F] transition-colors truncate">
                                            {usuario.Usuario}
                                        </h3>
                                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1.5 truncate">
                                            ID: {usuario.IDUsuarios} | LOC: {usuario.sitio || 'R1'}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-3 pt-6 border-t border-gray-50">
                                    <div className="flex items-center gap-3">
                                        <Mail className="w-3.5 h-3.5 text-gray-300" />
                                        <span className="text-[11px] font-bold text-gray-500 truncate">{usuario.Correo || 'Sin correo'}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Shield className="w-3.5 h-3.5 text-gray-300" />
                                        <span className="text-[11px] font-bold text-gray-500">{usuario.Rol}</span>
                                    </div>
                                </div>

                                {((canManageUsers) || (currentUser?.email === usuario.Correo && usuario.Rol !== 'Visitante')) && (
                                    <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-50 z-20 relative">
                                        {canManageUsers && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggleActive(usuario);
                                                }}
                                                className={`p-2 rounded-xl transition-colors disabled:opacity-50
                                                    ${isActive
                                                        ? 'text-amber-500 hover:bg-amber-50'
                                                        : 'text-emerald-500 hover:bg-emerald-50'
                                                    }`}
                                                title={isActive ? 'Bloquear' : 'Desbloquear'}
                                            >
                                                {isActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEdit(usuario);
                                            }}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                            title="Editar"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Unified Custom Modal para Crear / Ver / Editar */}
            {(isDialogOpen || showDetailModal) && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex justify-center items-center z-50 p-4" style={{ zIndex: 9999 }}>
                    <div className="bg-gray-50 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="bg-white border-b border-gray-100 p-8 flex justify-between items-start flex-none relative overflow-hidden">
                            <div className="relative z-10 w-full flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">
                                        {isCreateMode ? 'Nuevo Usuario' : (isEditingUsuario || isDialogOpen ? 'Editando Usuario' : 'Usuario')}
                                    </p>
                                    <h2 className="text-4xl font-black text-gray-900 leading-tight tracking-tight mt-1">
                                        {isCreateMode ? 'Crear Usuario' : selectedUsuario?.Usuario}
                                    </h2>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => {
                                            if (isCreateMode || isEditingUsuario || isDialogOpen) {
                                                requestClose();
                                            } else {
                                                setShowDetailModal(false);
                                            }
                                        }}
                                        className="p-3 hover:bg-gray-50 rounded-2xl transition-all text-gray-400 relative z-10"
                                    >
                                        <X className="w-8 h-8" />
                                    </button>
                                </div>
                            </div>
                            {/* Background Pattern */}
                            <div className="absolute right-0 top-0 opacity-[0.02] rotate-12 -mr-10 -mt-10 pointer-events-none">
                                <Shield className="w-48 h-48" />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-6">
                            {!isCreateMode && !isEditingUsuario && !isDialogOpen ? (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Info Cards */}
                                        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-1">
                                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Correo</p>
                                            <p className="text-sm font-bold text-gray-800 break-all">{selectedUsuario?.Correo || '---'}</p>
                                        </div>
                                        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-1">
                                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Contraseña</p>
                                            <p className="text-sm font-bold text-gray-800 flex items-center gap-2 font-mono">
                                                *****
                                            </p>
                                        </div>
                                        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-1">
                                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Rol</p>
                                            <p className="text-sm font-bold text-gray-800">{selectedUsuario?.Rol}</p>
                                        </div>
                                        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-1">
                                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Estado</p>
                                            <div className="flex items-center justify-between">
                                                <span className={`text-sm font-bold ${selectedUsuario?.UsuarioBloqueado ? 'text-red-500' : 'text-green-500'}`}>
                                                    {selectedUsuario?.UsuarioBloqueado ? 'Bloqueado' : 'Activo'}
                                                </span>
                                                {canManageUsers && (
                                                    <button onClick={() => selectedUsuario && handleToggleActive(selectedUsuario)} className="p-2 hover:bg-gray-50 rounded-lg transition-colors" title={selectedUsuario?.UsuarioBloqueado ? "Desbloquear" : "Bloquear"}>
                                                        {selectedUsuario?.UsuarioBloqueado ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Lock className="w-5 h-5 text-red-500" />}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {((canManageUsers) || (currentUser?.email === selectedUsuario?.Correo && selectedUsuario?.Rol !== 'Visitante')) && (
                                        <div className="flex justify-end mt-4">
                                            <button
                                                onClick={() => setIsEditingUsuario(true)}
                                                className="px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 bg-gray-900 text-white shadow-lg hover:bg-gray-800"
                                            >
                                                <Edit className="w-3.5 h-3.5" />
                                                Editar Usuario
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <form key={`form-mode-${isCreateMode ? 'create' : 'edit'}`} onSubmit={handleSubmit} className="space-y-6 animate-in slide-in-from-top-4 duration-300">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-4">Nombre de Usuario</label>
                                            <input
                                                type="text"
                                                name="Usuario"
                                                defaultValue={selectedUsuario?.Usuario}
                                                className="w-full bg-white border border-gray-200 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-red-50 focus:border-[#D8262F] outline-none transition-all disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                                                required
                                                disabled={!canManageUsers && !isCreateMode}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-4">Correo Electrónico</label>
                                            <input
                                                type="email"
                                                name="Correo"
                                                defaultValue={selectedUsuario?.Correo}
                                                className="w-full bg-white border border-gray-200 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-red-50 focus:border-[#D8262F] outline-none transition-all disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                                                required
                                                disabled={!canManageUsers && !isCreateMode}
                                            />
                                        </div>
                                        <div className="md:col-span-1">
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-4">Rol del Usuario</label>
                                            <select
                                                name="Rol"
                                                defaultValue={selectedUsuario?.Rol || ''}
                                                className="w-full bg-white border border-gray-200 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-red-50 focus:border-[#D8262F] outline-none transition-all appearance-none disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                                                required
                                                disabled={!canManageUsers && !isCreateMode}
                                            >
                                                <option value="" disabled>Seleccione un rol</option>
                                                {ALLOWED_TALLER_ROLES.map((rol) => (
                                                    <option key={rol} value={rol}>
                                                        {rol}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="md:col-span-1">
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-4">Lugar Asignado (Múltiple)</label>
                                            <div className="flex flex-wrap gap-2 px-4 py-2">
                                                {['R1', 'R2', 'R3'].map((ub) => {
                                                    const isSelected = selectedTalleres.includes(ub);
                                                    return (
                                                        <button
                                                            key={ub}
                                                            type="button"
                                                            disabled={!canManageUsers && !isCreateMode}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                setSelectedTalleres(prev =>
                                                                    prev.includes(ub)
                                                                        ? prev.filter(u => u !== ub)
                                                                        : [...prev, ub]
                                                                )
                                                            }}
                                                            className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all border disabled:opacity-50 disabled:cursor-not-allowed ${isSelected
                                                                ? 'bg-red-50 text-red-600 border-red-200 shadow-sm'
                                                                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                                                }`}
                                                        >
                                                            {ub}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                        <div className="md:col-span-1">
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-4">
                                                {isCreateMode ? 'Contraseña *' : 'Nueva Contraseña (Opcional)'}
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    placeholder={isCreateMode ? "Ingresa una contraseña" : "Dejar en blanco para no cambiar"}
                                                    name="password"
                                                    value={passwordInput}
                                                    onChange={handlePasswordChange}
                                                    className="w-full bg-white border border-gray-200 rounded-2xl px-6 py-4 pr-12 text-sm font-bold focus:ring-4 focus:ring-red-50 focus:border-[#D8262F] outline-none transition-all"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(p => !p)}
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-50"
                                                    tabIndex={-1}
                                                    title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                                                >
                                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                            {passwordInput && (
                                                <div className="mt-3 ml-4 space-y-1">
                                                    <div className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-tighter ${passwordInput.length >= 8 ? 'text-green-500' : 'text-gray-400'}`}>
                                                        <div className={`w-1.5 h-1.5 rounded-full ${passwordInput.length >= 8 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                                        Mínimo 8 caracteres
                                                    </div>
                                                    <div className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-tighter ${/\d/.test(passwordInput) ? 'text-green-500' : 'text-gray-400'}`}>
                                                        <div className={`w-1.5 h-1.5 rounded-full ${/\d/.test(passwordInput) ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                                        Al menos un número
                                                    </div>
                                                    <div className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-tighter ${/[A-Z]/.test(passwordInput) ? 'text-green-500' : 'text-gray-400'}`}>
                                                        <div className={`w-1.5 h-1.5 rounded-full ${/[A-Z]/.test(passwordInput) ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                                        Al menos una mayúscula
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-4 pt-4">
                                        <button
                                            type="button"
                                            onClick={requestClose}
                                            className="w-full bg-white text-gray-700 border border-gray-200 font-black px-8 py-4 rounded-2xl hover:bg-gray-50 transition-all shadow-sm flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={updateUsuario.isPending || createUsuario.isPending || !!passwordError || (passwordInput.length > 0 && (passwordInput.length < 8 || !/\d/.test(passwordInput) || !/[A-Z]/.test(passwordInput)))}
                                            className="w-full bg-[#D8262F] text-white font-black px-8 py-4 rounded-2xl hover:bg-[#b91c24] transition-all shadow-xl shadow-red-100 flex items-center justify-center gap-2 uppercase tracking-widest text-sm disabled:opacity-50"
                                        >
                                            <Save className="w-5 h-5" />
                                            {updateUsuario.isPending || createUsuario.isPending ? 'Guardando...' : (isCreateMode ? 'Crear Usuario' : 'Guardar Cambios')}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>

                        {/* Confirmation Overlay for detail modal edit mode */}
                        {showConfirmCancel && (isEditingUsuario || isCreateMode || isDialogOpen) && (
                            <div className="absolute inset-0 z-[100] flex items-center justify-center p-6 bg-white/60 backdrop-blur-[2px] animate-in fade-in duration-200 rounded-[3rem]">
                                <Card className="w-full max-w-sm p-6 shadow-2xl border-red-100/50 bg-white animate-in zoom-in-95 duration-200">
                                    <div className="flex flex-col items-center text-center">
                                        <div className="w-12 h-12 bg-red-100/80 rounded-full flex items-center justify-center mb-4">
                                            <AlertCircle className="w-6 h-6 text-[#D8262F]" />
                                        </div>
                                        <h3 className="text-lg font-black text-gray-900 mb-2">¿Descartar cambios?</h3>
                                        <p className="text-sm font-medium text-gray-500 mb-6">
                                            Si cierras esta ventana sin guardar perderás la información ingresada.
                                        </p>
                                        <div className="flex bg-gray-50/50 p-1 rounded-xl w-full gap-1">
                                            <Button
                                                type="button"
                                                onClick={cancelClose}
                                                variant="ghost"
                                                className="flex-1 rounded-lg h-10 font-bold hover:bg-white hover:text-gray-900 text-gray-500 hover:shadow-sm"
                                            >
                                                Volver
                                            </Button>
                                            <Button
                                                type="button"
                                                onClick={confirmClose}
                                                className="flex-1 rounded-lg h-10 font-bold bg-[#D8262F] hover:bg-[#b91c24] border border-transparent shadow-[0_2px_10px_-4px_rgba(216,38,47,0.5)] text-white"
                                            >
                                                Descartar
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
