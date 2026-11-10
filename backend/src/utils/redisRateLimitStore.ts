import Redis from 'ioredis';
import { config } from '../config/config';
import { logger } from './logger';
import type { Store } from 'express-rate-limit';

/**
 * Redis store for express-rate-limit
 * Provides distributed rate limiting across all server instances
 */
class RedisRateLimitStore implements Store {
  private redis: Redis | null = null;
  private isConnected = false;
  private windowMsCache = new Map<string, number>();

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
            logger.warn('Redis rate limit store connection failed after 3 retries');
            return null;
          }
          return Math.min(times * 50, 2000);
        },
        lazyConnect: true,
        family: 4, // Force IPv4
      };

      if (redisUrl.startsWith('redis://')) {
        try {
          const url = new URL(redisUrl);
          redisOptions.host = url.hostname;
          redisOptions.port = parseInt(url.port || '6379', 10);
          if (url.password) {
            redisOptions.password = url.password;
          }
          this.redis = new Redis(redisOptions);
        } catch (error: any) {
          logger.warn('Failed to parse Redis URL for rate limiting, using fallback', { error: error.message });
          const match = redisUrl.match(/redis:\/\/([^:]+):?(\d+)?/);
          if (match) {
            redisOptions.host = match[1];
            redisOptions.port = match[2] ? parseInt(match[2], 10) : 6379;
          } else {
            redisOptions.host = 'localhost';
            redisOptions.port = 6379;
          }
          this.redis = new Redis(redisOptions);
        }
      } else {
        redisOptions.host = redisUrl;
        redisOptions.port = 6379;
        this.redis = new Redis(redisOptions);
      }

      this.redis.on('connect', () => {
        logger.info('Redis rate limit store connected');
        this.isConnected = true;
      });

      this.redis.on('error', (error) => {
        logger.warn('Redis rate limit store error:', error.message);
        this.isConnected = false;
      });

      this.redis.on('close', () => {
        this.isConnected = false;
        logger.warn('Redis rate limit store connection closed');
      });
    } catch (error: any) {
      logger.warn('Failed to initialize Redis rate limit store:', error.message);
      this.isConnected = false;
    }
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date | undefined }> {
    if (!this.redis || !this.isConnected) {
      // Fallback: return values that won't trigger rate limit
      return { totalHits: 0, resetTime: undefined };
    }

    try {
      // Extract windowMs from cache or use default
      let windowMs = this.windowMsCache.get(key);
      if (!windowMs) {
        // Try to extract endpoint from key (format: `userId:ip:endpoint` or `ip:endpoint`)
        const parts = key.split(':');
        // The last part is the endpoint (e.g., 'default', '/api/users', etc.)
        const endpointKey = parts.length > 2 ? parts.slice(2).join(':') : (parts.length > 1 ? parts[parts.length - 1] : 'default');
        
        // Import getRateLimitConfig function
        const { getRateLimitConfig, DEFAULT_RATE_LIMIT } = await import('../middleware/rateLimiter');
        // Convert endpoint key to path format (e.g., 'default' -> '/api', '/api/users' -> '/api/users')
        const path = endpointKey === 'default' ? '/api' : endpointKey.startsWith('/') ? endpointKey : `/${endpointKey}`;
        const config = getRateLimitConfig(path);
        windowMs = config.windowMs || DEFAULT_RATE_LIMIT.windowMs;
        this.windowMsCache.set(key, windowMs);
      }

      const redisKey = `ratelimit:${key}`;
      const ttlSeconds = Math.ceil(windowMs / 1000);
      
      // Use Redis pipeline for atomic operations
      const pipeline = this.redis.pipeline();
      pipeline.incr(redisKey);
      pipeline.expire(redisKey, ttlSeconds);
      const results = await pipeline.exec();
      
      if (results && results[0] && results[0][1] !== null) {
        const totalHits = results[0][1] as number;
        const resetTime = new Date(Date.now() + windowMs);
        return { totalHits, resetTime };
      }
      
      return { totalHits: 1, resetTime: new Date(Date.now() + windowMs) };
    } catch (error: any) {
      logger.warn('Redis rate limit increment failed, falling back', { error: error.message, key });
      return { totalHits: 0, resetTime: undefined };
    }
  }

  async decrement(key: string): Promise<void> {
    // Not needed for rate limiting
  }

  async resetKey(key: string): Promise<void> {
    if (!this.redis || !this.isConnected) {
      return;
    }
    try {
      await this.redis.del(`ratelimit:${key}`);
      this.windowMsCache.delete(key);
    } catch (error: any) {
      logger.warn('Redis rate limit resetKey failed', { error: error.message, key });
    }
  }

  async shutdown(): Promise<void> {
    this.windowMsCache.clear();
    if (this.redis) {
      await this.redis.quit();
    }
  }

  isAvailable(): boolean {
    return this.isConnected && this.redis !== null;
  }
}

// Singleton instance
let redisStore: RedisRateLimitStore | null = null;

export function getRedisRateLimitStore(): RedisRateLimitStore {
  if (!redisStore) {
    redisStore = new RedisRateLimitStore();
  }
  return redisStore;
}

