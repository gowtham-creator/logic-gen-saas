import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { Role } from '../entities/Role';
import { Permission } from '../entities/Permission';
import { RolePermission } from '../entities/RolePermission';
import { TenantRequest } from '../types/middleware.types';
import { getTenantRepository, getTenantDataSource } from '../utils/tenantRepository';
import { QueryRunner } from 'typeorm';

export class PermissionService {
  /**
   * Check if user has permission for a resource/action/element
   */
  async checkPermission(
    userId: string,
    clientId: string,
    resource: string,
    action: string,
    elementId?: string,
    scope?: string,
    req?: TenantRequest
  ): Promise<boolean> {
    const dataSource = req ? getTenantDataSource(req) : AppDataSource;
    const userRepository = req ? getTenantRepository(req, User) : AppDataSource.getRepository(User);
    
    // Determine isolation level if needed
    let isolationLevel: string | undefined;
    let actualRepository = userRepository;
    
    if (req?.tenantDataSource && clientId) {
      const { DatabaseConfigService } = await import('./DatabaseConfigService');
      const dbConfigService = new DatabaseConfigService();
      const config = await dbConfigService.getClientDatabaseConfig(clientId);
      
      isolationLevel = config.isolationLevel;
    }
    
    try {
      const where: any = {
        id: userId,
        isActive: true,
      };
      
      // Use query builder to explicitly select only essential role columns
      const queryBuilder = actualRepository
        .createQueryBuilder('user')
        .where('user.id = :userId', { userId })
        .andWhere('user.isActive = :isActive', { isActive: true });
      
      // For database-per-tenant, clientId is not in the where clause
      if (isolationLevel !== 'database' && clientId) {
        queryBuilder.andWhere('user.clientId = :clientId', { clientId });
      }
      
      // For database-per-tenant, don't load 'client' relation
      if (isolationLevel !== 'database') {
        queryBuilder.leftJoinAndSelect('user.client', 'client');
      }
      
      // Explicitly select only essential role columns (excluding optional columns that may not exist)
      queryBuilder
        .leftJoin('user.role', 'role')
        .addSelect([
          'role.id',
          'role.name',
          'role.description',
          'role.clientId',
          'role.createdAt',
          'role.updatedAt'
        ]);
      
      const user = await queryBuilder.getOne();


      if (!user || !user.role) {
        return false;
      }

      // Query permissions directly using raw SQL join to avoid RolePermission entity mapping issues
      // This bypasses the need for rolePermissions.id column
      // Ensure DataSource is initialized
      if (!dataSource.isInitialized) {
        throw new Error('DataSource is not initialized');
      }
      
      // Verify Permission entity is registered in DataSource
      const entityMetadata = dataSource.entityMetadatas.find(meta => meta.target === Permission);
      if (!entityMetadata) {
        throw new Error(`Permission entity not found in DataSource metadata. Available entities: ${dataSource.entityMetadatas.map(m => m.name).join(', ')}`);
      }
      
      const permissionRepository = dataSource.getRepository(Permission);
      
      // Use raw join through role_permissions table without requiring the id column
      const permissions = await permissionRepository
        .createQueryBuilder('permission')
        .innerJoin('role_permissions', 'rp', 'rp."permissionId" = permission.id')
        .where('rp."roleId" = :roleId', { roleId: user.role.id })
        .getMany();
      
      // Debug logging
      console.log('[PermissionService.checkPermission] Checking permission:', {
        userId,
        roleId: user.role.id,
        resource,
        action,
        elementId,
        scope,
        permissionsFound: permissions.length,
        permissions: permissions.map((p: Permission) => ({ resource: p.resource, action: p.action, elementId: p.elementId, scope: p.scope }))
      });

      // Check direct permissions
      const hasDirectPermission = permissions.some((perm: Permission) => {
        const resourceMatch = perm.resource === resource || perm.resource === '*';
        const actionMatch = perm.action === action || perm.action === '*';
        const elementMatch = !elementId || !perm.elementId || perm.elementId === elementId;
        const scopeMatch = !scope || !perm.scope || perm.scope === scope || perm.scope === '*';

        const matches = resourceMatch && actionMatch && elementMatch && scopeMatch;
        if (matches) {
          console.log('[PermissionService.checkPermission] Permission matched:', {
            permResource: perm.resource,
            permAction: perm.action,
            permElementId: perm.elementId,
            permScope: perm.scope
          });
        }
        return matches;
      });

      if (hasDirectPermission) {
        return true;
      }

      // Check inherited permissions (if parent role exists)
      // Note: parentRoleId may not exist in database, so we check it safely
      if ((user.role as any).parentRoleId) {
        return this.checkInheritedPermissions(
          (user.role as any).parentRoleId,
          clientId,
          resource,
          action,
          elementId,
          scope,
          req
        );
      }

      return false;
    } catch (error) {
      throw error;
    }
  }

  private async checkInheritedPermissions(
    roleId: string,
    clientId: string,
    resource: string,
    action: string,
    elementId?: string,
    scope?: string,
    req?: TenantRequest
  ): Promise<boolean> {
    const dataSource = req ? getTenantDataSource(req) : AppDataSource;
    const roleRepository = req ? getTenantRepository(req, Role) : AppDataSource.getRepository(Role);
    
    // Determine isolation level if needed
    let isolationLevel: string | undefined;
    let actualRepository = roleRepository;
    
    if (req?.tenantDataSource && clientId) {
      const { DatabaseConfigService } = await import('./DatabaseConfigService');
      const dbConfigService = new DatabaseConfigService();
      const config = await dbConfigService.getClientDatabaseConfig(clientId);
      
      isolationLevel = config.isolationLevel;
    }
    
    try {
      // Use query builder to explicitly select only essential role columns
      const queryBuilder = actualRepository
        .createQueryBuilder('role')
        .where('role.id = :roleId', { roleId });
      
      // For database-per-tenant, clientId is not in the where clause
      if (isolationLevel !== 'database' && clientId) {
        queryBuilder.andWhere('role.clientId = :clientId', { clientId });
      }
      
      // Explicitly select only essential role columns (excluding optional columns that may not exist)
      queryBuilder
        .addSelect([
          'role.id',
          'role.name',
          'role.description',
          'role.clientId',
          'role.createdAt',
          'role.updatedAt'
        ]);
      
      const role = await queryBuilder.getOne();

      if (!role) {
        return false;
      }

      // Query permissions directly using raw SQL join to avoid RolePermission entity mapping issues
      // Ensure DataSource is initialized
      if (!dataSource.isInitialized) {
        throw new Error('DataSource is not initialized');
      }
      
      // Verify Permission entity is registered in DataSource
      const entityMetadata = dataSource.entityMetadatas.find(meta => meta.target === Permission);
      if (!entityMetadata) {
        throw new Error(`Permission entity not found in DataSource metadata. Available entities: ${dataSource.entityMetadatas.map(m => m.name).join(', ')}`);
      }
      
      const permissionRepository = dataSource.getRepository(Permission);
      
      // Use raw join through role_permissions table without requiring the id column
      const permissions = await permissionRepository
        .createQueryBuilder('permission')
        .innerJoin('role_permissions', 'rp', 'rp."permissionId" = permission.id')
        .where('rp."roleId" = :roleId', { roleId: role.id })
        .getMany();

      const hasPermission = permissions.some((perm: Permission) => {
        const resourceMatch = perm.resource === resource || perm.resource === '*';
        const actionMatch = perm.action === action || perm.action === '*';
        const elementMatch = !elementId || !perm.elementId || perm.elementId === elementId;
        const scopeMatch = !scope || !perm.scope || perm.scope === scope || perm.scope === '*';

        return resourceMatch && actionMatch && elementMatch && scopeMatch;
      });

      if (hasPermission) {
        return true;
      }

      // Recursively check parent role
      // Note: parentRoleId may not exist in database, so we check it safely
      if ((role as any).parentRoleId) {
        return this.checkInheritedPermissions(
          (role as any).parentRoleId,
          clientId,
          resource,
          action,
          elementId,
          scope,
          req
        );
      }

      return false;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all permissions for a user (for frontend)
   */
  async getUserPermissions(userId: string, clientId: string, req?: TenantRequest): Promise<Permission[]> {
    const dataSource = req ? getTenantDataSource(req) : AppDataSource;
    const userRepository = req ? getTenantRepository(req, User) : AppDataSource.getRepository(User);
    
    // Determine isolation level if needed
    let isolationLevel: string | undefined;
    let actualRepository = userRepository;
    
    if (req?.tenantDataSource && clientId) {
      const { DatabaseConfigService } = await import('./DatabaseConfigService');
      const dbConfigService = new DatabaseConfigService();
      const config = await dbConfigService.getClientDatabaseConfig(clientId);
      
      isolationLevel = config.isolationLevel;
    }
    
    try {
      // Use query builder to explicitly select only essential role columns
      const queryBuilder = actualRepository
        .createQueryBuilder('user')
        .where('user.id = :userId', { userId })
        .andWhere('user.isActive = :isActive', { isActive: true });
      
      // For database-per-tenant, clientId is not in the where clause
      if (isolationLevel !== 'database' && clientId) {
        queryBuilder.andWhere('user.clientId = :clientId', { clientId });
      }
      
      // For database-per-tenant, don't load 'client' relation
      if (isolationLevel !== 'database') {
        queryBuilder.leftJoinAndSelect('user.client', 'client');
      }
      
      // Explicitly select only essential role columns (excluding optional columns that may not exist)
      queryBuilder
        .leftJoin('user.role', 'role')
        .addSelect([
          'role.id',
          'role.name',
          'role.description',
          'role.clientId',
          'role.createdAt',
          'role.updatedAt'
        ]);
      
      const user = await queryBuilder.getOne();


      if (!user || !user.role) {
        return [];
      }

      // Query permissions directly using raw SQL join to avoid RolePermission entity mapping issues
      // Use the already imported Permission entity
      // Ensure DataSource is initialized
      if (!dataSource.isInitialized) {
        throw new Error('DataSource is not initialized');
      }
      
      // Verify Permission entity is registered in DataSource
      const entityMetadata = dataSource.entityMetadatas.find(meta => meta.target === Permission);
      if (!entityMetadata) {
        throw new Error(`Permission entity not found in DataSource metadata. Available entities: ${dataSource.entityMetadatas.map(m => m.name).join(', ')}`);
      }
      
      const permissionRepository = dataSource.getRepository(Permission);
      
      // Use raw join through role_permissions table without requiring the id column
      const permissions = await permissionRepository
        .createQueryBuilder('permission')
        .innerJoin('role_permissions', 'rp', 'rp."permissionId" = permission.id')
        .where('rp."roleId" = :roleId', { roleId: user.role.id })
        .getMany();

      // Include inherited permissions
      // Note: parentRoleId may not exist in database, so we check it safely
      if ((user.role as any).parentRoleId) {
        const inherited = await this.getInheritedPermissions((user.role as any).parentRoleId, clientId, req);
        permissions.push(...inherited);
      }

      // Deduplicate
      const uniquePermissions = Array.from(
        new Map(permissions.map((p) => [p.id, p])).values()
      );

      return uniquePermissions;
    } catch (error) {
      throw error;
    }
  }

  private async getInheritedPermissions(
    roleId: string,
    clientId: string,
    req?: TenantRequest
  ): Promise<Permission[]> {
    const dataSource = req ? getTenantDataSource(req) : AppDataSource;
    const roleRepository = req ? getTenantRepository(req, Role) : AppDataSource.getRepository(Role);
    
    // Determine isolation level if needed
    let isolationLevel: string | undefined;
    let actualRepository = roleRepository;
    
    if (req?.tenantDataSource && clientId) {
      const { DatabaseConfigService } = await import('./DatabaseConfigService');
      const dbConfigService = new DatabaseConfigService();
      const config = await dbConfigService.getClientDatabaseConfig(clientId);
      
      isolationLevel = config.isolationLevel;
    }
    
    try {
      // Use query builder to explicitly select only essential role columns
      const queryBuilder = actualRepository
        .createQueryBuilder('role')
        .where('role.id = :roleId', { roleId });
      
      // For database-per-tenant, clientId is not in the where clause
      if (isolationLevel !== 'database' && clientId) {
        queryBuilder.andWhere('role.clientId = :clientId', { clientId });
      }
      
      // Explicitly select only essential role columns (excluding optional columns that may not exist)
      queryBuilder
        .addSelect([
          'role.id',
          'role.name',
          'role.description',
          'role.clientId',
          'role.createdAt',
          'role.updatedAt'
        ]);
      
      const role = await queryBuilder.getOne();


      if (!role) {
        return [];
      }

      // Query permissions directly using raw SQL join to avoid RolePermission entity mapping issues
      // Ensure DataSource is initialized
      if (!dataSource.isInitialized) {
        throw new Error('DataSource is not initialized');
      }
      
      // Verify Permission entity is registered in DataSource
      const entityMetadata = dataSource.entityMetadatas.find(meta => meta.target === Permission);
      if (!entityMetadata) {
        throw new Error(`Permission entity not found in DataSource metadata. Available entities: ${dataSource.entityMetadatas.map(m => m.name).join(', ')}`);
      }
      
      const permissionRepository = dataSource.getRepository(Permission);
      
      // Use raw join through role_permissions table without requiring the id column
      const permissions = await permissionRepository
        .createQueryBuilder('permission')
        .innerJoin('role_permissions', 'rp', 'rp."permissionId" = permission.id')
        .where('rp."roleId" = :roleId', { roleId: role.id })
        .getMany();

      // Note: parentRoleId may not exist in database, so we check it safely
      if ((role as any).parentRoleId) {
        const inherited = await this.getInheritedPermissions((role as any).parentRoleId, clientId, req);
        permissions.push(...inherited);
      }

      return permissions;
    } catch (error) {
      throw error;
    }
  }
}

