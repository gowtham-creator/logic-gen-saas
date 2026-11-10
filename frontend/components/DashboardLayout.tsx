'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import Header from '@/components/Header';
import { useClientAdminRoutes, useSuperAdminRoutes } from '@/hooks/useRoutes';
import { LayoutDashboard, Loader2, Users, Shield, Key, Activity, Palette, FileSearch, Building2, CreditCard } from 'lucide-react';

const routeIcons: Record<string, any> = {
  users: Users,
  roles: Shield,
  templates: Shield,
  permissions: Shield,
  'api-keys': Key,
  webhooks: Activity,
  theme: Palette,
  audit: FileSearch,
  clients: Building2,
  plans: CreditCard,
  default: Shield,
};

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isAuth, setIsAuth] = useState(false);
  const adminRoutes = useClientAdminRoutes();
  const superAdminRoutes = useSuperAdminRoutes();
  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : null;
  const isSuperAdmin = user?.isSuperAdmin || (typeof window !== 'undefined' && localStorage.getItem('isSuperAdmin') === 'true');

  const isActiveRoute = (routePath: string) => {
    return pathname === routePath;
  };

  useEffect(() => {
    setIsClient(true);
    
    if (typeof window !== 'undefined') {
      const auth = isAuthenticated();
      setIsAuth(auth);
      
      if (!auth) {
        router.push('/login');
      }
    }
  }, [router]);

  if (!isClient || !isAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-primary-50/30">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Combine all accessible routes
  const allRoutes = [...adminRoutes];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-primary-50/30">
      <Header
        title="Dashboard"
        subtitle="Welcome to your dashboard"
        icon={LayoutDashboard}
        showMenuButton={true}
        sidebarOpen={sidebarOpen}
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex h-[calc(100vh-64px)] sm:h-[calc(100vh-73px)]">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white/95 lg:bg-white/80 backdrop-blur-md border-r border-gray-200/50 shadow-lg transform transition-transform duration-300 ease-in-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
          style={{ top: '64px' }}
        >
          <nav className="p-4 space-y-2 h-full overflow-y-auto">
            <button
              onClick={() => {
                router.push('/dashboard');
                setSidebarOpen(false);
              }}
              className={`sidebar-item group w-full ${
                pathname === '/dashboard' ? 'sidebar-item-active' : 'sidebar-item-inactive'
              }`}
            >
              <LayoutDashboard className={`h-5 w-5 flex-shrink-0 ${
                pathname === '/dashboard' ? 'text-primary-600' : 'text-gray-500 group-hover:text-gray-700'
              }`} />
              <span className="truncate">Dashboard</span>
            </button>

            {/* All accessible routes */}
            {allRoutes.length > 0 && (
              <>
                {allRoutes.map((route) => {
                  const Icon = routeIcons[route.tabId] || routeIcons.default;
                  return (
                    <button
                      key={route.id}
                      onClick={() => {
                        router.push(route.path);
                        setSidebarOpen(false);
                      }}
                      className={`sidebar-item group ${
                        isActiveRoute(route.path)
                          ? 'sidebar-item-active'
                          : 'sidebar-item-inactive'
                      }`}
                    >
                      <Icon className={`h-5 w-5 flex-shrink-0 ${
                        isActiveRoute(route.path) ? 'text-primary-600' : 'text-gray-500 group-hover:text-gray-700'
                      }`} />
                      <span className="truncate">{route.label}</span>
                    </button>
                  );
                })}
              </>
            )}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {/* @ts-ignore - React 19 type compatibility issue */}
          {children}
        </main>
      </div>
    </div>
  );
}

