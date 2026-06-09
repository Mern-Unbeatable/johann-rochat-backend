
import { prisma } from '../../config/db.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../shared/globals/helpers/error-handler.js';
import emailService from './email-service.js';
import ExportTemplates from './export-templates.js';
import PDFService from './pdf-service.js';

class ExportService {
  async createExport(userId, { listingId, generationId, type, emailTo }) {

    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        userId: true,
        status: true,
        location: true,
        title: true,
        rent: true,
        surface: true,
        rooms: true,
      },
    });

    if (!listing) throw new NotFoundError('Listing not found');
    if (listing.userId !== userId) throw new ForbiddenError('Access denied');

    // Check if listing is unlocked for PDF/COPY exports
    if (type === 'PDF' || type === 'COPY') {
      const allowedStatuses = [
        'UNLOCKED',
        'IMPROVEMENT_REQUESTED',
        'IMPROVEMENT_IN_REVIEW',
        'IMPROVEMENT_DONE',
      ];
      if (!allowedStatuses.includes(listing.status)) {
        throw new BadRequestError('Listing must be unlocked to export');
      }
    }

    let generation;
    if (generationId) {
      generation = await prisma.generation.findUnique({ where: { id: generationId } });
      if (!generation || generation.listingId !== listingId) {
        throw new NotFoundError('Generation not found');
      }
    } else {
      generation = await prisma.generation.findFirst({
        where: { listingId },
        orderBy: { version: 'desc' },
      });
    }

    if (!generation) throw new NotFoundError('No generation found. Please generate an ad first.');

    const html = ExportTemplates.buildHtml(listing, generation);
    const plainText = ExportTemplates.buildPlainText(listing, generation);

    let exportData = {};

    if (type === 'COPY') {
      exportData = { text: plainText, html };
    }
    else if (type === 'PDF') {
      try {

        const pdfBuffer = await PDFService.generatePdf(html);
        exportData = { pdfBuffer };

      } catch (error) {
        console.error('PDF generation error:', error);
        throw new BadRequestError(`PDF generation failed: ${error.message}`);
      }
    }
    else if (type === 'EMAIL') {
      if (!emailTo) throw new BadRequestError('emailTo is required for EMAIL export');
      await emailService.sendEmail(emailTo, generation, html);
      exportData = { sent: true, emailTo };
    }

    const exportRecord = await prisma.export.create({
      data: {
        listingId,
        userId,
        generationId: generation.id,
        type,
        emailTo: type === 'EMAIL' ? emailTo : null,
      },
    });

    return { exportRecord, ...exportData };
  }

  async getUserExports(userId, queryParams = {}) {
    const { default: PrismaQueryBuilder } = await import('../../shared/globals/helpers/query-builder.js');
    const queryBuilder = new PrismaQueryBuilder(prisma.export, queryParams, {
      defaultSort: { createdAt: 'desc' },
      defaultLimit: 10,
      maxLimit: 50,
      omitFields: {},
    });

    queryBuilder._where.userId = userId;
    queryBuilder._include = {
      listing: { select: { id: true, title: true, location: true } },
      generation: { select: { id: true, title: true, version: true } },
    };

    return queryBuilder.sort().paginate().execute('exports');
  }

  async getAllExports(queryParams = {}) {
    const { default: PrismaQueryBuilder } = await import('../../shared/globals/helpers/query-builder.js');
    const queryBuilder = new PrismaQueryBuilder(prisma.export, queryParams, {
      defaultSort: { createdAt: 'desc' },
      defaultLimit: 10,
      maxLimit: 100,
      omitFields: {},
    });

    queryBuilder._include = {
      user: { select: { id: true, name: true, email: true } },
      listing: { select: { id: true, title: true, location: true } },
      generation: { select: { id: true, title: true, version: true } },
    };

    return queryBuilder.filter().sort().paginate().execute('exports');
  }
}

export const exportService = new ExportService();
