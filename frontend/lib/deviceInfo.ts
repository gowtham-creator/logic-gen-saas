/**
 * Device information utilities
 * Captures device information for device tracking
 */

export interface DeviceInfo {
  clientDeviceId: string;
  screenWidth: number;
  screenHeight: number;
  timezone: string;
  colorDepth: number;
  hardwareConcurrency: number;
  platform: string;
  language: string;
  canvasFingerprint?: string;
  webglFingerprint?: string;
}

/**
 * Generate a UUID v4 (fallback for browsers that don't support crypto.randomUUID)
 */
function generateUUID(): string {
  // Try to use crypto.randomUUID if available (Chrome 92+, Firefox 95+, Safari 15.4+)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (error) {
      // Fall through to fallback implementation
    }
  }

  // Fallback: Generate UUID v4 manually
  // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get or create a persistent device ID
 * This ID is stored in localStorage and persists across sessions
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return '';

  let deviceId = localStorage.getItem('deviceId');

  if (!deviceId) {
    // Generate unique ID on first visit
    deviceId = generateUUID();
    localStorage.setItem('deviceId', deviceId);
    // Also store in sessionStorage as backup
    sessionStorage.setItem('deviceId', deviceId);
  }

  return deviceId;
}

/**
 * Generate canvas fingerprint for additional uniqueness
 */
export function generateCanvasFingerprint(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    canvas.width = 200;
    canvas.height = 50;
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Device fingerprint 🎨', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Device fingerprint 🎨', 4, 17);

    return canvas.toDataURL();
  } catch (error) {
    console.warn('Failed to generate canvas fingerprint:', error);
    return undefined;
  }
}

/**
 * Generate WebGL fingerprint for additional uniqueness
 */
export function generateWebGLFingerprint(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) return undefined;

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return undefined;

    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);

    return `${vendor}|${renderer}`;
  } catch (error) {
    console.warn('Failed to generate WebGL fingerprint:', error);
    return undefined;
  }
}

/**
 * Collect all device information
 * This should be called before login to send device info to the backend
 */
export function collectDeviceInfo(): DeviceInfo {
  const deviceId = getOrCreateDeviceId();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return {
    clientDeviceId: deviceId,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    timezone,
    colorDepth: window.screen.colorDepth,
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    platform: navigator.platform || 'Unknown',
    language: navigator.language || 'en',
    canvasFingerprint: generateCanvasFingerprint(),
    webglFingerprint: generateWebGLFingerprint(),
  };
}

