/**
 * Role-related types
 */

export interface CreateRoleDto {
  name: string;
  description?: string;
  clientId: string;
  parentRoleId?: string;
  templateId?: string;
  permissionIds?: string[];
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
  parentRoleId?: string;
  templateId?: string;
  permissionIds?: string[];
  isActive?: boolean;
}

