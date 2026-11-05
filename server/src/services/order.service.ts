import { Types } from 'mongoose';
import { Order, IOrder, OrderStatus } from '../models/order.model';
import { VendorOrder, IVendorOrder, VendorOrderDocument, VendorOrderStatus } from '../models/vendorOrder.model';
import { Product } from '../models/product.model';
import { ProductIndexingService } from './productIndexing.service';
import { AppError } from '../utils/apiError';
import { UpdateVendorOrderStatusInput, AdminUpdateOrderStatusInput } from '../validators/order.validator';
import { logger } from '../utils/logger';

export class OrderService {
  /**
   * Status Aggregation Rule:
   * Computes the composite parent order status from the statuses of its child vendor orders.
   * Handles partial delivery, partial shipment, and partial cancellation correctly.
   */
  static deriveParentOrderStatus(vendorOrderStatuses: string[]): OrderStatus {
    if (!vendorOrderStatuses || vendorOrderStatuses.length === 0) {
      return 'confirmed';
    }

    // 1. If every single vendor order is cancelled -> overall order is cancelled
    if (vendorOrderStatuses.every((s) => s === 'cancelled')) {
      return 'cancelled';
    }

    // Filter out cancelled vendor orders to examine active fulfillment flows
    const activeStatuses = vendorOrderStatuses.filter((s) => s !== 'cancelled');

    // 2. If all active vendor orders are delivered -> delivered
    if (activeStatuses.length > 0 && activeStatuses.every((s) => s === 'delivered')) {
      return 'delivered';
    }

    // 3. If at least one active vendor order is delivered -> partially_delivered
    if (activeStatuses.some((s) => s === 'delivered')) {
      return 'partially_delivered';
    }

    // 4. If all active vendor orders are shipped -> shipped
    if (activeStatuses.length > 0 && activeStatuses.every((s) => s === 'shipped')) {
      return 'shipped';
    }

    // 5. If at least one active vendor order is shipped -> partially_shipped
    if (activeStatuses.some((s) => s === 'shipped')) {
      return 'partially_shipped';
    }

    // 6. If any active vendor order is processing -> processing
    if (activeStatuses.some((s) => s === 'processing')) {
      return 'processing';
    }

    // 7. If any active vendor order is confirmed -> confirmed
    if (activeStatuses.some((s) => s === 'confirmed')) {
      return 'confirmed';
    }

    return 'pending';
  }

  // ============================================================================
  // Task 3: Customer Order Methods
  // ============================================================================

  /**
   * Retrieve all parent orders placed by the authenticated customer.
   */
  static async getCustomerOrders(customerId: string): Promise<IOrder[]> {
    const userObjectId = new Types.ObjectId(customerId);
    return Order.find({ userId: userObjectId })
      .populate('vendorOrders')
      .sort({ createdAt: -1 });
  }

  /**
   * Retrieve a specific parent order by ID, strictly enforcing customer ownership.
   */
  static async getCustomerOrderById(customerId: string, orderId: string): Promise<IOrder> {
    const order = await Order.findById(orderId).populate('vendorOrders');
    if (!order) {
      throw AppError.notFound('Order not found');
    }

    if (order.userId.toString() !== customerId) {
      throw AppError.forbidden('Access forbidden: You do not have permission to view this order');
    }

    return order;
  }

  /**
   * Retrieve the list of child vendor orders for a customer's parent order.
   */
  static async getCustomerVendorOrders(customerId: string, orderId: string): Promise<IVendorOrder[]> {
    // Verifies customer ownership first
    await this.getCustomerOrderById(customerId, orderId);
    return VendorOrder.find({ parentOrderId: new Types.ObjectId(orderId) }).sort({ createdAt: 1 });
  }

  // ============================================================================
  // Task 4: Vendor Order Methods
  // ============================================================================

  /**
   * Retrieve all vendor orders belonging exclusively to the authenticated vendor.
   */
  static async getVendorOrders(vendorId: string, status?: string): Promise<IVendorOrder[]> {
    const query: Record<string, any> = { vendorId: new Types.ObjectId(vendorId) };
    if (status) {
      query.orderStatus = status;
    }
    return VendorOrder.find(query).sort({ createdAt: -1 });
  }

  /**
   * Retrieve a specific vendor order by ID, enforcing vendor tenant isolation.
   */
  static async getVendorOrderById(vendorId: string, vendorOrderId: string): Promise<VendorOrderDocument> {
    const vendorOrder = await VendorOrder.findById(vendorOrderId);
    if (!vendorOrder) {
      throw AppError.notFound('Vendor order not found');
    }

    if (vendorOrder.vendorId.toString() !== vendorId) {
      throw AppError.forbidden('Access forbidden: You do not have permission to access this vendor order');
    }

    return vendorOrder;
  }

  /**
   * Update the status and shipment tracking of a vendor order with strict lifecycle validation.
   * If cancelled, automatically restores inventory exactly once.
   */
  static async updateVendorOrderStatus(
    vendorId: string,
    vendorOrderId: string,
    input: UpdateVendorOrderStatusInput
  ): Promise<VendorOrderDocument> {
    const vendorOrder = await this.getVendorOrderById(vendorId, vendorOrderId);
    const currentStatus = vendorOrder.orderStatus;
    const nextStatus = input.status;

    // Idempotent return if already in target state
    if (currentStatus === nextStatus) {
      return vendorOrder;
    }

    // Allowed status transition map
    const ALLOWED_TRANSITIONS: Record<VendorOrderStatus, VendorOrderStatus[]> = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['delivered'],
      delivered: [],
      cancelled: [],
    };

    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(nextStatus)) {
      throw AppError.badRequest(
        `Invalid status transition from "${currentStatus}" to "${nextStatus}". Allowed transitions: [${allowed.join(', ') || 'none'}]`
      );
    }

    // When status advances to shipped, record shipment tracking
    if (nextStatus === 'shipped') {
      vendorOrder.shipmentTracking = {
        carrier: input.carrier || vendorOrder.shipmentTracking?.carrier || 'Standard Shipping',
        trackingNumber: input.trackingNumber || vendorOrder.shipmentTracking?.trackingNumber,
        shippedAt: new Date(),
      };
    }

    // When marked delivered, record delivered timestamp
    if (nextStatus === 'delivered') {
      if (!vendorOrder.shipmentTracking) {
        vendorOrder.shipmentTracking = {};
      }
      vendorOrder.shipmentTracking.deliveredAt = new Date();
    }

    // When cancelled, validate eligibility and restore inventory exactly once
    if (nextStatus === 'cancelled') {
      vendorOrder.cancellationReason = input.cancellationReason || 'Cancelled by vendor';
      vendorOrder.cancelledAt = new Date();

      // Restore inventory in MongoDB
      for (const item of vendorOrder.items) {
        await Product.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity } });
        Product.findById(item.productId)
          .then((p) => {
            if (p) ProductIndexingService.syncProduct(p);
          })
          .catch((err) => {
            logger.warn(`Failed to sync product ${item.productId} to index upon cancellation: ${err.message}`);
          });
      }
    }

    // Append to status history
    vendorOrder.orderStatus = nextStatus;
    vendorOrder.statusHistory.push({
      status: nextStatus,
      changedAt: new Date(),
      changedBy: new Types.ObjectId(vendorId),
      note: input.note || `Order status updated to ${nextStatus}`,
    });

    await vendorOrder.save();

    // Recalculate and update parent order status
    const allChildOrders = await VendorOrder.find({ parentOrderId: vendorOrder.parentOrderId });
    const newParentStatus = this.deriveParentOrderStatus(allChildOrders.map((o) => o.orderStatus));

    await Order.updateOne({ _id: vendorOrder.parentOrderId }, { $set: { orderStatus: newParentStatus } });

    return vendorOrder;
  }

  // ============================================================================
  // Task 5: Admin Order Governance Methods
  // ============================================================================

  /**
   * Retrieve all parent orders across the platform with filtering.
   */
  static async getAdminOrders(filters: {
    status?: string;
    paymentStatus?: string;
    customerId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ orders: IOrder[]; total: number; page: number; totalPages: number }> {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {};
    if (filters.status) query.orderStatus = filters.status;
    if (filters.paymentStatus) query.paymentStatus = filters.paymentStatus;
    if (filters.customerId && Types.ObjectId.isValid(filters.customerId)) {
      query.userId = new Types.ObjectId(filters.customerId);
    }

    const [orders, total] = await Promise.all([
      Order.find(query).populate('vendorOrders').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(query),
    ]);

    return {
      orders,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieve any parent order details for platform administration.
   */
  static async getAdminOrderById(orderId: string): Promise<IOrder> {
    const order = await Order.findById(orderId).populate('vendorOrders');
    if (!order) {
      throw AppError.notFound('Order not found');
    }
    return order;
  }

  /**
   * Retrieve all vendor orders across all vendors for platform administration.
   */
  static async getAdminVendorOrders(filters: {
    vendorId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ vendorOrders: IVendorOrder[]; total: number; page: number; totalPages: number }> {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {};
    if (filters.vendorId && Types.ObjectId.isValid(filters.vendorId)) {
      query.vendorId = new Types.ObjectId(filters.vendorId);
    }
    if (filters.status) {
      query.orderStatus = filters.status;
    }

    const [vendorOrders, total] = await Promise.all([
      VendorOrder.find(query).populate('parentOrderId').sort({ createdAt: -1 }).skip(skip).limit(limit),
      VendorOrder.countDocuments(query),
    ]);

    return {
      vendorOrders,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Admin status override for a parent order.
   */
  static async adminUpdateOrderStatus(
    orderId: string,
    input: AdminUpdateOrderStatusInput
  ): Promise<IOrder> {
    const order = await Order.findById(orderId);
    if (!order) {
      throw AppError.notFound('Order not found');
    }

    order.orderStatus = input.status;
    await order.save();

    return order;
  }
}
