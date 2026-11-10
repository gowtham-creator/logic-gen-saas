import { Repository, IsNull } from 'typeorm';
import { AppDataSource } from '../config/database';
import { RoleTemplate } from '../entities/RoleTemplate';
import { RoleTemplatePermission } from '../entities/RoleTemplatePermission';
import { Role } from '../entities/Role';
import { RolePermission } from '../entities/RolePermission';
import { Permission } from '../entities/Permission';
import { AuditService } from './AuditService';
import { CreateRoleTemplateDto, UpdateRoleTemplateDto } from '../types/roleTemplate.types';
import { TenantRequest } from '../types/middleware.types';
import { getTenantRepository } from '../utils/tenantRepository';
import { getIsolationLevel, buildWhereClause } from '../utils/isolationHelper';

export class RoleTemplateService {
  private getTemplateRepository(req?: TenantRequest): Repository<RoleTemplate> {
    return getTenantRepository(req as TenantRequest, RoleTemplate);
  }

  private getTemplatePermissionRepository(req?: TenantRequest): Repository<RoleTemplatePermission> {
    return getTenantRepository(req as TenantRequest, RoleTemplatePermission);
  }

  private getRoleRepository(req?: TenantRequest): Repository<Role> {
    return getTenantRepository(req as TenantRequest, Role);
  }

  private getRolePermissionRepository(req?: TenantRequest): Repository<RolePermission> {
    return getTenantRepository(req as TenantRequest, RolePermission);
  }

  private getPermissionRepository(req?: TenantRequest): Repository<Permission> {
    return getTenantRepository(req as TenantRequest, Permission);
  }

  private auditService = new AuditService();

  async createTemplate(data: CreateRoleTemplateDto, req?: TenantRequest): Promise<RoleTemplate> {
    const templateRepository = this.getTemplateRepository(req);
    const isolationLevel = data.clientId ? await getIsolationLevel(req, data.clientId) : 'shared';
    
    // Check if name already exists (excluding soft-deleted)
    const whereClause = buildWhereClause(isolationLevel, { name: data.name, deletedAt: IsNull() }, data.clientId);
    const existing = await templateRepository.findOne({
      where: whereClause,
    });

    if (existing) {
      throw new Error('Template with this name already exists');
    }

    const templateData: any = {
      name: data.name,
      description: data.description,
    };
    
    // Only set clientId for shared isolation
    if (isolationLevel !== 'database' && data.clientId) {
      templateData.clientId = data.clientId;
    }

    const template = templateRepository.create(templateData);
    const saved = await templateRepository.save(template);
    const savedTemplate = Array.isArray(saved) ? saved[0] : saved;

    // Assign permissions
    if (data.permissionIds && data.permissionIds.length > 0) {
      await this.assignPermissions(savedTemplate.id, data.permissionIds, req);
    }

    const whereClauseForFetch = buildWhereClause(isolationLevel, { id: savedTemplate.id, deletedAt: IsNull() }, data.clientId);
    const createdTemplate = await templateRepository.findOne({
      where: whereClauseForFetch,
      relations: ['templatePermissions', 'templatePermissions.permission'],
    });
    if (!createdTemplate) {
      throw new Error('Failed to create template');
    }
    return createdTemplate;
  }

  async updateTemplate(
    id: string,
    clientId: string,
    data: UpdateRoleTemplateDto,
    updatedBy: string,
    req?: TenantRequest
  ): Promise<RoleTemplate> {
    const templateRepository = this.getTemplateRepository(req);
    const isolationLevel = clientId ? await getIsolationLevel(req, clientId) : 'shared';
    const whereClause = buildWhereClause(isolationLevel, { id, deletedAt: IsNull() }, clientId);
    
    const existingTemplate = await templateRepository.findOne({
      where: whereClause,
      relations: ['templatePermissions', 'templatePermissions.permission'],
    });

    if (!existingTemplate) {
      throw new Error('Template not found');
    }

    // Check name uniqueness if changing name
    if (data.name && data.name !== existingTemplate.name) {
      const nameWhereClause = buildWhereClause(isolationLevel, { name: data.name, deletedAt: IsNull() }, clientId);
      const existing = await templateRepository.findOne({
        where: nameWhereClause,
      });
      if (existing) {
        throw new Error('Template with this name already exists');
      }
    }

    // Update template fields
    if (data.name !== undefined) existingTemplate.name = data.name;
    if (data.description !== undefined) existingTemplate.description = data.description;
    if (data.isActive !== undefined) existingTemplate.isActive = data.isActive;

    const saved = await templateRepository.save(existingTemplate);
    const savedTemplate = Array.isArray(saved) ? saved[0] : saved;

    // Update permissions if provided
    if (data.permissionIds !== undefined) {
      await this.assignPermissions(id, data.permissionIds, req);

      // **AUTOMATIC PROPAGATION**: Update all roles using this template
      await this.propagateTemplateChanges(id, clientId, updatedBy, req);
    }

    const updatedTemplate = await templateRepository.findOne({
      where: whereClause,
      relations: ['templatePermissions', 'templatePermissions.permission'],
    });
    if (!updatedTemplate) {
      throw new Error('Template not found after update');
    }
    return updatedTemplate;
  }

  async getTemplate(id: string, clientId: string, req?: TenantRequest): Promise<RoleTemplate | null> {
    const templateRepository = this.getTemplateRepository(req);
    const isolationLevel = clientId ? await getIsolationLevel(req, clientId) : 'shared';
    const whereClause = buildWhereClause(isolationLevel, { id, deletedAt: IsNull() }, clientId);
    
    return templateRepository.findOne({
      where: whereClause,
      relations: ['templatePermissions', 'templatePermissions.permission'],
    });
  }

  async listTemplates(clientId: string, req?: TenantRequest): Promise<RoleTemplate[]> {
    const templateRepository = this.getTemplateRepository(req);
    const isolationLevel = clientId ? await getIsolationLevel(req, clientId) : 'shared';
    const whereClause = buildWhereClause(isolationLevel, { deletedAt: IsNull() }, clientId);
    
    return templateRepository.find({
      where: whereClause,
      relations: ['templatePermissions', 'templatePermissions.permission'],
      order: { createdAt: 'DESC' },
    });
  }

  async deleteTemplate(id: string, clientId: string, req?: TenantRequest): Promise<void> {
    const templateRepository = this.getTemplateRepository(req);
    const isolationLevel = clientId ? await getIsolationLevel(req, clientId) : 'shared';
    const whereClause = buildWhereClause(isolationLevel, { id }, clientId);
    
    const whereClauseWithDeleted = { ...whereClause, deletedAt: IsNull() };
    const template = await templateRepository.findOne({
      where: whereClauseWithDeleted,
    });

    if (!template) {
      throw new Error('Template not found');
    }

    // Check if template is in use (excluding soft-deleted roles)
    const roleRepository = this.getRoleRepository(req);
    const roleWhereClause = buildWhereClause(isolationLevel, { templateId: id, deletedAt: IsNull() }, clientId);
    const rolesUsingTemplate = await roleRepository.count({
      where: roleWhereClause,
    });

    if (rolesUsingTemplate > 0) {
      throw new Error(
        `Cannot delete template that is used by ${rolesUsingTemplate} role(s). Remove template from roles first.`
      );
    }

    // Soft delete (set deletedAt)
    await templateRepository.update(whereClause, { deletedAt: new Date() });
  }

  /**
   * **CORE FEATURE**: Automatically propagate template permission changes to all roles using this template
   */
  private async propagateTemplateChanges(
    templateId: string,
    clientId: string,
    updatedBy: string,
    req?: TenantRequest
  ): Promise<void> {
    const roleRepository = this.getRoleRepository(req);
    const rolePermissionRepository = this.getRolePermissionRepository(req);
    const templatePermissionRepository = this.getTemplatePermissionRepository(req);
    const isolationLevel = clientId ? await getIsolationLevel(req, clientId) : 'shared';

    // Find all roles using this template
    const roleWhereClause = buildWhereClause(isolationLevel, { templateId }, clientId);
    const rolesUsingTemplate = await roleRepository.find({
      where: roleWhereClause,
    });

    if (rolesUsingTemplate.length === 0) {
      return; // No roles to update
    }

    // Get current template permissions
    const templatePermissions = await templatePermissionRepository.find({
      where: { templateId },
      relations: ['permission'],
    });

    const templatePermissionIds = templatePermissions.map((tp) => tp.permissionId);

    // Update each role's permissions to match the template
    for (const role of rolesUsingTemplate) {
      // Remove existing permissions
      await rolePermissionRepository.delete({ roleId: role.id });

      // Add template permissions to role
      for (const permissionId of templatePermissionIds) {
        const rolePermission = rolePermissionRepository.create({
          roleId: role.id,
          permissionId,
        });
        await rolePermissionRepository.save(rolePermission);
      }

      // Audit log the automatic update
      await this.auditService.log({
        clientId,
        userId: updatedBy,
        action: 'role.template.propagated',
        resourceType: 'role',
        resourceId: role.id,
        metadata: {
          templateId,
          templateName: (await this.getTemplate(templateId, clientId, req))?.name,
          roleName: role.name,
          permissionsCount: templatePermissionIds.length,
        },
      }, req);
    }
  }

  /**
   * Apply template permissions to a role (used when creating/updating a role with a template)
   */
  async applyTemplateToRole(roleId: string, templateId: string, clientId: string, req?: TenantRequest): Promise<void> {
    const templatePermissionRepository = this.getTemplatePermissionRepository(req);
    const rolePermissionRepository = this.getRolePermissionRepository(req);

    // Get template permissions
    const templatePermissions = await templatePermissionRepository.find({
      where: { templateId },
    });

    const templatePermissionIds = templatePermissions.map((tp) => tp.permissionId);

    // Remove existing permissions
    await rolePermissionRepository.delete({ roleId });

    // Add template permissions
    for (const permissionId of templatePermissionIds) {
      const rolePermission = rolePermissionRepository.create({
        roleId,
        permissionId,
      });
      await rolePermissionRepository.save(rolePermission);
    }
  }

  private async assignPermissions(templateId: string, permissionIds: string[], req?: TenantRequest): Promise<void> {
    const templatePermissionRepository = this.getTemplatePermissionRepository(req);
    const permissionRepository = this.getPermissionRepository(req);

    // Remove existing permissions
    await templatePermissionRepository.delete({ templateId });

    // Add new permissions
    for (const permissionId of permissionIds) {
      const permission = await permissionRepository.findOne({
        where: { id: permissionId },
      });

      if (permission) {
        const templatePermission = templatePermissionRepository.create({
          templateId,
          permissionId,
        });
        await templatePermissionRepository.save(templatePermission);
      }
    }
  }
}

