import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { getEncryptionService, EncryptionService } from '../utils/encryption';
import { MFA_CONSTANTS } from '../constants/mfa';

export interface TOTPSecret {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface TOTPVerificationResult {
  valid: boolean;
  delta?: number; // Time step difference
}

/**
 * TOTP (Time-based One-Time Password) service
 * Handles TOTP secret generation, QR code creation, token verification, and backup code management
 */
export class TOTPService {
  private encryptionService: EncryptionService;
  private issuer: string;

  constructor() {
    this.encryptionService = getEncryptionService();
    this.issuer = process.env.MFA_ISSUER_NAME || 'LogGenCore';
  }

  /**
   * Generate a new TOTP secret for a user
   * Returns the plain secret (to be shown once) and QR code URL
   * The secret should be encrypted before storing in database
   * @param userEmail - The user's email address
   * @param userName - The user's full name
   * @returns TOTP secret, QR code data URL, and array of backup codes
   */
  async generateSecret(userEmail: string, userName: string): Promise<TOTPSecret> {
    const secret = speakeasy.generateSecret({
      name: `${this.issuer} (${userEmail})`,
      length: 32,
    });

    // Generate QR code URL
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url || '');

    // Generate backup codes
    const backupCodes = this.generateBackupCodes(MFA_CONSTANTS.BACKUP_CODES_COUNT);

    return {
      secret: secret.base32 || '',
      qrCodeUrl,
      backupCodes,
    };
  }

  /**
   * Encrypt TOTP secret before storing in database
   * @param secret - The plain text TOTP secret
   * @returns The encrypted secret string
   */
  encryptSecret(secret: string): string {
    return this.encryptionService.encrypt(secret);
  }

  /**
   * Decrypt TOTP secret from database
   * @param encryptedSecret - The encrypted secret string
   * @returns The decrypted plain text secret
   * @throws Error if decryption fails
   */
  decryptSecret(encryptedSecret: string): string {
    return this.encryptionService.decrypt(encryptedSecret);
  }

  /**
   * Encrypt backup codes before storing in database
   * @param backupCodes - Array of plain text backup codes
   * @returns The encrypted backup codes as a JSON string
   */
  encryptBackupCodes(backupCodes: string[]): string {
    const codesJson = JSON.stringify(backupCodes);
    return this.encryptionService.encrypt(codesJson);
  }

  /**
   * Decrypt backup codes from database
   * @param encryptedCodes - The encrypted backup codes string
   * @returns Array of decrypted backup codes
   * @throws Error if decryption or JSON parsing fails
   */
  decryptBackupCodes(encryptedCodes: string): string[] {
    const codesJson = this.encryptionService.decrypt(encryptedCodes);
    return JSON.parse(codesJson);
  }

  /**
   * Verify a TOTP token against an encrypted secret
   * @param encryptedSecret - The encrypted TOTP secret from database
   * @param token - The 6-digit TOTP token to verify
   * @param window - Time step window for clock skew tolerance (default: 2)
   * @returns Verification result with validity and optional time step delta
   */
  verifyToken(encryptedSecret: string, token: string, window: number = 2): TOTPVerificationResult {
    try {
      const secret = this.decryptSecret(encryptedSecret);
      
      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window, // Allow tokens from previous/next time steps (configured in MFA_CONSTANTS)
      });

      return {
        valid: verified !== false,
        delta: typeof verified === 'number' ? verified : undefined,
      };
    } catch (error) {
      return { valid: false };
    }
  }

  /**
   * Verify a TOTP token against a plain secret (for setup verification)
   * Used during MFA setup before the secret is stored in the database
   * @param secret - The plain text TOTP secret
   * @param token - The 6-digit TOTP token to verify
   * @param window - Time step window for clock skew tolerance (default: 2)
   * @returns Verification result with validity and optional time step delta
   */
  verifyTokenPlain(secret: string, token: string, window: number = 2): TOTPVerificationResult {
    try {
      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window, // Allow tokens from previous/next time steps (configured in MFA_CONSTANTS)
      });

      return {
        valid: verified !== false,
        delta: typeof verified === 'number' ? verified : undefined,
      };
    } catch (error) {
      return { valid: false };
    }
  }

  /**
   * Verify a backup code and remove it if valid (from encrypted backup codes)
   * @param encryptedBackupCodes - The encrypted backup codes string from database
   * @param code - The backup code to verify
   * @returns Object with validity status and array of remaining backup codes
   */
  verifyBackupCode(encryptedBackupCodes: string, code: string): { valid: boolean; remainingCodes: string[] } {
    try {
      const backupCodes = this.decryptBackupCodes(encryptedBackupCodes);
      const index = backupCodes.indexOf(code.toUpperCase());

      if (index === -1) {
        return { valid: false, remainingCodes: backupCodes };
      }

      // Remove used backup code
      const remainingCodes = backupCodes.filter((_, i) => i !== index);
      return { valid: true, remainingCodes };
    } catch (error) {
      return { valid: false, remainingCodes: [] };
    }
  }

  /**
   * Verify a backup code and remove it if valid (from plain backup codes array)
   * Used during MFA setup before backup codes are stored in the database
   * @param backupCodes - Array of plain text backup codes
   * @param code - The backup code to verify
   * @returns Object with validity status and array of remaining backup codes
   */
  verifyBackupCodePlain(backupCodes: string[], code: string): { valid: boolean; remainingCodes: string[] } {
    try {
      const index = backupCodes.indexOf(code.toUpperCase());

      if (index === -1) {
        return { valid: false, remainingCodes: backupCodes };
      }

      // Remove used backup code
      const remainingCodes = backupCodes.filter((_, i) => i !== index);
      return { valid: true, remainingCodes };
    } catch (error) {
      return { valid: false, remainingCodes: [] };
    }
  }

  /**
   * Generate backup codes
   */
  private generateBackupCodes(count: number): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate alphanumeric code with configured length
      const code = Math.random().toString(36).substring(2, 2 + MFA_CONSTANTS.BACKUP_CODE_LENGTH).toUpperCase();
      codes.push(code);
    }
    return codes;
  }
}

