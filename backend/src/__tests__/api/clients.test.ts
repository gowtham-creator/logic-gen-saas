import request from 'supertest';
import { AppDataSource } from '../../config/database';
import { User } from '../../entities/User';
import { Client } from '../../entities/Client';
import { Role } from '../../entities/Role';
import bcrypt from 'bcryptjs';
import app from './test-app';

describe('Clients API (Super Admin)', () => {
  let superAdminClient: Client;
  let superAdminRole: Role;
  let superAdminUser: User;
  let accessToken: string;

  beforeAll(async () => {
    await AppDataSource.initialize();
    
    // Create super admin client
    const clientRepository = AppDataSource.getRepository(Client);
    superAdminClient = clientRepository.create({
      name: 'Super Admin',
      subdomain: 'superadmin',
      isActive: true,
      allowSuperAdminLogin: true,
    });
    superAdminClient = await clientRepository.save(superAdminClient);

    // Create super admin role
    const roleRepository = AppDataSource.getRepository(Role);
    superAdminRole = roleRepository.create({
      name: 'Super Admin Role',
      clientId: superAdminClient.id,
      isActive: true,
    });
    superAdminRole = await roleRepository.save(superAdminRole);

    // Create super admin user
    const userRepository = AppDataSource.getRepository(User);
    const passwordHash = await bcrypt.hash('SuperAdmin123!', 10);
    superAdminUser = userRepository.create({
      email: 'superadmin@test.com',
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      clientId: superAdminClient.id,
      roleId: superAdminRole.id,
      isActive: true,
      isSuperAdmin: true,
    });
    superAdminUser = await userRepository.save(superAdminUser);

    // Login as super admin using main auth endpoint
    // Use Host header with subdomain to set clientId via subdomain middleware
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .set('Host', `${superAdminClient.subdomain}.localhost:3000`)
      .send({
        email: 'superadmin@test.com',
        password: 'SuperAdmin123!',
      });

    accessToken = loginResponse.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    // Cleanup
    const userRepository = AppDataSource.getRepository(User);
    const roleRepository = AppDataSource.getRepository(Role);
    const clientRepository = AppDataSource.getRepository(Client);
    
    await userRepository.delete({ clientId: superAdminClient.id });
    await roleRepository.delete({ id: superAdminRole.id });
    await clientRepository.delete({ id: superAdminClient.id });
    
    await AppDataSource.destroy();
  });

  describe('GET /api/clients', () => {
    it('should get list of all clients', async () => {
      const response = await request(app)
        .get('/api/clients')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should require super admin access', async () => {
      // Try with regular user token (should fail)
      const regularLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'Admin123!',
        });

      if (regularLogin.body.success) {
        await request(app)
          .get('/api/clients')
          .set('Authorization', `Bearer ${regularLogin.body.data.tokens.accessToken}`)
          .expect(403);
      }
    });
  });

  describe('POST /api/clients', () => {
    it('should create a new client', async () => {
      const newClient = {
        name: `Test Client ${Date.now()}`,
        subdomain: `testclient${Date.now()}`,
        isActive: true,
      };

      const response = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(newClient)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(newClient.name);
      expect(response.body.data.subdomain).toBe(newClient.subdomain);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate unique subdomain', async () => {
      const response = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Duplicate Client',
          subdomain: 'superadmin', // Already exists
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/clients/:id', () => {
    it('should get client by id', async () => {
      const response = await request(app)
        .get(`/api/clients/${superAdminClient.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(superAdminClient.id);
    });
  });

  describe('PUT /api/clients/:id', () => {
    it('should update client', async () => {
      const response = await request(app)
        .put(`/api/clients/${superAdminClient.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Updated Client Name',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Client Name');
    });
  });

  describe('DELETE /api/clients/:id', () => {
    it('should delete client', async () => {
      // Create a client to delete
      const clientRepository = AppDataSource.getRepository(Client);
      const clientToDelete = clientRepository.create({
        name: `Delete Client ${Date.now()}`,
        subdomain: `delete${Date.now()}`,
        isActive: true,
      });
      const savedClient = await clientRepository.save(clientToDelete);

      const response = await request(app)
        .delete(`/api/clients/${savedClient.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});

