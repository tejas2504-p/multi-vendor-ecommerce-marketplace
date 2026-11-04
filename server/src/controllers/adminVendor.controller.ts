import { Request, Response, NextFunction } from 'express';
import { VendorService } from '../services/vendor.service';
import { ApiResponse } from '../utils/apiResponse';
import { adminVendorQuerySchema } from '../validators/vendor.validator';

export class AdminVendorController {
  /**
   * GET /api/admin/vendors
   * List vendor applications with filtering, pagination, and sorting
   */
  static listApplications = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const query = adminVendorQuerySchema.parse(req.query);
      const result = await VendorService.listVendorApplications(query);

      ApiResponse.success(
        res,
        result.applications,
        'Vendor applications retrieved successfully',
        200,
        result.meta
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/admin/vendors/:id
   * Retrieve vendor application details by ID
   */
  static getApplicationById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const application = await VendorService.getVendorApplicationById(req.params.id);
      ApiResponse.success(res, application, 'Vendor application details retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/admin/vendors/:id/approve
   * Approve vendor application and activate vendor privileges
   */
  static approveApplication = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const updated = await VendorService.approveVendorApplication(
        req.params.id,
        req.user!.id
      );

      ApiResponse.success(
        res,
        updated,
        'Vendor application approved successfully. Merchant store is now active.'
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/admin/vendors/:id/reject
   * Reject vendor application with reason
   */
  static rejectApplication = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const updated = await VendorService.rejectVendorApplication(
        req.params.id,
        req.user!.id,
        req.body.rejectionReason
      );

      ApiResponse.success(
        res,
        updated,
        'Vendor application rejected successfully'
      );
    } catch (error) {
      next(error);
    }
  };
}

