import { Response } from 'express';
import { subdomainMiddleware, TenantRequest } from '../../middleware/subdomain';
import { AppDataSource } from '../../config/database';
import { Client } from '../../entities/Client';

jest.mock('../../config/database');
jest.mock('../../entities/Client');

describe('subdomainMiddleware', () => {
  let mockRequest: Partial<TenantRequest>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    mockRequest = {
      get: jest.fn(),
      ip: '127.0.0.1',
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should extract subdomain from host and attach tenant', async () => {
    (mockRequest.get as jest.Mock).mockReturnValue('client1.localhost:3000');
    
    const mockClient = { id: 'client-id', subdomain: 'client1', isActive: true } as Client;
    const mockRepository = {
      findOne: jest.fn().mockResolvedValue(mockClient),
    };
    
    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepository);

    await subdomainMiddleware(
      mockRequest as TenantRequest,
      mockResponse as Response,
      nextFunction
    );

    expect(mockRequest.tenant).toEqual(mockClient);
    expect(mockRequest.clientId).toBe('client-id');
    expect(nextFunction).toHaveBeenCalled();
  });

  it('should return 400 if no subdomain found', async () => {
    (mockRequest.get as jest.Mock).mockReturnValue('localhost:3000');
    
    const mockRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    
    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepository);

    await subdomainMiddleware(
      mockRequest as TenantRequest,
      mockResponse as Response,
      nextFunction
    );

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should return 404 if tenant not found', async () => {
    (mockRequest.get as jest.Mock).mockReturnValue('nonexistent.localhost:3000');
    
    const mockRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    
    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepository);

    await subdomainMiddleware(
      mockRequest as TenantRequest,
      mockResponse as Response,
      nextFunction
    );

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(nextFunction).not.toHaveBeenCalled();
  });
});

