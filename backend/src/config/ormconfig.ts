import { DataSourceOptions } from 'typeorm';
import { config } from './config';
import { getMigrationsPath } from './database';
import { User } from '../entities/User';
import { Client } from '../entities/Client';
import { Role } from '../entities/Role';
import { Permission } from '../entities/Permission';
import { RolePermission } from '../entities/RolePermission';
import { ClientSettings } from '../entities/ClientSettings';
import { ApiKey } from '../entities/ApiKey';
import { AuditLog } from '../entities/AuditLog';
import { Theme } from '../entities/Theme';

export const ormConfig: DataSourceOptions = {
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
  ],
  migrations: getMigrationsPath(),
  synchronize: false,
  logging: config.nodeEnv === 'development',
};

