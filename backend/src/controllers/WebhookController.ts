import { Response } from 'express';
import { WebhookService } from '../services/WebhookService';
import { sendSuccess, sendError } from '../utils/response';
import { ERROR_CODES } from '../constants/errors';
import { AuthenticatedRequest } from '../types/middleware.types';
import { CreateWebhookDto, UpdateWebhookDto } from '../types/webhook.types';
import { AuditService } from '../services/AuditService';
import { asParam } from '../utils/params';

export class WebhookController {
  private webhookService: WebhookService;
  private auditService: AuditService;

  constructor() {
    this.webhookService = new WebhookService();
    this.auditService = new AuditService();
  }

  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.clientId) {
        sendError(res, ERROR_CODES.UNAUTHORIZED, 'Client ID is required', 401);
        return;
      }

      const data: CreateWebhookDto = req.body;
      const webhook = await this.webhookService.createWebhook(req.clientId, data, req);

      // Audit log
      await this.auditService.log({
        clientId: req.clientId,
        userId: req.userId,
        action: 'webhook.created',
        resourceType: 'Webhook',
        resourceId: webhook.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: { url: webhook.url, events: webhook.events },
      });

      sendSuccess(res, webhook, 201);
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.clientId) {
        sendError(res, ERROR_CODES.UNAUTHORIZED, 'Client ID is required', 401);
        return;
      }

      const webhooks = await this.webhookService.listWebhooks(req.clientId, req);
      sendSuccess(res, webhooks);
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async get(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.clientId) {
        sendError(res, ERROR_CODES.UNAUTHORIZED, 'Client ID is required', 401);
        return;
      }

      const id = asParam(req.params.id);
      const webhook = await this.webhookService.getWebhook(id, req.clientId, req);

      if (!webhook) {
        sendError(res, ERROR_CODES.NOT_FOUND, 'Webhook not found', 404);
        return;
      }

      sendSuccess(res, webhook);
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.clientId) {
        sendError(res, ERROR_CODES.UNAUTHORIZED, 'Client ID is required', 401);
        return;
      }

      const id = asParam(req.params.id);
      const data: UpdateWebhookDto = req.body;

      const webhook = await this.webhookService.updateWebhook(id, req.clientId, data, req);

      // Audit log
      await this.auditService.log({
        clientId: req.clientId,
        userId: req.userId,
        action: 'webhook.updated',
        resourceType: 'Webhook',
        resourceId: id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: { changes: Object.keys(data) },
      });

      sendSuccess(res, webhook);
    } catch (error: any) {
      if (error.message === 'Webhook not found') {
        sendError(res, ERROR_CODES.NOT_FOUND, error.message, 404);
      } else {
        sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
      }
    }
  }

  async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.clientId) {
        sendError(res, ERROR_CODES.UNAUTHORIZED, 'Client ID is required', 401);
        return;
      }

      const id = asParam(req.params.id);
      await this.webhookService.deleteWebhook(id, req.clientId, req);

      // Audit log
      await this.auditService.log({
        clientId: req.clientId,
        userId: req.userId,
        action: 'webhook.deleted',
        resourceType: 'Webhook',
        resourceId: id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      sendSuccess(res, { message: 'Webhook deleted successfully' });
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async getEvents(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.clientId) {
        sendError(res, ERROR_CODES.UNAUTHORIZED, 'Client ID is required', 401);
        return;
      }

      const id = asParam(req.params.id);
      const limit = parseInt(req.query.limit as string) || 50;

      const events = await this.webhookService.getWebhookEvents(id, req.clientId, limit, req);
      sendSuccess(res, events);
    } catch (error: any) {
      if (error.message === 'Webhook not found') {
        sendError(res, ERROR_CODES.NOT_FOUND, error.message, 404);
      } else {
        sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
      }
    }
  }

  async retryEvent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.clientId) {
        sendError(res, ERROR_CODES.UNAUTHORIZED, 'Client ID is required', 401);
        return;
      }

      const eventId = asParam(req.params.eventId);
      await this.webhookService.retryWebhookEvent(eventId, req.clientId, req);

      sendSuccess(res, { message: 'Webhook event retry initiated' });
    } catch (error: any) {
      if (error.message === 'Webhook event not found') {
        sendError(res, ERROR_CODES.NOT_FOUND, error.message, 404);
      } else if (error.message.includes('already delivered')) {
        sendError(res, ERROR_CODES.VALIDATION_ERROR, error.message, 400);
      } else {
        sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
      }
    }
  }

  async acknowledgeEvent(req: any, res: Response): Promise<void> {
    try {
      const eventId = asParam(req.params.eventId);
      const { status } = req.body || {};

      // Pass req if available (for tenant DataSource support)
      // Note: For database-per-tenant, clientId should be included in URL or headers
      await this.webhookService.acknowledgeWebhook(eventId, status, req);

      sendSuccess(res, { message: 'Acknowledgement received' });
    } catch (error: any) {
      if (error.message === 'Webhook event not found') {
        sendError(res, ERROR_CODES.NOT_FOUND, error.message, 404);
      } else {
        sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
      }
    }
  }
}

