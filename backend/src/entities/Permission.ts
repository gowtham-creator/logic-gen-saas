import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { RolePermission } from './RolePermission';

@Entity('permissions')
@Index(['resource', 'action', 'elementId'], { unique: true })
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  resource!: string; // e.g., 'project', 'user', 'api-key'

  @Column({ type: 'varchar' })
  action!: string; // e.g., 'read', 'write', 'delete'

  @Column({ type: 'varchar', nullable: true })
  elementId?: string; // UI element ID or endpoint path

  @Column({ type: 'varchar', nullable: true })
  scope?: string; // Resource scope, e.g., '123' for project:read:123

  @Column({ type: 'varchar', nullable: true })
  description?: string;

  @OneToMany(() => RolePermission, (rp) => rp.permission)
  rolePermissions!: RolePermission[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

