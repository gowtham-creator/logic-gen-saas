import { Repository, IsNull } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Role } from '../entities/Role';
import { TenantRequest } from '../types/middleware.types';
import { getTenantRepository } from '../utils/tenantRepository';

export class RoleRepository {
  private getRepository(req?: TenantRequest): Repository<Role> {
    return req ? getTenantRepository(req, Role) : AppDataSource.getRepository(Role);
  }

  async findById(id: string, clientId: string, req?: TenantRequest): Promise<Role | null> {
    const repository = this.getRepository(req);
    
    // Get isolation level to determine if we need to filter by clientId
    let isolationLevel: string = 'shared';
    if (req?.tenantDataSource && clientId) {
      const { DatabaseConfigService } = await import('../services/DatabaseConfigService');
      const dbConfigService = new DatabaseConfigService();
      const config = await dbConfigService.getClientDatabaseConfig(clientId);
      isolationLevel = config.isolationLevel;
    }

    const where: any = { id, deletedAt: IsNull() };
    if (isolationLevel !== 'database' && clientId) {
      where.clientId = clientId;
    }

    // For database-per-tenant, don't try to load client relation
    const relations = isolationLevel === 'database' 
      ? ['rolePermissions', 'rolePermissions.permission', 'parentRole']
      : ['rolePermissions', 'rolePermissions.permission', 'parentRole', 'client'];
    
    return repository.findOne({
      where,
      relations,
    });
  }

  async findAll(clientId: string, req?: TenantRequest): Promise<Role[]> {
    const repository = this.getRepository(req);
    
    // Get isolation level to determine if we need to filter by clientId
    let isolationLevel: string = 'shared';
    if (req?.tenantDataSource && clientId) {
      const { DatabaseConfigService } = await import('../services/DatabaseConfigService');
      const dbConfigService = new DatabaseConfigService();
      const config = await dbConfigService.getClientDatabaseConfig(clientId);
      isolationLevel = config.isolationLevel;
    }

    const where: any = { isActive: true, deletedAt: IsNull() };
    if (isolationLevel !== 'database' && clientId) {
      where.clientId = clientId;
    }

    const relations = isolationLevel === 'database'
      ? ['rolePermissions', 'rolePermissions.permission']
      : ['rolePermissions', 'rolePermissions.permission', 'client'];
    
    return repository.find({
      where,
      relations,
      order: { createdAt: 'DESC' },
    });
  }

  async create(data: Partial<Role>, req?: TenantRequest): Promise<Role> {
    const repository = this.getRepository(req);
    const role = repository.create(data);
    return repository.save(role);
  }

  async update(id: string, clientId: string, data: Partial<Role>, req?: TenantRequest): Promise<Role> {
    const repository = this.getRepository(req);
    
    // Get isolation level to determine if we need to filter by clientId
    let isolationLevel: string = 'shared';
    if (req?.tenantDataSource && clientId) {
      const { DatabaseConfigService } = await import('../services/DatabaseConfigService');
      const dbConfigService = new DatabaseConfigService();
      const config = await dbConfigService.getClientDatabaseConfig(clientId);
      isolationLevel = config.isolationLevel;
    }

    // Exclude relations from update data
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { client, parentRole, template, rolePermissions, ...updateData } = data;
    
    const where: any = { id, deletedAt: IsNull() };
    if (isolationLevel !== 'database' && clientId) {
      where.clientId = clientId;
    }
    
    await repository.update(where, updateData);
    const updated = await this.findById(id, clientId, req);
    if (!updated) {
      throw new Error('Role not found after update');
    }
    return updated;
  }

  async delete(id: string, clientId: string, req?: TenantRequest): Promise<void> {
    const repository = this.getRepository(req);
    
    // Get isolation level to determine if we need to filter by clientId
    let isolationLevel: string = 'shared';
    if (req?.tenantDataSource && clientId) {
      const { DatabaseConfigService } = await import('../services/DatabaseConfigService');
      const dbConfigService = new DatabaseConfigService();
      const config = await dbConfigService.getClientDatabaseConfig(clientId);
      isolationLevel = config.isolationLevel;
    }

    const where: any = { id };
    if (isolationLevel !== 'database' && clientId) {
      where.clientId = clientId;
    }
    
    // Soft delete (set deletedAt)
    await repository.update(where, { deletedAt: new Date() });
  }

  async findByName(name: string, clientId: string, req?: TenantRequest): Promise<Role | null> {
    const repository = this.getRepository(req);
    
    // Get isolation level to determine if we need to filter by clientId
    let isolationLevel: string = 'shared';
    if (req?.tenantDataSource && clientId) {
      const { DatabaseConfigService } = await import('../services/DatabaseConfigService');
      const dbConfigService = new DatabaseConfigService();
      const config = await dbConfigService.getClientDatabaseConfig(clientId);
      isolationLevel = config.isolationLevel;
    }

    const where: any = { name, deletedAt: IsNull() };
    if (isolationLevel !== 'database' && clientId) {
      where.clientId = clientId;
    }
    
    return repository.findOne({ where });
  }
}

