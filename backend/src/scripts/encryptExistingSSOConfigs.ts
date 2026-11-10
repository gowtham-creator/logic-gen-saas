/**
 * Migration script to encrypt existing unencrypted SSO configurations
 * 
 * This script:
 * 1. Finds all clients with SSO config that has unencrypted clientSecret
 * 2. Encrypts the clientSecret
 * 3. Updates the client record
 * 
 * Usage:
 *   ts-node backend/src/scripts/encryptExistingSSOConfigs.ts
 * 
 * Or via npm:
 *   npm run script:encrypt-sso-configs
 */

import { AppDataSource } from '../config/database';
import { Client } from '../entities/Client';
import { getSSOConfigEncryptionService } from '../services/SSOConfigEncryptionService';
import { initializeEncryptionService } from '../utils/encryption';
import { logger } from '../utils/logger';

async function encryptExistingSSOConfigs() {
  try {
    logger.info('Starting SSO configuration encryption migration...');

    // Initialize database connection
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      logger.info('Database connection initialized');
    }

    // Initialize encryption service
    await initializeEncryptionService();
    logger.info('Encryption service initialized');

    const clientRepository = AppDataSource.getRepository(Client);
    const encryptionService = getSSOConfigEncryptionService();

    // Find all clients with SSO config
    const clients = await clientRepository.find({
      where: {},
    });

    logger.info(`Found ${clients.length} clients to check`);

    let encryptedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const client of clients) {
      if (!client.ssoConfig || !client.ssoConfig.enabled || !client.ssoConfig.metadata) {
        skippedCount++;
        continue;
      }

      const metadata = client.ssoConfig.metadata as any;
      
      // Check if already encrypted
      const isEncrypted = metadata._encrypted === true || 
                         (metadata.clientSecret && encryptionService['looksEncrypted'](metadata.clientSecret));

      if (isEncrypted) {
        logger.debug(`Client ${client.id} (${client.subdomain}) already has encrypted SSO config, skipping`);
        skippedCount++;
        continue;
      }

      // Check if clientSecret exists
      if (!metadata.clientSecret) {
        logger.debug(`Client ${client.id} (${client.subdomain}) has no clientSecret, skipping`);
        skippedCount++;
        continue;
      }

      try {
        // Encrypt the SSO config
        const encryptedConfig = await encryptionService.encryptSSOConfig(client.ssoConfig);
        
        // Update client
        client.ssoConfig = encryptedConfig;
        await clientRepository.save(client);

        logger.info(`✓ Encrypted SSO config for client ${client.id} (${client.subdomain})`);
        encryptedCount++;
      } catch (error: any) {
        logger.error(`✗ Failed to encrypt SSO config for client ${client.id} (${client.subdomain}):`, error.message);
        errorCount++;
      }
    }

    logger.info('=== Migration Summary ===');
    logger.info(`Total clients checked: ${clients.length}`);
    logger.info(`Encrypted: ${encryptedCount}`);
    logger.info(`Skipped (already encrypted or no config): ${skippedCount}`);
    logger.info(`Errors: ${errorCount}`);

    if (errorCount > 0) {
      logger.warn('Some clients failed to encrypt. Please review the errors above.');
      process.exit(1);
    } else {
      logger.info('✓ All SSO configurations encrypted successfully!');
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
  encryptExistingSSOConfigs().catch((error) => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { encryptExistingSSOConfigs };

