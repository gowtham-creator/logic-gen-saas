import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Client } from './Client';
import { WebhookEvent } from './WebhookEvent';

/**
 * Webhook event types that can be subscribed to
 */
export type WebhookEventType =
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'user.activated'
  | 'user.deactivated'
  | 'role.created'
  | 'role.updated'
  | 'role.deleted'
  | 'role.permissions.updated'
  | 'apiKey.created'
  | 'apiKey.updated'
  | 'apiKey.revoked'
  | 'apiKey.deleted'
  | 'permission.created'
  | 'permission.updated'
  | 'auditLog.created';

@Entity('webhooks')
@Index(['clientId', 'url'], { unique: true })
export class Webhook {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'text' })
  url!: string; // Webhook endpoint URL

  @Column('uuid')
  clientId!: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'clientId' })
  client!: Client;

  @Column({ type: 'text', array: true })
  events!: WebhookEventType[]; // Subscribed events

  @Column({ type: 'varchar', nullable: true })
  secret?: string; // Secret for HMAC signature verification

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'integer', default: 3 })
  maxRetries!: number; // Maximum retry attempts

  @Column({ type: 'integer', default: 5000 })
  timeoutMs!: number; // Request timeout in milliseconds

  @Column({ type: 'boolean', default: false })
  acknowledgementRequired!: boolean; // Whether receiver must send acknowledgement

  @Column({ type: 'integer', default: 30000 })
  acknowledgementTimeoutMs!: number; // Time to wait for acknowledgement (milliseconds)

  @Column({ type: 'jsonb', nullable: true })
  headers?: Record<string, string>; // Custom headers to include

  @OneToMany(() => WebhookEvent, (event) => event.webhook)
  webhookEvents!: WebhookEvent[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt?: Date;
}

