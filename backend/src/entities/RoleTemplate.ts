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
import { RoleTemplatePermission } from './RoleTemplatePermission';
import { Role } from './Role';

@Entity('role_templates')
@Index(['name', 'clientId'], { unique: true })
export class RoleTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  description?: string;

  @Column('uuid')
  clientId!: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'clientId' })
  client!: Client;

  @OneToMany(() => RoleTemplatePermission, (rtp) => rtp.template)
  templatePermissions!: RoleTemplatePermission[];

  @OneToMany(() => Role, (role) => role.template)
  roles!: Role[];

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt?: Date;
}

