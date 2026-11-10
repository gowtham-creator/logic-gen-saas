import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowGlobalThemes1734800000000 implements MigrationInterface {
  name = 'AllowGlobalThemes1734800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the unique constraint that requires clientId
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_themes_client";
    `);

    // Make clientId nullable
    await queryRunner.query(`
      ALTER TABLE "themes" 
      ALTER COLUMN "clientId" DROP NOT NULL;
    `);

    // Create a new unique index that allows null (only one global theme)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_themes_client" 
      ON "themes" ("clientId") 
      WHERE "clientId" IS NOT NULL;
    `);

    // Create a unique partial index for global theme (only one null clientId allowed)
    // Using a partial unique index with a constant expression
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_themes_global" 
      ON "themes" ((CASE WHEN "clientId" IS NULL THEN 1 ELSE NULL END))
      WHERE "clientId" IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the new indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_themes_global";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_themes_client";
    `);

    // Delete any global themes (themes with null clientId)
    await queryRunner.query(`
      DELETE FROM "themes" WHERE "clientId" IS NULL;
    `);

    // Make clientId NOT NULL again
    await queryRunner.query(`
      ALTER TABLE "themes" 
      ALTER COLUMN "clientId" SET NOT NULL;
    `);

    // Recreate the original unique index
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_themes_client" 
      ON "themes" ("clientId");
    `);
  }
}

