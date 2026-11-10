import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { config } from '../config/config';

/**
 * Secrets Service for retrieving secrets from AWS Secrets Manager
 * Falls back to environment variables in development mode
 */
export class SecretsService {
  private client: SecretsManagerClient | null = null;
  private cache: Map<string, { value: string; expiresAt: number }> = new Map();
  private cacheTTL = config.secrets.cacheTtlMs;

  constructor() {
    // Only initialize AWS client in production
    if (config.nodeEnv === 'production') {
      try {
        this.client = new SecretsManagerClient({
          region: process.env.AWS_REGION || 'us-east-1',
          // Credentials are automatically loaded from:
          // 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
          // 2. IAM role (if running on EC2/ECS/Lambda)
          // 3. AWS credentials file (~/.aws/credentials)
        });
      } catch (error) {
        console.error('Failed to initialize AWS Secrets Manager client:', error);
      }
    }
  }

  /**
   * Get secret from AWS Secrets Manager with caching
   * Falls back to environment variable in development
   */
  async getSecret(secretName: string, envFallback?: string): Promise<string> {
    // In development, use environment variable fallback
    if (config.nodeEnv === 'development' && envFallback) {
      const envValue = process.env[envFallback];
      if (envValue) {
        return envValue;
      }
    }

    // Check cache first
    const cached = this.cache.get(secretName);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    // If not in production or client not initialized, use fallback
    if (!this.client || config.nodeEnv !== 'production') {
      if (envFallback && process.env[envFallback]) {
        return process.env[envFallback];
      }
      throw new Error(`Secret ${secretName} not available and no fallback provided`);
    }

    try {
      const command = new GetSecretValueCommand({
        SecretId: secretName,
      });

      const response = await this.client.send(command);
      
      if (!response.SecretString) {
        throw new Error(`Secret ${secretName} not found or empty`);
      }

      const secretValue = response.SecretString;

      // Cache the secret
      this.cache.set(secretName, {
        value: secretValue,
        expiresAt: Date.now() + this.cacheTTL,
      });

      return secretValue;
    } catch (error: any) {
      console.error(`Failed to retrieve secret ${secretName}:`, error);
      
      // Fallback to environment variable if available
      if (envFallback && process.env[envFallback]) {
        console.warn(`Using environment variable ${envFallback} as fallback for ${secretName}`);
        return process.env[envFallback];
      }
      
      throw new Error(`Failed to retrieve secret ${secretName}: ${error.message}`);
    }
  }

  /**
   * Get encryption key
   */
  async getEncryptionKey(): Promise<string> {
    return this.getSecret(
      'logicgen/encryption-key',
      'ENCRYPTION_KEY'
    );
  }

  /**
   * Get JWT secret
   */
  async getJWTSecret(): Promise<string> {
    return this.getSecret(
      'logicgen/encryption-key',
      'JWT_SECRET'
    );
  }

  /**
   * Get JWT refresh secret
   */
  async getJWTRefreshSecret(): Promise<string> {
    return this.getSecret(
      'logicgen/encryption-key',
      'JWT_REFRESH_SECRET'
    );
  }

  /**
   * Get OIDC client secret
   */
  async getOIDCClientSecret(): Promise<string> {
    return this.getSecret(
      'logicgen/encryption-key',
      'OIDC_CLIENT_SECRET'
    );
  }

  /**
   * Clear cache (useful for testing or after key rotation)
   */
  clearCache(): void {
    this.cache.clear();
  }
}

