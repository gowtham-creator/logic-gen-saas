'use client';

import React, { Suspense } from 'react';
import { RouteConfig } from '@/constants/routes';
import RouteGuard from './RouteGuard';
import { RouteRendererProps } from '@/types';

/**
 * Component to render routes with lazy loading, error boundaries, and permission guards
 */
export default function RouteRenderer({ route, fallback, ...props }: RouteRendererProps) {
  const Component = route.component;

  const defaultFallback = (
    <div className="flex items-center justify-center p-8">
      <div className="flex flex-col items-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );

  return (
    <RouteGuard route={route} fallback={fallback}>
      <Suspense fallback={fallback || defaultFallback}>
        <Component {...props} />
      </Suspense>
    </RouteGuard>
  );
}
