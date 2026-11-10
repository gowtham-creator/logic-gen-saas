import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAccountLockout1736900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add failedLoginAttempts column
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'failedLoginAttempts',
        type: 'integer',
        default: 0,
      })
    );

    // Add accountLockedUntil column
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'accountLockedUntil',
        type: 'timestamp',
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'accountLockedUntil');
    await queryRunner.dropColumn('users', 'failedLoginAttempts');
  }
}

