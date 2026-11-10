import { Response } from 'express';
import { MoreThan } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Client } from '../entities/Client';
import { User } from '../entities/User';
import { AuditLog } from '../entities/AuditLog';
import { sendSuccess, sendError } from '../utils/response';
import { ERROR_CODES } from '../constants/errors';
import { AuthenticatedRequest } from '../types/middleware.types';
import { getSSOConfigEncryptionService } from '../services/SSOConfigEncryptionService';
import { asParam } from '../utils/params';

export class DeveloperController {
  /**
   * Get all tenants with their statistics
   * Queries each tenant's schema to get accurate stats
   */
  async getAllTenants(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const clientRepository = AppDataSource.getRepository(Client);
      const { getTenantDataSourceManager } = await import('../services/TenantDataSourceManager');
      const { DatabaseConfigService } = await import('../services/DatabaseConfigService');
      const tenantDataSourceManager = getTenantDataSourceManager();
      const dbConfigService = new DatabaseConfigService();

      const clients = await clientRepository.find({
        relations: ['plan'],
        order: { createdAt: 'DESC' },
      });

      // Get statistics for each tenant from their respective schemas
      const tenantsWithStats = await Promise.all(
        clients.map(async (client) => {
          try {
            const tenantDataSource = await tenantDataSourceManager.getDataSource(client.id);
            const userRepository = tenantDataSource.getRepository(User);
            const auditLogRepository = tenantDataSource.getRepository(AuditLog);

            // For database-per-tenant, all users belong to this tenant
            // For shared, filter by clientId
            const config = await dbConfigService.getClientDatabaseConfig(client.id);
            const userWhere = config.isolationLevel === 'database' 
              ? {} 
              : { clientId: client.id };
            const auditLogWhere = config.isolationLevel === 'database' 
              ? {} 
              : { clientId: client.id };

            const [userCount, totalUsers, recentAuditLogs] = await Promise.all([
              userRepository.count({
                where: { ...userWhere, isActive: true },
              }),
              userRepository.count({
                where: userWhere,
              }),
              auditLogRepository.count({
                where: auditLogWhere,
              }),
            ]);

            return {
              id: client.id,
              name: client.name,
              subdomain: client.subdomain,
              isActive: client.isActive,
              allowSuperAdminLogin: client.allowSuperAdminLogin,
              plan: client.plan ? {
                id: client.plan.id,
                name: client.plan.name,
              } : null,
              planExpiresAt: client.planExpiresAt,
              stats: {
                activeUsers: userCount,
                totalUsers,
                recentAuditLogs,
              },
              createdAt: client.createdAt,
              updatedAt: client.updatedAt,
            };
          } catch {
            // If there's an error getting stats for a tenant, return basic info without stats
            return {
              id: client.id,
              name: client.name,
              subdomain: client.subdomain,
              isActive: client.isActive,
              allowSuperAdminLogin: client.allowSuperAdminLogin,
              plan: client.plan ? {
                id: client.plan.id,
                name: client.plan.name,
              } : null,
              planExpiresAt: client.planExpiresAt,
              stats: {
                activeUsers: 0,
                totalUsers: 0,
                recentAuditLogs: 0,
              },
              createdAt: client.createdAt,
              updatedAt: client.updatedAt,
            };
          }
        })
      );

      sendSuccess(res, { tenants: tenantsWithStats });
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  /**
   * Get detailed information about a specific tenant
   */
  async getTenantDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const tenantId = asParam(req.params.tenantId);
      const clientRepository = AppDataSource.getRepository(Client);
      const userRepository = AppDataSource.getRepository(User);
      const auditLogRepository = AppDataSource.getRepository(AuditLog);

      const client = await clientRepository.findOne({
        where: { id: tenantId },
        relations: ['plan', 'storageConfig', 'storageConfig.storageEngine'],
      });

      if (!client) {
        sendError(res, ERROR_CODES.NOT_FOUND, 'Tenant not found', 404);
        return;
      }

      // Get detailed statistics
      const activeUsers = await userRepository.find({
        where: { clientId: client.id, isActive: true },
        relations: ['role'],
        select: ['id', 'email', 'firstName', 'lastName', 'isActive', 'createdAt'],
      });

      const allUsers = await userRepository.count({
        where: { clientId: client.id },
      });

      const recentAuditLogs = await auditLogRepository.find({
        where: { clientId: client.id },
        order: { createdAt: 'DESC' },
        take: 50,
        relations: ['user'],
      });

      const errorLogs = await auditLogRepository.count({
        where: { 
          clientId: client.id,
          // Assuming error logs have specific action patterns
        },
      });

      sendSuccess(res, {
        tenant: {
          id: client.id,
          name: client.name,
          subdomain: client.subdomain,
          isActive: client.isActive,
          allowSuperAdminLogin: client.allowSuperAdminLogin,
          plan: client.plan,
          planExpiresAt: client.planExpiresAt,
          databaseConfig: client.databaseConfig,
          ssoConfig: client.ssoConfig ? getSSOConfigEncryptionService().sanitizeSSOConfig(client.ssoConfig) : undefined,
          storageConfig: client.storageConfig ? (() => {
            const { getStorageConfigEncryptionService } = require('../services/StorageConfigEncryptionService');
            const storageEncryptionService = getStorageConfigEncryptionService();
            return {
              ...client.storageConfig,
              config: storageEncryptionService.sanitizeStorageConfig(
                client.storageConfig.config,
                client.storageConfig.storageEngine?.type || 'local'
              ),
            };
          })() : undefined,
          createdAt: client.createdAt,
          updatedAt: client.updatedAt,
        },
        users: {
          active: activeUsers,
          total: allUsers,
        },
        recentAuditLogs,
        errorLogs,
      });
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  /**
   * Get tenant audit logs for debugging
   */
  async getTenantAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const tenantId = asParam(req.params.tenantId);
      const { page = 1, limit = 100, action, resourceType } = req.query;

      // Get tenant-specific DataSource for the tenant being queried
      const { getTenantDataSourceManager } = await import('../services/TenantDataSourceManager');
      const tenantDataSourceManager = getTenantDataSourceManager();
      const tenantDataSource = await tenantDataSourceManager.getDataSource(tenantId);

      const where: any = { clientId: tenantId };
      if (action) where.action = action;
      if (resourceType) where.resourceType = resourceType;

      const auditLogRepository = tenantDataSource.getRepository(AuditLog);
      const [logs, total] = await auditLogRepository.findAndCount({
        where,
        relations: ['user'],
        order: { createdAt: 'DESC' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      });

      sendSuccess(res, {
        logs,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  /**
   * Get system-wide statistics
   * Aggregates stats from shared schema and all tenant schemas
   */
  async getSystemStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const clientRepository = AppDataSource.getRepository(Client);
      const { getTenantDataSourceManager } = await import('../services/TenantDataSourceManager');
      const { DatabaseConfigService } = await import('../services/DatabaseConfigService');
      const tenantDataSourceManager = getTenantDataSourceManager();
      const dbConfigService = new DatabaseConfigService();

      // Get tenant counts from shared schema (clients table is always in shared)
      const [totalTenants, activeTenants] = await Promise.all([
        clientRepository.count(),
        clientRepository.count({ where: { isActive: true } }),
      ]);

      // Get all clients to aggregate stats from their schemas
      const allClients = await clientRepository.find({
        select: ['id', 'isActive'],
      });

      // Aggregate users and audit logs from all tenant schemas
      let totalUsers = 0;
      let activeUsers = 0;
      let totalAuditLogs = 0;
      let recentErrors = 0;

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Process each client
      for (const client of allClients) {
        try {
          const config = await dbConfigService.getClientDatabaseConfig(client.id);
          const tenantDataSource = await tenantDataSourceManager.getDataSource(client.id);
          
          const userRepository = tenantDataSource.getRepository(User);
          const auditLogRepository = tenantDataSource.getRepository(AuditLog);

          // For database-per-tenant, all users belong to this tenant
          // For shared, filter by clientId
          const userWhere = config.isolationLevel === 'database' 
            ? {} 
            : { clientId: client.id };
          const auditLogWhere = config.isolationLevel === 'database' 
            ? {} 
            : { clientId: client.id };
          
          const [tenantUserCount, tenantActiveUserCount, tenantLogCount, tenantRecentErrors] = await Promise.all([
            userRepository.count({ where: userWhere }),
            userRepository.count({ where: { ...userWhere, isActive: true } }),
            auditLogRepository.count({ where: auditLogWhere }),
            auditLogRepository.count({
              where: {
                ...auditLogWhere,
                createdAt: MoreThan(twentyFourHoursAgo),
              },
            }),
          ]);

          totalUsers += tenantUserCount;
          activeUsers += tenantActiveUserCount;
          totalAuditLogs += tenantLogCount;
          recentErrors += tenantRecentErrors;
        } catch {
          // Continue with other tenants on error
        }
      }

      sendSuccess(res, {
        tenants: {
          total: totalTenants,
          active: activeTenants,
          inactive: totalTenants - activeTenants,
        },
        users: {
          total: totalUsers,
          active: activeUsers,
          inactive: totalUsers - activeUsers,
        },
        auditLogs: {
          total: totalAuditLogs,
          recentErrors,
        },
      });
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }
}

