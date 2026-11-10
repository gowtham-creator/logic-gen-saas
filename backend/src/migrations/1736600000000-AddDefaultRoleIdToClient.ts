import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDefaultRoleIdToClient1736600000000 implements MigrationInterface {
  name = 'AddDefaultRoleIdToClient1736600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if this is a tenant database (skip system tables)
    const isTenantDatabase = await this.isTenantDatabase(queryRunner);

    if (isTenantDatabase) {
      // Tenant databases don't have clients table
      return;
    }

    // Add defaultRoleId column to clients
    await queryRunner.query(`
      ALTER TABLE "clients"
      ADD COLUMN IF NOT EXISTS "defaultRoleId" uuid;
    `);

    // Add foreign key constraint (optional, can be null)
    // Note: We don't add a foreign key because the role might be in a tenant database
    // and we can't reference it from the main database
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const isTenantDatabase = await this.isTenantDatabase(queryRunner);

    if (isTenantDatabase) {
      return;
    }

    // Remove column
    await queryRunner.query(`
      ALTER TABLE "clients"
      DROP COLUMN IF EXISTS "defaultRoleId";
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

