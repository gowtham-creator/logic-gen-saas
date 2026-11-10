import { AppDataSource } from '../config/database';
import { Client } from '../entities/Client';
import { ClientDatabaseConfig, DEFAULT_DATABASE_CONFIG, PlanDatabasePermissions } from '../types/database.types';

/**
 * Service to manage database configuration at client level, validated against plan permissions
 */
export class DatabaseConfigService {
  /**
   * Get database configuration for a client
   * Returns client's databaseConfig or default if not set
   */
  async getClientDatabaseConfig(clientId: string): Promise<ClientDatabaseConfig> {
    const clientRepository = AppDataSource.getRepository(Client);
    const client = await clientRepository.findOne({
      where: { id: clientId },
      relations: ['plan'],
    });

    if (!client) {
      return DEFAULT_DATABASE_CONFIG;
    }

    // Return client's database config if set, otherwise default
    if (client.databaseConfig && Object.keys(client.databaseConfig).length > 0) {
      return client.databaseConfig as ClientDatabaseConfig;
    }

    return DEFAULT_DATABASE_CONFIG;
  }

  /**
   * Get plan database permissions for a client
   */
  async getPlanDatabasePermissions(clientId: string): Promise<PlanDatabasePermissions | null> {
    const clientRepository = AppDataSource.getRepository(Client);
    const client = await clientRepository.findOne({
      where: { id: clientId },
      relations: ['plan'],
    });

    if (!client || !client.plan) {
      return null;
    }

    // Check if plan is expired
    if (client.planExpiresAt && client.planExpiresAt < new Date()) {
      return null;
    }

    const plan = client.plan;
    
    // Return plan's database permissions
    if (plan.databasePermissions && Object.keys(plan.databasePermissions).length > 0) {
      return plan.databasePermissions as PlanDatabasePermissions;
    }

    return null;
  }

  /**
   * Validate that client's database config is allowed by their plan
   */
  async validateClientDatabaseConfig(clientId: string, config: ClientDatabaseConfig): Promise<boolean> {
    const permissions = await this.getPlanDatabasePermissions(clientId);
    
    if (!permissions) {
      // No plan = only shared allowed
      return config.isolationLevel === 'shared';
    }

    // Check if isolation level is allowed
    if (!permissions.allowedIsolationLevels.includes(config.isolationLevel)) {
      return false;
    }

    // Check if custom tables are allowed
    if (config.allowCustomTables && !permissions.allowCustomTables) {
      return false;
    }

    // Check if custom columns are allowed
    if (config.allowCustomColumns && !permissions.allowCustomColumns) {
      return false;
    }

    // Check if custom migrations are allowed
    if (config.allowCustomMigrations && !permissions.allowCustomMigrations) {
      return false;
    }

    // Check limits
    if (config.maxCustomTables && permissions.maxCustomTables) {
      if (config.maxCustomTables > permissions.maxCustomTables) {
        return false;
      }
    }

    if (config.maxCustomColumns && permissions.maxCustomColumns) {
      if (config.maxCustomColumns > permissions.maxCustomColumns) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if client's plan allows creating custom tables
   */
  async canCreateCustomTable(clientId: string): Promise<boolean> {
    const permissions = await this.getPlanDatabasePermissions(clientId);
    if (!permissions) {
      return false;
    }
    return permissions.allowCustomTables;
  }

  /**
   * Check if client's plan allows creating custom columns
   */
  async canCreateCustomColumn(clientId: string): Promise<boolean> {
    const permissions = await this.getPlanDatabasePermissions(clientId);
    if (!permissions) {
      return false;
    }
    return permissions.allowCustomColumns;
  }

  /**
   * Check if client's plan allows custom migrations
   */
  async canCreateCustomMigration(clientId: string): Promise<boolean> {
    const permissions = await this.getPlanDatabasePermissions(clientId);
    if (!permissions) {
      return false;
    }
    return permissions.allowCustomMigrations;
  }

  /**
   * Get isolation level for client
   */
  async getIsolationLevel(clientId: string): Promise<'shared' | 'schema' | 'database'> {
    const config = await this.getClientDatabaseConfig(clientId);
    return config.isolationLevel;
  }

  /**
   * Get maximum number of custom tables allowed (from plan permissions)
   */
  async getMaxCustomTables(clientId: string): Promise<number | undefined> {
    const permissions = await this.getPlanDatabasePermissions(clientId);
    return permissions?.maxCustomTables;
  }

  /**
   * Get maximum number of custom columns allowed (from plan permissions)
   */
  async getMaxCustomColumns(clientId: string): Promise<number | undefined> {
    const permissions = await this.getPlanDatabasePermissions(clientId);
    return permissions?.maxCustomColumns;
  }

  /**
   * Check if client has reached custom table limit
   */
  async checkCustomTableLimit(clientId: string, currentCount: number): Promise<boolean> {
    const maxTables = await this.getMaxCustomTables(clientId);
    if (maxTables === undefined) {
      return true; // No limit
    }
    return currentCount < maxTables;
  }

  /**
   * Check if client has reached custom column limit
   */
  async checkCustomColumnLimit(clientId: string, currentCount: number): Promise<boolean> {
    const maxColumns = await this.getMaxCustomColumns(clientId);
    if (maxColumns === undefined) {
      return true; // No limit
    }
    return currentCount < maxColumns;
  }
}

