import { DataSource } from 'typeorm';
import { config } from './config';
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
import { CustomTable } from '../entities/CustomTable';
import { SuperAdmin } from '../entities/SuperAdmin';
import { SuperAdminRole } from '../entities/SuperAdminRole';
import { SuperAdminRolePermission } from '../entities/SuperAdminRolePermission';
import { StorageEngine } from '../entities/StorageEngine';
import { StorageConfig } from '../entities/StorageConfig';
import { Workflow } from '../entities/Workflow';
import { WorkflowFile } from '../entities/WorkflowFile';
import { PasswordHistory } from '../entities/PasswordHistory';
import { UserDevice } from '../entities/UserDevice';

// Determine migration path based on environment
// In production (compiled), use dist/migrations/**/*.js
// In development, use src/migrations/**/*.ts
const isProduction = config.nodeEnv === 'production' || __filename.endsWith('.js');
const migrationsPath = isProduction 
  ? ['dist/migrations/**/*.js']
  : ['src/migrations/**/*.ts'];

// Export helper function for use in other scripts
export function getMigrationsPath(): string[] {
  const isProd = config.nodeEnv === 'production' || (typeof __filename !== 'undefined' && __filename.endsWith('.js'));
  return isProd 
    ? ['dist/migrations/**/*.js']
    : ['src/migrations/**/*.ts'];
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: config.databaseUrl,
  entities: [
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
    CustomTable,
    SuperAdmin,
    SuperAdminRole,
    SuperAdminRolePermission,
    StorageEngine,
    StorageConfig,
    Workflow,
    WorkflowFile,
    PasswordHistory,
    UserDevice,
  ],
  migrations: migrationsPath,
  synchronize: false,
  logging: false,
});

