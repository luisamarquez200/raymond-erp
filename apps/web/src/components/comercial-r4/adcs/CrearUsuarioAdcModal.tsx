'use client';

import { useState } from 'react';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle,
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import api from '@/lib/api';

import { Eye, EyeOff, Check, X } from 'lucide-react';

interface CrearUsuarioAdcModalProps {
    isOpen: boolean;
    onClose: () => void;
    adcName: string;
    onSuccess: () => void;
}

export function CrearUsuarioAdcModal({ isOpen, onClose, adcName, onSuccess }: CrearUsuarioAdcModalProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Validation rules
    const hasMinLength = password.length >= 6;
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const isPasswordValid = hasMinLength && hasUppercase && hasNumber;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!email || !password) {
            toast.error('Por favor, completa todos los campos.');
            return;
        }

        if (!isPasswordValid) {
            toast.error('La contraseña no cumple con los requisitos mínimos de seguridad.');
            return;
        }

        setLoading(true);
        try {
            const res = await api.post('/r4/adcs/crear-usuario', { name: adcName, email, password });
            const data = res.data;
            
            if (data.success) {
                toast.success('Usuario ADC creado exitosamente');
                setPassword('');
                setEmail('');
                onSuccess();
                onClose();
            } else {
                toast.error(data.message || 'Error al crear el usuario');
            }
        } catch (error) {
            toast.error('Error de red al crear el usuario');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Crear Usuario para {adcName}</DialogTitle>
                    <DialogDescription className="sr-only">
                        Completa los datos para crear un nuevo usuario ADC.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Correo Electrónico</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="correo@ejemplo.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Contraseña</Label>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="********"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={loading}
                                className="pr-10"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>

                        {/* Requisitos de la contraseña */}
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs space-y-1.5 mt-2">
                            <p className="font-bold text-slate-600 text-[11px] mb-1">Requisitos de la contraseña:</p>
                            <div className={`flex items-center gap-2 font-medium ${hasMinLength ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {hasMinLength ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 text-slate-300" />}
                                <span>Mínimo 6 caracteres</span>
                            </div>
                            <div className={`flex items-center gap-2 font-medium ${hasUppercase ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {hasUppercase ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 text-slate-300" />}
                                <span>Al menos una letra mayúscula (A-Z)</span>
                            </div>
                            <div className={`flex items-center gap-2 font-medium ${hasNumber ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {hasNumber ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 text-slate-300" />}
                                <span>Al menos un número (0-9)</span>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading || !isPasswordValid}>
                            {loading ? 'Creando...' : 'Crear Usuario'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
