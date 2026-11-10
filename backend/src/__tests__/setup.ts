import { AppDataSource } from '../config/database';

beforeAll(async () => {
  // Initialize database connection for tests
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
});

afterAll(async () => {
  // Close database connection after all tests
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
});

