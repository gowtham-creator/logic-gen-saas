import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { RoleTemplate } from './RoleTemplate';
import { Permission } from './Permission';

@Entity('role_template_permissions')
@Index(['templateId', 'permissionId'], { unique: true })
export class RoleTemplatePermission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  templateId!: string;

  @ManyToOne(() => RoleTemplate, (template) => template.templatePermissions)
  @JoinColumn({ name: 'templateId' })
  template!: RoleTemplate;

  @Column('uuid')
  permissionId!: string;

  @ManyToOne(() => Permission)
  @JoinColumn({ name: 'permissionId' })
  permission!: Permission;

  @CreateDateColumn()
  createdAt!: Date;
}

