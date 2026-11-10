import 'reflect-metadata';
import { AppDataSource } from '../config/database';
import { Client } from '../entities/Client';

async function checkTenant() {
  const subdomain = process.argv[2] || 'testtenant';

  try {
    await AppDataSource.initialize();
    console.log('Connected to database');

    const clientRepository = AppDataSource.getRepository(Client);
    const client = await clientRepository.findOne({
      where: { subdomain, isActive: true },
    });

    if (!client) {
      console.log(`❌ No client found with subdomain: ${subdomain}`);
      process.exit(1);
    }

    console.log(`✅ Found client with subdomain: ${subdomain}`);
    console.log('Client details:');
    console.log('  ID:', client.id);
    console.log('  Name:', client.name);
    console.log('  Subdomain:', client.subdomain);
    console.log('  Database Config:', JSON.stringify(client.databaseConfig, null, 2));
    console.log('  Isolation Level:', client.databaseConfig?.isolationLevel);
    console.log('  Database URL:', client.databaseConfig?.databaseUrl?.replace(/:[^:@]+@/, ':***@'));

    // Also list all clients with similar subdomains
    const allClients = await clientRepository.find({
      where: { isActive: true },
      select: ['id', 'name', 'subdomain', 'databaseConfig'],
    });

    console.log('\nAll active clients:');
    allClients.forEach(c => {
      console.log(`  - ${c.subdomain} (${c.id}): ${c.databaseConfig?.isolationLevel || 'shared'}`);
    });

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error: any) {
    console.error('Error:', error);
    await AppDataSource.destroy().catch(() => {});
    process.exit(1);
  }
}

checkTenant();

