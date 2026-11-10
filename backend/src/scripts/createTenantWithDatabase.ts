import 'reflect-metadata';
import { AppDataSource, getMigrationsPath } from '../config/database';
import { ClientService } from '../services/ClientService';
import { DataSource } from 'typeorm';
import { config } from '../config/config';
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
// Excluded system entities: Client, Plan, ClientSettings, SuperAdmin, SuperAdminRole, SuperAdminRolePermission

/**
 * Parse PostgreSQL connection URL to extract components
 */
function parseDatabaseUrl(url: string): {
  user: string;
  password: string;
  host: string;
  port: number;
  database: string;
} {
  const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) {
    throw new Error('Invalid database URL format');
  }
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: parseInt(match[4], 10),
    database: match[5],
  };
}

/**
 * Create a new PostgreSQL database
 */
async function createDatabase(
  adminUrl: string,
  newDatabaseName: string
): Promise<void> {
  const parsed = parseDatabaseUrl(adminUrl);
  
  // Connect to postgres database (default admin database)
  const adminDataSource = new DataSource({
    type: 'postgres',
    host: parsed.host,
    port: parsed.port,
    username: parsed.user,
    password: parsed.password,
    database: 'postgres', // Connect to default postgres database
    synchronize: false,
    logging: false,
  });

  try {
    await adminDataSource.initialize();
    logger.info('Connected to PostgreSQL admin database');

    // Check if database already exists
    const result = await adminDataSource.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [newDatabaseName]
    );

    if (result.length > 0) {
      logger.warn(`Database "${newDatabaseName}" already exists`);
    } else {
      // Create the database
      await adminDataSource.query(`CREATE DATABASE "${newDatabaseName}"`);
      logger.info(`✅ Created database "${newDatabaseName}"`);
    }

    await adminDataSource.destroy();
  } catch (error: any) {
    await adminDataSource.destroy();
    throw error;
  }
}

/**
 * Run migrations on a new database
 */
async function runMigrationsOnDatabase(databaseUrl: string): Promise<void> {
  const tenantDataSource = new DataSource({
    type: 'postgres',
    url: databaseUrl,
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
      // Excluded system tables: Client, Plan, ClientSettings, SuperAdmin, SuperAdminRole, SuperAdminRolePermission
    ],
    migrations: getMigrationsPath(),
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
  });

  try {
    await tenantDataSource.initialize();
    logger.info('Connected to tenant database');

    const migrations = await tenantDataSource.runMigrations();
    if (migrations.length > 0) {
      logger.info(`✅ Ran ${migrations.length} migration(s) on tenant database:`);
      migrations.forEach((migration) => {
        logger.info(`   - ${migration.name}`);
      });
    } else {
      logger.info('No pending migrations');
    }

    // Fix: Remove ALL foreign key constraints to clients table for database-per-tenant
    // The clients table doesn't exist in tenant databases, so these constraints are invalid
    // Also make clientId columns nullable since they won't reference anything
    logger.info('   Fixing foreign key constraints for database-per-tenant...');
    
    // Find all foreign key constraints that reference the clients table
    // This is more robust than hardcoding constraint names
    try {
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
      
      for (const fk of fkConstraints) {
        try {
          await tenantDataSource.query(`ALTER TABLE "${fk.table_name}" DROP CONSTRAINT IF EXISTS "${fk.constraint_name}"`);
          logger.info(`   ✅ Removed ${fk.constraint_name} from ${fk.table_name}`);
        } catch (error: any) {
          logger.warn(`   ⚠️  Could not remove constraint ${fk.constraint_name} from ${fk.table_name}: ${error.message}`);
        }
      }
    } catch (error: any) {
      logger.warn(`   ⚠️  Could not query foreign key constraints: ${error.message}`);
      // Fallback: Try known constraint names
      const knownConstraints = [
        { table: 'users', constraint: 'users_clientId_fkey' },
        { table: 'roles', constraint: 'roles_clientId_fkey' },
        { table: 'api_keys', constraint: 'api_keys_clientId_fkey' },
        { table: 'client_settings', constraint: 'client_settings_clientId_fkey' },
        { table: 'audit_logs', constraint: 'audit_logs_clientId_fkey' },
        { table: 'themes', constraint: 'themes_clientId_fkey' },
        { table: 'webhooks', constraint: 'FK_webhooks_client' },
        { table: 'role_templates', constraint: 'role_templates_clientId_fkey' },
      ];
      
      for (const { table, constraint } of knownConstraints) {
        try {
          await tenantDataSource.query(`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${constraint}"`);
        } catch (err: any) {
          // Ignore errors in fallback
        }
      }
    }

    // Make clientId columns nullable for database-per-tenant
    // (They won't reference the clients table, so they can be NULL)
    const tablesWithClientId = [
      'users',
      'roles',
      'api_keys',
      'client_settings',
      'audit_logs', // Already nullable, but safe to run
      'themes',
      'webhooks',
      'role_templates',
    ];

    for (const table of tablesWithClientId) {
      try {
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
        }
      } catch (error: any) {
        logger.warn(`   ⚠️  Could not make ${table}.clientId nullable: ${error.message}`);
      }
    }

    logger.info('   ✅ Finished fixing foreign key constraints');

    await tenantDataSource.destroy();
  } catch (error: any) {
    await tenantDataSource.destroy();
    throw error;
  }
}

/**
 * Find an enterprise plan that allows database isolation
 * If found but doesn't allow database isolation, fix it
 */
async function findEnterprisePlan(): Promise<any | null> {
  const { Plan } = await import('../entities/Plan');
  const planRepository = AppDataSource.getRepository(Plan);
  const plans = await planRepository.find({
    where: { isActive: true },
  });

  // Look for enterprise plan with database isolation
  for (const plan of plans) {
    const permissions = plan.databasePermissions as any;
    if (permissions?.allowedIsolationLevels?.includes('database')) {
      return plan;
    }
  }

  // If no plan with database isolation found, check by name
  const enterprisePlan = await planRepository.findOne({
    where: { name: 'enterprise', isActive: true },
  });

  // If enterprise plan exists but doesn't allow database isolation, fix it
  if (enterprisePlan) {
    const permissions = enterprisePlan.databasePermissions as any;
    if (!permissions?.allowedIsolationLevels?.includes('database')) {
      logger.info('   Enterprise plan found but database isolation not enabled. Updating plan...');
      enterprisePlan.databasePermissions = {
        allowedIsolationLevels: ['shared', 'database'],
        allowCustomTables: true,
        allowCustomColumns: true,
        allowCustomMigrations: true,
      };
      await planRepository.save(enterprisePlan);
      logger.info('   ✅ Updated enterprise plan to allow database isolation');
    }
  }

  return enterprisePlan;
}

/**
 * Main function to create a tenant with a separate database
 */
async function createTenantWithDatabase() {
  const tenantName = process.argv[2];
  const tenantSubdomain = process.argv[3];
  const databaseName = process.argv[4] || `tenant_${tenantSubdomain || 'db'}`;
  const planId = process.argv[5]; // Optional plan ID

  if (!tenantName || !tenantSubdomain) {
    console.error('Usage: tsx src/scripts/createTenantWithDatabase.ts <tenantName> <tenantSubdomain> [databaseName] [planId]');
    console.error('Example: tsx src/scripts/createTenantWithDatabase.ts "Acme Corp" acme acme_db');
    console.error('Note: If planId is not provided, the script will try to find an enterprise plan automatically.');
    process.exit(1);
  }

  try {
    // Initialize main database connection
    await AppDataSource.initialize();
    logger.info('Connected to main database');

    // Parse the main database URL to create tenant database URL
    const parsed = parseDatabaseUrl(config.databaseUrl);
    const tenantDatabaseUrl = `postgresql://${parsed.user}:${parsed.password}@${parsed.host}:${parsed.port}/${databaseName}`;

    logger.info(`Creating tenant "${tenantName}" with subdomain "${tenantSubdomain}"`);
    logger.info(`Database name: ${databaseName}`);
    logger.info(`Database URL: ${tenantDatabaseUrl.replace(parsed.password, '***')}`);

    // Step 1: Create the database
    logger.info('\n📦 Step 1: Creating database...');
    await createDatabase(config.databaseUrl, databaseName);

    // Step 2: Run migrations on the new database
    logger.info('\n🔄 Step 2: Running migrations on tenant database...');
    await runMigrationsOnDatabase(tenantDatabaseUrl);

    // Step 3: Find or use enterprise plan
    let finalPlanId = planId;
    if (!finalPlanId) {
      logger.info('\n📋 Step 3a: Finding enterprise plan...');
      const enterprisePlan = await findEnterprisePlan();
      if (enterprisePlan) {
        finalPlanId = enterprisePlan.id;
        logger.info(`   Found enterprise plan: ${enterprisePlan.name} (${enterprisePlan.id})`);
      } else {
        logger.warn('   No enterprise plan found. Creating client without plan (validation will be skipped).');
      }
    }

    // Step 4: Create the client with database-per-tenant configuration
    logger.info('\n👤 Step 4: Creating client with database isolation...');
    const clientService = new ClientService();
    
    // Get admin user details from command line or use defaults
    const adminEmail = process.argv[5] || `admin@${tenantSubdomain}.example.com`;
    const adminPassword = process.argv[6] || 'Admin123!@#';
    const adminFirstName = process.argv[7] || 'Admin';
    const adminLastName = process.argv[8] || 'User';

    const client = await clientService.createClient({
      name: tenantName,
      subdomain: tenantSubdomain,
      planId: finalPlanId,
      databaseConfig: {
        isolationLevel: 'database',
        allowCustomTables: true,
        allowCustomColumns: true,
        allowCustomMigrations: true,
        databaseUrl: tenantDatabaseUrl,
      },
      adminEmail,
      adminPassword,
      adminFirstName,
      adminLastName,
    });

    logger.info(`✅ Created client with ID: ${client.id}`);
    logger.info(`   Name: ${client.name}`);
    logger.info(`   Subdomain: ${client.subdomain}`);
    logger.info(`   Isolation Level: ${client.databaseConfig?.isolationLevel}`);
    logger.info(`   Database URL: ${client.databaseConfig?.databaseUrl?.replace(parsed.password, '***')}`);

    logger.info('\n✅ Tenant with separate database created successfully!');
    logger.info(`\nYou can now access this tenant at: http://${tenantSubdomain}.localhost:3000`);

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error: any) {
    logger.error('Failed to create tenant with database', { error });
    console.error(error);
    await AppDataSource.destroy().catch(() => {});
    process.exit(1);
  }
}

createTenantWithDatabase();

