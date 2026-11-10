import 'reflect-metadata';
import { AppDataSource } from '../config/database';
import { Client } from '../entities/Client';
import { DatabaseConfigService } from '../services/DatabaseConfigService';
import { DataSource } from 'typeorm';
import { logger } from '../utils/logger';

/**
 * Script to add isSuperAdmin column to users table in all configured databases
 * - Main database (shared isolation)
 * - All tenant databases (database-per-tenant isolation)
 */
async function addIsSuperAdminToAllDatabases() {
  try {
    // Initialize main database connection
    await AppDataSource.initialize();
    logger.info('✅ Connected to main database');

    const clientRepository = AppDataSource.getRepository(Client);
    const dbConfigService = new DatabaseConfigService();

    // Get all clients
    const allClients = await clientRepository.find({
      where: { isActive: true },
    });

    logger.info(`Found ${allClients.length} active clients`);

    // Process main database first (for shared isolation users)
    logger.info('\n📦 Processing main database (shared isolation)...');
    await addColumnToDatabase(AppDataSource, 'main database');

    // Process each tenant database
    let databaseClientCount = 0;
    for (const client of allClients) {
      const config = await dbConfigService.getClientDatabaseConfig(client.id);
      
      if (config.isolationLevel === 'database' && config.databaseUrl) {
        databaseClientCount++;
        logger.info(`\n📦 Processing tenant database for client: ${client.name} (${client.subdomain})`);
        
        try {
          // Parse database URL to get connection details
          const tenantDataSource = new DataSource({
            type: 'postgres',
            url: config.databaseUrl,
            synchronize: false,
            logging: false,
          });

          await tenantDataSource.initialize();
          await addColumnToDatabase(tenantDataSource, `tenant database (${client.name})`);
          await tenantDataSource.destroy();
        } catch (error: any) {
          logger.error(`❌ Failed to process tenant database for ${client.name}:`, error.message);
          // Continue with other databases
        }
      }
    }

    logger.info('\n✅ Completed adding isSuperAdmin column to all databases');
    await AppDataSource.destroy();
    process.exit(0);
  } catch (error: any) {
    logger.error('❌ Error:', error.message);
    if (error.stack) {
      logger.error(error.stack);
    }
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    process.exit(1);
  }
}

/**
 * Add isSuperAdmin column to users table in a database
 */
async function addColumnToDatabase(dataSource: DataSource, dbName: string): Promise<void> {
  try {
    // Check if column already exists
    const columnExists = await dataSource.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'isSuperAdmin';
    `);

    if (columnExists.length > 0) {
      logger.info(`   ℹ️  Column 'isSuperAdmin' already exists in ${dbName}`);
      return;
    }

    // Add the column
    logger.info(`   🔄 Adding 'isSuperAdmin' column to users table in ${dbName}...`);
    await dataSource.query(`
      ALTER TABLE "users" 
      ADD COLUMN "isSuperAdmin" boolean NOT NULL DEFAULT false;
    `);

    // Create index
    logger.info(`   🔄 Creating index on 'isSuperAdmin' column in ${dbName}...`);
    await dataSource.query(`
      CREATE INDEX "IDX_users_isSuperAdmin" 
      ON "users" ("isSuperAdmin") 
      WHERE "isSuperAdmin" = true;
    `);

    logger.info(`   ✅ Successfully added 'isSuperAdmin' column to ${dbName}`);
  } catch (error: any) {
    // If column already exists (different error), log and continue
    if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
      logger.info(`   ℹ️  Column 'isSuperAdmin' already exists in ${dbName} (different error format)`);
      return;
    }
    throw error;
  }
}

addIsSuperAdminToAllDatabases();

