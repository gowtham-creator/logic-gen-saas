import { Repository, IsNull } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Webhook } from '../entities/Webhook';
import { WebhookEvent } from '../entities/WebhookEvent';
import { CreateWebhookDto, UpdateWebhookDto, WebhookPayload, WebhookDeliveryResult } from '../types/webhook.types';
import { getWebhookQueueService } from './WebhookQueueService';
import { TenantRequest } from '../types/middleware.types';
import { getTenantRepository } from '../utils/tenantRepository';
import { getIsolationLevel, buildWhereClause } from '../utils/isolationHelper';
import crypto from 'crypto';
import https from 'https';
import http from 'http';
import { WEBHOOK_CONSTANTS } from '../constants/webhook';
import { config } from '../config/config';

export class WebhookService {
  private getWebhookRepository(req?: TenantRequest): Repository<Webhook> {
    return req ? getTenantRepository(req, Webhook) : AppDataSource.getRepository(Webhook);
  }

  private getWebhookEventRepository(req?: TenantRequest): Repository<WebhookEvent> {
    return req ? getTenantRepository(req, WebhookEvent) : AppDataSource.getRepository(WebhookEvent);
  }

  /**
   * Create a new webhook
   */
  async createWebhook(clientId: string, data: CreateWebhookDto, req?: TenantRequest): Promise<Webhook> {
    const repository = this.getWebhookRepository(req);
    const isolationLevel = await getIsolationLevel(req, clientId);

    const webhookData: any = {
      ...data,
      isActive: data.isActive ?? true,
      maxRetries: data.maxRetries ?? config.webhooks.defaultMaxRetries,
      timeoutMs: data.timeoutMs ?? config.webhooks.defaultTimeoutMs,
      acknowledgementRequired: data.acknowledgementRequired ?? false,
      acknowledgementTimeoutMs: data.acknowledgementTimeoutMs ?? config.webhooks.ackTimeoutMs,
    };
    
    if (isolationLevel !== 'database') {
      webhookData.clientId = clientId;
    }

    const webhook = repository.create(webhookData);
    const saved = await repository.save(webhook);
    // TypeORM save can return array or single entity, but we're passing single entity
    return Array.isArray(saved) ? saved[0] : saved;
  }

  /**
   * Update webhook
   */
  async updateWebhook(id: string, clientId: string, data: UpdateWebhookDto, req?: TenantRequest): Promise<Webhook> {
    const webhook = await this.getWebhook(id, clientId, req);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    Object.assign(webhook, data);
    const repository = this.getWebhookRepository(req);
    return repository.save(webhook);
  }

  /**
   * Get webhook by ID
   */
  async getWebhook(id: string, clientId: string, req?: TenantRequest): Promise<Webhook | null> {
    const repository = this.getWebhookRepository(req);
    const isolationLevel = await getIsolationLevel(req, clientId);
    const where = buildWhereClause(isolationLevel, { id, deletedAt: IsNull() }, clientId);
    
    // For database-per-tenant, don't try to load client relation
    const relations = isolationLevel === 'database' ? [] : ['client'];
    
    return repository.findOne({
      where,
      relations,
    });
  }

  /**
   * List all webhooks for a client
   */
  async listWebhooks(clientId: string, req?: TenantRequest): Promise<Webhook[]> {
    const repository = this.getWebhookRepository(req);
    const isolationLevel = await getIsolationLevel(req, clientId);
    const where = buildWhereClause(isolationLevel, { deletedAt: IsNull() }, clientId);
    
    return repository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(id: string, clientId: string, req?: TenantRequest): Promise<void> {
    const repository = this.getWebhookRepository(req);
    const isolationLevel = await getIsolationLevel(req, clientId);
    const where = buildWhereClause(isolationLevel, { id }, clientId);
    // Soft delete (set deletedAt)
    await repository.update(where, { deletedAt: new Date() });
  }

  /**
   * Trigger webhooks for an event
   */
  async triggerWebhook(
    clientId: string,
    eventType: string,
    payload: Record<string, unknown>,
    metadata?: Record<string, unknown>,
    req?: TenantRequest
  ): Promise<void> {
    // Find all active webhooks for this client that subscribe to this event
    const repository = this.getWebhookRepository(req);
    const isolationLevel = await getIsolationLevel(req, clientId);
    const where = buildWhereClause(isolationLevel, { isActive: true, deletedAt: IsNull() }, clientId);
    
    const webhooks = await repository.find({ where });

    const subscribedWebhooks = webhooks.filter((webhook) =>
      webhook.events.includes(eventType as any)
    );

    // Create webhook events and deliver asynchronously
    for (const webhook of subscribedWebhooks) {
      const webhookPayload: WebhookPayload = {
        event: eventType as any,
        timestamp: new Date().toISOString(),
        data: payload,
        metadata,
      };

      // Create webhook event record
      const eventRepository = this.getWebhookEventRepository(req);
      const webhookEvent = eventRepository.create({
        webhookId: webhook.id,
        eventType: eventType as any,
        payload: webhookPayload as unknown as Record<string, unknown>,
        status: 'pending',
        attemptCount: 0,
      });

      // Set acknowledgement timeout if required
      if (webhook.acknowledgementRequired) {
        webhookEvent.acknowledgementTimeoutAt = new Date(
          Date.now() + webhook.acknowledgementTimeoutMs
        );
      }

      await eventRepository.save(webhookEvent);

      // Hybrid approach: Use BullMQ for webhooks requiring acknowledgement, current system for simple webhooks
      if (webhook.acknowledgementRequired) {
        // Use BullMQ queue for webhooks requiring acknowledgement (enterprise-grade retry)
        try {
          const queueService = getWebhookQueueService();
          await queueService.addWebhookJob(webhook, webhookEvent, webhookPayload);
        } catch (error: any) {
          console.error(`Failed to add webhook to queue ${webhook.id}:`, error);
          // Fallback to current system if queue fails
          this.deliverWebhook(webhook, webhookEvent, webhookPayload, req).catch((err) => {
            console.error(`Failed to deliver webhook ${webhook.id}:`, err);
          });
        }
      } else {
        // Use current system for simple webhooks (no acknowledgement required)
        this.deliverWebhook(webhook, webhookEvent, webhookPayload, req).catch((error) => {
          console.error(`Failed to deliver webhook ${webhook.id}:`, error);
        });
      }
    }
  }

  /**
   * Deliver webhook with retry logic
   */
  private async deliverWebhook(
    webhook: Webhook,
    webhookEvent: WebhookEvent,
    payload: WebhookPayload,
    req?: TenantRequest
  ): Promise<void> {
    const eventRepository = this.getWebhookEventRepository(req);
    const maxAttempts = webhook.maxRetries + 1; // Initial attempt + retries
    let attemptCount = webhookEvent.attemptCount;

    while (attemptCount < maxAttempts) {
      attemptCount++;
      
      // Update attempt count
      webhookEvent.attemptCount = attemptCount;
      webhookEvent.status = attemptCount === 1 ? 'pending' : 'retrying';
      await eventRepository.save(webhookEvent);

      try {
        const result = await this.sendWebhookRequest(webhook, webhookEvent, payload);

        if (result.success) {
          // If acknowledgement is required, wait for it
          if (webhook.acknowledgementRequired) {
            webhookEvent.status = 'awaiting_ack';
            webhookEvent.httpStatus = result.httpStatus;
            webhookEvent.responseBody = result.responseBody;
            webhookEvent.deliveredAt = new Date();
            await eventRepository.save(webhookEvent);

            // Wait for acknowledgement with timeout
            const ackReceived = await this.waitForAcknowledgement(
              webhookEvent,
              webhook.acknowledgementTimeoutMs,
              req
            );

            if (ackReceived) {
              // Acknowledgement received
              webhookEvent.status = 'success';
              webhookEvent.acknowledgedAt = new Date();
              webhookEvent.nextRetryAt = undefined;
              await eventRepository.save(webhookEvent);
              return;
            } else {
              // Acknowledgement timeout
              webhookEvent.status = 'ack_timeout';
              webhookEvent.errorMessage = 'Acknowledgement timeout';
              
              // Retry if attempts remaining
              if (attemptCount < maxAttempts) {
                const delayMs = Math.min(1000 * Math.pow(2, attemptCount - 1), 30000);
                webhookEvent.nextRetryAt = new Date(Date.now() + delayMs);
                await eventRepository.save(webhookEvent);
                await new Promise((resolve) => setTimeout(resolve, delayMs));
                continue; // Retry
              } else {
                webhookEvent.nextRetryAt = undefined;
                await eventRepository.save(webhookEvent);
                return;
              }
            }
          } else {
            // No acknowledgement required - success
            webhookEvent.status = 'success';
            webhookEvent.httpStatus = result.httpStatus;
            webhookEvent.responseBody = result.responseBody;
            webhookEvent.deliveredAt = new Date();
            webhookEvent.nextRetryAt = undefined;
            await eventRepository.save(webhookEvent);
            return;
          }
        } else {
          // Failed but might retry
          webhookEvent.httpStatus = result.httpStatus;
          webhookEvent.responseBody = result.responseBody;
          webhookEvent.errorMessage = result.errorMessage;

          // Don't retry on 4xx errors (client errors)
          if (result.httpStatus && result.httpStatus >= 400 && result.httpStatus < 500) {
            webhookEvent.status = 'failed';
            webhookEvent.nextRetryAt = undefined;
            await eventRepository.save(webhookEvent);
            return;
          }

          // Retry on 5xx or network errors
          if (attemptCount < maxAttempts) {
            // Exponential backoff: 1s, 2s, 4s, 8s...
            const delayMs = Math.min(1000 * Math.pow(2, attemptCount - 1), 30000);
            webhookEvent.nextRetryAt = new Date(Date.now() + delayMs);
            await eventRepository.save(webhookEvent);

            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          } else {
            // Max attempts reached
            webhookEvent.status = 'failed';
            webhookEvent.nextRetryAt = undefined;
            await eventRepository.save(webhookEvent);
            return;
          }
        }
      } catch (error: any) {
        webhookEvent.errorMessage = error.message || 'Unknown error';
        
        if (attemptCount < maxAttempts) {
          // Retry on network errors
          const delayMs = Math.min(1000 * Math.pow(2, attemptCount - 1), 30000);
          webhookEvent.nextRetryAt = new Date(Date.now() + delayMs);
          webhookEvent.status = 'retrying';
          await eventRepository.save(webhookEvent);

          await new Promise((resolve) => setTimeout(resolve, delayMs));
        } else {
          webhookEvent.status = 'failed';
          webhookEvent.nextRetryAt = undefined;
          await eventRepository.save(webhookEvent);
          return;
        }
      }
    }
  }

  /**
   * Wait for acknowledgement from webhook receiver
   */
  private async waitForAcknowledgement(
    webhookEvent: WebhookEvent,
    timeoutMs: number,
    req?: TenantRequest
  ): Promise<boolean> {
    const eventRepository = this.getWebhookEventRepository(req);
    const startTime = Date.now();
    const checkInterval = 1000; // Check every second

    while (Date.now() - startTime < timeoutMs) {
      // Reload event from database to check if acknowledged
      const updatedEvent = await eventRepository.findOne({
        where: { id: webhookEvent.id },
      });

      if (updatedEvent && updatedEvent.acknowledgedAt) {
        // Acknowledgement received
        webhookEvent.acknowledgedAt = updatedEvent.acknowledgedAt;
        webhookEvent.acknowledgementStatus = updatedEvent.acknowledgementStatus;
        return true;
      }

      // Check if timeout has passed
      if (updatedEvent?.acknowledgementTimeoutAt && 
          new Date() > updatedEvent.acknowledgementTimeoutAt) {
        return false;
      }

      // Wait before checking again
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    return false; // Timeout
  }

  /**
   * Acknowledge a webhook event (called by external system)
   */
  async acknowledgeWebhook(
    webhookEventId: string,
    status?: string,
    req?: TenantRequest
  ): Promise<void> {
    const eventRepository = this.getWebhookEventRepository(req);
    const webhookEvent = await eventRepository.findOne({
      where: { id: webhookEventId },
    });

    if (!webhookEvent) {
      throw new Error('Webhook event not found');
    }

    if (webhookEvent.acknowledgedAt) {
      // Already acknowledged
      return;
    }

    webhookEvent.acknowledgedAt = new Date();
    webhookEvent.acknowledgementStatus = status || 'acknowledged';
    
    // If webhook was delivered and awaiting ack, mark as success
    if (webhookEvent.status === 'awaiting_ack') {
      webhookEvent.status = 'success';
    }

    await eventRepository.save(webhookEvent);
  }

  /**
   * Send HTTP request to webhook URL
   */
  private async sendWebhookRequest(
    webhook: Webhook,
    webhookEvent: WebhookEvent,
    payload: WebhookPayload
  ): Promise<WebhookDeliveryResult> {
    return new Promise((resolve) => {
      const url = new URL(webhook.url);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      const payloadString = JSON.stringify(payload);
      
      // Generate HMAC signature if secret is provided
      let signature: string | undefined;
      if (webhook.secret) {
        signature = crypto
          .createHmac('sha256', webhook.secret)
          .update(payloadString)
          .digest('hex');
      }

      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Multi-Tenant-SaaS-Webhook/1.0',
        'X-Webhook-Event': payload.event,
        'X-Webhook-Timestamp': payload.timestamp,
        'X-Webhook-Event-Id': webhookEvent.id, // Include event ID for acknowledgement
        ...webhook.headers,
      };

      // Add acknowledgement info if required
      if (webhook.acknowledgementRequired) {
        headers['X-Webhook-Acknowledgement-Required'] = 'true';
        headers['X-Webhook-Acknowledgement-Timeout'] = webhook.acknowledgementTimeoutMs.toString();
        // Include acknowledgement endpoint URL
        const ackUrl = `${process.env.API_URL || 'http://localhost:3001'}/api/webhooks/events/${webhookEvent.id}/acknowledge`;
        headers['X-Webhook-Acknowledgement-Url'] = ackUrl;
      }

      if (signature) {
        headers['X-Webhook-Signature'] = `sha256=${signature}`;
      }

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers,
        timeout: webhook.timeoutMs,
      };

      const req = client.request(options, (res) => {
        let responseBody = '';

        res.on('data', (chunk) => {
          responseBody += chunk.toString();
        });

        res.on('end', () => {
          const success = !!(res.statusCode && res.statusCode >= 200 && res.statusCode < 300);
          resolve({
            success,
            httpStatus: res.statusCode,
            responseBody: responseBody.substring(0, 1000), // Limit response body size
          });
        });
      });

      req.on('error', (error) => {
        resolve({
          success: false,
          errorMessage: error.message,
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          errorMessage: 'Request timeout',
        });
      });

      req.write(payloadString);
      req.end();
    });
  }

  /**
   * Get webhook events (delivery history)
   */
  async getWebhookEvents(
    webhookId: string,
    clientId: string,
    limit = 50,
    req?: TenantRequest
  ): Promise<WebhookEvent[]> {
    // Verify webhook belongs to client
    const webhook = await this.getWebhook(webhookId, clientId, req);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const eventRepository = this.getWebhookEventRepository(req);
    return eventRepository.find({
      where: { webhookId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Retry failed webhook delivery
   */
  async retryWebhookEvent(eventId: string, clientId: string, req?: TenantRequest): Promise<void> {
    const eventRepository = this.getWebhookEventRepository(req);
    const isolationLevel = await getIsolationLevel(req, clientId);
    
    // For database-per-tenant, don't try to load webhook relation with client
    const relations = isolationLevel === 'database' ? [] : ['webhook'];
    
    const event = await eventRepository.findOne({
      where: { id: eventId },
      relations,
    });

    if (!event) {
      throw new Error('Webhook event not found');
    }

    // For shared isolation, verify webhook belongs to client
    if (isolationLevel !== 'database' && event.webhook && (event.webhook as any).clientId !== clientId) {
      throw new Error('Webhook event not found');
    }

    if (event.status === 'success') {
      throw new Error('Webhook event already delivered successfully');
    }

    // Get webhook for delivery
    const webhook = event.webhook || await this.getWebhook((event as any).webhookId, clientId, req);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    // Reset for retry
    event.status = 'pending';
    event.attemptCount = 0;
    event.nextRetryAt = undefined;
    await eventRepository.save(event);

    // Deliver again
    await this.deliverWebhook(webhook, event, event.payload as unknown as WebhookPayload, req);
  }
}

