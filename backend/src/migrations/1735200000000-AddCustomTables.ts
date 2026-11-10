import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomTables1735200000000 implements MigrationInterface {
  name = 'AddCustomTables1735200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create custom_tables table to track custom tables created by tenants
    await queryRunner.query(`
      CREATE TABLE "custom_tables" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "clientId" uuid NOT NULL,
        "tableName" varchar(255) NOT NULL,
        "columns" jsonb NOT NULL,
        "indexes" jsonb,
        "foreignKeys" jsonb,
        "schemaName" varchar,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      );
    `);

    // Create unique index on clientId + tableName
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_custom_tables_client_table" 
      ON "custom_tables" ("clientId", "tableName");
    `);

    // Create index on clientId for faster lookups
    await queryRunner.query(`
      CREATE INDEX "IDX_custom_tables_clientId" 
      ON "custom_tables" ("clientId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_custom_tables_clientId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_custom_tables_client_table"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "custom_tables"`);
  }
}

