/**
 * Frontend route constants
 */
import React from 'react';
import { PERMISSION_RESOURCES, PERMISSION_ACTIONS, ELEMENT_IDS } from './permissions';
import type { RouteConfig, TabRouteConfig } from '@/types/route.types';

export type { RouteConfig, TabRouteConfig };

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  SUPER_ADMIN: '/admin/super',
} as const;

// Lazy load components for better performance
const Users = React.lazy(() => import('@/components/Users'));
const Roles = React.lazy(() => import('@/components/Roles'));
const Templates = React.lazy(() => import('@/components/Templates'));
const AuditLogs = React.lazy(() => import('@/components/AuditLogs'));
const ApiKeys = React.lazy(() => import('@/components/ApiKeys'));
const Webhooks = React.lazy(() => import('@/components/Webhooks'));
const PermissionManager = React.lazy(() => import('@/components/PermissionManager'));
const ThemeManagement = React.lazy(() => import('@/components/ThemeManagement'));
const Workflows = React.lazy(() => import('@/components/Workflows'));

/**
 * Common Routes Configuration - All routes accessible based on user permissions
 * No admin-specific paths, everything is under common routes
 */
export const CLIENT_ADMIN_ROUTES: TabRouteConfig[] = [
  {
    id: 'overview',
    tabId: 'overview',
    path: '/admin/client/overview',
    label: 'Overview',
    component: () => null, // Will be handled inline in the page
    requiresAuth: true,
    order: 1,
  },
  {
    id: 'users',
    tabId: 'users',
    path: '/users',
    label: 'Users',
    component: Users,
    permission: {
      resource: PERMISSION_RESOURCES.USER,
      action: PERMISSION_ACTIONS.READ,
      elementId: ELEMENT_IDS.SIDEBAR_USERS,
    },
    requiresAuth: true,
    order: 2,
  },
  {
    id: 'roles',
    tabId: 'roles',
    path: '/roles',
    label: 'Roles & Permissions',
    component: Roles,
    permission: {
      resource: PERMISSION_RESOURCES.ROLE,
      action: PERMISSION_ACTIONS.READ,
      elementId: ELEMENT_IDS.SIDEBAR_ROLES,
    },
    requiresAuth: true,
    order: 3,
  },
  {
    id: 'templates',
    tabId: 'templates',
    path: '/templates',
    label: 'Role Templates',
    component: Templates,
    permission: {
      resource: PERMISSION_RESOURCES.ROLE_TEMPLATE,
      action: PERMISSION_ACTIONS.READ,
      elementId: ELEMENT_IDS.SIDEBAR_TEMPLATES,
    },
    requiresAuth: true,
    order: 4,
  },
  {
    id: 'permissions',
    tabId: 'permissions',
    path: '/permissions',
    label: 'Permissions',
    component: PermissionManager,
    permission: {
      resource: PERMISSION_RESOURCES.PERMISSION,
      action: PERMISSION_ACTIONS.READ,
      elementId: ELEMENT_IDS.SIDEBAR_PERMISSIONS,
    },
    requiresAuth: true,
    order: 5,
  },
  {
    id: 'api-keys',
    tabId: 'api-keys',
    path: '/api-keys',
    label: 'API Keys',
    component: ApiKeys,
    permission: {
      resource: PERMISSION_RESOURCES.API_KEY,
      action: PERMISSION_ACTIONS.READ,
      elementId: ELEMENT_IDS.SIDEBAR_API_KEYS,
    },
    requiresAuth: true,
    order: 6,
  },
  {
    id: 'webhooks',
    tabId: 'webhooks',
    path: '/webhooks',
    label: 'Webhooks',
    component: Webhooks,
    permission: {
      resource: PERMISSION_RESOURCES.WEBHOOK,
      action: PERMISSION_ACTIONS.READ,
      elementId: ELEMENT_IDS.SIDEBAR_WEBHOOKS,
    },
    requiresAuth: true,
    order: 7,
  },
  {
    id: 'theme',
    tabId: 'theme',
    path: '/theme',
    label: 'Theme',
    component: ThemeManagement,
    permission: {
      resource: PERMISSION_RESOURCES.THEME,
      action: PERMISSION_ACTIONS.READ,
      elementId: ELEMENT_IDS.SIDEBAR_THEME,
    },
    requiresAuth: true,
    order: 8,
  },
  {
    id: 'audit',
    tabId: 'audit',
    path: '/audit',
    label: 'Audit Logs',
    component: AuditLogs,
    permission: {
      resource: PERMISSION_RESOURCES.AUDIT_LOG,
      action: PERMISSION_ACTIONS.READ,
      elementId: ELEMENT_IDS.SIDEBAR_AUDIT,
    },
    requiresAuth: true,
    order: 9,
  },
  {
    id: 'workflows',
    tabId: 'workflows',
    path: '/workflows',
    label: 'Workflows',
    component: Workflows,
    permission: {
      resource: PERMISSION_RESOURCES.WORKFLOW,
      action: PERMISSION_ACTIONS.READ,
      elementId: ELEMENT_IDS.SIDEBAR_WORKFLOWS,
    },
    requiresAuth: true,
    order: 10,
  },
];

/**
 * Super Admin Routes Configuration - Routes for super admin features
 */
export const SUPER_ADMIN_ROUTES: TabRouteConfig[] = [
  {
    id: 'super-overview',
    tabId: 'overview',
    path: '/admin/super/overview',
    label: 'Overview',
    component: () => null, // Will be handled inline in the page
    requiresAuth: true,
    order: 1,
  },
  {
    id: 'clients',
    tabId: 'clients',
    path: '/admin/super/clients',
    label: 'Tenants',
    component: () => null, // Will be handled inline in the page
    requiresAuth: true,
    order: 2,
  },
  {
    id: 'plans',
    tabId: 'plans',
    path: '/admin/super/plans',
    label: 'Plans',
    component: () => null, // Will be handled inline in the page
    requiresAuth: true,
    order: 3,
  },
  {
    id: 'theme',
    tabId: 'theme',
    path: '/admin/super/theme',
    label: 'Global Theme',
    component: () => null, // Will be handled inline in the page
    requiresAuth: true,
    order: 4,
  },
  {
    id: 'storage',
    tabId: 'storage',
    path: '/admin/super/storage',
    label: 'Global Storage',
    component: () => null, // Will be handled inline in the page
    requiresAuth: true,
    order: 5,
  },
  {
    id: 'system-users',
    tabId: 'system-users',
    path: '/admin/super/system-users',
    label: 'System Users',
    component: () => null, // Will be handled inline in the page
    requiresAuth: true,
    order: 6,
  },
];

/**
 * Public Routes Configuration
 * Note: These are kept for reference but Next.js handles routing for pages
 */
export const PUBLIC_ROUTES: RouteConfig[] = [
  {
    id: 'login',
    path: '/login',
    label: 'Login',
    component: () => null, // Handled by Next.js file-based routing
    requiresAuth: false,
  },
  {
    id: 'reset-password',
    path: '/reset-password',
    label: 'Reset Password',
    component: () => null, // Handled by Next.js file-based routing
    requiresAuth: false,
  },
  {
    id: 'home',
    path: '/',
    label: 'Home',
    component: () => null, // Handled by Next.js file-based routing
    requiresAuth: false,
  },
];

/**
 * All routes combined
 */
export const ALL_ROUTES: RouteConfig[] = [
  ...CLIENT_ADMIN_ROUTES,
  ...SUPER_ADMIN_ROUTES,
  ...PUBLIC_ROUTES,
];

/**
 * Get route by path
 */
export function getRouteByPath(path: string): RouteConfig | undefined {
  return ALL_ROUTES.find((route) => route.path === path);
}

/**
 * Get route by id
 */
export function getRouteById(id: string): RouteConfig | undefined {
  return ALL_ROUTES.find((route) => route.id === id);
}

/**
 * Get accessible routes based on permissions
 */
export function getAccessibleRoutes(
  routes: RouteConfig[],
  hasPermission: (resource: string, action: string, elementId?: string) => boolean
): RouteConfig[] {
  return routes.filter((route) => {
    if (!route.permission) {
      return true; // No permission required
    }
    return hasPermission(
      route.permission.resource,
      route.permission.action,
      route.permission.elementId
    );
  });
}

/**
 * Get routes sorted by order
 */
export function getSortedRoutes(routes: RouteConfig[]): RouteConfig[] {
  return [...routes].sort((a, b) => {
    const orderA = 'order' in a ? (a.order as number | undefined) || 999 : 999;
    const orderB = 'order' in b ? (b.order as number | undefined) || 999 : 999;
    return orderA - orderB;
  });
}

/**
 * API endpoint constants
 */
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    REFRESH: '/api/auth/refresh',
    ME_PERMISSIONS: '/api/auth/me/permissions',
    RESET_PASSWORD: '/api/auth/reset-password',
    CONFIG: '/api/auth/config',
  },
  MFA: {
    SETUP: '/api/mfa/setup',
    SETUP_LOGIN: '/api/mfa/setup-login',
    VERIFY: '/api/mfa/verify',
    VERIFY_AND_ENABLE_LOGIN: '/api/mfa/verify-and-enable-login',
    VERIFY_LOGIN: '/api/mfa/verify-login',
    DISABLE: '/api/mfa/disable',
    RESET: '/api/mfa/reset',
    BACKUP_CODES: '/api/mfa/backup-codes',
    REGENERATE_BACKUP_CODES: '/api/mfa/regenerate-backup-codes',
    STATUS: '/api/mfa/status',
  },
  ROLES: {
    BASE: '/api/roles',
    BY_ID: (id: string) => `/api/roles/${id}`,
  },
  ROLE_TEMPLATES: {
    BASE: '/api/role-templates',
    BY_ID: (id: string) => `/api/role-templates/${id}`,
  },
  PERMISSIONS: {
    BASE: '/api/permissions',
    BY_ID: (id: string) => `/api/permissions/${id}`,
  },
  USERS: {
    BASE: '/api/users',
    BY_ID: (id: string) => `/api/users/${id}`,
  },
  API_KEYS: {
    BASE: '/api/api-keys',
    BY_ID: (id: string) => `/api/api-keys/${id}`,
    REVOKE: (id: string) => `/api/api-keys/${id}/revoke`,
  },
  CLIENTS: {
    BASE: '/api/clients',
    BY_ID: (id: string) => `/api/clients/${id}`,
  },
  PLANS: {
    BASE: '/api/plans',
    BY_ID: (id: string) => `/api/plans/${id}`,
  },
  AUDIT_LOGS: {
    BASE: '/api/audit-logs',
    BY_ID: (id: string) => `/api/audit-logs/${id}`,
  },
  THEME: {
    BASE: '/api/theme',
    PUBLIC: '/api/theme/public',
    UPLOAD_FAVICON: '/api/theme/upload/favicon',
    UPLOAD_LOGO: '/api/theme/upload/logo',
    RESET: '/api/theme/reset',
    GLOBAL: {
      BASE: '/api/theme/global',
      UPLOAD_FAVICON: '/api/theme/global/upload/favicon',
      UPLOAD_LOGO: '/api/theme/global/upload/logo',
      RESET: '/api/theme/global/reset',
    },
  },
  WEBHOOKS: {
    BASE: '/api/webhooks',
    BY_ID: (id: string) => `/api/webhooks/${id}`,
    EVENTS: (id: string) => `/api/webhooks/${id}/events`,
    RETRY_EVENT: (eventId: string) => `/api/webhooks/events/${eventId}/retry`,
  },
  WORKFLOWS: {
    BASE: '/api/workflows',
    BY_ID: (id: string) => `/api/workflows/${id}`,
    FILES: (workflowId: string) => `/api/workflows/${workflowId}/files`,
    GET_FILES: '/api/workflows/files',
    FILE_DOWNLOAD: (fileId: string) => `/api/workflows/files/${fileId}`,
    FILE_DELETE: (fileId: string) => `/api/workflows/files/${fileId}`,
  },
} as const;

