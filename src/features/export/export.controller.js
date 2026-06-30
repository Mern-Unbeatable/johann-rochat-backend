// export.controller.js
import { Logger } from '../../config/logger.js';
import { catchAsync } from '../../shared/globals/decorators/catch-async.js';
import { ResponseHandler } from '../../shared/globals/helpers/response.handler.js';
import { exportService } from './export.service.js';
import { createExportSchema } from './export.validation.js';

class ExportController {
  constructor() {
    this.log = new Logger('ExportController');
  }

  createExport = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const data = createExportSchema.parse(req.body);

    this.log.info(`User ${userId} exporting listing ${data.listingId} as ${data.type}`);

    try {
      const result = await exportService.createExport(userId, data);
      
      if (data.type === 'PDF' && result.pdfBuffer) {
        this.log.info(`PDF generated successfully for user ${userId}, size: ${result.pdfBuffer.length} bytes`);
        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="annonce-${data.listingId}.pdf"`,
          'Content-Length': result.pdfBuffer.length,
        });
        return res.send(result.pdfBuffer);
      }

      ResponseHandler.success(res, {
        message: `Export (${data.type}) completed successfully`,
        data: {
          exportId: result.exportRecord.id,
          type: data.type,
          ...(data.type === 'COPY' && { text: result.text, html: result.html }),
          ...(data.type === 'EMAIL' && { sent: result.sent, emailTo: result.emailTo }),
        },
      });
    } catch (error) {
      this.log.error(`Export failed for user ${userId}: ${error.message}`);
      throw error;
    }
  });

  getMyExports = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const result = await exportService.getUserExports(userId, req.query);

    ResponseHandler.success(res, {
      message: 'Export history fetched successfully',
      data: result,
    });
  });

  getAllExports = catchAsync(async (req, res) => {
    this.log.info('Admin: fetching all exports');
    const result = await exportService.getAllExports(req.query);

    ResponseHandler.success(res, {
      message: 'All exports fetched',
      data: result,
    });
  });
}

export const exportController = new ExportController();