import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Webhook } from './Webhook';
import { WebhookEventType } from './Webhook';

export type WebhookDeliveryStatus = 'pending' | 'success' | 'failed' | 'retrying' | 'awaiting_ack' | 'ack_timeout';

@Entity('webhook_events')
@Index(['webhookId', 'createdAt'])
@Index(['status', 'createdAt'])
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  webhookId!: string;

  @ManyToOne(() => Webhook, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'webhookId' })
  webhook!: Webhook;

  @Column({ type: 'varchar' })
  eventType!: WebhookEventType;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>; // Event payload

  @Column({ type: 'varchar', default: 'pending' })
  status!: WebhookDeliveryStatus;

  @Column({ type: 'integer', default: 0 })
  attemptCount!: number; // Number of delivery attempts

  @Column({ type: 'integer', nullable: true })
  httpStatus?: number; // HTTP status code from last attempt

  @Column({ type: 'text', nullable: true })
  responseBody?: string; // Response body from last attempt

  @Column({ type: 'text', nullable: true })
  errorMessage?: string; // Error message if delivery failed

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt?: Date; // When successfully delivered

  @Column({ type: 'timestamp', nullable: true })
  nextRetryAt?: Date; // When to retry (for failed deliveries)

  @Column({ type: 'timestamp', nullable: true })
  acknowledgedAt?: Date; // When acknowledgement was received

  @Column({ type: 'varchar', nullable: true })
  acknowledgementStatus?: string; // Status from acknowledgement response

  @Column({ type: 'timestamp', nullable: true })
  acknowledgementTimeoutAt?: Date; // When acknowledgement timeout expires

  @CreateDateColumn()
  createdAt!: Date;
}

