'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import Image from 'next/image';

const loginSchema = z.object({
    email: z.string().min(1, 'Usuario requerido'),
    password: z.string().min(1, 'Contraseña requerida'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
    const signIn = useAuthStore((state) => state.signIn);
    const router = useRouter();
    const [error, setError] = useState('');

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
        <div className="min-h-screen w-full relative bg-white flex flex-col items-center justify-center font-sans overflow-hidden">

            {/* Background Image - Centered and covering necessary area */}
            <div className="absolute inset-0 z-0 flex items-center justify-center">
                <div className="relative w-full h-full">
                    <Image
                        src="/login_background.png"
                        alt="Background"
                        fill
                        className="object-contain object-center"
                        priority
                    />
                </div>
            </div>

            {/* Logo Top Left */}
            <div className="absolute top-8 left-8 z-20 w-48 h-12">
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
            <div className="relative z-10 w-full max-w-[400px] bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-10 border border-gray-100/50">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        Iniciar sesión
                    </h2>
                    <p className="text-gray-500 text-sm">
                        Iniciar sesión o crea una cuenta
                    </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                    {/* Input: Username */}
                    <div className="space-y-1">
                        <input
                            {...register('email')}
                            type="text"
                            autoComplete="off"
                            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-none transition-all text-sm"
                            placeholder="Nombre de usuario"
                        />
                        {errors.email && (
                            <p className="text-red-500 text-xs mt-1">
                                {errors.email.message}
                            </p>
                        )}
                    </div>

                    {/* Input: Password */}
                    <div className="space-y-1">
                        <input
                            {...register('password')}
                            type="password"
                            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-none transition-all text-sm"
                            placeholder="Contraseña"
                        />
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
                        className="w-full bg-[#D92D20] text-white font-medium py-3 rounded-lg hover:bg-[#B91C1C] transition-colors disabled:opacity-50 text-sm shadow-sm mt-2"
                    >
                        {isSubmitting ? 'Iniciando...' : 'Inciar sesión'}
                    </button>
                </form>
            </div>

            {/* Footer */}
            <div className="absolute bottom-8 left-0 right-0 z-20 text-center">
                <p className="text-gray-500 text-sm">
                    Raymond &nbsp; 2026 &nbsp; | &nbsp; policy
                </p>
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
