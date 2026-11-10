import { MigrationInterface, QueryRunner } from 'typeorm';

export class MoveDatabaseConfigToClient1735300000000 implements MigrationInterface {
  name = 'MoveDatabaseConfigToClient1735300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add databaseConfig to clients table
    await queryRunner.query(`
      ALTER TABLE "clients" 
      ADD COLUMN IF NOT EXISTS "databaseConfig" jsonb;
    `);

    // Check if databaseConfig column exists in plans table
    const plansTableInfo = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'plans' AND column_name = 'databaseConfig'
    `);

    if (plansTableInfo.length > 0) {
      // First, convert existing databaseConfig to databasePermissions format (before renaming)
      await queryRunner.query(`
        UPDATE "plans" 
        SET "databaseConfig" = jsonb_build_object(
          'allowedIsolationLevels', 
          CASE 
            WHEN ("databaseConfig"->>'isolationLevel')::text = 'shared' THEN '["shared"]'::jsonb
            WHEN ("databaseConfig"->>'isolationLevel')::text = 'schema' THEN '["shared", "schema"]'::jsonb
            WHEN ("databaseConfig"->>'isolationLevel')::text = 'database' THEN '["shared", "schema", "database"]'::jsonb
            ELSE '["shared"]'::jsonb
          END,
          'allowCustomTables', COALESCE(("databaseConfig"->>'allowCustomTables')::boolean, false),
          'allowCustomColumns', COALESCE(("databaseConfig"->>'allowCustomColumns')::boolean, false),
          'allowCustomMigrations', COALESCE(("databaseConfig"->>'allowCustomMigrations')::boolean, false),
          'maxCustomTables', CASE WHEN ("databaseConfig"->>'maxCustomTables') IS NOT NULL THEN ("databaseConfig"->>'maxCustomTables')::integer ELSE NULL END,
          'maxCustomColumns', CASE WHEN ("databaseConfig"->>'maxCustomColumns') IS NOT NULL THEN ("databaseConfig"->>'maxCustomColumns')::integer ELSE NULL END
        )
        WHERE "databaseConfig" IS NOT NULL 
          AND "databaseConfig" != '{}'::jsonb;
      `);

      // Now rename the column
      await queryRunner.query(`
        ALTER TABLE "plans" 
        RENAME COLUMN "databaseConfig" TO "databasePermissions";
      `);
    } else {
      // Column doesn't exist, add databasePermissions directly
      await queryRunner.query(`
        ALTER TABLE "plans" 
        ADD COLUMN IF NOT EXISTS "databasePermissions" jsonb NOT NULL DEFAULT '{}';
      `);
    }

    // Set default databasePermissions for plans that don't have it
    await queryRunner.query(`
      UPDATE "plans" 
      SET "databasePermissions" = '{
        "allowedIsolationLevels": ["shared"],
        "allowCustomTables": false,
        "allowCustomColumns": false,
        "allowCustomMigrations": false
      }'::jsonb
      WHERE "databasePermissions" IS NULL 
        OR "databasePermissions" = '{}'::jsonb;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove databaseConfig from clients
    await queryRunner.query(`
      ALTER TABLE "clients" 
      DROP COLUMN IF EXISTS "databaseConfig";
    `);

    // Rename databasePermissions back to databaseConfig in plans
    await queryRunner.query(`
      ALTER TABLE "plans" 
      RENAME COLUMN "databasePermissions" TO "databaseConfig";
    `);
  }
}

