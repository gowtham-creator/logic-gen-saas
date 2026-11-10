import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { UserDevice } from '../entities/UserDevice';
import { AuthenticatedRequest, JWTPayload, TenantRequest } from '../types/middleware.types';
import { getTenantRepository, getTenantDataSource } from '../utils/tenantRepository';
import { QueryRunner } from 'typeorm';
import { TokenBlacklistService } from '../services/TokenBlacklistService';
import { getSecurityMonitoringService, SecurityEventType } from '../services/SecurityMonitoringService';
import { AUTH_CONSTANTS } from '../constants/auth';
import { logger } from '../utils/logger';
import { SECURITY_CONSTANTS } from '../constants/security';
// Re-export for backward compatibility
export { AuthenticatedRequest, JWTPayload };

// Initialize token blacklist service (singleton)
const blacklistService = new TokenBlacklistService();

/**
 * Middleware to authenticate JWT tokens
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    logger.info('[Auth] started', { path: req.path, method: req.method });
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith(AUTH_CONSTANTS.BEARER_PREFIX)) {
      logger.warn('[Auth] rejected: no or invalid Authorization header', { path: req.path, method: req.method });
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'No token provided' },
      });
      return;
    }

    const token = authHeader.substring(AUTH_CONSTANTS.BEARER_PREFIX_LENGTH);
    
    // Check if token is blacklisted
    if (await blacklistService.isTokenBlacklisted(token)) {
      // Log security event
      const securityMonitoring = getSecurityMonitoringService();
      securityMonitoring.log({
        type: SecurityEventType.TOKEN_BLACKLISTED,
        severity: 'medium',
        message: 'Attempted use of blacklisted token',
        metadata: {
          clientId: req.clientId,
          subdomain: (req as any).tenant?.subdomain || undefined,
          ip: req.ip,
          path: req.path,
          method: req.method,
          userAgent: req.get('user-agent'),
        },
        timestamp: new Date(),
      });
      
      res.status(401).json({
        success: false,
        error: { code: 'TOKEN_REVOKED', message: 'Token has been revoked' },
      });
      return;
    }
    
    let decoded: JWTPayload;

    try {
      decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
    } catch {
      logger.warn('[Auth] rejected: invalid or expired token', { path: req.path, method: req.method });
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
      });
      return;
    }

    // Check if user's tokens are blacklisted (e.g., after password change, account lockout, or deactivation)
    const isUserBlacklisted = await blacklistService.isUserBlacklisted(decoded.userId);
    if (isUserBlacklisted) {
      // Log security event
      const securityMonitoring = getSecurityMonitoringService();
      securityMonitoring.log({
        type: SecurityEventType.TOKEN_BLACKLISTED,
        severity: 'medium',
        message: 'Attempted use of token for blacklisted user',
        metadata: {
          userId: decoded.userId,
          clientId: req.clientId || decoded.clientId,
          subdomain: (req as any).tenant?.subdomain || undefined,
          ip: req.ip,
          path: req.path,
          method: req.method,
          userAgent: req.get('user-agent'),
        },
        timestamp: new Date(),
      });
      
      logger.warn('Blacklisted token attempt', {
        userId: decoded.userId,
        path: req.path,
        method: req.method,
      });
      
      res.status(401).json({
        success: false,
        error: { code: 'TOKEN_REVOKED', message: 'User tokens have been revoked' },
      });
      return;
    }

    // Use tenant DataSource if available (set by tenantDataSourceMiddleware)
    const repository = getTenantRepository(req as TenantRequest, User);
    
    // Determine isolation level and schema if needed
    let isolationLevel: string | undefined;
    let queryRunner: QueryRunner | undefined;
    const actualRepository = repository;
    
    if (req.tenantDataSource && decoded.clientId) {
      const { DatabaseConfigService } = await import('../services/DatabaseConfigService');
      const dbConfigService = new DatabaseConfigService();
      const config = await dbConfigService.getClientDatabaseConfig(decoded.clientId);
      
      isolationLevel = config.isolationLevel;
      
     
    }
    
    try {
      // Use query builder to avoid TypeORM trying to auto-select nested relations
      const queryBuilder = actualRepository
        .createQueryBuilder('user')
        .where('user.id = :userId', { userId: decoded.userId })
        .andWhere('user.isActive = :isActive', { isActive: true });
      
      // For database-per-tenant, clientId is not in the where clause
      // All users (including super admin and developer) must have clientId
      if (isolationLevel !== 'database' && decoded.clientId) {
        queryBuilder.andWhere('user.clientId = :clientId', { clientId: decoded.clientId });
      }
      
      // Add isSuperAdmin and isDeveloper to select
      queryBuilder.addSelect('user.isSuperAdmin');
      queryBuilder.addSelect('user.isDeveloper');
      
      // For database-per-tenant, don't load 'client' relation (it doesn't exist in tenant DB)
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

      if (queryRunner && queryRunner.isTransactionActive) {
        await queryRunner.commitTransaction();
      }

      if (!user) {
        logger.warn('[Auth] rejected: user not found', { path: req.path, userId: decoded.userId, clientId: decoded.clientId });
        res.status(401).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
        return;
      }


      // Verify tenant matches
      // For database-per-tenant, user.clientId may be null, so use decoded.clientId
      const userClientId = user.clientId || decoded.clientId;
      if (req.clientId && userClientId && userClientId !== req.clientId) {
        logger.warn('[Auth] rejected: tenant mismatch', { path: req.path, reqClientId: req.clientId, userClientId });
        res.status(403).json({
          success: false,
          error: { code: 'TENANT_MISMATCH', message: 'Tenant mismatch' },
        });
        return;
      }

      // All users (including super admin and developer) must have clientId
      if (!req.clientId && !userClientId) {
        res.status(400).json({
          success: false,
          error: { code: 'CLIENT_ID_REQUIRED', message: 'Client ID is required' },
        });
        return;
      }

      if (!req.clientId) {
        req.clientId = userClientId;
      }

      // Check if the device making the request is active
      // This allows us to revoke specific devices without blacklisting all tokens
      const clientDeviceId = req.headers['x-client-device-id'] as string;
      if (clientDeviceId && clientDeviceId !== 'unknown') {
        try {
          const deviceRepository = getTenantRepository(req as TenantRequest, UserDevice);
          
          const device = await deviceRepository.findOne({
            where: {
              userId: decoded.userId,
              clientDeviceId: clientDeviceId,
            },
          });

          // If device exists and is inactive, reject the request
          if (device && !device.isActive) {
            logger.warn('Attempted access from revoked device', {
              userId: decoded.userId,
              deviceId: device.id,
              clientDeviceId,
              path: req.path,
            });

            res.status(401).json({
              success: false,
              error: { code: 'TOKEN_REVOKED', message: 'This device has been revoked. Please log in again.' },
            });
            return;
          }
        } catch (deviceCheckError) {
          // If device check fails, log but don't block (graceful degradation)
          logger.warn('Failed to check device status in auth middleware', {
            error: deviceCheckError instanceof Error ? deviceCheckError.message : 'Unknown error',
            errorStack: deviceCheckError instanceof Error ? deviceCheckError.stack : undefined,
            userId: decoded.userId,
            clientDeviceId,
          });
        }
      }

      req.user = user;
      req.userId = user.id;
      logger.info('[Auth] passed', { path: req.path, userId: user.id });
      next();
    } catch (error) {
      if (queryRunner && queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      if (queryRunner) {
        await queryRunner.release();
      }
    }
  } catch (error) {
    next(error);
  }
}

// In-memory store for API key rate limiting (use Redis in production)
const apiKeyRateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Map HTTP method and endpoint to required scope
 * Format: resource:action (e.g., 'users:read', 'users:write')
 */
function getRequiredScope(method: string, path: string): string | null {
  // Extract resource from path (e.g., /api/users -> 'users')
  const pathParts = path.split('/').filter(Boolean);
  if (pathParts.length < 2 || pathParts[0] !== 'api') {
    return null; // Not an API route or invalid format
  }

  const resource = pathParts[1]; // e.g., 'users', 'roles', 'api-keys'
  
  // Map HTTP method to action
  let action: string;
  switch (method.toUpperCase()) {
    case 'GET':
      action = 'read';
      break;
    case 'POST':
      action = 'create';
      break;
    case 'PUT':
    case 'PATCH':
      action = 'update';
      break;
    case 'DELETE':
      action = 'delete';
      break;
    default:
      return null; // Unknown method
  }

  // Special cases
  if (resource === 'auth' || resource === 'api-docs') {
    return null; // Public endpoints, no scope required
  }

  return `${resource}:${action}`;
}

/**
 * Middleware to authenticate API keys and enforce rate limiting and scopes
 */
export async function apiKeyMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: { code: 'NO_API_KEY', message: 'API key required' },
      });
      return;
    }

    const { ApiKeyService } = await import('../services/ApiKeyService');
    const apiKeyService = new ApiKeyService();
    const keyData = await apiKeyService.validateApiKey(apiKey, req.clientId!);

    if (!keyData) {
      // Log security event
      const securityMonitoring = getSecurityMonitoringService();
      securityMonitoring.log({
        type: SecurityEventType.INVALID_API_KEY,
        severity: 'medium',
        message: 'Invalid API key attempt',
        metadata: {
          clientId: req.clientId,
          subdomain: (req as any).tenant?.subdomain || undefined,
          ip: req.ip,
          path: req.path,
          method: req.method,
          userAgent: req.get('user-agent'),
        },
        timestamp: new Date(),
      });
      
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_API_KEY', message: 'Invalid API key' },
      });
      return;
    }

    const apiKeyEntity = keyData.apiKey;

    // Enforce per-key rate limiting if configured
    if (apiKeyEntity.rateLimitPerMinute > 0) {
      const now = Date.now();
      const key = `api_key:${apiKeyEntity.id}`;
      const limit = apiKeyEntity.rateLimitPerMinute;
      const windowMs = 60 * 1000; // 1 minute

      let rateLimitData = apiKeyRateLimitStore.get(key);
      
      // Reset if window expired
      if (!rateLimitData || now > rateLimitData.resetTime) {
        rateLimitData = { count: 0, resetTime: now + windowMs };
        apiKeyRateLimitStore.set(key, rateLimitData);
      }

      // Check if limit exceeded
      if (rateLimitData.count >= limit) {
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `API key rate limit exceeded. Limit: ${limit} requests per minute.`,
          },
        });
        return;
      }

      // Increment counter
      rateLimitData.count++;
      apiKeyRateLimitStore.set(key, rateLimitData);
    }

    // Enforce endpoint restrictions
    const requestedPath = req.path.split('?')[0]; // Remove query string
    if (!apiKeyService.isEndpointAllowed(apiKeyEntity, requestedPath)) {
      // Log security event
      const securityMonitoring = getSecurityMonitoringService();
      securityMonitoring.log({
        type: SecurityEventType.API_SCOPE_VIOLATION,
        severity: 'medium',
        message: 'API key endpoint restriction violation',
          metadata: {
            apiKeyId: apiKeyEntity.id,
            clientId: req.clientId,
            subdomain: (req as any).tenant?.subdomain || undefined,
            requestedPath,
            ip: req.ip,
            method: req.method,
            userAgent: req.get('user-agent'),
          },
          timestamp: new Date(),
        });
      
      res.status(403).json({
        success: false,
        error: {
          code: 'ENDPOINT_NOT_ALLOWED',
          message: `API key does not have permission to access ${requestedPath}`,
        },
      });
      return;
    }

    // Enforce scope restrictions based on HTTP method and endpoint
    const requiredScope = getRequiredScope(req.method, requestedPath);
    if (requiredScope && !apiKeyService.hasScope(apiKeyEntity, requiredScope)) {
      // Log security event
      const securityMonitoring = getSecurityMonitoringService();
      securityMonitoring.log({
        type: SecurityEventType.API_SCOPE_VIOLATION,
        severity: 'medium',
        message: 'API key scope violation',
        metadata: {
          apiKeyId: apiKeyEntity.id,
          clientId: req.clientId,
          subdomain: (req as any).tenant?.subdomain || undefined,
          requiredScope,
          requestedPath,
          ip: req.ip,
          method: req.method,
          userAgent: req.get('user-agent'),
        },
        timestamp: new Date(),
      });
      
      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_SCOPE',
          message: `API key requires scope '${requiredScope}' to access ${requestedPath}`,
        },
      });
      return;
    }

    // Attach API key info to request
    (req as any).apiKey = keyData;
    next();
  } catch (error) {
    next(error);
  }
}

