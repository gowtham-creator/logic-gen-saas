/**
 * Middleware-related types
 */

import { Request } from 'express';
import { DataSource } from 'typeorm';
import { Client } from '../entities/Client';
import { User } from '../entities/User';
import { SuperAdmin } from '../entities/SuperAdmin';

export interface TenantRequest extends Request {
  tenant?: Client;
  clientId?: string;
  tenantDataSource?: DataSource; // DataSource for tenant-specific database/schema
}

export interface AuthenticatedRequest extends TenantRequest {
  user?: User;
  userId?: string;
}

export interface SuperAdminAuthenticatedRequest extends Request {
  superAdmin?: SuperAdmin;
  adminId?: string;
}

export interface JWTPayload {
  userId: string;
  clientId: string;
  email: string;
}

export interface SuperAdminJWTPayload {
  adminId: string;
  email: string;
  type: 'super_admin';
}

export interface EndpointRateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum number of requests
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

