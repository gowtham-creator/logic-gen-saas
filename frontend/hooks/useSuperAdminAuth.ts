'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { apiClient } from '@/lib/api';

export function useSuperAdminAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check access token
        const hasAccessToken = localStorage.getItem('accessToken');
        if (!hasAccessToken) {
          router.push('/login');
          return;
        }

        // Check super admin flag
        const isSuperAdmin = localStorage.getItem('isSuperAdmin') === 'true';
        if (!isSuperAdmin) {
          const currentPath = pathname || '/admin/super';
          router.push(`/unauthorized?path=${encodeURIComponent(currentPath)}&resource=Super Admin`);
          return;
        }

        // If both checks pass, authorize without API call
        // API call removed to avoid redirect issues on slow/failed requests
        setIsAuthorized(true);
      } catch (error) {
        console.error('Super admin auth check failed:', error);
        // Don't redirect on errors, just show unauthorized
        setIsAuthorized(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router, pathname]);

  return { isAuthorized, isLoading };
}
