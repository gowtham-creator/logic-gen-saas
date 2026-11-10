import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { Client } from '../entities/Client';
import { SuperAdmin } from '../entities/SuperAdmin';
import { AuthenticatedRequest, SuperAdminAuthenticatedRequest, JWTPayload, SuperAdminJWTPayload } from '../types/middleware.types';
import { logger } from '../utils/logger';
import { AUTH_CONSTANTS } from '../constants/auth';

/**
 * Combined middleware that accepts both regular user tokens and super admin tokens
 * Tries super admin auth first, then falls back to regular user auth
 */
export async function combinedAuthMiddleware(
  req: AuthenticatedRequest | SuperAdminAuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith(AUTH_CONSTANTS.BEARER_PREFIX)) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'No token provided' },
      });
      return;
    }

    const token = authHeader.substring(AUTH_CONSTANTS.BEARER_PREFIX_LENGTH);
    
    // Try to decode the token to check its type
    let decoded: any;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (error) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
      });
      return;
    }

    // Regular user token (super admin now uses regular tokens)
    const userPayload = decoded as JWTPayload;
    const userRepository = AppDataSource.getRepository(User);
    // Use createQueryBuilder to ensure client relation is loaded with all fields
    // Explicitly select only essential role columns (excluding optional columns that may not exist)
    const user = await userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.client', 'client')
      .leftJoin('user.role', 'role')
      .addSelect([
        'role.id',
        'role.name',
        'role.description',
        'role.clientId',
        'role.createdAt',
        'role.updatedAt'
      ])
      .where('user.id = :userId', { userId: userPayload.userId })
      .andWhere('user.isActive = :isActive', { isActive: true })
      .getOne();

    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
      return;
    }

    // Ensure client is loaded (if relation didn't load, fetch it explicitly)
    let client = user.client;
    if (!client && user.clientId) {
      const clientRepository = AppDataSource.getRepository(Client);
      const fetchedClient = await clientRepository.findOne({
        where: { id: user.clientId },
      });
      if (fetchedClient) {
        client = fetchedClient;
        user.client = fetchedClient;
      }
    }

    // Check if this is a super admin route (clients, plans, etc.)
    // Note: req.path is relative to the mount point, so '/api/clients' becomes '/clients'
    // Also check req.originalUrl and req.baseUrl for full path
    const path = req.path || '';
    const originalUrl = req.originalUrl || '';
    const isSuperAdminRoute = path.startsWith('/clients') || 
                              path.startsWith('/plans') ||
                              path.startsWith('/super-admin') ||
                              originalUrl.includes('/api/clients') ||
                              originalUrl.includes('/api/plans') ||
                              originalUrl.includes('/api/super-admin');
    
    // If it's a super admin route, verify user has isSuperAdmin flag
    if (isSuperAdminRoute) {
      logger.debug('Super admin route access check', {
        path: path,
        originalUrl: originalUrl,
        baseUrl: req.baseUrl,
        userId: user.id,
        clientId: user.clientId,
        isSuperAdmin: user.isSuperAdmin,
      });
      
      if (!user.isSuperAdmin) {
        logger.warn('Super admin access denied', { userId: user.id, path });
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Super admin access denied. Only users with super admin privileges can access this resource.' },
        });
        return;
      }
      logger.debug('Super admin access granted', { userId: user.id, path });
    }

    // Cast to AuthenticatedRequest for type safety
    const authReq = req as AuthenticatedRequest;
    
    // Verify tenant matches (skip for super admin routes where clientId is not set)
    if (authReq.clientId && user.clientId !== authReq.clientId && !isSuperAdminRoute) {
      res.status(403).json({
        success: false,
        error: { code: 'TENANT_MISMATCH', message: 'Tenant mismatch' },
      });
      return;
    }

    // Set clientId from user if not already set
    if (!authReq.clientId) {
      authReq.clientId = user.clientId;
    }

    authReq.user = user;
    authReq.userId = user.id;
    return next();
  } catch (error) {
    next(error);
  }
}

