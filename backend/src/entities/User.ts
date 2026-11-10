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
import { Role } from './Role';

@Entity('users')
@Index(['email', 'clientId'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  email!: string;

  @Column({ type: 'varchar', select: false })
  passwordHash!: string;

  @Column({ type: 'varchar' })
  firstName!: string;

  @Column({ type: 'varchar' })
  lastName!: string;

  @Column({ type: 'varchar', nullable: true })
  refreshToken?: string;

  @Column({ type: 'timestamp', nullable: true })
  refreshTokenExpiresAt?: Date;

  @Column('uuid')
  clientId!: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'clientId' })
  client!: Client;

  @Column('uuid', { nullable: true })
  roleId?: string;

  @ManyToOne(() => Role, { nullable: true })
  @JoinColumn({ name: 'roleId' })
  role?: Role;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'boolean', default: false })
  mustResetPassword!: boolean;

  @Column({ type: 'boolean', default: false })
  isDeveloper!: boolean;

  @Column({ type: 'boolean', default: false })
  isSuperAdmin!: boolean;

  @Column({ type: 'varchar', default: 'direct' })
  source!: string; // 'direct', 'sso', 'ldap', etc.

  @Column({ type: 'varchar', nullable: true })
  externalId?: string; // Unique ID from external system (SSO provider, LDAP, etc.)

  @Column({ type: 'boolean', default: false })
  mfaEnabled!: boolean; // Whether MFA is enabled for this user

  @Column({ type: 'text', nullable: true, select: false })
  totpSecret?: string; // Encrypted TOTP secret

  @Column({ type: 'text', nullable: true, select: false })
  mfaBackupCodes?: string; // Encrypted backup codes (JSON array)

  @Column({ type: 'boolean', default: false })
  mfaVerified!: boolean; // Whether MFA setup is verified

  @Column({ type: 'integer', default: 0 })
  failedLoginAttempts!: number; // Track failed login attempts

  @Column({ type: 'timestamp', nullable: true })
  accountLockedUntil?: Date; // Account lockout expiration time

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt?: Date; // Last successful login timestamp

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt?: Date;
}

