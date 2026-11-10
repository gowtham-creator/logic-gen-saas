import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMFAColumns1736500000000 implements MigrationInterface {
  name = 'AddMFAColumns1736500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if this is a tenant database
    const isTenantDatabase = await this.isTenantDatabase(queryRunner);

    // Add MFA columns to clients table (only in shared database)
    if (!isTenantDatabase) {
      await queryRunner.query(`
        ALTER TABLE "clients"
        ADD COLUMN IF NOT EXISTS "enforceMFA" boolean NOT NULL DEFAULT false;
      `);

      await queryRunner.query(`
        ALTER TABLE "clients"
        ADD COLUMN IF NOT EXISTS "mfaRequired" boolean NOT NULL DEFAULT false;
      `);

      // Create index on enforceMFA for faster queries
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_clients_enforceMFA" 
        ON "clients" ("enforceMFA") 
        WHERE "enforceMFA" = true;
      `);
    }

    // Add MFA columns to users table (exists in both shared and tenant databases)
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "mfaEnabled" boolean NOT NULL DEFAULT false;
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "totpSecret" text;
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "mfaBackupCodes" text;
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "mfaVerified" boolean NOT NULL DEFAULT false;
    `);

    // Create index on mfaEnabled for faster queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_mfaEnabled" 
      ON "users" ("mfaEnabled") 
      WHERE "mfaEnabled" = true;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const isTenantDatabase = await this.isTenantDatabase(queryRunner);

    // Drop indexes and columns from users table
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_users_mfaEnabled";
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "mfaVerified";
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "mfaBackupCodes";
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "totpSecret";
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "mfaEnabled";
    `);

    // Drop indexes and columns from clients table (only in shared database)
    if (!isTenantDatabase) {
      await queryRunner.query(`
        DROP INDEX IF EXISTS "IDX_clients_enforceMFA";
      `);

      await queryRunner.query(`
        ALTER TABLE "clients"
        DROP COLUMN IF EXISTS "mfaRequired";
      `);

      await queryRunner.query(`
        ALTER TABLE "clients"
        DROP COLUMN IF EXISTS "enforceMFA";
      `);
    }
  }

  private async isTenantDatabase(queryRunner: QueryRunner): Promise<boolean> {
    try {
      const result = await queryRunner.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'clients'
        ) as exists;
      `);
      return !result[0]?.exists;
    } catch {
      return false;
    }
  }
}

