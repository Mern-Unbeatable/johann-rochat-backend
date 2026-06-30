import express from 'express';
import { authMiddleware } from '../../shared/globals/helpers/auth-middleware.js';
import { catchAsync } from '../../shared/globals/decorators/catch-async.js';
import { ResponseHandler } from '../../shared/globals/helpers/response.handler.js';
import { prisma } from '../../config/db.js';
import { z } from 'zod';

const router = express.Router();
router.use(authMiddleware.protect, authMiddleware.authorize('ADMIN'));
const createTemplateSchema = z.object({
  name: z.string().min(2, 'Name min 2 chars').max(100),
  content: z.string().min(10, 'Content min 10 chars'),
  isActive: z.boolean().optional().default(false),
});

const updateTemplateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  content: z.string().min(10).optional(),
  isActive: z.boolean().optional(),
});

router.get('/', catchAsync(async (_req, res) => {
  const templates = await prisma.promptTemplate.findMany({
    orderBy: { createdAt: 'desc' },
  });
  ResponseHandler.success(res, {
    message: 'Templates fetched successfully',
    data: { templates },
  });
}));

router.get('/:id', catchAsync(async (req, res) => {
  const template = await prisma.promptTemplate.findUnique({
    where: { id: req.params.id },
  });
  if (!template) {
    return res.status(404).json({
      status: 'error',
      statusCode: 404,
      message: 'Template not found',
    });
  }
  ResponseHandler.success(res, {
    message: 'Template fetched successfully',
    data: { template },
  });
}));

router.post('/', catchAsync(async (req, res) => {
  const data = createTemplateSchema.parse(req.body);

  if (data.isActive) {
    await prisma.promptTemplate.updateMany({
      data: { isActive: false },
    });
  }

  const template = await prisma.promptTemplate.create({ data });

  ResponseHandler.created(res, {
    message: 'Template created successfully',
    data: { template },
  });
}));

router.patch('/:id', catchAsync(async (req, res) => {
  const data = updateTemplateSchema.parse(req.body);

  if (data.isActive === true) {
    await prisma.promptTemplate.updateMany({
      data: { isActive: false },
    });
  }

  const template = await prisma.promptTemplate.update({
    where: { id: req.params.id },
    data,
  });

  ResponseHandler.updated(res, {
    message: 'Template updated successfully',
    data: { template },
  });
}));

router.patch('/:id/activate', catchAsync(async (req, res) => {

  await prisma.promptTemplate.updateMany({
    data: { isActive: false },
  });
  const template = await prisma.promptTemplate.update({
    where: { id: req.params.id },
    data: { isActive: true },
  });
  ResponseHandler.updated(res, {
    message: 'Template activated successfully',
    data: { template },
  });
}));

router.delete('/:id', catchAsync(async (req, res) => {
  await prisma.promptTemplate.delete({
    where: { id: req.params.id },
  });
  ResponseHandler.success(res, {
    message: 'Template deleted successfully',
    data: {},
  });
}));

export const promptTemplateRoutes = router;