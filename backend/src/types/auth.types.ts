/**
 * Authentication-related types
 */

import { ClientDeviceInfo } from '../utils/deviceFingerprint';

export interface LoginDto {
  email: string;
  password: string;
  clientId: string;
  deviceInfo?: ClientDeviceInfo; // Optional device information for tracking
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

