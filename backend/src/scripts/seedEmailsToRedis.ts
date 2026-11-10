import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { Client } from '../entities/Client';
import { getEmailUniquenessService } from '../services/EmailUniquenessService';
import { TenantDataSourceManager } from '../services/TenantDataSourceManager';
import { DatabaseConfigService } from '../services/DatabaseConfigService';
import { logger } from '../utils/logger';

/**
 * Script to seed all existing emails from databases into Redis
 * This should be run once to populate Redis with existing emails
 */
async function seedEmailsToRedis() {
  try {
    logger.info('Starting email seeding to Redis...');

    // Initialize main database connection
    await AppDataSource.initialize();
    logger.info('Connected to main database');

    const emailUniquenessService = getEmailUniquenessService();
    
    // Wait a bit for Redis to connect
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (!emailUniquenessService.isRedisConnected()) {
      logger.error('Redis is not connected. Please ensure Redis is running.');
      process.exit(1);
    }

    let totalEmails = 0;

    // 1. Get all users from main database (shared isolation)
    logger.info('Seeding emails from main database (shared isolation)...');
    const mainUserRepository = AppDataSource.getRepository(User);
    const mainUsers = await mainUserRepository.find({
      select: ['email'],
    });

    for (const user of mainUsers) {
      if (user.email) {
        await emailUniquenessService.addEmail(user.email);
        totalEmails++;
      }
    }
    logger.info(`Added ${mainUsers.length} emails from main database`);

    // 2. Get all users from tenant databases (database-per-tenant)
    logger.info('Seeding emails from tenant databases (database-per-tenant)...');
    const clientRepository = AppDataSource.getRepository(Client);
    const dbConfigService = new DatabaseConfigService();
    const tenantDataSourceManager = new TenantDataSourceManager(AppDataSource);

    const allClients = await clientRepository.find();
    let tenantEmails = 0;

    for (const client of allClients) {
      try {
        const config = await dbConfigService.getClientDatabaseConfig(client.id);
        
        if (config.isolationLevel === 'database') {
          logger.info(`Checking tenant database for client: ${client.name} (${client.id})`);
          
          try {
            const tenantDataSource = await tenantDataSourceManager.getDataSource(client.id);
            const tenantUserRepository = tenantDataSource.getRepository(User);
            const tenantUsers = await tenantUserRepository.find({
              select: ['email'],
            });

            for (const user of tenantUsers) {
              if (user.email) {
                await emailUniquenessService.addEmail(user.email);
                tenantEmails++;
                totalEmails++;
              }
            }
            
            logger.info(`Added ${tenantUsers.length} emails from tenant ${client.name}`);
          } catch (error: any) {
            logger.warn(`Failed to get users from tenant ${client.name}: ${error.message}`);
          }
        }
      } catch (error: any) {
        logger.warn(`Failed to get config for client ${client.id}: ${error.message}`);
      }
    }

    logger.info(`Added ${tenantEmails} emails from tenant databases`);

    // 3. Get final count
    const finalCount = await emailUniquenessService.getEmailCount();
    logger.info(`\n✅ Email seeding completed!`);
    logger.info(`   Total emails processed: ${totalEmails}`);
    logger.info(`   Total unique emails in Redis: ${finalCount}`);

    await AppDataSource.destroy();
    await emailUniquenessService.close();
    
    process.exit(0);
  } catch (error: any) {
    logger.error('Error seeding emails to Redis', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Run the script
seedEmailsToRedis();

