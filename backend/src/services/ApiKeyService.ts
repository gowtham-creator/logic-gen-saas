import { Repository, IsNull } from 'typeorm';
import { AppDataSource } from '../config/database';
import { ApiKey } from '../entities/ApiKey';
import crypto from 'crypto';
import { CreateApiKeyDto, UpdateApiKeyDto, ApiKeyValidationResult } from '../types/apiKey.types';
import { triggerWebhook } from '../utils/webhookTrigger';
import { TenantRequest } from '../types/middleware.types';
import { getTenantRepository } from '../utils/tenantRepository';
import { getIsolationLevel, buildWhereClause } from '../utils/isolationHelper';

export class ApiKeyService {
  private getRepository(req?: TenantRequest): Repository<ApiKey> {
    return req ? getTenantRepository(req, ApiKey) : AppDataSource.getRepository(ApiKey);
  }

  /**
   * Generate a new API key
   */
  generateApiKey(): string {
    return `sk_${crypto.randomBytes(32).toString('hex')}`;
  }

  /**
   * Hash API key for storage
   */
  hashApiKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Create a new API key
   */
  async createApiKey(data: CreateApiKeyDto, req?: TenantRequest): Promise<{ apiKey: ApiKey; plainKey: string }> {
    const repository = this.getRepository(req);
    const plainKey = this.generateApiKey();
    const keyHash = this.hashApiKey(plainKey);
    const isolationLevel = await getIsolationLevel(req, data.clientId);

    const apiKeyData: any = {
      name: data.name,
      keyHash,
      scopes: data.scopes,
      allowedEndpoints: data.allowedEndpoints,
      expiresAt: data.expiresAt,
      rateLimitPerMinute: data.rateLimitPerMinute || 0,
      isRevoked: false,
    };
    if (isolationLevel !== 'database') {
      apiKeyData.clientId = data.clientId;
    }

    const apiKey = repository.create(apiKeyData);
    const saved = await repository.save(apiKey);
    // TypeORM save can return array or single entity, but we're passing single entity
    const savedApiKey = Array.isArray(saved) ? saved[0] : saved;

    // Trigger webhook (don't include plain key in payload)
    await triggerWebhook(
      data.clientId,
      'apiKey.created',
      {
        id: savedApiKey.id,
        name: savedApiKey.name,
        scopes: savedApiKey.scopes,
        allowedEndpoints: savedApiKey.allowedEndpoints,
        expiresAt: savedApiKey.expiresAt,
        rateLimitPerMinute: savedApiKey.rateLimitPerMinute,
        createdAt: savedApiKey.createdAt,
      },
      undefined,
      req
    );

    return { apiKey: savedApiKey, plainKey };
  }

  /**
   * Validate API key
   */
  async validateApiKey(
    plainKey: string,
    clientId: string,
    req?: TenantRequest
  ): Promise<ApiKeyValidationResult | null> {
    const repository = this.getRepository(req);
    const keyHash = this.hashApiKey(plainKey);
    const isolationLevel = await getIsolationLevel(req, clientId);
    const where = buildWhereClause(isolationLevel, { keyHash, isRevoked: false, deletedAt: IsNull() }, clientId);
    const apiKey = await repository.findOne({ where });

    if (!apiKey) {
      return null;
    }

    // Check expiry
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return null;
    }

    // Update last used
    apiKey.lastUsedAt = new Date();
    await repository.save(apiKey);

    return { apiKey, isValid: true };
  }

  /**
   * Check if API key has required scope
   */
  hasScope(apiKey: ApiKey, requiredScope: string): boolean {
    return apiKey.scopes.includes(requiredScope) || apiKey.scopes.includes('*');
  }

  /**
   * Check if API key is allowed to access endpoint
   */
  isEndpointAllowed(apiKey: ApiKey, endpoint: string): boolean {
    if (apiKey.allowedEndpoints.length === 0) {
      return true; // No restrictions
    }

    return (
      apiKey.allowedEndpoints.includes(endpoint) ||
      apiKey.allowedEndpoints.some((allowed) => endpoint.startsWith(allowed))
    );
  }

  async getApiKey(id: string, clientId: string, req?: TenantRequest): Promise<ApiKey | null> {
    const repository = this.getRepository(req);
    const isolationLevel = await getIsolationLevel(req, clientId);
    const where = buildWhereClause(isolationLevel, { id, deletedAt: IsNull() }, clientId);
    return repository.findOne({ where });
  }

  async listApiKeys(clientId: string, req?: TenantRequest): Promise<ApiKey[]> {
    const repository = this.getRepository(req);
    const isolationLevel = await getIsolationLevel(req, clientId);
    const where = buildWhereClause(isolationLevel, { deletedAt: IsNull() }, clientId);
    return repository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async revokeApiKey(id: string, clientId: string, req?: TenantRequest): Promise<void> {
    const repository = this.getRepository(req);
    const isolationLevel = await getIsolationLevel(req, clientId);
    const where = buildWhereClause(isolationLevel, { id, deletedAt: IsNull() }, clientId);
    await repository.update(where, { isRevoked: true });

    // Trigger webhook
    const apiKey = await this.getApiKey(id, clientId, req);
    if (apiKey) {
      await triggerWebhook(
        clientId,
        'apiKey.revoked',
        {
          id: apiKey.id,
          name: apiKey.name,
          revokedAt: new Date().toISOString(),
        },
        undefined,
        req
      );
    }
  }

  async updateApiKey(id: string, clientId: string, data: UpdateApiKeyDto, req?: TenantRequest): Promise<ApiKey> {
    const apiKey = await this.getApiKey(id, clientId, req);
    if (!apiKey) {
      throw new Error('API key not found');
    }

    // Don't allow updating revoked keys
    if (apiKey.isRevoked) {
      throw new Error('Cannot update a revoked API key');
    }

    // Update fields
    if (data.name !== undefined) {
      apiKey.name = data.name;
    }
    if (data.scopes !== undefined) {
      apiKey.scopes = data.scopes;
    }
    if (data.allowedEndpoints !== undefined) {
      apiKey.allowedEndpoints = data.allowedEndpoints;
    }
    if (data.expiresAt !== undefined) {
      apiKey.expiresAt = data.expiresAt || undefined;
    }
    if (data.rateLimitPerMinute !== undefined) {
      apiKey.rateLimitPerMinute = data.rateLimitPerMinute;
    }

    const repository = this.getRepository(req);
    const saved = await repository.save(apiKey);

    // Trigger webhook
    await triggerWebhook(
      clientId,
      'apiKey.updated',
      {
        id: saved.id,
        name: saved.name,
        scopes: saved.scopes,
        allowedEndpoints: saved.allowedEndpoints,
        isRevoked: saved.isRevoked,
        updatedAt: saved.updatedAt,
      },
      undefined,
      req
    );

    return saved;
  }

  async deleteApiKey(id: string, clientId: string, req?: TenantRequest): Promise<void> {
    const apiKey = await this.getApiKey(id, clientId, req);
    
    if (apiKey) {
      // Trigger webhook before deletion
      await triggerWebhook(
        clientId,
        'apiKey.deleted',
        {
          id: apiKey.id,
          name: apiKey.name,
        },
        undefined,
        req
      );
    }

    const repository = this.getRepository(req);
    const isolationLevel = await getIsolationLevel(req, clientId);
    const where = buildWhereClause(isolationLevel, { id }, clientId);
    // Soft delete (set deletedAt)
    await repository.update(where, { deletedAt: new Date() });
  }
}

