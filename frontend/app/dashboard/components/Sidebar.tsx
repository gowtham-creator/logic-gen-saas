'use client';

import { Home, Users, PanelRightClose, UsersGroup, Album, Swatches, GitBranch, Shield, Key, Activity, FileText } from '@mynaui/icons-react';
import { Building2, CreditCard, Palette, HardDrive, Users as UsersIcon, ChevronDown, LayoutGrid } from 'lucide-react';
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { useClientAdminRoutes, useSuperAdminRoutes } from '@/hooks/useRoutes';
import CreateDMNButton from './CreateDMNButton';

interface SidebarProps {
  className?: string;
  onCreateWorkspace?: () => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/dashboard' },
];

const routeIcons: Record<string, any> = {
  'workflows': GitBranch,
  users: Users,
  roles: UsersGroup,
  templates: Album,
  permissions: Shield,
  'api-keys': Key,
  webhooks: Activity,
  theme: Swatches,
  audit: FileText,
  overview: LayoutGrid,
  // Super admin icons
  clients: Building2,
  plans: CreditCard,
  storage: HardDrive,
  'system-users': UsersIcon,
  default: Shield,
};

export default function Sidebar({ className = '', onCreateWorkspace }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Initialize accordion state from localStorage or determine from current path
  const [isAdminOpen, setIsAdminOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('adminAccordionOpen');
      if (saved !== null) return saved === 'true';
      // Auto-open if on an admin route
      return pathname.startsWith('/admin/client') || pathname.startsWith('/users') || pathname.startsWith('/roles') || pathname.startsWith('/templates') || pathname.startsWith('/permissions') || pathname.startsWith('/api-keys') || pathname.startsWith('/webhooks') || pathname.startsWith('/theme') || pathname.startsWith('/audit') || pathname.startsWith('/workflows');
    }
    return false;
  });

  const [isSuperAdminOpen, setIsSuperAdminOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('superAdminAccordionOpen');
      if (saved !== null) return saved === 'true';
      // Auto-open if on a super admin route
      return pathname.startsWith('/admin/super');
    }
    return false;
  });

  const adminRoutes = useClientAdminRoutes();
  const superAdminRoutes = useSuperAdminRoutes();

  // Save accordion state to localStorage whenever it changes
  const handleAdminToggle = () => {
    const newState = !isAdminOpen;
    setIsAdminOpen(newState);
    localStorage.setItem('adminAccordionOpen', String(newState));
  };

  const handleSuperAdminToggle = () => {
    const newState = !isSuperAdminOpen;
    setIsSuperAdminOpen(newState);
    localStorage.setItem('superAdminAccordionOpen', String(newState));
  };

  return (
    <aside className={`${isCollapsed ? 'w-[72px]' : 'w-[250px]'} bg-white border-r border-gray-100 flex flex-col relative transition-all duration-300 ${className}`}>
      {/* Logo & Toggle */}
      <div className="h-[80px] flex items-center justify-between px-4">
        <div className={`flex items-center gap-2 ${isCollapsed ? 'justify-center w-full' : ''}`}>
          {isCollapsed ? (
            <div className=" relative shrink-0">
              <Image
                src="/images/lg-logo.png"
                alt="Logo"
                width={32}
                height={32}
                className="object-cover"
              />
            </div>
          ) : (
            <div className="size-10 relative">
              <Image
                src="/images/lg-logo.png"
                alt="Logo"
                width={120}
                height={40}
                className="object-contain"
              />
            </div>
          )}
        </div>
        {!isCollapsed && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"
            title="Collapse sidebar"
          >
            <PanelRightClose className="w-5 h-5 text-gray-600" />
          </button>
        )}
      </div>

      {/* Collapse Button (when collapsed) */}
      {isCollapsed && (
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center py-2 hover:bg-gray-50 transition-colors"
          title="Expand sidebar"
        >
          <PanelRightClose className="w-5 h-5 text-gray-600 rotate-180" />
        </button>
      )}

      {/* Create Workspace Button */}
      <CreateDMNButton isCollapsed={isCollapsed} onClick={onCreateWorkspace} />

      {/* Navigation */}
      <nav className={`flex-1 pt-2 ${isCollapsed ? 'px-2' : 'px-4'} overflow-y-auto`}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;

          return (
            <button
              key={item.id}
              onClick={() => router.push(item.path)}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-3' : 'gap-3 px-4'} py-3 rounded-xl mb-1 transition-all duration-200 ${
                isActive
                  ? 'bg-[#F2F2FF] text-[#4B3CB2]'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              title={isCollapsed ? item.label : ''}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
            </button>
          );
        })}

        {/* Admin Routes Section */}
        {adminRoutes.length > 0 && (
          <div className="mt-4">
            {!isCollapsed ? (
              <>
                <button
                  onClick={handleAdminToggle}
                  className="w-full flex items-center justify-between px-4 py-2 mb-1 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Admin</p>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                      isAdminOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isAdminOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  {adminRoutes.map((route) => {
                    const Icon = routeIcons[route.tabId] || routeIcons.default;
                    const isActive = pathname === route.path;

                    return (
                      <button
                        key={route.id}
                        onClick={() => router.push(route.path)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-all duration-200 ${
                          isActive
                            ? 'bg-[#F2F2FF] text-[#4B3CB2]'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="w-5 h-5 shrink-0" />
                        <span className="text-sm font-medium">{route.label}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              // Collapsed view - show items without accordion
              adminRoutes.map((route) => {
                const Icon = routeIcons[route.tabId] || routeIcons.default;
                const isActive = pathname === route.path;

                return (
                  <button
                    key={route.id}
                    onClick={() => router.push(route.path)}
                    className={`w-full flex items-center justify-center px-3 py-3 rounded-xl mb-1 transition-all duration-200 ${
                      isActive
                        ? 'bg-[#F2F2FF] text-[#4B3CB2]'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                    title={route.label}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Super Admin Routes Section */}
        {superAdminRoutes.length > 0 && (
          <div className="mt-4">
            {!isCollapsed ? (
              <>
                <button
                  onClick={handleSuperAdminToggle}
                  className="w-full flex items-center justify-between px-4 py-2 mb-1 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Super Admin</p>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                      isSuperAdminOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isSuperAdminOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  {superAdminRoutes.map((route) => {
                    const Icon = routeIcons[route.tabId] || routeIcons.default;
                    const isActive = pathname === route.path;

                    return (
                      <button
                        key={route.id}
                        onClick={() => router.push(route.path)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-all duration-200 ${
                          isActive
                            ? 'bg-[#F2F2FF] text-[#4B3CB2]'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="w-5 h-5 shrink-0" />
                        <span className="text-sm font-medium">{route.label}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              // Collapsed view - show items without accordion
              superAdminRoutes.map((route) => {
                const Icon = routeIcons[route.tabId] || routeIcons.default;
                const isActive = pathname === route.path;

                return (
                  <button
                    key={route.id}
                    onClick={() => router.push(route.path)}
                    className={`w-full flex items-center justify-center px-3 py-3 rounded-xl mb-1 transition-all duration-200 ${
                      isActive
                        ? 'bg-[#F2F2FF] text-[#4B3CB2]'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                    title={route.label}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                  </button>
                );
              })
            )}
          </div>
        )}
      </nav>
    </aside>
  );
}
