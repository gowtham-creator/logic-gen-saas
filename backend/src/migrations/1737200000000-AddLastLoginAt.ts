import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddLastLoginAt1737200000000 implements MigrationInterface {
  name = 'AddLastLoginAt1737200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add lastLoginAt column to users table
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'lastLoginAt',
        type: 'timestamp',
        isNullable: true,
      })
    );

    // Create index for faster queries on lastLoginAt (useful for access reviews)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_lastLoginAt" 
      ON "users" ("lastLoginAt");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_users_lastLoginAt";
    `);

    // Drop column
    await queryRunner.dropColumn('users', 'lastLoginAt');
  }
}

