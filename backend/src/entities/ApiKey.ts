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

@Entity('api_keys')
@Index(['keyHash'], { unique: true })
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', select: false })
  keyHash!: string; // Hashed API key

  @Column('uuid')
  clientId!: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'clientId' })
  client!: Client;

  @Column({ type: 'text', array: true, default: [] })
  scopes!: string[]; // e.g., ['users:read', 'projects:write']

  @Column({ type: 'text', array: true, default: [] })
  allowedEndpoints!: string[]; // e.g., ['/api/users', '/api/projects']

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt?: Date;

  @Column({ type: 'boolean', default: false })
  isRevoked!: boolean;

  @Column({ type: 'integer', default: 0 })
  rateLimitPerMinute!: number; // 0 = no limit

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt?: Date;
}

