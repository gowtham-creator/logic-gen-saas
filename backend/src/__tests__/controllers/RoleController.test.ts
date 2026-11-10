import { RoleController } from '../../controllers/RoleController';
import { RoleService } from '../../services/RoleService';
import { AuditService } from '../../services/AuditService';
import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';

jest.mock('../../services/RoleService');
jest.mock('../../services/AuditService');

describe('RoleController', () => {
  let controller: RoleController;
  let mockRoleService: jest.Mocked<RoleService>;
  let mockAuditService: jest.Mocked<AuditService>;
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockRoleService = {
      createRole: jest.fn(),
      listRoles: jest.fn(),
      getRole: jest.fn(),
      updateRole: jest.fn(),
      deleteRole: jest.fn(),
    } as any;

    mockAuditService = {
      log: jest.fn(),
    } as any;

    (RoleService as jest.Mock).mockImplementation(() => mockRoleService);
    (AuditService as jest.Mock).mockImplementation(() => mockAuditService);

    controller = new RoleController();

    mockRequest = {
      body: {},
      params: {},
      clientId: 'client-id',
      userId: 'user-id',
      ip: '127.0.0.1',
      get: jest.fn(),
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a role and log audit event', async () => {
      const roleData = {
        name: 'Test Role',
        description: 'Test',
      };

      const createdRole = {
        id: 'role-id',
        ...roleData,
        clientId: 'client-id',
      };

      mockRequest.body = roleData;
      mockRoleService.createRole.mockResolvedValue(createdRole as any);
      mockAuditService.log.mockResolvedValue({} as any);

      await controller.create(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(mockRoleService.createRole).toHaveBeenCalledWith({
        ...roleData,
        clientId: 'client-id',
      });
      expect(mockAuditService.log).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });

    it('should handle errors', async () => {
      mockRequest.body = { name: 'Test Role' };
      mockRoleService.createRole.mockRejectedValue(new Error('Creation failed'));

      await controller.create(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'CREATE_ROLE_ERROR',
          }),
        })
      );
    });
  });

  describe('list', () => {
    it('should return list of roles', async () => {
      const roles = [{ id: 'role-1', name: 'Role 1' }];
      mockRoleService.listRoles.mockResolvedValue(roles as any);

      await controller.list(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(mockRoleService.listRoles).toHaveBeenCalledWith('client-id');
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: roles,
        })
      );
    });
  });
});

