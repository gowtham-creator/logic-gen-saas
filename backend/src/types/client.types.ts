/**
 * Client-related types
 */
import { ClientDatabaseConfig } from './database.types';

export interface SSOConfig {
  provider: 'oidc' | 'saml';
  metadata?: Record<string, unknown>;
  enabled: boolean;
}

export interface StorageConfigDto {
  storageEngineId: string;
  config: Record<string, unknown>;
}

export interface CreateClientDto {
  name: string;
  subdomain: string;
  planId?: string;
  planExpiresAt?: Date;
  allowSuperAdminLogin?: boolean;
  isActive?: boolean;
  ssoConfig?: SSOConfig;
  databaseConfig?: ClientDatabaseConfig;
  storageConfig?: StorageConfigDto;
  // Admin user fields (required - admin user must be created)
  adminEmail: string;
  adminPassword: string;
  adminFirstName: string;
  adminLastName: string;
}

export interface UpdateClientDto {
  name?: string;
  subdomain?: string;
  planId?: string;
  planExpiresAt?: Date;
  ssoConfig?: SSOConfig;
  databaseConfig?: ClientDatabaseConfig;
  storageConfig?: StorageConfigDto;
  isActive?: boolean;
  mfaRequired?: boolean;
  enforceMFA?: boolean;
}

