'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    Search,
    LayoutDashboard,
    Truck,
    CircleDollarSign,
    FileSpreadsheet,
    Settings,
    Plus,
    Building2,
    HardDrive,
    Wrench,
    ArrowRight,
    Sparkles,
    Command as CommandIcon,
} from 'lucide-react';
import {
    CommandDialog,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandSeparator,
    CommandShortcut,
} from '@/components/ui/command';
import api from '@/lib/api';

export function GlobalCommandPalette() {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [clientes, setClientes] = useState<any[]>([]);
    const [activos, setActivos] = useState<any[]>([]);
    const router = useRouter();

    // Keyboard listener for Cmd+K / Ctrl+K
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    // Fetch quick lookup data on open
    useEffect(() => {
        if (!open) return;

        const loadQuickData = async () => {
            try {
                const [resClientes, resFlotilla] = await Promise.allSettled([
                    api.get('/r4/clientes'),
                    api.get('/r4/flotilla'),
                ]);

                if (resClientes.status === 'fulfilled') {
                    const data = resClientes.value.data?.data || resClientes.value.data || [];
                    if (Array.isArray(data)) setClientes(data.slice(0, 30));
                }

                if (resFlotilla.status === 'fulfilled') {
                    const data = resFlotilla.value.data?.data || resFlotilla.value.data || [];
                    if (Array.isArray(data)) setActivos(data.slice(0, 50));
                }
            } catch (err) {
                // silently handle background search fetch
            }
        };

        loadQuickData();
    }, [open]);

    const runCommand = useCallback((command: () => void) => {
        setOpen(false);
        command();
    }, []);

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <div className="flex items-center border-b border-slate-100 px-3 bg-slate-50/50">
                <Search className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
                <CommandInput
                    placeholder="Escribe un comando, cliente o serie de montacargas..."
                    value={search}
                    onValueChange={setSearch}
                    className="border-none focus:ring-0 text-sm font-medium bg-transparent"
                />
            </div>
            <CommandList className="max-h-[380px] p-2">
                <CommandEmpty className="py-6 text-center text-sm font-medium text-slate-400">
                    No se encontraron resultados para &ldquo;{search}&rdquo;.
                </CommandEmpty>

                {/* Quick Navigation */}
                <CommandGroup heading="Módulos y Navegación">
                    <CommandItem
                        onSelect={() => runCommand(() => router.push('/es/r4/dashboard'))}
                        className="cursor-pointer rounded-xl flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors"
                    >
                        <div className="p-1.5 rounded-lg bg-red-50 text-red-600">
                            <LayoutDashboard className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-slate-800 text-sm">Dashboard General</span>
                        <CommandShortcut className="text-slate-400 text-xs">R4</CommandShortcut>
                    </CommandItem>

                    <CommandItem
                        onSelect={() => runCommand(() => router.push('/es/r4/flotilla'))}
                        className="cursor-pointer rounded-xl flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors"
                    >
                        <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                            <Truck className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-slate-800 text-sm">Flotilla y Rentas</span>
                        <CommandShortcut className="text-slate-400 text-xs">Equipos</CommandShortcut>
                    </CommandItem>

                    <CommandItem
                        onSelect={() => runCommand(() => router.push('/es/r4/clientes-sitios'))}
                        className="cursor-pointer rounded-xl flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors"
                    >
                        <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                            <Building2 className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-slate-800 text-sm">Catálogo de Clientes y Sitios</span>
                        <CommandShortcut className="text-slate-400 text-xs">Directorio</CommandShortcut>
                    </CommandItem>

                    <CommandItem
                        onSelect={() => runCommand(() => router.push('/es/r4/presupuestos'))}
                        className="cursor-pointer rounded-xl flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors"
                    >
                        <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                            <CircleDollarSign className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-slate-800 text-sm">Presupuestos y Facturación</span>
                        <CommandShortcut className="text-slate-400 text-xs">Finanzas</CommandShortcut>
                    </CommandItem>

                    <CommandItem
                        onSelect={() => runCommand(() => router.push('/es/r4/configuracion'))}
                        className="cursor-pointer rounded-xl flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors"
                    >
                        <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
                            <Settings className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-slate-800 text-sm">Configuración del Sistema</span>
                    </CommandItem>
                </CommandGroup>

                <CommandSeparator className="my-2" />

                {/* Quick Actions */}
                <CommandGroup heading="Acciones Rápidas">
                    <CommandItem
                        onSelect={() => runCommand(() => router.push('/es/r4/clientes-sitios?action=new'))}
                        className="cursor-pointer rounded-xl flex items-center gap-3 px-3 py-2 hover:bg-slate-50"
                    >
                        <Plus className="h-4 w-4 text-slate-500" />
                        <span className="text-sm font-medium text-slate-700">Dar de alta nuevo Cliente</span>
                    </CommandItem>
                    <CommandItem
                        onSelect={() => runCommand(() => router.push('/es/r4/flotilla?action=upload'))}
                        className="cursor-pointer rounded-xl flex items-center gap-3 px-3 py-2 hover:bg-slate-50"
                    >
                        <FileSpreadsheet className="h-4 w-4 text-slate-500" />
                        <span className="text-sm font-medium text-slate-700">Importar archivo Excel de Flotilla</span>
                    </CommandItem>
                </CommandGroup>

                {/* Clientes direct lookup */}
                {clientes.length > 0 && (
                    <>
                        <CommandSeparator className="my-2" />
                        <CommandGroup heading="Clientes Recientes / Encontrados">
                            {clientes
                                .filter(c => !search || c.razonSocial?.toLowerCase().includes(search.toLowerCase()) || c.rfc?.toLowerCase().includes(search.toLowerCase()))
                                .slice(0, 5)
                                .map((c) => (
                                    <CommandItem
                                        key={c.id}
                                        onSelect={() => runCommand(() => router.push(`/es/r4/clientes-sitios?id=${c.id}`))}
                                        className="cursor-pointer rounded-xl flex items-center justify-between px-3 py-2 hover:bg-slate-50"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                                            <span className="font-bold text-slate-800 text-xs">{c.razonSocial}</span>
                                            {c.rfc && c.rfc !== '-' && <span className="text-[10px] text-slate-400">({c.rfc})</span>}
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400">{c.sitiosCount || 0} sitios</span>
                                    </CommandItem>
                                ))}
                        </CommandGroup>
                    </>
                )}

                {/* Activos direct lookup */}
                {activos.length > 0 && (
                    <>
                        <CommandSeparator className="my-2" />
                        <CommandGroup heading="Series de Activos / Flotilla">
                            {activos
                                .filter(a => !search || a.serie?.toLowerCase().includes(search.toLowerCase()) || a.modelo?.toLowerCase().includes(search.toLowerCase()) || a.cliente?.toLowerCase().includes(search.toLowerCase()))
                                .slice(0, 5)
                                .map((a) => (
                                    <CommandItem
                                        key={a.id || a.serie}
                                        onSelect={() => runCommand(() => router.push(`/es/r4/flotilla?serie=${encodeURIComponent(a.serie)}`))}
                                        className="cursor-pointer rounded-xl flex items-center justify-between px-3 py-2 hover:bg-slate-50"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <HardDrive className="h-3.5 w-3.5 text-emerald-500" />
                                            <span className="font-mono font-bold text-slate-900 text-xs">{a.serie}</span>
                                            <span className="text-[10px] text-slate-500">{a.modelo || a.tipo || ''}</span>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400 truncate max-w-[120px]">{a.cliente || ''}</span>
                                    </CommandItem>
                                ))}
                        </CommandGroup>
                    </>
                )}
            </CommandList>
        </CommandDialog>
    );
}

export function CommandPaletteTrigger({ onClick }: { onClick?: () => void }) {
    return (
        <button
            onClick={onClick || (() => {
                const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
                document.dispatchEvent(event);
            })}
            className="flex items-center gap-3 px-3 py-2 w-full text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-xl text-xs font-medium transition-all group shadow-sm"
        >
            <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
            <span className="flex-1 text-left">Buscar o presionar...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold bg-white text-slate-500 border border-slate-200 rounded shadow-xs">
                ⌘K
            </kbd>
        </button>
    );
}
