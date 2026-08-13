"use client";

import * as React from "react";
import { Search, Check, ChevronsUpDown, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  label: string;
  value: string;
  description?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Seleccionar opción...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "No se encontraron resultados",
  disabled = false,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const selectedOption = options.find((opt) => opt.value === value || opt.label === value);

  const filteredOptions = options.filter(
    (option) =>
      option.label.toLowerCase().includes(search.toLowerCase()) ||
      (option.description && option.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl outline-none focus:ring-2 focus:ring-red-100 focus:bg-white text-left font-bold text-gray-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed",
            open && "ring-2 ring-red-100 bg-white border-red-200",
            !selectedOption && "text-gray-400 font-medium",
            className
          )}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : value || placeholder}
          </span>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {value && !disabled && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
                className="p-1 hover:bg-gray-200 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                title="Limpiar"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
            <ChevronsUpDown className="w-4 h-4 text-gray-400" />
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-2 bg-white border border-gray-100 shadow-xl rounded-2xl z-50 font-brand"
      >
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-gray-900 outline-none focus:bg-white focus:ring-2 focus:ring-red-100 focus:border-red-300 transition-all"
            autoFocus
          />
        </div>

        <div className="max-h-56 overflow-y-auto space-y-1 custom-scrollbar pr-1">
          {filteredOptions.length === 0 ? (
            <div className="py-4 text-center text-xs font-medium text-gray-400">
              {emptyMessage}
            </div>
          ) : (
            filteredOptions.map((option) => {
              const isSelected = value === option.value || value === option.label;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-xs font-bold rounded-xl transition-colors flex items-center justify-between",
                    isSelected
                      ? "bg-red-50 text-red-600 border border-red-100"
                      : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <div className="flex flex-col truncate pr-2">
                    <span className="truncate">{option.label}</span>
                    {option.description && (
                      <span className="text-[10px] text-gray-400 font-medium">
                        {option.description}
                      </span>
                    )}
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-red-600 shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
