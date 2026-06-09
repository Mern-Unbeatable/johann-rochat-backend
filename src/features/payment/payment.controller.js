import { Logger } from '../../config/logger.js';
import { catchAsync } from '../../shared/globals/decorators/catch-async.js';
import { ResponseHandler } from '../../shared/globals/helpers/response.handler.js';
import { paymentService } from './payment.service.js';
import { createCheckoutSchema, createImprovementPaymentSchema } from './payment.validation.js';

class PaymentController {
  constructor() {
    this.log = new Logger('PaymentController');
  }

  createCheckout = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const parsed = createCheckoutSchema.parse(req.body);
    this.log.info(`Checkout: user=${userId} type=${parsed.type}`);
    const result = await paymentService.createCheckoutSession({
      userId,
      listingId: parsed.listingId ?? null,
      type: parsed.type,
      packageId: parsed.packageId ?? null,
    });
    ResponseHandler.created(res, {
      message: 'Checkout session created.',
      data: result,
    });
  });

  createImprovementCheckout = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { listingId, userNote } = createImprovementPaymentSchema.parse(req.body);
    this.log.info(`Improvement checkout: user=${userId} listing=${listingId}`);
    const result = await paymentService.createCheckoutSession({
      userId,
      listingId,
      type: 'IMPROVEMENT_REQUEST',
      userNote,
    });
    ResponseHandler.created(res, {
      message: 'Improvement checkout session created.',
      data: result,
    });
  });

  verifySession = catchAsync(async (req, res) => {
    const { session_id } = req.query;
    const userId = req.user.id;
    if (!session_id) throw new Error('session_id query param is required');
    const result = await paymentService.verifySession(session_id, userId);
    ResponseHandler.success(res, { message: 'Session verified', data: result });
  });

  verifyAndUnlock = catchAsync(async (req, res) => {
    const session_id = req.query.session_id || req.body?.session_id;
    const userId = req.user.id;

    if (!session_id) throw new Error('session_id is required');

    this.log.info(`verifyAndUnlock called: session=${session_id} user=${userId} method=${req.method}`);

    const result = await paymentService.verifyAndUnlockIfPaid(session_id, userId);

    ResponseHandler.success(res, {
      message: result.paid ? 'Payment verified and credits added' : 'Payment not completed yet',
      data: result,
    });
  });

  getHistory = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const result = await paymentService.getPaymentHistory(userId, req.query);
    ResponseHandler.success(res, {
      message: 'Payment history fetched successfully',
      data: result,
    });
  });

  handleWebhook = async (req, res) => {
    const signature = req.headers['stripe-signature'];
    try {
      const result = await paymentService.handleWebhook(req.body, signature);
      return res.json(result);
    } catch (err) {
      this.log.error(`Webhook error: ${err.message}`);
      return res.status(400).json({ error: 'Webhook failed verification' });
    }
  };

  manualProcess = catchAsync(async (req, res) => {
    const { sessionId, userId: targetUserId } = req.body;
    if (!sessionId) throw new Error('sessionId is required');
    
    this.log.info(`Manual process: session=${sessionId} by admin=${req.user.id}`);
    const result = await paymentService.verifyAndUnlockIfPaid(sessionId, targetUserId);
    
    ResponseHandler.success(res, {
      message: 'Manual process completed',
      data: result,
    });
  });

  devUnlock = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { listingId } = req.body;
    if (!listingId) throw new Error('listingId is required');
    const result = await paymentService.devUnlockListing(userId, listingId);
    ResponseHandler.success(res, { message: result.message, data: result });
  });

  getAllPayments = catchAsync(async (req, res) => {
    const result = await paymentService.getAllPayments(req.query);
    ResponseHandler.success(res, {
      message: 'All payments fetched successfully',
      data: result,
    });
  });
}

export const paymentController = new PaymentController();