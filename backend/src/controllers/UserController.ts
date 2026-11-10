import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types/middleware.types';
import { IUserService } from '../interfaces/IUserService';
import { CreateUserDto, UpdateUserDto } from '../types/user.types';
import { sendSuccess, sendError } from '../utils/response';
import { AuditService } from '../services/AuditService';
import { ERROR_CODES, ERROR_MESSAGES } from '../constants/errors';
import { SUCCESS_MESSAGES } from '../constants/messages';
import { logger } from '../utils/logger';
import { asParam } from '../utils/params';

export class UserController {
  constructor(
    private userService: IUserService,
    private auditService: AuditService
  ) {}

  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const data: CreateUserDto = {
        ...req.body,
        clientId: req.clientId!,
      };

      const user = await this.userService.createUser(data, req);

      // Audit log
      await this.auditService.log({
        clientId: req.clientId!,
        userId: req.userId,
        action: 'user.created',
        resourceType: 'User',
        resourceId: user.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      // Don't expose passwordHash
      const safeUser = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roleId: user.roleId,
        isActive: user.isActive,
        mustResetPassword: user.mustResetPassword,
        source: user.source,
        externalId: user.externalId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      sendSuccess(res, safeUser, 201);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create user';
      logger.error('Failed to create user', { error: errorMessage, clientId: req.clientId });
      sendError(res, ERROR_CODES.INTERNAL_ERROR, errorMessage, 400);
    }
  }

  async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const users = await this.userService.listUsers(req.clientId!, req);
      
      // Don't expose passwordHash
      const safeUsers = users.map((user) => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roleId: user.roleId,
        role: user.role ? {
          id: user.role.id,
          name: user.role.name,
          description: user.role.description,
        } : null,
        isActive: user.isActive,
        mustResetPassword: user.mustResetPassword,
        source: user.source,
        externalId: user.externalId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }));

      sendSuccess(res, safeUsers);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to list users';
      logger.error('Failed to list users', { error: errorMessage, clientId: req.clientId });
      sendError(res, ERROR_CODES.INTERNAL_ERROR, errorMessage, 500);
    }
  }

  async get(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = asParam(req.params.id);
      const user = await this.userService.getUserById(id, req.clientId!, false, req);

      if (!user) {
        sendError(res, ERROR_CODES.NOT_FOUND, ERROR_MESSAGES.NOT_FOUND('User'), 404);
        return;
      }

      // Don't expose passwordHash
      const safeUser = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roleId: user.roleId,
        role: user.role ? {
          id: user.role.id,
          name: user.role.name,
          description: user.role.description,
        } : null,
        isActive: user.isActive,
        mustResetPassword: user.mustResetPassword,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      sendSuccess(res, safeUser);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get user';
      logger.error('Failed to get user', { error: errorMessage, userId: req.params.id, clientId: req.clientId });
      sendError(res, ERROR_CODES.INTERNAL_ERROR, errorMessage, 500);
    }
  }

  async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = asParam(req.params.id);
      const data: UpdateUserDto = req.body;

      // Prevent users from updating their own role (security: prevent privilege escalation)
      if (id === req.userId && data.roleId !== undefined) {
        sendError(res, ERROR_CODES.FORBIDDEN, 'You cannot update your own role', 403);
        return;
      }

      const user = await this.userService.updateUser(id, req.clientId!, data, req);

      // Audit log
      await this.auditService.log({
        clientId: req.clientId!,
        userId: req.userId,
        action: 'user.updated',
        resourceType: 'User',
        resourceId: id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: { changes: Object.keys(data) },
      });

      // Don't expose passwordHash
      const safeUser = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roleId: user.roleId,
        isActive: user.isActive,
        mustResetPassword: user.mustResetPassword,
        source: user.source,
        externalId: user.externalId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      sendSuccess(res, safeUser);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update user';
      logger.error('Failed to update user', { error: errorMessage, userId: req.params.id, clientId: req.clientId });
      sendError(res, ERROR_CODES.INTERNAL_ERROR, errorMessage, 400);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = asParam(req.params.id);
      await this.userService.deleteUser(id, req.clientId!, req);

      // Audit log
      await this.auditService.log({
        clientId: req.clientId!,
        userId: req.userId,
        action: 'user.deleted',
        resourceType: 'User',
        resourceId: id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      sendSuccess(res, { message: SUCCESS_MESSAGES.USER_DELETED });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete user';
      logger.error('Failed to delete user', { error: errorMessage, userId: req.params.id, clientId: req.clientId });
      sendError(res, ERROR_CODES.INTERNAL_ERROR, errorMessage, 400);
    }
  }

  async checkEmailAvailability(req: Request<{}, {}, {}, { email?: string; excludeClientId?: string }>, res: Response): Promise<void> {
    try {
      const email = req.query.email as string;
      const excludeClientId = req.query.excludeClientId as string | undefined;

      if (!email) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Email is required', 400);
        return;
      }

      const result = await this.userService.checkEmailAvailability(email, excludeClientId);
      
      // Always return consistent response format
      sendSuccess(res, {
        available: result.available,
        message: result.message,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to check email availability';
      // Don't log email (PII) - secureLogger will redact it anyway, but better to not include it
      logger.error('Failed to check email availability', { error: errorMessage });
      sendError(res, ERROR_CODES.INTERNAL_ERROR, errorMessage, 500);
    }
  }
}

