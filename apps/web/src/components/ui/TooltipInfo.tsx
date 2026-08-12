'use client';

import React, { useState } from 'react';
import { Info } from 'lucide-react';

interface TooltipInfoProps {
    text: string;
    formula?: string;
    className?: string;
}

export default function TooltipInfo({ text, formula, className = '' }: TooltipInfoProps) {
    const [show, setShow] = useState(false);

    return (
        <div className={`relative inline-flex items-center ml-1 group ${className}`}>
            <Info 
                className="w-3.5 h-3.5 text-slate-400 hover:text-red-600 cursor-pointer transition-colors"
                onMouseEnter={() => setShow(true)}
                onMouseLeave={() => setShow(false)}
                onClick={() => setShow(!show)}
            />
            {show && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-900/95 text-white text-[11px] font-medium leading-relaxed rounded-2xl shadow-2xl z-50 pointer-events-none transition-all border border-slate-700/80 backdrop-blur-md">
                    <p className="text-slate-200 font-semibold">{text}</p>
                    {formula && (
                        <div className="mt-2 pt-2 border-t border-slate-700/80 space-y-1">
                            <span className="text-[9px] font-black text-red-400 uppercase tracking-wider block">Fórmula de Cálculo:</span>
                            <div className="bg-slate-950 p-2 rounded-lg font-mono text-[10px] text-amber-300 border border-slate-800 break-words font-semibold">
                                {formula}
                            </div>
                        </div>
                    )}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                </div>
            )}
        </div>
    );
}
