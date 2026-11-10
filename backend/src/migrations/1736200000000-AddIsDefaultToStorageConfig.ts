import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsDefaultToStorageConfig1736200000000 implements MigrationInterface {
  name = 'AddIsDefaultToStorageConfig1736200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if this is a tenant database (skip system tables)
    const isTenantDatabase = await this.isTenantDatabase(queryRunner);

    if (isTenantDatabase) {
      // Tenant databases don't have storage_configs table
      return;
    }

    // Add isDefault column to storage_configs
    await queryRunner.query(`
      ALTER TABLE "storage_configs"
      ADD COLUMN IF NOT EXISTS "isDefault" boolean NOT NULL DEFAULT false;
    `);

    // Create index for faster lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_storage_configs_isDefault" 
      ON "storage_configs" ("isDefault") 
      WHERE "isDefault" = true;
    `);

    // Update existing default configs (where clientId is null) to isDefault = true
    await queryRunner.query(`
      UPDATE "storage_configs"
      SET "isDefault" = true
      WHERE "clientId" IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const isTenantDatabase = await this.isTenantDatabase(queryRunner);

    if (isTenantDatabase) {
      return;
    }

    // Drop index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_storage_configs_isDefault";
    `);

    // Remove column
    await queryRunner.query(`
      ALTER TABLE "storage_configs"
      DROP COLUMN IF EXISTS "isDefault";
    `);
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

