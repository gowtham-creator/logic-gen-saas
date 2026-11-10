/**
 * Role Template-related types
 */

export interface CreateRoleTemplateDto {
  name: string;
  description?: string;
  clientId: string;
  permissionIds?: string[];
}

export interface UpdateRoleTemplateDto {
  name?: string;
  description?: string;
  permissionIds?: string[];
  isActive?: boolean;
}

