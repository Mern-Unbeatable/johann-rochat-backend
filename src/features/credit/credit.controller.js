import { Logger } from '../../config/logger.js';
import { catchAsync } from '../../shared/globals/decorators/catch-async.js';
import { ResponseHandler } from '../../shared/globals/helpers/response.handler.js';
import { creditService } from './credit.service.js';
import { z } from 'zod';

const adminAddCreditsSchema = z.object({
  userId: z.string().uuid(),
  amount: z.number().int().refine((v) => v !== 0, 'Amount cannot be 0'),
  reference: z.string().max(200).optional(),
});

class CreditController {
  constructor() {
    this.log = new Logger('CreditController');
  }

  getBalance = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const balance = await creditService.getBalance(userId);

    ResponseHandler.success(res, {
      message: 'Credit balance fetched',
      data: balance,
    });
  });

  getHistory = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const result = await creditService.getTransactionHistory(userId, req.query);

    ResponseHandler.success(res, {
      message: 'Credit history fetched',
      data: result,
    });
  });

  adminAddCredits = catchAsync(async (req, res) => {
    const { userId, amount, reference } = adminAddCreditsSchema.parse(req.body);
    this.log.info(`Admin adding ${amount} credits to user ${userId}`);

    const [updatedUser] = await creditService.adminAddCredits(userId, amount, reference);

    ResponseHandler.success(res, {
      message: `${amount > 0 ? 'Added' : 'Deducted'} ${Math.abs(amount)} credits`,
      data: { user: updatedUser },
    });
  });

  getAllTransactions = catchAsync(async (req, res) => {
    const result = await creditService.getAllTransactions(req.query);

    ResponseHandler.success(res, {
      message: 'All credit transactions fetched',
      data: result,
    });
  });

  getCreditStats = catchAsync(async (_req, res) => {
    const stats = await creditService.getCreditStats();

    ResponseHandler.success(res, {
      message: 'Credit stats fetched',
      data: { stats },
    });
  });
}

export const creditController = new CreditController();