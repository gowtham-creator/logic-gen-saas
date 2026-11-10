import { DataSource } from 'typeorm';
import { AppDataSource } from '../config/database';
import { DatabaseConfigService } from './DatabaseConfigService';
import { TenantDataSourceManager, getTenantDataSourceManager } from './TenantDataSourceManager';
import { logger } from '../utils/logger';
import { IsolationLevel, ClientDatabaseConfig } from '../types/database.types';
import * as fs from 'fs';
import * as path from 'path';

export interface MigrationResult {
  success: boolean;
  recordsMigrated: number;
  tablesMigrated: string[];
  backupFile?: string;
  recordsRemoved?: number;
  error?: string;
}

/**
 * Service to handle data migration when switching between database isolation levels
 */
export class DatabaseMigrationService {
  private dbConfigService: DatabaseConfigService;
  private tenantDataSourceManager: TenantDataSourceManager;
  private sharedDataSource: DataSource;

  // All tables that need to be migrated
  private readonly tablesToMigrate = [
    'users',
    'roles',
    'permissions',
    'role_permissions',
    'client_settings',
    'api_keys',
    'audit_logs',
    'themes',
    'webhooks',
    'webhook_events',
  ];

  constructor() {
    this.dbConfigService = new DatabaseConfigService();
    this.tenantDataSourceManager = getTenantDataSourceManager();
    this.sharedDataSource = AppDataSource;
  }

  /**
   * Check if migration is needed when switching isolation levels
   */
  async isMigrationNeeded(
    clientId: string,
    newIsolationLevel: IsolationLevel
  ): Promise<{ needed: boolean; reason?: string }> {
    const currentConfig = await this.dbConfigService.getClientDatabaseConfig(clientId);
    const currentLevel = currentConfig.isolationLevel;

    // No migration needed if staying at the same level
    if (currentLevel === newIsolationLevel) {
      return { needed: false };
    }

    // Check if client has any data
    const hasData = await this.hasClientData(clientId, currentLevel);
    
    if (!hasData) {
      return { needed: false, reason: 'No data to migrate' };
    }

    return { 
      needed: true, 
      reason: `Migration required: ${currentLevel} -> ${newIsolationLevel}` 
    };
  }

  /**
   * Check if client has any data in current isolation level
   */
  private async hasClientData(clientId: string, isolationLevel: IsolationLevel): Promise<boolean> {
    try {
      let sourceDataSource: DataSource;
      let tablePrefix = '';

      switch (isolationLevel) {
        case 'shared':
          sourceDataSource = this.sharedDataSource;
          tablePrefix = '';
          break;
        case 'database':
          sourceDataSource = await this.tenantDataSourceManager.getDataSource(clientId);
          tablePrefix = '';
          break;
        default:
          throw new Error(`Unsupported isolation level: ${isolationLevel}`);
      }

      // Check if any table has data for this client
      const checkQuery = `
        SELECT COUNT(*) as count 
        FROM ${tablePrefix}users 
        WHERE "clientId" = $1
        LIMIT 1
      `;

      const result = await sourceDataSource.query(checkQuery, [clientId]);
      return parseInt(result[0]?.count || '0', 10) > 0;
    } catch (error) {
      logger.error('Error checking if client has data', { error, clientId, isolationLevel });
      // Assume data exists to be safe
      return true;
    }
  }

  /**
   * Migrate data from one isolation level to another
   */
  async migrateData(
    clientId: string,
    fromLevel: IsolationLevel,
    toLevel: IsolationLevel,
    removeFromSource: boolean = false
  ): Promise<MigrationResult> {
    logger.info(`Starting data migration for client ${clientId}: ${fromLevel} -> ${toLevel}`);

    try {
      // Get source and target DataSources
      const { sourceDataSource, sourcePrefix } = await this.getSourceDataSource(clientId, fromLevel);
      const { targetDataSource, targetPrefix } = await this.getTargetDataSource(clientId, toLevel);

      // Ensure target database is ready (schema isolation not supported)

      let totalRecords = 0;
      const migratedTables: string[] = [];

      // Migrate each table
      for (const tableName of this.tablesToMigrate) {
        try {
          const records = await this.migrateTable(
            sourceDataSource,
            sourcePrefix,
            targetDataSource,
            targetPrefix,
            tableName,
            clientId
          );
          
          if (records > 0) {
            totalRecords += records;
            migratedTables.push(tableName);
            logger.info(`Migrated ${records} records from ${tableName} for client ${clientId}`);
          }
        } catch (error: any) {
          logger.error(`Failed to migrate table ${tableName}`, { error, clientId });
          // Continue with other tables
        }
      }

      logger.info(`Migration completed for client ${clientId}: ${totalRecords} records across ${migratedTables.length} tables`);

      let backupFile: string | undefined;
      let recordsRemoved = 0;

      // If requested and migrating FROM shared, create backup and remove source data
      if (removeFromSource && fromLevel === 'shared' && toLevel !== 'shared') {
        try {
          // Create backup SQL file
          backupFile = await this.createBackup(clientId, fromLevel, migratedTables);
          logger.info(`Backup created: ${backupFile}`);

          // Remove data from source
          recordsRemoved = await this.removeDataFromSource(clientId, fromLevel, migratedTables);
          logger.info(`Removed ${recordsRemoved} records from source for client ${clientId}`);
        } catch (error: any) {
          logger.error(`Failed to backup/remove source data for client ${clientId}`, { error });
          // Don't fail the migration if backup/cleanup fails, but log it
        }
      }

      return {
        success: true,
        recordsMigrated: totalRecords,
        tablesMigrated: migratedTables,
        backupFile,
        recordsRemoved,
      };
    } catch (error: any) {
      logger.error(`Migration failed for client ${clientId}`, { error });
      return {
        success: false,
        recordsMigrated: 0,
        tablesMigrated: [],
        error: error.message || 'Unknown error during migration',
      };
    }
  }

  /**
   * Get source DataSource and table prefix
   */
  private async getSourceDataSource(
    clientId: string,
    isolationLevel: IsolationLevel
  ): Promise<{ sourceDataSource: DataSource; sourcePrefix: string }> {
    switch (isolationLevel) {
      case 'shared':
        return {
          sourceDataSource: this.sharedDataSource,
          sourcePrefix: '',
        };
      case 'database':
        return {
          sourceDataSource: await this.tenantDataSourceManager.getDataSource(clientId),
          sourcePrefix: '',
        };
      default:
        throw new Error(`Unknown isolation level: ${isolationLevel}`);
    }
  }

  /**
   * Get target DataSource and table prefix
   */
  private async getTargetDataSource(
    clientId: string,
    isolationLevel: IsolationLevel
  ): Promise<{ targetDataSource: DataSource; targetPrefix: string }> {
    switch (isolationLevel) {
      case 'shared':
        return {
          targetDataSource: this.sharedDataSource,
          targetPrefix: '',
        };
      case 'database':
        return {
          targetDataSource: await this.tenantDataSourceManager.getDataSource(clientId),
          targetPrefix: '',
        };
      default:
        throw new Error(`Unknown isolation level: ${isolationLevel}`);
    }
  }

  /**
   * Migrate a single table
   */
  private async migrateTable(
    sourceDataSource: DataSource,
    sourcePrefix: string,
    targetDataSource: DataSource,
    targetPrefix: string,
    tableName: string,
    clientId: string
  ): Promise<number> {
    // Check if source table exists and has data
    const checkQuery = `
      SELECT COUNT(*) as count 
      FROM ${sourcePrefix}${tableName}
      WHERE "clientId" = $1
    `;

    let sourceCount = 0;
    try {
      const result = await sourceDataSource.query(checkQuery, [clientId]);
      sourceCount = parseInt(result[0]?.count || '0', 10);
    } catch (error) {
      // Table might not exist, skip
      return 0;
    }

    if (sourceCount === 0) {
      return 0; // No data to migrate
    }

    // Fetch all data from source
    const selectQuery = `SELECT * FROM ${sourcePrefix}${tableName} WHERE "clientId" = $1`;
    const records = await sourceDataSource.query(selectQuery, [clientId]);

    if (records.length === 0) {
      return 0;
    }

    // Insert into target (using INSERT ... ON CONFLICT DO NOTHING to handle duplicates)
    // Get column names from first record
    const columns = Object.keys(records[0]);
    const columnList = columns.map(col => `"${col}"`).join(', ');
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

    let inserted = 0;
    for (const record of records) {
      const values = columns.map(col => record[col]);
      const insertQuery = `
        INSERT INTO ${targetPrefix}${tableName} (${columnList})
        VALUES (${placeholders})
        ON CONFLICT DO NOTHING
      `;

      try {
        await targetDataSource.query(insertQuery, values);
        inserted++;
      } catch (error: any) {
        // If table doesn't exist in target, skip (it will be created by ensureSchema)
        if (error.message?.includes('does not exist')) {
          logger.warn(`Target table ${tableName} does not exist, skipping migration`);
          return 0;
        }
        throw error;
      }
    }

    return inserted;
  }

  /**
   * Verify migration by comparing record counts
   */
  async verifyMigration(
    clientId: string,
    fromLevel: IsolationLevel,
    toLevel: IsolationLevel
  ): Promise<{ verified: boolean; sourceCount: number; targetCount: number }> {
    try {
      const { sourceDataSource, sourcePrefix } = await this.getSourceDataSource(clientId, fromLevel);
      const { targetDataSource, targetPrefix } = await this.getTargetDataSource(clientId, toLevel);

      // Count records in users table (as a sample)
      const sourceQuery = `SELECT COUNT(*) as count FROM ${sourcePrefix}users WHERE "clientId" = $1`;
      const targetQuery = `SELECT COUNT(*) as count FROM ${targetPrefix}users WHERE "clientId" = $1`;

      const sourceResult = await sourceDataSource.query(sourceQuery, [clientId]);
      const targetResult = await targetDataSource.query(targetQuery, [clientId]);

      const sourceCount = parseInt(sourceResult[0]?.count || '0', 10);
      const targetCount = parseInt(targetResult[0]?.count || '0', 10);

      return {
        verified: sourceCount === targetCount,
        sourceCount,
        targetCount,
      };
    } catch (error) {
      logger.error('Error verifying migration', { error, clientId });
      return {
        verified: false,
        sourceCount: 0,
        targetCount: 0,
      };
    }
  }

  /**
   * Create SQL backup file before removing data from source
   */
  private async createBackup(
    clientId: string,
    sourceLevel: IsolationLevel,
    tables: string[]
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(process.cwd(), 'backups', 'migrations');
    
    // Ensure backup directory exists
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupFile = path.join(backupDir, `migration_${clientId}_${timestamp}.sql`);
    const { sourceDataSource, sourcePrefix } = await this.getSourceDataSource(clientId, sourceLevel);

    let sqlContent = `-- Migration Backup for Client: ${clientId}\n`;
    sqlContent += `-- Created: ${new Date().toISOString()}\n`;
    sqlContent += `-- Source Level: ${sourceLevel}\n`;
    sqlContent += `-- Tables: ${tables.join(', ')}\n\n`;

    // Generate INSERT statements for each table
    for (const tableName of tables) {
      try {
        const selectQuery = `SELECT * FROM ${sourcePrefix}${tableName} WHERE "clientId" = $1`;
        const records = await sourceDataSource.query(selectQuery, [clientId]);

        if (records.length > 0) {
          sqlContent += `-- Table: ${tableName} (${records.length} records)\n`;
          
          for (const record of records) {
            const columns = Object.keys(record);
            const columnList = columns.map(col => `"${col}"`).join(', ');
            const values = columns.map(col => {
              const value = record[col];
              if (value === null || value === undefined) return 'NULL';
              if (typeof value === 'string') {
                // Escape single quotes and backslashes
                const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "''");
                return `'${escaped}'`;
              }
              if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
              if (typeof value === 'number') return String(value);
              if (value instanceof Date) return `'${value.toISOString()}'`;
              if (Array.isArray(value) || typeof value === 'object') {
                const jsonStr = JSON.stringify(value).replace(/\\/g, '\\\\').replace(/'/g, "''");
                return `'${jsonStr}'::jsonb`;
              }
              return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
            }).join(', ');

            sqlContent += `INSERT INTO ${sourcePrefix}${tableName} (${columnList}) VALUES (${values}) ON CONFLICT DO NOTHING;\n`;
          }
          sqlContent += '\n';
        }
      } catch (error: any) {
        logger.warn(`Failed to backup table ${tableName}`, { error });
        sqlContent += `-- Error backing up table ${tableName}: ${error.message}\n\n`;
      }
    }

    // Write backup file
    fs.writeFileSync(backupFile, sqlContent, 'utf8');
    logger.info(`Backup file created: ${backupFile}`);

    return backupFile;
  }

  /**
   * Remove data from source after successful migration
   */
  private async removeDataFromSource(
    clientId: string,
    sourceLevel: IsolationLevel,
    tables: string[]
  ): Promise<number> {
    const { sourceDataSource, sourcePrefix } = await this.getSourceDataSource(clientId, sourceLevel);
    let totalRemoved = 0;

    for (const tableName of tables) {
      try {
        // Delete records for this client
        const deleteQuery = `DELETE FROM ${sourcePrefix}${tableName} WHERE "clientId" = $1`;
        const result = await sourceDataSource.query(deleteQuery, [clientId]);
        const removed = result.rowCount || 0;
        totalRemoved += removed;
        
        if (removed > 0) {
          logger.info(`Removed ${removed} records from ${sourcePrefix}${tableName} for client ${clientId}`);
        }
      } catch (error: any) {
        logger.error(`Failed to remove data from ${tableName}`, { error, clientId });
        // Continue with other tables
      }
    }

    return totalRemoved;
  }
}

