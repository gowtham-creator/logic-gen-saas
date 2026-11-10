import { useMemo } from 'react';
import { usePermissions } from './usePermissions';
import {
  CLIENT_ADMIN_ROUTES,
  SUPER_ADMIN_ROUTES,
  PUBLIC_ROUTES,
  RouteConfig,
  TabRouteConfig,
  getAccessibleRoutes,
  getSortedRoutes,
} from '@/constants/routes';

/**
 * Hook to get accessible routes based on permissions
 */
export function useClientAdminRoutes(): TabRouteConfig[] {
  const { hasPermission, loading } = usePermissions();

  return useMemo(() => {
    if (loading) return [];
    const accessible = getAccessibleRoutes(CLIENT_ADMIN_ROUTES, hasPermission);
    console.log('Accessible Client Admin Routes:', accessible);
    return getSortedRoutes(accessible) as TabRouteConfig[];
  }, [hasPermission, loading]);
}

/**
 * Hook to get super admin routes
 * Only returns routes if user is a super admin
 */
export function useSuperAdminRoutes(): TabRouteConfig[] {
  return useMemo(() => {
    // Only return routes if user is super admin
    if (typeof window !== 'undefined') {
      const isSuperAdmin = localStorage.getItem('isSuperAdmin') === 'true';
      if (!isSuperAdmin) return [];
    }
    return getSortedRoutes(SUPER_ADMIN_ROUTES) as TabRouteConfig[];
  }, []);
}

/**
 * Hook to get public routes
 */
export function usePublicRoutes(): RouteConfig[] {
  return useMemo(() => {
    return PUBLIC_ROUTES;
  }, []);
}

/**
 * Hook to get all routes with permission checking
 */
export function useRoutes() {
  const clientAdminRoutes = useClientAdminRoutes();
  const superAdminRoutes = useSuperAdminRoutes();
  const publicRoutes = usePublicRoutes();

  return {
    clientAdminRoutes,
    superAdminRoutes,
    publicRoutes,
    allRoutes: [...clientAdminRoutes, ...superAdminRoutes, ...publicRoutes],
  };
}

