import { UserDevice } from '../entities/UserDevice';
import { User } from '../entities/User';
import { logger } from '../utils/logger';
import * as nodemailer from 'nodemailer';
import { SECURITY_CONSTANTS } from '../constants/security';
export interface EmailConfig {
  enabled: boolean;
  fromEmail?: string;
  fromName?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpSecure?: boolean;
}

export class EmailService {
  private config: EmailConfig;

  constructor(config?: Partial<EmailConfig>) {
    this.config = {
      enabled: config?.enabled ?? process.env.EMAIL_ENABLED === 'true',
      fromEmail: config?.fromEmail ?? (process.env.EMAIL_FROM || 'noreply@example.com'),
      fromName: config?.fromName ?? (process.env.EMAIL_FROM_NAME || 'Security Team'),
      smtpHost: config?.smtpHost ?? process.env.SMTP_HOST,
      smtpPort: config?.smtpPort ?? parseInt(process.env.SMTP_PORT || '587'),
      smtpUser: config?.smtpUser ?? process.env.SMTP_USER,
      smtpPassword: config?.smtpPassword ?? process.env.SMTP_PASSWORD,
      smtpSecure: config?.smtpSecure ?? process.env.SMTP_SECURE === 'true',
    };
  }

  /**
   * Check if email service is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled && !!this.config.smtpHost;
  }

  /**
   * Send device change notification email
   */
  async sendDeviceChangeNotification(
    user: User,
    device: UserDevice
  ): Promise<void> {
    if (!this.isEnabled()) {
      logger.debug('Email service disabled, skipping device change notification', {
        userId: user.id,
        deviceId: device.id,
      });
      return;
    }

    try {
      const subject = 'New Device Login Detected';
      const html = this.generateDeviceChangeEmailHTML(user, device);
      const text = this.generateDeviceChangeEmailText(user, device);

      await this.sendEmail({
        to: user.email,
        subject,
        html,
        text,
      });

      logger.info('Device change notification email sent', {
        userId: user.id,
        deviceId: device.id,
        email: user.email,
      });
    } catch (error: any) {
      // Don't throw - email failures shouldn't break login
      logger.error('Failed to send device change notification email', {
        error: error.message,
        userId: user.id,
        deviceId: device.id,
      });
    }
  }

  /**
   * Send device revoked notification email
   */
  async sendDeviceRevokedNotification(
    user: User,
    device: UserDevice
  ): Promise<void> {
    if (!this.isEnabled()) {
      logger.debug('Email service disabled, skipping device revoked notification', {
        userId: user.id,
        deviceId: device.id,
      });
      return;
    }

    try {
      const subject = 'Device Access Revoked';
      const html = this.generateDeviceRevokedEmailHTML(user, device);
      const text = this.generateDeviceRevokedEmailText(user, device);

      await this.sendEmail({
        to: user.email,
        subject,
        html,
        text,
      });

      logger.info('Device revoked notification email sent', {
        userId: user.id,
        deviceId: device.id,
        email: user.email,
      });
    } catch (error: any) {
      logger.error('Failed to send device revoked notification email', {
        error: error.message,
        userId: user.id,
        deviceId: device.id,
      });
    }
  }

  /**
   * Send email using configured SMTP or email service
   */
  private async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void> {
    // For now, we'll use nodemailer if available, or log the email
    // In production, you should configure nodemailer or your email service

    if (this.config.smtpHost && this.config.smtpUser && this.config.smtpPassword) {
      // Try to use nodemailer if available
      try {
        
        
        const transporter = nodemailer.createTransport({
          host: this.config.smtpHost,
          port: this.config.smtpPort,
          secure: this.config.smtpSecure,
          auth: {
            user: this.config.smtpUser,
            pass: this.config.smtpPassword,
          },
        });

        await transporter.sendMail({
          from: `"${this.config.fromName}" <${this.config.fromEmail}>`,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        });
      } catch (error: any) {
        logger.error('Failed to send email via nodemailer', {
          error: error.message,
          smtpHost: this.config.smtpHost,
        });
        // Fall through to logging
      }
    } else {
      // Log email content for development/testing
      logger.info('Email would be sent (SMTP not configured)', {
        to: options.to,
        subject: options.subject,
        html: options.html.substring(0, SECURITY_CONSTANTS.MAX_HTML_PREVIEW_LENGTH) + '...',
      });
    }
  }

  /**
   * Generate HTML email for device change notification
   */
  private generateDeviceChangeEmailHTML(user: User, device: UserDevice): string {
    const appUrl = process.env.APP_URL || 'https://app.example.com';
    const deviceInfo = `
      <tr>
        <td style="padding: 8px 0;"><strong>Device Name:</strong></td>
        <td style="padding: 8px 0;">${device.deviceName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0;"><strong>Device Type:</strong></td>
        <td style="padding: 8px 0;">${device.deviceType}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0;"><strong>Browser:</strong></td>
        <td style="padding: 8px 0;">${device.browser}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0;"><strong>Operating System:</strong></td>
        <td style="padding: 8px 0;">${device.os}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0;"><strong>IP Address:</strong></td>
        <td style="padding: 8px 0;">${device.ipAddress || 'Unknown'}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0;"><strong>Time:</strong></td>
        <td style="padding: 8px 0;">${new Date(device.lastSeenAt).toLocaleString()}</td>
      </tr>
    `;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #d32f2f;">New Device Login Detected</h2>
          <p>Hello ${user.firstName},</p>
          <p>We detected a login to your account from a new device:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            ${deviceInfo}
          </table>
          <p style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
            <strong>⚠️ Security Notice:</strong> If you don't recognize this device, please change your password immediately and review your account security settings.
          </p>
          <p>
            <a href="${appUrl}/settings/devices" style="display: inline-block; padding: 10px 20px; background-color: #1976d2; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px;">
              Manage Devices
            </a>
          </p>
          <p style="margin-top: 30px; font-size: 12px; color: #666;">
            This is an automated security notification. If you have any concerns, please contact support immediately.
          </p>
        </body>
      </html>
    `;
  }

  /**
   * Generate plain text email for device change notification
   */
  private generateDeviceChangeEmailText(user: User, device: UserDevice): string {
    return `
New Device Login Detected

Hello ${user.firstName},

We detected a login to your account from a new device:

Device Name: ${device.deviceName}
Device Type: ${device.deviceType}
Browser: ${device.browser}
Operating System: ${device.os}
IP Address: ${device.ipAddress || 'Unknown'}
Time: ${new Date(device.lastSeenAt).toLocaleString()}

⚠️ Security Notice: If you don't recognize this device, please change your password immediately and review your account security settings.

Manage your devices: ${process.env.APP_URL || 'https://app.example.com'}/settings/devices

This is an automated security notification. If you have any concerns, please contact support immediately.
    `.trim();
  }

  /**
   * Generate HTML email for device revoked notification
   */
  private generateDeviceRevokedEmailHTML(user: User, device: UserDevice): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1976d2;">Device Access Revoked</h2>
          <p>Hello ${user.firstName},</p>
          <p>Access has been revoked for the following device:</p>
          <ul>
            <li><strong>Device:</strong> ${device.deviceName}</li>
            <li><strong>Browser:</strong> ${device.browser}</li>
            <li><strong>OS:</strong> ${device.os}</li>
            <li><strong>Last Seen:</strong> ${new Date(device.lastSeenAt).toLocaleString()}</li>
          </ul>
          <p>If you revoked this device, no further action is needed. If you didn't revoke this device, please contact support immediately.</p>
        </body>
      </html>
    `;
  }

  /**
   * Generate plain text email for device revoked notification
   */
  private generateDeviceRevokedEmailText(user: User, device: UserDevice): string {
    return `
Device Access Revoked

Hello ${user.firstName},

Access has been revoked for the following device:

Device: ${device.deviceName}
Browser: ${device.browser}
OS: ${device.os}
Last Seen: ${new Date(device.lastSeenAt).toLocaleString()}

If you revoked this device, no further action is needed. If you didn't revoke this device, please contact support immediately.
    `.trim();
  }
}

// Singleton instance
let emailServiceInstance: EmailService | null = null;

export function getEmailService(): EmailService {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService();
  }
  return emailServiceInstance;
}

