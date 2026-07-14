'use client';

import { useState } from 'react';
import { Settings, ShieldCheck, Palette, Users } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useConfigStore } from '@/store/config.store';
import AdcsPage from '../adcs/page'; // Reuse the existing page for the tab

export default function ConfiguracionPage() {
    const { user } = useAuthStore();
    const isAdmin = user?.role?.toUpperCase() === 'ADMINISTRADOR' || user?.role?.toUpperCase() === 'SUPERADMIN';
    const [activeTab, setActiveTab] = useState<'adcs' | 'roles'>('adcs');

    const { roleColors, setRoleColor, resetRoleColors } = useConfigStore();

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-[#F9FAFB] p-8 flex items-center justify-center">
                <div className="text-center bg-white p-12 rounded-3xl shadow-sm border border-slate-100 max-w-md">
                    <ShieldCheck className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-black text-slate-900 mb-2">Acceso Restringido</h2>
                    <p className="text-slate-500 font-medium">Solo los administradores pueden acceder a Configuración.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F9FAFB] p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm relative overflow-hidden">
                <div 
                    className="absolute top-0 left-0 w-1 h-full"
                    style={{ backgroundColor: user?.role ? (roleColors[user.role.toLowerCase()] || roleColors.administrador) : roleColors.administrador }}
                ></div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                        <div 
                            className="p-3 rounded-2xl"
                            style={{ 
                                backgroundColor: `${user?.role ? (roleColors[user.role.toLowerCase()] || roleColors.administrador) : roleColors.administrador}15`,
                                color: user?.role ? (roleColors[user.role.toLowerCase()] || roleColors.administrador) : roleColors.administrador
                            }}
                        >
                            <Settings className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Configuración</h1>
                            <p className="text-slate-500 font-medium mt-1">
                                Administración del sistema y catálogos
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-8 border-b border-slate-200">
                    <nav className="flex space-x-8">
                        <button
                            onClick={() => setActiveTab('adcs')}
                            className={`py-4 px-1 border-b-2 font-bold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${
                                activeTab === 'adcs'
                                    ? ''
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                            style={activeTab === 'adcs' ? { 
                                borderColor: user?.role ? (roleColors[user.role.toLowerCase()] || roleColors.administrador) : roleColors.administrador,
                                color: user?.role ? (roleColors[user.role.toLowerCase()] || roleColors.administrador) : roleColors.administrador 
                            } : {}}
                        >
                            <Users className="w-4 h-4" />
                            Gestión de ADC
                        </button>
                        <button
                            onClick={() => setActiveTab('roles')}
                            className={`py-4 px-1 border-b-2 font-bold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${
                                activeTab === 'roles'
                                    ? ''
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                            style={activeTab === 'roles' ? { 
                                borderColor: user?.role ? (roleColors[user.role.toLowerCase()] || roleColors.administrador) : roleColors.administrador,
                                color: user?.role ? (roleColors[user.role.toLowerCase()] || roleColors.administrador) : roleColors.administrador 
                            } : {}}
                        >
                            <Palette className="w-4 h-4" />
                            Usuarios y Roles
                        </button>
                    </nav>
                </div>
            </div>

            {activeTab === 'adcs' ? (
                <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-6">
                    <AdcsPage />
                </div>
            ) : (
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm animate-in fade-in duration-300">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold text-slate-900">Catálogo de Roles y Colores</h2>
                        <button
                            onClick={resetRoleColors}
                            className="px-4 py-2 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:opacity-80"
                            style={{ backgroundColor: user?.role ? (roleColors[user.role.toLowerCase()] || roleColors.administrador) : roleColors.administrador, boxShadow: `0 4px 14px 0 ${user?.role ? (roleColors[user.role.toLowerCase()] || roleColors.administrador) : roleColors.administrador}40` }}
                        >
                            Restaurar por Defecto
                        </button>
                    </div>
                    
                    <div className="overflow-x-auto rounded-2xl border border-slate-100">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-slate-100">
                                    <th className="p-4">Rol</th>
                                    <th className="p-4">Color</th>
                                    <th className="p-4">Muestra</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
                                {Object.entries(roleColors).map(([role, color]) => (
                                    <tr key={role} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="p-4 capitalize">
                                            <span className="font-bold text-slate-900">{role}</span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <input 
                                                    type="color" 
                                                    value={color}
                                                    onChange={(e) => setRoleColor(role, e.target.value)}
                                                    className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                                                />
                                                <span className="text-slate-500 font-mono text-xs">{color}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span 
                                                className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-bold border"
                                                style={{ 
                                                    backgroundColor: `${color}15`, 
                                                    color: color,
                                                    borderColor: `${color}30`
                                                }}
                                            >
                                                {role.toUpperCase()}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
