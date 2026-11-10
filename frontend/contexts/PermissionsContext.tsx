'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import type { Permission } from '@/types';

interface PermissionsContextType {
  permissions: Permission[];
  loading: boolean;
  hasPermission: (resource: string, action: string, elementId?: string, scope?: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const lastPathnameRef = useRef<string | null>(null);

  const fetchPermissions = useCallback(async (force = false) => {
    // Don't fetch if already fetching or if not authenticated
    if (isFetchingRef.current || !isAuthenticated()) {
      return;
    }

    // If already fetched and not forcing, skip
    if (hasFetchedRef.current && !force) {
      return;
    }

    try {
      isFetchingRef.current = true;
      setLoading(true);
      const data = await apiClient.get<Permission[]>('/api/auth/me/permissions');
      setPermissions(data);
      hasFetchedRef.current = true;
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
      // If not authenticated, permissions will be empty
      setPermissions([]);
      hasFetchedRef.current = false;
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    // Check if we're on a public page (login, reset-password, etc.)
    const isPublicPage = pathname === '/login' || 
      pathname?.startsWith('/login') ||
      pathname === '/reset-password' ||
      pathname?.startsWith('/reset-password');

    // Check if pathname changed (user navigated)
    const pathnameChanged = lastPathnameRef.current !== pathname;
    lastPathnameRef.current = pathname || null;

    // If authenticated and not on public page, fetch permissions
    if (!isPublicPage && isAuthenticated()) {
      // If pathname changed (user navigated from login to dashboard), force refresh
      const shouldForceRefresh = pathnameChanged && (pathname === '/dashboard' || pathname?.startsWith('/dashboard'));
      fetchPermissions(shouldForceRefresh);
    } else if (!isAuthenticated() || isPublicPage) {
      // If not authenticated or on public page, clear permissions and reset state
      setPermissions([]);
      setLoading(false);
      hasFetchedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]); // Re-run when pathname changes

  // Listen for auth state changes (e.g., after login)
  useEffect(() => {
    const handleAuthStateChange = () => {
      if (isAuthenticated()) {
        hasFetchedRef.current = false; // Reset to force refresh
        fetchPermissions(true);
      }
    };

    window.addEventListener('auth-state-changed', handleAuthStateChange);
    return () => {
      window.removeEventListener('auth-state-changed', handleAuthStateChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasPermission = useCallback(
    (
      resource: string,
      action: string,
      elementId?: string,
      scope?: string
    ): boolean => {
      return permissions.some((perm) => {
        const resourceMatch = perm.resource === resource || perm.resource === '*';
        const actionMatch = perm.action === action || perm.action === '*';
        const elementMatch = !elementId || !perm.elementId || perm.elementId === elementId;
        const scopeMatch = !scope || !perm.scope || perm.scope === scope || perm.scope === '*';
        return resourceMatch && actionMatch && elementMatch && scopeMatch;
      });
    },
    [permissions]
  );

  const refreshPermissions = useCallback(async () => {
    hasFetchedRef.current = false; // Reset flag to force refresh
    await fetchPermissions(true);
  }, [fetchPermissions]);

  return (
    <PermissionsContext.Provider
      value={{
        permissions,
        loading,
        hasPermission,
        refreshPermissions,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}

