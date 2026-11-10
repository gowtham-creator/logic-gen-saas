import { Response } from 'express';
import { AuthenticatedRequest } from '../types/middleware.types';
import { AppDataSource } from '../config/database';
import { Permission } from '../entities/Permission';
import { sendSuccess, sendError } from '../utils/response';
import { ERROR_CODES, ERROR_MESSAGES } from '../constants/errors';
import { asParam } from '../utils/params';

export class PermissionController {
  async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const permissionRepository = AppDataSource.getRepository(Permission);
      const permissions = await permissionRepository.find({
        order: { resource: 'ASC', action: 'ASC' },
      });
      sendSuccess(res, permissions);
    } catch (error: any) {
      sendError(res, ERROR_CODES.LIST_PERMISSIONS_ERROR, error.message, 500);
    }
  }

  async get(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = asParam(req.params.id);
      const permissionRepository = AppDataSource.getRepository(Permission);
      const permission = await permissionRepository.findOne({
        where: { id },
      });

      if (!permission) {
        sendError(res, ERROR_CODES.PERMISSION_NOT_FOUND, ERROR_MESSAGES.PERMISSION_NOT_FOUND, 404);
        return;
      }

      sendSuccess(res, permission);
    } catch (error: any) {
      sendError(res, ERROR_CODES.GET_PERMISSION_ERROR, error.message, 500);
    }
  }

  async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = asParam(req.params.id);
      const { elementId, description } = req.body;
      const permissionRepository = AppDataSource.getRepository(Permission);
      
      const permission = await permissionRepository.findOne({
        where: { id },
      });

      if (!permission) {
        sendError(res, ERROR_CODES.PERMISSION_NOT_FOUND, ERROR_MESSAGES.PERMISSION_NOT_FOUND, 404);
        return;
      }

      // Update elementId and description
      if (elementId !== undefined) {
        permission.elementId = elementId || null;
      }
      if (description !== undefined) {
        permission.description = description;
      }

      const updated = await permissionRepository.save(permission);
      sendSuccess(res, updated);
    } catch (error: any) {
      sendError(res, ERROR_CODES.UPDATE_PERMISSION_ERROR, error.message, 500);
    }
  }
}

