import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { AppDataSource } from '../config/database';
import { Webhook } from '../entities/Webhook';
import { WebhookEvent } from '../entities/WebhookEvent';
import { WebhookPayload, WebhookDeliveryResult } from '../types/webhook.types';
import crypto from 'crypto';
import https from 'https';
import http from 'http';

interface WebhookJobData {
  webhookId: string;
  webhookEventId: string;
  url: string;
  payload: WebhookPayload;
  secret?: string;
  headers?: Record<string, string>;
  timeoutMs: number;
  acknowledgementRequired: boolean;
  acknowledgementTimeoutMs: number;
}

/**
 * Webhook Queue Service using BullMQ
 * Handles webhook delivery with retry logic, rate limiting, and persistence
 */
export class WebhookQueueService {
  private queue: Queue;
  private worker: Worker;
  private queueEvents: QueueEvents;
  private redis: Redis;

  private get webhookRepository() {
    return AppDataSource.getRepository(Webhook);
  }

  private get webhookEventRepository() {
    return AppDataSource.getRepository(WebhookEvent);
  }

  constructor() {
    // Create Redis connection
    // Parse Redis URL or use default connection options
    const redisUrl = config.redisUrl || 'redis://localhost:6379';
    
    logger.info('Initializing Redis connection', { 
      redisUrl, 
      envRedisUrl: process.env.REDIS_URL,
      nodeEnv: process.env.NODE_ENV 
    });
    
    const redisOptions: any = {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      family: 4, // Force IPv4 to avoid IPv6 issues
      retryStrategy: (times: number) => {
        if (times > 3) {
          logger.error('Redis connection failed after 3 retries');
          return null; // Stop retrying
        }
        return Math.min(times * 200, 2000); // Exponential backoff
      },
    };

    // If it's a URL, parse it; otherwise use as host
    if (redisUrl.startsWith('redis://')) {
      try {
        const url = new URL(redisUrl);
        redisOptions.host = url.hostname;
        redisOptions.port = parseInt(url.port || '6379', 10);
        if (url.password) {
          redisOptions.password = url.password;
        }
        logger.info('Parsed Redis URL', { host: redisOptions.host, port: redisOptions.port });
        // Don't use URL directly - use parsed options
        this.redis = new Redis(redisOptions);
      } catch (error: any) {
        logger.warn('Failed to parse Redis URL, using fallback', { error: error.message });
        // Fallback: try to extract hostname from URL string
        const match = redisUrl.match(/redis:\/\/([^:]+):?(\d+)?/);
        if (match) {
          redisOptions.host = match[1];
          redisOptions.port = match[2] ? parseInt(match[2], 10) : 6379;
        } else {
          redisOptions.host = 'localhost';
          redisOptions.port = 6379;
        }
        logger.info('Using fallback Redis connection', { host: redisOptions.host, port: redisOptions.port });
        this.redis = new Redis(redisOptions);
      }
    } else {
      redisOptions.host = redisUrl;
      redisOptions.port = 6379;
      this.redis = new Redis(redisOptions);
    }

    // Handle connection events
    this.redis.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    this.redis.on('error', (error) => {
      logger.error('Redis connection error', { error: error.message });
    });

    // Create webhook delivery queue
    this.queue = new Queue('webhook-delivery', {
      connection: this.redis,
      defaultJobOptions: {
        attempts: 5, // Default 5 attempts
        backoff: {
          type: 'exponential',
          delay: 2000, // Start with 2s delay
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 1000, // Keep last 1000 completed jobs
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours
        },
      },
    });

    // Create worker to process webhook jobs
    this.worker = new Worker(
      'webhook-delivery',
      async (job: Job<WebhookJobData>) => {
        return await this.processWebhookJob(job);
      },
      {
        connection: this.redis,
        concurrency: 10, // Process 10 webhooks concurrently
        limiter: {
          max: 100, // Max 100 jobs per duration
          duration: 60000, // 60 seconds
        },
      }
    );

    // Queue events for monitoring
    this.queueEvents = new QueueEvents('webhook-delivery', {
      connection: this.redis,
    });

    this.setupEventHandlers();
  }

  /**
   * Add webhook job to queue
   */
  async addWebhookJob(
    webhook: Webhook,
    webhookEvent: WebhookEvent,
    payload: WebhookPayload
  ): Promise<void> {
    const jobData: WebhookJobData = {
      webhookId: webhook.id,
      webhookEventId: webhookEvent.id,
      url: webhook.url,
      payload,
      secret: webhook.secret || undefined,
      headers: webhook.headers || undefined,
      timeoutMs: webhook.timeoutMs,
      acknowledgementRequired: webhook.acknowledgementRequired,
      acknowledgementTimeoutMs: webhook.acknowledgementTimeoutMs,
    };

    await this.queue.add('deliver-webhook', jobData, {
      jobId: webhookEvent.id, // Use event ID as job ID for deduplication
      attempts: webhook.maxRetries + 1,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });

    logger.info('Webhook job added to queue', {
      webhookId: webhook.id,
      eventId: webhookEvent.id,
      url: webhook.url,
    });
  }

  /**
   * Process webhook job
   */
  private async processWebhookJob(job: Job<WebhookJobData>): Promise<WebhookDeliveryResult> {
    const { webhookEventId, url, payload, secret, headers, timeoutMs, acknowledgementRequired, acknowledgementTimeoutMs } = job.data;

    // Update webhook event status
    const webhookEvent = await this.webhookEventRepository.findOne({
      where: { id: webhookEventId },
    });

    if (!webhookEvent) {
      throw new Error(`Webhook event ${webhookEventId} not found`);
    }

    // Update attempt count
    webhookEvent.attemptCount = (job.attemptsMade || 0) + 1;
    webhookEvent.status = webhookEvent.attemptCount === 1 ? 'pending' : 'retrying';
    await this.webhookEventRepository.save(webhookEvent);

    // Send webhook request
    const result = await this.sendWebhookRequest(
      url,
      payload,
      webhookEventId,
      secret,
      headers,
      timeoutMs
    );

    // Update webhook event with result
    webhookEvent.httpStatus = result.httpStatus;
    webhookEvent.responseBody = result.responseBody;
    webhookEvent.errorMessage = result.errorMessage;

    if (result.success) {
      webhookEvent.deliveredAt = new Date();
      
      if (acknowledgementRequired) {
        // Set status to awaiting acknowledgement
        webhookEvent.status = 'awaiting_ack';
        webhookEvent.acknowledgementTimeoutAt = new Date(
          Date.now() + acknowledgementTimeoutMs
        );
        await this.webhookEventRepository.save(webhookEvent);

        // Wait for acknowledgement
        const ackReceived = await this.waitForAcknowledgement(
          webhookEventId,
          acknowledgementTimeoutMs
        );

        if (ackReceived) {
          webhookEvent.status = 'success';
          webhookEvent.acknowledgedAt = new Date();
        } else {
          webhookEvent.status = 'ack_timeout';
          webhookEvent.errorMessage = 'Acknowledgement timeout';
          // Throw error to trigger retry
          throw new Error('Acknowledgement timeout');
        }
      } else {
        webhookEvent.status = 'success';
      }

      await this.webhookEventRepository.save(webhookEvent);
      return result;
    } else {
      // Failed - check if should retry
      if (result.httpStatus && result.httpStatus >= 400 && result.httpStatus < 500) {
        // 4xx errors - don't retry
        webhookEvent.status = 'failed';
        await this.webhookEventRepository.save(webhookEvent);
        throw new Error(`Client error: ${result.httpStatus}`);
      } else {
        // 5xx or network errors - will retry via BullMQ
        webhookEvent.status = 'retrying';
        await this.webhookEventRepository.save(webhookEvent);
        throw new Error(result.errorMessage || 'Webhook delivery failed');
      }
    }
  }

  /**
   * Send HTTP request to webhook URL
   */
  private async sendWebhookRequest(
    url: string,
    payload: WebhookPayload,
    eventId: string,
    secret?: string,
    customHeaders?: Record<string, string>,
    timeoutMs: number = 5000
  ): Promise<WebhookDeliveryResult> {
    return new Promise((resolve) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;

      const payloadString = JSON.stringify(payload);

      // Generate HMAC signature if secret is provided
      let signature: string | undefined;
      if (secret) {
        signature = crypto
          .createHmac('sha256', secret)
          .update(payloadString)
          .digest('hex');
      }

      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Multi-Tenant-SaaS-Webhook/1.0',
        'X-Webhook-Event': payload.event,
        'X-Webhook-Timestamp': payload.timestamp,
        'X-Webhook-Event-Id': eventId,
        ...customHeaders,
      };

      if (signature) {
        headers['X-Webhook-Signature'] = `sha256=${signature}`;
      }

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers,
        timeout: timeoutMs,
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
   * Wait for acknowledgement from webhook receiver
   */
  private async waitForAcknowledgement(
    webhookEventId: string,
    timeoutMs: number
  ): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 1000; // Check every second

    while (Date.now() - startTime < timeoutMs) {
      // Reload event from database to check if acknowledged
      const updatedEvent = await this.webhookEventRepository.findOne({
        where: { id: webhookEventId },
      });

      if (updatedEvent && updatedEvent.acknowledgedAt) {
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
   * Setup event handlers for monitoring
   */
  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      logger.info('Webhook job completed', {
        jobId: job.id,
        webhookEventId: job.data.webhookEventId,
      });
    });

    this.worker.on('failed', (job, err) => {
      logger.error('Webhook job failed', {
        jobId: job?.id,
        webhookEventId: job?.data?.webhookEventId,
        error: err.message,
        attemptsMade: job?.attemptsMade,
      });
    });

    this.worker.on('error', (err) => {
      logger.error('Webhook worker error', { error: err.message });
    });
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }

  /**
   * Cleanup resources
   */
  async close(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
    await this.queueEvents.close();
    await this.redis.quit();
  }
}

// Singleton instance
let webhookQueueServiceInstance: WebhookQueueService | null = null;

export function getWebhookQueueService(): WebhookQueueService {
  if (!webhookQueueServiceInstance) {
    webhookQueueServiceInstance = new WebhookQueueService();
  }
  return webhookQueueServiceInstance;
}

