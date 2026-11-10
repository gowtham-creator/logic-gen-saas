import { Response } from 'express';
import { AuthenticatedRequest } from '../types/middleware.types';
import { RoleService } from '../services/RoleService';
import { CreateRoleDto, UpdateRoleDto } from '../types/role.types';
import { sendSuccess, sendError } from '../utils/response';
import { AuditService } from '../services/AuditService';
import { ERROR_CODES, ERROR_MESSAGES } from '../constants/errors';
import { SUCCESS_MESSAGES } from '../constants/messages';
import { asParam } from '../utils/params';

export class RoleController {
  private roleService: RoleService;
  private auditService: AuditService;

  constructor() {
    this.roleService = new RoleService();
    this.auditService = new AuditService();
  }

  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const data: CreateRoleDto = {
        ...req.body,
        clientId: req.clientId!,
      };

      const role = await this.roleService.createRole(data, req);

      // Audit log
      await this.auditService.log({
        clientId: req.clientId!,
        userId: req.userId,
        action: 'role.created',
        resourceType: 'Role',
        resourceId: role.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      sendSuccess(res, role, 201);
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 400);
    }
  }

  async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const roles = await this.roleService.listRoles(req.clientId!, req);
      sendSuccess(res, roles);
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async get(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = asParam(req.params.id);
      const role = await this.roleService.getRole(id, req.clientId!, req);

      if (!role) {
        sendError(res, ERROR_CODES.ROLE_NOT_FOUND, ERROR_MESSAGES.ROLE_NOT_FOUND, 404);
        return;
      }

      sendSuccess(res, role);
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = asParam(req.params.id);
      const data: UpdateRoleDto = req.body;

      const role = await this.roleService.updateRole(id, req.clientId!, data, req);

      // Audit log
      await this.auditService.log({
        clientId: req.clientId!,
        userId: req.userId,
        action: 'role.updated',
        resourceType: 'Role',
        resourceId: id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      sendSuccess(res, role);
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 400);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = asParam(req.params.id);
      await this.roleService.deleteRole(id, req.clientId!, req);

      // Audit log
      await this.auditService.log({
        clientId: req.clientId!,
        userId: req.userId,
        action: 'role.deleted',
        resourceType: 'Role',
        resourceId: id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      sendSuccess(res, { message: SUCCESS_MESSAGES.ROLE_DELETED });
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 400);
    }
  }
}

