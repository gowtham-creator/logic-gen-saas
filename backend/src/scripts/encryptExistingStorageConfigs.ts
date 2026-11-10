/**
 * Migration script to encrypt existing unencrypted storage configurations
 * 
 * This script:
 * 1. Finds all storage configs with unencrypted credentials
 * 2. Encrypts sensitive fields (secretAccessKey, accountKey, connectionString, etc.)
 * 3. Updates the storage config records
 * 
 * Usage:
 *   ts-node backend/src/scripts/encryptExistingStorageConfigs.ts
 * 
 * Or via npm:
 *   npm run script:encrypt-storage-configs
 */

import { AppDataSource } from '../config/database';
import { StorageConfig } from '../entities/StorageConfig';
import { StorageEngine } from '../entities/StorageEngine';
import { getStorageConfigEncryptionService } from '../services/StorageConfigEncryptionService';
import { initializeEncryptionService } from '../utils/encryption';
import { logger } from '../utils/logger';

async function encryptExistingStorageConfigs() {
  try {
    logger.info('Starting storage configuration encryption migration...');

    // Initialize database connection
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      logger.info('Database connection initialized');
    }

    // Initialize encryption service
    await initializeEncryptionService();
    logger.info('Encryption service initialized');

    const storageConfigRepository = AppDataSource.getRepository(StorageConfig);
    const storageEngineRepository = AppDataSource.getRepository(StorageEngine);
    const encryptionService = getStorageConfigEncryptionService();

    // Find all storage configs
    const storageConfigs = await storageConfigRepository.find({
      relations: ['storageEngine'],
    });

    logger.info(`Found ${storageConfigs.length} storage configs to check`);

    let encryptedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const storageConfig of storageConfigs) {
      if (!storageConfig.storageEngine || !storageConfig.config) {
        logger.debug(`Storage config ${storageConfig.id} has no engine or config, skipping`);
        skippedCount++;
        continue;
      }

      const storageEngineType = storageConfig.storageEngine.type;
      const config = storageConfig.config;

      // Check if already encrypted
      const isEncrypted = config._encrypted === true ||
                         encryptionService.looksEncrypted(config.secretAccessKey as string || '') ||
                         encryptionService.looksEncrypted(config.accountKey as string || '') ||
                         encryptionService.looksEncrypted(config.connectionString as string || '');

      if (isEncrypted) {
        logger.debug(`Storage config ${storageConfig.id} (${storageEngineType}) already encrypted, skipping`);
        skippedCount++;
        continue;
      }

      // Check if config has any sensitive fields that need encryption
      const sensitiveFields = encryptionService.SENSITIVE_FIELDS[storageEngineType.toLowerCase()] || [];
      const hasSensitiveFields = sensitiveFields.some(field => config[field]);

      if (!hasSensitiveFields) {
        logger.debug(`Storage config ${storageConfig.id} (${storageEngineType}) has no sensitive fields, skipping`);
        skippedCount++;
        continue;
      }

      try {
        // Encrypt the storage config
        const encryptedConfig = await encryptionService.encryptStorageConfig(config, storageEngineType);
        
        // Update storage config
        storageConfig.config = encryptedConfig;
        await storageConfigRepository.save(storageConfig);

        logger.info(`✓ Encrypted storage config ${storageConfig.id} (${storageEngineType})`);
        encryptedCount++;
      } catch (error: any) {
        logger.error(`✗ Failed to encrypt storage config ${storageConfig.id} (${storageEngineType}):`, error.message);
        errorCount++;
      }
    }

    logger.info('=== Migration Summary ===');
    logger.info(`Total storage configs checked: ${storageConfigs.length}`);
    logger.info(`Encrypted: ${encryptedCount}`);
    logger.info(`Skipped (already encrypted or no sensitive fields): ${skippedCount}`);
    logger.info(`Errors: ${errorCount}`);

    if (errorCount > 0) {
      logger.warn('Some storage configs failed to encrypt. Please review the errors above.');
      process.exit(1);
    } else {
      logger.info('✓ All storage configurations encrypted successfully!');
      process.exit(0);
    }
  } catch (error: any) {
    logger.error('Fatal error during migration:', error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      logger.info('Database connection closed');
    }
  }
}

// Run the migration
if (require.main === module) {
  encryptExistingStorageConfigs().catch((error) => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { encryptExistingStorageConfigs };

