import 'reflect-metadata';
import { AppDataSource } from '../config/database';
import { Client } from '../entities/Client';
import { getTenantDataSourceManager } from '../services/TenantDataSourceManager';
import { DatabaseConfigService } from '../services/DatabaseConfigService';
import { User } from '../entities/User';
import bcrypt from 'bcryptjs';

async function verifyTenantUser() {
  const subdomain = process.argv[2] || 'testtenant';
  const email = process.argv[3] || 'admin@testtenant.com';
  const password = process.argv[4] || 'Admin123!';

  try {
    await AppDataSource.initialize();
    console.log('✅ Connected to main database');

    // Find the client
    const clientRepository = AppDataSource.getRepository(Client);
    const client = await clientRepository.findOne({
      where: { subdomain, isActive: true },
    });

    if (!client) {
      console.error(`❌ Client not found with subdomain: ${subdomain}`);
      process.exit(1);
    }

    console.log(`✅ Found client: ${client.name} (${client.id})`);
    console.log(`   Subdomain: ${client.subdomain}`);
    console.log(`   Isolation Level: ${client.databaseConfig?.isolationLevel}`);

    // Get tenant DataSource
    const tenantDataSourceManager = getTenantDataSourceManager();
    const dbConfigService = new DatabaseConfigService();
    const config = await dbConfigService.getClientDatabaseConfig(client.id);
    
    console.log(`\n📊 Database Configuration:`);
    console.log(`   Isolation Level: ${config.isolationLevel}`);
    if (config.databaseUrl) {
      console.log(`   Database URL: ${config.databaseUrl.replace(/:[^:@]+@/, ':***@')}`);
    }

    const tenantDataSource = await tenantDataSourceManager.getDataSource(client.id);
    const userRepository = tenantDataSource.getRepository(User);

    // Query user based on isolation level
    let user: User | null = null;
    
    if (config.isolationLevel === 'database') {
      // For database-per-tenant, don't filter by clientId
      user = await userRepository.findOne({
        where: { email, isActive: true },
        select: ['id', 'email', 'passwordHash', 'firstName', 'lastName', 'clientId', 'isActive'],
      });
    } else {
      // For shared and schema-per-tenant, filter by clientId
      user = await userRepository.findOne({
        where: { email, clientId: client.id, isActive: true },
        select: ['id', 'email', 'passwordHash', 'firstName', 'lastName', 'clientId', 'isActive'],
      });
    }

    if (!user) {
      console.error(`\n❌ User not found with email: ${email}`);
      console.log(`\n📋 Checking all users in tenant database...`);
      
      let allUsers: User[] = [];
      if (config.isolationLevel === 'database') {
        allUsers = await userRepository.find({
          select: ['id', 'email', 'firstName', 'lastName'],
        });
      } else {
        allUsers = await userRepository.find({
          where: { clientId: client.id },
          select: ['id', 'email', 'firstName', 'lastName'],
        });
      }
      
      console.log(`   Found ${allUsers.length} user(s):`);
      allUsers.forEach(u => {
        console.log(`     - ${u.email} (${u.firstName} ${u.lastName})`);
      });
      
      process.exit(1);
    }

    console.log(`\n✅ User found:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.firstName} ${user.lastName}`);
    console.log(`   Client ID: ${user.clientId || '(null - database-per-tenant)'}`);
    console.log(`   Active: ${user.isActive}`);

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (isValidPassword) {
      console.log(`\n✅ Password is valid!`);
      console.log(`\n🎉 Login should work with these credentials!`);
    } else {
      console.log(`\n❌ Password is INVALID!`);
      console.log(`   The password "${password}" does not match the stored hash.`);
    }

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error);
    await AppDataSource.destroy().catch(() => {});
    process.exit(1);
  }
}

verifyTenantUser();

