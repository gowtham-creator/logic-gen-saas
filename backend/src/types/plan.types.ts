/**
 * Plan-related types
 */
import { PlanDatabasePermissions } from './database.types';

export interface CreatePlanDto {
  name: string;
  description?: string;
  price?: number;
  billingPeriod?: string;
  allowedPermissions: Record<string, string[]>; // { resource: [actions] }
  limits: Record<string, number>;
  databasePermissions?: PlanDatabasePermissions;
  isActive?: boolean;
}

export interface UpdatePlanDto {
  name?: string;
  description?: string;
  price?: number;
  billingPeriod?: string;
  allowedPermissions?: Record<string, string[]>;
  limits?: Record<string, number>;
  databasePermissions?: PlanDatabasePermissions;
  isActive?: boolean;
}

