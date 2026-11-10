'use client';

import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, X, LucideIcon } from 'lucide-react';
import ProfileDropdown from './ProfileDropdown';
import { useTheme } from '@/contexts/ThemeContext';
import AuthenticatedImage from './AuthenticatedImage';

interface HeaderProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  iconBg?: string;
  onMenuToggle?: () => void;
  sidebarOpen?: boolean;
  showMenuButton?: boolean;
  className?: string;
}

export default function Header({
  title,
  subtitle,
  icon: Icon,
  iconBg = 'from-primary-500 to-primary-600',
  onMenuToggle,
  sidebarOpen = false,
  showMenuButton = false,
  className = '',
}: HeaderProps) {
  const router = useRouter();
  const { theme } = useTheme();

  return (
    <header className={`bg-white/80 backdrop-blur-md border-b border-gray-200/50 shadow-sm sticky top-0 z-20 ${className}`}>
      <div className="px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
        <div className="flex items-center space-x-2 sm:space-x-4 flex-1">
          {/* Mobile menu button */}
          {showMenuButton && (
            <button
              onClick={onMenuToggle}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Toggle menu"
            >
              {sidebarOpen ? (
                <X className="h-6 w-6 text-gray-700" />
              ) : (
                <Menu className="h-6 w-6 text-gray-700" />
              )}
            </button>
          )}

          <div className="flex items-center space-x-2 sm:space-x-3 cursor-pointer" onClick={() => router.push('/dashboard')}>
            {/* Show logo if available, otherwise show icon */}
            {theme?.logoUrl ? (
              <div className="flex items-center">
                <AuthenticatedImage
                  src={theme.logoUrl}
                  alt={`${title} Logo`}
                  className="h-8 w-auto sm:h-10 object-contain"
                />
              </div>
            ) : (
              <div className={`p-1.5 sm:p-2 bg-gradient-to-br ${iconBg} rounded-lg shadow-lg`}>
                <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs text-gray-500 hidden sm:block">{subtitle}</p>
              )}
            </div>
          </div>
        </div>
        <ProfileDropdown />
      </div>
    </header>
  );
}

