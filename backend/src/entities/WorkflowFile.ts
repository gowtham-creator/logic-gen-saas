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
import { User } from './User';
import { Workflow } from './Workflow';

@Entity('workflow_files')
@Index(['workflowId'])
@Index(['clientId'])
export class WorkflowFile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  workflowId!: string;

  @ManyToOne(() => Workflow, (workflow) => workflow.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflowId' })
  workflow!: Workflow;

  @Column({ type: 'varchar' })
  fileName!: string;

  @Column({ type: 'varchar' })
  originalFileName!: string;

  @Column({ type: 'varchar' })
  filePath!: string; // Path in storage (e.g., workflows/{workflowId}/{fileName})

  @Column({ type: 'varchar' })
  mimeType!: string;

  @Column({ type: 'bigint' })
  fileSize!: number; // Size in bytes

  @Column('uuid')
  clientId!: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'clientId' })
  client!: Client;

  @Column('uuid', { nullable: true })
  createdUserId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdUserId' })
  createdUser?: User;

  @Column('uuid', { nullable: true })
  updatedUserId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updatedUserId' })
  updatedUser?: User;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

