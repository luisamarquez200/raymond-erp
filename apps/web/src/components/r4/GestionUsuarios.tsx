'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
    useUsers, 
    useCreateUser, 
    useUpdateUser, 
    useDeleteUser,
    User
} from '@/hooks/useUsers';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useConfigStore } from '@/store/config.store';
import { 
    Search, 
    UserPlus, 
    Edit2, 
    Trash2, 
    Mail, 
    Loader2,
    Eye,
    EyeOff
} from 'lucide-react';
import { Card } from '@/components/ui/card';
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function GestionUsuarios() {
    const { user: currentUser } = useAuthStore();
    const { roleColors } = useConfigStore();
    const currentColor = currentUser?.role ? (roleColors[currentUser.role.toLowerCase()] || roleColors.administrador) : roleColors.administrador;

    const { data: users = [], isLoading, refetch } = useUsers();
    const createUserMutation = useCreateUser();
    const updateUserMutation = useUpdateUser();
    const deleteUserMutation = useDeleteUser();

    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    // Form states
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [roleId, setRoleId] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [adcAsociadoName, setAdcAsociadoName] = useState('');

    // Fetch Roles
    const { data: allRoles = [] } = useQuery({
        queryKey: ['r4-roles'],
        queryFn: async () => {
            const response = await api.get('/roles');
            const body = response.data;
            if (Array.isArray(body)) return body;
            if (body?.data && Array.isArray(body.data)) return body.data;
            return [];
        },
    });

    // Fetch ADCs
    const { data: adcsList = [] } = useQuery({
        queryKey: ['r4-adcs-list'],
        queryFn: async () => {
            const response = await api.get('/r4/adcs');
            return response.data?.data || [];
        }
    });

    const ALLOWED_ROLES = ['Administrador', 'ADC', 'Gerente'];
    const roles = allRoles.filter((role: any) => 
        ALLOWED_ROLES.some(allowed => 
            role.name.toLowerCase() === allowed.toLowerCase()
        )
    );

    const handleOpenCreate = () => {
        setFirstName('');
        setLastName('');
        setEmail('');
        setPassword('');
        setRoleId(roles[0]?.id || '');
        setIsActive(true);
        setShowPassword(false);
        setAdcAsociadoName('ninguno');
        setIsCreateOpen(true);
    };

    const handleOpenEdit = (user: User) => {
        setSelectedUser(user);
        setFirstName(user.firstName);
        setLastName(user.lastName);
        setEmail(user.email);
        setPassword(''); // Empty password means no change
        setRoleId(user.role?.id || '');
        setIsActive(user.isActive);
        setShowPassword(false);
        setAdcAsociadoName(user.adcAsociadoName || 'ninguno');
        setIsEditOpen(true);
    };

    const handleOpenDelete = (user: User) => {
        setSelectedUser(user);
        setIsDeleteOpen(true);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firstName || !lastName || !email || !password || !roleId) {
            toast.error('Todos los campos marcados con * son obligatorios');
            return;
        }

        try {
            await createUserMutation.mutateAsync({
                firstName,
                lastName,
                email,
                password,
                roleId,
                ...(adcAsociadoName !== 'ninguno' && { adcAsociadoName })
            });
            setIsCreateOpen(false);
            refetch();
        } catch (error) {}
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;
        if (!firstName || !lastName || !email || !roleId) {
            toast.error('Todos los campos marcados con * son obligatorios');
            return;
        }

        try {
            await updateUserMutation.mutateAsync({
                id: selectedUser.id,
                data: {
                    firstName,
                    lastName,
                    email,
                    roleId,
                    isActive,
                    ...(password && { password }),
                    adcAsociadoName: adcAsociadoName === 'ninguno' ? '' : adcAsociadoName
                }
            });
            setIsEditOpen(false);
            refetch();
        } catch (error) {}
    };

    const handleDelete = async () => {
        if (!selectedUser) return;
        try {
            await deleteUserMutation.mutateAsync(selectedUser.id);
            setIsDeleteOpen(false);
            refetch();
        } catch (error) {}
    };

    const R4_ROLES = ['administrador', 'adc', 'gerente'];
    const filteredUsers = users.filter(u => {
        const uRole = (u.role?.name || '').toLowerCase();
        if (!R4_ROLES.includes(uRole)) return false;

        return `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
               u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
               uRole.includes(searchTerm.toLowerCase());
    });

    return (
        <div className="space-y-6">
            {/* Header / Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        type="text"
                        placeholder="Buscar por nombre, email o rol..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 rounded-2xl border-slate-200 focus-visible:ring-offset-0 focus-visible:ring-1 bg-[#F9FAFB]/50 focus:bg-white transition-all text-sm h-11"
                    />
                </div>
                <button
                    onClick={handleOpenCreate}
                    className="w-full sm:w-auto px-5 py-2.5 text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md hover:opacity-90"
                    style={{ 
                        backgroundColor: currentColor, 
                        boxShadow: `0 4px 14px 0 ${currentColor}40` 
                    }}
                >
                    <UserPlus className="w-4 h-4" />
                    Crear Usuario
                </button>
            </div>

            {/* Users Table */}
            <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="p-12 flex flex-col items-center justify-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin" style={{ color: currentColor }} />
                        <span className="text-slate-500 font-bold text-sm">Cargando usuarios...</span>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="p-12 text-center">
                        <p className="text-slate-500 font-bold">No se encontraron usuarios.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-slate-100">
                                    <th className="p-4 pl-6">Usuario</th>
                                    <th className="p-4">Email</th>
                                    <th className="p-4">Rol</th>
                                    <th className="p-4">Estatus</th>
                                    <th className="p-4 pr-6 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
                                {filteredUsers.map((u) => {
                                    const uRoleName = u.role?.name || 'Sin Rol';
                                    const uColor = roleColors[uRoleName.toLowerCase()] || '#64748B';
                                    
                                    return (
                                        <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4 pl-6">
                                                <div className="flex items-center gap-3">
                                                    <div 
                                                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border"
                                                        style={{ 
                                                            backgroundColor: `${uColor}15`, 
                                                            color: uColor,
                                                            borderColor: `${uColor}30`
                                                        }}
                                                    >
                                                        {(u.firstName?.[0] || '').toUpperCase()}{(u.lastName?.[0] || '').toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-slate-900 block">{u.firstName} {u.lastName}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-slate-500">
                                                <div className="flex items-center gap-2">
                                                    <Mail className="w-4 h-4 text-slate-400" />
                                                    {u.email}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col items-start gap-1">
                                                    <span 
                                                        className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-bold border"
                                                        style={{ 
                                                            backgroundColor: `${uColor}15`, 
                                                            color: uColor,
                                                            borderColor: `${uColor}30`
                                                        }}
                                                    >
                                                        {uRoleName.toUpperCase()}
                                                    </span>
                                                    {u.adcAsociadoName && (
                                                        <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 mt-0.5 animate-in fade-in duration-200">
                                                            Asociado: {u.adcAsociadoName}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {u.isActive ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                        Activo
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                                        Inactivo
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 pr-6 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleOpenEdit(u)}
                                                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                                                        title="Editar"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    {currentUser?.id !== u.id && (
                                                        <button
                                                            onClick={() => handleOpenDelete(u)}
                                                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* CREATE MODAL */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="max-w-md rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-slate-900">Crear Nuevo Usuario</DialogTitle>
                        <DialogDescription className="text-slate-500 font-medium mt-1">
                            Ingresa los datos para registrar una nueva cuenta.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreate} className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="c-firstName">Nombre *</Label>
                                <Input id="c-firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required placeholder="Juan" className="rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="c-lastName">Apellido *</Label>
                                <Input id="c-lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required placeholder="Pérez" className="rounded-xl" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="c-email">Email *</Label>
                            <Input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="correo@raymond.com" className="rounded-xl" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="c-password">Contraseña *</Label>
                            <div className="relative">
                                <Input 
                                    id="c-password" 
                                    type={showPassword ? 'text' : 'password'} 
                                    value={password} 
                                    onChange={(e) => setPassword(e.target.value)} 
                                    required 
                                    placeholder="********" 
                                    className="rounded-xl pr-10" 
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="c-role">Rol *</Label>
                            <Select value={roleId} onValueChange={setRoleId}>
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue placeholder="Selecciona un rol" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    {roles.map((r: any) => (
                                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="c-adcAsociado">Asociar a un ADC (Opcional)</Label>
                            <Select value={adcAsociadoName} onValueChange={setAdcAsociadoName}>
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue placeholder="Ninguno" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="ninguno">Ninguno</SelectItem>
                                    {adcsList.map((adc: any, idx: number) => (
                                        <SelectItem key={idx} value={adc.name}>{adc.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <DialogFooter className="pt-4 flex sm:justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-xl font-bold">Cancelar</Button>
                            <Button 
                                type="submit" 
                                className="rounded-xl font-bold text-white hover:opacity-90 transition-all"
                                style={{ backgroundColor: currentColor }}
                                disabled={createUserMutation.isPending}
                            >
                                {createUserMutation.isPending ? 'Creando...' : 'Crear'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* EDIT MODAL */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="max-w-md rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-slate-900">Editar Usuario</DialogTitle>
                        <DialogDescription className="text-slate-500 font-medium mt-1">
                            Modifica los datos del usuario. Deja la contraseña en blanco si no quieres cambiarla.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEdit} className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="e-firstName">Nombre *</Label>
                                <Input id="e-firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="e-lastName">Apellido *</Label>
                                <Input id="e-lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="rounded-xl" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="e-email">Email *</Label>
                            <Input id="e-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="e-password">Contraseña (Nueva)</Label>
                            <div className="relative">
                                <Input 
                                    id="e-password" 
                                    type={showPassword ? 'text' : 'password'} 
                                    value={password} 
                                    onChange={(e) => setPassword(e.target.value)} 
                                    placeholder="Dejar en blanco para no cambiar" 
                                    className="rounded-xl pr-10" 
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="e-role">Rol *</Label>
                            <Select value={roleId} onValueChange={setRoleId}>
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue placeholder="Selecciona un rol" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    {roles.map((r: any) => (
                                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="e-adcAsociado">Asociar a un ADC (Opcional)</Label>
                            <Select value={adcAsociadoName} onValueChange={setAdcAsociadoName}>
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue placeholder="Ninguno" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="ninguno">Ninguno</SelectItem>
                                    {adcsList.map((adc: any, idx: number) => (
                                        <SelectItem key={idx} value={adc.name}>{adc.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                            <span className="text-sm font-bold text-slate-700">Estado Activo</span>
                            <button
                                type="button"
                                onClick={() => setIsActive(!isActive)}
                                className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 focus:outline-none ${
                                    isActive ? 'bg-emerald-500' : 'bg-slate-300'
                                }`}
                            >
                                <div
                                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                                        isActive ? 'translate-x-6' : 'translate-x-0'
                                    }`}
                                />
                            </button>
                        </div>
                        <DialogFooter className="pt-4 flex sm:justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} className="rounded-xl font-bold">Cancelar</Button>
                            <Button 
                                type="submit" 
                                className="rounded-xl font-bold text-white hover:opacity-90 transition-all"
                                style={{ backgroundColor: currentColor }}
                                disabled={updateUserMutation.isPending}
                            >
                                {updateUserMutation.isPending ? 'Guardando...' : 'Guardar'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* DELETE MODAL */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent className="max-w-md rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-red-600 flex items-center gap-2">
                            <Trash2 className="w-5 h-5 animate-bounce" />
                            ¿Eliminar Usuario?
                        </DialogTitle>
                        <DialogDescription className="text-slate-500 font-medium mt-2">
                            ¿Estás seguro de que deseas eliminar la cuenta de <span className="font-bold text-slate-900">{selectedUser?.firstName} {selectedUser?.lastName}</span> ({selectedUser?.email})? Esta acción no se puede deshacer.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="pt-6 flex sm:justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)} className="rounded-xl font-bold">Cancelar</Button>
                        <Button 
                            type="button" 
                            variant="destructive"
                            onClick={handleDelete}
                            className="rounded-xl font-bold hover:opacity-90 transition-all"
                            disabled={deleteUserMutation.isPending}
                        >
                            {deleteUserMutation.isPending ? 'Eliminando...' : 'Eliminar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
