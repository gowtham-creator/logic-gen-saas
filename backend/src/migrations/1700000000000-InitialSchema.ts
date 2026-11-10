import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  private async isTenantDatabase(queryRunner: QueryRunner): Promise<boolean> {
    try {
      const result = await queryRunner.query(`SELECT current_database() as dbname`);
      const dbName = result[0]?.dbname || '';
      return dbName.startsWith('tenant_') || dbName.startsWith('tenant-');
    } catch {
      return false;
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if this is a tenant database (skip system tables)
    const isTenantDatabase = await this.isTenantDatabase(queryRunner);
    
    // Clients table (system table - skip for tenant databases)
    if (!isTenantDatabase) {
      await queryRunner.query(`
        CREATE TABLE "clients" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "name" varchar NOT NULL,
          "subdomain" varchar UNIQUE NOT NULL,
          "ssoConfig" jsonb,
          "isActive" boolean NOT NULL DEFAULT true,
          "createdAt" timestamp NOT NULL DEFAULT now(),
          "updatedAt" timestamp NOT NULL DEFAULT now()
        );
        CREATE UNIQUE INDEX "IDX_clients_subdomain" ON "clients" ("subdomain");
      `);
    }

    // Users table
    const usersClientIdColumn = isTenantDatabase 
      ? '"clientId" uuid,'
      : '"clientId" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,';
    const usersIndex = isTenantDatabase
      ? 'CREATE UNIQUE INDEX "IDX_users_email" ON "users" ("email");'
      : 'CREATE UNIQUE INDEX "IDX_users_email_client" ON "users" ("email", "clientId");';
    
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar NOT NULL,
        "passwordHash" varchar NOT NULL,
        "firstName" varchar NOT NULL,
        "lastName" varchar NOT NULL,
        "refreshToken" varchar,
        "refreshTokenExpiresAt" timestamp,
        ${usersClientIdColumn}
        "roleId" uuid,
        "isActive" boolean NOT NULL DEFAULT true,
        "mustResetPassword" boolean NOT NULL DEFAULT false,
        "isDeveloper" boolean NOT NULL DEFAULT false,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      );
      ${usersIndex}
    `);

    // Roles table
    const rolesClientIdColumn = isTenantDatabase
      ? '"clientId" uuid,'
      : '"clientId" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,';
    const rolesIndex = isTenantDatabase
      ? 'CREATE UNIQUE INDEX "IDX_roles_name" ON "roles" ("name");'
      : 'CREATE UNIQUE INDEX "IDX_roles_name_client" ON "roles" ("name", "clientId");';
    
    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "description" varchar,
        ${rolesClientIdColumn}
        "parentRoleId" uuid REFERENCES "roles"("id") ON DELETE SET NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      );
      ${rolesIndex}
    `);

    // Permissions table
    await queryRunner.query(`
      CREATE TABLE "permissions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "resource" varchar NOT NULL,
        "action" varchar NOT NULL,
        "elementId" varchar,
        "scope" varchar,
        "description" varchar,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX "IDX_permissions_resource_action_element" ON "permissions" ("resource", "action", "elementId");
    `);

    // Role permissions junction table
    await queryRunner.query(`
      CREATE TABLE "role_permissions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "roleId" uuid NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
        "permissionId" uuid NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
        "createdAt" timestamp NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX "IDX_role_permissions_role_permission" ON "role_permissions" ("roleId", "permissionId");
    `);

    // Client settings table (system table - skip for tenant databases)
    if (!isTenantDatabase) {
      await queryRunner.query(`
        CREATE TABLE "client_settings" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "clientId" uuid UNIQUE NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
          "featureToggles" jsonb NOT NULL DEFAULT '{}',
          "settings" jsonb NOT NULL DEFAULT '{}',
          "createdAt" timestamp NOT NULL DEFAULT now(),
          "updatedAt" timestamp NOT NULL DEFAULT now()
        );
        CREATE UNIQUE INDEX "IDX_client_settings_client" ON "client_settings" ("clientId");
      `);
    }

    // API keys table
    const apiKeysClientIdColumn = isTenantDatabase
      ? '"clientId" uuid,'
      : '"clientId" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,';
    
    await queryRunner.query(`
      CREATE TABLE "api_keys" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "keyHash" varchar UNIQUE NOT NULL,
        ${apiKeysClientIdColumn}
        "scopes" text[] NOT NULL DEFAULT '{}',
        "allowedEndpoints" text[] NOT NULL DEFAULT '{}',
        "expiresAt" timestamp,
        "lastUsedAt" timestamp,
        "isRevoked" boolean NOT NULL DEFAULT false,
        "rateLimitPerMinute" integer NOT NULL DEFAULT 0,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX "IDX_api_keys_keyHash" ON "api_keys" ("keyHash");
    `);

    // Audit logs table
    const auditLogsClientIdColumn = isTenantDatabase
      ? '"clientId" uuid,'
      : '"clientId" uuid REFERENCES "clients"("id") ON DELETE CASCADE,';
    const auditLogsIndex = isTenantDatabase
      ? 'CREATE INDEX "IDX_audit_logs_created" ON "audit_logs" ("createdAt");'
      : 'CREATE INDEX "IDX_audit_logs_client_created" ON "audit_logs" ("clientId", "createdAt");';
    
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        ${auditLogsClientIdColumn}
        "userId" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "action" varchar NOT NULL,
        "resourceType" varchar,
        "resourceId" uuid,
        "metadata" jsonb,
        "ipAddress" varchar,
        "userAgent" varchar,
        "createdAt" timestamp NOT NULL DEFAULT now()
      );
      ${auditLogsIndex}
      CREATE INDEX "IDX_audit_logs_user" ON "audit_logs" ("userId");
      CREATE INDEX "IDX_audit_logs_action" ON "audit_logs" ("action");
    `);

    // Themes table
    const themesClientIdColumn = isTenantDatabase
      ? '"clientId" uuid,'
      : '"clientId" uuid UNIQUE NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,';
    const themesIndex = isTenantDatabase
      ? ''
      : 'CREATE UNIQUE INDEX "IDX_themes_client" ON "themes" ("clientId");';
    
    await queryRunner.query(`
      CREATE TABLE "themes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        ${themesClientIdColumn}
        "colors" jsonb NOT NULL DEFAULT '{}',
        "cssVariables" jsonb NOT NULL DEFAULT '{}',
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      );
      ${themesIndex}
    `);

    // Add foreign key for users.roleId
    await queryRunner.query(`
      ALTER TABLE "users" ADD CONSTRAINT "FK_users_role" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "themes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "api_keys"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "client_settings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "clients"`);
  }
}

