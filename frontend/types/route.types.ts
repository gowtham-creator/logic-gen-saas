/**
 * Route-related types
 */

import React from 'react';

export interface RouteConfig {
  id: string;
  path: string;
  label: string;
  component: React.ComponentType<any> | React.LazyExoticComponent<React.ComponentType<any>>;
  permission?: {
    resource: string;
    action: string;
    elementId?: string;
  };
  requiresAuth?: boolean;
  metadata?: Record<string, any>;
}

export interface TabRouteConfig extends RouteConfig {
  tabId: string;
  icon?: string;
  order?: number;
}

