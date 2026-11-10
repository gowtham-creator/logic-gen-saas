import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Client } from './Client';
import { StorageEngine } from './StorageEngine';

@Entity('storage_configs')
@Index(['clientId'], { unique: true })
@Index(['isDefault'], { where: 'isDefault = true' })
export class StorageConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { nullable: true })
  clientId?: string; // null for default config, clientId for client-specific

  @ManyToOne(() => Client, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client?: Client;

  @Column('uuid')
  storageEngineId!: string;

  @ManyToOne(() => StorageEngine)
  @JoinColumn({ name: 'storageEngineId' })
  storageEngine!: StorageEngine;

  @Column({ type: 'jsonb' })
  config!: Record<string, unknown>; // Engine-specific configuration

  @Column({ type: 'varchar', nullable: true })
  basePath?: string; // Base path/folder for this client (e.g., 'clients/{clientId}/')

  @Column({ type: 'boolean', default: false })
  isDefault!: boolean; // true for global default storage config

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

