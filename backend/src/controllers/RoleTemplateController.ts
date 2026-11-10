import { Response } from 'express';
import { AuthenticatedRequest } from '../types/middleware.types';
import { RoleTemplateService } from '../services/RoleTemplateService';
import { CreateRoleTemplateDto, UpdateRoleTemplateDto } from '../types/roleTemplate.types';
import { sendSuccess, sendError } from '../utils/response';
import { AuditService } from '../services/AuditService';
import { ERROR_CODES, ERROR_MESSAGES } from '../constants/errors';
import { SUCCESS_MESSAGES } from '../constants/messages';
import { asParam } from '../utils/params';

export class RoleTemplateController {
  private templateService: RoleTemplateService;
  private auditService: AuditService;

  constructor() {
    this.templateService = new RoleTemplateService();
    this.auditService = new AuditService();
  }

  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const clientId = req.clientId!;
      const userId = req.user!.id;

      const data: CreateRoleTemplateDto = {
        name: req.body.name,
        description: req.body.description,
        clientId,
        permissionIds: req.body.permissionIds,
      };

      const template = await this.templateService.createTemplate(data, req);

      await this.auditService.log({
        clientId,
        userId,
        action: 'role_template.created',
        resourceType: 'role_template',
        resourceId: template.id,
        metadata: { templateName: template.name },
      }, req);

      sendSuccess(res, template, 201);
    } catch (error: any) {
      sendError(res, ERROR_CODES.TEMPLATE_CREATE_ERROR, error.message, 400);
    }
  }

  async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const clientId = req.clientId!;
      const userId = req.user!.id;
      const templateId = asParam(req.params.id);

      const data: UpdateRoleTemplateDto = {
        name: req.body.name,
        description: req.body.description,
        permissionIds: req.body.permissionIds,
        isActive: req.body.isActive,
      };

      const template = await this.templateService.updateTemplate(
        templateId,
        clientId,
        data,
        userId,
        req
      );

      await this.auditService.log({
        clientId,
        userId,
        action: 'role_template.updated',
        resourceType: 'role_template',
        resourceId: template.id,
        metadata: { templateName: template.name, changes: data },
      }, req);

      sendSuccess(res, template);
    } catch (error: any) {
      sendError(res, ERROR_CODES.TEMPLATE_UPDATE_ERROR, error.message, 400);
    }
  }

  async get(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const clientId = req.clientId!;
      const templateId = asParam(req.params.id);

      const template = await this.templateService.getTemplate(templateId, clientId, req);

      if (!template) {
        sendError(res, ERROR_CODES.TEMPLATE_NOT_FOUND, ERROR_MESSAGES.TEMPLATE_NOT_FOUND, 404);
        return;
      }

      sendSuccess(res, template);
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const clientId = req.clientId!;
      const templates = await this.templateService.listTemplates(clientId, req);
      sendSuccess(res, templates);
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const clientId = req.clientId!;
      const userId = req.user!.id;
      const templateId = asParam(req.params.id);

      await this.templateService.deleteTemplate(templateId, clientId, req);

      await this.auditService.log({
        clientId,
        userId,
        action: 'role_template.deleted',
        resourceType: 'role_template',
        resourceId: templateId,
      }, req);

      sendSuccess(res, { message: SUCCESS_MESSAGES.TEMPLATE_DELETED });
    } catch (error: any) {
      sendError(res, ERROR_CODES.TEMPLATE_DELETE_ERROR, error.message, 400);
    }
  }
}

