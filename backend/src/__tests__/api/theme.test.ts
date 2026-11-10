import request from 'supertest';
import { AppDataSource } from '../../config/database';
import { User } from '../../entities/User';
import { Client } from '../../entities/Client';
import { Role } from '../../entities/Role';
import { Theme } from '../../entities/Theme';
import bcrypt from 'bcryptjs';
import app from './test-app';

describe('Theme API', () => {
  let testClient: Client;
  let testRole: Role;
  let adminUser: User;
  let testTheme: Theme;
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

    // Create test theme
    const themeRepository = AppDataSource.getRepository(Theme);
    testTheme = themeRepository.create({
      clientId: testClient.id,
      colors: {
        primary: '#3b82f6',
        secondary: '#8b5cf6',
        accent: '#10b981',
        background: '#ffffff',
        text: '#1f2937',
      },
      themeName: 'default',
    });
    testTheme = await themeRepository.save(testTheme);

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
    const themeRepository = AppDataSource.getRepository(Theme);
    const clientRepository = AppDataSource.getRepository(Client);
    
    await userRepository.delete({ clientId: testClient.id });
    await roleRepository.delete({ id: testRole.id });
    await themeRepository.delete({ clientId: testClient.id });
    await clientRepository.delete({ id: testClient.id });
    
    await AppDataSource.destroy();
  });

  describe('GET /api/theme', () => {
    it('should get theme for authenticated user', async () => {
      const response = await request(app)
        .get('/api/theme')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.colors).toBeDefined();
    });
  });

  describe('GET /api/theme/public', () => {
    it('should get public theme without authentication', async () => {
      const response = await request(app)
        .get('/api/theme/public')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.colors).toBeDefined();
    });
  });

  describe('PUT /api/theme', () => {
    it('should update theme', async () => {
      const updatedColors = {
        primary: '#FF0000',
        secondary: '#00FF00',
        accent: '#0000FF',
        background: '#FFFFFF',
        text: '#000000',
      };

      const response = await request(app)
        .put('/api/theme')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          colors: updatedColors,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.colors.primary).toBe(updatedColors.primary);
    });
  });
});

