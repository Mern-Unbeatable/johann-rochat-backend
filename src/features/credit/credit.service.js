import { prisma } from '../../config/db.js';
import PrismaQueryBuilder from '../../shared/globals/helpers/query-builder.js';
import { NotFoundError } from '../../shared/globals/helpers/error-handler.js';

class CreditService {
  async getBalance(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, credits: true, freeAdUsed: true },
    });
    if (!user) throw new NotFoundError('User not found');
    return { credits: user.credits, freeAdUsed: user.freeAdUsed };
  }

  async getTransactionHistory(userId, queryParams = {}) {
    const queryBuilder = new PrismaQueryBuilder(prisma.creditTransaction, queryParams, {
      defaultSort: { createdAt: 'desc' },
      defaultLimit: 20,
      maxLimit: 100,
    });

    queryBuilder._where.userId = userId;

    return queryBuilder.sort().paginate().execute('transactions');
  }
  async adminAddCredits(userId, amount, reference = 'Manual adjustment by admin') {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, credits: true },
    });
    if (!user) throw new NotFoundError('User not found');

    return prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { credits: { increment: amount } },
        select: { id: true, credits: true, email: true, name: true },
      }),
      prisma.creditTransaction.create({
        data: { userId, amount, type: amount > 0 ? 'PURCHASE' : 'USAGE', reference },
      }),
    ]);
  }

  async getAllTransactions(queryParams = {}) {
    const queryBuilder = new PrismaQueryBuilder(prisma.creditTransaction, queryParams, {
      defaultSort: { createdAt: 'desc' },
      defaultLimit: 20,
      maxLimit: 100,
    });

    queryBuilder._include = {
      user: { select: { id: true, name: true, email: true } },
    };

    return queryBuilder.filter().sort().paginate().execute('transactions');
  }

  async getCreditStats() {
    const [totalIssued, totalUsed, totalRefunded, usersWithCredits] = await Promise.all([
      prisma.creditTransaction.aggregate({
        where: { type: { in: ['FREE', 'PURCHASE'] } },
        _sum: { amount: true },
      }),
      prisma.creditTransaction.aggregate({
        where: { type: 'USAGE' },
        _sum: { amount: true },
      }),
      prisma.creditTransaction.aggregate({
        where: { type: 'REFUND' },
        _sum: { amount: true },
      }),
      prisma.user.count({ where: { credits: { gt: 0 } } }),
    ]);

    return {
      totalIssued: totalIssued._sum.amount ?? 0,
      totalUsed: Math.abs(totalUsed._sum.amount ?? 0),
      totalRefunded: totalRefunded._sum.amount ?? 0,
      usersWithCredits,
    };
  }
}

export const creditService = new CreditService();