'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User, LogOut, Settings, Shield, ChevronDown, Code, Crown, LayoutDashboard, Lock } from 'lucide-react';
import { logout, getStoredUser } from '@/lib/auth';
import { notificationService } from '@/lib/notifications';
import ResetPasswordModal from '@/components/ResetPasswordModal';
import MFASetupModal from '@/components/MFASetupModal';
import { apiClient, ApiResponse } from '@/lib/api';
import { API_ENDPOINTS } from '@/constants/routes';
import { usePermissions } from '@/contexts/PermissionsContext';
import { PERMISSION_RESOURCES, PERMISSION_ACTIONS, ELEMENT_IDS } from '@/constants/permissions';

interface ProfileDropdownProps {
  className?: string;
}

export default function ProfileDropdown({ className = '' }: ProfileDropdownProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showMFASetupModal, setShowMFASetupModal] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaEnforced, setMfaEnforced] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { hasPermission } = usePermissions();

  // Only read from localStorage on client side after mount
  useEffect(() => {
    setMounted(true);
    const storedUser = getStoredUser();
    setUser(storedUser);
    setIsSuperAdmin(localStorage.getItem('isSuperAdmin') === 'true');
    setIsDeveloper(localStorage.getItem('isDeveloper') === 'true');
    
    // Only check MFA status if we have a token (wait a bit for token to be set after login)
    const token = localStorage.getItem('accessToken');
    if (token) {
      // Small delay to ensure token is fully set
      setTimeout(() => {
        checkMFAStatus();
      }, 200);
    }
  }, []);

  const checkMFAStatus = async () => {
    try {
      const response = await apiClient.get<{ enabled: boolean; enforced: boolean }>(API_ENDPOINTS.MFA.STATUS);
      if (response && response.enabled !== undefined) {
        setMfaEnabled(response.enabled);
        setMfaEnforced(response.enforced);
      }
    } catch (error) {
      // MFA might not be set up yet, ignore error
    }
  };

  const handleMFASetup = () => {
    setIsOpen(false);
    setShowMFASetupModal(true);
  };

  const handleDisableMFA = async () => {
    if (!confirm('Are you sure you want to disable MFA? This will make your account less secure.')) {
      return;
    }

    try {
      await apiClient.post(API_ENDPOINTS.MFA.DISABLE);
      notificationService.success('MFA disabled successfully');
      setMfaEnabled(false);
      setIsOpen(false);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || 'Failed to disable MFA';
      notificationService.error(errorMessage);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
      notificationService.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      notificationService.error('Failed to logout');
    }
  };

  const handleProfile = () => {
    setIsOpen(false);
    router.push('/profile');
  };

  const handleSuperAdmin = () => {
    setIsOpen(false);
    router.push('/admin/super');
  };

  const handleDeveloper = () => {
    setIsOpen(false);
    router.push('/developer/dashboard');
  };

  const handleAdmin = () => {
    setIsOpen(false);
    router.push('/dashboard');
  };

  const handleDashboard = () => {
    setIsOpen(false);
    router.push('/dashboard');
  };

  const handleResetPassword = () => {
    setIsOpen(false);
    setShowResetPasswordModal(true);
  };

  // Check if user is from SSO (should not show reset password option)
  const isSSOUser = user?.source === 'sso';

  // Determine current page type
  const isOnSuperAdminPage = pathname?.startsWith('/admin/super');
  const isOnDeveloperPage = pathname?.startsWith('/developer');
  const isOnAdminPage = pathname === '/dashboard' || pathname?.startsWith('/users') || pathname?.startsWith('/roles') || pathname?.startsWith('/api-keys') || pathname?.startsWith('/webhooks') || pathname?.startsWith('/theme') || pathname?.startsWith('/audit') || pathname?.startsWith('/permissions') || pathname?.startsWith('/templates');
  
  // Check if user is a regular admin (has access to dashboard but not super admin or developer)
  // For now, we'll show Admin option if user is not super admin or developer
  // This can be refined based on your actual permission system
  const isAdmin = !isSuperAdmin && !isDeveloper;

  // Only compute initials after mount to avoid hydration mismatch
  // Always render 'U' on server, then update after mount
  const userInitials = mounted && user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U'
    : 'U';

  const userName = mounted && user ? `${user.firstName} ${user.lastName}` : 'User';

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-sm font-semibold">
          {userInitials}
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-sm font-medium text-gray-900">{userName}</p>
          <p className="text-xs text-gray-500">{user?.email}</p>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          <div className="px-4 py-2 border-b border-gray-200">
            <p className="text-sm font-medium text-gray-900">{userName}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>

          <button
            onClick={handleProfile}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2 transition-colors"
          >
            <User className="h-4 w-4 text-gray-500" />
            <span>Profile</span>
          </button>

          {/* Reset Password - only show for non-SSO users */}
          {!isSSOUser && (
            <button
              onClick={handleResetPassword}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2 transition-colors"
            >
              <Lock className="h-4 w-4 text-gray-500" />
              <span>Reset Password</span>
            </button>
          )}

          {/* MFA Management - only show for non-SSO users */}
          {!isSSOUser && (
            <>
              {mfaEnabled ? (
                <button
                  onClick={handleDisableMFA}
                  disabled={mfaEnforced}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={mfaEnforced ? 'MFA is enforced by your organization' : ''}
                >
                  <Shield className="h-4 w-4 text-gray-500" />
                  <span>Disable MFA</span>
                </button>
              ) : (
                <button
                  onClick={handleMFASetup}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2 transition-colors"
                >
                  <Shield className="h-4 w-4 text-gray-500" />
                  <span>Setup MFA</span>
                </button>
              )}
            </>
          )}

          {/* Show Go to Dashboard for Super Admin when on super admin page */}
          {isSuperAdmin && isOnSuperAdminPage && (
            <button
              onClick={handleDashboard}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2 transition-colors"
            >
              <LayoutDashboard className="h-4 w-4 text-gray-500" />
              <span>Go to Dashboard</span>
            </button>
          )}

          {/* Show Go to Dashboard for Developer when on developer page */}
          {isDeveloper && isOnDeveloperPage && (
            <button
              onClick={handleDashboard}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2 transition-colors"
            >
              <LayoutDashboard className="h-4 w-4 text-gray-500" />
              <span>Go to Dashboard</span>
            </button>
          )}

          {/* Show Super Admin option only if user has permission and is not on super admin page */}
          {isSuperAdmin && !isOnSuperAdminPage && (
            <button
              onClick={handleSuperAdmin}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2 transition-colors"
            >
              <Crown className="h-4 w-4 text-yellow-500" />
              <span>Super Admin</span>
            </button>
          )}

          {/* Show Developer option only if user has permission and is not on developer page */}
          {isDeveloper && !isOnDeveloperPage && (
            <button
              onClick={handleDeveloper}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2 transition-colors"
            >
              <Code className="h-4 w-4 text-blue-500" />
              <span>Developer</span>
            </button>
          )}

          {/* Show Admin option only if user is admin and is not on admin page */}
          {isAdmin && !isOnAdminPage && (
            <button
              onClick={handleAdmin}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2 transition-colors"
            >
              <Shield className="h-4 w-4 text-gray-500" />
              <span>Admin</span>
            </button>
          )}

          {(isSuperAdmin || isDeveloper || isAdmin) && (
            <div className="border-t border-gray-200 my-1" />
          )}

          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      )}

        {showResetPasswordModal && (
          // @ts-ignore - React 19 type compatibility issue with modal components
          <ResetPasswordModal
          onClose={() => setShowResetPasswordModal(false)}
          onSuccess={() => {
            // Optionally refresh user data or show success message
          }}
        />
      )}

        {showMFASetupModal && (
          // @ts-ignore - React 19 type compatibility issue with modal components
          <MFASetupModal
          onClose={() => {
            setShowMFASetupModal(false);
            checkMFAStatus();
          }}
          onSuccess={() => {
            setMfaEnabled(true);
            checkMFAStatus();
          }}
        />
      )}
    </div>
  );
}

