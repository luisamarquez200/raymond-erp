import React from 'react';
import { Truck } from 'lucide-react';

interface PageLoaderProps {
    title?: string;
    subtitle?: string;
    heightClassName?: string;
    color?: string; // e.g. "#16a34a" for green gerente, "#E1000F" for red default
}

export default function PageLoader({ 
    title = "Procesando datos", 
    subtitle = "Calculando métricas ejecutivas...",
    heightClassName = "min-h-[450px]",
    color = "#E1000F"
}: PageLoaderProps) {
    // Derive a light background from the color for the inner ring
    const bgLight = `${color}18`; // ~10% opacity hex

    return (
        <div className={`w-full flex flex-col items-center justify-center p-4 ${heightClassName}`}>
            <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col items-center gap-5 max-w-sm w-full text-center animate-in fade-in zoom-in duration-300">
                <div className="relative w-20 h-20">
                    <div className="absolute inset-0 rounded-full border-4" style={{ borderColor: bgLight }}></div>
                    <div
                        className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin"
                        style={{ borderColor: color, borderTopColor: 'transparent' }}
                    ></div>
                    <Truck className="absolute inset-0 m-auto w-8 h-8 animate-pulse" style={{ color }} />
                </div>
                <div className="space-y-1">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">{title}</h3>
                    <p className="text-xs font-semibold text-slate-500">{subtitle}</p>
                </div>
            </div>
        </div>
    );
}
