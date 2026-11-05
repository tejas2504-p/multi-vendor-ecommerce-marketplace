import { Request, Response, NextFunction } from 'express';
import { OrderService } from '../services/order.service';
import { ApiResponse } from '../utils/apiResponse';

export class OrderController {
  // ============================================================================
  // Task 3: Customer Order Endpoints
  // ============================================================================

  /**
   * GET /api/orders
   * List authenticated customer's parent orders
   */
  static async getCustomerOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = req.user!.id;
      const orders = await OrderService.getCustomerOrders(customerId);
      ApiResponse.success(res, orders, 'Customer orders retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/orders/:orderId
   * Retrieve single customer parent order
   */
  static async getCustomerOrderById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = req.user!.id;
      const order = await OrderService.getCustomerOrderById(customerId, req.params.orderId);
      ApiResponse.success(res, order, 'Order details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/orders/:orderId/vendor-orders
   * Retrieve child vendor orders for a given customer parent order
   */
  static async getCustomerVendorOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = req.user!.id;
      const vendorOrders = await OrderService.getCustomerVendorOrders(customerId, req.params.orderId);
      ApiResponse.success(res, vendorOrders, 'Vendor shipment details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  // ============================================================================
  // Task 4: Vendor Order Endpoints
  // ============================================================================

  /**
   * GET /api/vendor/orders
   * List vendor orders assigned to the authenticated vendor
   */
  static async getVendorOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = req.user!.id;
      const status = req.query.status as string | undefined;
      const vendorOrders = await OrderService.getVendorOrders(vendorId, status);
      ApiResponse.success(res, vendorOrders, 'Vendor orders retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/vendor/orders/:vendorOrderId
   * Retrieve details of a specific vendor order
   */
  static async getVendorOrderById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = req.user!.id;
      const vendorOrder = await OrderService.getVendorOrderById(vendorId, req.params.vendorOrderId);
      ApiResponse.success(res, vendorOrder, 'Vendor order details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/vendor/orders/:vendorOrderId/status
   * Update vendor order fulfillment status and tracking information
   */
  static async updateVendorOrderStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = req.user!.id;
      const vendorOrder = await OrderService.updateVendorOrderStatus(
        vendorId,
        req.params.vendorOrderId,
        req.body
      );
      ApiResponse.success(res, vendorOrder, 'Vendor order status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  // ============================================================================
  // Task 5: Admin Order Endpoints
  // ============================================================================

  /**
   * GET /api/admin/orders
   * List all platform orders with filtering
   */
  static async getAdminOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = Number(req.query.limit) || 20;
      const result = await OrderService.getAdminOrders({
        status: req.query.status as string,
        paymentStatus: req.query.paymentStatus as string,
        customerId: req.query.customerId as string,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit,
      });
      ApiResponse.success(
        res,
        result.orders,
        'Platform orders retrieved successfully',
        200,
        {
          page: result.page,
          limit,
          total: result.total,
          totalPages: result.totalPages,
        }
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/orders/:orderId
   * Retrieve platform order details by ID
   */
  static async getAdminOrderById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await OrderService.getAdminOrderById(req.params.orderId);
      ApiResponse.success(res, order, 'Platform order details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/vendor-orders
   * List all vendor orders across the marketplace
   */
  static async getAdminVendorOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = Number(req.query.limit) || 20;
      const result = await OrderService.getAdminVendorOrders({
        vendorId: req.query.vendorId as string,
        status: req.query.status as string,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit,
      });
      ApiResponse.success(
        res,
        result.vendorOrders,
        'Platform vendor orders retrieved successfully',
        200,
        {
          page: result.page,
          limit,
          total: result.total,
          totalPages: result.totalPages,
        }
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/admin/orders/:orderId/status
   * Administrative override of parent order status
   */
  static async adminUpdateOrderStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await OrderService.adminUpdateOrderStatus(req.params.orderId, req.body);
      ApiResponse.success(res, order, 'Order status updated by platform administrator');
    } catch (error) {
      next(error);
    }
  }
}
