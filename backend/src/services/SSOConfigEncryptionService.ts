import { getEncryptionService } from '../utils/encryption';
import { OIDCMetadata } from './SSOService';
import { logger } from '../utils/logger';

/**
 * Service for encrypting and decrypting sensitive SSO configuration data
 * Specifically handles encryption of clientSecret in OIDC metadata
 */
export class SSOConfigEncryptionService {
  private encryptionService = getEncryptionService();

  /**
   * Encrypt sensitive fields in SSO metadata before saving to database
   * @param ssoConfig - SSO configuration object
   * @returns Encrypted SSO configuration
   */
  async encryptSSOConfig(ssoConfig: any): Promise<any> {
    if (!ssoConfig || !ssoConfig.metadata) {
      return ssoConfig;
    }

    const metadata = ssoConfig.metadata as OIDCMetadata;
    
    // Create encrypted copy
    const encryptedMetadata: any = { ...metadata };
    
    // Encrypt clientSecret if present
    if (metadata.clientSecret) {
      try {
        encryptedMetadata.clientSecret = await this.encryptionService.encryptAsync(metadata.clientSecret);
        encryptedMetadata._encrypted = true; // Flag to indicate encryption
        logger.debug('Encrypted SSO clientSecret', { 
          hasClientSecret: !!metadata.clientSecret,
          issuer: metadata.issuer 
        });
      } catch (error: any) {
        logger.error('Failed to encrypt SSO clientSecret', { 
          error: error.message,
          issuer: metadata.issuer 
        });
        throw new Error('Failed to encrypt SSO configuration');
      }
    }

    return {
      ...ssoConfig,
      metadata: encryptedMetadata,
    };
  }

  /**
   * Decrypt sensitive fields in SSO metadata after reading from database
   * @param ssoConfig - SSO configuration object (may be encrypted)
   * @returns Decrypted SSO configuration
   */
  async decryptSSOConfig(ssoConfig: any): Promise<any> {
    if (!ssoConfig || !ssoConfig.metadata) {
      return ssoConfig;
    }

    const metadata = ssoConfig.metadata as any;
    
    // Check if encryption flag exists (new encrypted data) or if clientSecret looks encrypted (old format)
    const isEncrypted = metadata._encrypted === true || 
                       (metadata.clientSecret && this.looksEncrypted(metadata.clientSecret));

    if (!isEncrypted) {
      // Not encrypted, return as-is (backward compatibility with existing unencrypted data)
      logger.debug('SSO config not encrypted, returning as-is', {
        hasMetadata: !!metadata,
        hasClientSecret: !!metadata.clientSecret
      });
      return ssoConfig;
    }

    // Create decrypted copy
    const decryptedMetadata: any = { ...metadata };
    
    // Decrypt clientSecret if present
    if (metadata.clientSecret && isEncrypted) {
      try {
        decryptedMetadata.clientSecret = await this.encryptionService.decryptAsync(metadata.clientSecret);
        delete decryptedMetadata._encrypted; // Remove encryption flag
        logger.debug('Decrypted SSO clientSecret', {
          issuer: metadata.issuer
        });
      } catch (error: any) {
        logger.error('Failed to decrypt SSO clientSecret', { 
          error: error.message,
          issuer: metadata.issuer 
        });
        throw new Error('Failed to decrypt SSO configuration');
      }
    }

    return {
      ...ssoConfig,
      metadata: decryptedMetadata,
    };
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
   * Sanitize SSO config for API responses (remove sensitive fields)
   * @param ssoConfig - SSO configuration object
   * @returns Sanitized SSO configuration without sensitive data
   */
  sanitizeSSOConfig(ssoConfig: any): any {
    if (!ssoConfig || !ssoConfig.metadata) {
      return ssoConfig;
    }

    const metadata = ssoConfig.metadata as any;
    const sanitizedMetadata = { ...metadata };
    
    // Remove sensitive fields
    delete sanitizedMetadata.clientSecret;
    delete sanitizedMetadata._encrypted;

    return {
      ...ssoConfig,
      metadata: sanitizedMetadata,
    };
  }
}

// Singleton instance
let ssoEncryptionServiceInstance: SSOConfigEncryptionService | null = null;

/**
 * Get or create the singleton SSOConfigEncryptionService instance
 */
export function getSSOConfigEncryptionService(): SSOConfigEncryptionService {
  if (!ssoEncryptionServiceInstance) {
    ssoEncryptionServiceInstance = new SSOConfigEncryptionService();
  }
  return ssoEncryptionServiceInstance;
}

