/**
 * Audit Log-related types
 */

export interface CreateAuditLogDto {
  clientId?: string;
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

