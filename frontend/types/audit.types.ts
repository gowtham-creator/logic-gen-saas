/**
 * Audit Log-related types
 */

export interface AuditLog {
  id: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  client?: {
    id: string;
    name: string;
  };
}

export interface AuditLogsResponse {
  logs: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

