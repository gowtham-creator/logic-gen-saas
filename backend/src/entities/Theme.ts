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

@Entity('themes')
@Index(['clientId'], { unique: true, where: '"clientId" IS NOT NULL' })
export class Theme {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { nullable: true })
  clientId!: string | null;

  @ManyToOne(() => Client, { nullable: true })
  @JoinColumn({ name: 'clientId' })
  client!: Client | null;

  @Column({ type: 'jsonb', default: {} })
  colors!: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
    [key: string]: string | undefined;
  };

  @Column({ type: 'jsonb', default: {} })
  cssVariables!: Record<string, string>;

  @Column({ type: 'varchar', nullable: true })
  faviconUrl?: string;

  @Column({ type: 'varchar', nullable: true })
  logoUrl?: string;

  @Column({ type: 'varchar', default: 'default' })
  themeName!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

