import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { AuthenticatedRequest, JWTPayload } from '../types/middleware.types';
import { AUTH_CONSTANTS } from '../constants/auth';

/**
 * Optional auth middleware - tries to authenticate but doesn't fail if it can't
 * Used for logging unauthorized access attempts where we want user info if available
 */
export async function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith(AUTH_CONSTANTS.BEARER_PREFIX)) {
      // No token, but continue anyway
      return next();
    }

    const token = authHeader.substring(AUTH_CONSTANTS.BEARER_PREFIX_LENGTH);
    let decoded: JWTPayload;

    try {
      decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
    } catch (error) {
      // Invalid token, but continue anyway
      return next();
    }

    // Try to get user, but don't fail if we can't
    try {
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { id: decoded.userId },
        select: ['id', 'email', 'firstName', 'lastName', 'clientId'],
      });

      if (user) {
        (req as AuthenticatedRequest).user = user;
        (req as AuthenticatedRequest).userId = user.id;
        (req as AuthenticatedRequest).clientId = user.clientId;
      }
    } catch (error) {
      // User lookup failed, but continue anyway
      console.error('Optional auth: Failed to get user:', error);
    }

    next();
  } catch (error) {
    // Any error, just continue
    next();
  }
}

