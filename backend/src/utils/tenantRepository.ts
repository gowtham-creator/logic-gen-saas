import { DataSource, EntityTarget, Repository, ObjectLiteral } from 'typeorm';
import { AppDataSource } from '../config/database';
import { TenantRequest } from '../types/middleware.types';

/**
 * Get repository from tenant DataSource if available, otherwise use shared AppDataSource
 * This enables services to work with tenant-specific databases/schemas
 * 
 * @param req - Request object (should have tenantDataSource if middleware ran)
 * @param entity - Entity class
 * @returns Repository instance
 */
export function getTenantRepository<T extends ObjectLiteral>(
  req: TenantRequest,
  entity: EntityTarget<T>
): Repository<T> {
  // Use tenant DataSource if available (for schema/database isolation)
  // Otherwise fall back to shared AppDataSource
  const dataSource = req.tenantDataSource || AppDataSource;
  return dataSource.getRepository(entity);
}

/**
 * Get DataSource from request (tenant-specific or shared)
 */
export function getTenantDataSource(req: TenantRequest): DataSource {
  return req.tenantDataSource || AppDataSource;
}

