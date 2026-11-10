import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlans1734400000000 implements MigrationInterface {
  name = 'AddPlans1734400000000';

  private async isTenantDatabase(queryRunner: QueryRunner): Promise<boolean> {
    try {
      const result = await queryRunner.query(`SELECT current_database() as dbname`);
      const dbName = result[0]?.dbname || '';
      return dbName.startsWith('tenant_') || dbName.startsWith('tenant-');
    } catch {
      return false;
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isTenantDatabase = await this.isTenantDatabase(queryRunner);
    
    // Plans table (system table - skip for tenant databases)
    if (!isTenantDatabase) {
      await queryRunner.query(`
        CREATE TABLE "plans" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "name" varchar UNIQUE NOT NULL,
          "description" varchar,
          "price" decimal(10,2),
          "billingPeriod" varchar,
          "allowedPermissions" jsonb NOT NULL DEFAULT '{}',
          "limits" jsonb NOT NULL DEFAULT '{}',
          "isActive" boolean NOT NULL DEFAULT true,
          "createdAt" timestamp NOT NULL DEFAULT now(),
          "updatedAt" timestamp NOT NULL DEFAULT now()
        );
        CREATE UNIQUE INDEX "IDX_plans_name" ON "plans" ("name");
      `);

      // Add plan columns to clients table (only if clients table exists)
      const clientsTableExists = await queryRunner.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'clients'
        )
      `);
      
      if (clientsTableExists[0]?.exists) {
        await queryRunner.query(`
          ALTER TABLE "clients" 
          ADD COLUMN IF NOT EXISTS "planId" uuid REFERENCES "plans"("id") ON DELETE SET NULL,
          ADD COLUMN IF NOT EXISTS "planExpiresAt" timestamp;
        `);
      }
    }

    // Make audit_logs.clientId nullable for system operations
    await queryRunner.query(`
      ALTER TABLE "audit_logs" 
      ALTER COLUMN "clientId" DROP NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const isTenantDatabase = await this.isTenantDatabase(queryRunner);
    
    await queryRunner.query(`ALTER TABLE "audit_logs" ALTER COLUMN "clientId" SET NOT NULL`);
    
    if (!isTenantDatabase) {
      await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN IF EXISTS "planExpiresAt"`);
      await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN IF EXISTS "planId"`);
      await queryRunner.query(`DROP TABLE IF EXISTS "plans"`);
    }
  }
}

