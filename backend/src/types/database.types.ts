/**
 * Database configuration types for plan-based database model configuration
 */

export type IsolationLevel = 'shared' | 'database';

/**
 * Client-level database configuration
 * This is stored per client and defines their actual database setup
 */
export interface ClientDatabaseConfig {
  isolationLevel: IsolationLevel;
  allowCustomTables: boolean;
  allowCustomColumns: boolean;
  allowCustomMigrations: boolean;
  maxCustomTables?: number;
  maxCustomColumns?: number;
  databaseUrl?: string; // For enterprise (custom DB)
}

/**
 * Plan-level database configuration permissions
 * Defines what database configuration methods are allowed for clients with this plan
 */
export interface PlanDatabasePermissions {
  allowedIsolationLevels: IsolationLevel[]; // e.g., ['shared'] or ['shared', 'database']
  allowCustomTables: boolean;
  allowCustomColumns: boolean;
  allowCustomMigrations: boolean;
  maxCustomTables?: number; // Max tables allowed if custom tables are enabled
  maxCustomColumns?: number; // Max columns per table if custom columns are enabled
}

export const DEFAULT_DATABASE_CONFIG: ClientDatabaseConfig = {
  isolationLevel: 'shared',
  allowCustomTables: false,
  allowCustomColumns: false,
  allowCustomMigrations: false,
};

/**
 * Default database permissions for plans
 */
export const PLAN_DATABASE_PERMISSIONS: Record<string, PlanDatabasePermissions> = {
  basic: {
    allowedIsolationLevels: ['shared'],
    allowCustomTables: false,
    allowCustomColumns: false,
    allowCustomMigrations: false,
  },
  professional: {
    allowedIsolationLevels: ['shared'],
    allowCustomTables: true,
    allowCustomColumns: true,
    allowCustomMigrations: true,
    maxCustomTables: 20,
    maxCustomColumns: 50,
  },
  enterprise: {
    allowedIsolationLevels: ['shared', 'database'],
    allowCustomTables: true,
    allowCustomColumns: true,
    allowCustomMigrations: true,
  },
};

