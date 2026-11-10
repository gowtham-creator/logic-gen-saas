import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkflows1736100000000 implements MigrationInterface {
  name = 'AddWorkflows1736100000000';

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
    
    // Workflows table
    const workflowsClientIdColumn = isTenantDatabase 
      ? '"clientId" uuid,'
      : '"clientId" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,';
    
    await queryRunner.query(`
      CREATE TABLE "workflows" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "description" text,
        ${workflowsClientIdColumn}
        "createdUserId" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "updatedUserId" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX "IDX_workflows_clientId_name" ON "workflows" ("clientId", "name");
      CREATE INDEX "IDX_workflows_clientId_isActive" ON "workflows" ("clientId", "isActive");
    `);

    // Workflow files table
    const filesClientIdColumn = isTenantDatabase 
      ? '"clientId" uuid,'
      : '"clientId" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,';
    
    await queryRunner.query(`
      CREATE TABLE "workflow_files" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workflowId" uuid NOT NULL REFERENCES "workflows"("id") ON DELETE CASCADE,
        "fileName" varchar NOT NULL,
        "originalFileName" varchar NOT NULL,
        "filePath" varchar NOT NULL,
        "mimeType" varchar NOT NULL,
        "fileSize" bigint NOT NULL,
        ${filesClientIdColumn}
        "createdUserId" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "updatedUserId" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX "IDX_workflow_files_workflowId" ON "workflow_files" ("workflowId");
      CREATE INDEX "IDX_workflow_files_clientId" ON "workflow_files" ("clientId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "workflow_files";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workflows";`);
  }
}

