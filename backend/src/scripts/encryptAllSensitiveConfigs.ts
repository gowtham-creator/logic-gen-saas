/**
 * Unified migration script to encrypt all existing unencrypted sensitive configurations
 * 
 * This script encrypts:
 * 1. SSO configurations (clientSecret in OIDC metadata)
 * 2. Storage configurations (secretAccessKey, accountKey, connectionString, etc.)
 * 
 * Usage:
 *   ts-node backend/src/scripts/encryptAllSensitiveConfigs.ts
 * 
 * Or via npm:
 *   npm run script:encrypt-all-configs
 * 
 * Options:
 *   --sso-only      Only encrypt SSO configurations
 *   --storage-only  Only encrypt storage configurations
 *   --dry-run       Show what would be encrypted without making changes
 */

import { AppDataSource } from '../config/database';
import { Client } from '../entities/Client';
import { StorageConfig } from '../entities/StorageConfig';
import { StorageEngine } from '../entities/StorageEngine';
import { getSSOConfigEncryptionService } from '../services/SSOConfigEncryptionService';
import { getStorageConfigEncryptionService } from '../services/StorageConfigEncryptionService';
import { initializeEncryptionService } from '../utils/encryption';
import { logger } from '../utils/logger';
import { IsNull } from 'typeorm';

interface MigrationOptions {
  ssoOnly?: boolean;
  storageOnly?: boolean;
  dryRun?: boolean;
}

interface MigrationSummary {
  sso: {
    total: number;
    encrypted: number;
    skipped: number;
    errors: number;
  };
  storage: {
    total: number;
    encrypted: number;
    skipped: number;
    errors: number;
  };
}

async function encryptSSOConfigs(dryRun: boolean = false): Promise<MigrationSummary['sso']> {
  logger.info('=== Starting SSO Configuration Encryption ===');

  const clientRepository = AppDataSource.getRepository(Client);
  const ssoEncryptionService = getSSOConfigEncryptionService();

  const clients = await clientRepository.find({
    where: { deletedAt: IsNull() },
  });

  logger.info(`Found ${clients.length} clients to check for SSO configurations`);

  let encryptedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const client of clients) {
    if (client.ssoConfig && client.ssoConfig.enabled && client.ssoConfig.metadata) {
      const metadata = client.ssoConfig.metadata as any;
      
      // Check if clientSecret exists and doesn't look encrypted already
      const isAlreadyEncrypted = metadata._encrypted === true || 
                                 (metadata.clientSecret && ssoEncryptionService.looksEncrypted(metadata.clientSecret));

      if (metadata.clientSecret && !isAlreadyEncrypted) {
        if (dryRun) {
          logger.info(`[DRY RUN] Would encrypt SSO config for client: ${client.id} (${client.subdomain})`);
          encryptedCount++;
        } else {
          logger.info(`Encrypting SSO config for client: ${client.id} (${client.subdomain})`);
          try {
            const encryptedSSOConfig = await ssoEncryptionService.encryptSSOConfig(client.ssoConfig);
            client.ssoConfig = encryptedSSOConfig;
            await clientRepository.save(client);
            encryptedCount++;
            logger.info(`✓ Successfully encrypted SSO config for client: ${client.id}`);
          } catch (error: any) {
            logger.error(`✗ Error encrypting SSO config for client ${client.id}: ${error.message}`, { error });
            errorCount++;
          }
        }
      } else {
        skippedCount++;
        logger.debug(`Skipping SSO config for client ${client.id} (already encrypted or no clientSecret)`);
      }
    }
  }

  logger.info('=== SSO Configuration Encryption Complete ===');
  logger.info(`Total clients checked: ${clients.length}`);
  logger.info(`Encrypted: ${encryptedCount}`);
  logger.info(`Skipped (already encrypted or no clientSecret): ${skippedCount}`);
  logger.info(`Errors: ${errorCount}`);

  return {
    total: clients.length,
    encrypted: encryptedCount,
    skipped: skippedCount,
    errors: errorCount,
  };
}

async function encryptStorageConfigs(dryRun: boolean = false): Promise<MigrationSummary['storage']> {
  logger.info('=== Starting Storage Configuration Encryption ===');

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

    if (dryRun) {
      logger.info(`[DRY RUN] Would encrypt storage config ${storageConfig.id} (${storageEngineType})`);
      encryptedCount++;
    } else {
      try {
        // Encrypt the storage config
        const encryptedConfig = await encryptionService.encryptStorageConfig(config, storageEngineType);
        
        // Update storage config
        storageConfig.config = encryptedConfig;
        await storageConfigRepository.save(storageConfig);

        logger.info(`✓ Encrypted storage config ${storageConfig.id} (${storageEngineType})`);
        encryptedCount++;
      } catch (error: any) {
        logger.error(`✗ Failed to encrypt storage config ${storageConfig.id} (${storageEngineType}): ${error.message}`, { error });
        errorCount++;
      }
    }
  }

  logger.info('=== Storage Configuration Encryption Complete ===');
  logger.info(`Total storage configs checked: ${storageConfigs.length}`);
  logger.info(`Encrypted: ${encryptedCount}`);
  logger.info(`Skipped (already encrypted or no sensitive fields): ${skippedCount}`);
  logger.info(`Errors: ${errorCount}`);

  return {
    total: storageConfigs.length,
    encrypted: encryptedCount,
    skipped: skippedCount,
    errors: errorCount,
  };
}

async function encryptAllSensitiveConfigs(options: MigrationOptions = {}) {
  const { ssoOnly = false, storageOnly = false, dryRun = false } = options;

  try {
    logger.info('========================================');
    logger.info('Sensitive Configuration Encryption Migration');
    logger.info('========================================');
    
    if (dryRun) {
      logger.warn('⚠️  DRY RUN MODE - No changes will be made');
    }
    
    logger.info('');

    // Initialize database connection
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      logger.info('✓ Database connection initialized');
    }

    // Initialize encryption service
    await initializeEncryptionService();
    logger.info('✓ Encryption service initialized');
    logger.info('');

    const summary: MigrationSummary = {
      sso: { total: 0, encrypted: 0, skipped: 0, errors: 0 },
      storage: { total: 0, encrypted: 0, skipped: 0, errors: 0 },
    };

    // Encrypt SSO configurations
    if (!storageOnly) {
      summary.sso = await encryptSSOConfigs(dryRun);
      logger.info('');
    } else {
      logger.info('Skipping SSO configuration encryption (--storage-only flag)');
      logger.info('');
    }

    // Encrypt storage configurations
    if (!ssoOnly) {
      summary.storage = await encryptStorageConfigs(dryRun);
      logger.info('');
    } else {
      logger.info('Skipping storage configuration encryption (--sso-only flag)');
      logger.info('');
    }

    // Print final summary
    logger.info('========================================');
    logger.info('Migration Summary');
    logger.info('========================================');
    
    if (!storageOnly) {
      logger.info('SSO Configurations:');
      logger.info(`  Total checked: ${summary.sso.total}`);
      logger.info(`  Encrypted: ${summary.sso.encrypted}`);
      logger.info(`  Skipped: ${summary.sso.skipped}`);
      logger.info(`  Errors: ${summary.sso.errors}`);
      logger.info('');
    }

    if (!ssoOnly) {
      logger.info('Storage Configurations:');
      logger.info(`  Total checked: ${summary.storage.total}`);
      logger.info(`  Encrypted: ${summary.storage.encrypted}`);
      logger.info(`  Skipped: ${summary.storage.skipped}`);
      logger.info(`  Errors: ${summary.storage.errors}`);
      logger.info('');
    }

    const totalErrors = summary.sso.errors + summary.storage.errors;
    const totalEncrypted = summary.sso.encrypted + summary.storage.encrypted;

    if (dryRun) {
      logger.info(`[DRY RUN] Would encrypt ${totalEncrypted} configurations`);
      logger.info('Run without --dry-run to apply changes');
    } else if (totalErrors > 0) {
      logger.warn(`⚠️  Migration completed with ${totalErrors} error(s). Please review the errors above.`);
      process.exit(1);
    } else {
      logger.info(`✓ Migration completed successfully!`);
      logger.info(`✓ Encrypted ${totalEncrypted} configuration(s)`);
      process.exit(0);
    }
  } catch (error: any) {
    logger.error('Fatal error during migration:', error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      logger.info('✓ Database connection closed');
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: MigrationOptions = {
  ssoOnly: args.includes('--sso-only'),
  storageOnly: args.includes('--storage-only'),
  dryRun: args.includes('--dry-run'),
};

// Validate options
if (options.ssoOnly && options.storageOnly) {
  logger.error('Error: Cannot use both --sso-only and --storage-only flags');
  process.exit(1);
}

// Run the migration
if (require.main === module) {
  encryptAllSensitiveConfigs(options).catch((error) => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { encryptAllSensitiveConfigs };

