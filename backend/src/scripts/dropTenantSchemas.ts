import 'reflect-metadata';
import { DataSource } from 'typeorm';

// Simple logger to avoid config dependency
const logger = {
  info: (msg: string, meta?: any) => console.log(`[INFO] ${msg}`, meta || ''),
  error: (msg: string, meta?: any) => console.error(`[ERROR] ${msg}`, meta || ''),
  warn: (msg: string, meta?: any) => console.warn(`[WARN] ${msg}`, meta || ''),
};

async function dropTenantSchemas() {
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

    // Get all schemas that match tenant naming pattern
    const schemas = await dataSource.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'tenant_%' 
         OR schema_name LIKE 'tenant-%'
         OR (schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1', 'public')
             AND schema_name NOT LIKE 'pg_%')
      ORDER BY schema_name;
    `);

    if (schemas.length === 0) {
      logger.info('No tenant schemas found');
      process.exit(0);
    }

    logger.info(`Found ${schemas.length} potential tenant schemas:`);
    schemas.forEach((schema: any) => {
      logger.info(`  - ${schema.schema_name}`);
    });

    // Drop each schema
    for (const schema of schemas) {
      const schemaName = schema.schema_name;
      try {
        logger.info(`Dropping schema: ${schemaName}`);
        // CASCADE will drop all objects in the schema
        await dataSource.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`);
        logger.info(`✅ Dropped schema: ${schemaName}`);
      } catch (error: any) {
        logger.error(`Failed to drop schema ${schemaName}:`, { error: error.message });
      }
    }

    logger.info(`\n✅ Successfully processed ${schemas.length} schemas`);

  } catch (error: any) {
    logger.error('Failed to drop tenant schemas', { error: error.message, stack: error.stack });
    process.exit(1);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

dropTenantSchemas();

