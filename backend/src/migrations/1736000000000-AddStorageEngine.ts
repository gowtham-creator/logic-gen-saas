import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStorageEngine1736000000000 implements MigrationInterface {
  name = 'AddStorageEngine1736000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if this is a tenant database (skip system tables)
    const isTenantDatabase = await this.isTenantDatabase(queryRunner);
    
    if (!isTenantDatabase) {
      // Storage Engines table (system table)
      await queryRunner.query(`
        CREATE TABLE "storage_engines" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "type" varchar UNIQUE NOT NULL,
          "name" varchar NOT NULL,
          "description" text,
          "isActive" boolean NOT NULL DEFAULT true,
          "defaultConfig" jsonb,
          "createdAt" timestamp NOT NULL DEFAULT now(),
          "updatedAt" timestamp NOT NULL DEFAULT now()
        );
        CREATE UNIQUE INDEX "IDX_storage_engines_type" ON "storage_engines" ("type");
      `);

      // Storage Configs table (system table)
      await queryRunner.query(`
        CREATE TABLE "storage_configs" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "clientId" uuid,
          "storageEngineId" uuid NOT NULL,
          "config" jsonb NOT NULL,
          "basePath" varchar,
          "isActive" boolean NOT NULL DEFAULT true,
          "createdAt" timestamp NOT NULL DEFAULT now(),
          "updatedAt" timestamp NOT NULL DEFAULT now(),
          FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE,
          FOREIGN KEY ("storageEngineId") REFERENCES "storage_engines"("id") ON DELETE RESTRICT
        );
        CREATE UNIQUE INDEX "IDX_storage_configs_client" ON "storage_configs" ("clientId");
      `);

      // Add storageConfigId to clients table
      await queryRunner.query(`
        ALTER TABLE "clients" 
        ADD COLUMN "storageConfigId" uuid,
        ADD FOREIGN KEY ("storageConfigId") REFERENCES "storage_configs"("id") ON DELETE SET NULL;
      `);

      // Insert default storage engines
      await queryRunner.query(`
        INSERT INTO "storage_engines" ("type", "name", "description", "isActive", "defaultConfig") VALUES
        ('s3', 'Amazon S3', 'Amazon Simple Storage Service', true, '{"accessKeyId": "", "secretAccessKey": "", "region": "us-east-1", "bucket": "", "endpoint": null}'),
        ('azure', 'Azure Blob Storage', 'Microsoft Azure Blob Storage', true, '{"accountName": "", "accountKey": "", "containerName": "", "connectionString": null}'),
        ('local', 'Local File System', 'Local file system storage (for development)', true, '{"basePath": "./storage"}');
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const isTenantDatabase = await this.isTenantDatabase(queryRunner);
    
    if (!isTenantDatabase) {
      // Remove storageConfigId from clients
      await queryRunner.query(`
        ALTER TABLE "clients" DROP COLUMN IF EXISTS "storageConfigId";
      `);

      // Drop storage_configs table
      await queryRunner.query(`DROP TABLE IF EXISTS "storage_configs";`);

      // Drop storage_engines table
      await queryRunner.query(`DROP TABLE IF EXISTS "storage_engines";`);
    }
  }

  private async isTenantDatabase(queryRunner: QueryRunner): Promise<boolean> {
    try {
      const result = await queryRunner.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'clients'
        );
      `);
      return !result[0]?.exists;
    } catch {
      return false;
    }
  }
}

