import mongoose, { Types } from 'mongoose';
import { VendorProfile, IVendorProfile } from '../models/vendorProfile.model';
import { User } from '../models/user.model';
import {
  ApplyVendorInput,
  UpdateVendorProfileInput,
  AdminVendorQueryInput,
} from '../validators/vendor.validator';
import { AppError } from '../utils/apiError';

const escapeRegex = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export interface VendorApplicationsListResult {
  applications: IVendorProfile[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface VendorDashboardResult {
  portal?: string;
  user?: any;
  store: {
    id: string;
    storeName: string;
    slug: string;
    description?: string;
    businessEmail: string;
    businessPhone: string;
    businessAddress: any;
    status: string;
    reviewedAt?: Date;
  };
  metrics: {
    productsCount: number;
    totalOrders: number;
    pendingOrders: number;
    totalSales: number;
    netEarnings: number;
    averageRating: number;
    reviewsCount: number;
  };
  systemNotes: string;
}

export class VendorService {
  /**
   * Submit a new vendor onboarding application.
   * Only existing users with 'customer' role can apply.
   */
  static async applyForVendor(
    userId: string,
    userRole: string,
    input: ApplyVendorInput
  ): Promise<IVendorProfile> {
    // 1. Ensure only customers can apply
    if (userRole !== 'customer') {
      throw AppError.badRequest('Only users with the customer role can apply for vendor onboarding');
    }

    // 2. Prevent duplicate applications for the same user
    const existingProfile = await VendorProfile.findOne({ userId });
    if (existingProfile) {
      throw AppError.conflict(
        `A vendor application with status '${existingProfile.status}' has already been submitted for this account`
      );
    }

    // 3. Verify store name uniqueness (case-insensitive)
    const storeNameExists = await VendorProfile.findOne({
      storeName: { $regex: new RegExp(`^${escapeRegex(input.storeName)}$`, 'i') },
    });

    if (storeNameExists) {
      throw AppError.conflict('Store name is already taken. Please choose another store name.');
    }

    // 4. Create VendorProfile with status strictly hardcoded to 'pending'
    const profile = await VendorProfile.create({
      userId,
      storeName: input.storeName,
      description: input.description,
      businessEmail: input.businessEmail,
      businessPhone: input.businessPhone,
      businessAddress: input.businessAddress,
      status: 'pending',
    });

    return profile;
  }

  /**
   * Fetch the vendor profile belonging to the authenticated user.
   */
  static async getVendorProfile(userId: string): Promise<IVendorProfile> {
    const profile = await VendorProfile.findOne({ userId });
    if (!profile) {
      throw AppError.notFound('Vendor profile not found for this account');
    }
    return profile;
  }

  /**
   * Update permitted store details on the vendor profile.
   * Changes to userId, status, role, and rejectionReason are disallowed.
   */
  static async updateVendorProfile(
    userId: string,
    input: UpdateVendorProfileInput
  ): Promise<IVendorProfile> {
    const profile = await VendorProfile.findOne({ userId });
    if (!profile) {
      throw AppError.notFound('Vendor profile not found for this account');
    }

    // Check store name conflict if changing storeName
    if (input.storeName && input.storeName.toLowerCase() !== profile.storeName.toLowerCase()) {
      const storeNameExists = await VendorProfile.findOne({
        storeName: { $regex: new RegExp(`^${escapeRegex(input.storeName)}$`, 'i') },
        userId: { $ne: userId },
      });

      if (storeNameExists) {
        throw AppError.conflict('Store name is already taken. Please choose another store name.');
      }
      profile.storeName = input.storeName;
    }

    if (input.description !== undefined) {
      profile.description = input.description;
    }

    if (input.businessEmail) {
      profile.businessEmail = input.businessEmail;
    }

    if (input.businessPhone) {
      profile.businessPhone = input.businessPhone;
    }

    if (input.businessAddress) {
      profile.businessAddress = {
        street: input.businessAddress.street ?? profile.businessAddress.street,
        city: input.businessAddress.city ?? profile.businessAddress.city,
        state: input.businessAddress.state ?? profile.businessAddress.state,
        postalCode: input.businessAddress.postalCode ?? profile.businessAddress.postalCode,
        country: input.businessAddress.country ?? profile.businessAddress.country,
      };
    }

    await profile.save();
    return profile;
  }

  /**
   * Retrieve current vendor onboarding status.
   */
  static async getVendorApplicationStatus(userId: string): Promise<{
    status: string;
    storeName: string;
    createdAt: Date;
    rejectionReason?: string;
  }> {
    const profile = await VendorProfile.findOne({ userId });
    if (!profile) {
      throw AppError.notFound('No vendor application found for this account');
    }

    return {
      status: profile.status,
      storeName: profile.storeName,
      createdAt: profile.createdAt,
      rejectionReason: profile.status === 'rejected' ? profile.rejectionReason : undefined,
    };
  }

  // =========================================================================
  // ADMIN OPERATIONS (Phase 3B)
  // =========================================================================

  /**
   * List vendor applications with filtering, pagination, and sorting.
   * Admin only. Populates safe applicant data.
   */
  static async listVendorApplications(
    query: AdminVendorQueryInput
  ): Promise<VendorApplicationsListResult> {
    const filter: Record<string, any> = {};
    if (query.status) {
      filter.status = query.status;
    }

    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;
    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [applications, total] = await Promise.all([
      VendorProfile.find(filter)
        .populate('userId', 'name email role createdAt')
        .populate('reviewedBy', 'name email')
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit),
      VendorProfile.countDocuments(filter),
    ]);

    return {
      applications,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieve detailed vendor application by ID.
   * Admin only.
   */
  static async getVendorApplicationById(id: string): Promise<IVendorProfile> {
    if (!mongoose.isValidObjectId(id)) {
      throw AppError.badRequest('Invalid vendor application ID format');
    }

    const application = await VendorProfile.findById(id)
      .populate('userId', 'name email role isActive createdAt')
      .populate('reviewedBy', 'name email');

    if (!application) {
      throw AppError.notFound('Vendor application not found');
    }

    return application;
  }

  /**
   * Approve a pending vendor application.
   * Atomically transitions VendorProfile to 'approved' and User role to 'vendor'.
   * Admin only.
   */
  static async approveVendorApplication(
    applicationId: string,
    adminId: string
  ): Promise<IVendorProfile> {
    if (!mongoose.isValidObjectId(applicationId)) {
      throw AppError.badRequest('Invalid vendor application ID format');
    }

    const profile = await VendorProfile.findById(applicationId);
    if (!profile) {
      throw AppError.notFound('Vendor application not found');
    }

    // State transition guards
    if (profile.status === 'approved') {
      throw AppError.conflict('Vendor application is already approved');
    }

    if (profile.status === 'rejected') {
      throw AppError.badRequest(
        'Cannot approve an application that has been rejected. It must be resubmitted or reset.'
      );
    }

    if (profile.status !== 'pending') {
      throw AppError.badRequest(`Cannot approve an application with status '${profile.status}'`);
    }

    const user = await User.findById(profile.userId);
    if (!user) {
      throw AppError.notFound('Associated user account no longer exists');
    }

    // Execute atomic state transitions using MongoDB transactions where supported
    let session: mongoose.ClientSession | null = null;
    try {
      session = await mongoose.startSession();
      session.startTransaction();

      profile.status = 'approved';
      profile.reviewedBy = new Types.ObjectId(adminId);
      profile.reviewedAt = new Date();
      profile.rejectionReason = undefined;
      await profile.save({ session });

      user.role = 'vendor';
      await user.save({ session });

      await session.commitTransaction();
    } catch (err: any) {
      if (session && session.inTransaction()) {
        await session.abortTransaction();
      }

      // Fallback: If deployment is standalone without replica sets, perform safe sequential update with rollback
      if (
        err?.message?.includes('replica set') ||
        err?.message?.includes('Transaction numbers are only allowed')
      ) {
        profile.status = 'approved';
        profile.reviewedBy = new Types.ObjectId(adminId);
        profile.reviewedAt = new Date();
        profile.rejectionReason = undefined;
        await profile.save();

        try {
          user.role = 'vendor';
          await user.save();
        } catch (userSaveErr) {
          // Rollback profile state if user role upgrade fails
          profile.status = 'pending';
          profile.reviewedBy = undefined;
          profile.reviewedAt = undefined;
          await profile.save();
          throw userSaveErr;
        }
      } else {
        throw err;
      }
    } finally {
      if (session) {
        await session.endSession();
      }
    }

    // Return populated updated profile
    const updated = await VendorProfile.findById(applicationId)
      .populate('userId', 'name email role createdAt')
      .populate('reviewedBy', 'name email');

    return updated!;
  }

  /**
   * Reject a pending vendor application.
   * Transitions status to 'rejected' and preserves User role as 'customer'.
   * Admin only.
   */
  static async rejectVendorApplication(
    applicationId: string,
    adminId: string,
    rejectionReason: string
  ): Promise<IVendorProfile> {
    if (!mongoose.isValidObjectId(applicationId)) {
      throw AppError.badRequest('Invalid vendor application ID format');
    }

    const profile = await VendorProfile.findById(applicationId);
    if (!profile) {
      throw AppError.notFound('Vendor application not found');
    }

    // State transition guards
    if (profile.status === 'rejected') {
      throw AppError.conflict('Vendor application is already rejected');
    }

    if (profile.status === 'approved') {
      throw AppError.badRequest('Cannot reject an already approved vendor');
    }

    if (profile.status !== 'pending') {
      throw AppError.badRequest(`Cannot reject an application with status '${profile.status}'`);
    }

    profile.status = 'rejected';
    profile.rejectionReason = rejectionReason;
    profile.reviewedBy = new Types.ObjectId(adminId);
    profile.reviewedAt = new Date();

    await profile.save();

    const updated = await VendorProfile.findById(applicationId)
      .populate('userId', 'name email role createdAt')
      .populate('reviewedBy', 'name email');

    return updated!;
  }

  // =========================================================================
  // VENDOR DASHBOARD & STORE MANAGEMENT (Phase 3B)
  // =========================================================================

  /**
   * Retrieve vendor dashboard overview with placeholder zero metrics.
   * Only approved vendors can access.
   */
  static async getVendorDashboard(userId: string): Promise<VendorDashboardResult> {
    const profile = await VendorProfile.findOne({ userId });
    if (!profile || profile.status !== 'approved') {
      throw AppError.forbidden(
        'Access forbidden: Only approved vendor accounts can access the vendor dashboard'
      );
    }

    return {
      portal: 'Vendor Management Hub',
      user: {
        id: profile.userId.toString(),
        role: 'vendor',
      },
      store: {
        id: profile._id.toString(),
        storeName: profile.storeName,
        slug: profile.slug,
        description: profile.description,
        businessEmail: profile.businessEmail,
        businessPhone: profile.businessPhone,
        businessAddress: profile.businessAddress,
        status: profile.status,
        reviewedAt: profile.reviewedAt,
      },
      metrics: {
        productsCount: 0,
        totalOrders: 0,
        pendingOrders: 0,
        totalSales: 0,
        netEarnings: 0,
        averageRating: 0,
        reviewsCount: 0,
      },
      systemNotes:
        'Dashboard metrics are initialized with zero placeholders. Real-time aggregations will activate in Phase 4 (Products) and Phase 5 (Orders).',
    };
  }

  /**
   * Retrieve the authenticated vendor's store details.
   * Only approved vendors can access.
   */
  static async getVendorStore(userId: string): Promise<IVendorProfile> {
    const profile = await VendorProfile.findOne({ userId });
    if (!profile || profile.status !== 'approved') {
      throw AppError.forbidden('Access forbidden: Only approved vendors can access store settings');
    }
    return profile;
  }

  /**
   * Update permitted store details for the authenticated vendor's store.
   * Strictly prevents modifying status, userId, role, or administrative fields.
   */
  static async updateVendorStore(
    userId: string,
    input: UpdateVendorProfileInput
  ): Promise<IVendorProfile> {
    const profile = await VendorProfile.findOne({ userId });
    if (!profile || profile.status !== 'approved') {
      throw AppError.forbidden('Access forbidden: Only approved vendors can update store settings');
    }

    // Check store name uniqueness if updating storeName
    if (input.storeName && input.storeName.toLowerCase() !== profile.storeName.toLowerCase()) {
      const storeNameExists = await VendorProfile.findOne({
        storeName: { $regex: new RegExp(`^${escapeRegex(input.storeName)}$`, 'i') },
        userId: { $ne: userId },
      });

      if (storeNameExists) {
        throw AppError.conflict('Store name is already taken. Please choose another store name.');
      }
      profile.storeName = input.storeName;
    }

    if (input.description !== undefined) {
      profile.description = input.description;
    }

    if (input.businessEmail) {
      profile.businessEmail = input.businessEmail;
    }

    if (input.businessPhone) {
      profile.businessPhone = input.businessPhone;
    }

    if (input.businessAddress) {
      profile.businessAddress = {
        street: input.businessAddress.street ?? profile.businessAddress.street,
        city: input.businessAddress.city ?? profile.businessAddress.city,
        state: input.businessAddress.state ?? profile.businessAddress.state,
        postalCode: input.businessAddress.postalCode ?? profile.businessAddress.postalCode,
        country: input.businessAddress.country ?? profile.businessAddress.country,
      };
    }

    await profile.save();
    return profile;
  }
}
