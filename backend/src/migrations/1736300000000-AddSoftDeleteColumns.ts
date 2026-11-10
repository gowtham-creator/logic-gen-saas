import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSoftDeleteColumns1736300000000 implements MigrationInterface {
  name = 'AddSoftDeleteColumns1736300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if this is a tenant database
    const isTenantDatabase = await this.isTenantDatabase(queryRunner);

    // Tables that exist in both shared and tenant databases
    const sharedAndTenantTables = [
      'users',
      'api_keys',
      'roles',
      'webhooks',
      'workflows',
      'role_templates',
    ];

    // Tables that only exist in shared database
    const sharedOnlyTables = [
      'clients',
      'plans',
      'custom_tables',
      'super_admins',
    ];

    // Add deletedAt to shared and tenant tables
    for (const tableName of sharedAndTenantTables) {
      await queryRunner.query(`
        ALTER TABLE "${tableName}"
        ADD COLUMN IF NOT EXISTS "deletedAt" timestamp;
      `);

      // Create index for faster queries excluding soft-deleted records
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_${tableName}_deletedAt" 
        ON "${tableName}" ("deletedAt") 
        WHERE "deletedAt" IS NULL;
      `);
    }

    // Add deletedAt to shared-only tables (only if not tenant database)
    if (!isTenantDatabase) {
      for (const tableName of sharedOnlyTables) {
        await queryRunner.query(`
          ALTER TABLE "${tableName}"
          ADD COLUMN IF NOT EXISTS "deletedAt" timestamp;
        `);

        // Create index for faster queries excluding soft-deleted records
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_${tableName}_deletedAt" 
          ON "${tableName}" ("deletedAt") 
          WHERE "deletedAt" IS NULL;
        `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const isTenantDatabase = await this.isTenantDatabase(queryRunner);

    const sharedAndTenantTables = [
      'users',
      'api_keys',
      'roles',
      'webhooks',
      'workflows',
      'role_templates',
    ];

    const sharedOnlyTables = [
      'clients',
      'plans',
      'custom_tables',
      'super_admins',
    ];

    // Remove indexes and columns from shared and tenant tables
    for (const tableName of sharedAndTenantTables) {
      await queryRunner.query(`
        DROP INDEX IF EXISTS "IDX_${tableName}_deletedAt";
      `);

      await queryRunner.query(`
        ALTER TABLE "${tableName}"
        DROP COLUMN IF EXISTS "deletedAt";
      `);
    }

    // Remove indexes and columns from shared-only tables
    if (!isTenantDatabase) {
      for (const tableName of sharedOnlyTables) {
        await queryRunner.query(`
          DROP INDEX IF EXISTS "IDX_${tableName}_deletedAt";
        `);

        await queryRunner.query(`
          ALTER TABLE "${tableName}"
          DROP COLUMN IF EXISTS "deletedAt";
        `);
      }
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

