import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import { AppDataSource } from '../config/database';
import { SuperAdmin } from '../entities/SuperAdmin';
import { SuperAdminAuthenticatedRequest, SuperAdminJWTPayload } from '../types/middleware.types';
import { AUTH_CONSTANTS } from '../constants/auth';
/**
 * Middleware to authenticate super admin JWT tokens
 */
export async function superAdminAuthMiddleware(
  req: SuperAdminAuthenticatedRequest,
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
    let decoded: SuperAdminJWTPayload;

    try {
      decoded = jwt.verify(token, config.jwt.secret) as SuperAdminJWTPayload;
      
      // Verify this is a super admin token
      if (decoded.type !== 'super_admin') {
        res.status(401).json({
          success: false,
          error: { code: 'INVALID_TOKEN_TYPE', message: 'Invalid token type' },
        });
        return;
      }
    } catch (error) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
      });
      return;
    }

    const superAdminRepository = AppDataSource.getRepository(SuperAdmin);
    const admin = await superAdminRepository.findOne({
      where: { id: decoded.adminId, isActive: true },
      relations: ['role'],
    });

    if (!admin) {
      res.status(401).json({
        success: false,
        error: { code: 'ADMIN_NOT_FOUND', message: 'Super admin not found' },
      });
      return;
    }

    req.superAdmin = admin;
    req.adminId = admin.id;
    next();
  } catch (error) {
    next(error);
  }
}

