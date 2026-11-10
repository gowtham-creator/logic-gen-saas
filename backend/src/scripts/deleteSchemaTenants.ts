import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Client } from '../entities/Client';
import { Plan } from '../entities/Plan';

// Simple logger to avoid config dependency
const logger = {
  info: (msg: string, meta?: any) => console.log(`[INFO] ${msg}`, meta || ''),
  error: (msg: string, meta?: any) => console.error(`[ERROR] ${msg}`, meta || ''),
};

async function deleteSchemaTenants() {
  // Parse DATABASE_URL if available, otherwise use individual env vars
  let dbConfig: any = {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'postgres',
    entities: [Client],
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
      entities: [Client, Plan],
      synchronize: false,
    };
  }

  const dataSource = new DataSource(dbConfig);

  try {
    await dataSource.initialize();
    logger.info('Database connected');

    const clientRepository = dataSource.getRepository(Client);
    
    // Find all clients with schema isolation
    const schemaClients = await clientRepository.find({
      where: {},
    });

    const clientsToDelete: Client[] = [];
    
    // Schema isolation is not supported - this script is deprecated
    // Only shared and database isolation levels are supported
    for (const client of schemaClients) {
      // Skip - schema isolation not supported
      logger.info(`Skipping client ${client.name} - schema isolation not supported`);
    }

    if (clientsToDelete.length === 0) {
      logger.info('No clients with schema isolation found');
      process.exit(0);
    }

    logger.info(`Found ${clientsToDelete.length} clients with schema isolation:`);
    clientsToDelete.forEach(client => {
      logger.info(`  - ${client.name} (${client.subdomain}) - ID: ${client.id}`);
    });

    // Delete all schema-based tenants
    for (const client of clientsToDelete) {
      logger.info(`Deleting client: ${client.name} (${client.id})`);
      await clientRepository.remove(client);
      logger.info(`Deleted client: ${client.name}`);
    }

    logger.info(`\n✅ Successfully deleted ${clientsToDelete.length} schema-based tenants`);

  } catch (error: any) {
    logger.error('Failed to delete schema tenants', { error: error.message, stack: error.stack });
    process.exit(1);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

deleteSchemaTenants();

