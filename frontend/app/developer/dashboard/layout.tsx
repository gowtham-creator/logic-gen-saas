'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Code, BarChart3, Building2 } from 'lucide-react';
import { isAuthenticated } from '@/lib/auth';
import Header from '@/components/Header';

export default function DeveloperDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Only check auth if we're actually on a developer dashboard route
    if (!pathname?.startsWith('/developer/dashboard')) {
      return;
    }
    
    const isAuth = isAuthenticated();
    const isDeveloper = localStorage.getItem('isDeveloper') === 'true';
    
    if (!isAuth) {
      router.push('/login');
      return;
    }
    
    if (!isDeveloper) {
      // Redirect to unauthorized page with current path info
      const currentPath = pathname || '/developer/dashboard';
      router.push(`/unauthorized?path=${encodeURIComponent(currentPath)}&resource=Developer Dashboard`);
      return;
    }
  }, [router, pathname]);

  const isActiveRoute = (route: string) => {
    return pathname === `/developer/dashboard${route}`;
  };

  // Don't render layout if we're not on a developer dashboard route
  // This prevents layout nesting when navigating to other routes
  if (!pathname?.startsWith('/developer/dashboard')) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="Developer Dashboard"
        subtitle="System statistics and tenant management"
        icon={Code}
        iconBg="from-blue-500 to-blue-600"
        showMenuButton={true}
        sidebarOpen={sidebarOpen}
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => router.push('/developer/dashboard/overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                isActiveRoute('/overview')
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <BarChart3 className="h-5 w-5 inline mr-2" />
              System Overview
            </button>
            <button
              onClick={() => router.push('/developer/dashboard/tenants')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                isActiveRoute('/tenants')
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Building2 className="h-5 w-5 inline mr-2" />
              All Tenants
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

