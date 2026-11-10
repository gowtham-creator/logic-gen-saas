import { WebhookEventType } from '../entities/Webhook';

export interface CreateWebhookDto {
  name: string;
  url: string;
  events: WebhookEventType[];
  secret?: string;
  isActive?: boolean;
  maxRetries?: number;
  timeoutMs?: number;
  acknowledgementRequired?: boolean;
  acknowledgementTimeoutMs?: number;
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
  acknowledgementRequired?: boolean;
  acknowledgementTimeoutMs?: number;
  headers?: Record<string, string>;
}

export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  data: Record<string, unknown>;
  metadata?: {
    userId?: string;
    clientId?: string;
    ipAddress?: string;
    userAgent?: string;
  };
}

export interface WebhookDeliveryResult {
  success: boolean;
  httpStatus?: number;
  responseBody?: string;
  errorMessage?: string;
  acknowledged?: boolean; // Whether acknowledgement was received
  acknowledgementStatus?: string; // Status from acknowledgement
}

