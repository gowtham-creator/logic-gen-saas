import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddThemeFavicon1734700000000 implements MigrationInterface {
  name = 'AddThemeFavicon1734700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add favicon, logo, and themeName columns to themes table
    await queryRunner.query(`
      ALTER TABLE "themes" 
      ADD COLUMN IF NOT EXISTS "faviconUrl" varchar,
      ADD COLUMN IF NOT EXISTS "logoUrl" varchar,
      ADD COLUMN IF NOT EXISTS "themeName" varchar NOT NULL DEFAULT 'default';
    `);

    // Create default theme for existing clients
    await queryRunner.query(`
      INSERT INTO "themes" ("clientId", "colors", "cssVariables", "themeName", "createdAt", "updatedAt")
      SELECT 
        c.id as "clientId",
        '{"primary":"#3b82f6","secondary":"#8b5cf6","accent":"#10b981","background":"#ffffff","text":"#1f2937"}'::jsonb as "colors",
        '{}'::jsonb as "cssVariables",
        'default' as "themeName",
        NOW() as "createdAt",
        NOW() as "updatedAt"
      FROM "clients" c
      WHERE NOT EXISTS (
        SELECT 1 FROM "themes" t WHERE t."clientId" = c.id
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "themes" 
      DROP COLUMN IF EXISTS "faviconUrl",
      DROP COLUMN IF EXISTS "logoUrl",
      DROP COLUMN IF EXISTS "themeName";
    `);
  }
}

