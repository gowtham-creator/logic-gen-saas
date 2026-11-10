import crypto from 'crypto';
import { Request } from 'express';

export interface ClientDeviceInfo {
  clientDeviceId?: string;
  screenWidth?: number;
  screenHeight?: number;
  timezone?: string;
  colorDepth?: number;
  hardwareConcurrency?: number;
  platform?: string;
  language?: string;
  canvasFingerprint?: string;
  webglFingerprint?: string;
}

/**
 * Normalize user agent to extract browser and OS information
 */
export function normalizeUserAgent(userAgent: string | undefined): string {
  if (!userAgent) return 'Unknown|Unknown';

  // Extract browser name and major version
  const browserMatch = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera|Brave)\/(\d+)/);
  const browser = browserMatch?.[1] || 'Unknown';
  const browserVersion = browserMatch?.[2] || '0';

  // Extract OS
  let os = 'Unknown';
  if (userAgent.includes('Windows')) {
    os = 'Windows';
  } else if (userAgent.includes('Mac OS X') || userAgent.includes('Macintosh')) {
    os = 'macOS';
  } else if (userAgent.includes('Linux')) {
    os = 'Linux';
  } else if (userAgent.includes('Android')) {
    os = 'Android';
  } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    os = 'iOS';
  }

  return `${browser}/${browserVersion}|${os}`;
}

/**
 * Extract browser name from user agent
 */
export function extractBrowser(userAgent: string | undefined): string {
  if (!userAgent) return 'Unknown';

  const browserMatch = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera|Brave)\/(\d+)/);
  return browserMatch?.[1] || 'Unknown';
}

/**
 * Extract OS from user agent
 */
export function extractOS(userAgent: string | undefined): string {
  if (!userAgent) return 'Unknown';

  if (userAgent.includes('Windows')) {
    return 'Windows';
  } else if (userAgent.includes('Mac OS X') || userAgent.includes('Macintosh')) {
    return 'macOS';
  } else if (userAgent.includes('Linux')) {
    return 'Linux';
  } else if (userAgent.includes('Android')) {
    return 'Android';
  } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    return 'iOS';
  }

  return 'Unknown';
}

/**
 * Detect device type from user agent and screen size
 */
export function detectDeviceType(deviceInfo: ClientDeviceInfo, userAgent?: string): string {
  if (userAgent) {
    if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
      return 'mobile';
    }
    if (userAgent.includes('iPad') || userAgent.includes('Tablet')) {
      return 'tablet';
    }
  }

  // Use screen size as fallback
  if (deviceInfo.screenWidth && deviceInfo.screenHeight) {
    const width = deviceInfo.screenWidth;
    const height = deviceInfo.screenHeight;
    const minDimension = Math.min(width, height);

    if (minDimension < 600) {
      return 'mobile';
    } else if (minDimension < 1024) {
      return 'tablet';
    }
  }

  return 'desktop';
}

/**
 * Generate device name from browser and OS
 */
export function generateDeviceName(userAgent: string | undefined, deviceInfo: ClientDeviceInfo): string {
  const browser = extractBrowser(userAgent);
  const os = extractOS(userAgent);
  const deviceType = detectDeviceType(deviceInfo, userAgent);

  return `${browser} on ${os} (${deviceType})`;
}

/**
 * Generate device fingerprint from request and device info
 * This creates a unique identifier for the device
 */
export function generateDeviceFingerprint(
  req: Request,
  deviceInfo: ClientDeviceInfo
): string {
  const userAgent = req.get('user-agent') || '';
  const acceptLanguage = req.get('accept-language')?.split(',')[0] || 'unknown';

  const fingerprintComponents = [
    // Primary: Persistent device ID (if available)
    deviceInfo.clientDeviceId || 'unknown',
    
    // Secondary: Hardware/software characteristics
    normalizeUserAgent(userAgent),
    deviceInfo.platform || 'unknown',
    acceptLanguage,
    deviceInfo.timezone || 'unknown',
    deviceInfo.screenWidth && deviceInfo.screenHeight
      ? `${deviceInfo.screenWidth}x${deviceInfo.screenHeight}`
      : 'unknown',
    deviceInfo.colorDepth?.toString() || 'unknown',
    deviceInfo.hardwareConcurrency?.toString() || 'unknown',
    
    // Tertiary: Additional unique identifiers (if available)
    deviceInfo.canvasFingerprint || '',
    deviceInfo.webglFingerprint || '',
  ].filter(Boolean).join('|');

  // Generate SHA-256 hash
  return crypto
    .createHash('sha256')
    .update(fingerprintComponents)
    .digest('hex');
}

/**
 * Calculate similarity between two fingerprints
 * Returns a value between 0 and 1 (1 = identical, 0 = completely different)
 */
export function calculateFingerprintSimilarity(
  fingerprint1: string,
  fingerprint2: string
): number {
  // For now, we'll do exact match
  // In the future, we could parse and compare components
  if (fingerprint1 === fingerprint2) {
    return 1.0;
  }

  // If fingerprints are different, we could implement fuzzy matching
  // by parsing the components and comparing them individually
  // For now, return 0 for different fingerprints
  return 0;
}

/**
 * Check if user agent change is just a version update
 */
export function checkVersionUpdate(ua1: string, ua2: string): boolean {
  const regex = /(\w+)\/(\d+)/;
  const match1 = ua1.match(regex);
  const match2 = ua2.match(regex);

  if (match1 && match2 && match1[1] === match2[1]) {
    const version1 = parseInt(match1[2]);
    const version2 = parseInt(match2[2]);
    // Consider it same device if version difference is small (1-2 versions)
    return Math.abs(version1 - version2) <= 2;
  }

  return false;
}

