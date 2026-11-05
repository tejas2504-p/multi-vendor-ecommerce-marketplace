import mongoose, { Types } from 'mongoose';
import { Cart } from '../models/cart.model';
import { Product } from '../models/product.model';
import { VendorProfile } from '../models/vendorProfile.model';
import { Address } from '../models/address.model';
import { Order, IOrder, IOrderItemSnapshot, IDeliveryAddressSnapshot } from '../models/order.model';
import { VendorOrder, IVendorOrder } from '../models/vendorOrder.model';
import { CartCacheService } from './cartCache.service';
import { AppError } from '../utils/apiError';
import { CheckoutInput } from '../validators/checkout.validator';
import { ProductIndexingService } from './productIndexing.service';
import { logger } from '../utils/logger';

export class CheckoutService {
  /**
   * Processes checkout and creates an immutable order.
   *
   * Security & Business Rules:
   * 1. Authenticates customer.
   * 2. Reads persistent cart from MongoDB (never trusts frontend or stale Redis cache).
   * 3. Validates delivery address exists and belongs to this customer.
   * 4. Re-fetches current live product info from MongoDB.
   * 5. Enforces product is active and vendor is approved.
   * 6. Validates available inventory for all items.
   * 7. Computes prices, subtotal, shipping, and total strictly on backend.
   * 8. Atomically updates inventory using concurrency-safe conditional updates or transactions.
   * 9. Creates order document with address and product snapshots.
   * 10. Empties cart and invalidates Redis cache.
   * 11. Handles idempotency to prevent duplicate orders or double inventory decrements.
   */
  static async processCheckout(userId: string, input: CheckoutInput): Promise<IOrder> {
    const userObjectId = new Types.ObjectId(userId);

    // 1. Idempotency Check: if key provided, check if already processed
    if (input.idempotencyKey) {
      const existingOrder = await Order.findOne({
        userId: userObjectId,
        idempotencyKey: input.idempotencyKey,
      }).populate('vendorOrders');
      if (existingOrder) {
        logger.info(`Idempotent checkout hit for order ${existingOrder.orderNumber}`);
        return existingOrder;
      }
    }

    // 2. Validate delivery address ownership
    const address = await Address.findById(input.addressId);
    if (!address) {
      throw AppError.notFound('Selected delivery address was not found');
    }
    if (address.userId.toString() !== userId) {
      throw AppError.forbidden('Access forbidden: Delivery address does not belong to your account');
    }

    const deliveryAddressSnapshot: IDeliveryAddressSnapshot = {
      fullName: address.fullName,
      phone: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 || '',
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
    };

    // 3. Retrieve persistent cart from MongoDB
    const cart = await Cart.findOne({ userId: userObjectId });
    if (!cart || !cart.items || cart.items.length === 0) {
      throw AppError.badRequest('Cannot checkout: your shopping cart is empty');
    }

    // 4. Validate all products, vendors, stock, and calculate prices on backend
    const orderItems: IOrderItemSnapshot[] = [];
    let subtotal = 0;

    for (const item of cart.items) {
      if (!item.quantity || item.quantity <= 0) {
        throw AppError.badRequest('Cart contains invalid item quantity');
      }

      const product = await Product.findById(item.productId);
      if (!product || product.isDeleted) {
        throw AppError.badRequest(`A product in your cart is no longer available`);
      }

      if (product.status !== 'active') {
        throw AppError.badRequest(`Product "${product.name}" is currently inactive and cannot be purchased`);
      }

      // Verify vendor status
      const vendorProfile = await VendorProfile.findOne({
        userId: product.vendorId,
        status: 'approved',
      });
      if (!vendorProfile) {
        throw AppError.badRequest(`Vendor for product "${product.name}" is not approved or inactive`);
      }

      // Check available stock
      if (product.stock < item.quantity) {
        throw AppError.badRequest(
          `Insufficient stock for "${product.name}". Available: ${product.stock}, requested: ${item.quantity}`
        );
      }

      // Calculate snapshot values from backend DB
      const unitPrice = product.price;
      const itemSubtotal = Math.round(unitPrice * item.quantity * 100) / 100;
      subtotal += itemSubtotal;

      const firstImage = product.images && product.images.length > 0 ? product.images[0].key : '';

      orderItems.push({
        productId: product._id,
        vendorId: product.vendorId,
        productName: product.name,
        productImage: firstImage,
        quantity: item.quantity,
        unitPrice,
        itemSubtotal,
      });
    }

    subtotal = Math.round(subtotal * 100) / 100;
    // Standard shipping: Free if subtotal >= $100, else flat $10
    const shippingAmount = subtotal >= 100 ? 0 : 10;
    const discountAmount = 0;
    const totalAmount = Math.round((subtotal + shippingAmount - discountAmount) * 100) / 100;

    // Generate unique human-readable order number (e.g. ORD-173089-ABCD)
    const timestampStr = Date.now().toString(36).toUpperCase();
    const randomHex = Math.floor(1000 + Math.random() * 9000).toString(36).toUpperCase();
    const orderNumber = `ORD-${timestampStr}-${randomHex}`;

    // Group items by vendor for multi-vendor order splitting
    const vendorMap = new Map<string, IOrderItemSnapshot[]>();
    for (const it of orderItems) {
      const vKey = it.vendorId.toString();
      if (!vendorMap.has(vKey)) {
        vendorMap.set(vKey, []);
      }
      vendorMap.get(vKey)!.push(it);
    }

    // Prepare vendor order payloads
    const vendorOrderPayloads: Array<{
      vendorId: Types.ObjectId;
      vendorOrderNumber: string;
      items: IOrderItemSnapshot[];
      vendorSubtotal: number;
      shippingShare: number;
      orderStatus: 'confirmed';
    }> = [];

    let vCount = 1;
    for (const [vKey, vItems] of vendorMap.entries()) {
      const vSubtotal = Math.round(vItems.reduce((sum, item) => sum + item.itemSubtotal, 0) * 100) / 100;
      const vOrderNum = `${orderNumber}-V${vCount++}`;
      const vShippingShare = subtotal > 0 ? Math.round((vSubtotal / subtotal) * shippingAmount * 100) / 100 : 0;

      vendorOrderPayloads.push({
        vendorId: new Types.ObjectId(vKey),
        vendorOrderNumber: vOrderNum,
        items: vItems,
        vendorSubtotal: vSubtotal,
        shippingShare: vShippingShare,
        orderStatus: 'confirmed',
      });
    }

    const orderData: Partial<IOrder> = {
      orderNumber,
      userId: userObjectId,
      customerId: userObjectId,
      deliveryAddress: deliveryAddressSnapshot,
      items: orderItems,
      subtotal,
      shippingAmount,
      discountAmount,
      totalAmount,
      paymentStatus: 'pending',
      orderStatus: 'confirmed',
      idempotencyKey: input.idempotencyKey,
    };

    // 5. Concurrency-safe stock updates & order creation
    let createdOrder!: IOrder;

    // Check if deployment supports replica set transactions
    const client = (mongoose.connection as any).client;
    const isReplicaSet = Boolean(
      client?.topology?.description?.setName ||
      client?.topology?.description?.type === 'ReplicaSetWithPrimary' ||
      client?.topology?.description?.type === 'Sharded'
    );

    let session: mongoose.ClientSession | null = null;
    let transactionSuccess = false;

    if (isReplicaSet) {
      try {
        session = await mongoose.startSession();
        session.startTransaction();

        for (const item of cart.items) {
          const updated = await Product.findOneAndUpdate(
            {
              _id: item.productId,
              stock: { $gte: item.quantity },
              status: 'active',
              isDeleted: false,
            },
            { $inc: { stock: -item.quantity } },
            { session, new: true }
          );

          if (!updated) {
            throw AppError.badRequest('Stock changed during checkout. Please review your cart.');
          }
        }

        const [order] = await Order.create([orderData], { session });
        createdOrder = order;

        // Create child vendor orders within transaction
        const createdVendorOrders: Types.ObjectId[] = [];
        for (const payload of vendorOrderPayloads) {
          const [vo] = await VendorOrder.create(
            [{ ...payload, parentOrderId: createdOrder._id }],
            { session }
          );
          createdVendorOrders.push(vo._id);
        }

        createdOrder.vendorOrders = createdVendorOrders;
        await Order.updateOne(
          { _id: createdOrder._id },
          { $set: { vendorOrders: createdVendorOrders, customerId: userObjectId } },
          { session }
        );

        // Clear cart in persistent DB
        await Cart.updateOne({ _id: cart._id }, { items: [] }, { session });

        await session.commitTransaction();
        transactionSuccess = true;
      } catch (error: any) {
        if (session && session.inTransaction()) {
          await session.abortTransaction().catch(() => {});
        }
        // If the error was specifically that transactions are not supported, fall through to atomic mode
        if (error?.message?.includes('Transaction numbers are only allowed') || error?.code === 20) {
          transactionSuccess = false;
        } else {
          throw error;
        }
      } finally {
        if (session) {
          session.endSession();
        }
      }
    }

    if (!transactionSuccess) {
      // Standalone / Non-replica-set mode: Atomic conditional updates with strict compensation rollback
      const decrementedItems: Array<{ productId: Types.ObjectId; quantity: number }> = [];

      try {
        for (const item of cart.items) {
          const updated = await Product.findOneAndUpdate(
            {
              _id: item.productId,
              stock: { $gte: item.quantity },
              status: 'active',
              isDeleted: false,
            },
            { $inc: { stock: -item.quantity } },
            { new: true }
          );

          if (!updated) {
            throw AppError.badRequest('Stock changed during checkout. Please review your cart.');
          }

          decrementedItems.push({ productId: item.productId, quantity: item.quantity });
        }

        createdOrder = await Order.create(orderData);

        // Create child vendor orders
        const createdVendorOrders: Types.ObjectId[] = [];
        for (const payload of vendorOrderPayloads) {
          const vo = await VendorOrder.create({
            ...payload,
            parentOrderId: createdOrder._id,
          });
          createdVendorOrders.push(vo._id);
        }

        createdOrder.vendorOrders = createdVendorOrders;
        await Order.updateOne(
          { _id: createdOrder._id },
          { $set: { vendorOrders: createdVendorOrders, customerId: userObjectId } }
        );

        // Clear cart in persistent DB
        await Cart.updateOne({ _id: cart._id }, { items: [] });
      } catch (error) {
        // Rollback created child vendor orders & parent order
        if (createdOrder?._id) {
          await VendorOrder.deleteMany({ parentOrderId: createdOrder._id });
          await Order.deleteOne({ _id: createdOrder._id });
        }
        // Rollback any decremented inventory immediately to prevent inventory leakage
        for (const dec of decrementedItems) {
          await Product.updateOne({ _id: dec.productId }, { $inc: { stock: dec.quantity } });
        }
        throw error;
      }
    }

    // 6. Invalidate Redis cart cache
    await CartCacheService.delete(userId);

    // 7. Synchronize Elasticsearch index for updated product stock in background
    for (const item of cart.items) {
      Product.findById(item.productId)
        .then((p) => {
          if (p) ProductIndexingService.syncProduct(p);
        })
        .catch((err) => {
          logger.warn(`Failed to sync product ${item.productId} to search index after checkout: ${err.message}`);
        });
    }

    const populated = await Order.findById(createdOrder._id).populate('vendorOrders');
    return populated || createdOrder;
  }

  /**
   * Retrieves an order by ID, enforcing ownership.
   */
  static async getOrderById(userId: string, orderId: string, role?: string): Promise<IOrder> {
    const order = await Order.findById(orderId);
    if (!order) {
      throw AppError.notFound('Order not found');
    }

    // Allow owner customer or admin platform governance
    if (order.userId.toString() !== userId && role !== 'admin') {
      throw AppError.forbidden('Access forbidden: You do not have permission to view this order');
    }

    return order;
  }

  /**
   * Lists orders for authenticated customer.
   */
  static async getCustomerOrders(userId: string): Promise<IOrder[]> {
    const userObjectId = new Types.ObjectId(userId);
    return Order.find({ userId: userObjectId }).sort({ createdAt: -1 });
  }
}
