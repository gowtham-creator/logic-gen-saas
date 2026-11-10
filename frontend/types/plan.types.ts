/**
 * Plan-related types
 */

export interface PlanDatabasePermissions {
  allowedIsolationLevels: ('shared' | 'database')[];
  allowCustomTables: boolean;
  allowCustomColumns: boolean;
  allowCustomMigrations: boolean;
  maxCustomTables?: number;
  maxCustomColumns?: number;
}

export interface Plan {
  id?: string;
  name: string;
  description?: string;
  price?: number;
  billingPeriod?: string;
  allowedPermissions: Record<string, string[]>;
  limits: Record<string, number>;
  databasePermissions?: PlanDatabasePermissions;
  isActive?: boolean;
}

