import { Request, Response, NextFunction } from 'express';
import { VendorProfile } from '../models/vendorProfile.model';
import { AppError } from '../utils/apiError';

/**
 * Middleware ensuring the authenticated user has an APPROVED vendor account.
 * Rejects unauthenticated requests with 401 Unauthorized.
 * Rejects non-vendors or unapproved/pending/rejected vendors with 403 Forbidden.
 */
export const requireApprovedVendor = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required to access vendor resources'));
    }

    // Role-level guard
    if (req.user.role !== 'vendor') {
      return next(
        AppError.forbidden(
          `Access forbidden: Role '${req.user.role}' is not authorized. Requires an approved vendor account.`
        )
      );
    }

    // Database verification: Confirm VendorProfile exists and is officially approved
    const profile = await VendorProfile.findOne({ userId: req.user.id });
    if (!profile) {
      return next(
        AppError.forbidden('Access forbidden: No vendor profile found for this account')
      );
    }

    if (profile.status !== 'approved') {
      return next(
        AppError.forbidden(
          `Access forbidden: Your vendor application is currently '${profile.status}'. Only approved vendors can access this dashboard.`
        )
      );
    }

    // Cache profile on request object
    req.vendorProfile = profile;
    next();
  } catch (error) {
    next(error);
  }
};

