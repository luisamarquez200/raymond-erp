'use client';

import { useAuthTallerStore } from '@/store/auth-taller.store';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogOut, ArrowLeft } from 'lucide-react';
import { ThemeSwitcher } from '@/components/ui/theme-switcher';

export default function ComercialLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthTallerStore();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && user && user.email !== 'it@runsolutions.com') {
      router.push('/es/site-selection');
    }
  }, [isClient, user, router]);

  if (!isClient || !user) return null;
  if (user.email !== 'it@runsolutions.com') return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/es/site-selection')}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <span className="text-[10px] font-black text-violet-600 uppercase tracking-[0.2em]">Raymond Comercial</span>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Centro de Control</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-slate-400">{user.email}</span>
            <button
              onClick={() => router.push('/es/site-selection')}
              className="p-2 hover:bg-red-50 rounded-xl transition-colors text-slate-400 hover:text-red-500"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
      <ThemeSwitcher />
    </div>
  );
}
