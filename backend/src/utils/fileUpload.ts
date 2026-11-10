import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Configure storage for favicons and logos using memory storage (same as workflow files)
// Files will be uploaded directly to storage engine instead of local disk

// Magic bytes (file signatures) for image validation
const IMAGE_SIGNATURES: { [key: string]: Buffer[] } = {
  'image/png': [Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
  'image/jpeg': [Buffer.from([0xFF, 0xD8, 0xFF])],
  'image/gif': [Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]), Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])],
  'image/svg+xml': [Buffer.from('<svg', 'utf8'), Buffer.from('<?xml', 'utf8')],
  'image/x-icon': [Buffer.from([0x00, 0x00, 0x01, 0x00]), Buffer.from([0x00, 0x00, 0x02, 0x00])],
  'image/vnd.microsoft.icon': [Buffer.from([0x00, 0x00, 0x01, 0x00]), Buffer.from([0x00, 0x00, 0x02, 0x00])],
};

/**
 * Validate file content by checking magic bytes
 * Works with both file paths (for backward compatibility) and buffers
 */
function validateFileContent(filePathOrBuffer: string | Buffer, expectedMime: string): boolean {
  try {
    const fileBuffer = typeof filePathOrBuffer === 'string' 
      ? fs.readFileSync(filePathOrBuffer)
      : filePathOrBuffer;
    
    const signatures = IMAGE_SIGNATURES[expectedMime];
    
    if (!signatures) {
      return false;
    }

    // Check if file starts with any of the expected signatures
    return signatures.some((signature) => {
      return fileBuffer.subarray(0, signature.length).equals(signature);
    });
  } catch {
    return false;
  }
}

// File filter for images
const imageFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'];
  
  // Validate MIME type
  if (!allowedMimes.includes(file.mimetype)) {
    cb(new Error('Invalid file type. Only image files are allowed.'));
    return;
  }

  // Additional validation: check file extension
  const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    cb(new Error('Invalid file extension. Only image files are allowed.'));
    return;
  }

  cb(null, true);
};

// Multer instances - using memory storage (same as workflow files)
export const uploadFavicon = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
  },
});

export const uploadLogo = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Helper to get file URL from storage path
export function getFileUrl(filePath: string, type: 'favicon' | 'logo'): string {
  // const baseUrl = process.env.APP_URL || process.env.API_URL || 'http://localhost:3001';
  // Generate API endpoint URL for theme files (similar to workflow files)
  // The filePath should be the storage path (e.g., "clientId/theme/favicon/filename.ext")
  // For now, we'll use an API endpoint pattern. In the future, this could be signed URLs for S3/Azure
  return `/api/theme/files/${encodeURIComponent(filePath)}`;
}

// Helper to delete file (for backward compatibility with local storage)
// Note: For storage engine files, deletion should be done through StorageService
export function deleteFile(filename: string, type: 'favicon' | 'logo'): void {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  const dir = type === 'favicon' 
    ? path.join(uploadsDir, 'favicons')
    : path.join(uploadsDir, 'logos');
  const filePath = path.join(dir, filename);
  
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * Sanitize SVG content to prevent XSS attacks
 * Works with both file paths and buffers
 */
function sanitizeSvgContent(filePathOrBuffer: string | Buffer): boolean {
  try {
    const content = typeof filePathOrBuffer === 'string'
      ? fs.readFileSync(filePathOrBuffer, 'utf8')
      : filePathOrBuffer.toString('utf8');
    
    // Remove script tags and event handlers
    const dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /on\w+\s*=\s*["'][^"']*["']/gi, // Event handlers like onclick, onload
      /javascript:/gi,
      /<iframe/gi,
      /<object/gi,
      /<embed/gi,
    ];

    let sanitized = content;
    for (const pattern of dangerousPatterns) {
      sanitized = sanitized.replace(pattern, '');
    }

    // Only write back if content changed and it's a file path
    if (sanitized !== content && typeof filePathOrBuffer === 'string') {
      fs.writeFileSync(filePathOrBuffer, sanitized, 'utf8');
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Validate uploaded file content
 * Works with both file paths (for backward compatibility) and buffers (for storage engine uploads)
 */
export async function validateUploadedFile(filePathOrBuffer: string | Buffer, expectedMime: string): Promise<{ valid: boolean; error?: string }> {
  // Check if file exists (only for file paths)
  if (typeof filePathOrBuffer === 'string' && !fs.existsSync(filePathOrBuffer)) {
    return { valid: false, error: 'File not found' };
  }

  // Validate file content using magic bytes
  if (!validateFileContent(filePathOrBuffer, expectedMime)) {
    // Delete the invalid file if it's a file path
    if (typeof filePathOrBuffer === 'string' && fs.existsSync(filePathOrBuffer)) {
      fs.unlinkSync(filePathOrBuffer);
    }
    return { valid: false, error: 'File content does not match declared type. Possible file type spoofing detected.' };
  }

  // Sanitize SVG files to prevent XSS
  if (expectedMime === 'image/svg+xml') {
    if (!sanitizeSvgContent(filePathOrBuffer)) {
      if (typeof filePathOrBuffer === 'string' && fs.existsSync(filePathOrBuffer)) {
        fs.unlinkSync(filePathOrBuffer);
      }
      return { valid: false, error: 'Failed to sanitize SVG file' };
    }
  }

  // Virus scanning (if enabled) - only works with file paths for now
  if (typeof filePathOrBuffer === 'string') {
    try {
      const { VirusScanService } = await import('../services/VirusScanService');
      const virusScanService = new VirusScanService();
      const scanResult = await virusScanService.scanFile(filePathOrBuffer);
      
      if (!scanResult.clean) {
        // Quarantine or delete the file
        await virusScanService.quarantineFile(filePathOrBuffer, scanResult.threat || scanResult.error || 'Virus detected');
        return { valid: false, error: scanResult.threat || scanResult.error || 'File failed virus scan' };
      }
    } catch (error: any) {
      // Log error but don't fail validation if scanning service is not available
      const { logger } = require('./logger');
      logger.warn('Virus scan failed, but continuing with file validation', { error: error.message });
    }
  }

  return { valid: true };
}

