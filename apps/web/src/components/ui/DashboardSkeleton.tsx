import React from 'react';

export function FlotillaSkeleton() {
    return (
        <div className="w-full space-y-5 animate-pulse">
            {/* Differentiated Grouped Indicators Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                {/* Equipos Group Skeleton (3 cols) */}
                <div className="lg:col-span-3 bg-white/60 p-3 rounded-2xl border border-slate-100 space-y-2">
                    <div className="h-3 w-36 bg-slate-200/80 rounded-md"></div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="h-16 bg-white rounded-xl border border-slate-100 p-3 flex items-center justify-between">
                                <div className="space-y-1.5">
                                    <div className="h-2.5 w-16 bg-slate-200/80 rounded-md"></div>
                                    <div className="h-5 w-10 bg-slate-100/90 rounded-md"></div>
                                </div>
                                <div className="w-8 h-8 rounded-lg bg-slate-100/80"></div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Accesorios Group Skeleton (2 cols) */}
                <div className="lg:col-span-2 bg-slate-50/80 p-3 rounded-2xl border border-slate-100 space-y-2">
                    <div className="h-3 w-40 bg-slate-200/80 rounded-md"></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {Array.from({ length: 2 }).map((_, i) => (
                            <div key={i} className="h-16 bg-white rounded-xl border border-slate-100 p-3 flex items-center justify-between">
                                <div className="space-y-1.5">
                                    <div className="h-2.5 w-16 bg-slate-200/80 rounded-md"></div>
                                    <div className="h-5 w-10 bg-slate-100/90 rounded-md"></div>
                                </div>
                                <div className="w-8 h-8 rounded-lg bg-slate-100/80"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Search Toolbar Skeleton */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-100 flex items-center justify-between gap-4">
                <div className="h-9 w-72 bg-slate-100/90 rounded-xl"></div>
                <div className="flex gap-2">
                    <div className="h-9 w-24 bg-slate-100/90 rounded-xl"></div>
                    <div className="h-9 w-24 bg-slate-100/90 rounded-xl"></div>
                </div>
            </div>

            {/* Table Skeleton */}
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs space-y-3">
                <div className="h-10 bg-slate-100/90 rounded-xl w-full"></div>
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-11 bg-slate-50 rounded-xl w-full border border-slate-100"></div>
                ))}
            </div>
        </div>
    );
}

export function PresupuestosSkeleton() {
    return (
        <div className="w-full space-y-5 animate-pulse">
            {/* Filter Bar Skeleton */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs h-24"></div>

            {/* KPI Summary Cards Skeleton (8 cards) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5">
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-20 bg-white rounded-2xl border border-slate-200/60 p-3 flex flex-col justify-between">
                        <div className="h-3 w-16 bg-slate-200/80 rounded-md"></div>
                        <div className="h-5 w-20 bg-slate-100/90 rounded-md"></div>
                    </div>
                ))}
            </div>

            {/* Master Table Skeleton */}
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs space-y-3">
                <div className="h-10 bg-slate-100/90 rounded-xl w-full"></div>
                {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="h-11 bg-slate-50 rounded-xl w-full border border-slate-100"></div>
                ))}
            </div>
        </div>
    );
}
