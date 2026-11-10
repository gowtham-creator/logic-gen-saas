import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsDeveloper1735600000000 implements MigrationInterface {
  name = 'AddIsDeveloper1735600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if column already exists
    const columnExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'isDeveloper';
    `);

    if (columnExists.length === 0) {
      // Add isDeveloper column to users table
      await queryRunner.query(`
        ALTER TABLE "users" 
        ADD COLUMN "isDeveloper" boolean NOT NULL DEFAULT false;
      `);
    }

    // Check if index exists before creating
    const indexExists = await queryRunner.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'users' AND indexname = 'IDX_users_isDeveloper';
    `);

    if (indexExists.length === 0) {
      // Create index for faster lookups
      await queryRunner.query(`
        CREATE INDEX "IDX_users_isDeveloper" 
        ON "users" ("isDeveloper") 
        WHERE "isDeveloper" = true;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_isDeveloper"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "isDeveloper"`);
  }
}

