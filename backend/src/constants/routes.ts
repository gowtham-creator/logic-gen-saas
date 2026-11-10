/**
 * API Route constants
 */
export const ROUTES = {
  AUTH: {
    BASE: '/api/auth',
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    REFRESH: '/api/auth/refresh',
    ME_PERMISSIONS: '/api/auth/me/permissions',
    OIDC_AUTHORIZE: '/api/auth/oidc/authorize',
    OIDC_CALLBACK: '/api/auth/oidc/callback',
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
  HEALTH: '/health',
} as const;

