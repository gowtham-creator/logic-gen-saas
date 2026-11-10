import 'reflect-metadata';
import { AppDataSource } from '../config/database';
import { getTenantDataSourceManager } from '../services/TenantDataSourceManager';
import { DatabaseConfigService } from '../services/DatabaseConfigService';
import { User } from '../entities/User';
import { Client } from '../entities/Client';
import { logger } from '../utils/logger';
import bcrypt from 'bcryptjs';
import { QueryRunner } from 'typeorm';

/**
 * Create a user for a tenant
 */
async function createTenantUser() {
  const tenantIdentifier = process.argv[2]; // subdomain or clientId
  const email = process.argv[3];
  const password = process.argv[4];
  const firstName = process.argv[5];
  const lastName = process.argv[6];
  const roleId = process.argv[7]; // Optional

  if (!tenantIdentifier || !email || !password || !firstName || !lastName) {
    console.error('Usage: tsx src/scripts/createTenantUser.ts <tenantSubdomain|tenantId> <email> <password> <firstName> <lastName> [roleId]');
    console.error('Example: tsx src/scripts/createTenantUser.ts testtenant user@example.com password123 John Doe');
    process.exit(1);
  }

  try {
    // Initialize main database connection
    await AppDataSource.initialize();
    logger.info('Connected to main database');

    // Find the client
    const clientRepository = AppDataSource.getRepository(Client);
    
    // Check if tenantIdentifier is a UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantIdentifier);
    
    const client = isUUID
      ? await clientRepository.findOne({ where: { id: tenantIdentifier } })
      : await clientRepository.findOne({ where: { subdomain: tenantIdentifier } });

    if (!client) {
      logger.error(`Client not found with subdomain or ID: ${tenantIdentifier}`);
      process.exit(1);
    }

    logger.info(`Found client: ${client.name} (${client.id})`);
    logger.info(`Subdomain: ${client.subdomain}`);

    // Get tenant DataSource
    const tenantDataSourceManager = getTenantDataSourceManager();
    const dbConfigService = new DatabaseConfigService();
    const config = await dbConfigService.getClientDatabaseConfig(client.id);
    
    logger.info(`Isolation level: ${config.isolationLevel}`);

    // Schema isolation is not supported - only shared and database isolation levels

    const tenantDataSource = await tenantDataSourceManager.getDataSource(client.id);
    const userRepository = tenantDataSource.getRepository(User);

    // Check if user already exists
    const existingUser = await userRepository.findOne({
      where: { email, clientId: client.id },
    });

    if (existingUser) {
      logger.error(`User with email ${email} already exists in this tenant`);
      process.exit(1);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    let queryRunner: QueryRunner | undefined;
    let actualUserRepository = userRepository;

    try {
      let savedUser: User;

      // For database-per-tenant, use raw SQL since clientId column exists but shouldn't be used
      // The migration creates the table with NOT NULL clientId, but for database-per-tenant
      // we need to make it nullable first, then insert without it
      if (config.isolationLevel === 'database') {
        // Use raw SQL to make clientId nullable and insert without it
        const queryRunner = tenantDataSource.createQueryRunner();
        await queryRunner.connect();
        
        // Make clientId nullable if it's not already
        await queryRunner.query(`
          DO $$
          BEGIN
            IF EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'users' 
              AND column_name = 'clientId' 
              AND is_nullable = 'NO'
            ) THEN
              ALTER TABLE "users" ALTER COLUMN "clientId" DROP NOT NULL;
            END IF;
          END $$;
        `);
        
        const result = await queryRunner.query(
          `INSERT INTO "users"("email", "passwordHash", "firstName", "lastName", "roleId", "isActive", "mustResetPassword", "isDeveloper", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
           RETURNING "id", "email", "firstName", "lastName", "roleId", "isActive", "mustResetPassword", "isDeveloper", "createdAt", "updatedAt"`,
          [email, passwordHash, firstName, lastName, roleId || null, true, false, false]
        );
        
        await queryRunner.release();
        savedUser = result[0] as User;
      } else {
        // For schema-per-tenant and shared, clientId is required
        const userData: any = {
          email,
          passwordHash,
          firstName,
          lastName,
          clientId: client.id,
          roleId: roleId || undefined,
          isActive: true,
          mustResetPassword: false,
        };

        const user = actualUserRepository.create(userData);
        const saved = await actualUserRepository.save(user);
        savedUser = Array.isArray(saved) ? saved[0] : saved;
      }

      if (queryRunner && queryRunner.isTransactionActive) {
        await queryRunner.commitTransaction();
      }

      logger.info('✅ User created successfully!');
      const user = Array.isArray(savedUser) ? savedUser[0] : savedUser;
      logger.info(`   ID: ${user.id}`);
      logger.info(`   Email: ${user.email}`);
      logger.info(`   Name: ${user.firstName} ${user.lastName}`);
      logger.info(`   Client: ${client.name}`);
      logger.info(`   Active: ${savedUser.isActive}`);

      await AppDataSource.destroy();
      process.exit(0);
    } catch (error: any) {
      if (queryRunner && queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      if (queryRunner) {
        await queryRunner.release();
      }
    }
  } catch (error: any) {
    logger.error('Failed to create user', { error });
    console.error(error);
    await AppDataSource.destroy().catch(() => {});
    process.exit(1);
  }
}

createTenantUser();

