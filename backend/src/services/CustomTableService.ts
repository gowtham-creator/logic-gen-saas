import { Repository, IsNull } from 'typeorm';
import { AppDataSource } from '../config/database';
import { CustomTable } from '../entities/CustomTable';
import { DatabaseConfigService } from './DatabaseConfigService';
import { getTenantDataSource } from '../utils/tenantRepository';
import { TenantRequest } from '../types/middleware.types';
import { CreateCustomTableDto, AddColumnDto, CreateIndexDto } from '../types/customTable.types';
import { logger } from '../utils/logger';
import { DATABASE_CONSTANTS } from '../constants/database';

/**
 * Service for managing custom tables and columns for tenants
 */
export class CustomTableService {
  private customTableRepository: Repository<CustomTable>;
  private dbConfigService: DatabaseConfigService;

  constructor() {
    this.customTableRepository = AppDataSource.getRepository(CustomTable);
    this.dbConfigService = new DatabaseConfigService();
  }

  /**
   * Create a custom table for a tenant
   */
  async createCustomTable(
    req: TenantRequest,
    data: CreateCustomTableDto
  ): Promise<CustomTable> {
    const clientId = req.clientId!;

    // Check plan permissions
    const canCreate = await this.dbConfigService.canCreateCustomTable(clientId);
    if (!canCreate) {
      throw new Error('Your plan does not allow creating custom tables');
    }

    // Check table limit
    const currentCount = await this.customTableRepository.count({
      where: { clientId },
    });
    const withinLimit = await this.dbConfigService.checkCustomTableLimit(
      clientId,
      currentCount
    );
    if (!withinLimit) {
      const maxTables = await this.dbConfigService.getMaxCustomTables(clientId);
      throw new Error(`Table limit reached. Maximum ${maxTables} custom tables allowed.`);
    }

    // Validate table name
    this.validateTableName(data.tableName);

    // Check if table already exists (excluding soft-deleted)
    const existing = await this.customTableRepository.findOne({
      where: { clientId, tableName: data.tableName, deletedAt: IsNull() },
    });
    if (existing) {
      throw new Error(`Table "${data.tableName}" already exists`);
    }

    // Validate columns
    this.validateColumns(data.columns);

    // Get tenant DataSource
    const tenantDataSource = getTenantDataSource(req);
    const config = await this.dbConfigService.getClientDatabaseConfig(clientId);
    // Schema isolation is not supported - only shared and database isolation levels
    const schemaName = undefined;

    // Build and execute CREATE TABLE SQL
    const sql = this.buildCreateTableSQL(data.tableName, data.columns, data.indexes, data.foreignKeys, schemaName);
    
    try {
      // Execute in tenant's schema/database
      // For schema-per-tenant, we use qualified table names in SQL
      // For database-per-tenant, we use the tenant's DataSource directly
      await tenantDataSource.query(sql);

      // Save metadata
      const customTable = this.customTableRepository.create({
        clientId,
        tableName: data.tableName,
        columns: data.columns,
        indexes: data.indexes || [],
        foreignKeys: data.foreignKeys || [],
        schemaName,
      });

      const saved = await this.customTableRepository.save(customTable);
      logger.info(`Created custom table "${data.tableName}" for client ${clientId}`);
      return saved;
    } catch (error: any) {
      logger.error(`Failed to create custom table "${data.tableName}"`, { error, clientId });
      throw new Error(`Failed to create table: ${error.message}`);
    }
  }

  /**
   * Add a column to an existing custom table
   */
  async addColumn(
    req: TenantRequest,
    tableName: string,
    column: AddColumnDto
  ): Promise<void> {
    const clientId = req.clientId!;

    // Check plan permissions
    const canAdd = await this.dbConfigService.canCreateCustomColumn(clientId);
    if (!canAdd) {
      throw new Error('Your plan does not allow adding custom columns');
    }

    // Check if table exists and belongs to client (excluding soft-deleted)
    const customTable = await this.customTableRepository.findOne({
      where: { clientId, tableName, deletedAt: IsNull() },
    });
    if (!customTable) {
      throw new Error(`Table "${tableName}" not found`);
    }

    // Check column limit
    const currentColumnCount = customTable.columns.length;
    const withinLimit = await this.dbConfigService.checkCustomColumnLimit(
      clientId,
      currentColumnCount
    );
    if (!withinLimit) {
      const maxColumns = await this.dbConfigService.getMaxCustomColumns(clientId);
      throw new Error(`Column limit reached. Maximum ${maxColumns} columns allowed.`);
    }

    // Validate column
    this.validateColumn(column);

    // Check if column already exists
    if (customTable.columns.some((c) => c.name === column.name)) {
      throw new Error(`Column "${column.name}" already exists in table "${tableName}"`);
    }

    // Get tenant DataSource
    const tenantDataSource = getTenantDataSource(req);
    const schemaName = customTable.schemaName;

    // Build ALTER TABLE SQL
    const sql = this.buildAddColumnSQL(tableName, column, schemaName);

    try {
      // Execute in tenant's schema/database (qualified names handle schema)
      await tenantDataSource.query(sql);

      // Update metadata
      customTable.columns.push({
        name: column.name,
        type: column.type,
        nullable: column.nullable ?? true,
        defaultValue: column.defaultValue,
        length: column.length,
        precision: column.precision,
        scale: column.scale,
        unique: column.unique,
      });

      await this.customTableRepository.save(customTable);
      logger.info(`Added column "${column.name}" to table "${tableName}" for client ${clientId}`);
    } catch (error: any) {
      logger.error(`Failed to add column to table "${tableName}"`, { error, clientId });
      throw new Error(`Failed to add column: ${error.message}`);
    }
  }

  /**
   * List all custom tables for a client
   */
  async listCustomTables(clientId: string): Promise<CustomTable[]> {
    return this.customTableRepository.find({
      where: { clientId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get a specific custom table
   */
  async getCustomTable(clientId: string, tableName: string): Promise<CustomTable | null> {
    return this.customTableRepository.findOne({
      where: { clientId, tableName, deletedAt: IsNull() },
    });
  }

  /**
   * Delete a custom table
   */
  async deleteCustomTable(req: TenantRequest, tableName: string): Promise<void> {
    const clientId = req.clientId!;

    const customTable = await this.customTableRepository.findOne({
      where: { clientId, tableName, deletedAt: IsNull() },
    });
    if (!customTable) {
      throw new Error(`Table "${tableName}" not found`);
    }

    const tenantDataSource = getTenantDataSource(req);
    const schemaName = customTable.schemaName;

    // Build DROP TABLE SQL
    const qualifiedTableName = schemaName 
      ? `"${schemaName}"."${this.escapeIdentifier(tableName)}"`
      : this.escapeIdentifier(tableName);
    const sql = `DROP TABLE IF EXISTS ${qualifiedTableName} CASCADE`;

    try {
      // Execute in tenant's schema/database (qualified names handle schema)
      await tenantDataSource.query(sql);

      // Soft delete metadata (set deletedAt)
      await this.customTableRepository.update({ id: customTable.id }, { deletedAt: new Date() });
      logger.info(`Deleted custom table "${tableName}" for client ${clientId}`);
    } catch (error: any) {
      logger.error(`Failed to delete custom table "${tableName}"`, { error, clientId });
      throw new Error(`Failed to delete table: ${error.message}`);
    }
  }

  /**
   * Build CREATE TABLE SQL statement
   */
  private buildCreateTableSQL(
    tableName: string,
    columns: CreateCustomTableDto['columns'],
    indexes?: CreateCustomTableDto['indexes'],
    foreignKeys?: CreateCustomTableDto['foreignKeys'],
    schemaName?: string
  ): string {
    const qualifiedTableName = schemaName
      ? `"${schemaName}"."${this.escapeIdentifier(tableName)}"`
      : this.escapeIdentifier(tableName);

    const columnDefinitions = columns.map((col) => {
      let def = `${this.escapeIdentifier(col.name)} ${this.getPostgresType(col)}`;
      
      if (col.unique) {
        def += ' UNIQUE';
      }
      
      if (!col.nullable) {
        def += ' NOT NULL';
      }
      
      if (col.defaultValue !== undefined) {
        def += ` DEFAULT ${this.formatDefaultValue(col.defaultValue)}`;
      }

      return def;
    });

    let sql = `CREATE TABLE ${qualifiedTableName} (\n  ${columnDefinitions.join(',\n  ')}`;

    // Add foreign keys
    if (foreignKeys && foreignKeys.length > 0) {
      const fkDefinitions = foreignKeys.map((fk) => {
        const cols = fk.columns.map((c) => this.escapeIdentifier(c)).join(', ');
        const refCols = fk.referencedColumns.map((c) => this.escapeIdentifier(c)).join(', ');
        const onDelete = fk.onDelete || 'NO ACTION';
        const onUpdate = fk.onUpdate || 'NO ACTION';
        const refTable = schemaName
          ? `"${schemaName}"."${this.escapeIdentifier(fk.referencedTable)}"`
          : this.escapeIdentifier(fk.referencedTable);
        
        return `CONSTRAINT ${this.escapeIdentifier(fk.name)} FOREIGN KEY (${cols}) REFERENCES ${refTable}(${refCols}) ON DELETE ${onDelete} ON UPDATE ${onUpdate}`;
      });
      sql += ',\n  ' + fkDefinitions.join(',\n  ');
    }

    sql += '\n)';

    // Add indexes (after table creation)
    if (indexes && indexes.length > 0) {
      const indexStatements = indexes.map((idx) => {
        const cols = idx.columns.map((c) => this.escapeIdentifier(c)).join(', ');
        const unique = idx.unique ? 'UNIQUE ' : '';
        return `CREATE ${unique}INDEX ${this.escapeIdentifier(idx.name)} ON ${qualifiedTableName} (${cols})`;
      });
      sql += '; ' + indexStatements.join('; ');
    }

    return sql;
  }

  /**
   * Build ALTER TABLE ADD COLUMN SQL statement
   */
  private buildAddColumnSQL(
    tableName: string,
    column: AddColumnDto,
    schemaName?: string
  ): string {
    const qualifiedTableName = schemaName
      ? `"${schemaName}"."${this.escapeIdentifier(tableName)}"`
      : this.escapeIdentifier(tableName);

    let def = `ALTER TABLE ${qualifiedTableName} ADD COLUMN ${this.escapeIdentifier(column.name)} ${this.getPostgresType(column)}`;
    
    if (column.unique) {
      def += ' UNIQUE';
    }
    
    if (!column.nullable) {
      def += ' NOT NULL';
    }
    
    if (column.defaultValue !== undefined) {
      def += ` DEFAULT ${this.formatDefaultValue(column.defaultValue)}`;
    }

    return def;
  }

  /**
   * Get PostgreSQL type string
   */
  private getPostgresType(column: { type: string; length?: number; precision?: number; scale?: number }): string {
    const type = column.type.toLowerCase();
    
    switch (type) {
      case 'varchar':
      case 'char':
        return column.length ? `${type}(${column.length})` : type === 'varchar' ? 'varchar' : 'char(1)';
      case 'decimal':
      case 'numeric':
        if (column.precision && column.scale) {
          return `${type}(${column.precision},${column.scale})`;
        } else if (column.precision) {
          return `${type}(${column.precision})`;
        }
        return type;
      default:
        return type;
    }
  }

  /**
   * Format default value for SQL
   */
  private formatDefaultValue(value: any): string {
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`;
    }
    if (value === null) {
      return 'NULL';
    }
    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }
    if (value === 'CURRENT_TIMESTAMP' || value === 'NOW()') {
      return 'CURRENT_TIMESTAMP';
    }
    return String(value);
  }

  /**
   * Escape SQL identifier
   */
  private escapeIdentifier(identifier: string): string {
    // Validate identifier (alphanumeric, underscore, no spaces)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
      throw new Error(`Invalid identifier: ${identifier}`);
    }
    return `"${identifier}"`;
  }

  /**
   * Validate table name
   */
  private validateTableName(tableName: string): void {
    if (!tableName || tableName.length === 0) {
      throw new Error('Table name is required');
    }
    if (tableName.length > 63) {
      throw new Error('Table name must be 63 characters or less');
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error('Table name must start with a letter or underscore and contain only alphanumeric characters and underscores');
    }
    
    // Reserved words check (basic)
    const reserved = ['user', 'table', 'select', 'insert', 'update', 'delete', 'drop', 'alter', 'create'];
    if (reserved.includes(tableName.toLowerCase())) {
      throw new Error(`Table name "${tableName}" is a reserved word`);
    }
  }

  /**
   * Validate column
   */
  private validateColumn(column: AddColumnDto): void {
    if (!column.name || column.name.length === 0) {
      throw new Error('Column name is required');
    }
    if (column.name.length > 63) {
      throw new Error('Column name must be 63 characters or less');
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column.name)) {
      throw new Error('Column name must start with a letter or underscore and contain only alphanumeric characters and underscores');
    }
    
    if (!column.type) {
      throw new Error('Column type is required');
    }
    
    // Validate PostgreSQL types
    const validTypes = [
      'varchar', 'char', 'text',
      'integer', 'bigint', 'smallint', 'serial', 'bigserial',
      'decimal', 'numeric', 'real', 'double precision',
      'boolean',
      'date', 'time', 'timestamp', 'timestamptz',
      'uuid',
      'json', 'jsonb',
    ];
    
    const type = column.type.toLowerCase();
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid column type: ${column.type}. Allowed types: ${validTypes.join(', ')}`);
    }
  }

  /**
   * Validate columns array
   */
  private validateColumns(columns: CreateCustomTableDto['columns']): void {
    if (!columns || columns.length === 0) {
      throw new Error('At least one column is required');
    }
    if (columns.length > DATABASE_CONSTANTS.MAX_COLUMNS_PER_TABLE) {
      throw new Error(`Maximum ${DATABASE_CONSTANTS.MAX_COLUMNS_PER_TABLE} columns allowed per table`);
    }
    
    columns.forEach((col) => this.validateColumn(col));
    
    // Check for duplicate column names
    const names = columns.map((c) => c.name.toLowerCase());
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    if (duplicates.length > 0) {
      throw new Error(`Duplicate column names: ${duplicates.join(', ')}`);
    }
  }
}

