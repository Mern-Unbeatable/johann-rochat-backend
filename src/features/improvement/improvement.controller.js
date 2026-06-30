import { Logger } from '../../config/logger.js';
import { catchAsync } from '../../shared/globals/decorators/catch-async.js';
import { ResponseHandler } from '../../shared/globals/helpers/response.handler.js';
import { improvementService } from './improvement.service.js';
import {
  createImprovementRequestSchema,
  addSuggestionsSchema,
  updateImprovementStatusSchema,
  applyUserSuggestionSchema,
} from './improvement.validation.js';

class ImprovementController {
  constructor() {
    this.log = new Logger('ImprovementController');
  }

  createRequest = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const data = createImprovementRequestSchema.parse(req.body);

    this.log.info(`User ${userId} creating improvement request for listing ${data.listingId}`);

    const request = await improvementService.createRequest(userId, {
      ...data,
      paymentId: req.body.paymentId ?? null,
    });

    ResponseHandler.created(res, {
      message: 'Improvement request submitted successfully. Admin will review your listing.',
      data: { request },
    });
  });

  getMyRequests = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const result = await improvementService.getUserRequests(userId, req.query);

    ResponseHandler.success(res, {
      message: 'Your improvement requests fetched successfully',
      data: result,
    });
  });


  getRequestById = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'ADMIN';

    const request = await improvementService.getRequestById(
      req.params.id,
      userId,
      isAdmin
    );

    ResponseHandler.success(res, {
      message: 'Improvement request fetched successfully',
      data: { request },
    });
  });
  applyUserSuggestion = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const data = applyUserSuggestionSchema.parse(req.body);

    this.log.info(`User ${userId} applying suggestion ${data.suggestionId}`);

    const result = await improvementService.applyUserSuggestion(
      userId,
      req.params.id,
      data
    );

    ResponseHandler.success(res, {
      message: `Suggestion applied: "${result.fieldName}" updated successfully`,
      data: result,
    });
  });

  getAllRequests = catchAsync(async (req, res) => {
    this.log.info('Admin fetching all improvement requests');
    const result = await improvementService.getAllRequests(req.query);

    ResponseHandler.success(res, {
      message: 'All improvement requests fetched',
      data: result,
    });
  });

  getStats = catchAsync(async (_req, res) => {
    const stats = await improvementService.getStats();

    ResponseHandler.success(res, {
      message: 'Improvement stats fetched',
      data: { stats },
    });
  });

  updateStatus = catchAsync(async (req, res) => {
    const data = updateImprovementStatusSchema.parse(req.body);

    this.log.info(`Admin updating request ${req.params.id} to status: ${data.status}`);

    const updated = await improvementService.updateStatus(req.params.id, data);

    ResponseHandler.updated(res, {
      message: `Request status updated to "${data.status}"`,
      data: { request: updated },
    });
  });


  addSuggestions = catchAsync(async (req, res) => {
    const data = addSuggestionsSchema.parse(req.body);

    this.log.info(`Admin adding ${data.suggestions.length} suggestions to request ${req.params.id}`);

    const updated = await improvementService.addSuggestions(req.params.id, data);

    ResponseHandler.created(res, {
      message: `${data.suggestions.length} suggestion(s) added. User will be notified.`,
      data: { request: updated },
    });
  });

  completeRequest = catchAsync(async (req, res) => {
    const { adminNote } = req.body;

    this.log.info(`Admin completing request ${req.params.id}`);

    const updated = await improvementService.completeRequest(req.params.id, adminNote);

    ResponseHandler.updated(res, {
      message: 'Improvement request marked as completed',
      data: { request: updated },
    });
  });
}

export const improvementController = new ImprovementController();