import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from './User';

@Entity('user_devices')
@Index(['userId', 'clientDeviceId'], { unique: true, where: '"clientDeviceId" IS NOT NULL AND "isActive" = true' })
@Index(['userId', 'deviceId'])
@Index(['userId'])
@Index(['deviceId'])
@Index(['isActive'], { where: '"isActive" = true' })
export class UserDevice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'varchar' })
  deviceId!: string; // Fingerprint hash

  @Column({ type: 'varchar', nullable: true })
  clientDeviceId?: string; // Persistent client-side device ID

  @Column({ type: 'varchar' })
  deviceName!: string;

  @Column({ type: 'varchar' })
  deviceType!: string; // 'mobile', 'tablet', 'desktop'

  @Column({ type: 'varchar' })
  browser!: string;

  @Column({ type: 'varchar' })
  os!: string;

  @Column({ type: 'varchar', nullable: true })
  ipAddress?: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastSeenAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;
}

