/**
 * Script to fix foreign key constraints in existing tenant databases
 * Removes all FK constraints to the clients table and makes clientId columns nullable
 * 
 * Usage: npm run tenant:fix-fks <clientId>
 * Example: npm run tenant:fix-fks testtenant
 */

import { DataSource } from 'typeorm';
import { AppDataSource } from '../config/database';
import { DatabaseConfigService } from '../services/DatabaseConfigService';
import { logger } from '../utils/logger';

async function fixTenantDatabaseFKs() {
  const clientIdOrSubdomain = process.argv[2];

  if (!clientIdOrSubdomain) {
    logger.error('❌ Please provide a client ID or subdomain');
    logger.info('Usage: npm run tenant:fix-fks <clientId|subdomain>');
    process.exit(1);
  }

  try {
    await AppDataSource.initialize();
    logger.info('✅ Connected to main database');

    const dbConfigService = new DatabaseConfigService();
    
    // Get client by ID or subdomain
    let client;
    const clientRepository = AppDataSource.getRepository(require('../entities/Client').Client);
    
    // Try as UUID first, then as subdomain
    if (clientIdOrSubdomain.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      client = await clientRepository.findOne({ where: { id: clientIdOrSubdomain } });
    } else {
      client = await clientRepository.findOne({ where: { subdomain: clientIdOrSubdomain } });
    }

    if (!client) {
      logger.error(`❌ Client not found: ${clientIdOrSubdomain}`);
      process.exit(1);
    }

    logger.info(`📋 Found client: ${client.name} (${client.subdomain})`);

    const config = await dbConfigService.getClientDatabaseConfig(client.id);
    
    if (config.isolationLevel !== 'database') {
      logger.warn(`⚠️  Client is not using database-per-tenant isolation (current: ${config.isolationLevel})`);
      logger.info('This script only fixes database-per-tenant databases.');
      process.exit(0);
    }

    if (!config.databaseUrl) {
      logger.error('❌ No database URL found for this client');
      process.exit(1);
    }

    logger.info(`🔗 Connecting to tenant database: ${config.databaseUrl.replace(/:[^:@]+@/, ':***@')}`);

    const tenantDataSource = new DataSource({
      type: 'postgres',
      url: config.databaseUrl,
      synchronize: false,
      logging: false,
    });

    await tenantDataSource.initialize();
    logger.info('✅ Connected to tenant database');

    // Find all foreign key constraints that reference the clients table
    logger.info('🔍 Finding foreign key constraints to clients table...');
    const fkConstraints = await tenantDataSource.query(`
      SELECT 
        tc.table_name,
        tc.constraint_name,
        kcu.column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'clients'
        AND kcu.column_name = 'clientId'
    `);

    if (fkConstraints.length === 0) {
      logger.info('✅ No foreign key constraints to clients table found');
    } else {
      logger.info(`📋 Found ${fkConstraints.length} foreign key constraint(s) to remove:`);
      for (const fk of fkConstraints) {
        logger.info(`   - ${fk.constraint_name} on ${fk.table_name}.${fk.column_name}`);
      }

      for (const fk of fkConstraints) {
        try {
          await tenantDataSource.query(`ALTER TABLE "${fk.table_name}" DROP CONSTRAINT IF EXISTS "${fk.constraint_name}"`);
          logger.info(`   ✅ Removed ${fk.constraint_name} from ${fk.table_name}`);
        } catch (error: any) {
          logger.error(`   ❌ Could not remove constraint ${fk.constraint_name} from ${fk.table_name}: ${error.message}`);
        }
      }
    }

    // Make clientId columns nullable
    logger.info('🔍 Making clientId columns nullable...');
    const tablesWithClientId = [
      'users',
      'roles',
      'api_keys',
      'client_settings',
      'audit_logs',
      'themes',
      'webhooks',
      'role_templates',
    ];

    let fixedCount = 0;
    for (const table of tablesWithClientId) {
      try {
        // Check if table exists
        const tableExists = await tenantDataSource.query(`
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = $1
        `, [table]);
        
        if (tableExists.length === 0) {
          continue; // Table doesn't exist, skip
        }

        // Check if column exists and is NOT NULL
        const columnInfo = await tenantDataSource.query(`
          SELECT is_nullable 
          FROM information_schema.columns 
          WHERE table_name = $1 
          AND column_name = 'clientId'
        `, [table]);
        
        if (columnInfo.length > 0 && columnInfo[0].is_nullable === 'NO') {
          await tenantDataSource.query(`ALTER TABLE "${table}" ALTER COLUMN "clientId" DROP NOT NULL`);
          logger.info(`   ✅ Made ${table}.clientId nullable`);
          fixedCount++;
        } else if (columnInfo.length > 0) {
          logger.info(`   ℹ️  ${table}.clientId is already nullable`);
        }
      } catch (error: any) {
        logger.warn(`   ⚠️  Could not make ${table}.clientId nullable: ${error.message}`);
      }
    }

    logger.info(`✅ Fixed ${fixedCount} clientId column(s)`);
    logger.info('✅ Finished fixing foreign key constraints');

    await tenantDataSource.destroy();
    await AppDataSource.destroy();
    
    logger.info('✅ Done!');
  } catch (error: any) {
    logger.error(`❌ Error: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

fixTenantDatabaseFKs();

