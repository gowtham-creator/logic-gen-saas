import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';

/**
 * Middleware to check if user is super admin
 * Super admin must be:
 * 1. Authenticated (user must be set on request by authMiddleware)
 * 2. Have isSuperAdmin flag set to true
 * 3. Have an active account (isActive = true)
 */
export async function superAdminMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  
  // Check authentication
  if (!authReq.user) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
    return;
  }

  // Verify user is active
  if (!authReq.user.isActive) {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'User account is inactive' },
    });
    return;
  }

  // Check if user has isSuperAdmin flag set
  if (!authReq.user.isSuperAdmin) {
    res.status(403).json({
      success: false,
      error: { 
        code: 'FORBIDDEN', 
        message: 'Super admin access denied. Only users with super admin privileges can access this resource.' 
      },
    });
    return;
  }

  next();
}

