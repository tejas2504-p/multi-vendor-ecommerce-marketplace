import { Request, Response, NextFunction } from 'express';
import { VendorService } from '../services/vendor.service';
import { ApiResponse } from '../utils/apiResponse';

export class VendorController {
  /**
   * POST /api/vendors/apply
   * Submit vendor onboarding application
   */
  static apply = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const profile = await VendorService.applyForVendor(
        req.user!.id,
        req.user!.role,
        req.body
      );

      ApiResponse.created(
        res,
        profile,
        'Vendor application submitted successfully and is pending administrative review'
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/vendors/me
   * Retrieve vendor profile of authenticated user
   */
  static getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const profile = await VendorService.getVendorProfile(req.user!.id);
      ApiResponse.success(res, profile, 'Vendor profile retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/vendors/me
   * Update permitted store details of authenticated user
   */
  static updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const updatedProfile = await VendorService.updateVendorProfile(req.user!.id, req.body);
      ApiResponse.success(res, updatedProfile, 'Vendor profile updated successfully');
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/vendors/status
   * Check vendor application review status
   */
  static getStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const statusData = await VendorService.getVendorApplicationStatus(req.user!.id);
      ApiResponse.success(res, statusData, 'Vendor application status retrieved successfully');
    } catch (error) {
      next(error);
    }
  };
}
