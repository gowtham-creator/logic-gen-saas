import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserSourceFields1736400000000 implements MigrationInterface {
  name = 'AddUserSourceFields1736400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if this is a tenant database
    const isTenantDatabase = await this.isTenantDatabase(queryRunner);

    // Add source and externalId columns to users table (exists in both shared and tenant databases)
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "source" varchar NOT NULL DEFAULT 'direct';
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "externalId" varchar;
    `);

    // Create index on source for faster queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_source" 
      ON "users" ("source");
    `);

    // Create index on externalId for faster lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_externalId" 
      ON "users" ("externalId") 
      WHERE "externalId" IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_users_externalId";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_users_source";
    `);

    // Remove columns
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "externalId";
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "source";
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

