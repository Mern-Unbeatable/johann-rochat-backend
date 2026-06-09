import express from 'express';
import { authMiddleware } from '../../shared/globals/helpers/auth-middleware.js';
import { listingController } from './listing.controller.js';

const router = express.Router();


router.use(authMiddleware.protect);
router.get('/admin', authMiddleware.authorize('ADMIN'), listingController.getAllListings);

router.get('/admin/stats', authMiddleware.authorize('ADMIN'), listingController.getListingStats);

router.patch(
  '/admin/:id/status',
  authMiddleware.authorize('ADMIN'),
  listingController.updateListingStatus,
);

router.post('/', listingController.createListing);
router.get('/my', listingController.getMyListings);
router.get('/:id', listingController.getListingById);
router.patch('/:id', listingController.updateListing);
router.delete('/:id', listingController.deleteListing);
router.post('/:id/photos', listingController.addPhotos);
router.delete('/:id/photos/:photoId', listingController.deletePhoto);

export const listingRoutes = router;
