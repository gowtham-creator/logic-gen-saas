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

@Entity('client_settings')
@Index(['clientId'], { unique: true })
export class ClientSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  clientId!: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'clientId' })
  client!: Client;

  @Column({ type: 'jsonb', default: {} })
  featureToggles!: Record<string, boolean>;

  @Column({ type: 'jsonb', default: {} })
  settings!: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

