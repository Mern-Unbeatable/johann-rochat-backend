import { Logger } from '../../config/logger.js';
import { catchAsync } from '../../shared/globals/decorators/catch-async.js';
import { ResponseHandler } from '../../shared/globals/helpers/response.handler.js';
import { generationService } from './generation.service.js';
import { generateAdSchema, aiFeatureSchema, updateGenerationTextSchema } from './generation.validation.js';

class GenerationController {
  constructor() {
    this.log = new Logger('GenerationController');
  }

  generateAd = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { listingId } = generateAdSchema.parse(req.body);
    this.log.info(`Generating ad: user=${userId} listing=${listingId}`);
    const generation = await generationService.generateAd(listingId, userId);
    ResponseHandler.created(res, {
      message: 'Ad generated successfully',
      data: { generation },
    });
  });

  useAiFeature = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { listingId, generationId, feature, customPrompt } = aiFeatureSchema.parse(req.body);
    this.log.info(`AI feature: user=${userId} feature=${feature}`);
    const result = await generationService.useAiFeature(
      userId, listingId, generationId, feature, customPrompt ?? null
    );
    ResponseHandler.success(res, {
      message: `Feature "${feature}" applied. ${result.creditCost} credit used.`,
      data: result,
    });
  });

  getListingGenerations = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { listingId } = req.params;
    const generations = await generationService.getListingGenerations(listingId, userId);
    ResponseHandler.success(res, {
      message: 'Generations fetched successfully',
      data: { generations },
    });
  });

  getGenerationById = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const generation = await generationService.getGenerationById(id, userId);
    ResponseHandler.success(res, {
      message: 'Generation fetched successfully',
      data: { generation },
    });
  });


  updateGenerationText = catchAsync(async (req, res) => {
    const adminId = req.user.id;
    const { id } = req.params;
    const { text } = updateGenerationTextSchema.parse(req.body);
    
    this.log.info(`Admin ${adminId} updating generation ${id} text`);
    
    const updated = await generationService.updateGenerationText(id, text, adminId);
    
    ResponseHandler.success(res, {
      message: 'Generation text updated successfully',
      data: { generation: updated },
    });
  });


  getGenerationByImprovement = catchAsync(async (req, res) => {
    const adminId = req.user.id;
    const { improvementId } = req.params;
    
    this.log.info(`Admin ${adminId} fetching generation for improvement ${improvementId}`);
    
    const generation = await generationService.getGenerationByImprovementId(improvementId, adminId);
    
    ResponseHandler.success(res, {
      message: 'Generation fetched successfully',
      data: { generation },
    });
  });
}

export const generationController = new GenerationController();