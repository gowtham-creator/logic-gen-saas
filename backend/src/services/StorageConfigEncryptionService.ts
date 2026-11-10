import { getEncryptionService } from '../utils/encryption';
import { logger } from '../utils/logger';

/**
 * Service for encrypting and decrypting sensitive storage configuration data
 * Handles encryption of credentials for different storage engines (S3, Azure, GCS, etc.)
 */
export class StorageConfigEncryptionService {
  private encryptionService = getEncryptionService();

  /**
   * Sensitive fields that should be encrypted by storage engine type
   */
  readonly SENSITIVE_FIELDS: Record<string, string[]> = {
    s3: ['secretAccessKey'],
    azure: ['accountKey', 'connectionString'],
    gcs: ['privateKey', 'serviceAccountKey', 'credentials'],
    local: [], // Local storage doesn't have sensitive credentials
  };

  /**
   * Encrypt sensitive fields in storage config before saving to database
   * @param config - Storage configuration object
   * @param storageEngineType - Type of storage engine (s3, azure, gcs, local)
   * @returns Encrypted storage configuration
   */
  async encryptStorageConfig(
    config: Record<string, unknown>,
    storageEngineType: string
  ): Promise<Record<string, unknown>> {
    if (!config || typeof config !== 'object') {
      return config;
    }

    const sensitiveFields = this.SENSITIVE_FIELDS[storageEngineType.toLowerCase()] || [];
    if (sensitiveFields.length === 0) {
      return config;
    }

    const encryptedConfig: Record<string, unknown> = { ...config };
    let hasEncryptedFields = false;

    for (const field of sensitiveFields) {
      if (config[field] && typeof config[field] === 'string') {
        try {
          encryptedConfig[field] = await this.encryptionService.encryptAsync(config[field] as string);
          hasEncryptedFields = true;
          logger.debug('Encrypted storage config field', {
            field,
            storageEngineType,
            hasValue: !!config[field]
          });
        } catch (error: any) {
          logger.error('Failed to encrypt storage config field', {
            error: error.message,
            field,
            storageEngineType
          });
          throw new Error(`Failed to encrypt storage configuration field: ${field}`);
        }
      }
    }

    // Add encryption flag if any fields were encrypted
    if (hasEncryptedFields) {
      encryptedConfig._encrypted = true;
      encryptedConfig._storageEngineType = storageEngineType.toLowerCase();
    }

    return encryptedConfig;
  }

  /**
   * Decrypt sensitive fields in storage config after reading from database
   * @param config - Storage configuration object (may be encrypted)
   * @param storageEngineType - Type of storage engine (s3, azure, gcs, local)
   * @returns Decrypted storage configuration
   */
  async decryptStorageConfig(
    config: Record<string, unknown>,
    storageEngineType: string
  ): Promise<Record<string, unknown>> {
    if (!config || typeof config !== 'object') {
      return config;
    }

    const sensitiveFields = this.SENSITIVE_FIELDS[storageEngineType.toLowerCase()] || [];
    if (sensitiveFields.length === 0) {
      return config;
    }

    // Check if encryption flag exists or if fields look encrypted
    const isEncrypted = config._encrypted === true ||
                       this.hasEncryptedFields(config, sensitiveFields);

    if (!isEncrypted) {
      // Not encrypted, return as-is (backward compatibility)
      logger.debug('Storage config not encrypted, returning as-is', {
        storageEngineType,
        hasConfig: !!config
      });
      return config;
    }

    const decryptedConfig: Record<string, unknown> = { ...config };

    // Decrypt sensitive fields
    for (const field of sensitiveFields) {
      if (config[field] && typeof config[field] === 'string' && isEncrypted) {
        try {
          decryptedConfig[field] = await this.encryptionService.decryptAsync(config[field] as string);
          logger.debug('Decrypted storage config field', {
            field,
            storageEngineType
          });
        } catch (error: any) {
          logger.error('Failed to decrypt storage config field', {
            error: error.message,
            field,
            storageEngineType
          });
          throw new Error(`Failed to decrypt storage configuration field: ${field}`);
        }
      }
    }

    // Remove encryption flags
    delete decryptedConfig._encrypted;
    delete decryptedConfig._storageEngineType;

    return decryptedConfig;
  }

  /**
   * Check if any sensitive fields look encrypted
   */
  private hasEncryptedFields(config: Record<string, unknown>, sensitiveFields: string[]): boolean {
    for (const field of sensitiveFields) {
      if (config[field] && typeof config[field] === 'string') {
        if (this.looksEncrypted(config[field] as string)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check if a string looks like encrypted data (format: iv:authTag:encrypted)
   * Encrypted data format: 32 hex chars (IV) : 32 hex chars (auth tag) : encrypted hex string
   */
  looksEncrypted(value: string): boolean {
    if (typeof value !== 'string') {
      return false;
    }
    const parts = value.split(':');
    return parts.length === 3 &&
           parts[0].length === 32 && // IV is 16 bytes = 32 hex chars
           parts[1].length === 32 && // Auth tag is 16 bytes = 32 hex chars
           /^[0-9a-f]+$/i.test(parts[0]) &&
           /^[0-9a-f]+$/i.test(parts[1]);
  }

  /**
   * Sanitize storage config for API responses (remove sensitive fields)
   * @param config - Storage configuration object
   * @param storageEngineType - Type of storage engine (s3, azure, gcs, local)
   * @returns Sanitized storage configuration without sensitive data
   */
  sanitizeStorageConfig(
    config: Record<string, unknown>,
    storageEngineType: string
  ): Record<string, unknown> {
    if (!config || typeof config !== 'object') {
      return config;
    }

    const sensitiveFields = this.SENSITIVE_FIELDS[storageEngineType.toLowerCase()] || [];
    const sanitized = { ...config };

    // Remove sensitive fields
    for (const field of sensitiveFields) {
      delete sanitized[field];
    }

    // Remove encryption flags
    delete sanitized._encrypted;
    delete sanitized._storageEngineType;

    return sanitized;
  }
}

// Singleton instance
let storageEncryptionServiceInstance: StorageConfigEncryptionService | null = null;

/**
 * Get or create the singleton StorageConfigEncryptionService instance
 */
export function getStorageConfigEncryptionService(): StorageConfigEncryptionService {
  if (!storageEncryptionServiceInstance) {
    storageEncryptionServiceInstance = new StorageConfigEncryptionService();
  }
  return storageEncryptionServiceInstance;
}

