import 'reflect-metadata';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';

async function setSuperAdmin(userId: string) {
  try {
    await AppDataSource.initialize();
    console.log('✅ Database connected');

    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: userId },
      select: ['id', 'email', 'isSuperAdmin'],
    });

    if (!user) {
      console.error(`❌ User with ID ${userId} not found`);
      process.exit(1);
    }

    if (user.isSuperAdmin) {
      console.log(`ℹ️  User ${user.email} (${userId}) already has super admin access`);
      process.exit(0);
    }

    await userRepository.update({ id: userId }, { isSuperAdmin: true });

    // Fetch updated user to confirm
    const updatedUser = await userRepository.findOne({
      where: { id: userId },
      select: ['id', 'email', 'isSuperAdmin'],
    });

    console.log(`✅ Successfully set super admin access for user: ${updatedUser?.email} (${userId})`);
  } catch (error: any) {
    console.error('❌ Error setting super admin access:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

const userId = process.argv[2];
if (!userId) {
  console.error('Usage: tsx src/scripts/setSuperAdmin.ts <userId>');
  process.exit(1);
}

setSuperAdmin(userId);

