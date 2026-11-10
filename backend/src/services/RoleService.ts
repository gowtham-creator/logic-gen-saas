import { RoleRepository } from '../db/RoleRepository';
import { AppDataSource } from '../config/database';
import { Role } from '../entities/Role';
import { User } from '../entities/User';
import { RolePermission } from '../entities/RolePermission';
import { Permission } from '../entities/Permission';
import { RoleTemplateService } from './RoleTemplateService';
import { CreateRoleDto, UpdateRoleDto } from '../types/role.types';
import { triggerWebhook } from '../utils/webhookTrigger';
import { TenantRequest } from '../types/middleware.types';
import { getTenantRepository } from '../utils/tenantRepository';
import { getIsolationLevel } from '../utils/isolationHelper';

export class RoleService {
  private roleRepository: RoleRepository;
  private templateService: RoleTemplateService;

  constructor() {
    this.roleRepository = new RoleRepository();
    this.templateService = new RoleTemplateService();
  }

  async createRole(data: CreateRoleDto, req?: TenantRequest): Promise<Role> {
    // Check if name already exists
    const existing = await this.roleRepository.findByName(data.name, data.clientId, req);
    if (existing) {
      throw new Error('Role with this name already exists');
    }

    const isolationLevel = await getIsolationLevel(req, data.clientId);
    const roleData: any = {
      name: data.name,
      description: data.description,
      parentRoleId: data.parentRoleId,
      templateId: data.templateId,
    };
    if (isolationLevel !== 'database') {
      roleData.clientId = data.clientId;
    }

    const role = await this.roleRepository.create(roleData, req);

    // If template is provided, apply template permissions
    if (data.templateId) {
      await this.templateService.applyTemplateToRole(role.id, data.templateId, data.clientId, req);
    }
    // Otherwise, assign permissions directly
    else if (data.permissionIds && data.permissionIds.length > 0) {
      await this.assignPermissions(role.id, data.clientId, data.permissionIds, req);
    }

    const savedRole = await this.roleRepository.findById(role.id, data.clientId, req);
    if (!savedRole) {
      throw new Error('Failed to create role');
    }

    // Trigger webhook
    await triggerWebhook(
      data.clientId,
      'role.created',
      {
        id: savedRole.id,
        name: savedRole.name,
        description: savedRole.description,
        clientId: savedRole.clientId,
        createdAt: savedRole.createdAt,
      },
      undefined,
      req
    );

    return savedRole;
  }

  async updateRole(id: string, clientId: string, data: UpdateRoleDto, req?: TenantRequest): Promise<Role> {
    const role = await this.roleRepository.findById(id, clientId, req);
    if (!role) {
      throw new Error('Role not found');
    }

    // Check name uniqueness if changing name
    if (data.name && data.name !== role.name) {
      const existing = await this.roleRepository.findByName(data.name, clientId, req);
      if (existing) {
        throw new Error('Role with this name already exists');
      }
    }

    await this.roleRepository.update(id, clientId, {
      name: data.name,
      description: data.description,
      parentRoleId: data.parentRoleId,
      templateId: data.templateId,
      isActive: data.isActive,
    }, req);

    // If template is provided, apply template permissions
    if (data.templateId !== undefined) {
      if (data.templateId) {
        await this.templateService.applyTemplateToRole(id, data.templateId, clientId, req);
      } else {
        // Template removed, clear permissions if no direct permissions provided
        if (!data.permissionIds) {
          const rolePermissionRepository = req ? getTenantRepository(req, RolePermission) : AppDataSource.getRepository(RolePermission);
          await rolePermissionRepository.delete({ roleId: id });
        }
      }
    }

    // Update permissions if provided (only if no template)
    if (data.permissionIds && !data.templateId) {
      await this.assignPermissions(id, clientId, data.permissionIds, req);
    }

    const updatedRole = await this.roleRepository.findById(id, clientId, req);
    if (!updatedRole) {
      throw new Error('Role not found after update');
    }

    // Trigger webhook
    const changes: Record<string, unknown> = {};
    if (data.name !== undefined) changes.name = updatedRole.name;
    if (data.description !== undefined) changes.description = updatedRole.description;
    if (data.isActive !== undefined) changes.isActive = updatedRole.isActive;
    if (data.permissionIds || data.templateId !== undefined) {
      changes.permissionsUpdated = true;
    }

    await triggerWebhook(
      clientId,
      'role.updated',
      {
        id: updatedRole.id,
        ...changes,
        updatedAt: updatedRole.updatedAt,
      },
      undefined,
      req
    );

    // Trigger permissions updated event if permissions changed
    if (data.permissionIds || data.templateId !== undefined) {
      await triggerWebhook(
        clientId,
        'role.permissions.updated',
        {
          id: updatedRole.id,
          name: updatedRole.name,
        },
        undefined,
        req
      );
    }

    return updatedRole;
  }

  async getRole(id: string, clientId: string, req?: TenantRequest): Promise<Role | null> {
    return this.roleRepository.findById(id, clientId, req);
  }

  async listRoles(clientId: string, req?: TenantRequest): Promise<Role[]> {
    return this.roleRepository.findAll(clientId, req);
  }

  async deleteRole(id: string, clientId: string, req?: TenantRequest): Promise<void> {
    const role = await this.roleRepository.findById(id, clientId, req);
    if (!role) {
      throw new Error('Role not found');
    }

    // Check if role is in use
    const userRepository = req ? getTenantRepository(req, User) : AppDataSource.getRepository(User);
    const isolationLevel = await getIsolationLevel(req, clientId);
    
    const where: any = { roleId: id };
    if (isolationLevel !== 'database' && clientId) {
      where.clientId = clientId;
    }
    
    const usersWithRole = await userRepository.count({ where });

    if (usersWithRole > 0) {
      throw new Error('Cannot delete role that is assigned to users');
    }

    // Trigger webhook before deletion
    await triggerWebhook(
      clientId,
      'role.deleted',
      {
        id: role.id,
        name: role.name,
      },
      undefined,
      req
    );

    await this.roleRepository.delete(id, clientId, req);
  }

  private async assignPermissions(
    roleId: string,
    clientId: string,
    permissionIds: string[],
    req?: TenantRequest
  ): Promise<void> {
    const rolePermissionRepository = req ? getTenantRepository(req, RolePermission) : AppDataSource.getRepository(RolePermission);
    const permissionRepository = req ? getTenantRepository(req, Permission) : AppDataSource.getRepository(Permission);

    // Remove existing permissions
    await rolePermissionRepository.delete({ roleId });

    // Add new permissions
    for (const permissionId of permissionIds) {
      const permission = await permissionRepository.findOne({
        where: { id: permissionId },
      });

      if (permission) {
        const rolePermission = rolePermissionRepository.create({
          roleId,
          permissionId,
        });
        await rolePermissionRepository.save(rolePermission);
      }
    }
  }
}

