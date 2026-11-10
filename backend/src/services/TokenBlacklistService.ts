import { Redis } from 'ioredis';
import { config } from '../config/config';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { RETRY_CONSTANTS } from '../constants/retry';
import { logger } from '../utils/logger';

/**
 * Service for managing token blacklist
 * Uses Redis to store blacklisted tokens with TTL matching token expiration
 */
export class TokenBlacklistService {
  private redis: Redis | null = null;
  private isEnabled: boolean = false;

  constructor() {
    // Only enable if Redis is available
    if (config.redisUrl) {
      try {
        this.redis = new Redis(config.redisUrl, {
          retryStrategy: (times) => {
            // Retry with exponential backoff
            const delay = Math.min(times * RETRY_CONSTANTS.DELAY_MULTIPLIER, RETRY_CONSTANTS.MAX_DELAY_MS);
            return delay;
          },
          maxRetriesPerRequest: 3,
          lazyConnect: false, // Connect immediately
          enableReadyCheck: true, // Wait for ready state
        });

        this.redis.on('connect', () => {
          this.isEnabled = true;
          logger.info('Token blacklist service connected to Redis');
        });

        // Also check 'ready' event for when Redis is fully ready
        this.redis.on('ready', () => {
          this.isEnabled = true;
          logger.info('Token blacklist service Redis is ready');
        });

        this.redis.on('error', (error) => {
          logger.warn('Token blacklist service Redis error:', { error: error.message });
          this.isEnabled = false;
        });

        this.redis.on('close', () => {
          this.isEnabled = false;
          logger.warn('Token blacklist service Redis connection closed');
        });
      } catch (error) {
        logger.warn('Failed to initialize token blacklist service:', { error });
        this.isEnabled = false;
      }
    }
  }

  /**
   * Add a token to the blacklist
   * @param token - The JWT token to blacklist
   * @param expiresIn - Optional expiration time in seconds (defaults to token's expiration)
   */
  async blacklistToken(token: string, expiresIn?: number): Promise<void> {
    // Wait for Redis connection if not yet connected
    if (!this.isEnabled || !this.redis) {
      // Try to wait a bit for connection (max 2 seconds)
      let attempts = 0;
      const maxAttempts = 20;
      while ((!this.isEnabled || !this.redis) && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      // If still not connected, log warning and return
      if (!this.isEnabled || !this.redis) {
        logger.warn('Token blacklist service: Redis not available, token will not be blacklisted', {
          redisUrl: config.redisUrl,
          redisStatus: this.redis?.status || 'null'
        });
        return;
      }
    }

    // Verify Redis connection is actually ready by attempting a ping
    try {
      await this.redis.ping();
    } catch (error) {
      logger.warn('Token blacklist service: Redis ping failed, connection not ready', {
        error: error instanceof Error ? error.message : String(error)
      });
      // Try to wait a bit more and retry
      let attempts = 0;
      const maxAttempts = 10;
      let pingSuccess = false;
      while (!pingSuccess && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        try {
          await this.redis.ping();
          pingSuccess = true;
        } catch {
          attempts++;
        }
      }
      
      if (!pingSuccess) {
        logger.warn('Token blacklist service: Redis still not responding after waiting');
        return;
      }
    }

    try {
      // Decode token to get expiration
      let ttl = expiresIn;
      if (!ttl) {
        const decoded = jwt.decode(token) as { exp?: number };
        if (decoded?.exp) {
          const now = Math.floor(Date.now() / 1000);
          ttl = decoded.exp - now;
          // Add 1 hour buffer to ensure token is blacklisted even after expiration
          ttl = Math.max(ttl, 3600);
        } else {
          // Default to 1 hour if no expiration found
          ttl = 3600;
        }
      }

      // Store token hash in Redis with TTL
      const tokenHash = this.hashToken(token);
      await this.redis.setex(`blacklist:${tokenHash}`, ttl, '1');
      logger.debug('Token blacklisted successfully', { tokenHash: tokenHash.substring(0, 8) + '...', ttl });
    } catch (error) {
      logger.error('Failed to blacklist token:', { error });
      // Mark as disabled if connection fails
      this.isEnabled = false;
      // Don't throw - graceful degradation
    }
  }

  /**
   * Check if a token is blacklisted
   * @param token - The JWT token to check
   * @returns true if token is blacklisted, false otherwise
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    // Wait for Redis connection if not yet connected
    if (!this.isEnabled || !this.redis) {
      // Try to wait a bit for connection (max 2 seconds)
      let attempts = 0;
      const maxAttempts = 20;
      while ((!this.isEnabled || !this.redis) && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      // If still not connected, assume token is not blacklisted (fail open for availability)
      if (!this.isEnabled || !this.redis) {
        logger.warn('Token blacklist service: Redis not available, assuming token is not blacklisted', {
          redisUrl: config.redisUrl,
          redisStatus: this.redis?.status || 'null'
        });
        return false;
      }
    }

    // Verify Redis connection is actually ready by attempting a ping
    try {
      await this.redis.ping();
    } catch (error) {
      logger.warn('Token blacklist service: Redis ping failed, connection not ready', {
        error: error instanceof Error ? error.message : String(error)
      });
      // Try to wait a bit more and retry
      let attempts = 0;
      const maxAttempts = 10;
      let pingSuccess = false;
      while (!pingSuccess && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        try {
          await this.redis.ping();
          pingSuccess = true;
        } catch {
          attempts++;
        }
      }
      
      if (!pingSuccess) {
        logger.warn('Token blacklist service: Redis not responding, assuming token is not blacklisted');
        return false;
      }
    }

    try {
      const tokenHash = this.hashToken(token);
      const result = await this.redis.get(`blacklist:${tokenHash}`);
      const isBlacklisted = result === '1';
      if (isBlacklisted) {
        logger.debug('Token found in blacklist', { tokenHash: tokenHash.substring(0, 8) + '...' });
      }
      return isBlacklisted;
    } catch (error) {
      logger.error('Failed to check token blacklist:', { error });
      // Mark as disabled if connection fails
      this.isEnabled = false;
      // On error, assume token is not blacklisted (fail open for availability)
      return false;
    }
  }

  /**
   * Blacklist all tokens for a user (useful for logout all devices)
   * @param userId - The user ID
   * @param expiresIn - Expiration time in seconds (default: 7 days for refresh tokens)
   */
  async blacklistUserTokens(userId: string, expiresIn: number = 7 * 24 * 60 * 60): Promise<void> {
    // Wait for Redis connection if not yet connected
    if (!this.isEnabled || !this.redis) {
      // Try to wait a bit for connection (max 2 seconds)
      let attempts = 0;
      const maxAttempts = 20;
      while ((!this.isEnabled || !this.redis) && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      // If still not connected, return early
      if (!this.isEnabled || !this.redis) {
        return;
      }
    }

    try {
      // Store user ID with timestamp
      // This allows checking if user's tokens should be invalidated
      await this.redis.setex(`blacklist:user:${userId}`, expiresIn, Date.now().toString());
    } catch (error) {
      logger.error('Failed to blacklist user tokens:', { error });
      // Mark as disabled if connection fails
      this.isEnabled = false;
    }
  }

  /**
   * Check if user's tokens are blacklisted
   * @param userId - The user ID
   * @returns true if user's tokens are blacklisted, false otherwise
   */
  async isUserBlacklisted(userId: string): Promise<boolean> {
    // Wait for Redis connection if not yet connected
    if (!this.isEnabled || !this.redis) {
      // Try to wait a bit for connection (max 2 seconds)
      let attempts = 0;
      const maxAttempts = 20;
      while ((!this.isEnabled || !this.redis) && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      // If still not connected, assume not blacklisted (fail open)
      if (!this.isEnabled || !this.redis) {
        return false;
      }
    }

    try {
      const result = await this.redis.get(`blacklist:user:${userId}`);
      return result !== null;
    } catch (error) {
      logger.error('Failed to check user blacklist:', { error });
      // Mark as disabled if connection fails
      this.isEnabled = false;
      return false;
    }
  }

  /**
   * Clear user blacklist (useful when user logs in successfully)
   * @param userId - The user ID
   */
  async clearUserBlacklist(userId: string): Promise<void> {
    // Wait for Redis connection if not yet connected
    if (!this.isEnabled || !this.redis) {
      // Try to wait a bit for connection (max 2 seconds)
      let attempts = 0;
      const maxAttempts = 20;
      while ((!this.isEnabled || !this.redis) && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      // If still not connected, return early
      if (!this.isEnabled || !this.redis) {
        return;
      }
    }

    try {
      await this.redis.del(`blacklist:user:${userId}`);
    } catch (error) {
      logger.error('Failed to clear user blacklist:', { error });
      // Don't throw - graceful degradation
    }
  }

  /**
   * Hash a token for storage (SHA-256)
   * @param token - The JWT token
   * @returns Hashed token
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

