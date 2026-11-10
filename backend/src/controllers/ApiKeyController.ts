import { Response } from 'express';
import { AuthenticatedRequest } from '../types/middleware.types';
import { ApiKeyService } from '../services/ApiKeyService';
import { CreateApiKeyDto, UpdateApiKeyDto } from '../types/apiKey.types';
import { sendSuccess, sendError } from '../utils/response';
import { AuditService } from '../services/AuditService';
import { ERROR_CODES, ERROR_MESSAGES } from '../constants/errors';
import { SUCCESS_MESSAGES } from '../constants/messages';
import { asParam } from '../utils/params';

export class ApiKeyController {
  private apiKeyService: ApiKeyService;
  private auditService: AuditService;

  constructor() {
    this.apiKeyService = new ApiKeyService();
    this.auditService = new AuditService();
  }

  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const data: CreateApiKeyDto = {
        ...req.body,
        clientId: req.clientId!,
      };

      const { apiKey, plainKey } = await this.apiKeyService.createApiKey(data, req);

      // Audit log
      await this.auditService.log({
        clientId: req.clientId!,
        userId: req.userId,
        action: 'api_key.created',
        resourceType: 'ApiKey',
        resourceId: apiKey.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      // Return API key only once (plainKey)
      sendSuccess(res, {
        id: apiKey.id,
        name: apiKey.name,
        apiKey: plainKey, // Only shown once
        scopes: apiKey.scopes,
        allowedEndpoints: apiKey.allowedEndpoints,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      }, 201);
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 400);
    }
  }

  async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const apiKeys = await this.apiKeyService.listApiKeys(req.clientId!, req);
      // Don't expose keyHash
      const safeKeys = apiKeys.map((key) => ({
        id: key.id,
        name: key.name,
        scopes: key.scopes,
        allowedEndpoints: key.allowedEndpoints,
        expiresAt: key.expiresAt,
        lastUsedAt: key.lastUsedAt,
        isRevoked: key.isRevoked,
        rateLimitPerMinute: key.rateLimitPerMinute,
        createdAt: key.createdAt,
      }));
      sendSuccess(res, safeKeys);
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async get(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = asParam(req.params.id);
      const apiKey = await this.apiKeyService.getApiKey(id, req.clientId!, req);

      if (!apiKey) {
        sendError(res, ERROR_CODES.NOT_FOUND, ERROR_MESSAGES.NOT_FOUND('API key'), 404);
        return;
      }

      // Don't expose keyHash
      sendSuccess(res, {
        id: apiKey.id,
        name: apiKey.name,
        scopes: apiKey.scopes,
        allowedEndpoints: apiKey.allowedEndpoints,
        expiresAt: apiKey.expiresAt,
        lastUsedAt: apiKey.lastUsedAt,
        isRevoked: apiKey.isRevoked,
        rateLimitPerMinute: apiKey.rateLimitPerMinute,
        createdAt: apiKey.createdAt,
      });
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
    }
  }

  async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = asParam(req.params.id);
      const data: UpdateApiKeyDto = req.body;

      const apiKey = await this.apiKeyService.updateApiKey(id, req.clientId!, data, req);

      // Audit log
      await this.auditService.log({
        clientId: req.clientId!,
        userId: req.userId,
        action: 'api_key.updated',
        resourceType: 'ApiKey',
        resourceId: id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: { changes: data },
      });

      // Don't expose keyHash
      sendSuccess(res, {
        id: apiKey.id,
        name: apiKey.name,
        scopes: apiKey.scopes,
        allowedEndpoints: apiKey.allowedEndpoints,
        expiresAt: apiKey.expiresAt,
        lastUsedAt: apiKey.lastUsedAt,
        isRevoked: apiKey.isRevoked,
        rateLimitPerMinute: apiKey.rateLimitPerMinute,
        createdAt: apiKey.createdAt,
      });
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 400);
    }
  }

  async revoke(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = asParam(req.params.id);
      await this.apiKeyService.revokeApiKey(id, req.clientId!, req);

      // Audit log
      await this.auditService.log({
        clientId: req.clientId!,
        userId: req.userId,
        action: 'api_key.revoked',
        resourceType: 'ApiKey',
        resourceId: id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      sendSuccess(res, { message: SUCCESS_MESSAGES.API_KEY_REVOKED });
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 400);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = asParam(req.params.id);
      await this.apiKeyService.deleteApiKey(id, req.clientId!, req);

      // Audit log
      await this.auditService.log({
        clientId: req.clientId!,
        userId: req.userId,
        action: 'api_key.deleted',
        resourceType: 'ApiKey',
        resourceId: id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      sendSuccess(res, { message: SUCCESS_MESSAGES.API_KEY_DELETED });
    } catch (error: any) {
      sendError(res, ERROR_CODES.INTERNAL_ERROR, error.message, 400);
    }
  }
}

