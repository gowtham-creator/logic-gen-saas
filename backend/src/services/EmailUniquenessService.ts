import Redis from 'ioredis';
import { config } from '../config/config';
import { logger } from '../utils/logger';

/**
 * Service to manage email uniqueness using Redis
 * Uses a Redis SET to store all emails for fast O(1) lookup
 */
export class EmailUniquenessService {
  private redis: Redis | null = null;
  private readonly EMAIL_SET_KEY = 'system:emails:unique';
  private isConnected = false;

  constructor() {
    this.initializeRedis();
  }

  private initializeRedis(): void {
    try {
      const redisUrl = config.redisUrl || 'redis://localhost:6379';
      
      const redisOptions: any = {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          if (times > 3) {
            logger.error('Redis connection failed after 3 retries');
            return null; // Stop retrying
          }
          return Math.min(times * 50, 2000);
        },
        lazyConnect: true,
      };

      if (redisUrl.startsWith('redis://')) {
        try {
          const url = new URL(redisUrl);
          redisOptions.host = url.hostname;
          redisOptions.port = parseInt(url.port || '6379', 10);
          if (url.password) {
            redisOptions.password = url.password;
          }
          logger.info('Parsed Redis URL for email uniqueness', { host: redisOptions.host, port: redisOptions.port });
          this.redis = new Redis(redisOptions);
        } catch (error: any) {
          logger.warn('Failed to parse Redis URL, using fallback', { error: error.message });
          const match = redisUrl.match(/redis:\/\/([^:]+):?(\d+)?/);
          if (match) {
            redisOptions.host = match[1];
            redisOptions.port = match[2] ? parseInt(match[2], 10) : 6379;
          } else {
            redisOptions.host = 'localhost';
            redisOptions.port = 6379;
          }
          logger.info('Using fallback Redis connection for email uniqueness', { host: redisOptions.host, port: redisOptions.port });
          this.redis = new Redis(redisOptions);
        }
      } else {
        redisOptions.host = redisUrl;
        redisOptions.port = 6379;
        this.redis = new Redis(redisOptions);
      }

      this.redis.on('connect', () => {
        logger.info('Redis connected for email uniqueness service');
        this.isConnected = true;
      });

      this.redis.on('error', (error) => {
        logger.error('Redis connection error for email uniqueness', { error: error.message });
        this.isConnected = false;
      });

      this.redis.on('close', () => {
        logger.warn('Redis connection closed for email uniqueness');
        this.isConnected = false;
      });

      // Connect lazily
      this.redis.connect().catch((error) => {
        logger.warn('Failed to connect to Redis for email uniqueness', { error: error.message });
        this.isConnected = false;
      });
    } catch (error: any) {
      logger.error('Failed to initialize Redis for email uniqueness', { error: error.message });
      this.redis = null;
      this.isConnected = false;
    }
  }

  /**
   * Normalize email to lowercase and trim
   */
  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  /**
   * Check if email is available (not in Redis set)
   */
  async isEmailAvailable(email: string): Promise<{ available: boolean; message?: string }> {
    if (!this.redis || !this.isConnected) {
      // If Redis is not available, fall back to database check
      logger.warn('Redis not available for email check, falling back to database');
      return { available: true }; // Let database check handle it
    }

    try {
      const normalizedEmail = this.normalizeEmail(email);
      const exists = await this.redis.sismember(this.EMAIL_SET_KEY, normalizedEmail);
      
      if (exists === 1) {
        return {
          available: false,
          message: `Email ${email} already exists in the system`,
        };
      }

      return { available: true };
    } catch (error: any) {
      logger.error('Error checking email availability in Redis', { error: error.message });
      // On error, return available=true to let database check handle it
      return { available: true };
    }
  }

  /**
   * Add email to Redis set
   */
  async addEmail(email: string): Promise<void> {
    if (!this.redis || !this.isConnected) {
      logger.warn('Redis not available, skipping email addition to Redis');
      return;
    }

    try {
      const normalizedEmail = this.normalizeEmail(email);
      await this.redis.sadd(this.EMAIL_SET_KEY, normalizedEmail);
      logger.debug('Email added to Redis uniqueness set', { email: normalizedEmail });
    } catch (error: any) {
      logger.error('Error adding email to Redis', { error: error.message, email });
      // Don't throw - email addition to Redis is not critical for user creation
    }
  }

  /**
   * Remove email from Redis set
   */
  async removeEmail(email: string): Promise<void> {
    if (!this.redis || !this.isConnected) {
      logger.warn('Redis not available, skipping email removal from Redis');
      return;
    }

    try {
      const normalizedEmail = this.normalizeEmail(email);
      await this.redis.srem(this.EMAIL_SET_KEY, normalizedEmail);
      logger.debug('Email removed from Redis uniqueness set', { email: normalizedEmail });
    } catch (error: any) {
      logger.error('Error removing email from Redis', { error: error.message, email });
      // Don't throw - email removal from Redis is not critical for user deletion
    }
  }

  /**
   * Get total count of unique emails in the system
   */
  async getEmailCount(): Promise<number> {
    if (!this.redis || !this.isConnected) {
      return 0;
    }

    try {
      return await this.redis.scard(this.EMAIL_SET_KEY);
    } catch (error: any) {
      logger.error('Error getting email count from Redis', { error: error.message });
      return 0;
    }
  }

  /**
   * Check if Redis is connected
   */
  isRedisConnected(): boolean {
    return this.isConnected && this.redis !== null;
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.isConnected = false;
    }
  }
}

// Singleton instance
let emailUniquenessService: EmailUniquenessService | null = null;

export function getEmailUniquenessService(): EmailUniquenessService {
  if (!emailUniquenessService) {
    emailUniquenessService = new EmailUniquenessService();
  }
  return emailUniquenessService;
}

