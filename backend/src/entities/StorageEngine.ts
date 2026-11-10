import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type StorageEngineType = 's3' | 'azure' | 'local' | 'gcs';

@Entity('storage_engines')
@Index(['type'], { unique: true })
export class StorageEngine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  type!: StorageEngineType; // 's3', 'azure', 'local', 'gcs'

  @Column({ type: 'varchar' })
  name!: string; // Display name: 'Amazon S3', 'Azure Blob Storage', etc.

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  defaultConfig?: Record<string, unknown>; // Default configuration template

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

