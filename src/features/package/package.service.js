import { prisma } from '../../config/db.js';
import PrismaQueryBuilder from '../../shared/globals/helpers/query-builder.js';
import {
  NotFoundError,
  ConflictError,
} from '../../shared/globals/helpers/error-handler.js';

class PackageService {


  async getAllPackages(queryParams = {}) {
    const queryBuilder = new PrismaQueryBuilder(
      prisma.package,
      queryParams,
      {
        searchableFields: ['name', 'slug', 'description'],
        defaultSort: { createdAt: 'asc' },
        defaultLimit: 10,
        maxLimit: 100,
        omitFields: {},
      }
    );

    const result = await queryBuilder
      .search()
      .filter()
      .sort()
      .paginate()
      .execute('packages');

    const enriched = await Promise.all(
      result.packages.map(async (pkg) => {
        const counts = await prisma.package.findUnique({
          where: { id: pkg.id },
          select: {
            _count: { select: { users: true, payments: true } },
          },
        });
        return {
          ...pkg,
          subscribedUsers: counts?._count?.users ?? 0,
          totalPurchases: counts?._count?.payments ?? 0,
        };
      })
    );

    return { meta: result.meta, packages: enriched };
  }

  async getPackageById(id) {
    const pkg = await prisma.package.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true, payments: true } },
      },
    });
    if (!pkg) throw new NotFoundError('Package not found');
    return pkg;
  }

  async createPackage(data) {
    const existing = await prisma.package.findUnique({
      where: { slug: data.slug },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictError(`Package with slug "${data.slug}" already exists`);
    }

    return prisma.package.create({
      data: {
        name: data.name,
        title: data.title,
        slug: data.slug,
        price: data.price,
        credits: data.credits,
        pricePerCredit: data.pricePerCredit,
        description: data.description,
        features: data.features,
        badge: data.badge ?? false,
        isActive: data.isActive ?? true,
      },
    });
  }

  async updatePackage(id, data) {
    const pkg = await prisma.package.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });
    if (!pkg) throw new NotFoundError('Package not found');

    if (data.slug && data.slug !== pkg.slug) {
      const slugTaken = await prisma.package.findUnique({
        where: { slug: data.slug },
        select: { id: true },
      });
      if (slugTaken) throw new ConflictError(`Slug "${data.slug}" is already in use`);
    }

    const updateData = {};
    const allowed = [
      'name', 'slug', 'price', 'credits', 'pricePerCredit',
      'description', 'features', 'badge', 'isActive',
    ];
    allowed.forEach((field) => {
      if (data[field] !== undefined) updateData[field] = data[field];
    });

    return prisma.package.update({ where: { id }, data: updateData });
  }

  async deletePackage(id) {
    const pkg = await prisma.package.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!pkg) throw new NotFoundError('Package not found');

    if (pkg._count.users > 0) {
      throw new ConflictError(
        `Cannot delete — ${pkg._count.users} user(s) subscribed. Deactivate instead.`
      );
    }

    return prisma.package.delete({ where: { id } });
  }
}

export const packageService = new PackageService();