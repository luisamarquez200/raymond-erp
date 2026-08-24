'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Eye, EyeOff, ChevronLeft, ChevronRight, User, Lock } from 'lucide-react';

const loginSchema = z.object({
    email: z.string().min(1, 'Usuario requerido'),
    password: z.string().min(1, 'Contraseña requerida'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const CAROUSEL_IMAGES = [
    '/comercial/page1.jpeg',
    '/comercial/page2.jpeg',
    '/comercial/page3.jpeg',
    '/comercial/page4.jpeg',
];

export default function LoginPage() {
    const signIn = useAuthStore((state) => state.signIn);
    const router = useRouter();
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Auto-advance carousel every 5 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentImageIndex((prev) => (prev + 1) % CAROUSEL_IMAGES.length);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const nextImage = () => {
        setCurrentImageIndex((prev) => (prev + 1) % CAROUSEL_IMAGES.length);
    };

    const prevImage = () => {
        setCurrentImageIndex((prev) => (prev - 1 + CAROUSEL_IMAGES.length) % CAROUSEL_IMAGES.length);
    };

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
                        isSuperadmin: false,
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
        <div className="min-h-screen w-full flex flex-col lg:flex-row font-sans overflow-hidden bg-slate-900">
            {/* Inline style for clean autofill */}
            <style jsx global>{`
                input:-webkit-autofill,
                input:-webkit-autofill:hover, 
                input:-webkit-autofill:focus, 
                input:-webkit-autofill:active {
                    -webkit-box-shadow: 0 0 0 1000px #ffffff inset !important;
                    -webkit-text-fill-color: #0f172a !important;
                    transition: background-color 5000s ease-in-out 0s;
                }
            `}</style>

            {/* Left Side - Login Form */}
            <div className="relative w-full lg:w-1/2 flex flex-col justify-between bg-gradient-to-br from-slate-50 via-[#f8fafc] to-slate-100 min-h-screen">
                {/* Subtle ambient decorative light */}
                <div className="absolute top-0 left-0 w-96 h-96 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-20 right-0 w-80 h-80 bg-slate-400/10 rounded-full blur-2xl pointer-events-none" />

                {/* Logo Top Left */}
                <div className="pt-8 pl-8 sm:pl-10 z-20">
                    <Image
                        src="/fsimage.png"
                        alt="RAYMOND"
                        width={180}
                        height={50}
                        className="object-contain object-left drop-shadow-xs"
                        priority
                    />
                </div>

                {/* Login Card */}
                <div className="flex-1 flex items-center justify-center p-6 sm:p-8 z-10">
                    <div className="w-full max-w-[420px] bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)] p-8 sm:p-10 border border-slate-200/80 relative overflow-hidden">
                        {/* Top subtle brand line */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-red-500 to-rose-500" />

                        <div className="text-center mb-8">
                            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">
                                Iniciar sesión
                            </h2>
                            <p className="text-slate-500 text-xs sm:text-sm font-medium">
                                Ingresa tus credenciales para acceder al sistema
                            </p>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                            {/* Input: Username */}
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                                    Usuario o Correo
                                </label>
                                <div className="relative flex items-center">
                                    <div className="absolute left-4 text-slate-400 pointer-events-none">
                                        <User className="w-4 h-4" />
                                    </div>
                                    <input
                                        {...register('email')}
                                        type="text"
                                        autoComplete="username"
                                        className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-red-600 focus:ring-4 focus:ring-red-500/10 outline-none transition-all text-sm font-semibold shadow-xs"
                                        placeholder="ej. gerente.comercial@raymond.run"
                                    />
                                </div>
                                {errors.email && (
                                    <p className="text-red-600 text-xs font-semibold mt-1">
                                        {errors.email.message}
                                    </p>
                                )}
                            </div>

                            {/* Input: Password */}
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                                    Contraseña
                                </label>
                                <div className="relative flex items-center">
                                    <div className="absolute left-4 text-slate-400 pointer-events-none">
                                        <Lock className="w-4 h-4" />
                                    </div>
                                    <input
                                        {...register('password')}
                                        type={showPassword ? 'text' : 'password'}
                                        autoComplete="current-password"
                                        className="w-full pl-11 pr-12 py-3.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-red-600 focus:ring-4 focus:ring-red-500/10 outline-none transition-all text-sm font-semibold shadow-xs"
                                        placeholder="••••••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(p => !p)}
                                        className="absolute right-3.5 text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
                                        tabIndex={-1}
                                        title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {errors.password && (
                                    <p className="text-red-600 text-xs font-semibold mt-1">
                                        {errors.password.message}
                                    </p>
                                )}
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-[#D92D20] hover:bg-[#B91C1C] text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 text-xs uppercase tracking-wider shadow-lg shadow-red-600/25 active:scale-[0.98] mt-3 cursor-pointer"
                            >
                                {isSubmitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Footer Bar */}
                <div className="bg-white/90 backdrop-blur-md border-t border-slate-200/80 text-slate-900 h-20 flex flex-col sm:flex-row items-center justify-between px-6 sm:px-10 py-2 z-20 shadow-xs">
                    <div className="flex items-center">
                        <Image 
                            src="/fsimage.png" 
                            alt="RAYMOND" 
                            width={130} 
                            height={36} 
                            className="object-contain"
                        />
                    </div>
                    <div className="text-[10px] sm:text-xs font-bold tracking-wide text-center sm:text-right flex flex-col gap-0.5">
                        <span className="uppercase text-slate-800 tracking-tight">Plataforma Comercial Corporación Raymond de México</span>
                        <span className="text-slate-400 text-[8.5px] uppercase tracking-widest font-semibold">RUN SOLUTIONS | TÉRMINOS DE USO</span>
                    </div>
                </div>
            </div>

            {/* Right Side - Carousel */}
            <div className="hidden lg:block lg:w-1/2 relative bg-slate-950 overflow-hidden group">
                {/* Images with crossfade transition */}
                {CAROUSEL_IMAGES.map((src, index) => (
                    <div
                        key={src}
                        className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                            index === currentImageIndex ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                        }`}
                    >
                        <img
                            src={src}
                            alt={`Slide ${index + 1}`}
                            className="w-full h-full object-cover object-center transform scale-100 transition-transform duration-7000 ease-out"
                        />
                    </div>
                ))}

                {/* Dark overlay for contrast */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/30 z-20 pointer-events-none" />

                {/* Navigation Arrows */}
                <button
                    type="button"
                    onClick={prevImage}
                    aria-label="Imagen anterior"
                    className="absolute left-6 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-black/40 hover:bg-black/70 text-white/90 hover:text-white backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 shadow-xl cursor-pointer"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                    type="button"
                    onClick={nextImage}
                    aria-label="Siguiente imagen"
                    className="absolute right-6 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-black/40 hover:bg-black/70 text-white/90 hover:text-white backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 shadow-xl cursor-pointer"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>

                {/* Carousel Indicators / Dots */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 px-4 py-2 rounded-full bg-black/35 backdrop-blur-md">
                    {CAROUSEL_IMAGES.map((_, index) => (
                        <button
                            key={index}
                            type="button"
                            onClick={() => setCurrentImageIndex(index)}
                            aria-label={`Ir a la imagen ${index + 1}`}
                            className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                                index === currentImageIndex
                                    ? 'w-8 bg-white shadow-md'
                                    : 'w-2 bg-white/40 hover:bg-white/70'
                            }`}
                        />
                    ))}
                </div>
            </div>
            
            {/* Error Toast/Message */}
            {error && (
                <div className="absolute top-4 right-4 z-50 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg animate-in fade-in slide-in-from-top-2">
                    {error}
                </div>
            )}
        </div>
    );
}
