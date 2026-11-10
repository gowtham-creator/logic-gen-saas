import { Response, NextFunction } from 'express';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { AuthenticatedRequest } from '../types/middleware.types';
import { sendError } from '../utils/response';
import { ERROR_CODES } from '../constants/errors';

/**
 * Middleware to verify that the authenticated user has developer access
 * This should be used after combinedAuthMiddleware
 */
export async function developerMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.userId) {
      sendError(res, ERROR_CODES.UNAUTHORIZED, 'Authentication required', 401);
      return;
    }

    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: req.userId, isActive: true, isDeveloper: true },
    });

    if (!user || !user.isDeveloper) {
      sendError(res, ERROR_CODES.FORBIDDEN, 'Developer access required', 403);
      return;
    }

    // Attach developer flag to request
    (req as any).isDeveloper = true;
    next();
  } catch (error: any) {
    sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
  }
}

