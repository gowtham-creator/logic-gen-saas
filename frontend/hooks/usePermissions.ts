/**
 * Re-export usePermissions from PermissionsContext
 * This maintains backward compatibility while using the context-based implementation
 */
export { usePermissions } from '@/contexts/PermissionsContext';
export type { Permission } from '@/types';

/**
 * HOC to conditionally render components based on permissions
 */
import React from 'react';
import { usePermissions } from '@/contexts/PermissionsContext';

export function withPermission<P extends object>(
  Component: React.ComponentType<P>,
  resource: string,
  action: string,
  elementId?: string
): React.ComponentType<P> {
  return function PermissionWrapper(props: P): React.ReactElement | null {
    const { hasPermission } = usePermissions();
    const allowed = hasPermission(resource, action, elementId);

    if (!allowed) {
      return null;
    }

    return React.createElement(Component, props);
  };
}

