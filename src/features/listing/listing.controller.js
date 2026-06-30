import { Logger } from '../../config/logger.js';
import { catchAsync } from '../../shared/globals/decorators/catch-async.js';
import { ResponseHandler } from '../../shared/globals/helpers/response.handler.js';
import { listingService } from './listing.service.js';
import { createListingSchema, updateListingSchema, photosSchema } from './listing.validation.js';
import {
  ForbiddenError,
  NotFoundError,
  BadRequestError,
} from '../../shared/globals/helpers/error-handler.js';

const VALID_STATUSES = [
  'DRAFT',
  'PREVIEW',
  'PAID',
  'UNLOCKED',
  'IMPROVEMENT_REQUESTED',
  'IMPROVEMENT_IN_REVIEW',
  'IMPROVEMENT_DONE',
];

class ListingController {
  constructor() {
    this.log = new Logger('ListingController');
  }

  createListing = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const data = createListingSchema.parse(req.body);

    console.log('check body', req.body);

    this.log.info(`Creating listing for user: ${userEmail} (${userId})`);
    const user = await listingService.getUserCredits(userId);

    if (!user.freeAdUsed && user.credits >= 1) {
      this.log.info(`User ${userEmail} creating listing with free ad`);
    } else if (user.credits >= 1) {
      this.log.info(`User ${userEmail} creating listing with ${user.credits} credits`);
    }

    // else {
    //   throw new BadRequestError(
    //     'Insufficient credits. Please purchase credits or use your free ad.',
    //   );
    // }

    const listing = await listingService.createListing(userId, data, user);

    ResponseHandler.created(res, {
      message: user.freeAdUsed
        ? 'Listing created successfully using credits.'
        : 'Listing created successfully using your free ad.',
      data: {
        listing,
        creditsRemaining: user.freeAdUsed ? user.credits - 1 : user.credits,
        freeAdUsed: user.freeAdUsed,
      },
    });
  });

  getMyListings = catchAsync(async (req, res) => {
    const userId = req.user.id;
    this.log.info(`Fetching listings for user: ${userId}`);

    const result = await listingService.getUserListings(userId, req.query);

    ResponseHandler.success(res, {
      message: 'Listings fetched successfully',
      data: result,
    });
  });

  getListingById = catchAsync(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'ADMIN';

    const listing = await listingService.getListingById(id);

    if (!listing) {
      throw new NotFoundError('Listing not found');
    }

    if (listing.userId !== userId && !isAdmin) {
      throw new ForbiddenError('You do not have permission to view this listing');
    }

    ResponseHandler.success(res, {
      message: 'Listing fetched successfully',
      data: { listing },
    });
  });

  updateListing = catchAsync(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const { listing, isOwner } = await listingService.isOwner(id, userId);

    if (!listing) {
      throw new NotFoundError('Listing not found');
    }

    if (!isOwner) {
      throw new ForbiddenError('You do not have permission to update this listing');
    }
    if (listing.status !== 'DRAFT') {
      throw new BadRequestError(
        'Only DRAFT listings can be edited. Current status: ' + listing.status,
      );
    }

    const data = updateListingSchema.parse(req.body);

    const updated = await listingService.updateListing(id, data);

    ResponseHandler.updated(res, {
      message: 'Listing updated successfully',
      data: { listing: updated },
    });
  });

  deleteListing = catchAsync(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'ADMIN';

    const { listing, isOwner } = await listingService.isOwner(id, userId);

    if (!listing) {
      throw new NotFoundError('Listing not found');
    }

    if (!isOwner && !isAdmin) {
      throw new ForbiddenError('You do not have permission to delete this listing');
    }

    await listingService.deleteListing(id);

    this.log.info(`Listing ${id} deleted by user ${userId}`);

    ResponseHandler.success(res, {
      message: 'Listing deleted successfully',
      data: { deletedAt: new Date().toISOString() },
    });
  });

  addPhotos = catchAsync(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const { listing, isOwner } = await listingService.isOwner(id, userId);

    if (!listing) {
      throw new NotFoundError('Listing not found');
    }

    if (!isOwner) {
      throw new ForbiddenError('You do not have permission to add photos to this listing');
    }

    const { photos } = photosSchema.parse(req.body);

    await listingService.addPhotos(id, photos);
    const updatedPhotos = await listingService.getPhotos(id);

    ResponseHandler.created(res, {
      message: 'Photos uploaded successfully',
      data: { photos: updatedPhotos },
    });
  });

  deletePhoto = catchAsync(async (req, res) => {
    const { id, photoId } = req.params;
    const userId = req.user.id;

    const { listing, isOwner } = await listingService.isOwner(id, userId);

    if (!listing) {
      throw new NotFoundError('Listing not found');
    }

    if (!isOwner) {
      throw new ForbiddenError('You do not have permission to delete this photo');
    }

    await listingService.deletePhoto(photoId, id);

    ResponseHandler.success(res, {
      message: 'Photo deleted successfully',
      data: {},
    });
  });

  getAllListings = catchAsync(async (req, res) => {
    this.log.info('Admin: fetching all listings');
    const result = await listingService.getAllListings(req.query);

    ResponseHandler.success(res, {
      message: 'All listings fetched successfully',
      data: result,
    });
  });

  getListingStats = catchAsync(async (_req, res) => {
    this.log.info('Admin: fetching listing stats');
    const stats = await listingService.getListingStats();

    ResponseHandler.success(res, {
      message: 'Listing stats fetched successfully',
      data: { stats },
    });
  });

  updateListingStatus = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      throw new BadRequestError('Status is required');
    }

    const upperStatus = status.toUpperCase();

    if (!VALID_STATUSES.includes(upperStatus)) {
      throw new BadRequestError(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const listing = await listingService.getListingById(id);

    if (!listing) {
      throw new NotFoundError('Listing not found');
    }

    const updated = await listingService.updateStatus(id, upperStatus);

    this.log.info(`Admin updated listing ${id} status to ${upperStatus}`);

    ResponseHandler.updated(res, {
      message: `Listing status updated to ${upperStatus}`,
      data: { listing: updated },
    });
  });
}

export const listingController = new ListingController();
