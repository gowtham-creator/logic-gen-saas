import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { PermissionService } from '../services/PermissionService';
import { getSecurityMonitoringService, SecurityEventType } from '../services/SecurityMonitoringService';

/**
 * Middleware to check element-level permissions
 * Usage: rbacMiddleware('project', 'read', 'project-list')
 */
export function rbacMiddleware(
  resource: string,
  action: string,
  elementId?: string
) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const permissionService = new PermissionService();
      const hasPermission = await permissionService.checkPermission(
        req.user.id,
        req.clientId!,
        resource,
        action,
        elementId,
        undefined,
        req as any
      );

      if (!hasPermission) {
        // Log security event for monitoring
        const securityMonitoring = getSecurityMonitoringService();
        securityMonitoring.log({
          type: SecurityEventType.PERMISSION_DENIED,
          severity: 'medium',
          message: 'Permission denied',
          metadata: {
            userId: req.user.id,
            clientId: req.clientId,
            subdomain: (req as any).tenant?.subdomain || undefined,
            resource,
            action,
            elementId,
            ip: (req as any).ip,
            path: (req as any).path,
            method: (req as any).method,
            userAgent: (req as any).get('user-agent'),
          },
          timestamp: new Date(),
        });
        
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions',
          },
        });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

