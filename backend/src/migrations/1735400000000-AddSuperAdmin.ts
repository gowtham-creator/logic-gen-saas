import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSuperAdmin1735400000000 implements MigrationInterface {
  name = 'AddSuperAdmin1735400000000';

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
    const isTenantDatabase = await this.isTenantDatabase(queryRunner);
    
    // Super admin tables (system tables - skip for tenant databases)
    if (!isTenantDatabase) {
      // Create super_admin_roles table
      await queryRunner.query(`
        CREATE TABLE "super_admin_roles" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "name" varchar NOT NULL UNIQUE,
          "description" varchar,
          "isActive" boolean NOT NULL DEFAULT true,
          "createdAt" timestamp NOT NULL DEFAULT now(),
          "updatedAt" timestamp NOT NULL DEFAULT now()
        );
        CREATE INDEX "IDX_super_admin_roles_name" ON "super_admin_roles" ("name");
      `);

      // Create super_admins table
      await queryRunner.query(`
        CREATE TABLE "super_admins" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "email" varchar NOT NULL UNIQUE,
          "passwordHash" varchar NOT NULL,
          "firstName" varchar NOT NULL,
          "lastName" varchar NOT NULL,
          "refreshToken" varchar,
          "refreshTokenExpiresAt" timestamp,
          "roleId" uuid,
          "isActive" boolean NOT NULL DEFAULT true,
          "mustResetPassword" boolean NOT NULL DEFAULT false,
          "createdAt" timestamp NOT NULL DEFAULT now(),
          "updatedAt" timestamp NOT NULL DEFAULT now(),
          CONSTRAINT "FK_super_admins_role" FOREIGN KEY ("roleId") REFERENCES "super_admin_roles"("id") ON DELETE SET NULL
        );
        CREATE INDEX "IDX_super_admins_email" ON "super_admins" ("email");
        CREATE INDEX "IDX_super_admins_roleId" ON "super_admins" ("roleId");
      `);

      // Create super_admin_role_permissions table
      await queryRunner.query(`
        CREATE TABLE "super_admin_role_permissions" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "roleId" uuid NOT NULL,
          "permissionId" uuid NOT NULL,
          "createdAt" timestamp NOT NULL DEFAULT now(),
          "updatedAt" timestamp NOT NULL DEFAULT now(),
          CONSTRAINT "FK_super_admin_role_permissions_role" FOREIGN KEY ("roleId") REFERENCES "super_admin_roles"("id") ON DELETE CASCADE,
          CONSTRAINT "FK_super_admin_role_permissions_permission" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE,
          CONSTRAINT "UQ_super_admin_role_permissions" UNIQUE ("roleId", "permissionId")
        );
        CREATE INDEX "IDX_super_admin_role_permissions_roleId" ON "super_admin_role_permissions" ("roleId");
        CREATE INDEX "IDX_super_admin_role_permissions_permissionId" ON "super_admin_role_permissions" ("permissionId");
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const isTenantDatabase = await this.isTenantDatabase(queryRunner);
    
    if (!isTenantDatabase) {
      await queryRunner.query(`DROP TABLE IF EXISTS "super_admin_role_permissions"`);
      await queryRunner.query(`DROP TABLE IF EXISTS "super_admins"`);
      await queryRunner.query(`DROP TABLE IF EXISTS "super_admin_roles"`);
    }
  }
}

