import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { SecurityEvent, SecurityEventSeverity } from './SecurityMonitoringService';
import { SECURITY_CONSTANTS } from '../constants/security';
import { config } from '../config/config';

/**
 * Slack Alert Service
 * Sends security alerts to Slack via webhook
 */
export class SlackAlertService {
  private webhookUrl: string | null;
  private enabled: boolean;
  private axiosInstance: AxiosInstance;

  constructor() {
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL || null;
    this.enabled = !!this.webhookUrl;

    if (this.enabled) {
      logger.info('Slack alerting enabled', { webhookUrl: this.maskWebhookUrl(this.webhookUrl!) });
    } else {
      logger.info('Slack alerting disabled - SLACK_WEBHOOK_URL not configured');
    }
  }

  /**
   * Check if Slack alerting is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Check if webhook URL is a Slack workflow (triggers URL)
   */
  private isWorkflowUrl(): boolean {
    return this.webhookUrl?.includes('/triggers/') || false;
  }

  /**
   * Build payload for Slack workflow with Block Kit formatting
   * Creates beautiful, rich formatted messages using Slack Block Kit
   */
  private buildWorkflowPayload(event: SecurityEvent): any {
    const color = this.getSeverityColor(event.severity);
    const emoji = this.getSeverityEmoji(event.severity);
    
    // Build Block Kit blocks for rich formatting
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} Security Alert: ${event.type}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${event.message}*`,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Severity:*\n${this.getSeverityBadge(event.severity)}`,
          },
          {
            type: 'mrkdwn',
            text: `*Event Type:*\n\`${event.type}\``,
          },
        ],
      },
    ];

    // Add metadata fields if available
    const metadataFields: any[] = [];
    
    if (event.metadata?.subdomain) {
      metadataFields.push({
        type: 'mrkdwn',
        text: `*Subdomain:*\n\`${event.metadata.subdomain}\``,
      });
    }
    
    if (event.metadata?.clientId) {
      metadataFields.push({
        type: 'mrkdwn',
        text: `*Client ID:*\n\`${event.metadata.clientId.substring(0, 12)}...\``,
      });
    }
    
    if (event.metadata?.userId) {
      metadataFields.push({
        type: 'mrkdwn',
        text: `*User ID:*\n\`${event.metadata.userId.substring(0, 12)}...\``,
      });
    }
    
    if (event.metadata?.ip) {
      metadataFields.push({
        type: 'mrkdwn',
        text: `*IP Address:*\n\`${event.metadata.ip}\``,
      });
    }
    
    if (event.metadata?.path) {
      metadataFields.push({
        type: 'mrkdwn',
        text: `*Path:*\n\`${event.metadata.method || 'GET'} ${event.metadata.path}\``,
      });
    }

    // Add metadata fields in pairs
    if (metadataFields.length > 0) {
      blocks.push({
        type: 'section',
        fields: metadataFields.slice(0, 2),
      });
      
      if (metadataFields.length > 2) {
        blocks.push({
          type: 'section',
          fields: metadataFields.slice(2, 4),
        });
      }
      
      if (metadataFields.length > 4) {
        blocks.push({
          type: 'section',
          fields: metadataFields.slice(4),
        });
      }
    }

    // Add timestamp
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `🕐 ${event.timestamp.toLocaleString('en-US', {
            timeZone: 'UTC',
            dateStyle: 'medium',
            timeStyle: 'short',
          })} UTC`,
        },
      ],
    } as any);

    // Return both Block Kit format and plain variables for workflow flexibility
    return {
      // Block Kit format for rich display
      blocks: JSON.stringify(blocks),
      // Plain variables for workflow logic
      event_type: event.type,
      severity: event.severity.toUpperCase(),
      message: event.message,
      subdomain: event.metadata?.subdomain || 'N/A',
      client_id: event.metadata?.clientId ? event.metadata.clientId.substring(0, 8) + '...' : 'N/A',
      user_id: event.metadata?.userId ? event.metadata.userId.substring(0, 8) + '...' : 'N/A',
      ip_address: event.metadata?.ip || 'N/A',
      path: event.metadata?.path || 'N/A',
      method: event.metadata?.method || 'N/A',
      user_agent: event.metadata?.userAgent || 'N/A',
      timestamp: event.timestamp.toISOString(),
      color: color,
      emoji: emoji,
      // Include all metadata as JSON string for flexibility
      metadata: JSON.stringify(event.metadata || {}),
    };
  }

  /**
   * Get severity badge with emoji
   */
  private getSeverityBadge(severity: SecurityEventSeverity): string {
    const badges: Record<SecurityEventSeverity, string> = {
      critical: '🔴 *CRITICAL*',
      high: '🟠 *HIGH*',
      medium: '🟡 *MEDIUM*',
      low: '🟢 *LOW*',
    };
    return badges[severity] || severity.toUpperCase();
  }

  /**
   * Build payload for Slack incoming webhook with Block Kit formatting
   * Uses both legacy attachments (for compatibility) and Block Kit (for rich formatting)
   */
  private buildWebhookPayload(event: SecurityEvent): any {
    const color = this.getSeverityColor(event.severity);
    const emoji = this.getSeverityEmoji(event.severity);
    
    // Build Block Kit blocks for rich formatting
    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} Security Alert: ${event.type}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${event.message}*`,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Severity:*\n${this.getSeverityBadge(event.severity)}`,
          },
          {
            type: 'mrkdwn',
            text: `*Event Type:*\n\`${event.type}\``,
          },
        ],
      },
    ];

    // Add metadata fields if available
    const metadataFields: any[] = [];
    
    if (event.metadata?.subdomain) {
      metadataFields.push({
        type: 'mrkdwn',
        text: `*Subdomain:*\n\`${event.metadata.subdomain}\``,
      });
    }
    
    if (event.metadata?.clientId) {
      metadataFields.push({
        type: 'mrkdwn',
        text: `*Client ID:*\n\`${event.metadata.clientId.substring(0, 12)}...\``,
      });
    }
    
    if (event.metadata?.userId) {
      metadataFields.push({
        type: 'mrkdwn',
        text: `*User ID:*\n\`${event.metadata.userId.substring(0, 12)}...\``,
      });
    }
    
    if (event.metadata?.ip) {
      metadataFields.push({
        type: 'mrkdwn',
        text: `*IP Address:*\n\`${event.metadata.ip}\``,
      });
    }
    
    if (event.metadata?.path) {
      metadataFields.push({
        type: 'mrkdwn',
        text: `*Path:*\n\`${event.metadata.method || 'GET'} ${event.metadata.path}\``,
      });
    }

    // Add metadata fields in pairs
    if (metadataFields.length > 0) {
      blocks.push({
        type: 'section',
        fields: metadataFields.slice(0, 2),
      });
      
      if (metadataFields.length > 2) {
        blocks.push({
          type: 'section',
          fields: metadataFields.slice(2, 4),
        });
      }
      
      if (metadataFields.length > 4) {
        blocks.push({
          type: 'section',
          fields: metadataFields.slice(4),
        });
      }
    }

    // Add timestamp
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `🕐 ${event.timestamp.toLocaleString('en-US', {
            timeZone: 'UTC',
            dateStyle: 'medium',
            timeStyle: 'short',
          })} UTC | Multi-Tenant API Security Monitoring`,
        },
      ],
    } as any);

    // Return both Block Kit (for modern Slack) and legacy attachments (for compatibility)
    return {
      text: `${emoji} Security Alert: ${event.type}`, // Fallback text
      blocks, // Block Kit for rich formatting
      attachments: [
        {
          color,
          title: `${emoji} ${event.type}`,
          text: event.message,
          footer: 'Multi-Tenant API Security Monitoring',
          ts: Math.floor(event.timestamp.getTime() / 1000),
        },
      ],
    };
  }

  /**
   * Send security alert to Slack
   */
  async sendSecurityAlert(event: SecurityEvent): Promise<void> {
    if (!this.enabled || !this.webhookUrl) {
      logger.warn('Slack alert not sent - service disabled or webhook URL missing', {
        enabled: this.enabled,
        hasWebhookUrl: !!this.webhookUrl,
      });
      return;
    }

    const isWorkflow = this.isWorkflowUrl();
    logger.info('Sending Slack alert', {
      eventType: event.type,
      severity: event.severity,
      webhookUrl: this.maskWebhookUrl(this.webhookUrl),
      isWorkflow,
    });

    try {
      // Use different payload format for workflows vs webhooks
      const payload = isWorkflow 
        ? this.buildWorkflowPayload(event)
        : this.buildWebhookPayload(event);

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(config.timeouts.slackTimeoutMs),
      });

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(`Slack API returned ${response.status}: ${response.statusText}. Response: ${responseText}`);
      }
      
      logger.debug('Slack alert sent successfully', {
        eventType: event.type,
        severity: event.severity,
        isWorkflow,
      });
    } catch (error: any) {
      // Don't throw - alerting failures shouldn't break the app
      logger.error('Failed to send Slack alert', {
        error: error.message,
        eventType: event.type,
        severity: event.severity,
        isWorkflow,
      });
    }
  }

  /**
   * Build Slack message fields from event metadata
   */
  private buildFields(event: SecurityEvent): Array<{ title: string; value: string; short: boolean }> {
    const fields: Array<{ title: string; value: string; short: boolean }> = [];

    // Severity
    fields.push({
      title: 'Severity',
      value: event.severity.toUpperCase(),
      short: true,
    });

    // Subdomain (if available)
    if (event.metadata?.subdomain) {
      fields.push({
        title: 'Subdomain',
        value: event.metadata.subdomain,
        short: true,
      });
    }

    // Client ID (if available)
    if (event.metadata?.clientId) {
      fields.push({
        title: 'Client ID',
        value: event.metadata.clientId.substring(0, 8) + '...', // Truncate for privacy
        short: true,
      });
    }

    // User ID (if available)
    if (event.metadata?.userId) {
      fields.push({
        title: 'User ID',
        value: event.metadata.userId.substring(0, 8) + '...', // Truncate for privacy
        short: true,
      });
    }

    // IP Address
    if (event.metadata?.ip) {
      fields.push({
        title: 'IP Address',
        value: event.metadata.ip,
        short: true,
      });
    }

    // Path (if available)
    if (event.metadata?.path) {
      fields.push({
        title: 'Path',
        value: event.metadata.path,
        short: true,
      });
    }

    // Method (if available)
    if (event.metadata?.method) {
      fields.push({
        title: 'Method',
        value: event.metadata.method,
        short: true,
      });
    }

    // Additional metadata (non-sensitive)
    const additionalFields = Object.keys(event.metadata || {})
      .filter(key => !['userId', 'clientId', 'subdomain', 'ip', 'path', 'method', 'email', 'password', 'token', 'apiKey'].includes(key))
      .slice(0, 5); // Limit to 5 additional fields

    additionalFields.forEach(key => {
      const value = event.metadata![key];
      if (value !== undefined && value !== null) {
        fields.push({
          title: this.formatFieldName(key),
          value: String(value).substring(0, SECURITY_CONSTANTS.MAX_SLACK_VALUE_LENGTH), // Limit length
          short: true,
        });
      }
    });

    // Timestamp
    fields.push({
      title: 'Time',
      value: event.timestamp.toISOString(),
      short: false,
    });

    return fields;
  }

  /**
   * Get color for severity level
   */
  private getSeverityColor(severity: SecurityEventSeverity): string {
    const colors: Record<SecurityEventSeverity, string> = {
      low: '#36a64f',      // Green
      medium: '#ffaa00',   // Orange
      high: '#ff8800',    // Dark Orange
      critical: '#ff0000', // Red
    };
    return colors[severity] || '#808080'; // Default gray
  }

  /**
   * Get emoji for severity level
   */
  private getSeverityEmoji(severity: SecurityEventSeverity): string {
    const emojis: Record<SecurityEventSeverity, string> = {
      low: 'ℹ️',
      medium: '⚠️',
      high: '🔴',
      critical: '🚨',
    };
    return emojis[severity] || '📢';
  }

  /**
   * Format field name for display
   */
  private formatFieldName(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Mask webhook URL for logging (security)
   */
  private maskWebhookUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart.length > 8) {
          pathParts[pathParts.length - 1] = lastPart.substring(0, 4) + '***' + lastPart.substring(lastPart.length - 4);
        }
      }
      urlObj.pathname = pathParts.join('/');
      return urlObj.toString();
    } catch {
      return '***';
    }
  }
}

// Singleton instance
let slackAlertService: SlackAlertService | null = null;

export function getSlackAlertService(): SlackAlertService {
  if (!slackAlertService) {
    slackAlertService = new SlackAlertService();
  }
  return slackAlertService;
}

