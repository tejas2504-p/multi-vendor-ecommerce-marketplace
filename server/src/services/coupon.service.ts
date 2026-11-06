import { Types } from 'mongoose';
import {
  Coupon,
  ICoupon,
  CouponUsage,
  Cart,
  Product,
  VendorProfile,
} from '../models';
import {
  CreateCouponInput,
  UpdateCouponInput,
  CouponQueryInput,
} from '../validators/coupon.validator';
import { AppError } from '../utils/apiError';
import { logger } from '../utils/logger';

export interface CouponValidationResult {
  valid: boolean;
  coupon: {
    id: string;
    code: string;
    description: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    maximumDiscountAmount?: number;
    minimumOrderAmount: number;
  };
  cartSubtotal: number;
  eligibleSubtotal: number;
  discountAmount: number;
  shippingAmount: number;
  finalPayable: number;
}

export class CouponService {
  /**
   * Task 2: Create a new marketplace coupon (Admin only).
   */
  static async createCoupon(adminUserId: string, input: CreateCouponInput): Promise<ICoupon> {
    const normalizedCode = input.code.trim().toUpperCase();

    // Check code uniqueness
    const existing = await Coupon.findOne({ code: normalizedCode });
    if (existing) {
      throw AppError.conflict(`A coupon with code "${normalizedCode}" already exists`);
    }

    const coupon = await Coupon.create({
      ...input,
      code: normalizedCode,
      applicableProducts: input.applicableProducts?.map((id) => new Types.ObjectId(id)) || [],
      applicableCategories: input.applicableCategories?.map((id) => new Types.ObjectId(id)) || [],
      applicableVendors: input.applicableVendors?.map((id) => new Types.ObjectId(id)) || [],
      createdBy: new Types.ObjectId(adminUserId),
    });

    logger.info(`Admin ${adminUserId} created coupon ${coupon.code}`);
    return coupon;
  }

  /**
   * Task 2: Query marketplace coupons with pagination and filters (Admin only).
   */
  static async getCoupons(query: CouponQueryInput): Promise<{
    coupons: ICoupon[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page, limit, search, status, discountType } = query;
    const filter: any = {};
    const now = new Date();

    if (search) {
      filter.$or = [
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (status === 'active') {
      filter.isActive = true;
      filter.startDate = { $lte: now };
      filter.expiryDate = { $gte: now };
    } else if (status === 'inactive') {
      filter.isActive = false;
    } else if (status === 'expired') {
      filter.expiryDate = { $lt: now };
    }

    if (discountType && discountType !== 'all') {
      filter.discountType = discountType;
    }

    const skip = (page - 1) * limit;
    const [coupons, total] = await Promise.all([
      Coupon.find(filter)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Coupon.countDocuments(filter),
    ]);

    return {
      coupons,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Task 2: Get coupon by ID with redemption analytics.
   */
  static async getCouponById(couponId: string): Promise<any> {
    const coupon = await Coupon.findById(couponId)
      .populate('createdBy', 'name email')
      .populate('applicableProducts', 'name price')
      .populate('applicableCategories', 'name')
      .populate('applicableVendors', 'name email');

    if (!coupon) {
      throw AppError.notFound('Coupon not found');
    }

    const totalRedemptions = await CouponUsage.countDocuments({
      couponId: coupon._id,
      status: { $ne: 'reversed' },
    });

    return {
      ...coupon.toJSON(),
      totalRedemptions,
    };
  }

  /**
   * Task 2: Update coupon details.
   */
  static async updateCoupon(couponId: string, input: UpdateCouponInput): Promise<ICoupon> {
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      throw AppError.notFound('Coupon not found');
    }

    if (input.code) {
      const normalizedCode = input.code.trim().toUpperCase();
      if (normalizedCode !== coupon.code) {
        const existing = await Coupon.findOne({ code: normalizedCode });
        if (existing) {
          throw AppError.conflict(`A coupon with code "${normalizedCode}" already exists`);
        }
        coupon.code = normalizedCode;
      }
    }

    if (input.description !== undefined) coupon.description = input.description;
    if (input.discountType !== undefined) coupon.discountType = input.discountType;
    if (input.discountValue !== undefined) coupon.discountValue = input.discountValue;
    if (input.maximumDiscountAmount !== undefined) coupon.maximumDiscountAmount = input.maximumDiscountAmount ?? undefined;
    if (input.minimumOrderAmount !== undefined) coupon.minimumOrderAmount = input.minimumOrderAmount;
    if (input.startDate !== undefined) coupon.startDate = input.startDate;
    if (input.expiryDate !== undefined) coupon.expiryDate = input.expiryDate;
    if (input.totalUsageLimit !== undefined) coupon.totalUsageLimit = input.totalUsageLimit ?? undefined;
    if (input.perUserUsageLimit !== undefined) coupon.perUserUsageLimit = input.perUserUsageLimit;
    if (input.isActive !== undefined) coupon.isActive = input.isActive;

    if (input.applicableProducts !== undefined) {
      coupon.applicableProducts = input.applicableProducts.map((id) => new Types.ObjectId(id));
    }
    if (input.applicableCategories !== undefined) {
      coupon.applicableCategories = input.applicableCategories.map((id) => new Types.ObjectId(id));
    }
    if (input.applicableVendors !== undefined) {
      coupon.applicableVendors = input.applicableVendors.map((id) => new Types.ObjectId(id));
    }

    // Safety checks
    if (coupon.discountType === 'percentage' && coupon.discountValue > 100) {
      throw AppError.badRequest('Percentage discount cannot exceed 100%');
    }
    if (coupon.startDate >= coupon.expiryDate) {
      throw AppError.badRequest('Expiry date must be after start date');
    }

    await coupon.save();
    return coupon;
  }

  /**
   * Task 2: Delete or safely deactivate coupon.
   * "Avoid deleting coupons that have financial history; deactivate them instead."
   */
  static async deleteCoupon(couponId: string): Promise<{ deactivated: boolean; message: string }> {
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      throw AppError.notFound('Coupon not found');
    }

    // Check if redemptions exist
    const hasHistory = (coupon.usageCount && coupon.usageCount > 0) ||
      (await CouponUsage.exists({ couponId: coupon._id }));

    if (hasHistory) {
      coupon.isActive = false;
      await coupon.save();
      return {
        deactivated: true,
        message: `Coupon "${coupon.code}" has historical financial records and cannot be permanently deleted. It has been deactivated instead.`,
      };
    }

    await Coupon.deleteOne({ _id: coupon._id });
    return {
      deactivated: false,
      message: `Coupon "${coupon.code}" was permanently deleted.`,
    };
  }

  /**
   * Task 3: Validate coupon against customer's active cart.
   * Strictly reads backend-persisted cart & products; does not trust client inputs.
   */
  static async validateCouponForCart(
    customerId: string,
    couponCode: string,
    cartId?: string
  ): Promise<CouponValidationResult> {
    const userObjectId = new Types.ObjectId(customerId);
    const normalizedCode = couponCode.trim().toUpperCase();

    // 1. Fetch coupon
    const coupon = await Coupon.findOne({ code: normalizedCode });
    if (!coupon) {
      throw AppError.notFound(`Invalid coupon code: "${normalizedCode}" does not exist`);
    }

    // 2. Check active flag
    if (!coupon.isActive) {
      throw AppError.badRequest(`Coupon "${coupon.code}" is currently inactive`);
    }

    // 3. Check start and expiry dates
    const now = new Date();
    if (now < coupon.startDate) {
      throw AppError.badRequest(
        `Coupon "${coupon.code}" is not active yet (starts on ${coupon.startDate.toLocaleDateString()})`
      );
    }
    if (now > coupon.expiryDate) {
      throw AppError.badRequest(
        `Coupon "${coupon.code}" has expired on ${coupon.expiryDate.toLocaleDateString()}`
      );
    }

    // 4. Check global usage limit
    if (coupon.totalUsageLimit !== undefined && coupon.totalUsageLimit !== null) {
      if (coupon.usageCount >= coupon.totalUsageLimit) {
        throw AppError.badRequest(`Coupon "${coupon.code}" global usage limit has been reached`);
      }
    }

    // 5. Check per-user usage limit
    const userUsageCount = await CouponUsage.countDocuments({
      couponId: coupon._id,
      customerId: userObjectId,
      status: { $ne: 'reversed' },
    });
    if (userUsageCount >= coupon.perUserUsageLimit) {
      throw AppError.badRequest(
        `You have already reached the maximum redemption limit (${coupon.perUserUsageLimit}) for coupon "${coupon.code}"`
      );
    }

    // 6. Fetch trusted cart from MongoDB
    const cart = cartId
      ? await Cart.findOne({ _id: new Types.ObjectId(cartId), userId: userObjectId })
      : await Cart.findOne({ userId: userObjectId });

    if (!cart || !cart.items || cart.items.length === 0) {
      throw AppError.badRequest('Cannot apply coupon: your shopping cart is empty');
    }

    // 7. Re-fetch current products to check restrictions and compute prices
    let cartSubtotal = 0;
    let eligibleSubtotal = 0;

    const applicableProductIds = new Set(coupon.applicableProducts.map((p) => p.toString()));
    const applicableCategoryIds = new Set(coupon.applicableCategories.map((c) => c.toString()));
    const applicableVendorIds = new Set(coupon.applicableVendors.map((v) => v.toString()));

    const hasProductFilter = applicableProductIds.size > 0;
    const hasCategoryFilter = applicableCategoryIds.size > 0;
    const hasVendorFilter = applicableVendorIds.size > 0;
    const hasAnyFilter = hasProductFilter || hasCategoryFilter || hasVendorFilter;

    for (const item of cart.items) {
      const product = await Product.findById(item.productId);
      if (!product || product.isDeleted || product.status !== 'active') {
        continue;
      }

      // Verify vendor status
      const vendorProfile = await VendorProfile.findOne({
        userId: product.vendorId,
        status: 'approved',
      });
      if (!vendorProfile) {
        continue;
      }

      const itemTotal = Math.round(product.price * item.quantity * 100) / 100;
      cartSubtotal += itemTotal;

      // Check item eligibility against restrictions
      let isItemEligible = true;

      if (hasProductFilter && !applicableProductIds.has(product._id.toString())) {
        isItemEligible = false;
      }
      if (hasCategoryFilter && !applicableCategoryIds.has(product.categoryId.toString())) {
        isItemEligible = false;
      }
      if (hasVendorFilter && !applicableVendorIds.has(product.vendorId.toString())) {
        isItemEligible = false;
      }

      // If no restrictions, all valid products are eligible
      if (!hasAnyFilter) {
        isItemEligible = true;
      }

      if (isItemEligible) {
        eligibleSubtotal += itemTotal;
      }
    }

    cartSubtotal = Math.round(cartSubtotal * 100) / 100;
    eligibleSubtotal = Math.round(eligibleSubtotal * 100) / 100;

    if (cartSubtotal <= 0) {
      throw AppError.badRequest('Cart contains no purchasable products');
    }

    if (eligibleSubtotal <= 0) {
      throw AppError.badRequest(
        `Coupon "${coupon.code}" is not applicable to any items in your cart`
      );
    }

    // 8. Check minimum order amount requirement
    if (cartSubtotal < coupon.minimumOrderAmount) {
      throw AppError.badRequest(
        `Minimum order amount of $${coupon.minimumOrderAmount.toFixed(
          2
        )} required to apply coupon "${coupon.code}" (current subtotal: $${cartSubtotal.toFixed(2)})`
      );
    }

    // 9. Calculate discount
    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = (eligibleSubtotal * coupon.discountValue) / 100;
      if (coupon.maximumDiscountAmount !== undefined && coupon.maximumDiscountAmount !== null) {
        discount = Math.min(discount, coupon.maximumDiscountAmount);
      }
    } else {
      // Fixed amount discount
      discount = Math.min(coupon.discountValue, eligibleSubtotal);
    }

    const discountAmount = Math.min(Math.round(discount * 100) / 100, eligibleSubtotal);
    const shippingAmount = cartSubtotal >= 100 ? 0 : 10;
    const finalPayable = Math.max(
      0,
      Math.round((cartSubtotal + shippingAmount - discountAmount) * 100) / 100
    );

    return {
      valid: true,
      coupon: {
        id: coupon._id.toString(),
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        maximumDiscountAmount: coupon.maximumDiscountAmount,
        minimumOrderAmount: coupon.minimumOrderAmount,
      },
      cartSubtotal,
      eligibleSubtotal,
      discountAmount,
      shippingAmount,
      finalPayable,
    };
  }
}

