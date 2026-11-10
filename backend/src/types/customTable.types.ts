/**
 * Custom table types
 */

export interface CreateCustomTableDto {
  tableName: string;
  columns: Array<{
    name: string;
    type: string;
    nullable?: boolean;
    defaultValue?: any;
    length?: number;
    precision?: number;
    scale?: number;
    unique?: boolean;
  }>;
  indexes?: Array<{
    name: string;
    columns: string[];
    unique?: boolean;
  }>;
  foreignKeys?: Array<{
    name: string;
    columns: string[];
    referencedTable: string;
    referencedColumns: string[];
    onDelete?: 'CASCADE' | 'RESTRICT' | 'SET NULL' | 'NO ACTION';
    onUpdate?: 'CASCADE' | 'RESTRICT' | 'SET NULL' | 'NO ACTION';
  }>;
}

export interface AddColumnDto {
  name: string;
  type: string;
  nullable?: boolean;
  defaultValue?: any;
  length?: number;
  precision?: number;
  scale?: number;
  unique?: boolean;
}

export interface CreateIndexDto {
  name: string;
  columns: string[];
  unique?: boolean;
}

