import 'reflect-metadata';
import { DataSource } from 'typeorm';

// Simple logger to avoid config dependency
const logger = {
  info: (msg: string, meta?: any) => console.log(`[INFO] ${msg}`, meta || ''),
  error: (msg: string, meta?: any) => console.error(`[ERROR] ${msg}`, meta || ''),
  warn: (msg: string, meta?: any) => console.warn(`[WARN] ${msg}`, meta || ''),
};

// System tables that should not exist in tenant databases/schemas
const SYSTEM_TABLES = [
  'plans',
  'clients',
  'client_settings',
  'super_admins',
  'super_admin_roles',
  'super_admin_role_permissions',
];

async function removeSystemTablesFromTenants() {
  // Parse DATABASE_URL if available, otherwise use individual env vars
  let dbConfig: any = {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'postgres',
    synchronize: false,
  };

  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    dbConfig = {
      type: 'postgres',
      host: url.hostname,
      port: parseInt(url.port || '5432'),
      username: url.username,
      password: url.password,
      database: url.pathname.slice(1) || 'postgres',
      synchronize: false,
    };
  }

  const dataSource = new DataSource(dbConfig);

  try {
    await dataSource.initialize();
    logger.info('Database connected');

    // Get all tenant databases (databases that start with 'tenant_' or match tenant pattern)
    const databases = await dataSource.query(`
      SELECT datname 
      FROM pg_database 
      WHERE datname LIKE 'tenant_%' 
         OR datname LIKE 'tenant-%'
         AND datname NOT IN ('template0', 'template1', 'postgres')
      ORDER BY datname;
    `);

    logger.info(`Found ${databases.length} tenant databases`);

    // Process each tenant database
    for (const db of databases) {
      const dbName = db.datname;
      logger.info(`\nProcessing database: ${dbName}`);

      // Connect to the tenant database
      const tenantConfig = { ...dbConfig, database: dbName };
      const tenantDataSource = new DataSource(tenantConfig);

      try {
        await tenantDataSource.initialize();
        logger.info(`Connected to ${dbName}`);

        // Get all tables in the database
        const tables = await tenantDataSource.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
          ORDER BY table_name;
        `);

        // Find system tables that exist
        const systemTablesToDrop = tables
          .map((t: any) => t.table_name)
          .filter((tableName: string) => SYSTEM_TABLES.includes(tableName));

        if (systemTablesToDrop.length === 0) {
          logger.info(`  No system tables found in ${dbName}`);
        } else {
          logger.info(`  Found ${systemTablesToDrop.length} system tables to drop:`);
          systemTablesToDrop.forEach((table: string) => {
            logger.info(`    - ${table}`);
          });

          // Drop each system table
          for (const tableName of systemTablesToDrop) {
            try {
              logger.info(`  Dropping table: ${tableName}`);
              await tenantDataSource.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE;`);
              logger.info(`  ✅ Dropped table: ${tableName}`);
            } catch (error: any) {
              logger.error(`  Failed to drop table ${tableName}:`, { error: error.message });
            }
          }
        }

        await tenantDataSource.destroy();
      } catch (error: any) {
        logger.error(`Failed to process database ${dbName}:`, { error: error.message });
        if (tenantDataSource.isInitialized) {
          await tenantDataSource.destroy();
        }
      }
    }

    // Also check for tenant schemas in the main database
    logger.info('\nChecking for tenant schemas in main database...');
    const schemas = await dataSource.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'tenant_%' 
         OR schema_name LIKE 'tenant-%'
      ORDER BY schema_name;
    `);

    if (schemas.length > 0) {
      logger.info(`Found ${schemas.length} tenant schemas`);
      
      for (const schema of schemas) {
        const schemaName = schema.schema_name;
        logger.info(`\nProcessing schema: ${schemaName}`);

        // Get all tables in the schema
        const tables = await dataSource.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = $1 
            AND table_type = 'BASE TABLE'
          ORDER BY table_name;
        `, [schemaName]);

        // Find system tables that exist
        const systemTablesToDrop = tables
          .map((t: any) => t.table_name)
          .filter((tableName: string) => SYSTEM_TABLES.includes(tableName));

        if (systemTablesToDrop.length === 0) {
          logger.info(`  No system tables found in schema ${schemaName}`);
        } else {
          logger.info(`  Found ${systemTablesToDrop.length} system tables to drop:`);
          systemTablesToDrop.forEach((table: string) => {
            logger.info(`    - ${table}`);
          });

          // Drop each system table
          for (const tableName of systemTablesToDrop) {
            try {
              logger.info(`  Dropping table: ${schemaName}.${tableName}`);
              await dataSource.query(`DROP TABLE IF EXISTS "${schemaName}"."${tableName}" CASCADE;`);
              logger.info(`  ✅ Dropped table: ${schemaName}.${tableName}`);
            } catch (error: any) {
              logger.error(`  Failed to drop table ${schemaName}.${tableName}:`, { error: error.message });
            }
          }
        }
      }
    } else {
      logger.info('No tenant schemas found');
    }

    logger.info(`\n✅ Successfully processed all tenant databases and schemas`);

  } catch (error: any) {
    logger.error('Failed to remove system tables from tenants', { error: error.message, stack: error.stack });
    process.exit(1);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

removeSystemTablesFromTenants();

