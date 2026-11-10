import 'reflect-metadata';
import { AppDataSource } from '../config/database';

async function runMigrations() {
  try {
    await AppDataSource.initialize();
    console.log('Database connected');

    const migrations = await AppDataSource.runMigrations();
    if (migrations.length > 0) {
      console.log(`Ran ${migrations.length} migration(s):`);
      migrations.forEach((migration) => {
        console.log(`  - ${migration.name}`);
      });
    } else {
      console.log('No pending migrations');
    }

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();

