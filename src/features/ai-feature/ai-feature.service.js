import { prisma } from '../../config/db.js';
import {
  NotFoundError,
  BadRequestError,
  InsufficientCreditsError,
} from '../../shared/globals/helpers/error-handler.js';
import PrismaQueryBuilder from '../../shared/globals/helpers/query-builder.js';
import { openaiService } from './openai.service.js';
import { FEATURE_INSTRUCTIONS } from './feature_instruction.js';
import { promptBuilderService } from './prompt-builder.service.js';

const FEATURE_CREDIT_COST = 1;

class AiFeatureService {

  async applyFeature(userId, { listingId, generationId, feature, customPrompt }) {
    // 1. Credits check
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, credits: true },
    });
    if (!user) throw new NotFoundError('User not found');
    if (user.credits < FEATURE_CREDIT_COST) {
      throw new InsufficientCreditsError(
        `Insufficient credits. Need ${FEATURE_CREDIT_COST} credit. Please purchase a package.`
      );
    }

    // 2. Find generation
    let generation;
    if (generationId) {
      generation = await prisma.generation.findUnique({
        where: { id: generationId },
        include: { listing: { select: { userId: true, id: true } } },
      });
    } else {
      generation = await prisma.generation.findFirst({
        where: { listingId },
        orderBy: { version: 'desc' },
        include: { listing: { select: { userId: true, id: true } } },
      });
    }

    if (!generation) {
      throw new NotFoundError(
        'No generation found. Please generate an ad first using POST /generations/generate'
      );
    }
    if (generation.listing.userId !== userId) throw new BadRequestError('Access denied');
    if (generation.listingId !== listingId) throw new BadRequestError('Generation mismatch');

    // 3. CUSTOM validation
    if (feature === 'CUSTOM' && !customPrompt) {
      throw new BadRequestError('customPrompt is required for CUSTOM feature');
    }

    // 4. Build prompt using prompt builder service
    const prompt = promptBuilderService.buildFeaturePrompt(generation, feature, customPrompt ?? null);

    // 5. OpenAI call using OpenAI service
    const aiResult = await openaiService.callOpenAI(prompt, {
      feature,
      listingId,
      generationId: generation.id
    });

    // 6. Format complete text using OpenAI service
    const fullText = openaiService.formatCompleteAdText(aiResult);

    // 7. Transaction - Update all related records
    const [aiFeatureUsage, updatedGeneration, updatedUser] = await prisma.$transaction([
      prisma.aiFeatureUsage.create({
        data: {
          userId,
          listingId,
          generationId: generation.id,
          feature,
          creditCost: FEATURE_CREDIT_COST,
          resultText: JSON.stringify(aiResult),
        },
      }),
      prisma.generation.update({
        where: { id: generation.id },
        data: {
          title: aiResult.title,
          hook: aiResult.hook,
          description: aiResult.description,
          highlights: aiResult.highlights,
          practicalInfo: aiResult.practicalInfo,
          generatedText: fullText,
          updatedAt: new Date(),
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { credits: { decrement: FEATURE_CREDIT_COST } },
      }),
      prisma.creditTransaction.create({
        data: {
          userId,
          amount: -FEATURE_CREDIT_COST,
          type: 'USAGE',
          reference: `ai_feature:${feature}:gen:${generation.id}`,
        },
      }),
    ]);

    return {
      featureUsageId: aiFeatureUsage.id,
      feature,
      generationId: generation.id,
      customPrompt: customPrompt ?? null,
      result: aiResult,
      fullText: fullText,
      creditsUsed: FEATURE_CREDIT_COST,
      creditsRemaining: updatedUser.credits,
    };
  }

  async getUserFeatureHistory(userId, queryParams = {}) {
    const queryBuilder = new PrismaQueryBuilder(prisma.aiFeatureUsage, queryParams, {
      defaultSort: { createdAt: 'desc' },
      defaultLimit: 10,
      maxLimit: 50,
      omitFields: {},
    });
    queryBuilder._where.userId = userId;
    queryBuilder._include = {
      listing: { select: { id: true, location: true } },
      generation: { select: { id: true, title: true, generatedText: true } },
    };
    return queryBuilder.sort().paginate().execute('usages');
  }

  async getAllFeatureUsages(queryParams = {}) {
    const queryBuilder = new PrismaQueryBuilder(prisma.aiFeatureUsage, queryParams, {
      defaultSort: { createdAt: 'desc' },
      defaultLimit: 20,
      maxLimit: 100,
      omitFields: {},
    });
    queryBuilder._include = {
      user: { select: { id: true, name: true, email: true } },
      listing: { select: { id: true, location: true } },
      generation: { select: { id: true, title: true, version: true } },
    };
    return queryBuilder.filter().sort().paginate().execute('usages');
  }
}

export const aiFeatureService = new AiFeatureService();