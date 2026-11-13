import { Types } from 'mongoose';
import {
  User,
  VendorProfile,
  Product,
  Order,
  VendorOrder,
  Payment,
  VendorEarnings,
  VendorPayout,
  Category,
} from '../models';
import { AnalyticsQuery } from '../validators/analytics.validator';
import { AnalyticsCacheService } from './analyticsCache.service';
import { logger } from '../utils/logger';

export interface DateRangeResult {
  startDate: Date;
  endDate: Date;
  prevStartDate: Date;
  prevEndDate: Date;
  groupBy: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

export class AnalyticsService {
  /**
   * Helper: Resolves and normalizes date ranges and comparison windows.
   */
  static resolveDateRange(query: AnalyticsQuery): DateRangeResult {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;
    let groupBy: 'daily' | 'weekly' | 'monthly' | 'yearly' = query.groupBy || 'daily';

    if (query.startDate) {
      startDate = new Date(query.startDate);
      if (query.endDate) {
        endDate = new Date(query.endDate);
      }
    } else if (query.period) {
      switch (query.period) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          groupBy = query.groupBy || 'daily';
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          groupBy = query.groupBy || 'daily';
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          groupBy = query.groupBy || 'weekly';
          break;
        case '12m':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          groupBy = query.groupBy || 'monthly';
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
    } else {
      // Default to last 30 days
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Previous comparison period calculation
    const durationMs = endDate.getTime() - startDate.getTime();
    const prevEndDate = new Date(startDate.getTime());
    const prevStartDate = new Date(startDate.getTime() - durationMs);

    return { startDate, endDate, prevStartDate, prevEndDate, groupBy };
  }

  /**
   * Task 2 – Overview Metrics
   */
  static async getOverview(refresh?: boolean): Promise<{
    totalCustomers: number;
    totalVendors: number;
    totalActiveProducts: number;
    totalParentOrders: number;
    totalVendorOrders: number;
    totalRevenue: number;
    totalCommissionEarned: number;
    pendingPayoutAmount: number;
    completedPayoutAmount: number;
    timestamp: string;
  }> {
    const cacheKey = AnalyticsCacheService.getCacheKey('overview');
    if (!refresh) {
      const cached = await AnalyticsCacheService.get<any>(cacheKey);
      if (cached) return cached;
    }

    const [
      totalCustomers,
      totalVendors,
      totalActiveProducts,
      totalParentOrders,
      totalVendorOrders,
      revenueAgg,
      commissionAgg,
      pendingPayoutsAgg,
      completedPayoutsAgg,
    ] = await Promise.all([
      User.countDocuments({ role: 'customer' }),
      VendorProfile.countDocuments({ status: 'approved' }),
      Product.countDocuments({ status: 'active', isDeleted: false }),
      Order.countDocuments(),
      VendorOrder.countDocuments(),
      Payment.aggregate([
        { $match: { status: 'captured' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      VendorOrder.aggregate([
        { $match: { 'commission.platformFee': { $exists: true, $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$commission.platformFee' } } },
      ]),
      VendorPayout.aggregate([
        { $match: { payoutStatus: { $in: ['requested', 'approved', 'processing'] } } },
        { $group: { _id: null, total: { $sum: '$requestedAmount' } } },
      ]),
      VendorPayout.aggregate([
        { $match: { payoutStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$approvedAmount', '$requestedAmount'] } } } },
      ]),
    ]);

    const totalRevenue = revenueAgg[0]?.total ? Math.round(revenueAgg[0].total * 100) / 100 : 0;
    const totalCommissionEarned = commissionAgg[0]?.total
      ? Math.round(commissionAgg[0].total * 100) / 100
      : 0;
    const pendingPayoutAmount = pendingPayoutsAgg[0]?.total
      ? Math.round(pendingPayoutsAgg[0].total * 100) / 100
      : 0;
    const completedPayoutAmount = completedPayoutsAgg[0]?.total
      ? Math.round(completedPayoutsAgg[0].total * 100) / 100
      : 0;

    const result = {
      totalCustomers,
      totalVendors,
      totalActiveProducts,
      totalParentOrders,
      totalVendorOrders,
      totalRevenue,
      totalCommissionEarned,
      pendingPayoutAmount,
      completedPayoutAmount,
      timestamp: new Date().toISOString(),
    };

    await AnalyticsCacheService.set(cacheKey, result, 300);
    return result;
  }

  /**
   * Task 3 – Revenue Analytics
   */
  static async getRevenueAnalytics(query: AnalyticsQuery): Promise<{
    totalRevenue: number;
    successfulOrdersCount: number;
    averageOrderValue: number;
    period: { startDate: string; endDate: string; groupBy: string };
    previousPeriod: {
      revenue: number;
      successfulOrdersCount: number;
      revenueGrowthPercentage: number;
      orderGrowthPercentage: number;
    };
    timeline: Array<{ date: string; revenue: number; ordersCount: number }>;
  }> {
    const { startDate, endDate, prevStartDate, prevEndDate, groupBy } = this.resolveDateRange(query);
    const cacheKey = AnalyticsCacheService.getCacheKey('revenue', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      groupBy,
    });

    if (!query.refresh) {
      const cached = await AnalyticsCacheService.get<any>(cacheKey);
      if (cached) return cached;
    }

    // Determine Mongo date format string
    let dateFormat = '%Y-%m-%d';
    if (groupBy === 'weekly') dateFormat = '%Y-W%V';
    if (groupBy === 'monthly') dateFormat = '%Y-%m';
    if (groupBy === 'yearly') dateFormat = '%Y';

    // 1. Current Period Aggregation
    const [currentRevenueTimeline, prevRevenueAgg] = await Promise.all([
      Payment.aggregate([
        {
          $match: {
            status: 'captured',
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
            revenue: { $sum: '$amount' },
            ordersCount: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // 2. Previous Period Summary Aggregation
      Payment.aggregate([
        {
          $match: {
            status: 'captured',
            createdAt: { $gte: prevStartDate, $lte: prevEndDate },
          },
        },
        {
          $group: {
            _id: null,
            prevRevenue: { $sum: '$amount' },
            prevOrdersCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    let totalRevenue = 0;
    let successfulOrdersCount = 0;
    const timeline = currentRevenueTimeline.map((item) => {
      const rev = Math.round(item.revenue * 100) / 100;
      totalRevenue += rev;
      successfulOrdersCount += item.ordersCount;
      return {
        date: item._id,
        revenue: rev,
        ordersCount: item.ordersCount,
      };
    });

    totalRevenue = Math.round(totalRevenue * 100) / 100;
    const averageOrderValue =
      successfulOrdersCount > 0 ? Math.round((totalRevenue / successfulOrdersCount) * 100) / 100 : 0;

    const prevRevenue = prevRevenueAgg[0]?.prevRevenue ? Math.round(prevRevenueAgg[0].prevRevenue * 100) / 100 : 0;
    const prevOrdersCount = prevRevenueAgg[0]?.prevOrdersCount || 0;

    const revenueGrowthPercentage =
      prevRevenue > 0
        ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 1000) / 10
        : totalRevenue > 0
        ? 100
        : 0;

    const orderGrowthPercentage =
      prevOrdersCount > 0
        ? Math.round(((successfulOrdersCount - prevOrdersCount) / prevOrdersCount) * 1000) / 10
        : successfulOrdersCount > 0
        ? 100
        : 0;

    const result = {
      totalRevenue,
      successfulOrdersCount,
      averageOrderValue,
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        groupBy,
      },
      previousPeriod: {
        revenue: prevRevenue,
        successfulOrdersCount: prevOrdersCount,
        revenueGrowthPercentage,
        orderGrowthPercentage,
      },
      timeline,
    };

    await AnalyticsCacheService.set(cacheKey, result, 300);
    return result;
  }

  /**
   * Task 4 – Order Analytics
   */
  static async getOrderAnalytics(query: AnalyticsQuery): Promise<{
    totalOrders: number;
    pending: number;
    confirmed: number;
    processing: number;
    shipped: number;
    delivered: number;
    cancelled: number;
    statusDistribution: Array<{ status: string; count: number; percentage: number }>;
    vendorOrdersSummary: {
      totalVendorOrders: number;
      vendorStatusDistribution: Array<{ status: string; count: number }>;
    };
  }> {
    const { startDate, endDate } = this.resolveDateRange(query);
    const cacheKey = AnalyticsCacheService.getCacheKey('orders', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    if (!query.refresh) {
      const cached = await AnalyticsCacheService.get<any>(cacheKey);
      if (cached) return cached;
    }

    const [parentOrderCounts, vendorOrderCounts] = await Promise.all([
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: '$orderStatus',
            count: { $sum: 1 },
          },
        },
      ]),
      VendorOrder.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: '$orderStatus',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const statusMap: Record<string, number> = {
      pending: 0,
      confirmed: 0,
      processing: 0,
      shipped: 0,
      partially_shipped: 0,
      partially_delivered: 0,
      delivered: 0,
      cancelled: 0,
    };

    let totalOrders = 0;
    parentOrderCounts.forEach((item) => {
      statusMap[item._id] = item.count;
      totalOrders += item.count;
    });

    // Group composite shipment statuses together for clean reporting
    const pending = statusMap.pending || 0;
    const confirmed = statusMap.confirmed || 0;
    const processing = statusMap.processing || 0;
    const shipped = (statusMap.shipped || 0) + (statusMap.partially_shipped || 0);
    const delivered = (statusMap.delivered || 0) + (statusMap.partially_delivered || 0);
    const cancelled = statusMap.cancelled || 0;

    const statusDistribution = [
      { status: 'pending', count: pending, percentage: totalOrders > 0 ? Math.round((pending / totalOrders) * 1000) / 10 : 0 },
      { status: 'confirmed', count: confirmed, percentage: totalOrders > 0 ? Math.round((confirmed / totalOrders) * 1000) / 10 : 0 },
      { status: 'processing', count: processing, percentage: totalOrders > 0 ? Math.round((processing / totalOrders) * 1000) / 10 : 0 },
      { status: 'shipped', count: shipped, percentage: totalOrders > 0 ? Math.round((shipped / totalOrders) * 1000) / 10 : 0 },
      { status: 'delivered', count: delivered, percentage: totalOrders > 0 ? Math.round((delivered / totalOrders) * 1000) / 10 : 0 },
      { status: 'cancelled', count: cancelled, percentage: totalOrders > 0 ? Math.round((cancelled / totalOrders) * 1000) / 10 : 0 },
    ];

    let totalVendorOrders = 0;
    const vendorStatusDistribution = vendorOrderCounts.map((v) => {
      totalVendorOrders += v.count;
      return { status: v._id, count: v.count };
    });

    const result = {
      totalOrders,
      pending,
      confirmed,
      processing,
      shipped,
      delivered,
      cancelled,
      statusDistribution,
      vendorOrdersSummary: {
        totalVendorOrders,
        vendorStatusDistribution,
      },
    };

    await AnalyticsCacheService.set(cacheKey, result, 300);
    return result;
  }

  /**
   * Task 5 – Vendor Analytics
   */
  static async getVendorAnalytics(query: AnalyticsQuery): Promise<{
    vendors: Array<{
      vendorId: string;
      storeName: string;
      businessEmail: string;
      totalSales: number;
      totalOrders: number;
      platformCommission: number;
      netEarnings: number;
      availableBalance: number;
      paidOutAmount: number;
    }>;
    topVendors: Array<{
      vendorId: string;
      storeName: string;
      totalSales: number;
      totalOrders: number;
    }>;
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const { startDate, endDate } = this.resolveDateRange(query);
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const cacheKey = AnalyticsCacheService.getCacheKey('vendors', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      page,
      limit,
    });

    if (!query.refresh) {
      const cached = await AnalyticsCacheService.get<any>(cacheKey);
      if (cached) return cached;
    }

    const matchStage: any = {
      createdAt: { $gte: startDate, $lte: endDate },
    };
    if (query.vendorId) {
      matchStage.vendorId = new Types.ObjectId(query.vendorId);
    }

    const aggregateResult = await VendorOrder.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$vendorId',
          totalSales: { $sum: '$vendorSubtotal' },
          totalOrders: { $sum: 1 },
          platformCommission: { $sum: { $ifNull: ['$commission.platformFee', 0] } },
          netEarnings: { $sum: { $ifNull: ['$commission.vendorEarnings', 0] } },
        },
      },
      {
        $facet: {
          paginatedResults: [
            { $sort: { totalSales: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'vendorprofiles',
                localField: '_id',
                foreignField: 'userId',
                as: 'profile',
              },
            },
            {
              $lookup: {
                from: 'vendorearnings',
                localField: '_id',
                foreignField: 'vendorId',
                as: 'earnings',
              },
            },
          ],
          totalCount: [{ $count: 'count' }],
        },
      },
    ]);

    const rawVendors = aggregateResult[0]?.paginatedResults || [];
    const totalCount = aggregateResult[0]?.totalCount[0]?.count || 0;

    const vendors = rawVendors.map((v: any) => {
      const profile = v.profile && v.profile[0] ? v.profile[0] : null;
      const earnings = v.earnings && v.earnings[0] ? v.earnings[0] : null;

      return {
        vendorId: v._id.toString(),
        storeName: profile?.storeName || 'Authorized Vendor',
        businessEmail: profile?.businessEmail || 'vendor@nexusmarket.com',
        totalSales: Math.round(v.totalSales * 100) / 100,
        totalOrders: v.totalOrders,
        platformCommission: Math.round(v.platformCommission * 100) / 100,
        netEarnings: Math.round(v.netEarnings * 100) / 100,
        availableBalance: earnings?.availableBalance ? Math.round(earnings.availableBalance * 100) / 100 : 0,
        paidOutAmount: earnings?.paidOutAmount ? Math.round(earnings.paidOutAmount * 100) / 100 : 0,
      };
    });

    // Top 5 vendors
    const topVendors = vendors.slice(0, 5).map((v: any) => ({
      vendorId: v.vendorId,
      storeName: v.storeName,
      totalSales: v.totalSales,
      totalOrders: v.totalOrders,
    }));

    const result = {
      vendors,
      topVendors,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
    };

    await AnalyticsCacheService.set(cacheKey, result, 300);
    return result;
  }

  /**
   * Task 6 – Product Analytics
   */
  static async getProductAnalytics(query: AnalyticsQuery): Promise<{
    bestSellingProducts: Array<{
      productId: string;
      productName: string;
      sku: string;
      price: number;
      vendorId: string;
      unitsSold: number;
      totalRevenue: number;
      averageRating: number;
      stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock';
      currentStock: number;
    }>;
    lowStockProducts: Array<{
      productId: string;
      productName: string;
      sku: string;
      stock: number;
      price: number;
    }>;
    outOfStockProducts: Array<{
      productId: string;
      productName: string;
      sku: string;
      price: number;
    }>;
    categorySales: Array<{
      categoryId: string;
      categoryName: string;
      unitsSold: number;
      totalRevenue: number;
    }>;
  }> {
    const { startDate, endDate } = this.resolveDateRange(query);
    const limit = query.limit || 10;

    const cacheKey = AnalyticsCacheService.getCacheKey('products', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      limit,
    });

    if (!query.refresh) {
      const cached = await AnalyticsCacheService.get<any>(cacheKey);
      if (cached) return cached;
    }

    const [bestSellersAgg, lowStockDocs, outOfStockDocs] = await Promise.all([
      // 1. Best selling products from paid orders
      Order.aggregate([
        {
          $match: {
            paymentStatus: 'paid',
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productId',
            productName: { $first: '$items.productName' },
            vendorId: { $first: '$items.vendorId' },
            unitsSold: { $sum: '$items.quantity' },
            totalRevenue: { $sum: '$items.itemSubtotal' },
          },
        },
        { $sort: { unitsSold: -1, totalRevenue: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'productDoc',
          },
        },
      ]),
      // 2. Low-stock products (1 to 10 in stock)
      Product.find({
        stock: { $gt: 0, $lte: 10 },
        status: 'active',
        isDeleted: false,
      })
        .select('_id name sku stock price')
        .limit(20),
      // 3. Out-of-stock products
      Product.find({
        stock: { $lte: 0 },
        status: 'active',
        isDeleted: false,
      })
        .select('_id name sku price')
        .limit(20),
    ]);

    const bestSellingProducts = bestSellersAgg.map((item: any) => {
      const p = item.productDoc && item.productDoc[0] ? item.productDoc[0] : null;
      const currentStock = p?.stock || 0;
      let stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';
      if (currentStock <= 0) stockStatus = 'out_of_stock';
      else if (currentStock <= 10) stockStatus = 'low_stock';

      return {
        productId: item._id.toString(),
        productName: item.productName || p?.name || 'Unknown Product',
        sku: p?.sku || 'N/A',
        price: p?.price || 0,
        vendorId: item.vendorId ? item.vendorId.toString() : '',
        unitsSold: item.unitsSold,
        totalRevenue: Math.round(item.totalRevenue * 100) / 100,
        averageRating: p?.averageRating || 0,
        stockStatus,
        currentStock,
      };
    });

    const lowStockProducts = lowStockDocs.map((p) => ({
      productId: p._id.toString(),
      productName: p.name,
      sku: p.sku,
      stock: p.stock,
      price: p.price,
    }));

    const outOfStockProducts = outOfStockDocs.map((p) => ({
      productId: p._id.toString(),
      productName: p.name,
      sku: p.sku,
      price: p.price,
    }));

    // Category Sales breakdown
    const categorySalesAgg = await Order.aggregate([
      {
        $match: {
          paymentStatus: 'paid',
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'prod',
        },
      },
      { $unwind: '$prod' },
      {
        $group: {
          _id: '$prod.categoryId',
          unitsSold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.itemSubtotal' },
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'cat',
        },
      },
    ]);

    const categorySales = categorySalesAgg.map((c: any) => ({
      categoryId: c._id ? c._id.toString() : 'unknown',
      categoryName: c.cat && c.cat[0] ? c.cat[0].name : 'Uncategorized',
      unitsSold: c.unitsSold,
      totalRevenue: Math.round(c.totalRevenue * 100) / 100,
    }));

    const result = {
      bestSellingProducts,
      lowStockProducts,
      outOfStockProducts,
      categorySales,
    };

    await AnalyticsCacheService.set(cacheKey, result, 300);
    return result;
  }

  /**
   * Task 7A – Commission Analytics
   */
  static async getCommissionAnalytics(query: AnalyticsQuery): Promise<{
    totalCommission: number;
    allTimeCommission: number;
    effectiveCommissionRate: number;
    commissionByPeriod: Array<{ date: string; commissionAmount: number }>;
    commissionByVendor: Array<{
      vendorId: string;
      storeName: string;
      totalCommission: number;
    }>;
  }> {
    const { startDate, endDate, groupBy } = this.resolveDateRange(query);
    const cacheKey = AnalyticsCacheService.getCacheKey('commissions', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      groupBy,
    });

    if (!query.refresh) {
      const cached = await AnalyticsCacheService.get<any>(cacheKey);
      if (cached) return cached;
    }

    let dateFormat = '%Y-%m-%d';
    if (groupBy === 'weekly') dateFormat = '%Y-W%V';
    if (groupBy === 'monthly') dateFormat = '%Y-%m';
    if (groupBy === 'yearly') dateFormat = '%Y';

    const [periodAgg, allTimeAgg, timelineAgg, vendorAgg] = await Promise.all([
      VendorOrder.aggregate([
        {
          $match: {
            'commission.platformFee': { $exists: true, $gt: 0 },
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: null,
            totalCommission: { $sum: '$commission.platformFee' },
            totalGross: { $sum: '$vendorSubtotal' },
          },
        },
      ]),
      VendorOrder.aggregate([
        {
          $match: { 'commission.platformFee': { $exists: true, $gt: 0 } },
        },
        {
          $group: {
            _id: null,
            allTime: { $sum: '$commission.platformFee' },
          },
        },
      ]),
      VendorOrder.aggregate([
        {
          $match: {
            'commission.platformFee': { $exists: true, $gt: 0 },
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
            commissionAmount: { $sum: '$commission.platformFee' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      VendorOrder.aggregate([
        {
          $match: {
            'commission.platformFee': { $exists: true, $gt: 0 },
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: '$vendorId',
            totalCommission: { $sum: '$commission.platformFee' },
          },
        },
        { $sort: { totalCommission: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'vendorprofiles',
            localField: '_id',
            foreignField: 'userId',
            as: 'profile',
          },
        },
      ]),
    ]);

    const totalCommission = periodAgg[0]?.totalCommission
      ? Math.round(periodAgg[0].totalCommission * 100) / 100
      : 0;
    const totalGross = periodAgg[0]?.totalGross || 0;
    const allTimeCommission = allTimeAgg[0]?.allTime
      ? Math.round(allTimeAgg[0].allTime * 100) / 100
      : 0;

    const effectiveCommissionRate =
      totalGross > 0 ? Math.round((totalCommission / totalGross) * 1000) / 10 : 0;

    const commissionByPeriod = timelineAgg.map((item) => ({
      date: item._id,
      commissionAmount: Math.round(item.commissionAmount * 100) / 100,
    }));

    const commissionByVendor = vendorAgg.map((v: any) => ({
      vendorId: v._id.toString(),
      storeName: v.profile && v.profile[0] ? v.profile[0].storeName : 'Vendor',
      totalCommission: Math.round(v.totalCommission * 100) / 100,
    }));

    const result = {
      totalCommission,
      allTimeCommission,
      effectiveCommissionRate,
      commissionByPeriod,
      commissionByVendor,
    };

    await AnalyticsCacheService.set(cacheKey, result, 300);
    return result;
  }

  /**
   * Task 7B – Payout Analytics
   */
  static async getPayoutAnalytics(query: AnalyticsQuery): Promise<{
    availableVendorBalances: number;
    pendingBalances: number;
    pendingPayouts: { count: number; amount: number };
    paidPayouts: { count: number; amount: number };
    failedPayouts: { count: number; amount: number };
    recentPayouts: Array<{
      id: string;
      payoutNumber: string;
      vendorId: string;
      storeName: string;
      amount: number;
      status: string;
      destination: string;
      createdAt: string;
    }>;
  }> {
    const cacheKey = AnalyticsCacheService.getCacheKey('payouts');
    if (!query.refresh) {
      const cached = await AnalyticsCacheService.get<any>(cacheKey);
      if (cached) return cached;
    }

    const [balancesAgg, payoutsAgg, recentPayoutsDocs] = await Promise.all([
      // 1. Treasury balances
      VendorEarnings.aggregate([
        {
          $group: {
            _id: null,
            totalAvailable: { $sum: '$availableBalance' },
            totalPending: { $sum: '$pendingBalance' },
          },
        },
      ]),
      // 2. Counts and amounts by status
      VendorPayout.aggregate([
        {
          $group: {
            _id: '$payoutStatus',
            count: { $sum: 1 },
            amount: { $sum: { $ifNull: ['$approvedAmount', '$requestedAmount'] } },
          },
        },
      ]),
      // 3. Recent 10 payouts
      VendorPayout.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('vendorId', 'name email'),
    ]);

    const availableVendorBalances = balancesAgg[0]?.totalAvailable
      ? Math.round(balancesAgg[0].totalAvailable * 100) / 100
      : 0;
    const pendingBalances = balancesAgg[0]?.totalPending
      ? Math.round(balancesAgg[0].totalPending * 100) / 100
      : 0;

    const payoutMap: Record<string, { count: number; amount: number }> = {
      requested: { count: 0, amount: 0 },
      approved: { count: 0, amount: 0 },
      processing: { count: 0, amount: 0 },
      paid: { count: 0, amount: 0 },
      rejected: { count: 0, amount: 0 },
      failed: { count: 0, amount: 0 },
    };

    payoutsAgg.forEach((p) => {
      payoutMap[p._id] = {
        count: p.count,
        amount: Math.round(p.amount * 100) / 100,
      };
    });

    const pendingPayouts = {
      count: payoutMap.requested.count + payoutMap.approved.count + payoutMap.processing.count,
      amount:
        Math.round(
          (payoutMap.requested.amount + payoutMap.approved.amount + payoutMap.processing.amount) * 100
        ) / 100,
    };

    const paidPayouts = {
      count: payoutMap.paid.count,
      amount: payoutMap.paid.amount,
    };

    const failedPayouts = {
      count: payoutMap.rejected.count + payoutMap.failed.count,
      amount: Math.round((payoutMap.rejected.amount + payoutMap.failed.amount) * 100) / 100,
    };

    // Lookup store names for recent payouts
    const vendorIds = recentPayoutsDocs.map((p) => p.vendorId);
    const profiles = await VendorProfile.find({ userId: { $in: vendorIds } });
    const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p.storeName]));

    const recentPayouts = recentPayoutsDocs.map((p: any) => ({
      id: p._id.toString(),
      payoutNumber: p.payoutNumber,
      vendorId: p.vendorId?._id ? p.vendorId._id.toString() : p.vendorId?.toString(),
      storeName: profileMap.get(p.vendorId?._id?.toString() || p.vendorId?.toString()) || 'Vendor Store',
      amount: p.approvedAmount || p.requestedAmount,
      status: p.payoutStatus,
      destination: p.destinationReference,
      createdAt: p.createdAt.toISOString(),
    }));

    const result = {
      availableVendorBalances,
      pendingBalances,
      pendingPayouts,
      paidPayouts,
      failedPayouts,
      recentPayouts,
    };

    await AnalyticsCacheService.set(cacheKey, result, 300);
    return result;
  }
}
