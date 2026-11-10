import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Client } from './Client';

@Entity('plans')
@Index(['name'], { unique: true })
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  name!: string; // e.g., 'basic', 'professional', 'enterprise'

  @Column({ type: 'varchar', nullable: true })
  description?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price?: number;

  @Column({ type: 'varchar', nullable: true })
  billingPeriod?: string; // 'monthly', 'yearly'

  @Column({ type: 'jsonb', default: {} })
  allowedPermissions!: Record<string, string[]>; // { resource: [actions] }

  @Column({ type: 'jsonb', default: {} })
  limits!: Record<string, number>; // e.g., { users: 10, apiKeys: 5 }

  @Column({ type: 'jsonb', default: {} })
  databasePermissions!: {
    allowedIsolationLevels: ('shared' | 'database')[];
    allowCustomTables: boolean;
    allowCustomColumns: boolean;
    allowCustomMigrations: boolean;
    maxCustomTables?: number;
    maxCustomColumns?: number;
  };

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => Client, (client) => client.plan)
  clients!: Client[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt?: Date;
}

