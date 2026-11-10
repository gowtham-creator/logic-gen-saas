import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAllowSuperAdminLogin1735500000000 implements MigrationInterface {
  name = 'AddAllowSuperAdminLogin1735500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if column already exists
    const columnExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'clients' AND column_name = 'allowSuperAdminLogin';
    `);

    if (columnExists.length === 0) {
      // Add allowSuperAdminLogin column to clients table
      await queryRunner.query(`
        ALTER TABLE "clients" 
        ADD COLUMN "allowSuperAdminLogin" boolean NOT NULL DEFAULT false;
      `);
    }

    // Check if index exists before creating
    const indexExists = await queryRunner.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'clients' AND indexname = 'IDX_clients_allowSuperAdminLogin';
    `);

    if (indexExists.length === 0) {
      // Create index for faster lookups
      await queryRunner.query(`
        CREATE INDEX "IDX_clients_allowSuperAdminLogin" 
        ON "clients" ("allowSuperAdminLogin") 
        WHERE "allowSuperAdminLogin" = true;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_clients_allowSuperAdminLogin"`);
    await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN IF EXISTS "allowSuperAdminLogin"`);
  }
}

