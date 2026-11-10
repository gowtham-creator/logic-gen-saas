/**
 * API Key-related types
 */

export interface ApiKey {
  id: string;
  name: string;
  scopes: string[];
  allowedEndpoints: string[];
  expiresAt?: string;
  lastUsedAt?: string;
  isRevoked: boolean;
  rateLimitPerMinute: number;
  createdAt: string;
  apiKey?: string; // Only present when first created
}

