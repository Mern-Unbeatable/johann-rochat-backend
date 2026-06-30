import { prisma } from '../../config/db.js';
import PrismaQueryBuilder from '../../shared/globals/helpers/query-builder.js';

class UserService {


  async createUser(data) {
    return prisma.user.create({
      data,
      omit: { password: true },
    });
  }

  async getUserById(id) {
    return prisma.user.findUnique({
      where: { id },
      omit: { password: true, otpCode: true, resetPasswordToken: true },
    });
  }

  async getUserByIdWithPassword(id) {
    return prisma.user.findUnique({ where: { id } });
  }

  async getUserByEmail(email) {
    return prisma.user.findUnique({
      where: { email },
      omit: { password: true },
    });
  }

  async getUserByEmailWithPassword(email) {
    return prisma.user.findUnique({ where: { email } });
  }

  async getUserByStripeCustomerId(stripeCustomerId) {
    return prisma.user.findUnique({
      where: { stripeCustomerId },
      omit: { password: true },
    });
  }


  async getFullProfile(id) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        credits: true,
        freeAdUsed: true,
        isVerified: true,
        consentGiven: true,
        consentDate: true,
        stripeCustomerId: true,
        packageId: true,
        listings: true,
        payments: true,
        exports: true,
        creditTransactions: true,
        aiFeatureUsages: true,
        improvementRequests: true,
        package: {
          select: {
            id: true,
            name: true,
            slug: true,
            credits: true,
            price: true,
            pricePerCredit: true,
            description: true,
            features: true,
            badge: true,
            isActive: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  async updateProfile(id, data) {
    const allowedUpdates = {};
    if (data.name !== undefined) allowedUpdates.name = data.name;

    if (Object.keys(allowedUpdates).length === 0) {
      throw new Error('No valid fields to update');
    }

    return prisma.user.update({
      where: { id },
      data: allowedUpdates,
      omit: { password: true, otpCode: true, resetPasswordToken: true },
    });
  }

  async getUserStats(id) {
    const [user, totalListings, totalPayments] = await Promise.all([
      prisma.user.findUnique({
        where: { id },
        select: {
          credits: true,
          freeAdUsed: true,
          createdAt: true,
          consentGiven: true,
          package: {
            select: { id: true, name: true, credits: true, price: true },
          },
        },
      }),
      prisma.listing.count({ where: { userId: id } }),
      prisma.payment.count({ where: { userId: id, status: 'SUCCESS' } }),
    ]);

    if (!user) throw new Error('User not found');

    return {
      credits: user.credits,
      freeAdUsed: user.freeAdUsed,
      totalListings,
      totalPayments,
      memberSince: user.createdAt,
      consentGiven: user.consentGiven,
      activePackage: user.package,
      hasActivePackage: !!user.package,
    };
  }

  async getCreditHistory(userId, queryParams = {}) {
    const page = parseInt(queryParams.page) || 1;
    const limit = Math.min(parseInt(queryParams.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      prisma.creditTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.creditTransaction.count({ where: { userId } }),
    ]);

    return {
      meta: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit),
      },
      transactions,
    };
  }

  async updateCredits(id, creditsDelta) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { credits: true },
    });
    if (!user) throw new Error('User not found');

    const newCredits = user.credits + creditsDelta;
    if (newCredits < 0) throw new Error('Insufficient credits');

    return prisma.user.update({
      where: { id },
      data: { credits: newCredits },
      omit: { password: true },
    });
  }

  async adjustCredits(id, amount, type, reference) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { credits: true },
    });
    if (!user) throw new Error('User not found');

    const newCredits = user.credits + amount;
    if (newCredits < 0) throw new Error('Resulting credits would be negative');

    const [updatedUser, transaction] = await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: { credits: newCredits },
        select: {
          id: true,
          name: true,
          email: true,
          credits: true,
        },
      }),
      prisma.creditTransaction.create({
        data: {
          userId: id,
          amount,
          type,
          reference: reference ?? null,
        },
      }),
    ]);

    return { user: updatedUser, transaction };
  }

  async useCreditsForListing(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true, freeAdUsed: true },
    });
    if (!user) throw new Error('User not found');

    if (!user.freeAdUsed) {
      await this.updateFreeAdUsed(userId, true);
      return { used: 'free_ad', remainingCredits: user.credits };
    }

    if (user.credits < 1) throw new Error('Insufficient credits to create listing');

    const updatedUser = await this.updateCredits(userId, -1);
    return { used: 'credit', remainingCredits: updatedUser.credits };
  }

  async getAllUsers(queryParams = {}) {
    try {
      const page = parseInt(queryParams.page) || 1;
      const limit = Math.min(parseInt(queryParams.limit) || 10, 50);
      const skip = (page - 1) * limit;


      let whereCondition = {
        role: 'USER'
      };

      if (queryParams.search) {
        whereCondition = {
          ...whereCondition,
          OR: [
            { name: { contains: queryParams.search, mode: 'insensitive' } },
            { email: { contains: queryParams.search, mode: 'insensitive' } }
          ]
        };
      }

      // Get users with USER role only
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where: whereCondition,
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            credits: true,
            freeAdUsed: true,
            stripeCustomerId: true,
            isVerified: true,
            consentGiven: true,
            consentDate: true,
            createdAt: true,
            updatedAt: true,
            packageId: true,
            lastLoginAt: true,
            listings: {
              select: {
                id: true,
                title: true,
                status: true,
                createdAt: true,
                propertyType: true,
                rent: true,
                location: true
              },
              take: 5,
              orderBy: { createdAt: 'desc' }
            },
            package: {
              select: {
                id: true,
                name: true,
                credits: true,
                slug: true,
                price: true,
                pricePerCredit: true,
                description: true,
                badge: true,
                isActive: true
              }
            }
          },
          orderBy: {
            [queryParams.sortBy || 'createdAt']: queryParams.sortOrder === 'asc' ? 'asc' : 'desc'
          },
          skip,
          take: limit,
        }),
        prisma.user.count({ where: whereCondition })
      ]);

      // Remove sensitive fields
      const sensitiveFields = [
        'password',
        'otpCode',
        'resetPasswordToken',
        'resetPasswordExpires',
        'otpExpires',
        'otpPurpose',
        'googleId'
      ];

      const sanitizedUsers = users.map(user => {
        const sanitized = { ...user };
        sensitiveFields.forEach(field => {
          delete sanitized[field];
        });
        return sanitized;
      });

      return {
        meta: {
          page,
          limit,
          total,
          totalPage: Math.ceil(total / limit)
        },
        users: sanitizedUsers
      };
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      throw error;
    }
  }

  async getAdminUserStats() {
    const [total, verified, admins, totalCreditsAgg] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isVerified: true } }),
      prisma.user.count({ where: { role: 'ADMIN' } }),
      prisma.user.aggregate({ _sum: { credits: true } }),
    ]);

    return {
      total,
      verified,
      unverified: total - verified,
      admins,
      regularUsers: total - admins,
      totalCreditsInCirculation: totalCreditsAgg._sum.credits ?? 0,
    };
  }

  async setVerified(id, isVerified) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user) throw new Error('User not found');

    return prisma.user.update({
      where: { id },
      data: { isVerified },
      select: { id: true, name: true, email: true, isVerified: true, role: true },
    });
  }

  async deleteUser(id) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true },
    });
    if (!user) throw new Error('User not found');

    return prisma.user.delete({ where: { id } });
  }

  async updateConsent(id, consent) {
    return prisma.user.update({
      where: { id },
      data: { consentGiven: consent, consentDate: consent ? new Date() : null },
      omit: { password: true },
    });
  }

  async updateFreeAdUsed(id, freeAdUsed) {
    return prisma.user.update({
      where: { id },
      data: { freeAdUsed },
      omit: { password: true },
    });
  }

  async updateStripeCustomerId(id, stripeCustomerId) {
    return prisma.user.update({
      where: { id },
      data: { stripeCustomerId },
      omit: { password: true },
    });
  }

  async updateLastLogin(id) {
    return prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
      omit: { password: true },
    });
  }

  async getUserWithDetails(id) {
    return prisma.user.findUnique({
      where: { id },
      omit: { password: true },
      include: {
        listings: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, title: true, status: true, createdAt: true },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            amount: true,
            credits: true,
            status: true,
            createdAt: true,
          },
        },
        package: true,
      },
    });
  }

  // Add to UserService class
  async assignPackage(userId, packageId) {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, credits: true }
    });
    if (!user) throw new Error('User not found');

    // Check if package exists
    const packageData = await prisma.package.findUnique({
      where: { id: packageId },
      select: { id: true, name: true, credits: true, price: true, pricePerCredit: true }
    });
    if (!packageData) throw new Error('Package not found');

    // Update user with new package and add credits
    const [updatedUser, transaction] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          packageId: packageId,
          credits: user.credits + packageData.credits
        },
        select: {
          id: true,
          name: true,
          email: true,
          credits: true,
          packageId: true,
          package: {
            select: {
              id: true,
              name: true,
              credits: true,
              price: true
            }
          }
        }
      }),
      prisma.creditTransaction.create({
        data: {
          userId: userId,
          amount: packageData.credits,
          type: 'PURCHASE',
          reference: `Package assigned: ${packageData.name}`
        }
      })
    ]);

    return updatedUser;
  }

  async addCreditsOnly(userId, amount, reference = 'Admin added credits') {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, credits: true }
    });
    if (!user) throw new Error('User not found');

    const [updatedUser, transaction] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { credits: user.credits + amount },
        select: {
          id: true,
          name: true,
          email: true,
          credits: true
        }
      }),
      prisma.creditTransaction.create({
        data: {
          userId: userId,
          amount: amount,
          type: 'PURCHASE',
          reference: reference
        }
      })
    ]);

    return updatedUser;
  }
}

export const userService = new UserService();
