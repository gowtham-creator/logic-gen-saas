import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMustResetPassword1734600000000 implements MigrationInterface {
  name = 'AddMustResetPassword1734600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if column already exists
    const columnExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'mustResetPassword';
    `);

    if (columnExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "users" 
        ADD COLUMN "mustResetPassword" boolean NOT NULL DEFAULT false;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Check if column exists before dropping
    const columnExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'mustResetPassword';
    `);

    if (columnExists.length > 0) {
      await queryRunner.query(`
        ALTER TABLE "users" 
        DROP COLUMN "mustResetPassword";
      `);
    }
  }
}

