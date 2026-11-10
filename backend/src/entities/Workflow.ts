import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Client } from './Client';
import { User } from './User';
import { WorkflowFile } from './WorkflowFile';

@Entity('workflows')
@Index(['clientId', 'name'])
@Index(['clientId', 'isActive'])
export class Workflow {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

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

  @OneToMany(() => WorkflowFile, (file) => file.workflow, { cascade: true })
  files?: WorkflowFile[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt?: Date;
}

