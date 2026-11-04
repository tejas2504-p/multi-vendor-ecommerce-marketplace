import { VendorProfile, IVendorProfile } from '../models/vendorProfile.model';
import { ApplyVendorInput, UpdateVendorProfileInput } from '../validators/vendor.validator';
import { AppError } from '../utils/apiError';

const escapeRegex = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
}
