'use client';

import React, { useState } from 'react';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface TooltipInfoProps {
    text: string;
    formula?: string;
    className?: string;
}

export default function TooltipInfo({ text, formula, className = '' }: TooltipInfoProps) {
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    onMouseEnter={() => setOpen(true)}
                    onMouseLeave={() => setOpen(false)}
                    onClick={(e) => {
                        e.stopPropagation();
                        setOpen(!open);
                    }}
                    className={`inline-flex items-center justify-center p-0.5 rounded-full text-slate-400 hover:text-red-600 hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer align-middle ml-1 ${className}`}
                    aria-label="Información adicional"
                >
                    <Info className="w-3.5 h-3.5" />
                </button>
            </PopoverTrigger>
            <PopoverContent
                side="top"
                align="center"
                sideOffset={6}
                className="w-64 sm:w-72 p-3 bg-white text-slate-700 text-xs font-normal leading-relaxed rounded-xl shadow-xl border border-slate-200 pointer-events-none z-50 animate-in fade-in zoom-in-95 duration-150"
            >
                <p className="text-slate-800 font-medium">{text}</p>
                {formula && (
                    <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500 font-mono bg-slate-50 px-2 py-1 rounded-md border border-slate-200/60">
                        {formula}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
