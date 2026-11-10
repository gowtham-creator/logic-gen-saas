import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Entity to track custom tables created by tenants
 * Stored in shared database (not tenant-specific)
 */
@Entity('custom_tables')
@Index(['clientId', 'tableName'], { unique: true })
export class CustomTable {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  clientId!: string;

  @Column({ type: 'varchar', length: 255 })
  tableName!: string;

  @Column({ type: 'jsonb' })
  columns!: Array<{
    name: string;
    type: string; // PostgreSQL type: varchar, integer, uuid, timestamp, etc.
    nullable: boolean;
    defaultValue?: any;
    length?: number; // For varchar, char types
    precision?: number; // For decimal, numeric
    scale?: number; // For decimal, numeric
    unique?: boolean;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  indexes?: Array<{
    name: string;
    columns: string[];
    unique?: boolean;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  foreignKeys?: Array<{
    name: string;
    columns: string[];
    referencedTable: string;
    referencedColumns: string[];
    onDelete?: 'CASCADE' | 'RESTRICT' | 'SET NULL' | 'NO ACTION';
    onUpdate?: 'CASCADE' | 'RESTRICT' | 'SET NULL' | 'NO ACTION';
  }>;

  @Column({ type: 'varchar', nullable: true })
  schemaName?: string; // For schema-per-tenant plans

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt?: Date;
}

