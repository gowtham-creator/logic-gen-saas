/**
 * Tab names and types
 */
export type ClientAdminTab = 'users' | 'roles' | 'templates' | 'permissions' | 'api-keys' | 'webhooks' | 'theme' | 'audit';
export type SuperAdminTab = 'clients' | 'plans';

export const CLIENT_ADMIN_TABS: Record<ClientAdminTab, string> = {
  users: 'Users',
  roles: 'Roles & Permissions',
  templates: 'Role Templates',
  permissions: 'Permissions',
  'api-keys': 'API Keys',
  webhooks: 'Webhooks',
  theme: 'Theme',
  audit: 'Audit Logs',
} as const;

export const SUPER_ADMIN_TABS: Record<SuperAdminTab, string> = {
  clients: 'Clients',
  plans: 'Plans',
} as const;

