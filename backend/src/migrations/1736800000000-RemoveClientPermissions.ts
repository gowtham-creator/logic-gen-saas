import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveClientPermissions1736800000000 implements MigrationInterface {
  name = 'RemoveClientPermissions1736800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove role_permissions that reference CLIENT permissions (not CLIENT_SETTINGS)
    await queryRunner.query(`
      DELETE FROM "role_permissions"
      WHERE "permissionId" IN (
        SELECT id FROM "permissions"
        WHERE resource = 'client'
      );
    `);

    // Remove CLIENT permissions (not CLIENT_SETTINGS)
    await queryRunner.query(`
      DELETE FROM "permissions"
      WHERE resource = 'client';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add CLIENT permissions (if needed for rollback)
    // Note: This will only restore the permissions, not the role_permissions
    // Role permissions would need to be re-seeded
    
    await queryRunner.query(`
      INSERT INTO "permissions" (id, resource, action, description, "elementId", "createdAt", "updatedAt")
      VALUES
        (
          gen_random_uuid(),
          'client',
          'create',
          'Create clients',
          'btn-create-client',
          NOW(),
          NOW()
        ),
        (
          gen_random_uuid(),
          'client',
          'read',
          'Read clients',
          'table-clients',
          NOW(),
          NOW()
        ),
        (
          gen_random_uuid(),
          'client',
          'update',
          'Update clients',
          'btn-edit-client',
          NOW(),
          NOW()
        ),
        (
          gen_random_uuid(),
          'client',
          'delete',
          'Delete clients',
          'btn-delete-client',
          NOW(),
          NOW()
        )
      ON CONFLICT DO NOTHING;
    `);
  }
}

