import { Redis } from 'ioredis';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { RETRY_CONSTANTS } from '../constants/retry';
import crypto from 'crypto';

interface SSOState {
  clientId: string;
  nonce: string;
  redirectUri?: string;
  codeVerifier?: string; // PKCE code verifier
}

/**
 * Service for managing SSO state and nonce values
 * Uses Redis to store state with TTL (10 minutes)
 */
export class SSOStateService {
  private redis: Redis | null = null;
  private isEnabled: boolean = false;

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
            logger.warn('SSO State Service Redis connection failed after 3 retries');
            return null; // Stop retrying
          }
          return Math.min(times * RETRY_CONSTANTS.DELAY_MULTIPLIER, RETRY_CONSTANTS.MAX_DELAY_MS);
        },
        lazyConnect: true, // Don't connect immediately, wait for first operation
        family: 4, // Force IPv4 to avoid IPv6 issues
      };

      // Parse Redis URL similar to other services
      if (redisUrl.startsWith('redis://')) {
        try {
          const url = new URL(redisUrl);
          redisOptions.host = url.hostname;
          redisOptions.port = parseInt(url.port || '6379', 10);
          if (url.password) {
            redisOptions.password = url.password;
          }
          logger.info('Parsed Redis URL for SSO State Service', { host: redisOptions.host, port: redisOptions.port });
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
          logger.info('Using fallback Redis connection for SSO State Service', { host: redisOptions.host, port: redisOptions.port });
          this.redis = new Redis(redisOptions);
        }
      } else {
        redisOptions.host = redisUrl;
        redisOptions.port = 6379;
        this.redis = new Redis(redisOptions);
      }

      this.redis.on('connect', () => {
        this.isEnabled = true;
        logger.info('SSO State Service connected to Redis');
      });

      this.redis.on('ready', () => {
        this.isEnabled = true;
        logger.info('SSO State Service Redis is ready');
      });

      this.redis.on('error', (error) => {
        logger.warn('SSO State Service Redis error:', error.message);
        this.isEnabled = false;
      });

      this.redis.on('close', () => {
        this.isEnabled = false;
        logger.warn('SSO State Service Redis connection closed');
      });

      // Note: With lazyConnect: true, connection will happen on first operation
      // We'll check and connect in storeState/getState methods
    } catch (error: any) {
      logger.warn('Failed to initialize SSO State Service:', error.message);
      this.isEnabled = false;
    }
  }

  /**
   * Generate a random state value
   */
  generateState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate a random nonce value
   */
  generateNonce(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Store state with clientId and nonce
   * @param state - The state value
   * @param clientId - The client ID
   * @param nonce - The nonce value
   * @param redirectUri - Optional redirect URI
   * @param ttlSeconds - Time to live in seconds (default: from config)
   * @param codeVerifier - Optional PKCE code verifier
   */
  async storeState(
    state: string,
    clientId: string,
    nonce: string,
    redirectUri?: string,
    ttlSeconds: number = config.sso.stateTtlSeconds,
    codeVerifier?: string
  ): Promise<void> {
    if (!this.redis) {
      throw new Error('Redis is not configured. Please set REDIS_URL environment variable.');
    }

    // Check connection status and try to connect if needed
    if (!this.isEnabled) {
      try {
        await this.redis.connect();
        this.isEnabled = true;
        logger.info('SSO State Service Redis connection established');
      } catch (error: any) {
        logger.error('Failed to connect to Redis for SSO state storage:', error.message);
        throw new Error('Redis is not available for SSO state storage. Please ensure Redis is running and REDIS_URL is configured correctly.');
      }
    }

    const stateData: SSOState = {
      clientId,
      nonce,
      redirectUri,
      codeVerifier,
    };

    const key = `sso:state:${state}`;
    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(stateData));
      logger.debug('Stored SSO state', { state, clientId, ttlSeconds });
    } catch (error: any) {
      logger.error('Failed to store SSO state in Redis:', error.message);
      throw new Error('Failed to store SSO state. Please ensure Redis is running.');
    }
  }

  /**
   * Retrieve and validate state
   * @param state - The state value to retrieve
   * @returns State data if valid, null if not found or expired
   */
  async getState(state: string): Promise<SSOState | null> {
    if (!this.redis) {
      throw new Error('Redis is not configured. Please set REDIS_URL environment variable.');
    }

    // Check connection status and try to connect if needed
    if (!this.isEnabled) {
      try {
        await this.redis.connect();
        this.isEnabled = true;
        logger.info('SSO State Service Redis connection established');
      } catch (error: any) {
        logger.error('Failed to connect to Redis for SSO state retrieval:', error.message);
        throw new Error('Redis is not available for SSO state retrieval. Please ensure Redis is running and REDIS_URL is configured correctly.');
      }
    }

    const key = `sso:state:${state}`;
    try {
      const data = await this.redis.get(key);

      if (!data) {
        return null;
      }

      try {
        return JSON.parse(data) as SSOState;
      } catch (error) {
        logger.error('Failed to parse SSO state data', { error, state });
        return null;
      }
    } catch (error: any) {
      logger.error('Failed to retrieve SSO state from Redis:', error.message);
      throw new Error('Failed to retrieve SSO state. Please ensure Redis is running.');
    }
  }

  /**
   * Delete state after use (one-time use)
   * @param state - The state value to delete
   */
  async deleteState(state: string): Promise<void> {
    if (!this.redis || !this.isEnabled) {
      return; // Silently fail if Redis is not available
    }

    const key = `sso:state:${state}`;
    await this.redis.del(key);
    logger.debug('Deleted SSO state', { state });
  }

  /**
   * Check if Redis is available
   * Also attempts to connect if not already connected
   */
  async isAvailable(): Promise<boolean> {
    if (!this.redis) {
      return false;
    }

    // If not enabled, try to connect
    if (!this.isEnabled) {
      try {
        // Check if already connected
        if (this.redis.status === 'ready' || this.redis.status === 'connect') {
          this.isEnabled = true;
          return true;
        }

        // Try to connect
        await this.redis.connect();
        this.isEnabled = true;
        return true;
      } catch (error: any) {
        logger.warn('SSO State Service Redis connection check failed:', error.message);
        return false;
      }
    }

    return this.isEnabled;
  }
}

// Singleton instance
let ssoStateServiceInstance: SSOStateService | null = null;

export function getSSOStateService(): SSOStateService {
  if (!ssoStateServiceInstance) {
    ssoStateServiceInstance = new SSOStateService();
  }
  return ssoStateServiceInstance;
}

