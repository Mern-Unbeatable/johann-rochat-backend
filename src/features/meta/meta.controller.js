
import { catchAsync } from "../../shared/globals/decorators/catch-async.js";
import { ResponseHandler } from "../../shared/globals/helpers/response.handler.js";
import metaService from "./meta.service.js";

class MetaController {
  getDashboardStats = catchAsync(async (req, res) => {
    const stats = await metaService.getDashboardStats();
    
    ResponseHandler.success(res, {
      message: 'Dashboard statistics fetched successfully',
      data: stats.data
    });
  });
  
  getSimpleStats = catchAsync(async (req, res) => {
    const stats = await metaService.getSimpleStats();
    
    ResponseHandler.success(res, {
      message: 'Simple statistics fetched successfully',
      data: stats
    });
  });
  
}

export default new MetaController();