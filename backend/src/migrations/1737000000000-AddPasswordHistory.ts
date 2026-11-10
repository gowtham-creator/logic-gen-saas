import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class AddPasswordHistory1737000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create password_history table
    await queryRunner.createTable(
      new Table({
        name: 'password_history',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'passwordHash',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    // Create foreign key to users table
    await queryRunner.createForeignKey(
      'password_history',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      })
    );

    // Create index on userId and createdAt for efficient queries
    await queryRunner.createIndex(
      'password_history',
      new TableIndex({
        name: 'IDX_password_history_userId_createdAt',
        columnNames: ['userId', 'createdAt'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('password_history');
  }
}

