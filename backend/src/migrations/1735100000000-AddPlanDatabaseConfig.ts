import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlanDatabaseConfig1735100000000 implements MigrationInterface {
  name = 'AddPlanDatabaseConfig1735100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add databaseConfig column to plans table
    await queryRunner.query(`
      ALTER TABLE "plans" 
      ADD COLUMN IF NOT EXISTS "databaseConfig" jsonb NOT NULL DEFAULT '{}';
    `);

    // Set default configs for existing plans based on plan name
    // Basic plan: shared database, no customization
    await queryRunner.query(`
      UPDATE "plans" 
      SET "databaseConfig" = '{
        "isolationLevel": "shared",
        "allowCustomTables": false,
        "allowCustomColumns": false,
        "allowCustomMigrations": false
      }'::jsonb
      WHERE LOWER("name") = 'basic' 
        AND ("databaseConfig" = '{}'::jsonb OR "databaseConfig" IS NULL);
    `);

    // Professional plan: schema-per-tenant, with customization
    await queryRunner.query(`
      UPDATE "plans" 
      SET "databaseConfig" = '{
        "isolationLevel": "schema",
        "allowCustomTables": true,
        "allowCustomColumns": true,
        "allowCustomMigrations": true,
        "maxCustomTables": 20,
        "maxCustomColumns": 50
      }'::jsonb
      WHERE LOWER("name") = 'professional' 
        AND ("databaseConfig" = '{}'::jsonb OR "databaseConfig" IS NULL);
    `);

    // Enterprise plan: database-per-tenant, full customization
    await queryRunner.query(`
      UPDATE "plans" 
      SET "databaseConfig" = '{
        "isolationLevel": "database",
        "allowCustomTables": true,
        "allowCustomColumns": true,
        "allowCustomMigrations": true
      }'::jsonb
      WHERE LOWER("name") = 'enterprise' 
        AND ("databaseConfig" = '{}'::jsonb OR "databaseConfig" IS NULL);
    `);

    // Set default for any other plans (shared, no customization)
    await queryRunner.query(`
      UPDATE "plans" 
      SET "databaseConfig" = '{
        "isolationLevel": "shared",
        "allowCustomTables": false,
        "allowCustomColumns": false,
        "allowCustomMigrations": false
      }'::jsonb
      WHERE "databaseConfig" = '{}'::jsonb OR "databaseConfig" IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "plans" 
      DROP COLUMN IF EXISTS "databaseConfig";
    `);
  }
}

