import { Repository, DataSource } from 'typeorm';
import { AppDataSource } from '../config/database';
import { AuditLog } from '../entities/AuditLog';
import { User } from '../entities/User';
import { CreateAuditLogDto } from '../types/audit.types';
import { getTenantRepository, getTenantDataSource } from '../utils/tenantRepository';
import { TenantRequest } from '../types/middleware.types';
import { getIsolationLevel } from '../utils/isolationHelper';

export class AuditService {
  private getRepository(req?: TenantRequest): Repository<AuditLog> {
    if (req) {
      return getTenantRepository(req, AuditLog);
    }
    return AppDataSource.getRepository(AuditLog);
  }

  private getDataSource(req?: TenantRequest): DataSource {
    if (req) {
      return getTenantDataSource(req);
    }
    return AppDataSource;
  }

  async log(data: CreateAuditLogDto, req?: TenantRequest): Promise<AuditLog> {
    const repository = this.getRepository(req);
    const isolationLevel = data.clientId ? await getIsolationLevel(req, data.clientId) : 'shared';
    
    // Verify userId exists in the tenant database before setting it
    let validUserId: string | undefined = data.userId;
    if (data.userId && req) {
      try {
        const userRepository = getTenantRepository(req, User);
        const userExists = await userRepository.findOne({
          where: { id: data.userId },
          select: ['id'],
        });
        if (!userExists) {
          // User doesn't exist in this database, don't set userId
          validUserId = undefined;
        }
      } catch (error) {
        // If we can't verify, don't set userId to avoid foreign key errors
        validUserId = undefined;
      }
    } else if (data.userId && !req) {
      // For shared database, verify user exists
      try {
        const userRepository = AppDataSource.getRepository(User);
        const userExists = await userRepository.findOne({
          where: { id: data.userId },
          select: ['id'],
        });
        if (!userExists) {
          validUserId = undefined;
        }
      } catch (error) {
        validUserId = undefined;
      }
    }
    
    const logData: any = {
      userId: validUserId,
      action: data.action,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      metadata: data.metadata,
    };
    
    // Only set clientId for shared isolation
    if (isolationLevel !== 'database' && data.clientId) {
      logData.clientId = data.clientId;
    }
    
    try {
      const log = repository.create(logData);
      const saved = await repository.save(log);
      return Array.isArray(saved) ? saved[0] : saved;
    } catch (error: any) {
      // If foreign key error, retry without userId
      if (error.code === '23503' && validUserId) {
        const logDataWithoutUserId = { ...logData, userId: undefined };
        const log = repository.create(logDataWithoutUserId);
        const saved = await repository.save(log);
        return Array.isArray(saved) ? saved[0] : saved;
      }
      throw error;
    }
  }

  async getLogs(
    clientId?: string,
    filters?: {
      userId?: string;
      action?: string;
      resourceType?: string;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    },
    req?: TenantRequest
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const repository = this.getRepository(req);
    const isolationLevel = clientId ? await getIsolationLevel(req, clientId) : 'shared';
    const query = repository.createQueryBuilder('audit_log');
    
    // Only filter by clientId for shared isolation
    if (clientId && isolationLevel !== 'database') {
      query.where('audit_log.clientId = :clientId', { clientId });
    }

    if (filters?.userId) {
      query.andWhere('audit_log.userId = :userId', { userId: filters.userId });
    }

    if (filters?.action) {
      query.andWhere('audit_log.action = :action', { action: filters.action });
    }

    if (filters?.resourceType) {
      query.andWhere('audit_log.resourceType = :resourceType', { resourceType: filters.resourceType });
    }

    if (filters?.startDate) {
      query.andWhere('audit_log.createdAt >= :startDate', { startDate: filters.startDate });
    }

    if (filters?.endDate) {
      query.andWhere('audit_log.createdAt <= :endDate', { endDate: filters.endDate });
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    // Join with user (exists in both shared and tenant DBs)
    query.leftJoinAndSelect('audit_log.user', 'user');
    
    // Only join with client for shared isolation (clients table doesn't exist in tenant DBs)
    if (isolationLevel !== 'database') {
      query.leftJoinAndSelect('audit_log.client', 'client');
    }
    
    query
      .orderBy('audit_log.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [logs, total] = await query.getManyAndCount();
    return { logs, total };
  }

  async getLogById(id: string, clientId?: string, req?: TenantRequest): Promise<AuditLog | null> {
    const repository = this.getRepository(req);
    const isolationLevel = clientId ? await getIsolationLevel(req, clientId) : 'shared';
    const query = repository
      .createQueryBuilder('audit_log')
      .leftJoinAndSelect('audit_log.user', 'user')
      .where('audit_log.id = :id', { id });

    // Only join with client for shared isolation
    if (isolationLevel !== 'database') {
      query.leftJoinAndSelect('audit_log.client', 'client');
    }

    // Only filter by clientId for shared isolation
    if (clientId && isolationLevel !== 'database') {
      query.andWhere('audit_log.clientId = :clientId', { clientId });
    }

    return query.getOne();
  }
}
