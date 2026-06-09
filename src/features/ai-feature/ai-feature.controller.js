import { Logger } from '../../config/logger.js';
import { catchAsync } from '../../shared/globals/decorators/catch-async.js';
import { ResponseHandler } from '../../shared/globals/helpers/response.handler.js';
import { aiFeatureService } from './ai-feature.service.js';
import { applyAiFeatureSchema } from './ai-feature.validation.js';

class AiFeatureController {
  constructor() {
    this.log = new Logger('AiFeatureController');
  }

  applyFeature = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const data = applyAiFeatureSchema.parse(req.body);

    this.log.info(`User ${userId} applying feature: ${data.feature}`);

    const result = await aiFeatureService.applyFeature(userId, data);

    ResponseHandler.success(res, {
      message: `Feature "${data.feature}" applied successfully. ${result.creditsUsed} credit used.`,
      data: result,
    });
  });

  getMyHistory = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const result = await aiFeatureService.getUserFeatureHistory(userId, req.query);

    ResponseHandler.success(res, {
      message: 'Feature usage history fetched successfully',
      data: result,
    });
  });

  getAllUsages = catchAsync(async (req, res) => {
    this.log.info('Admin: fetching all AI feature usages');
    const result = await aiFeatureService.getAllFeatureUsages(req.query);

    ResponseHandler.success(res, {
      message: 'All AI feature usages fetched successfully',
      data: result,
    });
  });
}

export const aiFeatureController = new AiFeatureController();