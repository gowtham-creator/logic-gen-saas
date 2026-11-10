import { DataSource, DataSourceOptions } from 'typeorm';
import { AppDataSource, getMigrationsPath } from '../config/database';
import { DatabaseConfigService } from './DatabaseConfigService';
import { IsolationLevel } from '../types/database.types';
import { logger } from '../utils/logger';
import { User } from '../entities/User';
import { Client } from '../entities/Client';
import { Role } from '../entities/Role';
import { Permission } from '../entities/Permission';
import { RolePermission } from '../entities/RolePermission';
import { ClientSettings } from '../entities/ClientSettings';
import { ApiKey } from '../entities/ApiKey';
import { AuditLog } from '../entities/AuditLog';
import { Theme } from '../entities/Theme';
import { Plan } from '../entities/Plan';
import { RoleTemplate } from '../entities/RoleTemplate';
import { RoleTemplatePermission } from '../entities/RoleTemplatePermission';
import { Webhook } from '../entities/Webhook';
import { WebhookEvent } from '../entities/WebhookEvent';
import { PasswordHistory } from '../entities/PasswordHistory';
import { UserDevice } from '../entities/UserDevice';

/**
 * Manages DataSource connections for different tenant isolation levels
 * - Shared: Uses main AppDataSource
 * - Schema: Uses schema-specific DataSource in shared database
 * - Database: Uses separate database connection
 */
export class TenantDataSourceManager {
  private sharedDataSource: DataSource; // Current AppDataSource
  // Note: Schema-per-tenant uses shared DataSource with schema switching in queries
  private databaseDataSources: Map<string, DataSource> = new Map();
  private dbConfigService: DatabaseConfigService;
  private readonly entities = [
    User,
    Client,
    Role,
    Permission,
    RolePermission,
    ClientSettings,
    ApiKey,
    AuditLog,
    Theme,
    Plan,
    RoleTemplate,
    RoleTemplatePermission,
    Webhook,
    WebhookEvent,
    PasswordHistory,
    UserDevice,
  ];

  constructor(sharedDataSource: DataSource) {
    this.sharedDataSource = sharedDataSource;
    this.dbConfigService = new DatabaseConfigService();
  }

  /**
   * Get the appropriate DataSource for a client based on their plan
   */
  async getDataSource(clientId: string): Promise<DataSource> {
    const isolationLevel = await this.dbConfigService.getIsolationLevel(clientId);

    switch (isolationLevel) {
      case 'shared':
        return this.getSharedDataSource();

      case 'schema':
        return await this.getSchemaDataSource(clientId);

      case 'database':
        return await this.getDatabaseDataSource(clientId);

      default:
        logger.warn(`Unknown isolation level: ${isolationLevel}, using shared`);
        return this.getSharedDataSource();
    }
  }

  /**
   * Get shared DataSource (for basic plan)
   */
  private getSharedDataSource(): DataSource {
    return this.sharedDataSource;
  }

  /**
   * Get or create schema-specific DataSource (for professional plan)
   * Note: TypeORM doesn't support schema in DataSource options directly.
   * We use the shared DataSource but will set search_path in queries.
   * For now, we return shared DataSource and handle schema switching in queries.
   */
  private async getSchemaDataSource(clientId: string): Promise<DataSource> {
    // For schema-per-tenant, we use the shared DataSource
    // but will set the search_path (schema) in queries using QueryBuilder or raw queries
    // This is more efficient than creating separate DataSource instances per schema
    return this.sharedDataSource;
  }

  /**
   * Get or create database-specific DataSource (for enterprise plan)
   */
  private async getDatabaseDataSource(clientId: string): Promise<DataSource> {
    // Check cache
    if (this.databaseDataSources.has(clientId)) {
      const dataSource = this.databaseDataSources.get(clientId)!;
      if (dataSource.isInitialized) {
        return dataSource;
      }
      // Remove stale connection
      this.databaseDataSources.delete(clientId);
    }

    const config = await this.dbConfigService.getClientDatabaseConfig(clientId);
    
    if (!config.databaseUrl) {
      throw new Error(
        `Database URL not configured for client ${clientId}. Enterprise plan requires database provisioning.`
      );
    }

    // Fix database URL for Docker environment
    // If running in Docker and databaseUrl uses localhost, replace with postgres service name
    let databaseUrl = config.databaseUrl;
    const mainDatabaseUrl = process.env.DATABASE_URL || '';
    const isDocker = mainDatabaseUrl.includes('@postgres:') || mainDatabaseUrl.includes('@postgres/');
    
    if (isDocker && databaseUrl.includes('@localhost:')) {
      // Replace localhost with postgres service name for Docker
      databaseUrl = databaseUrl.replace('@localhost:', '@postgres:');
      logger.debug(`Adjusted database URL for Docker: ${databaseUrl.replace(/:[^:@]+@/, ':***@')}`);
    }

    // Create new database-specific DataSource
    const databaseDataSource = new DataSource({
      type: 'postgres',
      url: databaseUrl,
      entities: this.entities,
      migrations: getMigrationsPath(),
      synchronize: false,
      logging: process.env.NODE_ENV === 'development',
    });

    try {
      await databaseDataSource.initialize();
      this.databaseDataSources.set(clientId, databaseDataSource);
      logger.debug(`Initialized database DataSource for client ${clientId}`);
      return databaseDataSource;
    } catch (error) {
      logger.error(`Failed to initialize database DataSource for client ${clientId}`, { error });
      throw error;
    }
  }

  /**
   * Ensure schema exists for a client (for professional plan)
   * Also creates all standard tables in the schema if it's newly created
   */
  async ensureSchema(clientId: string): Promise<void> {
    const config = await this.dbConfigService.getClientDatabaseConfig(clientId);
    
    if (config.isolationLevel === 'shared') {
      return; // Not applicable
    }

    const schemaName = `public`;
    
    // Use shared DataSource to create schema
    if (!this.sharedDataSource.isInitialized) {
      await this.sharedDataSource.initialize();
    }

    // Check if schema exists
    const schemaExists = await this.sharedDataSource.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
      [schemaName]
    );

    if (schemaExists.length === 0) {
      // Create schema
      await this.sharedDataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      logger.info(`Created schema ${schemaName} for client ${clientId}`);
      
      // Create all standard tables in the new schema
      await this.createTablesInSchema(schemaName);
    } else {
      // Schema exists, but check if tables exist
      // If no tables exist, create them (handles case where schema was created but tables weren't)
      const tablesExist = await this.sharedDataSource.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 LIMIT 1`,
        [schemaName]
      );
      
      if (tablesExist.length === 0) {
        logger.info(`Schema ${schemaName} exists but has no tables. Creating tables...`);
        await this.createTablesInSchema(schemaName);
      } else {
        // Schema and tables exist, but check if tables need fixing
        await this.fixAuditLogsTableIfNeeded(schemaName);
        await this.fixUsersTableIfNeeded(schemaName);
      }
    }
  }

  /**
   * Fix audit_logs table in existing schema if it has wrong column names
   * This handles schemas created before the column name fix
   */
  private async fixAuditLogsTableIfNeeded(schemaName: string): Promise<void> {
    try {
      // Check if the table has the old column names
      const columns = await this.sharedDataSource.query(
        `SELECT column_name, data_type 
         FROM information_schema.columns 
         WHERE table_schema = $1 AND table_name = 'audit_logs'`,
        [schemaName]
      );

      const columnNames = columns.map((col: any) => col.column_name);
      const hasOldColumns = columnNames.includes('resource') || columnNames.includes('details');
      const hasNewColumns = columnNames.includes('resourceType') && columnNames.includes('metadata');

      logger.info(`[fixAuditLogsTableIfNeeded] Schema: ${schemaName}, Columns: ${columnNames.join(', ')}, HasOld: ${hasOldColumns}, HasNew: ${hasNewColumns}`);

      if (hasOldColumns && !hasNewColumns) {
        logger.info(`Fixing audit_logs table in schema ${schemaName} - migrating old column names`);
        
        // Rename columns and fix structure using a single DO block
        const fixSql = `
          DO $$
          DECLARE
            schema_name text := '${schemaName.replace(/'/g, "''")}';
          BEGIN
            -- Rename resource to resourceType if it exists
            IF EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = schema_name 
              AND table_name = 'audit_logs' 
              AND column_name = 'resource'
            ) THEN
              EXECUTE format('ALTER TABLE %I.audit_logs RENAME COLUMN "resource" TO "resourceType"', schema_name);
            END IF;
            
            -- Rename details to metadata if it exists
            IF EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = schema_name 
              AND table_name = 'audit_logs' 
              AND column_name = 'details'
            ) THEN
              EXECUTE format('ALTER TABLE %I.audit_logs RENAME COLUMN "details" TO "metadata"', schema_name);
            END IF;
            
            -- Make resourceType nullable if it exists and is not nullable
            IF EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = schema_name 
              AND table_name = 'audit_logs' 
              AND column_name = 'resourceType'
              AND is_nullable = 'NO'
            ) THEN
              EXECUTE format('ALTER TABLE %I.audit_logs ALTER COLUMN "resourceType" DROP NOT NULL', schema_name);
            END IF;
            
            -- Make clientId nullable if it exists and is not nullable
            IF EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = schema_name 
              AND table_name = 'audit_logs' 
              AND column_name = 'clientId'
              AND is_nullable = 'NO'
            ) THEN
              EXECUTE format('ALTER TABLE %I.audit_logs ALTER COLUMN "clientId" DROP NOT NULL', schema_name);
            END IF;
            
            -- Change userAgent from text to varchar if needed
            IF EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = schema_name 
              AND table_name = 'audit_logs' 
              AND column_name = 'userAgent'
              AND data_type = 'text'
            ) THEN
              EXECUTE format('ALTER TABLE %I.audit_logs ALTER COLUMN "userAgent" TYPE varchar(255)', schema_name);
            END IF;
          END $$;
        `;
        
        await this.sharedDataSource.query(fixSql);
        
        logger.info(`Fixed audit_logs table in schema ${schemaName}`);
      } else if (!hasNewColumns) {
        // Table exists but missing new columns, add them
        logger.info(`Adding missing columns to audit_logs table in schema ${schemaName}`);
        const addColumnsSql = `
          DO $$
          DECLARE
            schema_name text := '${schemaName.replace(/'/g, "''")}';
          BEGIN
            -- Add resourceType if missing
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = schema_name 
              AND table_name = 'audit_logs' 
              AND column_name = 'resourceType'
            ) THEN
              EXECUTE format('ALTER TABLE %I.audit_logs ADD COLUMN "resourceType" varchar(255)', schema_name);
            END IF;
            
            -- Add metadata if missing
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = schema_name 
              AND table_name = 'audit_logs' 
              AND column_name = 'metadata'
            ) THEN
              EXECUTE format('ALTER TABLE %I.audit_logs ADD COLUMN "metadata" jsonb', schema_name);
            END IF;
          END $$;
        `;
        await this.sharedDataSource.query(addColumnsSql);
      }
    } catch (error) {
      logger.error(`Failed to fix audit_logs table in schema ${schemaName}`, { error });
      // Don't throw - allow the system to continue
    }
  }

  /**
   * Fix users table in existing schema if it has wrong column names or missing columns
   */
  private async fixUsersTableIfNeeded(schemaName: string): Promise<void> {
    try {
      const columns = await this.sharedDataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns 
         WHERE table_schema = $1 AND table_name = 'users'`,
        [schemaName]
      );

      const columnNames = columns.map((col: any) => col.column_name);
      const hasPassword = columnNames.includes('password');
      const hasPasswordHash = columnNames.includes('passwordHash');
      const hasRefreshToken = columnNames.includes('refreshToken');
      const hasMustResetPassword = columnNames.includes('mustResetPassword');
      const hasIsDeveloper = columnNames.includes('isDeveloper');

      logger.info(`[fixUsersTableIfNeeded] Schema: ${schemaName}, Columns: ${columnNames.join(', ')}, HasRefreshToken: ${hasRefreshToken}, HasMustResetPassword: ${hasMustResetPassword}, HasIsDeveloper: ${hasIsDeveloper}`);

      if (!hasRefreshToken || !hasMustResetPassword || !hasIsDeveloper || (hasPassword && !hasPasswordHash)) {
        logger.info(`Fixing users table in schema ${schemaName}`);
        
        const fixSql = `
          DO $$
          DECLARE
            schema_name text := '${schemaName.replace(/'/g, "''")}';
          BEGIN
            -- Rename password to passwordHash if it exists and passwordHash doesn't
            IF EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = schema_name 
              AND table_name = 'users' 
              AND column_name = 'password'
            ) AND NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = schema_name 
              AND table_name = 'users' 
              AND column_name = 'passwordHash'
            ) THEN
              EXECUTE format('ALTER TABLE %I.users RENAME COLUMN "password" TO "passwordHash"', schema_name);
            END IF;
            
            -- Add refreshToken if missing
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = schema_name 
              AND table_name = 'users' 
              AND column_name = 'refreshToken'
            ) THEN
              EXECUTE format('ALTER TABLE %I.users ADD COLUMN "refreshToken" varchar(255)', schema_name);
            END IF;
            
            -- Add refreshTokenExpiresAt if missing
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = schema_name 
              AND table_name = 'users' 
              AND column_name = 'refreshTokenExpiresAt'
            ) THEN
              EXECUTE format('ALTER TABLE %I.users ADD COLUMN "refreshTokenExpiresAt" timestamp', schema_name);
            END IF;
            
            -- Add mustResetPassword if missing
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = schema_name 
              AND table_name = 'users' 
              AND column_name = 'mustResetPassword'
            ) THEN
              EXECUTE format('ALTER TABLE %I.users ADD COLUMN "mustResetPassword" boolean NOT NULL DEFAULT false', schema_name);
            END IF;
            
            -- Add isDeveloper if missing
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = schema_name 
              AND table_name = 'users' 
              AND column_name = 'isDeveloper'
            ) THEN
              EXECUTE format('ALTER TABLE %I.users ADD COLUMN "isDeveloper" boolean NOT NULL DEFAULT false', schema_name);
            END IF;
            
            -- Make firstName and lastName NOT NULL if they're nullable
            IF EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = schema_name 
              AND table_name = 'users' 
              AND column_name = 'firstName'
              AND is_nullable = 'YES'
            ) THEN
              EXECUTE format('ALTER TABLE %I.users ALTER COLUMN "firstName" SET NOT NULL', schema_name);
            END IF;
            
            IF EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = schema_name 
              AND table_name = 'users' 
              AND column_name = 'lastName'
              AND is_nullable = 'YES'
            ) THEN
              EXECUTE format('ALTER TABLE %I.users ALTER COLUMN "lastName" SET NOT NULL', schema_name);
            END IF;
            
            -- Fix unique constraint on email+clientId if it doesn't exist
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.table_constraints tc
              JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
              WHERE tc.table_schema = schema_name 
              AND tc.table_name = 'users'
              AND tc.constraint_type = 'UNIQUE'
              AND (
                SELECT COUNT(*) FROM information_schema.constraint_column_usage 
                WHERE constraint_name = tc.constraint_name
              ) = 2
            ) THEN
              -- Drop old unique constraint on email only if it exists
              IF EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE table_schema = schema_name 
                AND table_name = 'users'
                AND constraint_type = 'UNIQUE'
                AND constraint_name LIKE '%email%'
              ) THEN
                EXECUTE format('ALTER TABLE %I.users DROP CONSTRAINT IF EXISTS users_email_key', schema_name);
              END IF;
              
              -- Add unique constraint on (email, clientId)
              EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_email_client" ON %I.users ("email", "clientId")', schema_name);
            END IF;
          END $$;
        `;
        
        await this.sharedDataSource.query(fixSql);
        logger.info(`Fixed users table in schema ${schemaName}`);
      }
    } catch (error) {
      logger.error(`Failed to fix users table in schema ${schemaName}`, { error });
      // Don't throw - allow the system to continue
    }
  }

  /**
   * Create all standard application tables in a tenant schema
   */
  private async createTablesInSchema(schemaName: string): Promise<void> {
    try {
      // Set search_path to the tenant schema temporarily
      await this.sharedDataSource.query(`SET search_path TO "${schemaName}", public`);
      
      // Create all tables using TypeORM's synchronization
      // We'll create tables manually to have better control
      const tableQueries = [
        // Users table
        `CREATE TABLE IF NOT EXISTS "${schemaName}"."users" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "email" varchar(255) NOT NULL,
          "passwordHash" varchar(255) NOT NULL,
          "firstName" varchar(255) NOT NULL,
          "lastName" varchar(255) NOT NULL,
          "refreshToken" varchar(255),
          "refreshTokenExpiresAt" timestamp,
          "clientId" uuid NOT NULL,
          "roleId" uuid,
          "isActive" boolean NOT NULL DEFAULT true,
          "mustResetPassword" boolean NOT NULL DEFAULT false,
          "isDeveloper" boolean NOT NULL DEFAULT false,
          "createdAt" timestamp NOT NULL DEFAULT now(),
          "updatedAt" timestamp NOT NULL DEFAULT now(),
          UNIQUE("email", "clientId")
        )`,
        // Roles table
        `CREATE TABLE IF NOT EXISTS "${schemaName}"."roles" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "name" varchar(255) NOT NULL,
          "description" text,
          "clientId" uuid NOT NULL,
          "createdAt" timestamp NOT NULL DEFAULT now(),
          "updatedAt" timestamp NOT NULL DEFAULT now(),
          UNIQUE("name", "clientId")
        )`,
        // Permissions table (shared, but we'll create it in schema too for consistency)
        `CREATE TABLE IF NOT EXISTS "${schemaName}"."permissions" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "resource" varchar(255) NOT NULL,
          "action" varchar(255) NOT NULL,
          "description" text,
          UNIQUE("resource", "action")
        )`,
        // RolePermissions table
        `CREATE TABLE IF NOT EXISTS "${schemaName}"."role_permissions" (
          "roleId" uuid NOT NULL,
          "permissionId" uuid NOT NULL,
          PRIMARY KEY ("roleId", "permissionId")
        )`,
        // Excluded system tables: client_settings, plans, clients, super_admins, super_admin_roles, super_admin_role_permissions
        // ApiKeys table
        `CREATE TABLE IF NOT EXISTS "${schemaName}"."api_keys" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "name" varchar(255) NOT NULL,
          "key" varchar(255) NOT NULL UNIQUE,
          "clientId" uuid NOT NULL,
          "scopes" text[],
          "rateLimitPerMinute" integer,
          "expiresAt" timestamp,
          "isActive" boolean NOT NULL DEFAULT true,
          "lastUsedAt" timestamp,
          "createdAt" timestamp NOT NULL DEFAULT now(),
          "updatedAt" timestamp NOT NULL DEFAULT now()
        )`,
        // AuditLogs table
        `CREATE TABLE IF NOT EXISTS "${schemaName}"."audit_logs" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "clientId" uuid,
          "userId" uuid,
          "action" varchar(255) NOT NULL,
          "resourceType" varchar(255),
          "resourceId" uuid,
          "metadata" jsonb,
          "ipAddress" varchar(255),
          "userAgent" varchar(255),
          "createdAt" timestamp NOT NULL DEFAULT now()
        )`,
        // Themes table
        `CREATE TABLE IF NOT EXISTS "${schemaName}"."themes" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "clientId" uuid,
          "name" varchar(255),
          "primaryColor" varchar(7),
          "secondaryColor" varchar(7),
          "backgroundColor" varchar(7),
          "textColor" varchar(7),
          "logoUrl" varchar(255),
          "faviconUrl" varchar(255),
          "createdAt" timestamp NOT NULL DEFAULT now(),
          "updatedAt" timestamp NOT NULL DEFAULT now(),
          UNIQUE("clientId")
        )`,
        // Webhooks table
        `CREATE TABLE IF NOT EXISTS "${schemaName}"."webhooks" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "name" varchar(255) NOT NULL,
          "url" varchar(255) NOT NULL,
          "clientId" uuid NOT NULL,
          "events" text[] NOT NULL,
          "secret" varchar(255),
          "isActive" boolean NOT NULL DEFAULT true,
          "maxRetries" integer NOT NULL DEFAULT 3,
          "timeoutMs" integer NOT NULL DEFAULT 30000,
          "headers" jsonb,
          "acknowledgementRequired" boolean NOT NULL DEFAULT false,
          "acknowledgementTimeoutMs" integer,
          "createdAt" timestamp NOT NULL DEFAULT now(),
          "updatedAt" timestamp NOT NULL DEFAULT now()
        )`,
        // WebhookEvents table
        `CREATE TABLE IF NOT EXISTS "${schemaName}"."webhook_events" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "webhookId" uuid NOT NULL,
          "eventType" varchar(255) NOT NULL,
          "payload" jsonb NOT NULL,
          "status" varchar(50) NOT NULL DEFAULT 'pending',
          "attemptCount" integer NOT NULL DEFAULT 0,
          "httpStatus" integer,
          "responseBody" text,
          "errorMessage" text,
          "deliveredAt" timestamp,
          "nextRetryAt" timestamp,
          "acknowledgedAt" timestamp,
          "acknowledgementStatus" varchar(50),
          "acknowledgementTimeoutAt" timestamp,
          "createdAt" timestamp NOT NULL DEFAULT now(),
          "updatedAt" timestamp NOT NULL DEFAULT now()
        )`,
      ];

      // Execute all table creation queries
      for (const query of tableQueries) {
        await this.sharedDataSource.query(query);
      }

      // Create indexes
      const indexQueries = [
        `CREATE INDEX IF NOT EXISTS "IDX_users_clientId" ON "${schemaName}"."users" ("clientId")`,
        `CREATE INDEX IF NOT EXISTS "IDX_users_email" ON "${schemaName}"."users" ("email")`,
        `CREATE INDEX IF NOT EXISTS "IDX_roles_clientId" ON "${schemaName}"."roles" ("clientId")`,
        `CREATE INDEX IF NOT EXISTS "IDX_api_keys_clientId" ON "${schemaName}"."api_keys" ("clientId")`,
        `CREATE INDEX IF NOT EXISTS "IDX_api_keys_key" ON "${schemaName}"."api_keys" ("key")`,
        `CREATE INDEX IF NOT EXISTS "IDX_audit_logs_client_created" ON "${schemaName}"."audit_logs" ("clientId", "createdAt")`,
        `CREATE INDEX IF NOT EXISTS "IDX_audit_logs_user" ON "${schemaName}"."audit_logs" ("userId")`,
        `CREATE INDEX IF NOT EXISTS "IDX_audit_logs_action" ON "${schemaName}"."audit_logs" ("action")`,
        `CREATE INDEX IF NOT EXISTS "IDX_webhooks_clientId" ON "${schemaName}"."webhooks" ("clientId")`,
        `CREATE INDEX IF NOT EXISTS "IDX_webhook_events_webhookId" ON "${schemaName}"."webhook_events" ("webhookId")`,
        `CREATE INDEX IF NOT EXISTS "IDX_webhook_events_status" ON "${schemaName}"."webhook_events" ("status")`,
      ];

      for (const query of indexQueries) {
        await this.sharedDataSource.query(query);
      }

      // Reset search_path to default
      await this.sharedDataSource.query(`SET search_path TO public`);
      
      logger.info(`Created all standard tables in schema ${schemaName}`);
    } catch (error) {
      logger.error(`Failed to create tables in schema ${schemaName}`, { error });
      // Reset search_path even on error
      await this.sharedDataSource.query(`SET search_path TO public`).catch(() => {});
      throw error;
    }
  }

  /**
   * Close all tenant-specific DataSource connections
   */
  async closeAll(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    // Close database DataSources (schema-per-tenant uses shared DataSource, no cleanup needed)
    for (const [clientId, dataSource] of this.databaseDataSources.entries()) {
      if (dataSource.isInitialized) {
        closePromises.push(
          dataSource.destroy().catch((error) => {
            logger.error(`Error closing database DataSource for client ${clientId}`, { error });
          })
        );
      }
    }
    this.databaseDataSources.clear();

    await Promise.all(closePromises);
    logger.info('Closed all tenant DataSource connections');
  }

  /**
   * Get connection stats for monitoring
   */
  getConnectionStats(): {
    databaseConnections: number;
    totalConnections: number;
  } {
    const databaseConnections = Array.from(this.databaseDataSources.values()).filter(
      (ds) => ds.isInitialized
    ).length;

    return {
      databaseConnections,
      totalConnections: databaseConnections, // Schema-per-tenant uses shared connection
    };
  }
}

// Singleton instance
let tenantDataSourceManager: TenantDataSourceManager | null = null;

/**
 * Get or create singleton TenantDataSourceManager instance
 */
export function getTenantDataSourceManager(): TenantDataSourceManager {
  if (!tenantDataSourceManager) {
    tenantDataSourceManager = new TenantDataSourceManager(AppDataSource);
  }
  return tenantDataSourceManager;
}

