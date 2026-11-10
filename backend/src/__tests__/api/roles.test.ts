import request from 'supertest';
import { AppDataSource } from '../../config/database';
import { User } from '../../entities/User';
import { Client } from '../../entities/Client';
import { Role } from '../../entities/Role';
import { Permission } from '../../entities/Permission';
import bcrypt from 'bcryptjs';
import app from './test-app';

describe('Roles API', () => {
  let testClient: Client;
  let testRole: Role;
  let adminUser: User;
  let testPermission: Permission;
  let accessToken: string;

  beforeAll(async () => {
    await AppDataSource.initialize();
    
    // Create test client
    const clientRepository = AppDataSource.getRepository(Client);
    testClient = clientRepository.create({
      name: 'Test Client',
      subdomain: 'testclient',
      isActive: true,
    });
    testClient = await clientRepository.save(testClient);

    // Create test permission
    const permissionRepository = AppDataSource.getRepository(Permission);
    testPermission = permissionRepository.create({
      resource: 'users',
      action: 'read',
      clientId: testClient.id,
    });
    testPermission = await permissionRepository.save(testPermission);

    // Create test role
    const roleRepository = AppDataSource.getRepository(Role);
    testRole = roleRepository.create({
      name: 'Admin',
      clientId: testClient.id,
      isActive: true,
    });
    testRole = await roleRepository.save(testRole);

    // Create admin user
    const userRepository = AppDataSource.getRepository(User);
    const passwordHash = await bcrypt.hash('Admin123!', 10);
    adminUser = userRepository.create({
      email: 'admin@test.com',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      clientId: testClient.id,
      roleId: testRole.id,
      isActive: true,
    });
    adminUser = await userRepository.save(adminUser);

    // Login to get token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'Admin123!',
      });

    accessToken = loginResponse.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    // Cleanup
    const userRepository = AppDataSource.getRepository(User);
    const roleRepository = AppDataSource.getRepository(Role);
    const permissionRepository = AppDataSource.getRepository(Permission);
    const clientRepository = AppDataSource.getRepository(Client);
    
    await userRepository.delete({ clientId: testClient.id });
    await roleRepository.delete({ clientId: testClient.id });
    await permissionRepository.delete({ resource: 'users', clientId: testClient.id });
    await clientRepository.delete({ id: testClient.id });
    
    await AppDataSource.destroy();
  });

  describe('GET /api/roles', () => {
    it('should get list of roles', async () => {
      const response = await request(app)
        .get('/api/roles')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('POST /api/roles', () => {
    it('should create a new role', async () => {
      const newRole = {
        name: `Test Role ${Date.now()}`,
        description: 'Test role description',
        permissionIds: [testPermission.id],
      };

      const response = await request(app)
        .post('/api/roles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(newRole)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(newRole.name);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/roles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/roles/:id', () => {
    it('should get role by id', async () => {
      const response = await request(app)
        .get(`/api/roles/${testRole.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testRole.id);
    });
  });

  describe('PUT /api/roles/:id', () => {
    it('should update role', async () => {
      const response = await request(app)
        .put(`/api/roles/${testRole.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Updated Role Name',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Role Name');
    });
  });

  describe('DELETE /api/roles/:id', () => {
    it('should delete role', async () => {
      // Create a role to delete
      const roleRepository = AppDataSource.getRepository(Role);
      const roleToDelete = roleRepository.create({
        name: `Delete Role ${Date.now()}`,
        clientId: testClient.id,
        isActive: true,
      });
      const savedRole = await roleRepository.save(roleToDelete);

      const response = await request(app)
        .delete(`/api/roles/${savedRole.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});

