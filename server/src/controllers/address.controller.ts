import { Request, Response, NextFunction } from 'express';
import { AddressService } from '../services/address.service';
import { ApiResponse } from '../utils/apiResponse';

export class AddressController {
  /**
   * POST /api/addresses
   * Create an address for the authenticated user.
   */
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const address = await AddressService.createAddress(userId, req.body);
      ApiResponse.created(res, address, 'Delivery address added successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/addresses
   * List all addresses for the authenticated user.
   */
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const addresses = await AddressService.getAddresses(userId);
      ApiResponse.success(res, addresses, 'Addresses retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/addresses/:id
   * Get an address by ID for the authenticated user.
   */
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const address = await AddressService.getAddressById(userId, req.params.id);
      ApiResponse.success(res, address, 'Address retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/addresses/:id
   * Update an address for the authenticated user.
   */
  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const address = await AddressService.updateAddress(userId, req.params.id, req.body);
      ApiResponse.success(res, address, 'Address updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/addresses/:id/default
   * Set address as default.
   */
  static async setDefault(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const address = await AddressService.setDefaultAddress(userId, req.params.id);
      ApiResponse.success(res, address, 'Default delivery address updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/addresses/:id
   * Delete an address for the authenticated user.
   */
  static async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const result = await AddressService.deleteAddress(userId, req.params.id);
      ApiResponse.success(res, result, 'Address deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

