import { prisma } from "../../config/db.js";



class MetaService {
  async getDashboardStats() {
    try {
      // Get total members (all users)
      const totalMembers = await prisma.user.count();
      
      // Get paying users (users who have at least one successful payment)
      const payingUsers = await prisma.user.count({
        where: {
          payments: {
            some: {
              status: 'SUCCESS'
            }
          }
        }
      });
      
      // Get active subscriptions (users with an active package)
      const activeSubscriptions = await prisma.user.count({
        where: {
          packageId: {
            not: null
          }
        }
      });
      
      // Get total credits sold (sum of credits from successful payments)
      const totalCreditsSold = await prisma.payment.aggregate({
        where: {
          status: 'SUCCESS',
          type: 'PACKAGE'
        },
        _sum: {
          credits: true
        }
      });
      
      // Get total revenue (sum of all successful payments)
      const totalRevenue = await prisma.payment.aggregate({
        where: {
          status: 'SUCCESS'
        },
        _sum: {
          amount: true
        }
      });
      
      // Get revenue by payment type
      const revenueByType = await prisma.payment.groupBy({
        by: ['type'],
        where: {
          status: 'SUCCESS'
        },
        _sum: {
          amount: true
        }
      });
      
      // Get total listings created
      const totalListings = await prisma.listing.count();
      
      // Get listings by status
      const listingsByStatus = await prisma.listing.groupBy({
        by: ['status'],
        _count: {
          status: true
        }
      });
      
      // Get total AI feature usages
      const totalAiUsages = await prisma.aiFeatureUsage.count();
      
      // Get AI usages by feature
      const aiUsagesByFeature = await prisma.aiFeatureUsage.groupBy({
        by: ['feature'],
        _count: {
          feature: true
        }
      });
      
      // Get total improvement requests
      const totalImprovementRequests = await prisma.improvementRequest.count();
      
      // Get improvement requests by status
      const improvementRequestsByStatus = await prisma.improvementRequest.groupBy({
        by: ['status'],
        _count: {
          status: true
        }
      });
      
      // Get recent users (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const newUsersLast30Days = await prisma.user.count({
        where: {
          createdAt: {
            gte: thirtyDaysAgo
          }
        }
      });
      
      // Get recent payments (last 30 days)
      const recentPayments = await prisma.payment.aggregate({
        where: {
          status: 'SUCCESS',
          createdAt: {
            gte: thirtyDaysAgo
          }
        },
        _sum: {
          amount: true
        },
        _count: {
          id: true
        }
      });
      
      // Get package distribution
      const packageDistribution = await prisma.user.groupBy({
        by: ['packageId'],
        _count: {
          packageId: true
        },
        where: {
          packageId: {
            not: null
          }
        }
      });
      
      // Get package details for distribution
      const packages = await prisma.package.findMany({
        select: {
          id: true,
          name: true
        }
      });
      
      const packageDistributionWithNames = packageDistribution.map(dist => {
        const pkg = packages.find(p => p.id === dist.packageId);
        return {
          packageName: pkg?.name || 'Unknown',
          count: dist._count.packageId
        };
      });
      
      return {
        success: true,
        data: {
          // User statistics
          users: {
            totalMembers,
            payingUsers,
            activeSubscriptions,
            newUsersLast30Days,
            conversionRate: totalMembers > 0 ? ((payingUsers / totalMembers) * 100).toFixed(2) : 0
          },
          
          // Financial statistics
          financial: {
            totalRevenue: totalRevenue._sum.amount || 0,
            totalCreditsSold: totalCreditsSold._sum.credits || 0,
            recentRevenue: recentPayments._sum.amount || 0,
            recentTransactions: recentPayments._count.id || 0,
            revenueByType: revenueByType.map(item => ({
              type: item.type,
              amount: item._sum.amount || 0
            }))
          },
          
          // Listing statistics
          listings: {
            total: totalListings,
            byStatus: listingsByStatus.map(item => ({
              status: item.status,
              count: item._count.status
            }))
          },
          
          // AI Feature statistics
          aiFeatures: {
            totalUsages: totalAiUsages,
            byFeature: aiUsagesByFeature.map(item => ({
              feature: item.feature,
              count: item._count.feature
            }))
          },
          
          // Improvement request statistics
          improvementRequests: {
            total: totalImprovementRequests,
            byStatus: improvementRequestsByStatus.map(item => ({
              status: item.status,
              count: item._count.status
            }))
          },
          
          // Package distribution
          packageDistribution: packageDistributionWithNames,
          
          // Summary cards (for dashboard)
          summary: {
            totalMembers,
            payingUsers,
            activeSubscriptions,
            totalRevenue: totalRevenue._sum.amount || 0,
            totalListings,
            totalAiUsages,
            pendingImprovements: improvementRequestsByStatus.find(i => i.status === 'PENDING')?._count.status || 0
          }
        }
      };
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      throw error;
    }
  }
  
  async getSimpleStats() {
    try {
      const [
        totalMembers,
        payingUsers,
        activeSubscriptions,
        totalRevenue,
        totalListings,
        pendingImprovements
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({
          where: {
            payments: {
              some: {
                status: 'SUCCESS'
              }
            }
          }
        }),
        prisma.user.count({
          where: {
            packageId: {
              not: null
            }
          }
        }),
        prisma.payment.aggregate({
          where: { status: 'SUCCESS' },
          _sum: { amount: true }
        }),
        prisma.listing.count(),
        prisma.improvementRequest.count({
          where: { status: 'PENDING' }
        })
      ]);
      
      return {
        totalMembers,
        payingUsers,
        activeSubscriptions,
        totalRevenue: totalRevenue._sum.amount || 0,
        totalListings,
        pendingImprovements
      };
    } catch (error) {
      console.error('Error getting simple stats:', error);
      throw error;
    }
  }
  
}

export default new MetaService();