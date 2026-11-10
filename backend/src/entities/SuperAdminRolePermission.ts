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
import { Permission } from './Permission';

@Entity('super_admin_role_permissions')
@Index(['roleId', 'permissionId'], { unique: true })
export class SuperAdminRolePermission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  roleId!: string;

  @ManyToOne(() => SuperAdminRole, (role) => role.rolePermissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roleId' })
  role!: SuperAdminRole;

  @Column('uuid')
  permissionId!: string;

  @ManyToOne(() => Permission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permissionId' })
  permission!: Permission;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

