import 'reflect-metadata';
import { AppDataSource, getMigrationsPath } from '../config/database';
import { Client } from '../entities/Client';
import { DatabaseConfigService } from '../services/DatabaseConfigService';
import { DataSource } from 'typeorm';
import { logger } from '../utils/logger';
import { User } from '../entities/User';
import { Role } from '../entities/Role';
import { Permission } from '../entities/Permission';
import { RolePermission } from '../entities/RolePermission';
import { ApiKey } from '../entities/ApiKey';
import { AuditLog } from '../entities/AuditLog';
import { Theme } from '../entities/Theme';
import { RoleTemplate } from '../entities/RoleTemplate';
import { RoleTemplatePermission } from '../entities/RoleTemplatePermission';
import { Webhook } from '../entities/Webhook';
import { WebhookEvent } from '../entities/WebhookEvent';
import { CustomTable } from '../entities/CustomTable';
import { Workflow } from '../entities/Workflow';
import { WorkflowFile } from '../entities/WorkflowFile';

/**
 * Script to run migrations on all tenant databases
 * - Main database (shared isolation)
 * - All tenant databases (database-per-tenant isolation)
 */
async function runMigrationsOnAllTenants() {
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

    // Process main database first (for shared isolation)
    logger.info('\n📦 Running migrations on main database (shared isolation)...');
    await runMigrationsOnDatabase(AppDataSource, 'main database');

    // Process each tenant database
    let databaseClientCount = 0;
    let successCount = 0;
    let errorCount = 0;

    for (const client of allClients) {
      const config = await dbConfigService.getClientDatabaseConfig(client.id);
      
      if (config.isolationLevel === 'database' && config.databaseUrl) {
        databaseClientCount++;
        logger.info(`\n📦 Running migrations on tenant database for client: ${client.name} (${client.subdomain})`);
        
        try {
          // Create tenant DataSource with all entities (excluding system tables)
          const tenantDataSource = new DataSource({
            type: 'postgres',
            url: config.databaseUrl,
            entities: [
              User,
              Role,
              Permission,
              RolePermission,
              ApiKey,
              AuditLog,
              Theme,
              RoleTemplate,
              RoleTemplatePermission,
              Webhook,
              WebhookEvent,
              CustomTable,
              Workflow,
              WorkflowFile,
              // Excluded system tables: Client, Plan, ClientSettings, SuperAdmin, StorageEngine, StorageConfig
            ],
            migrations: getMigrationsPath(),
            synchronize: false,
            logging: process.env.NODE_ENV === 'development',
          });

          await tenantDataSource.initialize();
          await runMigrationsOnDatabase(tenantDataSource, `tenant database (${client.name})`);
          await tenantDataSource.destroy();
          successCount++;
        } catch (error: any) {
          errorCount++;
          logger.error(`❌ Failed to run migrations on tenant database for ${client.name}:`, error.message);
          if (error.stack) {
            logger.error(error.stack);
          }
          // Continue with other databases
        }
      }
    }

    logger.info('\n✅ Migration Summary:');
    logger.info(`   - Main database: processed`);
    logger.info(`   - Tenant databases found: ${databaseClientCount}`);
    logger.info(`   - Successful: ${successCount}`);
    logger.info(`   - Failed: ${errorCount}`);

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
 * Run migrations on a database
 */
async function runMigrationsOnDatabase(dataSource: DataSource, dbName: string): Promise<void> {
  try {
    // Ensure migrations table exists
    try {
      await dataSource.query(`
        CREATE TABLE IF NOT EXISTS "migrations" (
          "id" SERIAL PRIMARY KEY,
          "timestamp" BIGINT NOT NULL,
          "name" VARCHAR NOT NULL
        );
      `);
    } catch (tableError: any) {
      // Table might already exist, which is fine
      if (!tableError.message?.includes('already exists')) {
        logger.warn(`   ⚠️  Could not ensure migrations table exists: ${tableError.message}`);
      }
    }

    logger.info(`   🔄 Running migrations on ${dbName}...`);
    
    const migrations = await dataSource.runMigrations();
    
    if (migrations.length > 0) {
      logger.info(`   ✅ Ran ${migrations.length} migration(s) on ${dbName}:`);
      migrations.forEach((migration) => {
        logger.info(`      - ${migration.name}`);
      });
    } else {
      logger.info(`   ℹ️  No pending migrations for ${dbName}`);
    }
  } catch (error: any) {
    logger.error(`   ❌ Failed to run migrations on ${dbName}:`, error.message);
    if (error.stack) {
      logger.error(`   Stack trace:`, error.stack);
    }
    throw error;
  }
}

runMigrationsOnAllTenants();

