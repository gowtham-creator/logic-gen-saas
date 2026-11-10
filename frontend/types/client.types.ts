/**
 * Client-related types
 */

import { Plan } from './plan.types';

export interface SSOConfig {
  provider?: 'oidc' | 'saml';
  metadata?: Record<string, unknown>;
  enabled: boolean;
}

export interface ClientDatabaseConfig {
  isolationLevel: 'shared' | 'database';
  allowCustomTables: boolean;
  allowCustomColumns: boolean;
  allowCustomMigrations: boolean;
  maxCustomTables?: number;
  maxCustomColumns?: number;
  databaseUrl?: string;
}

export interface StorageEngine {
  id: string;
  type: 's3' | 'azure' | 'local' | 'gcs';
  name: string;
  description?: string;
  isActive: boolean;
  defaultConfig?: Record<string, unknown>;
}

export interface StorageConfig {
  id?: string;
  storageEngineId: string;
  config: Record<string, unknown>;
  basePath?: string;
  storageEngine?: StorageEngine;
}

export interface Client {
  id?: string;
  name: string;
  subdomain: string;
  planId?: string;
  plan?: Plan;
  planExpiresAt?: string;
  isActive?: boolean;
  allowSuperAdminLogin?: boolean;
  mfaRequired?: boolean;
  enforceMFA?: boolean;
  ssoConfig?: SSOConfig;
  databaseConfig?: ClientDatabaseConfig;
  storageConfig?: StorageConfig;
  storageConfigId?: string;
  createdAt?: string;
}

