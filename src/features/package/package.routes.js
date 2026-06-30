import express from 'express';
import { authMiddleware } from '../../shared/globals/helpers/auth-middleware.js';
import { packageController } from './package.controller.js';

const router = express.Router();

router.get(
  '/',
  packageController.getAllPackages
);

router.post(
  '/',
  authMiddleware.protect,
  authMiddleware.authorize('ADMIN'),
  packageController.createPackage
);

router.get(
  '/:id',
  packageController.getPackageById
);

router.patch(
  '/:id',
  authMiddleware.protect,
  authMiddleware.authorize('ADMIN'),
  packageController.updatePackage
);

router.delete(
  '/:id',
  authMiddleware.protect,
  authMiddleware.authorize('ADMIN'),
  packageController.deletePackage
);


export const packageRoutes = router;