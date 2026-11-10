import { logger } from '../utils/logger';
import { Request } from 'express';
import { AuthenticatedRequest } from '../types/middleware.types';
import { SECURITY_CONSTANTS } from '../constants/security';
import { config } from '../config/config';

/**
 * Security event types
 */
export enum SecurityEventType {
  // Authentication
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_SUSPICIOUS = 'LOGIN_SUSPICIOUS',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  DEVICE_CHANGE = 'DEVICE_CHANGE',
  TOKEN_BLACKLISTED = 'TOKEN_BLACKLISTED',
  TOKEN_REFRESH_FAILED = 'TOKEN_REFRESH_FAILED',
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',
  MFA_FAILED = 'MFA_FAILED',
  SSO_LOGIN = 'SSO_LOGIN',
  
  // Authorization
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  FORBIDDEN_ACCESS = 'FORBIDDEN_ACCESS',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  GLOBAL_RATE_LIMIT_HIT = 'GLOBAL_RATE_LIMIT_HIT',
  
  // API Security
  INVALID_API_KEY = 'INVALID_API_KEY',
  API_KEY_REVOKED = 'API_KEY_REVOKED',
  API_KEY_EXPIRED = 'API_KEY_EXPIRED',
  API_SCOPE_VIOLATION = 'API_SCOPE_VIOLATION',
  
  // File Upload
  MALICIOUS_FILE_UPLOAD = 'MALICIOUS_FILE_UPLOAD',
  FILE_VALIDATION_FAILED = 'FILE_VALIDATION_FAILED',
  FILE_SIZE_EXCEEDED = 'FILE_SIZE_EXCEEDED',
  VIRUS_DETECTED = 'VIRUS_DETECTED',
  
  // System
  ERROR_SPIKE = 'ERROR_SPIKE',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  DATABASE_ERROR = 'DATABASE_ERROR',
  REDIS_ERROR = 'REDIS_ERROR',
}

export type SecurityEventSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SecurityEvent {
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  message: string;
  metadata?: {
    userId?: string;
    clientId?: string;
    subdomain?: string; // Subdomain for multi-tenant tracking
    ip?: string;
    userAgent?: string;
    path?: string;
    method?: string;
    email?: string; // Be careful with PII
    [key: string]: any;
  };
  timestamp: Date;
}

/**
 * Security Monitoring Service
 * Tracks security events and sends alerts for critical/high severity events
 */
class SecurityMonitoringService {
  private eventBuffer: SecurityEvent[] = [];
  private bufferSize = config.securityMonitoring.eventBufferSize;
  private flushInterval = config.securityMonitoring.flushIntervalMs;
  private flushTimer: NodeJS.Timeout | null = null;
  
  // Track failed login attempts per IP
  private failedLoginAttempts = new Map<string, { count: number; lastAttempt: Date; emails: Set<string> }>();
  private readonly MAX_FAILED_ATTEMPTS_PER_IP = SECURITY_CONSTANTS.MAX_FAILED_ATTEMPTS_PER_IP;
  private readonly FAILED_ATTEMPT_WINDOW_MS = SECURITY_CONSTANTS.FAILED_ATTEMPT_WINDOW_MS;

  constructor() {
    // Start periodic flush
    this.startFlushTimer();
  }

  /**
   * Log a security event
   */
  log(event: SecurityEvent): void {
    // Add to buffer
    this.eventBuffer.push(event);

    // Log immediately for critical/high severity
    if (event.severity === 'critical' || event.severity === 'high') {
      this.logImmediate(event);
      this.checkForAlerts(event);
    }

    // Check for suspicious patterns
    this.detectSuspiciousActivity(event);

    // Flush if buffer is full
    if (this.eventBuffer.length >= this.bufferSize) {
      this.flush();
    }
  }

  /**
   * Log event immediately (for critical/high severity)
   */
  private logImmediate(event: SecurityEvent): void {
    logger.warn('Security Event', {
      eventType: event.type,
      severity: event.severity,
      message: event.message,
      metadata: this.sanitizeMetadata(event.metadata),
      timestamp: event.timestamp.toISOString(),
    });
  }

  /**
   * Detect suspicious activity patterns
   */
  private detectSuspiciousActivity(event: SecurityEvent): void {
    // Track failed login attempts
    if (event.type === SecurityEventType.LOGIN_FAILED) {
      const ip = event.metadata?.ip;
      
      if (!ip) {
        logger.warn('LOGIN_FAILED event missing IP address - cannot track suspicious activity', {
          hasMetadata: !!event.metadata,
          metadataKeys: event.metadata ? Object.keys(event.metadata) : [],
        });
        return;
      }
      
      logger.debug('Tracking failed login attempt', {
        ip,
        email: event.metadata?.email ? 'provided' : 'missing',
      });
      const attempts = this.failedLoginAttempts.get(ip) || {
        count: 0,
        lastAttempt: new Date(0),
        emails: new Set<string>(),
      };

      // Reset if window expired
      const now = new Date();
      if (now.getTime() - attempts.lastAttempt.getTime() > this.FAILED_ATTEMPT_WINDOW_MS) {
        attempts.count = 0;
        attempts.emails.clear();
      }

      attempts.count++;
      attempts.lastAttempt = now;
      if (event.metadata?.email) {
        attempts.emails.add(event.metadata.email);
      }
      this.failedLoginAttempts.set(ip, attempts);
      
      logger.debug('Failed login attempt tracked', {
        ip,
        count: attempts.count,
        uniqueEmails: attempts.emails.size,
        threshold: this.MAX_FAILED_ATTEMPTS_PER_IP,
        willAlert: attempts.count >= this.MAX_FAILED_ATTEMPTS_PER_IP,
      });

      // Alert if too many failed attempts
      if (attempts.count >= this.MAX_FAILED_ATTEMPTS_PER_IP) {
        logger.warn('Suspicious activity detected - multiple failed login attempts', {
          ip,
          count: attempts.count,
          uniqueEmails: attempts.emails.size,
        });
        
        this.log({
          type: SecurityEventType.SUSPICIOUS_ACTIVITY,
          severity: 'high',
          message: `Multiple failed login attempts from IP: ${ip} (${attempts.count} attempts, ${attempts.emails.size} different emails)`,
          metadata: {
            ip,
            failedAttemptCount: attempts.count,
            uniqueEmails: attempts.emails.size,
            timeWindow: `${SECURITY_CONSTANTS.FAILED_ATTEMPT_WINDOW_MS / (60 * 1000)} minutes`,
            subdomain: event.metadata?.subdomain,
            clientId: event.metadata?.clientId,
          },
          timestamp: new Date(),
        });
      }
    }

    // Track rate limit violations
    if (event.type === SecurityEventType.RATE_LIMIT_EXCEEDED) {
      // Multiple rate limit violations from same IP/user could indicate attack
      // This is handled by the rate limiter itself, but we log it here for monitoring
    }
  }

  /**
   * Check if event requires immediate alert
   */
  private checkForAlerts(event: SecurityEvent): void {
    // Critical events always alert
    if (event.severity === 'critical') {
      this.sendAlert(event);
      return;
    }

    // High severity events alert if they match certain patterns
    if (event.severity === 'high') {
      const alertTypes = [
        SecurityEventType.ACCOUNT_LOCKED,
        SecurityEventType.SUSPICIOUS_ACTIVITY,
        SecurityEventType.MALICIOUS_FILE_UPLOAD,
        SecurityEventType.VIRUS_DETECTED,
        SecurityEventType.GLOBAL_RATE_LIMIT_HIT,
      ];

      if (alertTypes.includes(event.type)) {
        this.sendAlert(event);
      }
    }
  }

  /**
   * Send alert for critical/high severity events
   */
  private async sendAlert(event: SecurityEvent): Promise<void> {
    // Log alert
    logger.error('Security Alert Triggered', {
      alert: true,
      eventType: event.type,
      severity: event.severity,
      message: event.message,
      metadata: this.sanitizeMetadata(event.metadata),
      timestamp: event.timestamp.toISOString(),
    });

    // Send to Slack if enabled
    try {
      const { getSlackAlertService } = await import('./SlackAlertService');
      const slackService = getSlackAlertService();
      
      logger.info('Checking Slack alert service', {
        enabled: slackService.isEnabled(),
        webhookConfigured: !!process.env.SLACK_WEBHOOK_URL,
      });
      
      if (slackService.isEnabled()) {
        logger.info('Sending Slack alert', { eventType: event.type });
        await slackService.sendSecurityAlert(event);
        logger.info('Slack alert sent successfully', { eventType: event.type });
      } else {
        logger.warn('Slack alerting is disabled - SLACK_WEBHOOK_URL not configured');
      }
    } catch (error: any) {
      // Don't fail if Slack service fails to load or send
      logger.error('Failed to send Slack alert', {
        error: error.message,
        stack: error.stack,
        eventType: event.type,
      });
    }
  }

  /**
   * Sanitize metadata to remove sensitive information
   */
  private sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> | undefined {
    if (!metadata) return undefined;

    const sanitized = { ...metadata };
    
    // Remove or redact sensitive fields
    if (sanitized.email) {
      // Partially redact email (e.g., u***@example.com)
      const email = sanitized.email as string;
      const [local, domain] = email.split('@');
      if (local && domain) {
        sanitized.email = `${local[0]}***@${domain}`;
      }
    }

    // Remove password-related fields
    delete sanitized.password;
    delete sanitized.currentPassword;
    delete sanitized.newPassword;
    delete sanitized.token;
    delete sanitized.apiKey;

    return sanitized;
  }

  /**
   * Flush buffered events
   */
  private flush(): void {
    if (this.eventBuffer.length === 0) return;

    // Batch log events
    logger.info('Security Events Batch', {
      count: this.eventBuffer.length,
      events: this.eventBuffer.map(e => ({
        type: e.type,
        severity: e.severity,
        message: e.message,
        timestamp: e.timestamp.toISOString(),
      })),
    });

    // Clear buffer
    this.eventBuffer = [];
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * Stop monitoring service
   */
  shutdown(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }

  /**
   * Get security statistics
   */
  getStats(): {
    bufferedEvents: number;
    failedLoginIPs: number;
  } {
    return {
      bufferedEvents: this.eventBuffer.length,
      failedLoginIPs: this.failedLoginAttempts.size,
    };
  }
}

// Singleton instance
let securityMonitoringService: SecurityMonitoringService | null = null;

export function getSecurityMonitoringService(): SecurityMonitoringService {
  if (!securityMonitoringService) {
    securityMonitoringService = new SecurityMonitoringService();
  }
  return securityMonitoringService;
}

