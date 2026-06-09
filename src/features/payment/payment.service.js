import Stripe from 'stripe';
import { prisma } from '../../config/db.js';
import { config } from '../../config/config.js';
import { Logger } from '../../config/logger.js';

const stripe = new Stripe(config.STRIPE_SECRET_KEY);
const log = new Logger('PaymentService');

export const PRICES = {
  LISTING_UNLOCK: 990,
  IMPROVEMENT_REQUEST: 1500,
};

class PaymentService {
  async _getOrCreateStripeCustomer(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, stripeCustomerId: true },
    });
    if (!user) throw new Error('User not found');
    if (user.stripeCustomerId) return user.stripeCustomerId;

    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: { userId },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });

    log.info(`Stripe customer created for user ${userId}: ${customer.id}`);
    return customer.id;
  }

  async createCheckoutSession({ userId, listingId, type, packageId, userNote }) {
    const stripeCustomerId = await this._getOrCreateStripeCustomer(userId);

    let lineItems = [];
    let metadata = { userId, type };
    let pendingImprovementRequestId = null;
    let credits = 0;

    if (type === 'LISTING_UNLOCK') {
      const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        select: { id: true, status: true, userId: true },
      });
      if (!listing) throw new Error('Listing not found');
      if (listing.userId !== userId) throw new Error('Access denied');
      if (listing.status !== 'DRAFT') {
        throw new Error(`Listing status is "${listing.status}". Only DRAFT listings can be unlocked.`);
      }
      metadata.listingId = listingId;
      lineItems = [{
        price_data: {
          currency: 'chf',
          product_data: {
            name: 'Débloquez votre annonce immobilière',
            description: "Génération IA d'une annonce professionnelle en français",
          },
          unit_amount: PRICES.LISTING_UNLOCK,
        },
        quantity: 1,
      }];

    } else if (type === 'IMPROVEMENT_REQUEST') {
      const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        select: { id: true, status: true, userId: true },
      });
      if (!listing) throw new Error('Listing not found');
      if (listing.userId !== userId) throw new Error('Access denied');

      const improvementRequest = await prisma.improvementRequest.create({
        data: { userId, listingId, status: 'PENDING', userNote: userNote ?? null },
      });
      pendingImprovementRequestId = improvementRequest.id;
      metadata.listingId = listingId;
      metadata.improvementRequestId = improvementRequest.id;
      lineItems = [{
        price_data: {
          currency: 'chf',
          product_data: {
            name: 'Avis professionnel immobilier',
            description: 'Votre annonce est analysée et améliorée par un expert',
          },
          unit_amount: PRICES.IMPROVEMENT_REQUEST,
        },
        quantity: 1,
      }];

    } else if (type === 'PACKAGE') {
      if (!packageId) throw new Error('packageId is required for PACKAGE type');
      const pkg = await prisma.package.findUnique({
        where: { id: packageId, isActive: true },
        select: { id: true, name: true, description: true, price: true, credits: true, pricePerCredit: true },
      });
      if (!pkg) throw new Error('Package not found or inactive');

      credits = pkg.credits;
      metadata.packageId = packageId;
      lineItems = [{
        price_data: {
          currency: 'chf',
          product_data: {
            name: pkg.name,
            description: `${pkg.credits} crédits IA — ${pkg.description}`,
          },
          unit_amount: Math.round(pkg.price * 100),
        },
        quantity: 1,
      }];
    }


    const clientUrl = config.CLIENT_URL || config.CLIENT_URLS?.split(',')[0]?.trim();

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${clientUrl}/creer-annonce/ready?session_id={CHECKOUT_SESSION_ID}&success=true&type=${type}`,
      cancel_url: `${clientUrl}/creer-annonce/ready?canceled=true`,
      metadata,
    });

    await prisma.payment.create({
      data: {
        userId,
        amount: lineItems[0].price_data.unit_amount / 100,
        credits,
        type,
        status: 'PENDING',
        stripeSessionId: session.id,
        stripePaymentIntentId: '',
        stripeCustomerId,
        packageId: packageId ?? null,
        ...(pendingImprovementRequestId && {
          improvementRequest: { connect: { id: pendingImprovementRequestId } },
        }),
      },
    });

    log.info(`Checkout created: ${session.id} type=${type} user=${userId}`);
    return { url: session.url, sessionId: session.id };
  }

  // ── WEBHOOK — idempotent
  async handleWebhook(rawBody, signature) {
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        config.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      log.error(`Webhook signature failed: ${err.message}`);
      log.error(`Secret prefix: ${config.STRIPE_WEBHOOK_SECRET?.substring(0, 15)}...`);
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }

    log.info(`Webhook event received: ${event.type}`);

    if (event.type === 'checkout.session.completed') {
      await this._handleCheckoutCompleted(event.data.object);
    }
    return { received: true };
  }

  // ── WEBHOOK HANDLER 
  async _handleCheckoutCompleted(session) {
    const { userId, listingId, type, packageId, improvementRequestId } = session.metadata;
    log.info(`Webhook _handleCheckoutCompleted: type=${type} user=${userId} session=${session.id}`);


    const updateResult = await prisma.payment.updateMany({
      where: {
        stripeSessionId: session.id,
        status: 'PENDING', // ← KEY guard
      },
      data: {
        status: 'SUCCESS',
        stripePaymentIntentId: session.payment_intent ?? '',
      },
    });

    if (updateResult.count === 0) {
      log.info(`Webhook: session ${session.id} already processed — skipping`);
      return;
    }

    log.info(`Webhook: processing ${type} for user ${userId}`);

    if (type === 'LISTING_UNLOCK') {
      await this._handleListingUnlock(userId, listingId);
    } else if (type === 'IMPROVEMENT_REQUEST') {
      await this._handleImprovementRequestPaid(listingId, improvementRequestId);
    } else if (type === 'PACKAGE') {
      await this._handlePackagePurchase(userId, packageId, session.id);
    }
  }

  // ── VERIFY AND UNLOCK — also idempotent ───────────────────────────────
  // async verifyAndUnlockIfPaid(sessionId, userId) {
  //   log.info(`verifyAndUnlockIfPaid: session=${sessionId} user=${userId}`);

  //   const session = await stripe.checkout.sessions.retrieve(sessionId);
  //   log.info(`Stripe session payment_status: ${session.payment_status}`);

  //   if (session.payment_status !== 'paid') {
  //     log.warn(`Session ${sessionId} not paid yet`);
  //     return { paid: false };
  //   }

  //   const { type, packageId, listingId } = session.metadata;

  //   // Atomic update — শুধু PENDING থাকলেই চলবে
  //   const updateResult = await prisma.payment.updateMany({
  //     where: {
  //       stripeSessionId: sessionId,
  //       userId: userId,
  //       status: 'PENDING', // ← KEY guard
  //     },
  //     data: {
  //       status: 'SUCCESS',
  //       stripePaymentIntentId: session.payment_intent ?? '',
  //     },
  //   });

  //   if (updateResult.count === 0) {
  //     // ইতিমধ্যে webhook process করে ফেলেছে
  //     log.info(`Session ${sessionId} already processed — returning current credits`);
  //     const user = await prisma.user.findUnique({
  //       where: { id: userId },
  //       select: { credits: true },
  //     });
  //     return {
  //       paid: true,
  //       alreadyProcessed: true,
  //       creditsRemaining: user?.credits ?? 0,
  //     };
  //   }

  //   // প্রথমবার process হচ্ছে
  //   log.info(`First time processing: type=${type} user=${userId}`);
  //   let creditsRemaining = 0;

  //   if (type === 'PACKAGE') {
  //     const pkg = await prisma.package.findUnique({
  //       where: { id: packageId },
  //       select: { credits: true, name: true },
  //     });

  //     if (!pkg) {
  //       log.error(`Package ${packageId} not found`);
  //       throw new Error('Package not found');
  //     }

  //     log.info(`Adding ${pkg.credits} credits to user ${userId} for "${pkg.name}"`);

  //     const [updatedUser] = await prisma.$transaction([
  //       prisma.user.update({
  //         where: { id: userId },
  //         data: { credits: { increment: pkg.credits } },
  //       }),
  //       prisma.creditTransaction.create({
  //         data: {
  //           userId,
  //           amount: pkg.credits,
  //           type: 'PURCHASE',
  //           reference: `package:${packageId}:session:${sessionId}`,
  //         },
  //       }),
  //     ]);

  //     creditsRemaining = updatedUser.credits;
  //     log.info(`User ${userId} now has ${creditsRemaining} credits`);

  //   } else if (type === 'LISTING_UNLOCK') {
  //     await this._handleListingUnlock(userId, listingId);
  //     const user = await prisma.user.findUnique({
  //       where: { id: userId },
  //       select: { credits: true },
  //     });
  //     creditsRemaining = user?.credits ?? 0;

  //   } else if (type === 'IMPROVEMENT_REQUEST') {
  //     const { improvementRequestId } = session.metadata;
  //     await this._handleImprovementRequestPaid(listingId, improvementRequestId);
  //     const user = await prisma.user.findUnique({
  //       where: { id: userId },
  //       select: { credits: true },
  //     });
  //     creditsRemaining = user?.credits ?? 0;
  //   }

  //   return { paid: true, alreadyProcessed: false, creditsRemaining };
  // }


  async verifyAndUnlockIfPaid(sessionId, userId) {
    log.info(`verifyAndUnlockIfPaid: session=${sessionId} user=${userId}`);

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    log.info(`Stripe session payment_status: ${session.payment_status}`);

    if (session.payment_status !== 'paid') {
      log.warn(`Session ${sessionId} not paid yet`);
      return { paid: false };
    }

    const { type, packageId, listingId } = session.metadata;

    // Atomic update — only process if PENDING
    const updateResult = await prisma.payment.updateMany({
      where: {
        stripeSessionId: sessionId,
        userId: userId,
        status: 'PENDING',
      },
      data: {
        status: 'SUCCESS',
        stripePaymentIntentId: session.payment_intent ?? '',
      },
    });

    if (updateResult.count === 0) {
      log.info(`Session ${sessionId} already processed — returning current credits`);
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { credits: true, packageId: true, package: true },
      });
      return {
        paid: true,
        alreadyProcessed: true,
        creditsRemaining: user?.credits ?? 0,
        packageId: user?.packageId,
        package: user?.package,
      };
    }

    // First time processing
    log.info(`First time processing: type=${type} user=${userId}`);
    let creditsRemaining = 0;
    let updatedPackageId = null;
    let updatedPackage = null;

    if (type === 'PACKAGE') {
      const pkg = await prisma.package.findUnique({
        where: { id: packageId },
        select: { credits: true, name: true, id: true, slug: true, price: true, description: true, features: true },
      });

      if (!pkg) {
        log.error(`Package ${packageId} not found`);
        throw new Error('Package not found');
      }

      log.info(`Adding ${pkg.credits} credits to user ${userId} for "${pkg.name}"`);

      const [updatedUser] = await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: {
            credits: { increment: pkg.credits },
            packageId: packageId
          },
        }),
        prisma.creditTransaction.create({
          data: {
            userId,
            amount: pkg.credits,
            type: 'PURCHASE',
            reference: `package:${packageId}:session:${sessionId}`,
          },
        }),
      ]);

      creditsRemaining = updatedUser.credits;
      updatedPackageId = updatedUser.packageId;

      // Fetch the updated package details
      updatedPackage = await prisma.package.findUnique({
        where: { id: updatedPackageId },
        select: { id: true, name: true, slug: true, credits: true, price: true, description: true, features: true },
      });

      log.info(`User ${userId} now has ${creditsRemaining} credits, package: ${updatedPackageId}`);

    } else if (type === 'LISTING_UNLOCK') {
      await this._handleListingUnlock(userId, listingId);
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { credits: true, packageId: true, package: true },
      });
      creditsRemaining = user?.credits ?? 0;
      updatedPackageId = user?.packageId;
      updatedPackage = user?.package;

    } else if (type === 'IMPROVEMENT_REQUEST') {
      const { improvementRequestId } = session.metadata;
      await this._handleImprovementRequestPaid(listingId, improvementRequestId);
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { credits: true, packageId: true, package: true },
      });
      creditsRemaining = user?.credits ?? 0;
      updatedPackageId = user?.packageId;
      updatedPackage = user?.package;
    }

    return {
      paid: true,
      alreadyProcessed: false,
      creditsRemaining,
      packageId: updatedPackageId,
      package: updatedPackage
    };
  }

  async _handleListingUnlock(userId, listingId) {
    if (!userId || !listingId) throw new Error('userId and listingId required');
    await prisma.$transaction([
      prisma.listing.update({ where: { id: listingId }, data: { status: 'UNLOCKED' } }),
      prisma.user.update({ where: { id: userId }, data: { credits: { increment: 1 } } }),
      prisma.creditTransaction.create({
        data: { userId, amount: 1, type: 'FREE', reference: `listing_unlock:${listingId}` },
      }),
    ]);
    log.info(`Listing ${listingId} UNLOCKED + 1 credit for user ${userId}`);
  }

  async _handleImprovementRequestPaid(listingId, improvementRequestId) {
    await prisma.$transaction([
      prisma.listing.update({ where: { id: listingId }, data: { status: 'IMPROVEMENT_REQUESTED' } }),
      prisma.improvementRequest.update({
        where: { id: improvementRequestId },
        data: { status: 'PENDING' },
      }),
    ]);
    log.info(`Improvement request ${improvementRequestId} activated`);
  }


  // async _handlePackagePurchase(userId, packageId, sessionId = null) {
  //   const pkg = await prisma.package.findUnique({
  //     where: { id: packageId },
  //     select: { credits: true, name: true },
  //   });

  //   if (!pkg) {
  //     log.error(`Package ${packageId} not found`);
  //     return;
  //   }

  //   const reference = sessionId
  //     ? `package:${packageId}:session:${sessionId}`
  //     : `package:${packageId}`;

  //   const [updatedUser] = await prisma.$transaction([
  //     prisma.user.update({
  //       where: { id: userId },
  //       data: { credits: { increment: pkg.credits } },
  //     }),
  //     prisma.creditTransaction.create({
  //       data: { userId, amount: pkg.credits, type: 'PURCHASE', reference },
  //     }),
  //   ]);

  //   log.info(`Package "${pkg.name}": +${pkg.credits} credits → user ${userId} now has ${updatedUser.credits}`);
  // }
  // In payment.service.js - Update the _handlePackagePurchase method

  // In payment.service.js - Update _handlePackagePurchase method

  async _handlePackagePurchase(userId, packageId, sessionId = null) {
    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
      select: { credits: true, name: true, price: true, id: true },
    });

    if (!pkg) {
      log.error(`Package ${packageId} not found`);
      return;
    }

    const reference = sessionId
      ? `package:${packageId}:session:${sessionId}`
      : `package:${packageId}`;

    // Get current user to check existing package
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { packageId: true }
    });

    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          credits: { increment: pkg.credits },
          packageId: packageId
        },
      }),
      prisma.creditTransaction.create({
        data: {
          userId,
          amount: pkg.credits,
          type: 'PURCHASE',
          reference
        },
      }),
    ]);

    log.info(`Package "${pkg.name}": +${pkg.credits} credits → user ${userId} now has ${updatedUser.credits} credits, package: ${packageId}`);

    return updatedUser;
  }

  getPaymentHistory = async (userId, queryParams = {}) => {
    try {
      const page = parseInt(queryParams.page) || 1;
      const limit = Math.min(parseInt(queryParams.limit) || 10, 50);
      const skip = (page - 1) * limit;

      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where: { userId, status: 'SUCCESS' },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          select: {
            id: true, amount: true, credits: true, type: true, status: true,
            stripeSessionId: true, createdAt: true,
            package: { select: { id: true, name: true } },
            user: { select: { id: true, name: true, email: true } },
          },
        }),
        prisma.payment.count({ where: { userId, status: 'SUCCESS' } }),
      ]);

      const transformedPayments = payments.map(payment => ({
        id: payment.id,
        name: payment.user?.name || 'N/A',
        email: payment.user?.email || 'N/A',
        amount: payment.amount,
        credits: payment.credits,
        type: payment.type,
        status: payment.status === 'SUCCESS' ? 'PAYÉ' : payment.status,
        package: payment.package?.name || 'N/A',
        packageId: payment.package?.id,
        date: payment.createdAt,
        stripeSessionId: payment.stripeSessionId,
      }));

      return {
        meta: { page, limit, total, totalPage: Math.ceil(total / limit) },
        payments: transformedPayments,
      };
    } catch (error) {
      console.error('Error in getPaymentHistory:', error);
      throw error;
    }
  };

  async verifySession(sessionId, userId) {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const payment = await prisma.payment.findFirst({
      where: { stripeSessionId: sessionId, userId },
      select: { id: true, type: true, status: true, amount: true, credits: true },
    });
    if (!payment) throw new Error('Payment not found');
    return {
      paid: payment.status === 'SUCCESS',
      type: payment.type,
      payment,
      sessionStatus: session.payment_status,
    };
  }

  async devUnlockListing(userId, listingId) {
    if (config.NODE_ENV !== 'development') {
      throw new Error('Dev unlock only available in development mode');
    }
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { userId: true, status: true },
    });
    if (!listing) throw new Error('Listing not found');
    if (listing.userId !== userId) throw new Error('Access denied');
    if (listing.status === 'UNLOCKED') throw new Error('Listing already unlocked');
    await this._handleListingUnlock(userId, listingId);
    return { message: 'Listing unlocked (dev mode)', listingId };
  }

  getAllPayments = async (queryParams = {}) => {
    try {
      const { search, status, type, userId, packageId, page, limit, sort } = queryParams;
      let whereCondition = {};

      if (status) {
        const statusMap = { 'PAYÉ': 'SUCCESS', 'EN ATTENTE': 'PENDING', 'SUCCESS': 'SUCCESS', 'PENDING': 'PENDING', 'FAILED': 'FAILED' };
        whereCondition.status = statusMap[status] || status;
      }
      if (type) whereCondition.type = type;
      if (userId) whereCondition.userId = userId;
      if (packageId) whereCondition.packageId = packageId;

      let searchCondition = {};
      if (search && search.trim()) {
        const searchLower = search.toLowerCase().trim();
        if (searchLower === 'payé' || searchLower === 'paye' || searchLower === 'success') {
          whereCondition.status = 'SUCCESS';
        } else if (searchLower === 'en attente' || searchLower === 'pending') {
          whereCondition.status = 'PENDING';
        } else if (searchLower === 'failed' || searchLower === 'échoué') {
          whereCondition.status = 'FAILED';
        } else {
          searchCondition = {
            OR: [
              { user: { name: { contains: search, mode: 'insensitive' } } },
              { user: { email: { contains: search, mode: 'insensitive' } } },
              { package: { name: { contains: search, mode: 'insensitive' } } },
            ],
          };
        }
      }

      const finalWhere = { ...whereCondition, ...searchCondition };
      const pageNum = parseInt(page) || 1;
      const limitNum = Math.min(parseInt(limit) || 10, 50);
      const skip = (pageNum - 1) * limitNum;

      let orderBy = { createdAt: 'desc' };
      if (sort) {
        const [field, order] = sort.startsWith('-') ? [sort.substring(1), 'desc'] : [sort, 'asc'];
        orderBy = { [field]: order };
      }

      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where: finalWhere, orderBy, skip, take: limitNum,
          include: {
            user: { select: { id: true, name: true, email: true, role: true, credits: true, createdAt: true } },
            package: { select: { id: true, name: true, slug: true, price: true, credits: true } },
          },
        }),
        prisma.payment.count({ where: finalWhere }),
      ]);

      const transformedPayments = payments.map(payment => ({
        id: payment.id,
        userId: payment.userId,
        amount: payment.amount,
        credits: payment.credits,
        type: payment.type,
        status: payment.status,
        createdAt: payment.createdAt,
        stripeSessionId: payment.stripeSessionId,
        stripePaymentIntentId: payment.stripePaymentIntentId,
        user: {
          id: payment.user?.id,
          name: payment.user?.name || 'N/A',
          email: payment.user?.email || 'N/A',
          role: payment.user?.role || 'USER',
          credits: payment.user?.credits || 0,
          joinedAt: payment.user?.createdAt,
        },
        package: payment.package ? {
          id: payment.package.id,
          name: payment.package.name,
          slug: payment.package.slug,
          price: payment.package.price,
          credits: payment.package.credits,
        } : null,
      }));

      return {
        meta: { page: pageNum, limit: limitNum, total, totalPage: Math.ceil(total / limitNum) },
        payments: transformedPayments,
      };
    } catch (error) {
      console.error('Error in getAllPayments:', error);
      throw error;
    }
  };
}

export const paymentService = new PaymentService();