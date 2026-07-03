'use client';

import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import TallerR1Sidebar from '@/components/navigation/TallerR1Sidebar';
import { useAuthTallerStore } from '@/store/auth-taller.store';
import { useRouter, usePathname, useParams } from 'next/navigation';


const queryClient = new QueryClient();

export default function TallerR1Layout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user } = useAuthTallerStore();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // If not logged in
    if (isClient && !user) {
      const locale = params.locale || 'es';
      // Redirect to main login page
      router.push(`/${locale}/login`);
      return;
    }

    const currentSite = params.site as string;
    const validSites = ['r1', 'r2', 'r3'];

    // Security Check: Verify user has access to the current site
    if (isClient && user && validSites.includes(currentSite)) {
      const userSites = user.sitio ? user.sitio.split(',').map(s => s.trim().toLowerCase()) : ['r1'];
      if (!userSites.includes(currentSite)) {
        const locale = params.locale || 'es';
        console.error(`[Security] Unauthorized access to ${currentSite}. Redirecting. Allowed: ${user.sitio}`);
        router.push(`/${locale}/site-selection`);
        return;
      }
    }

    // If it's a valid site, sync it with the store
    if (isClient && validSites.includes(currentSite)) {
      const { selectedSite, setSelectedSite } = useAuthTallerStore.getState();
      if (selectedSite !== currentSite) {
        setSelectedSite(currentSite as any);
      }
    } else if (isClient && currentSite !== 'site-selection' && !validSites.includes(currentSite)) {
      // If invalid site and not site-selection, redirect to selection
      const locale = params.locale || 'es';
      router.push(`/${locale}/site-selection`);
    }
  }, [user, router, isClient, params.locale, params.site]);

  // Prevent hydration mismatch or flash
  if (!isClient) return null;

  // If not logged in (and handled by useEffect, but for safety return null/loader)
  if (!user) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen force-light-mode w-full overflow-x-hidden" data-theme="light">
        <TallerR1Sidebar
          isCollapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Module Content Area */}
        <div className={cn(
          "flex-1 transition-all duration-300 w-full min-w-0",
          sidebarCollapsed ? "ml-16" : "ml-64"
        )}>
          <main className="p-0">
            {children}
          </main>
        </div>
      </div>
    </QueryClientProvider>
  );
}

