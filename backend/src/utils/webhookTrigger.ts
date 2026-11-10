import { WebhookService } from '../services/WebhookService';
import { TenantRequest } from '../types/middleware.types';

let webhookServiceInstance: WebhookService | null = null;

/**
 * Get or create webhook service instance
 * Lazy initialization to avoid circular dependencies
 */
function getWebhookService(): WebhookService {
  if (!webhookServiceInstance) {
    webhookServiceInstance = new WebhookService();
  }
  return webhookServiceInstance;
}

/**
 * Trigger webhooks for an event
 * This is a convenience function that can be called from anywhere
 */
export async function triggerWebhook(
  clientId: string,
  eventType: string,
  payload: Record<string, unknown>,
  metadata?: Record<string, unknown>,
  req?: TenantRequest
): Promise<void> {
  try {
    const webhookService = getWebhookService();
    await webhookService.triggerWebhook(clientId, eventType, payload, metadata, req);
  } catch (error) {
    // Don't throw - webhook failures shouldn't break the main operation
    // Webhook failures are logged by WebhookService
  }
}

