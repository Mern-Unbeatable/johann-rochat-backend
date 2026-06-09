import bcrypt from 'bcrypt';
import { prisma } from '../config/db.js';
import { config } from '../config/config.js';

export async function seedAdmin() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = config;

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    config.logger.warn('ADMIN_EMAIL or ADMIN_PASSWORD not set — skipping admin seed');
    return;
  }

  try {
    const existingAdmin = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL },
      select: { id: true, email: true, role: true },
    });

    if (existingAdmin) {
      config.logger.info(`Admin already exists, skipping creation (${ADMIN_EMAIL})`);
      return;
    }

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

    const admin = await prisma.user.create({
      data: {
        name: 'Super Admin',
        email: ADMIN_EMAIL,
        password: hashedPassword,
        role: 'ADMIN',
        credits: 9999,
        freeAdUsed: true,
        isVerified: true,
        consentGiven: true,
        consentDate: new Date(),
      },
      select: { id: true, email: true, role: true },
    });

    config.logger.info(`Admin created successfully — email: ${admin.email}, id: ${admin.id}`);
  } catch (error) {
    config.logger.error('Admin seed failed', error, 'AdminSeeder');
    throw error;
  }
}
