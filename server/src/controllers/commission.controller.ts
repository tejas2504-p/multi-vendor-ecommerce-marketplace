import { Request, Response, NextFunction } from 'express';
import { CommissionService } from '../services/commission.service';
import { ApiResponse } from '../utils/apiResponse';

export class CommissionController {
  // ==========================================
  // Vendor Endpoints
  // ==========================================

  /**
   * GET /api/vendor/earnings
   * Retrieves current vendor earnings, balances, and summary statistics.
   */
  static async getEarnings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = req.user!.id;
      const earnings = await CommissionService.getVendorEarnings(vendorId);
      ApiResponse.success(res, earnings, 'Vendor earnings retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/vendor/transactions
   * Paginated transaction ledger for authenticated vendor.
   */
  static async getTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = req.user!.id;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const data = await CommissionService.getVendorTransactions(vendorId, page, limit);
      ApiResponse.success(res, data, 'Transactions retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/vendor/payouts
   * Paginated payout history for authenticated vendor.
   */
  static async getPayouts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = req.user!.id;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const data = await CommissionService.getVendorPayouts(vendorId, page, limit);
      ApiResponse.success(res, data, 'Payouts retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/vendor/payouts/request
   * Submits a new payout withdrawal request. Atomically reserves balance.
   */
  static async requestPayout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = req.user!.id;
      const payout = await CommissionService.requestPayout(vendorId, req.body);
      ApiResponse.success(res, payout, 'Payout request submitted successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Admin Endpoints
  // ==========================================

  /**
   * GET /api/admin/payouts
   * Paginated list of payout requests across vendors with status filtering.
   */
  static async getAdminPayouts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await CommissionService.getAdminPayouts(req.query as any);
      ApiResponse.success(res, data, 'Payout requests retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/payouts/:payoutId
   * Retrieve payout detail with vendor profile and ledger audit trails.
   */
  static async getAdminPayoutById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { payoutId } = req.params;
      const data = await CommissionService.getAdminPayoutById(payoutId);
      ApiResponse.success(res, data, 'Payout detail retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/admin/payouts/:payoutId/approve
   * Transition payout request from 'requested' to 'approved'.
   */
  static async approvePayout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.id;
      const { payoutId } = req.params;
      const payout = await CommissionService.approvePayout(adminId, payoutId);
      ApiResponse.success(res, payout, 'Payout request approved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/admin/payouts/:payoutId/reject
   * Rejects payout and restores reserved vendor balance.
   */
  static async rejectPayout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.id;
      const { payoutId } = req.params;
      const { rejectionReason } = req.body;
      const payout = await CommissionService.rejectPayout(adminId, payoutId, rejectionReason);
      ApiResponse.success(res, payout, 'Payout request rejected and balance restored');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/admin/payouts/:payoutId/status
   * Updates payout processing status (processing, paid, failed).
   */
  static async updatePayoutStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.id;
      const { payoutId } = req.params;
      const payout = await CommissionService.updatePayoutStatus(adminId, payoutId, req.body);
      ApiResponse.success(res, payout, 'Payout status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/commission
   * Retrieves commission settings overview and vendor overrides.
   */
  static async getCommissionSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await CommissionService.getAdminCommissionOverview();
      ApiResponse.success(res, data, 'Commission settings retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/admin/commission/platform
   * Updates platform default commission rate.
   */
  static async updatePlatformCommission(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.id;
      const { rate } = req.body;
      const setting = await CommissionService.updatePlatformCommission(adminId, rate);
      ApiResponse.success(res, setting, 'Platform default commission rate updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/admin/commission/vendors/:vendorId
   * Sets or overrides commission rate for a specific vendor.
   */
  static async updateVendorCommission(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.id;
      const { vendorId } = req.params;
      const { rate } = req.body;
      const profile = await CommissionService.updateVendorCommission(adminId, vendorId, rate ?? null);
      ApiResponse.success(res, profile, 'Vendor commission rate updated successfully');
    } catch (error) {
      next(error);
    }
  }
}
