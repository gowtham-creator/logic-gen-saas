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
import { RolePermission } from './RolePermission';
import { RoleTemplate } from './RoleTemplate';

@Entity('roles')
@Index(['name', 'clientId'], { unique: true })
export class Role {
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

  @Column('uuid', { nullable: true })
  parentRoleId?: string;

  @ManyToOne(() => Role, { nullable: true })
  @JoinColumn({ name: 'parentRoleId' })
  parentRole?: Role;

  @Column('uuid', { nullable: true })
  templateId?: string;

  @ManyToOne(() => RoleTemplate, { nullable: true })
  @JoinColumn({ name: 'templateId' })
  template?: RoleTemplate;

  @OneToMany(() => RolePermission, (rp) => rp.role)
  rolePermissions!: RolePermission[];

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt?: Date;
}

