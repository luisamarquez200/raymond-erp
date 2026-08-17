'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface TableSkeletonProps {
    rows?: number;
    columns?: number;
    className?: string;
}

export function TableSkeleton({ rows = 8, columns = 6, className }: TableSkeletonProps) {
    return (
        <div className={cn('w-full rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-sm animate-pulse', className)}>
            {/* Header Skeleton */}
            <div className="flex items-center gap-4 bg-slate-50/80 px-6 py-4 border-b border-slate-100">
                {Array.from({ length: columns }).map((_, i) => (
                    <div
                        key={`h-${i}`}
                        className="h-4 bg-slate-200 rounded-lg"
                        style={{
                            width: i === 0 ? '22%' : i === 1 ? '18%' : i === columns - 1 ? '12%' : '15%',
                        }}
                    />
                ))}
            </div>

            {/* Rows Skeleton */}
            <div className="divide-y divide-slate-100">
                {Array.from({ length: rows }).map((_, rowIdx) => (
                    <div key={`r-${rowIdx}`} className="flex items-center gap-4 px-6 py-4">
                        {Array.from({ length: columns }).map((_, colIdx) => (
                            <div
                                key={`c-${rowIdx}-${colIdx}`}
                                className="h-3.5 bg-slate-100 rounded-md"
                                style={{
                                    width: colIdx === 0 ? '24%' : colIdx === 1 ? '16%' : colIdx === columns - 1 ? '10%' : '14%',
                                    opacity: 1 - (rowIdx * 0.08),
                                }}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="p-6 bg-white border border-slate-100 rounded-2xl space-y-3">
                    <div className="h-3 w-1/3 bg-slate-200 rounded" />
                    <div className="h-8 w-1/2 bg-slate-200 rounded-lg" />
                    <div className="h-2.5 w-2/3 bg-slate-100 rounded" />
                </div>
            ))}
        </div>
    );
}
