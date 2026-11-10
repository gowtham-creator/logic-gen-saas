import crypto from 'crypto';
import { config } from '../config/config';
import { SecretsService } from '../services/SecretsService';

/**
 * Encryption utility with AWS Secrets Manager integration
 * Falls back to environment variables in development
 * 
 * Usage:
 * - Development: Works synchronously with environment variables
 * - Production: Initialize asynchronously with Secrets Manager
 * 
 * Example:
 * ```typescript
 * const encryption = new EncryptionService();
 * // In production, initialize first:
 * await encryption.initializeAsync();
 * // Then use:
 * const encrypted = encryption.encrypt('text');
 * ```
 */
export class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private key: Buffer | null = null;
  private secretsService: SecretsService | null = null;
  private initializationPromise: Promise<void> | null = null;

  constructor(secretsService?: SecretsService) {
    // Use provided secrets service or create one in production
    if (secretsService) {
      this.secretsService = secretsService;
    } else if (config.nodeEnv === 'production') {
      // Only create secrets service in production
      try {
        this.secretsService = new SecretsService();
      } catch (error) {
        console.warn('Failed to initialize SecretsService, falling back to environment variables:', error);
      }
    }

    // In development, initialize synchronously from environment variable
    if (config.nodeEnv === 'development' && !this.secretsService) {
      this.initializeSync();
    }
  }

  /**
   * Synchronous initialization for development (from environment variable)
   */
  private initializeSync(): void {
    const keyString = config.security.encryptionKey;
    if (keyString.length < 32) {
      throw new Error('Encryption key must be at least 32 characters');
    }
    // Use the encryption key itself as salt for key derivation
    // In production, consider using a separate salt stored securely
    this.key = crypto.scryptSync(keyString, keyString.substring(0, 16), 32);
  }

  /**
   * Asynchronous initialization from Secrets Manager (production)
   */
  private async initializeAsync(): Promise<void> {
    if (this.key) {
      return; // Already initialized
    }

    if (!this.secretsService) {
      // Fallback to environment variable if secrets service not available
      this.initializeSync();
      return;
    }

    try {
      const keyString = await this.secretsService.getEncryptionKey();
      
      if (keyString.length < 32) {
        throw new Error('Encryption key must be at least 32 characters');
      }

      // Use the encryption key itself as salt for key derivation
      this.key = crypto.scryptSync(keyString, keyString.substring(0, 16), 32);
    } catch (error) {
      console.error('Failed to initialize encryption key from Secrets Manager:', error);
      // Fallback to environment variable
      this.initializeSync();
    }
  }

  /**
   * Ensure key is initialized before encryption/decryption
   */
  private async ensureInitialized(): Promise<void> {
    if (this.key) {
      return; // Already initialized
    }

    // If initialization is in progress, wait for it
    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    // Start initialization
    this.initializationPromise = this.initializeAsync();
    await this.initializationPromise;
    this.initializationPromise = null;
  }

  /**
   * Initialize encryption service asynchronously (call this in production)
   * This is a public method that ensures initialization
   */
  async initialize(): Promise<void> {
    await this.ensureInitialized();
  }

  /**
   * Encrypt text (synchronous for backward compatibility)
   * In production, ensure initializeAsync() is called first
   */
  encrypt(text: string): string {
    if (!this.key) {
      // If not initialized and in development, initialize now
      if (config.nodeEnv === 'development') {
        this.initializeSync();
      } else {
        throw new Error('Encryption service not initialized. Call initialize() first in production.');
      }
    }

    if (!this.key) {
      throw new Error('Encryption key not available');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv) as crypto.CipherGCM;

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Encrypt text asynchronously (for production with Secrets Manager)
   */
  async encryptAsync(text: string): Promise<string> {
    await this.ensureInitialized();
    return this.encrypt(text);
  }

  /**
   * Decrypt text (synchronous for backward compatibility)
   * In production, ensure initializeAsync() is called first
   */
  decrypt(encryptedText: string): string {
    if (!this.key) {
      // If not initialized and in development, initialize now
      if (config.nodeEnv === 'development') {
        this.initializeSync();
      } else {
        throw new Error('Encryption service not initialized. Call initialize() first in production.');
      }
    }

    if (!this.key) {
      throw new Error('Encryption key not available');
    }

    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv) as crypto.DecipherGCM;
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Decrypt text asynchronously (for production with Secrets Manager)
   */
  async decryptAsync(encryptedText: string): Promise<string> {
    await this.ensureInitialized();
    return this.decrypt(encryptedText);
  }

  /**
   * Reload key from Secrets Manager (useful after key rotation)
   */
  async reloadKey(): Promise<void> {
    this.key = null;
    this.initializationPromise = null;
    await this.ensureInitialized();
  }
}

/**
 * Singleton instance of EncryptionService
 * Initialize this at app startup in production
 */
let encryptionServiceInstance: EncryptionService | null = null;

/**
 * Get or create the singleton EncryptionService instance
 */
export function getEncryptionService(): EncryptionService {
  if (!encryptionServiceInstance) {
    encryptionServiceInstance = new EncryptionService();
  }
  return encryptionServiceInstance;
}

/**
 * Initialize the singleton EncryptionService instance
 * Call this at app startup in production
 */
export async function initializeEncryptionService(): Promise<void> {
  const service = getEncryptionService();
  await service.initialize();
}
