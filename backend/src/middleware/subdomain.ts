import { Response, NextFunction } from 'express';
import { AppDataSource } from '../config/database';
import { Client } from '../entities/Client';
import { TenantRequest } from '../types/middleware.types';
import { config } from '../config/config';
import { logger } from '../utils/logger';

// Re-export for backward compatibility
export { TenantRequest };

/**
 * Middleware to extract tenant from subdomain
 * Supports: client1.myapp.com, admin.myapp.com, localhost:3000 (for dev)
 * 
 * For localhost, can use:
 * - Query parameter: ?clientId=<uuid> or ?subdomain=<subdomain>
 * - Header: X-Client-Id or X-Client-Subdomain
 * - Config: DEFAULT_CLIENT_ID or DEFAULT_CLIENT_SUBDOMAIN
 */
export async function subdomainMiddleware(
  req: TenantRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const host = req.get('host') || '';
    
    // Validate host header to prevent injection
    if (!host || host.length > 253) { // Max hostname length per RFC
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_HOST', message: 'Invalid host header' },
      });
      return;
    }

    const hostWithoutPort = host.split(':')[0];
    const isLocalhost = hostWithoutPort === 'localhost' || hostWithoutPort === '127.0.0.1' || hostWithoutPort.includes('.localhost');
    
    logger.debug('Subdomain middleware processing', { host, hostWithoutPort, isLocalhost });

    // FIRST: Try to extract subdomain from host
    const subdomain = extractSubdomain(host);
    logger.debug('Subdomain extracted', { subdomain, host });

    // Check for client override via query parameter or header (for localhost only)
    let clientIdOverride: string | undefined;
    let subdomainOverride: string | undefined;
    
    if (isLocalhost) {
      // Check query parameters first
      clientIdOverride = req.query.clientId as string | undefined;
      subdomainOverride = req.query.subdomain as string | undefined;
      
      logger.debug('Checking query parameters for client override', { clientId: clientIdOverride, subdomain: subdomainOverride });
      
      // Check headers if query params not provided
      if (!clientIdOverride && !subdomainOverride) {
        clientIdOverride = req.get('X-Client-Id') || undefined;
        subdomainOverride = req.get('X-Client-Subdomain') || undefined;
        logger.debug('Checking headers for client override', { clientId: clientIdOverride, subdomain: subdomainOverride });
      }
      
      // Use config defaults ONLY if no subdomain was extracted AND no override provided
      // IMPORTANT: If subdomain is extracted from host (e.g., testtenant.localhost), use it!
      if (!subdomain && !clientIdOverride && !subdomainOverride) {
        clientIdOverride = config.defaultClient.id;
        subdomainOverride = config.defaultClient.subdomain;
        logger.debug('Using config defaults', { clientId: clientIdOverride, subdomain: subdomainOverride });
      }
    }

    // In development, allow fallback to configured default or 'admin' only for localhost
    // In production, require explicit subdomain and validate against database
    let finalSubdomain = subdomain;
    if (!finalSubdomain) {
      // Only allow fallback for localhost in development
      if (isLocalhost && config.nodeEnv === 'development') {
        // Use override subdomain if provided
        if (subdomainOverride) {
          finalSubdomain = subdomainOverride;
        } else {
          // Fallback to 'admin' only in development
          finalSubdomain = 'admin';
        }
      } else {
        // In production, never allow fallback
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_SUBDOMAIN', message: 'Invalid or missing subdomain' },
        });
        return;
      }
    }
    
    logger.debug('Final subdomain determined', { finalSubdomain });

    // If clientId override is provided (for localhost), use it directly
    if (isLocalhost && clientIdOverride) {
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(clientIdOverride)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_CLIENT_ID', message: 'Invalid client ID format' },
        });
        return;
      }

      const clientRepository = AppDataSource.getRepository(Client);
      const client = await clientRepository.findOne({
        where: { id: clientIdOverride, isActive: true },
      });

      if (!client) {
        res.status(404).json({
          success: false,
          error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found with provided client ID' },
        });
        return;
      }

      req.tenant = client;
      req.clientId = client.id;
      return next();
    }

    // Validate subdomain format one more time before database lookup
    if (!/^[a-zA-Z0-9-]{1,63}$/.test(finalSubdomain)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_SUBDOMAIN', message: 'Invalid subdomain format' },
      });
      return;
    }

    // Validate subdomain against database whitelist (security: prevent host header injection)
    // This ensures only registered subdomains can be used
    const clientRepository = AppDataSource.getRepository(Client);
    const client = await clientRepository.findOne({
      where: { subdomain: finalSubdomain, isActive: true },
    });

    // In production, strictly enforce subdomain validation
    // In development, allow 'admin' subdomain even if not in database (for local testing)
    if (!client && (config.nodeEnv === 'production' || finalSubdomain !== 'admin')) {
      res.status(404).json({
        success: false,
        error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found or subdomain not registered' },
      });
      return;
    }

    logger.debug('Client lookup result', {
      subdomain: finalSubdomain,
      clientFound: !!client,
      clientId: client?.id,
      clientName: client?.name,
    });

    if (!client) {
      res.status(404).json({
        success: false,
        error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found' },
      });
      return;
    }

    req.tenant = client;
    req.clientId = client.id;
    logger.debug('Client ID set on request', { clientId: client.id });
    next();
  } catch (error) {
    next(error);
  }
}

function extractSubdomain(host: string): string | null {
  // Remove port if present
  const hostWithoutPort = host.split(':')[0];

  // Validate host format - prevent injection attacks
  // Only allow alphanumeric, dots, and hyphens
  if (!/^[a-zA-Z0-9.-]+$/.test(hostWithoutPort)) {
    return null;
  }

  // Prevent path traversal attempts
  if (hostWithoutPort.includes('/') || hostWithoutPort.includes('\\')) {
    return null;
  }

  // For localhost development: client1.localhost, admin.localhost, or just localhost
  if (hostWithoutPort.includes('localhost') || hostWithoutPort === '127.0.0.1') {
    const parts = hostWithoutPort.split('.');
    if (parts.length > 1 && parts[0] !== 'localhost' && parts[0] !== '127') {
      const subdomain = parts[0];
      // Validate subdomain format (alphanumeric and hyphens only, 1-63 chars)
      if (/^[a-zA-Z0-9-]{1,63}$/.test(subdomain)) {
        return subdomain;
      }
      return null;
    }
    // For bare localhost, return null (will be handled by caller)
    return null;
  }

  // For Docker internal networking (container names)
  if (hostWithoutPort.includes('backend') || hostWithoutPort.includes('frontend')) {
    // In Docker, default to admin but validate
    return 'admin';
  }

  // For production: client1.myapp.com
  const parts = hostWithoutPort.split('.');
  if (parts.length >= 3) {
    const subdomain = parts[0];
    // Validate subdomain format (alphanumeric and hyphens only, 1-63 chars)
    if (/^[a-zA-Z0-9-]{1,63}$/.test(subdomain)) {
      return subdomain;
    }
    return null;
  }

  // Don't default to 'admin' - return null and let caller handle
  return null;
}

