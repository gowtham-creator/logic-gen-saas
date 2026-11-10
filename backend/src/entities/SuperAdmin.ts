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
import { SuperAdminRole } from './SuperAdminRole';

@Entity('super_admins')
@Index(['email'], { unique: true })
export class SuperAdmin {
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

  @Column('uuid', { nullable: true })
  roleId?: string;

  @ManyToOne(() => SuperAdminRole, { nullable: true })
  @JoinColumn({ name: 'roleId' })
  role?: SuperAdminRole;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'boolean', default: false })
  mustResetPassword!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt?: Date;
}

