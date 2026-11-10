import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { SuperAdmin } from './SuperAdmin';
import { SuperAdminRolePermission } from './SuperAdminRolePermission';

@Entity('super_admin_roles')
@Index(['name'], { unique: true })
export class SuperAdminRole {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  description?: string;

  @OneToMany(() => SuperAdmin, (admin) => admin.role)
  admins!: SuperAdmin[];

  @OneToMany(() => SuperAdminRolePermission, (rp) => rp.role)
  rolePermissions!: SuperAdminRolePermission[];

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

