/**
 * API Key-related types
 */

import { ApiKey } from '../entities/ApiKey';

export interface CreateApiKeyDto {
  name: string;
  clientId: string;
  scopes: string[];
  allowedEndpoints: string[];
  expiresAt?: Date;
  rateLimitPerMinute?: number;
}

export interface UpdateApiKeyDto {
  name?: string;
  scopes?: string[];
  allowedEndpoints?: string[];
  expiresAt?: Date | null;
  rateLimitPerMinute?: number;
}

export interface ApiKeyValidationResult {
  apiKey: ApiKey;
  isValid: boolean;
}

