import request from 'supertest';
import { AppDataSource } from '../../config/database';
import { User } from '../../entities/User';
import { Client } from '../../entities/Client';
import { Role } from '../../entities/Role';
import bcrypt from 'bcryptjs';
import app from './test-app';

describe('Users API', () => {
  let testClient: Client;
  let testRole: Role;
  let adminUser: User;
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
    const clientRepository = AppDataSource.getRepository(Client);
    
    await userRepository.delete({ clientId: testClient.id });
    await roleRepository.delete({ id: testRole.id });
    await clientRepository.delete({ id: testClient.id });
    
    await AppDataSource.destroy();
  });

  describe('GET /api/users', () => {
    it('should get list of users', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/users')
        .expect(401);
    });
  });

  describe('POST /api/users', () => {
    it('should create a new user', async () => {
      const newUser = {
        email: `newuser${Date.now()}@example.com`,
        firstName: 'New',
        lastName: 'User',
        roleId: testRole.id,
        password: 'NewUser123!',
      };

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(newUser)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(newUser.email);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          firstName: 'Test',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/users/:id', () => {
    it('should get user by id', async () => {
      const response = await request(app)
        .get(`/api/users/${adminUser.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(adminUser.id);
    });

    it('should return 404 for non-existent user', async () => {
      await request(app)
        .get('/api/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('PUT /api/users/:id', () => {
    it('should update user', async () => {
      const response = await request(app)
        .put(`/api/users/${adminUser.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          firstName: 'Updated',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.firstName).toBe('Updated');
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should delete user', async () => {
      // Create a user to delete
      const userRepository = AppDataSource.getRepository(User);
      const passwordHash = await bcrypt.hash('Test123!', 10);
      const userToDelete = userRepository.create({
        email: `delete${Date.now()}@example.com`,
        passwordHash,
        firstName: 'Delete',
        lastName: 'User',
        clientId: testClient.id,
        roleId: testRole.id,
        isActive: true,
      });
      const savedUser = await userRepository.save(userToDelete);

      const response = await request(app)
        .delete(`/api/users/${savedUser.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});

