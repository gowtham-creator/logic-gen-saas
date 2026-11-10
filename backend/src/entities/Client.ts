import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Plan } from './Plan';
import { StorageConfig } from './StorageConfig';

@Entity('clients')
@Index(['subdomain'], { unique: true })
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', unique: true })
  subdomain!: string;

  @Column({ type: 'jsonb', nullable: true })
  ssoConfig?: {
    provider: 'oidc' | 'saml';
    metadata?: Record<string, unknown>;
    enabled: boolean;
  };

  @Column('uuid', { nullable: true })
  planId?: string;

  @ManyToOne(() => Plan, { nullable: true })
  @JoinColumn({ name: 'planId' })
  plan?: Plan;

  @Column({ type: 'timestamp', nullable: true })
  planExpiresAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  databaseConfig?: {
    isolationLevel: 'shared' | 'database';
    allowCustomTables: boolean;
    allowCustomColumns: boolean;
    allowCustomMigrations: boolean;
    maxCustomTables?: number;
    maxCustomColumns?: number;
    databaseUrl?: string;
  };

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'boolean', default: false })
  allowSuperAdminLogin!: boolean;

  @Column({ type: 'boolean', default: false })
  enforceMFA!: boolean; // If true, all users must enable MFA

  @Column({ type: 'boolean', default: false })
  mfaRequired!: boolean; // If true, MFA is required for login

  @Column('uuid', { nullable: true })
  storageConfigId?: string; // Reference to client-specific storage config (overrides default)

  @OneToOne(() => StorageConfig, { nullable: true })
  @JoinColumn({ name: 'storageConfigId' })
  storageConfig?: StorageConfig;

  @Column('uuid', { nullable: true })
  defaultRoleId?: string; // Default role assigned to new SSO users

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt?: Date;
}

