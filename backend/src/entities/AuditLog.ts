import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Client } from './Client';
import { User } from './User';

@Entity('audit_logs')
@Index(['clientId', 'createdAt'], { where: '"clientId" IS NOT NULL' })
@Index(['userId'])
@Index(['action'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { nullable: true })
  clientId?: string;

  @ManyToOne(() => Client, { nullable: true })
  @JoinColumn({ name: 'clientId' })
  client?: Client;

  @Column('uuid', { nullable: true })
  userId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'varchar' })
  action!: string; // e.g., 'user.created', 'api_key.revoked'

  @Column({ type: 'varchar', nullable: true })
  resourceType?: string; // e.g., 'User', 'ApiKey'

  @Column('uuid', { nullable: true })
  resourceId?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ type: 'varchar', nullable: true })
  ipAddress?: string;

  @Column({ type: 'varchar', nullable: true })
  userAgent?: string;

  @CreateDateColumn()
  createdAt!: Date;
}

