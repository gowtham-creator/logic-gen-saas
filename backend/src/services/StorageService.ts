import { AppDataSource } from '../config/database';
import { StorageConfig } from '../entities/StorageConfig';
import { StorageEngine } from '../entities/StorageEngine';
import { Client } from '../entities/Client';
import { logger } from '../utils/logger';
import { IsNull } from 'typeorm';
import { getStorageConfigEncryptionService } from './StorageConfigEncryptionService';

export interface StorageOperationResult {
  success: boolean;
  path?: string;
  url?: string;
  error?: string;
}

export interface IStorageEngine {
  uploadFile(filePath: string, content: Buffer | string, metadata?: Record<string, string>): Promise<StorageOperationResult>;
  downloadFile(filePath: string): Promise<Buffer | null>;
  deleteFile(filePath: string): Promise<StorageOperationResult>;
  listFiles(prefix?: string): Promise<string[]>;
  createFolder(folderPath: string): Promise<StorageOperationResult>;
  fileExists(filePath: string): Promise<boolean>;
}

/**
 * S3 Storage Engine Implementation
 */
export class S3StorageEngine implements IStorageEngine {
  private config: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    bucket: string;
    endpoint?: string;
  };

  constructor(config: Record<string, unknown>) {
    const endpoint = config.endpoint as string | undefined;
    
    // Validate endpoint format if provided
    if (endpoint) {
      try {
        // Check if it's a valid URL
        const url = new URL(endpoint);
        // Ensure it's http or https
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error(`Invalid endpoint protocol. Must be http:// or https://`);
        }
      } catch (error: any) {
        // If URL parsing fails, check if it's an ARN (common mistake)
        if (endpoint.startsWith('arn:')) {
          throw new Error(
            `Invalid endpoint format. Endpoint must be a URL (e.g., https://s3.amazonaws.com), not an ARN. ` +
            `If using AWS S3, you typically don't need to set an endpoint. ` +
            `For S3-compatible services, use a URL like https://s3.amazonaws.com or https://s3.${config.region || 'us-east-1'}.amazonaws.com`
          );
        }
        throw new Error(`Invalid endpoint format: ${endpoint}. Must be a valid URL (e.g., https://s3.amazonaws.com)`);
      }
    }
    
    this.config = {
      accessKeyId: config.accessKeyId as string,
      secretAccessKey: config.secretAccessKey as string,
      region: config.region as string || 'us-east-1',
      bucket: config.bucket as string,
      endpoint: endpoint,
    };
  }

  async uploadFile(filePath: string, content: Buffer | string, metadata?: Record<string, string>): Promise<StorageOperationResult> {
    try {
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
      const client = new S3Client({
        region: this.config.region,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
        ...(this.config.endpoint && { endpoint: this.config.endpoint }),
      });

      const buffer = typeof content === 'string' ? Buffer.from(content) : content;
      const command = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: filePath,
        Body: buffer,
        Metadata: metadata,
      });

      await client.send(command);
      return { success: true, path: filePath };
    } catch (error: any) {
      logger.error('S3 upload error:', error);
      return { success: false, error: error.message };
    }
  }

  async downloadFile(filePath: string): Promise<Buffer | null> {
    try {
      const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
      const client = new S3Client({
        region: this.config.region,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
        ...(this.config.endpoint && { endpoint: this.config.endpoint }),
      });

      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: filePath,
      });

      const response = await client.send(command);
      if (!response.Body) return null;

      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (error: any) {
      logger.error('S3 download error:', error);
      return null;
    }
  }

  async deleteFile(filePath: string): Promise<StorageOperationResult> {
    try {
      const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      const client = new S3Client({
        region: this.config.region,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
        ...(this.config.endpoint && { endpoint: this.config.endpoint }),
      });

      const command = new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: filePath,
      });

      await client.send(command);
      return { success: true, path: filePath };
    } catch (error: any) {
      logger.error('S3 delete error:', error);
      return { success: false, error: error.message };
    }
  }

  async listFiles(prefix?: string): Promise<string[]> {
    try {
      const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      const client = new S3Client({
        region: this.config.region,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
        ...(this.config.endpoint && { endpoint: this.config.endpoint }),
      });

      const command = new ListObjectsV2Command({
        Bucket: this.config.bucket,
        Prefix: prefix,
      });

      const response = await client.send(command);
      return (response.Contents || []).map(obj => obj.Key || '').filter(Boolean);
    } catch (error: any) {
      logger.error('S3 list error:', error);
      return [];
    }
  }

  async createFolder(folderPath: string): Promise<StorageOperationResult> {
    // S3 doesn't have folders, but we can create a placeholder object
    const folderMarker = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
    return this.uploadFile(`${folderMarker}.keep`, Buffer.from(''));
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      const { S3Client, HeadObjectCommand } = await import('@aws-sdk/client-s3');
      const client = new S3Client({
        region: this.config.region,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
        ...(this.config.endpoint && { endpoint: this.config.endpoint }),
      });

      const command = new HeadObjectCommand({
        Bucket: this.config.bucket,
        Key: filePath,
      });

      await client.send(command);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Azure Blob Storage Engine Implementation
 */
export class AzureStorageEngine implements IStorageEngine {
  private config: {
    accountName: string;
    accountKey: string;
    containerName: string;
    connectionString?: string;
  };

  constructor(config: Record<string, unknown>) {
    this.config = {
      accountName: config.accountName as string,
      accountKey: config.accountKey as string,
      containerName: config.containerName as string,
      connectionString: config.connectionString as string | undefined,
    };
  }

  async uploadFile(filePath: string, content: Buffer | string, metadata?: Record<string, string>): Promise<StorageOperationResult> {
    try {
      const { BlobServiceClient } = await import('@azure/storage-blob');
      const connectionString = this.config.connectionString || 
        `DefaultEndpointsProtocol=https;AccountName=${this.config.accountName};AccountKey=${this.config.accountKey};EndpointSuffix=core.windows.net`;
      
      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      const containerClient = blobServiceClient.getContainerClient(this.config.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(filePath);

      const buffer = typeof content === 'string' ? Buffer.from(content) : content;
      await blockBlobClient.upload(buffer, buffer.length, {
        metadata,
      });

      return { success: true, path: filePath };
    } catch (error: any) {
      logger.error('Azure upload error:', error);
      return { success: false, error: error.message };
    }
  }

  async downloadFile(filePath: string): Promise<Buffer | null> {
    try {
      const { BlobServiceClient } = await import('@azure/storage-blob');
      const connectionString = this.config.connectionString || 
        `DefaultEndpointsProtocol=https;AccountName=${this.config.accountName};AccountKey=${this.config.accountKey};EndpointSuffix=core.windows.net`;
      
      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      const containerClient = blobServiceClient.getContainerClient(this.config.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(filePath);

      const downloadResponse = await blockBlobClient.download(0);
      if (!downloadResponse.readableStreamBody) return null;

      const chunks: Uint8Array[] = [];
      for await (const chunk of downloadResponse.readableStreamBody) {
        // Ensure chunk is Uint8Array
        const buffer = chunk instanceof Uint8Array ? chunk : new Uint8Array(Buffer.from(chunk));
        chunks.push(buffer);
      }
      return Buffer.concat(chunks);
    } catch (error: any) {
      logger.error('Azure download error:', error);
      return null;
    }
  }

  async deleteFile(filePath: string): Promise<StorageOperationResult> {
    try {
      const { BlobServiceClient } = await import('@azure/storage-blob');
      const connectionString = this.config.connectionString || 
        `DefaultEndpointsProtocol=https;AccountName=${this.config.accountName};AccountKey=${this.config.accountKey};EndpointSuffix=core.windows.net`;
      
      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      const containerClient = blobServiceClient.getContainerClient(this.config.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(filePath);

      await blockBlobClient.delete();
      return { success: true, path: filePath };
    } catch (error: any) {
      logger.error('Azure delete error:', error);
      return { success: false, error: error.message };
    }
  }

  async listFiles(prefix?: string): Promise<string[]> {
    try {
      const { BlobServiceClient } = await import('@azure/storage-blob');
      const connectionString = this.config.connectionString || 
        `DefaultEndpointsProtocol=https;AccountName=${this.config.accountName};AccountKey=${this.config.accountKey};EndpointSuffix=core.windows.net`;
      
      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      const containerClient = blobServiceClient.getContainerClient(this.config.containerName);

      const files: string[] = [];
      for await (const blob of containerClient.listBlobsFlat({ prefix })) {
        files.push(blob.name);
      }
      return files;
    } catch (error: any) {
      logger.error('Azure list error:', error);
      return [];
    }
  }

  async createFolder(folderPath: string): Promise<StorageOperationResult> {
    // Azure Blob Storage doesn't have folders, but we can create a placeholder blob
    const folderMarker = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
    return this.uploadFile(`${folderMarker}.keep`, Buffer.from(''));
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      const { BlobServiceClient } = await import('@azure/storage-blob');
      const connectionString = this.config.connectionString || 
        `DefaultEndpointsProtocol=https;AccountName=${this.config.accountName};AccountKey=${this.config.accountKey};EndpointSuffix=core.windows.net`;
      
      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      const containerClient = blobServiceClient.getContainerClient(this.config.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(filePath);

      await blockBlobClient.getProperties();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Local File System Storage Engine (for development/testing)
 */
export class LocalStorageEngine implements IStorageEngine {
  private config: {
    basePath: string;
  };

  constructor(config: Record<string, unknown>) {
    this.config = {
      basePath: (config.basePath as string) || './storage',
    };
  }

  async uploadFile(filePath: string, content: Buffer | string, metadata?: Record<string, string>): Promise<StorageOperationResult> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const fullPath = path.join(this.config.basePath, filePath);
      const dir = path.dirname(fullPath);
      
      await fs.mkdir(dir, { recursive: true });
      const buffer = typeof content === 'string' ? Buffer.from(content) : content;
      await fs.writeFile(fullPath, buffer);
      
      return { success: true, path: filePath };
    } catch (error: any) {
      logger.error('Local storage upload error:', error);
      return { success: false, error: error.message };
    }
  }

  async downloadFile(filePath: string): Promise<Buffer | null> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const fullPath = path.join(this.config.basePath, filePath);
      return await fs.readFile(fullPath);
    } catch (error: any) {
      logger.error('Local storage download error:', error);
      return null;
    }
  }

  async deleteFile(filePath: string): Promise<StorageOperationResult> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const fullPath = path.join(this.config.basePath, filePath);
      await fs.unlink(fullPath);
      return { success: true, path: filePath };
    } catch (error: any) {
      logger.error('Local storage delete error:', error);
      return { success: false, error: error.message };
    }
  }

  async listFiles(prefix?: string): Promise<string[]> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const basePath = prefix ? path.join(this.config.basePath, prefix) : this.config.basePath;
      
      const files: string[] = [];
      async function walkDir(dir: string, base: string): Promise<void> {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(base, fullPath);
          if (entry.isDirectory()) {
            await walkDir(fullPath, base);
          } else {
            files.push(relativePath);
          }
        }
      }
      
      await walkDir(basePath, this.config.basePath);
      return files;
    } catch (error: any) {
      logger.error('Local storage list error:', error);
      return [];
    }
  }

  async createFolder(folderPath: string): Promise<StorageOperationResult> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const fullPath = path.join(this.config.basePath, folderPath);
      await fs.mkdir(fullPath, { recursive: true });
      return { success: true, path: folderPath };
    } catch (error: any) {
      logger.error('Local storage create folder error:', error);
      return { success: false, error: error.message };
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const fullPath = path.join(this.config.basePath, filePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Storage Service - Main service to manage storage operations
 */
export class StorageService {
  private storageConfigRepository = AppDataSource.getRepository(StorageConfig);
  private storageEngineRepository = AppDataSource.getRepository(StorageEngine);
  private clientRepository = AppDataSource.getRepository(Client);

  /**
   * Get storage engine instance for a client
   */
  async getStorageEngine(clientId?: string): Promise<IStorageEngine | null> {
    try {
      let storageConfig: StorageConfig | null = null;

      // First, try to get client-specific config
      if (clientId) {
        const client = await this.clientRepository.findOne({
          where: { id: clientId },
          relations: ['storageConfig'],
        });
        if (client?.storageConfigId) {
          storageConfig = await this.storageConfigRepository.findOne({
            where: { id: client.storageConfigId },
            relations: ['storageEngine'],
          });
        }
      }

      // If no client-specific config, get default config
      if (!storageConfig) {
        storageConfig = await this.storageConfigRepository.findOne({
          where: { isDefault: true },
          relations: ['storageEngine'],
        });
      }

      if (!storageConfig || !storageConfig.storageEngine) {
        logger.warn('No storage configuration found');
        return null;
      }

      // Decrypt storage config before using
      const encryptionService = getStorageConfigEncryptionService();
      const decryptedConfig = await encryptionService.decryptStorageConfig(
        storageConfig.config,
        storageConfig.storageEngine.type
      );

      return this.createEngineInstance(storageConfig.storageEngine.type, decryptedConfig);
    } catch (error: any) {
      logger.error('Error getting storage engine:', error);
      return null;
    }
  }

  /**
   * Create storage engine instance based on type
   */
  private createEngineInstance(type: string, config: Record<string, unknown>): IStorageEngine {
    switch (type) {
      case 's3':
        return new S3StorageEngine(config);
      case 'azure':
        return new AzureStorageEngine(config);
      case 'local':
        return new LocalStorageEngine(config);
      default:
        throw new Error(`Unsupported storage engine type: ${type}`);
    }
  }

  /**
   * Validate S3 endpoint format
   */
  private validateS3Endpoint(endpoint: string | undefined, region?: string): void {
    if (!endpoint) return;
    
    try {
      const url = new URL(endpoint);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error(`Invalid endpoint protocol. Must be http:// or https://`);
      }
    } catch (error: any) {
      if (endpoint.startsWith('arn:')) {
        throw new Error(
          `Invalid endpoint format. Endpoint must be a URL (e.g., https://s3.amazonaws.com), not an ARN. ` +
          `If using AWS S3, you typically don't need to set an endpoint. ` +
          `For S3-compatible services, use a URL like https://s3.amazonaws.com or https://s3.${region || 'us-east-1'}.amazonaws.com`
        );
      }
      throw new Error(`Invalid endpoint format: ${endpoint}. Must be a valid URL (e.g., https://s3.amazonaws.com)`);
    }
  }

  /**
   * Get default storage configuration
   */
  async getDefaultStorageConfig(): Promise<StorageConfig | null> {
    return this.storageConfigRepository.findOne({
      where: { isDefault: true },
      relations: ['storageEngine'],
    });
  }

  /**
   * Set default storage configuration
   */
  async setDefaultStorageConfig(storageEngineId: string, config: Record<string, unknown>): Promise<StorageConfig> {
    const storageEngine = await this.storageEngineRepository.findOne({
      where: { id: storageEngineId },
    });

    if (!storageEngine) {
      throw new Error('Storage engine not found');
    }

    // Validate S3 endpoint if it's an S3 engine
    if (storageEngine.type === 's3' && config.endpoint) {
      this.validateS3Endpoint(config.endpoint as string, config.region as string);
    }

    // Encrypt storage config before saving
    const encryptionService = getStorageConfigEncryptionService();
    const encryptedConfig = await encryptionService.encryptStorageConfig(config, storageEngine.type);

    // Ensure only one default config exists - unset any existing default
    const existingDefaults = await this.storageConfigRepository.find({
      where: { isDefault: true },
    });
    
    for (const existing of existingDefaults) {
      existing.isDefault = false;
      await this.storageConfigRepository.save(existing);
    }

    // Check if default config exists (by isDefault or clientId: null for backward compatibility)
    let defaultConfig = await this.storageConfigRepository.findOne({
      where: [{ isDefault: true }, { clientId: IsNull() }],
    });

    if (defaultConfig) {
      defaultConfig.storageEngineId = storageEngineId;
      defaultConfig.config = encryptedConfig;
      defaultConfig.isDefault = true;
      defaultConfig.clientId = undefined; // Ensure clientId is undefined for default
      return await this.storageConfigRepository.save(defaultConfig);
    } else {
      defaultConfig = this.storageConfigRepository.create({
        clientId: undefined,
        storageEngineId,
        config: encryptedConfig,
        isDefault: true,
        isActive: true,
      });
      return await this.storageConfigRepository.save(defaultConfig);
    }
  }

  /**
   * Set client-specific storage configuration
   */
  async setClientStorageConfig(
    clientId: string,
    storageEngineId: string,
    config: Record<string, unknown>
  ): Promise<StorageConfig> {
    const client = await this.clientRepository.findOne({ where: { id: clientId } });
    if (!client) {
      throw new Error('Client not found');
    }

    const storageEngine = await this.storageEngineRepository.findOne({
      where: { id: storageEngineId },
    });
    if (!storageEngine) {
      throw new Error('Storage engine not found');
    }

    // Validate S3 endpoint if it's an S3 engine
    if (storageEngine.type === 's3' && config.endpoint) {
      this.validateS3Endpoint(config.endpoint as string, config.region as string);
    }

    // Encrypt storage config before saving
    const encryptionService = getStorageConfigEncryptionService();
    const encryptedConfig = await encryptionService.encryptStorageConfig(config, storageEngine.type);

    // Check if client config exists
    let clientConfig = await this.storageConfigRepository.findOne({
      where: { clientId },
    });

    const basePath = `clients/${clientId}/`;

    if (clientConfig) {
      clientConfig.storageEngineId = storageEngineId;
      clientConfig.config = encryptedConfig;
      clientConfig.basePath = basePath;
      clientConfig = await this.storageConfigRepository.save(clientConfig);
    } else {
      clientConfig = this.storageConfigRepository.create({
        clientId,
        storageEngineId,
        config: encryptedConfig,
        basePath,
        isActive: true,
      });
      clientConfig = await this.storageConfigRepository.save(clientConfig);
    }

    // Update client reference
    client.storageConfigId = clientConfig.id;
    await this.clientRepository.save(client);

    return clientConfig;
  }

  /**
   * Create storage folder for a client
   */
  async createClientStorageFolder(clientId: string): Promise<StorageOperationResult> {
    try {
      const engine = await this.getStorageEngine(clientId);
      if (!engine) {
        return { success: false, error: 'No storage engine configured' };
      }

      const folderPath = `clients/${clientId}/`;
      return await engine.createFolder(folderPath);
    } catch (error: any) {
      logger.error('Error creating client storage folder:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all available storage engines
   */
  async getStorageEngines(): Promise<StorageEngine[]> {
    return this.storageEngineRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  /**
   * Get client storage configuration
   */
  async getClientStorageConfig(clientId: string): Promise<StorageConfig | null> {
    return this.storageConfigRepository.findOne({
      where: { clientId },
      relations: ['storageEngine'],
    });
  }
}

