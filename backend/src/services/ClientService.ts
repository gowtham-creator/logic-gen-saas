import { Repository, IsNull } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Client } from '../entities/Client';
import { Plan } from '../entities/Plan';
import { User } from '../entities/User';
import { Role } from '../entities/Role';
import { Permission } from '../entities/Permission';
import { RolePermission } from '../entities/RolePermission';
import { CreateClientDto, UpdateClientDto } from '../types/client.types';
import { DatabaseConfigService } from './DatabaseConfigService';
import { DatabaseMigrationService, MigrationResult } from './DatabaseMigrationService';
import { TenantDataSourceManager } from './TenantDataSourceManager';
import { AuthService } from './AuthService';
import { getTenantRepository } from '../utils/tenantRepository';
import { getIsolationLevel } from '../utils/isolationHelper';
import { TenantRequest } from '../types/middleware.types';
import { DEFAULTS } from '../constants/defaults';
import { logger } from '../utils/logger';
import { getSSOConfigEncryptionService } from './SSOConfigEncryptionService';

export class ClientService {
  private clientRepository: Repository<Client>;
  private planRepository: Repository<Plan>;
  private dbConfigService: DatabaseConfigService;
  private migrationService: DatabaseMigrationService;
  private tenantDataSourceManager: TenantDataSourceManager;
  private authService: AuthService;

  constructor() {
    this.clientRepository = AppDataSource.getRepository(Client);
    this.planRepository = AppDataSource.getRepository(Plan);
    this.dbConfigService = new DatabaseConfigService();
    this.migrationService = new DatabaseMigrationService();
    this.tenantDataSourceManager = new TenantDataSourceManager(AppDataSource);
    this.authService = new AuthService();
  }

  async createClient(data: CreateClientDto): Promise<Client> {
    // Check if subdomain already exists (excluding soft-deleted)
    const existing = await this.clientRepository.findOne({
      where: { subdomain: data.subdomain, deletedAt: IsNull() },
    });

    if (existing) {
      throw new Error('Client with this subdomain already exists');
    }

    // Verify plan exists if provided
    if (data.planId) {
      const plan = await this.planRepository.findOne({
        where: { id: data.planId },
      });
      if (!plan) {
        throw new Error('Plan not found');
      }
    }

    // Validate database config against plan permissions if provided
    if (data.databaseConfig && data.planId) {
      const plan = await this.planRepository.findOne({
        where: { id: data.planId },
      });
      if (plan && plan.databasePermissions) {
        const permissions = plan.databasePermissions as any;
        // Check if isolation level is allowed
        if (!permissions.allowedIsolationLevels?.includes(data.databaseConfig.isolationLevel)) {
          throw new Error(`Isolation level "${data.databaseConfig.isolationLevel}" is not allowed by this plan. Allowed: ${permissions.allowedIsolationLevels?.join(', ')}`);
        }
        // Check other permissions
        if (data.databaseConfig.allowCustomTables && !permissions.allowCustomTables) {
          throw new Error('Custom tables are not allowed by this plan');
        }
        if (data.databaseConfig.allowCustomColumns && !permissions.allowCustomColumns) {
          throw new Error('Custom columns are not allowed by this plan');
        }
        if (data.databaseConfig.allowCustomMigrations && !permissions.allowCustomMigrations) {
          throw new Error('Custom migrations are not allowed by this plan');
        }
      }
    }

    // Encrypt SSO config if present
    let encryptedSSOConfig = data.ssoConfig;
    if (data.ssoConfig && data.ssoConfig.enabled && data.ssoConfig.metadata) {
      const encryptionService = getSSOConfigEncryptionService();
      encryptedSSOConfig = await encryptionService.encryptSSOConfig(data.ssoConfig);
    }

    const client = this.clientRepository.create({
      name: data.name,
      subdomain: data.subdomain,
      planId: data.planId,
      planExpiresAt: data.planExpiresAt,
      allowSuperAdminLogin: data.allowSuperAdminLogin,
      ssoConfig: encryptedSSOConfig,
      databaseConfig: data.databaseConfig,
      isActive: data.isActive !== undefined ? data.isActive : true,
    });

    const savedClient = await this.clientRepository.save(client);

    // Handle storage configuration if provided
    if (data.storageConfig) {
      try {
        const { StorageService } = await import('./StorageService');
        const storageService = new StorageService();
        await storageService.setClientStorageConfig(
          savedClient.id,
          data.storageConfig.storageEngineId,
          data.storageConfig.config
        );
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to set storage config for client', { error: errorMessage, clientId: savedClient.id });
        // Don't fail client creation if storage config fails
      }
    }

    // Create default role and admin user for the new client (mandatory)
    const { defaultRole, adminRole } = await this.createAdminUser(savedClient.id, {
      email: data.adminEmail,
      password: data.adminPassword,
      firstName: data.adminFirstName,
      lastName: data.adminLastName,
    });

    // Update client with defaultRoleId
    savedClient.defaultRoleId = defaultRole.id;
    await this.clientRepository.save(savedClient);

    // Create storage folder for the client
    try {
      const { StorageService } = await import('./StorageService');
      const storageService = new StorageService();
      await storageService.createClientStorageFolder(savedClient.id);
    } catch (error: unknown) {
      // Log error but don't fail client creation if storage folder creation fails
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create storage folder for client', { error: errorMessage, clientId: savedClient.id });
    }

    return savedClient;
  }

  /**
   * Create default role, admin role and admin user for a new client
   * Returns both the default role (for SSO users) and admin role (for admin user)
   */
  private async createAdminUser(clientId: string, adminData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<{ defaultRole: Role; adminRole: Role }> {
    // Get client database config to determine isolation level
    const dbConfig = await this.dbConfigService.getClientDatabaseConfig(clientId);
    const isolationLevel = dbConfig.isolationLevel;

    // Get the appropriate DataSource and repositories
    let userRepository: Repository<User>;
    let roleRepository: Repository<Role>;
    let permissionRepository: Repository<Permission>;
    let rolePermissionRepository: Repository<RolePermission>;
    let req: TenantRequest | undefined;

    if (isolationLevel === 'database') {
      // For database-per-tenant, get tenant DataSource
      const tenantDataSource = await this.tenantDataSourceManager.getDataSource(clientId);
      userRepository = tenantDataSource.getRepository(User);
      roleRepository = tenantDataSource.getRepository(Role);
      permissionRepository = tenantDataSource.getRepository(Permission);
      rolePermissionRepository = tenantDataSource.getRepository(RolePermission);
      
      // Create a mock TenantRequest for database-per-tenant
      req = {
        clientId,
        tenantDataSource,
      } as TenantRequest;
    } else {
      // For shared isolation, use AppDataSource
      userRepository = AppDataSource.getRepository(User);
      roleRepository = AppDataSource.getRepository(Role);
      permissionRepository = AppDataSource.getRepository(Permission);
      rolePermissionRepository = AppDataSource.getRepository(RolePermission);
    }

    // Normalize email to lowercase for comparison
    const normalizedEmail = adminData.email.toLowerCase().trim();

    // Check if email is available using Redis (fast O(1) lookup)
    const { getEmailUniquenessService } = await import('./EmailUniquenessService');
    const emailUniquenessService = getEmailUniquenessService();
    const emailCheck = await emailUniquenessService.isEmailAvailable(normalizedEmail);
    
    if (!emailCheck.available) {
      throw new Error(emailCheck.message || `User with email ${adminData.email} already exists. Please use a different email address.`);
    }

    // Double-check in database if Redis check passed (fallback for Redis failures)
    const where: any = {};
    if (isolationLevel === 'database') {
      where.email = normalizedEmail;
    } else {
      where.email = normalizedEmail;
      where.clientId = clientId;
    }
    
    const existingUser = await userRepository.findOne({ where });
    if (existingUser) {
      throw new Error(`User with email ${adminData.email} already exists. Please use a different email address.`);
    }
    
    // Additional check: verify email format is valid (should already be validated by Joi, but double-check)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      throw new Error(`Invalid email format: ${adminData.email}`);
    }

    // Helper function to create a role with all permissions
    const createRoleWithAllPermissions = async (roleName: string, roleDescription: string): Promise<Role> => {
      const roleWhere: any = { name: roleName };
      if (isolationLevel !== 'database') {
        roleWhere.clientId = clientId;
      }
      let role = await roleRepository.findOne({ where: roleWhere });

      if (!role) {
        const roleData: any = {
          name: roleName,
          description: roleDescription,
          isActive: true,
        };
        if (isolationLevel !== 'database') {
          roleData.clientId = clientId;
        }
        const createdRole = roleRepository.create(roleData);
        const saved = await roleRepository.save(createdRole);
        role = Array.isArray(saved) ? saved[0] : saved;
      }

      if (!role) {
        throw new Error(`Failed to create or find ${roleName} role`);
      }

      // Get all permissions and assign them to role
      // For database-per-tenant, permissions should already be seeded in the tenant database
      // For shared, permissions are in the main database
      const allPermissions = await permissionRepository.find();
      
      if (allPermissions.length > 0) {
        const existingRolePermissions = await rolePermissionRepository.find({
          where: { roleId: role.id },
        });
        const existingPermissionIds = new Set(
          existingRolePermissions.map((rp) => rp.permissionId)
        );

        // Assign all permissions to role
        for (const permission of allPermissions) {
          if (!existingPermissionIds.has(permission.id)) {
            const rolePermission = rolePermissionRepository.create({
              roleId: role.id,
              permissionId: permission.id,
            });
            await rolePermissionRepository.save(rolePermission);
          }
        }
      }
      // Note: If no permissions exist yet (e.g., tenant database not fully migrated),
      // the role will be created without permissions, which can be assigned later

      return role;
    };

    // Create default role (for SSO users) with all permissions
    const defaultRole = await createRoleWithAllPermissions(
      'Default',
      'Default role assigned to new SSO users with full permissions'
    );

    // Create admin role (for admin user) with all permissions
    const adminRole = await createRoleWithAllPermissions(
      DEFAULTS.ADMIN_ROLE_NAME,
      DEFAULTS.ADMIN_ROLE_DESCRIPTION
    );

    // Create admin user with normalized email
    const passwordHash = await this.authService.hashPassword(adminData.password);
    const userData: any = {
      email: normalizedEmail, // Use normalized email (lowercase, trimmed)
      passwordHash,
      firstName: adminData.firstName.trim(),
      lastName: adminData.lastName.trim(),
      roleId: adminRole.id,
      isActive: true,
      mustResetPassword: true, // Require password reset on first login
    };
    if (isolationLevel !== 'database') {
      userData.clientId = clientId;
    }

    const adminUser = userRepository.create(userData);
    await userRepository.save(adminUser);

    // Add email to Redis for fast uniqueness checking
    await emailUniquenessService.addEmail(normalizedEmail);

    return { defaultRole, adminRole };
  }

  /**
   * Get the default role ID for a client
   * This is used when assigning roles to new SSO users
   */
  async getDefaultRoleId(clientId: string): Promise<string | null> {
    const client = await this.clientRepository.findOne({
      where: { id: clientId, deletedAt: IsNull() },
    });

    if (!client || !client.defaultRoleId) {
      return null;
    }

    return client.defaultRoleId;
  }

  /**
   * Get or create the default role for a client
   * This is used as a fallback when defaultRoleId is not set on the client
   * @returns The default role ID
   */
  async getOrCreateDefaultRole(clientId: string): Promise<string> {
    // First check if client has defaultRoleId set
    const existingDefaultRoleId = await this.getDefaultRoleId(clientId);
    if (existingDefaultRoleId) {
      return existingDefaultRoleId;
    }

    // Get client database config to determine isolation level
    const dbConfig = await this.dbConfigService.getClientDatabaseConfig(clientId);
    const isolationLevel = dbConfig.isolationLevel;

    // Get the appropriate DataSource and repositories
    let roleRepository: Repository<Role>;
    let permissionRepository: Repository<Permission>;
    let rolePermissionRepository: Repository<RolePermission>;

    if (isolationLevel === 'database') {
      // For database-per-tenant, get tenant DataSource
      const tenantDataSource = await this.tenantDataSourceManager.getDataSource(clientId);
      roleRepository = tenantDataSource.getRepository(Role);
      permissionRepository = tenantDataSource.getRepository(Permission);
      rolePermissionRepository = tenantDataSource.getRepository(RolePermission);
    } else {
      // For shared isolation, use AppDataSource
      roleRepository = AppDataSource.getRepository(Role);
      permissionRepository = AppDataSource.getRepository(Permission);
      rolePermissionRepository = AppDataSource.getRepository(RolePermission);
    }

    // Try to find existing "Default" role
    const roleWhere: any = { name: 'Default' };
    if (isolationLevel !== 'database') {
      roleWhere.clientId = clientId;
    }
    
    let defaultRole = await roleRepository.findOne({ where: roleWhere });

    // If role doesn't exist, create it
    if (!defaultRole) {
      const roleData: any = {
        name: 'Default',
        description: 'Default role assigned to new SSO users with full permissions',
        isActive: true,
      };
      if (isolationLevel !== 'database') {
        roleData.clientId = clientId;
      }
      
      const createdRole = roleRepository.create(roleData);
      const saved = await roleRepository.save(createdRole);
      defaultRole = Array.isArray(saved) ? saved[0] : saved;

      if (!defaultRole) {
        throw new Error('Failed to create Default role');
      }

      // Assign all permissions to the role
      const allPermissions = await permissionRepository.find();
      if (allPermissions.length > 0) {
        const existingRolePermissions = await rolePermissionRepository.find({
          where: { roleId: defaultRole.id },
        });
        const existingPermissionIds = new Set(
          existingRolePermissions.map((rp) => rp.permissionId)
        );

        // Assign all permissions to role
        for (const permission of allPermissions) {
          if (!existingPermissionIds.has(permission.id)) {
            const rolePermission = rolePermissionRepository.create({
              roleId: defaultRole.id,
              permissionId: permission.id,
            });
            await rolePermissionRepository.save(rolePermission);
          }
        }
      }

      logger.info('Created Default role for client', { clientId, roleId: defaultRole.id });
    }

    // Update client with defaultRoleId if not set
    const client = await this.clientRepository.findOne({
      where: { id: clientId, deletedAt: IsNull() },
    });
    
    if (client && !client.defaultRoleId) {
      client.defaultRoleId = defaultRole.id;
      await this.clientRepository.save(client);
      logger.info('Updated client with defaultRoleId', { clientId, defaultRoleId: defaultRole.id });
    }

    return defaultRole.id;
  }

  async updateClient(id: string, data: UpdateClientDto): Promise<Client> {
    const client = await this.clientRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!client) {
      throw new Error('Client not found');
    }

    // Check subdomain uniqueness if changing (excluding soft-deleted)
    if (data.subdomain && data.subdomain !== client.subdomain) {
      const existing = await this.clientRepository.findOne({
        where: { subdomain: data.subdomain, deletedAt: IsNull() },
      });
      if (existing) {
        throw new Error('Subdomain already taken');
      }
    }

    // Verify plan exists if provided (excluding soft-deleted)
    if (data.planId) {
      const plan = await this.planRepository.findOne({
        where: { id: data.planId, deletedAt: IsNull() },
      });
      if (!plan) {
        throw new Error('Plan not found');
      }
    }

    // Validate database config against plan permissions if provided
    if (data.databaseConfig) {
      const planId = data.planId || client.planId;
      if (planId) {
        const plan = await this.planRepository.findOne({
          where: { id: planId, deletedAt: IsNull() },
        });
        if (plan && plan.databasePermissions) {
          const permissions = plan.databasePermissions as any;
          // Check if isolation level is allowed
          if (!permissions.allowedIsolationLevels?.includes(data.databaseConfig.isolationLevel)) {
            throw new Error(`Isolation level "${data.databaseConfig.isolationLevel}" is not allowed by this plan. Allowed: ${permissions.allowedIsolationLevels?.join(', ')}`);
          }
          // Check other permissions
          if (data.databaseConfig.allowCustomTables && !permissions.allowCustomTables) {
            throw new Error('Custom tables are not allowed by this plan');
          }
          if (data.databaseConfig.allowCustomColumns && !permissions.allowCustomColumns) {
            throw new Error('Custom columns are not allowed by this plan');
          }
          if (data.databaseConfig.allowCustomMigrations && !permissions.allowCustomMigrations) {
            throw new Error('Custom migrations are not allowed by this plan');
          }
        }
      }

      // Check if isolation level is changing and migration is needed
      const currentConfig = await this.dbConfigService.getClientDatabaseConfig(client.id);
      if (data.databaseConfig.isolationLevel !== currentConfig.isolationLevel) {
        const migrationCheck = await this.migrationService.isMigrationNeeded(
          client.id,
          data.databaseConfig.isolationLevel
        );

        if (migrationCheck.needed) {
          throw new Error(
            `MIGRATION_REQUIRED: Changing isolation level from ${currentConfig.isolationLevel} to ${data.databaseConfig.isolationLevel} requires data migration. ` +
            `Please use the migration endpoint first: POST /api/clients/${client.id}/migrate-database`
          );
        }
      }
    }

    // Encrypt SSO config if being updated
    if (data.ssoConfig && data.ssoConfig.metadata) {
      const encryptionService = getSSOConfigEncryptionService();
      data.ssoConfig = await encryptionService.encryptSSOConfig(data.ssoConfig);
    }

    Object.assign(client, data);
    const updatedClient = await this.clientRepository.save(client);

    // Handle storage configuration if provided
    if (data.storageConfig) {
      try {
        const { StorageService } = await import('./StorageService');
        const storageService = new StorageService();
        await storageService.setClientStorageConfig(
          id,
          data.storageConfig.storageEngineId,
          data.storageConfig.config
        );
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to update storage config for client', { error: errorMessage, clientId: id });
        // Don't fail client update if storage config fails
      }
    }

    return updatedClient;
  }

  async getClient(id: string): Promise<Client | null> {
    return this.clientRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['plan', 'storageConfig', 'storageConfig.storageEngine'],
    });
  }

  async listClients(): Promise<Client[]> {
    return this.clientRepository.find({
      where: { deletedAt: IsNull() },
      relations: ['plan', 'storageConfig', 'storageConfig.storageEngine'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Sanitize client data for API responses (remove sensitive SSO and storage data)
   */
  async sanitizeClientForResponse(client: Client): Promise<Client> {
    const sanitized: any = { ...client };

    // Sanitize SSO config if present
    if (client.ssoConfig) {
      const ssoEncryptionService = getSSOConfigEncryptionService();
      sanitized.ssoConfig = ssoEncryptionService.sanitizeSSOConfig(client.ssoConfig);
    }

    // Sanitize storage config if present
    if (client.storageConfig && client.storageConfig.config) {
      const { getStorageConfigEncryptionService } = await import('./StorageConfigEncryptionService');
      const storageEncryptionService = getStorageConfigEncryptionService();
      sanitized.storageConfig = {
        ...client.storageConfig,
        config: storageEncryptionService.sanitizeStorageConfig(
          client.storageConfig.config,
          client.storageConfig.storageEngine?.type || 'local'
        ),
      };
    }

    return sanitized;
  }

  /**
   * Sanitize multiple clients for API responses
   */
  async sanitizeClientsForResponse(clients: Client[]): Promise<Client[]> {
    return Promise.all(clients.map(client => this.sanitizeClientForResponse(client)));
  }


  /**
   * Check if migration is needed for a client
   */
  async checkMigrationNeeded(clientId: string, newIsolationLevel: string): Promise<{ needed: boolean; reason?: string }> {
    return this.migrationService.isMigrationNeeded(clientId, newIsolationLevel as any);
  }

  /**
   * Migrate client data to new isolation level
   */
  async migrateDatabase(
    clientId: string, 
    newIsolationLevel: string,
    removeFromSource: boolean = false
  ): Promise<MigrationResult> {
    const client = await this.getClient(clientId);
    if (!client) {
      throw new Error('Client not found');
    }

    const currentConfig = await this.dbConfigService.getClientDatabaseConfig(clientId);
    const fromLevel = currentConfig.isolationLevel;
    const toLevel = newIsolationLevel as any;

    if (fromLevel === toLevel) {
      return {
        success: true,
        recordsMigrated: 0,
        tablesMigrated: [],
      };
    }

    // Only allow removeFromSource when migrating FROM shared
    if (removeFromSource && fromLevel !== 'shared') {
      throw new Error('Data removal from source is only allowed when migrating from shared database');
    }

    // Perform migration
    const result = await this.migrationService.migrateData(clientId, fromLevel, toLevel, removeFromSource);

    if (result.success) {
      // Update client's database config after successful migration
      const updatedConfig = {
        ...currentConfig,
        isolationLevel: toLevel,
      };
      await this.updateClient(clientId, { databaseConfig: updatedConfig });
    }

    return result;
  }

  async deleteClient(id: string): Promise<void> {
    // Check if client has users (excluding soft-deleted users)
    const userRepository = AppDataSource.getRepository(User);
    const userCount = await userRepository.count({
      where: { clientId: id, deletedAt: IsNull() },
    });

    if (userCount > 0) {
      throw new Error('Cannot delete client with existing users');
    }

    // Soft delete (set deletedAt)
    await this.clientRepository.update({ id }, { deletedAt: new Date() });
  }
}

