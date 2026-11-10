import { RoleService } from '../../services/RoleService';
import { RoleRepository } from '../../db/RoleRepository';
import { AppDataSource } from '../../config/database';

jest.mock('../../db/RoleRepository');
jest.mock('../../config/database');

describe('RoleService', () => {
  let roleService: RoleService;
  let mockRoleRepository: jest.Mocked<RoleRepository>;

  beforeEach(() => {
    mockRoleRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findByName: jest.fn(),
    } as any;

    (RoleRepository as jest.Mock).mockImplementation(() => mockRoleRepository);
    roleService = new RoleService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createRole', () => {
    it('should create a role successfully', async () => {
      const roleData = {
        name: 'Test Role',
        description: 'Test description',
        clientId: 'client-id',
      };

      const createdRole = { id: 'role-id', ...roleData } as any;
      mockRoleRepository.findByName.mockResolvedValue(null);
      mockRoleRepository.create.mockResolvedValue(createdRole);
      mockRoleRepository.findById.mockResolvedValue(createdRole);

      const mockPermissionRepository = {
        delete: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
      };
      const mockRolePermissionRepository = {
        create: jest.fn(),
        save: jest.fn(),
      };

      (AppDataSource.getRepository as jest.Mock).mockImplementation((entity) => {
        if (entity.name === 'Permission') return mockPermissionRepository;
        if (entity.name === 'RolePermission') return mockRolePermissionRepository;
        return {};
      });

      const result = await roleService.createRole(roleData);

      expect(mockRoleRepository.findByName).toHaveBeenCalledWith(roleData.name, roleData.clientId);
      expect(mockRoleRepository.create).toHaveBeenCalled();
      expect(result).toEqual(createdRole);
    });

    it('should throw error if role name already exists', async () => {
      const roleData = {
        name: 'Existing Role',
        clientId: 'client-id',
      };

      const existingRole = { id: 'existing-id', ...roleData } as any;
      mockRoleRepository.findByName.mockResolvedValue(existingRole);

      await expect(roleService.createRole(roleData)).rejects.toThrow(
        'Role with this name already exists'
      );
    });
  });

  describe('listRoles', () => {
    it('should return list of roles', async () => {
      const roles = [
        { id: 'role-1', name: 'Role 1', clientId: 'client-id' },
        { id: 'role-2', name: 'Role 2', clientId: 'client-id' },
      ] as any;

      mockRoleRepository.findAll.mockResolvedValue(roles);

      const result = await roleService.listRoles('client-id');

      expect(mockRoleRepository.findAll).toHaveBeenCalledWith('client-id');
      expect(result).toEqual(roles);
    });
  });
});

