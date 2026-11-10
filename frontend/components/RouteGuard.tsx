'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { usePermissions } from '@/hooks/usePermissions';
import PermissionDenied from './PermissionDenied';
import { RouteConfig } from '@/constants/routes';
import { ROUTES } from '@/constants/routes';

interface RouteGuardProps {
  route: RouteConfig;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Component that guards routes based on authentication and permissions
 */
export default function RouteGuard({ route, children, fallback }: RouteGuardProps) {
  const router = useRouter();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    // Check authentication
    if (route.requiresAuth && !isAuthenticated()) {
      router.push(ROUTES.LOGIN);
      return;
    }

    // Check permissions if route has permission requirements
    if (route.permission && !permissionsLoading) {
      const hasAccess = hasPermission(
        route.permission.resource,
        route.permission.action,
        route.permission.elementId
      );
      setIsAuthorized(hasAccess);
    } else if (!route.permission) {
      // No permission required
      setIsAuthorized(true);
    }
  }, [route, hasPermission, permissionsLoading, router]);

  // Show loading state
  if (permissionsLoading || isAuthorized === null) {
    return (
      fallback || (
        <div className="flex items-center justify-center p-8">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      )
    );
  }

  // Show permission denied
  if (isAuthorized === false) {
    return (
      <PermissionDenied
        resource={route.permission?.resource}
        action={route.permission?.action}
        showBackButton={true}
      />
    );
  }

  // Authorized - render children
  return <>{children}</>;
}
