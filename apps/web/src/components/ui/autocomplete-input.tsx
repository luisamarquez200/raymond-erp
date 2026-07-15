"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AutocompleteOption {
    value: string;
    label: string;
}

interface AutocompleteInputProps {
    options: AutocompleteOption[];
    value: string;
    onValueChange: (value: string) => void;
    placeholder?: string;
    emptyMessage?: string;
    className?: string;
    disabled?: boolean;
}

export function AutocompleteInput({
    options,
    value,
    onValueChange,
    placeholder = "Seleccionar...",
    emptyMessage = "No hay coincidencia",
    className,
    disabled = false,
}: AutocompleteInputProps) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");
    const containerRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const selectedLabel = options.find((opt) => opt.value === value)?.label || "";

    const filtered = options.filter((opt) =>
        opt.label.toLowerCase().includes(search.toLowerCase())
    );

    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
                setSearch("");
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (val: string) => {
        onValueChange(val === value ? "" : val);
        setOpen(false);
        setSearch("");
    };

    return (
        <div ref={containerRef} className={cn("relative", className)}>
            <div
                role="combobox"
                aria-expanded={open}
                onClick={() => {
                    if (!disabled) {
                        setOpen(true);
                        setSearch("");
                    }
                }}
                className={cn(
                    "flex items-center justify-between w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl transition-all font-medium text-slate-900 cursor-pointer",
                    open && "ring-4 ring-red-500/10 border-red-500",
                    !value && !search && "text-slate-400",
                    disabled && "opacity-50 cursor-not-allowed"
                )}
            >
                <span className="truncate">{value ? selectedLabel : placeholder}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </div>

            {open && (
                <div className="absolute z-50 mt-2 w-full bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
                    <div className="p-2 border-b border-slate-100">
                        <input
                            ref={inputRef}
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar..."
                            autoFocus
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10 transition-all"
                        />
                    </div>
                    <div className="max-h-[200px] overflow-y-auto p-1">
                        {filtered.length === 0 ? (
                            <div className="py-4 text-center text-sm text-slate-400">
                                {emptyMessage}
                            </div>
                        ) : (
                            filtered.map((option) => (
                                <div
                                    key={option.value}
                                    onClick={() => handleSelect(option.value)}
                                    className={cn(
                                        "flex items-center px-4 py-2.5 rounded-xl cursor-pointer transition-all text-sm font-medium",
                                        value === option.value
                                            ? "bg-red-50 text-red-600"
                                            : "text-slate-700 hover:bg-slate-50"
                                    )}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4 shrink-0",
                                            value === option.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {option.label}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
