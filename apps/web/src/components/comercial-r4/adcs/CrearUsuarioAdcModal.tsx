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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!email || !password) {
            toast.error('Por favor, completa todos los campos.');
            return;
        }

        setLoading(true);
        try {
            const res = await api.post('/r4/adcs/crear-usuario', { name: adcName, email, password });
            const data = res.data;
            
            if (data.success) {
                toast.success('Usuario ADC creado exitosamente');
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
                        <Input
                            id="password"
                            type="password"
                            placeholder="********"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={loading}
                            required
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Creando...' : 'Crear Usuario'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
