import { Response } from 'express';
import { AuthenticatedRequest } from '../types/middleware.types';
import { AuditService } from '../services/AuditService';
import { sendSuccess, sendError } from '../utils/response';
import { ERROR_CODES } from '../constants/errors';
import { asParam } from '../utils/params';

export class AuditLogController {
  private auditService: AuditService;

  constructor() {
    this.auditService = new AuditService();
  }

  async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const clientId = req.clientId;
      console.log('[AuditLogController] Request received:', {
        clientId,
        userId: req.userId,
        query: req.query,
        path: req.path,
      });
      
      const {
        userId,
        action,
        resourceType,
        startDate,
        endDate,
        page = '1',
        limit = '50',
      } = req.query;

      const filters: {
        userId?: string;
        action?: string;
        resourceType?: string;
        startDate?: Date;
        endDate?: Date;
        page?: number;
        limit?: number;
      } = {};

      if (userId && typeof userId === 'string') {
        filters.userId = userId;
      }
      if (action && typeof action === 'string') {
        filters.action = action;
      }
      if (resourceType && typeof resourceType === 'string') {
        filters.resourceType = resourceType;
      }
      if (startDate && typeof startDate === 'string') {
        filters.startDate = new Date(startDate);
      }
      if (endDate && typeof endDate === 'string') {
        filters.endDate = new Date(endDate);
      }
      if (page) {
        filters.page = parseInt(page as string, 10) || 1;
      }
      if (limit) {
        filters.limit = parseInt(limit as string, 10) || 50;
      }

      const { logs, total } = await this.auditService.getLogs(clientId, filters, req);

      console.log('[AuditLogController] Query results:', {
        clientId,
        filters,
        logsCount: logs.length,
        total,
        page: filters.page || 1,
        limit: filters.limit || 20,
      });

      sendSuccess(res, {
        logs,
        pagination: {
          page: filters.page || 1,
          limit: filters.limit || 50,
          total,
          totalPages: Math.ceil(total / (filters.limit || 50)),
        },
      });
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async get(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = asParam(req.params.id);
      const clientId = req.clientId;

      const log = await this.auditService.getLogById(id, clientId, req);

      if (!log) {
        sendError(res, ERROR_CODES.NOT_FOUND, 'Audit log not found', 404);
        return;
      }

      sendSuccess(res, log);
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async logUnauthorizedAccess(req: AuthenticatedRequest | any, res: Response): Promise<void> {
    try {
      const { attemptedPath, resource } = req.body;
      // Try to get user info, but don't fail if not available
      const userId = (req as AuthenticatedRequest).userId || (req.user?.id);
      const clientId = (req as AuthenticatedRequest).clientId || (req.user?.clientId);
      const ipAddress = req.ip || req.socket?.remoteAddress || (Array.isArray(req.headers['x-forwarded-for']) ? req.headers['x-forwarded-for'][0] : req.headers['x-forwarded-for']) || 'unknown';
      const userAgent = req.get('user-agent') || 'unknown';

      // Log the unauthorized access attempt
      await this.auditService.log(
        {
          userId: userId || undefined,
          clientId: clientId || undefined,
          action: 'unauthorized.access.attempt',
          resourceType: 'Route',
          resourceId: attemptedPath || undefined,
          ipAddress: typeof ipAddress === 'string' ? ipAddress : undefined,
          userAgent: userAgent || undefined,
          metadata: {
            attemptedPath: attemptedPath || req.path || 'unknown',
            resource: resource || 'Unknown',
            timestamp: new Date().toISOString(),
            userEmail: (req as AuthenticatedRequest).user?.email || req.user?.email || 'unknown',
          },
        },
        req as any
      );

      sendSuccess(res, { message: 'Unauthorized access attempt logged' });
    } catch (error: any) {
      // Don't fail the request if logging fails
      console.error('Failed to log unauthorized access:', error);
      sendSuccess(res, { message: 'Unauthorized access attempt logged' });
    }
  }
}

