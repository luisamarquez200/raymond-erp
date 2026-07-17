'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import Image from 'next/image';
import { Eye, EyeOff } from 'lucide-react';

const loginSchema = z.object({
    email: z.string().min(1, 'Usuario requerido'),
    password: z.string().min(1, 'Contraseña requerida'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
    const signIn = useAuthStore((state) => state.signIn);
    const router = useRouter();
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: '',
            password: '',
        },
    });

    const onSubmit = async (data: LoginFormData) => {
        try {
            // 1. Try Main Authentication (Standard ERP Users)
            await signIn(data);
            router.push('/site-selection');
        } catch (mainErr: any) {
            // 2. If Main Auth fails, try Taller R1 Authentication (Specific Module Users)
            try {
                const { authTallerService } = await import('@/services/taller-r1/auth-taller.service');
                const tallerData = await authTallerService.login({
                    username: data.email,
                    password: data.password
                });

                if (tallerData?.success && tallerData.data) {
                    const userData = tallerData.data;

                    // UNIFIED SESSION: Map Taller User to Global User interface
                    const unifiedUser = {
                        id: userData.id,
                        email: userData.email,
                        firstName: userData.username, // Display name
                        lastName: '',
                        role: userData.role,
                        organizationId: null, // Taller doesn't use organizationId yet
                        sitio: userData.sitio,
                    };

                    useAuthStore.getState().setTallerSession(
                        unifiedUser,
                        userData.token || tallerData.token || 'mock-taller-token',
                        userData.sitio || 'r1'
                    );

                    // Redirect to Site Selection page
                    router.push('/es/site-selection');
                    return;
                }
            } catch (tallerErr: any) {
                console.error("Taller login failed", tallerErr);
                const tallerErrorMessage = tallerErr.response?.data?.message;
                const mainErrorMessage = mainErr.response?.data?.message;
                setError(tallerErrorMessage || mainErrorMessage || 'Credenciales inválidas');
            }
        }
    };

    return (
        <div className="min-h-screen w-full flex flex-col lg:flex-row font-sans overflow-hidden bg-white">
            {/* Left Side - Login Form */}
            <div className="relative w-full lg:w-1/2 flex flex-col justify-between bg-[#E5E5E5] min-h-screen">
                {/* Logo Top Left */}
                <div className="pt-8 pl-8 z-20">
                    <Image
                        src="/fsimage.png"
                        alt="RAYMOND"
                        width={180}
                        height={50}
                        className="object-contain object-left"
                        priority
                    />
                </div>

                {/* Login Card */}
                <div className="flex-1 flex items-center justify-center p-6">
                    <div className="w-full max-w-[400px] bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] p-10 border border-gray-100/50">
                        <div className="text-center mb-10">
                            <h2 className="text-2xl font-semibold text-gray-800 mb-2 tracking-tight">
                                Iniciar sesión
                            </h2>
                            <p className="text-gray-500 text-sm font-medium">
                                Ingresa tus credenciales para continuar
                            </p>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                            {/* Input: Username */}
                            <div className="space-y-1.5">
                                <input
                                    {...register('email')}
                                    type="text"
                                    autoComplete="off"
                                    className="w-full px-4 py-3.5 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-[#D92D20] focus:ring-1 focus:ring-[#D92D20] outline-none transition-all text-sm font-medium"
                                    placeholder="Nombre de usuario"
                                />
                                {errors.email && (
                                    <p className="text-red-500 text-xs mt-1">
                                        {errors.email.message}
                                    </p>
                                )}
                            </div>

                            {/* Input: Password */}
                            <div className="space-y-1.5">
                                <div className="relative">
                                    <input
                                        {...register('password')}
                                        type={showPassword ? 'text' : 'password'}
                                        className="w-full px-4 py-3.5 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-[#D92D20] focus:ring-1 focus:ring-[#D92D20] outline-none transition-all text-sm font-medium pr-12"
                                        placeholder="Contraseña"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(p => !p)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
                                        tabIndex={-1}
                                        title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {errors.password && (
                                    <p className="text-red-500 text-xs mt-1">
                                        {errors.password.message}
                                    </p>
                                )}
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-[#D92D20] text-white font-semibold py-3.5 rounded-xl hover:bg-[#B91C1C] transition-all disabled:opacity-50 text-sm shadow-md mt-2"
                            >
                                {isSubmitting ? 'Iniciando...' : 'Iniciar sesión'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Footer Bar */}
                <div className="bg-white border-t border-gray-200 text-gray-900 h-20 flex flex-col sm:flex-row items-center justify-between px-6 sm:px-8 py-2 z-20 shadow-sm">
                    <div className="flex items-center">
                        <Image 
                            src="/fsimage.png" 
                            alt="RAYMOND" 
                            width={140} 
                            height={40} 
                            className="object-contain"
                        />
                    </div>
                    <div className="text-[10px] sm:text-xs font-bold tracking-wide text-center sm:text-right flex flex-col gap-1">
                        <span className="uppercase text-slate-800">Plataforma Comercial Corporación Raymond de México</span>
                        <span className="text-gray-500 text-[8px] uppercase tracking-widest font-normal">RUN SOLUTIONS | TÉRMINOS DE USO</span>
                    </div>
                </div>
            </div>

            {/* Right Side - Image */}
            <div className="hidden lg:block lg:w-1/2 relative bg-slate-900">
                <div className="absolute inset-0 bg-black/20 z-10" /> {/* Dark overlay for premium feel */}
                <img
                    src="https://images.unsplash.com/photo-1587293852726-70cdb56c2866?q=80&w=2070&auto=format&fit=crop"
                    alt="Logistics Background"
                    className="absolute inset-0 w-full h-full object-cover object-center"
                />
            </div>
            
            {/* Error Toast/Message */}
            {error && (
                <div className="absolute top-4 right-4 z-50 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm shadow-sm animate-in fade-in slide-in-from-top-2">
                    {error}
                </div>
            )}
        </div>
    );
}
