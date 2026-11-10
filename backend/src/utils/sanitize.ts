/**
 * Input sanitization utilities to prevent XSS attacks
 */
import sanitizeHtml from 'sanitize-html';

/**
 * Sanitize string input by escaping HTML special characters
 * For basic text, use HTML entity encoding
 * For rich text content, use sanitize-html library
 */
export function sanitizeString(input: string, options?: { allowRichText?: boolean }): string {
  if (typeof input !== 'string') {
    return '';
  }

  // For rich text content, use sanitize-html
  if (options?.allowRichText) {
    return sanitizeHtml(input, {
      allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
      allowedAttributes: {
        'a': ['href', 'title'],
      },
      allowedSchemes: ['http', 'https', 'mailto'],
    });
  }

  // For plain text, use HTML entity encoding
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item)) as T;
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = sanitizeObject((obj as any)[key]);
      }
    }
    return sanitized as T;
  }

  return obj;
}

/**
 * Sanitize user input from request body
 * Only sanitizes string fields, preserves other types
 */
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return sanitizeString(input);
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeInput(item));
  }

  if (input && typeof input === 'object') {
    const sanitized: any = {};
    for (const key in input) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        // Skip sanitization for known safe fields (passwords, tokens, etc.)
        const skipFields = ['password', 'currentPassword', 'newPassword', 'token', 'apiKey', 'keyHash'];
        if (skipFields.includes(key.toLowerCase())) {
          sanitized[key] = input[key];
        } else {
          sanitized[key] = sanitizeInput(input[key]);
        }
      }
    }
    return sanitized;
  }

  return input;
}

/**
 * Validate and sanitize email address
 */
export function sanitizeEmail(email: string): string | null {
  if (typeof email !== 'string') {
    return null;
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const trimmed = email.trim().toLowerCase();
  
  if (!emailRegex.test(trimmed)) {
    return null;
  }

  // Sanitize but preserve email format
  return trimmed;
}

/**
 * Validate and sanitize URL
 */
export function sanitizeUrl(url: string): string | null {
  if (typeof url !== 'string') {
    return null;
  }

  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

