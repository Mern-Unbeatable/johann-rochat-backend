
import { prisma } from '../../config/db.js';
import PrismaQueryBuilder from '../../shared/globals/helpers/query-builder.js';
import { BadRequestError } from '../../shared/globals/helpers/error-handler.js';

class ListingService {
  async getUserCredits(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        credits: true,
        freeAdUsed: true,
      },
    });

    if (!user) {
      throw new BadRequestError('User not found');
    }

    return user;
  }

  async createListing(userId, data, user) {
    return await prisma.$transaction(async (tx) => {
      const listing = await tx.listing.create({
        data: {
          userId,
          location: data.location,
          propertyType: data.propertyType,
          surface: data.surface ?? null,
          rooms: data.rooms ?? null,
          floor: data.floor ?? null,
          hasElevator: data.hasElevator ?? null,
          rent: data.rent,
          charges: data.charges ?? null,
          parkingPrice: data.parkingPrice ?? null,
          condition: data.condition,
          exposure: data.exposure,
          equipment: data.equipment ?? null,
          availableFrom: data.availableFrom ? new Date(data.availableFrom) : null,
          petsAllowed: data.petsAllowed ?? null,
          proximity: data.proximity ?? null,
          additionalInfo: data.additionalInfo ?? null,
          status: 'DRAFT',
        },
        include: {
          photos: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              credits: true,
              freeAdUsed: true,
            },
          },
        },
      });

      // Deduct credits or mark free ad as used
      if (!user.freeAdUsed) {
        // This is their first free ad
        await tx.user.update({
          where: { id: userId },
          data: { freeAdUsed: true },
        });

        // Create credit transaction record
        await tx.creditTransaction.create({
          data: {
            userId,
            amount: -1, // Using free ad (1 credit equivalent)
            type: 'USAGE',
            reference: `FREE_AD_LISTING_${listing.id}`,
          },
        });
      } else {
        // Deduct credits for paid listing
        await tx.user.update({
          where: { id: userId },
          data: { credits: { decrement: 1 } },
        });

        // Create credit transaction record
        await tx.creditTransaction.create({
          data: {
            userId,
            amount: -1,
            type: 'USAGE',
            reference: `PAID_LISTING_${listing.id}`,
          },
        });
      }

      return listing;
    });
  }

  async getListingById(id) {
    return prisma.listing.findUnique({
      where: { id },
      include: {
        photos: {
          orderBy: {
            order: 'asc',
          },
        },
        user: true,
        generations: {
          orderBy: {
            version: 'desc',
          },
          take: 1,
        },

        improvementRequests: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            suggestions: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },

        aiFeatureUsages: true,
        exports: true,
      },
    });
  }

  async getUserListings(userId, queryParams = {}) {
    const queryBuilder = new PrismaQueryBuilder(prisma.listing, queryParams, {
      searchableFields: ['location', 'title', 'description', 'listingName'],
      defaultSort: { createdAt: 'desc' },
      defaultLimit: 10,
      maxLimit: 50,
      omitFields: {},
    });
    queryBuilder._where.userId = userId;

    if (queryParams.status) {
      queryBuilder._where.status = queryParams.status.toUpperCase();
    }
    queryBuilder._include = {

      photos: {
        orderBy: { order: 'asc' },
      },
      user: true,
      generations: {
        orderBy: { version: 'desc' },
        take: 1,
      },
      improvementRequests: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          suggestions: true,
        },
      },
      aiFeatureUsages: true,
      exports: true,
    };

    const result = await queryBuilder
      .search()
      .sort()
      .paginate()
      .execute('listings');

    return {
      ...result,
      stats: {
        totalListings: result.listings.length,
        draftCount: result.listings.filter(
          (l) => l.status === 'DRAFT'
        ).length,
        unlockedCount: result.listings.filter(
          (l) => l.status === 'UNLOCKED'
        ).length,
      },
    };
  }
  async updateListing(id, data) {
    const updateData = {};
    const fields = [
      'location',
      'propertyType',
      'surface',
      'rooms',
      'floor',
      'hasElevator',
      'rent',
      'charges',
      'parkingPrice',
      'condition',
      'exposure',
      'equipment',
      'petsAllowed',
      'proximity',
      'additionalInfo',
      'listingName',
      'title',
      'description',
    ];

    fields.forEach((field) => {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    });

    if (data.availableFrom !== undefined) {
      updateData.availableFrom = data.availableFrom ? new Date(data.availableFrom) : null;
    }

    return prisma.listing.update({
      where: { id },
      data: updateData,
      include: {
        photos: { orderBy: { order: 'asc' } },
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async updateStatus(id, status) {
    return prisma.listing.update({
      where: { id },
      data: { status },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async deleteListing(id) {
    const listing = await prisma.listing.findUnique({
      where: { id },
      include: { photos: true, generations: true },
    });

    if (!listing) {
      throw new BadRequestError('Listing not found');
    }

    await prisma.$transaction([
      prisma.photo.deleteMany({ where: { listingId: id } }),
      prisma.export.deleteMany({ where: { listingId: id } }),
      prisma.aiFeatureUsage.deleteMany({ where: { listingId: id } }),
      prisma.improvementRequest.deleteMany({ where: { listingId: id } }),
      prisma.generation.deleteMany({ where: { listingId: id } }),
      prisma.listing.delete({ where: { id } }),
    ]);

    return { success: true, id };
  }

  async addPhotos(listingId, photos) {
    await prisma.photo.deleteMany({ where: { listingId } });
    return prisma.photo.createMany({
      data: photos.map((p, index) => ({
        listingId,
        url: p.url,
        order: p.order ?? index,
        isPrimary: p.isPrimary ?? index === 0,
      })),
    });
  }

  async getPhotos(listingId) {
    return prisma.photo.findMany({
      where: { listingId },
      orderBy: { order: 'asc' },
    });
  }

  async deletePhoto(photoId, listingId) {
    return prisma.photo.deleteMany({
      where: {
        id: photoId,
        listingId,
      },
    });
  }

  async getAllListings(queryParams = {}) {
    const queryBuilder = new PrismaQueryBuilder(prisma.listing, queryParams, {
      searchableFields: ['location', 'title', 'description', 'listingName'],
      defaultSort: { createdAt: 'desc' },
      defaultLimit: 10,
      maxLimit: 100,
      omitFields: {},
    });

    if (queryParams.status) {
      queryBuilder._where.status = queryParams.status.toUpperCase();
    }

    if (queryParams.propertyType) {
      queryBuilder._where.propertyType = queryParams.propertyType.toUpperCase();
    }

    if (queryParams.userId) {
      queryBuilder._where.userId = queryParams.userId;
    }

    queryBuilder._include = {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          credits: true,
        },
      },
      photos: {
        where: { isPrimary: true },
        take: 1,
      },
      generations: {
        orderBy: { version: 'desc' },
        take: 1,
        select: {
          id: true,
          score: true,
          version: true,
          createdAt: true,
          isUnlocked: true,
        },
      },
      _count: {
        select: { photos: true, generations: true },
      },
    };

    return queryBuilder.search().sort().paginate().execute('listings');
  }

  async getListingStats() {
    const [
      total,
      draft,
      preview,
      paid,
      unlocked,
      improvementRequested,
      improvementInReview,
      improvementDone,
      totalUsersWithListings,
      avgListingsPerUser,
    ] = await Promise.all([
      prisma.listing.count(),
      prisma.listing.count({ where: { status: 'DRAFT' } }),
      prisma.listing.count({ where: { status: 'PREVIEW' } }),
      prisma.listing.count({ where: { status: 'PAID' } }),
      prisma.listing.count({ where: { status: 'UNLOCKED' } }),
      prisma.listing.count({ where: { status: 'IMPROVEMENT_REQUESTED' } }),
      prisma.listing.count({ where: { status: 'IMPROVEMENT_IN_REVIEW' } }),
      prisma.listing.count({ where: { status: 'IMPROVEMENT_DONE' } }),
      prisma.user.count({
        where: {
          listings: { some: {} },
        },
      }),
      prisma.listing.groupBy({
        by: ['userId'],
        _count: { id: true },
      }),
    ]);

    const avg =
      avgListingsPerUser.length > 0
        ? avgListingsPerUser.reduce((sum, user) => sum + user._count.id, 0) /
        avgListingsPerUser.length
        : 0;

    return {
      total,
      byStatus: {
        draft,
        preview,
        paid,
        unlocked,
        improvementRequested,
        improvementInReview,
        improvementDone,
      },
      userStats: {
        totalUsersWithListings,
        averageListingsPerUser: Math.round(avg * 100) / 100,
      },
    };
  }

  async isOwner(listingId, userId) {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        userId: true,
        status: true,
        id: true,
      },
    });

    return {
      listing,
      isOwner: listing?.userId === userId,
    };
  }

  async getUserRemainingCredits(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        credits: true,
        freeAdUsed: true,
      },
    });

    return {
      credits: user.credits,
      hasFreeAdAvailable: !user.freeAdUsed,
      totalAvailableListings: user.credits + (user.freeAdUsed ? 0 : 1),
    };
  }
}

export const listingService = new ListingService();
