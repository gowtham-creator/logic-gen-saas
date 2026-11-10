/**
 * Role-related types
 */

export interface Permission {
  id: string;
  resource: string;
  action: string;
  elementId?: string;
  description?: string;
  scope?: string;
}

export interface Role {
  id?: string;
  name: string;
  description?: string;
  parentRoleId?: string;
  templateId?: string;
  permissionIds?: string[];
  isActive?: boolean;
  rolePermissions?: Array<{ permissionId: string }>;
}

export interface RoleTemplate {
  id: string;
  name: string;
  description?: string;
  permissionIds?: string[];
  templatePermissions?: Array<{ permission: Permission }>;
  isActive?: boolean;
}

