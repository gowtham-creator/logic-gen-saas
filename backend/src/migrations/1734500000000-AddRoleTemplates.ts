import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoleTemplates1734500000000 implements MigrationInterface {
  name = 'AddRoleTemplates1734500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if role_templates table exists
    const roleTemplatesExists = await queryRunner.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'role_templates';
    `);

    if (roleTemplatesExists.length === 0) {
      // Role templates table
      await queryRunner.query(`
        CREATE TABLE "role_templates" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "name" varchar NOT NULL,
          "description" varchar,
          "clientId" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
          "isActive" boolean NOT NULL DEFAULT true,
          "createdAt" timestamp NOT NULL DEFAULT now(),
          "updatedAt" timestamp NOT NULL DEFAULT now()
        );
        CREATE UNIQUE INDEX "IDX_role_templates_name_client" ON "role_templates" ("name", "clientId");
      `);
    }

    // Check if role_template_permissions table exists
    const roleTemplatePermissionsExists = await queryRunner.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'role_template_permissions';
    `);

    if (roleTemplatePermissionsExists.length === 0) {
      // Role template permissions junction table
      await queryRunner.query(`
        CREATE TABLE "role_template_permissions" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "templateId" uuid NOT NULL REFERENCES "role_templates"("id") ON DELETE CASCADE,
          "permissionId" uuid NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
          "createdAt" timestamp NOT NULL DEFAULT now()
        );
        CREATE UNIQUE INDEX "IDX_role_template_permissions_template_permission" ON "role_template_permissions" ("templateId", "permissionId");
      `);
    }

    // Check if templateId column exists before adding
    const columnExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'roles' AND column_name = 'templateId';
    `);

    if (columnExists.length === 0) {
      // Add templateId to roles table
      await queryRunner.query(`
        ALTER TABLE "roles" 
        ADD COLUMN "templateId" uuid REFERENCES "role_templates"("id") ON DELETE SET NULL;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "roles" DROP COLUMN IF EXISTS "templateId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_template_permissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_templates"`);
  }
}

