export type WebhookEventType =
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'user.activated'
  | 'user.deactivated'
  | 'role.created'
  | 'role.updated'
  | 'role.deleted'
  | 'role.permissions.updated'
  | 'apiKey.created'
  | 'apiKey.updated'
  | 'apiKey.revoked'
  | 'apiKey.deleted'
  | 'permission.created'
  | 'permission.updated'
  | 'auditLog.created';

export interface Webhook {
  id: string;
  name: string;
  url: string;
  clientId: string;
  events: WebhookEventType[];
  secret?: string;
  isActive: boolean;
  maxRetries: number;
  timeoutMs: number;
  headers?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookEvent {
  id: string;
  webhookId: string;
  eventType: WebhookEventType;
  payload: Record<string, unknown>;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  attemptCount: number;
  httpStatus?: number;
  responseBody?: string;
  errorMessage?: string;
  deliveredAt?: string;
  nextRetryAt?: string;
  createdAt: string;
}

export interface CreateWebhookDto {
  name: string;
  url: string;
  events: WebhookEventType[];
  secret?: string;
  isActive?: boolean;
  maxRetries?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export interface UpdateWebhookDto {
  name?: string;
  url?: string;
  events?: WebhookEventType[];
  secret?: string;
  isActive?: boolean;
  maxRetries?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

