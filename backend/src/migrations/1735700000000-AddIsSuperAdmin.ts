import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsSuperAdmin1735700000000 implements MigrationInterface {
  name = 'AddIsSuperAdmin1735700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if column already exists
    const columnExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'isSuperAdmin';
    `);

    if (columnExists.length === 0) {
      // Add isSuperAdmin column to users table
      await queryRunner.query(`
        ALTER TABLE "users" 
        ADD COLUMN "isSuperAdmin" boolean NOT NULL DEFAULT false;
      `);
    }

    // Check if index exists before creating
    const indexExists = await queryRunner.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'users' AND indexname = 'IDX_users_isSuperAdmin';
    `);

    if (indexExists.length === 0) {
      // Create index for faster lookups
      await queryRunner.query(`
        CREATE INDEX "IDX_users_isSuperAdmin" 
        ON "users" ("isSuperAdmin") 
        WHERE "isSuperAdmin" = true;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_isSuperAdmin"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "isSuperAdmin"`);
  }
}

