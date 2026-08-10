'use client';

import React, { useState } from 'react';
import { Info } from 'lucide-react';

interface TooltipInfoProps {
    text: string;
    className?: string;
}

export default function TooltipInfo({ text, className = '' }: TooltipInfoProps) {
    const [show, setShow] = useState(false);

    return (
        <div className={`relative inline-flex items-center ml-1.5 group ${className}`}>
            <Info 
                className="w-3.5 h-3.5 text-slate-400 hover:text-amber-600 cursor-pointer transition-colors"
                onMouseEnter={() => setShow(true)}
                onMouseLeave={() => setShow(false)}
                onClick={() => setShow(!show)}
            />
            {show && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-2.5 bg-slate-900 text-white text-[11px] font-medium leading-relaxed rounded-xl shadow-xl z-50 pointer-events-none transition-all border border-slate-700">
                    {text}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                </div>
            )}
        </div>
    );
}
