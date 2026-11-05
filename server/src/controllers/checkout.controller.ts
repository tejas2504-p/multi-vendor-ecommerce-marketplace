import { Request, Response, NextFunction } from 'express';
import { CheckoutService } from '../services/checkout.service';
import { ApiResponse } from '../utils/apiResponse';

export class CheckoutController {
  /**
   * POST /api/checkout
   * Processes checkout and creates an order.
   */
  static async checkout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const order = await CheckoutService.processCheckout(userId, req.body);
      ApiResponse.created(res, order, 'Order placed successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/checkout/orders/:id
   * Retrieves an order by ID.
   */
  static async getOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const role = req.user!.role;
      const order = await CheckoutService.getOrderById(userId, req.params.id, role);
      ApiResponse.success(res, order, 'Order retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/checkout/orders
   * Lists all past orders for the authenticated customer.
   */
  static async listOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const orders = await CheckoutService.getCustomerOrders(userId);
      ApiResponse.success(res, orders, 'Orders retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

