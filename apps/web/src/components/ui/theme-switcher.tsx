'use client';

import { useState, useEffect } from 'react';
import { Palette, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const COLORS = [
  { name: 'Rojo', value: '0 84.2% 60.2%', hex: '#ef4444' },
  { name: 'Azul', value: '221 83% 53%', hex: '#3b82f6' },
  { name: 'Negro', value: '0 0% 9%', hex: '#171717' },
  { name: 'Verde', value: '142 71% 45%', hex: '#22c55e' },
  { name: 'Naranja', value: '24 98% 50%', hex: '#f97316' },
  { name: 'Morado', value: '262 83% 58%', hex: '#8b5cf6' },
];

export function ThemeSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeColor, setActiveColor] = useState(COLORS[0].value);

  useEffect(() => {
    // Restaurar color si ya se seleccionó uno en la sesión
    const saved = localStorage.getItem('theme-primary-color');
    if (saved) {
      setActiveColor(saved);
    }
  }, []);

  const changeColor = (color: string) => {
    setActiveColor(color);
    localStorage.setItem('theme-primary-color', color);
  };

  return (
    <>
      <style>{`
        :root, .force-light-mode {
          --primary: ${activeColor} !important;
          --ring: ${activeColor} !important;
        }

        /* Fuerza bruta para anular todas las clases rojas quemadas en el código */
        .bg-red-500, .bg-red-600, .bg-\\[\\#E5222D\\] {
          background-color: hsl(${activeColor}) !important;
        }
        .hover\\:bg-red-600:hover, .hover\\:bg-red-700:hover, .hover\\:bg-\\[\\#CC1E28\\]:hover {
          background-color: hsl(${activeColor} / 0.8) !important;
        }
        .text-red-500, .text-red-600, .text-red-700, .text-\\[\\#E5222D\\] {
          color: hsl(${activeColor}) !important;
        }
        .border-red-500, .border-red-600, .border-\\[\\#E5222D\\] {
          border-color: hsl(${activeColor}) !important;
        }
        .border-l-\\[\\#E5222D\\] {
          border-left-color: hsl(${activeColor}) !important;
        }
        .bg-red-50 {
          background-color: hsl(${activeColor} / 0.1) !important;
        }
        .border-red-100, .border-red-200 {
          border-color: hsl(${activeColor} / 0.2) !important;
        }
        
        /* Específico para el color del logo en ciertas páginas (amber-600) */
        .text-amber-600 {
          color: hsl(${activeColor}) !important;
        }
      `}</style>
      <div className="fixed bottom-16 right-4 z-[100] flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-xl p-4 w-64 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-sm">Tema Visual (Demo)</h3>
            <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {COLORS.map((c) => (
              <button
                key={c.name}
                onClick={() => changeColor(c.value)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors",
                  activeColor === c.value && "bg-gray-100 dark:bg-gray-800 font-medium"
                )}
              >
                <div 
                  className="w-5 h-5 rounded-full shadow-sm border border-black/10 dark:border-white/10" 
                  style={{ backgroundColor: c.hex }}
                />
                <span className="text-sm">{c.name}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 text-center leading-tight">
            Selector temporal para visualizar cómo se ve la interfaz con los colores de distintos roles.
          </div>
        </div>
      )}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-black dark:bg-white text-white dark:text-black p-3 rounded-full shadow-xl hover:scale-105 transition-transform flex items-center justify-center"
        title="Cambiar Color de Tema"
      >
        <Palette className="w-5 h-5" />
      </button>
    </div>
    </>
  );
}
