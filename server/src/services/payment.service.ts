import crypto from 'crypto';
import { Types } from 'mongoose';
import { Payment, IPayment, PaymentDocument } from '../models/payment.model';
import { Order, IOrder } from '../models/order.model';
import { ProcessedWebhookEvent } from '../models/webhookEvent.model';
import { razorpayClient } from '../config/razorpay.config';
import { env } from '../config/env.config';
import { AppError } from '../utils/apiError';
import { VerifyPaymentInput } from '../validators/payment.validator';
import { logger } from '../utils/logger';

export interface RazorpayOrderCheckoutData {
  keyId: string;
  razorpayOrderId: string;
  amount: number; // in paise
  currency: string;
  orderId: string;
  orderNumber: string;
  customer: {
    name: string;
    phone: string;
  };
}

export class PaymentService {
  /**
   * Helper to verify Razorpay signature using HMAC-SHA256
   */
  static verifySignature(orderId: string, paymentId: string, signature: string, secret: string = env.RAZORPAY_KEY_SECRET): boolean {
    const generated = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(generated, 'utf-8'), Buffer.from(signature, 'utf-8'));
  }

  /**
   * Helper to verify Razorpay Webhook signature
   */
  static verifyWebhookSignature(rawBody: string | Buffer, signature: string, secret: string = env.RAZORPAY_WEBHOOK_SECRET): boolean {
    const bodyStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const generated = crypto
      .createHmac('sha256', secret)
      .update(bodyStr)
      .digest('hex');
    
    if (generated.length !== signature.length) {
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(generated, 'utf-8'), Buffer.from(signature, 'utf-8'));
  }

  /**
   * Task 3 – Payment Initiation API:
   * Creates a Razorpay order for an eligible marketplace order.
   * Calculates payable amount strictly using backend stored order data.
   */
  static async createPaymentOrder(customerId: string, orderId: string): Promise<RazorpayOrderCheckoutData> {
    const order = await Order.findById(orderId);
    if (!order) {
      throw AppError.notFound('Order not found');
    }

    // Customer ownership validation
    if (order.userId.toString() !== customerId) {
      throw AppError.forbidden('Access forbidden: You do not have permission to pay for this order');
    }

    // Eligibility check
    if (order.orderStatus === 'cancelled') {
      throw AppError.badRequest('Cannot initiate payment for a cancelled order');
    }

    if (order.paymentStatus === 'paid') {
      throw AppError.badRequest('Order is already paid');
    }

    // Backend-authoritative amount calculation in paise (Razorpay integer unit)
    const amountPaise = Math.round(order.totalAmount * 100);
    if (amountPaise <= 0) {
      throw AppError.badRequest('Invalid order total amount for payment initiation');
    }

    const currency = 'INR';
    let rzpOrderId = '';

    // Create Razorpay order via official SDK with fallback for test/offline environments
    try {
      if (process.env.NODE_ENV === 'test' || env.RAZORPAY_KEY_ID.includes('placeholder')) {
        // Deterministic test order id for automated testing
        rzpOrderId = `order_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      } else {
        const rzpResponse: any = await razorpayClient.orders.create({
          amount: amountPaise,
          currency,
          receipt: order.orderNumber,
          notes: {
            orderId: order._id.toString(),
            customerId,
          },
        });
        rzpOrderId = rzpResponse.id;
      }
    } catch (error: any) {
      logger.error('Failed to create order with Razorpay SDK:', error);
      // Fallback in case of network issue in test/dev
      if (process.env.NODE_ENV === 'test') {
        rzpOrderId = `order_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      } else {
        throw AppError.internal('Failed to initiate payment gateway order. Please try again.');
      }
    }

    // Create or update payment record
    await Payment.create({
      customerId: new Types.ObjectId(customerId),
      parentOrderId: order._id,
      razorpayOrderId: rzpOrderId,
      amount: order.totalAmount,
      currency,
      status: 'pending',
    });

    return {
      keyId: env.RAZORPAY_KEY_ID,
      razorpayOrderId: rzpOrderId,
      amount: amountPaise,
      currency,
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      customer: {
        name: order.deliveryAddress.fullName,
        phone: order.deliveryAddress.phone,
      },
    };
  }

  /**
   * Task 4 – Payment Verification API:
   * Cryptographically verifies the Razorpay signature and updates payment status.
   * Fully idempotent, preventing replay or duplicate processing.
   */
  static async verifyPayment(
    customerId: string,
    input: VerifyPaymentInput
  ): Promise<{ payment: PaymentDocument; order: IOrder; isDuplicate: boolean }> {
    const payment = await Payment.findOne({ razorpayOrderId: input.razorpay_order_id });
    if (!payment) {
      throw AppError.notFound('Payment record not found for this Razorpay order ID');
    }

    // Ownership check
    if (payment.customerId.toString() !== customerId) {
      throw AppError.forbidden('Access forbidden: You do not have permission to verify this payment');
    }

    const order = await Order.findById(payment.parentOrderId);
    if (!order) {
      throw AppError.notFound('Associated order not found');
    }

    // Idempotency: if payment already captured with this payment ID, return idempotently
    if (payment.status === 'captured') {
      if (payment.razorpayPaymentId === input.razorpay_payment_id) {
        logger.info(`Idempotent payment verification hit for order ${order.orderNumber}`);
        return { payment, order, isDuplicate: true };
      }
      throw AppError.badRequest('This order has already been paid and captured under another transaction');
    }

    // Verify cryptographic signature
    let isValidSignature = false;
    try {
      isValidSignature = this.verifySignature(
        input.razorpay_order_id,
        input.razorpay_payment_id,
        input.razorpay_signature
      );
    } catch {
      isValidSignature = false;
    }

    if (!isValidSignature) {
      payment.status = 'failed';
      payment.failureReason = 'Invalid cryptographic payment signature';
      payment.razorpayPaymentId = input.razorpay_payment_id;
      payment.razorpaySignature = input.razorpay_signature;
      await payment.save();

      throw AppError.badRequest('Invalid payment signature. Verification failed.');
    }

    // Validation: ensure order totalAmount reconciles with payment amount
    if (Math.round(order.totalAmount * 100) !== Math.round(payment.amount * 100)) {
      payment.status = 'failed';
      payment.failureReason = 'Payment amount mismatch between order and payment record';
      await payment.save();
      throw AppError.badRequest('Payment amount mismatch between order and payment record');
    }

    // Mark payment as captured
    payment.status = 'captured';
    payment.razorpayPaymentId = input.razorpay_payment_id;
    payment.razorpaySignature = input.razorpay_signature;
    payment.verifiedAt = new Date();
    await payment.save();

    // Mark parent order as paid (Do not alter vendor order status to shipped/delivered)
    order.paymentStatus = 'paid';
    await order.save();

    logger.info(`Payment verified and captured successfully for order ${order.orderNumber}`);

    return { payment, order, isDuplicate: false };
  }

  /**
   * Task 5 – Webhook Integration:
   * Handles payment.captured, payment.failed events from Razorpay.
   * Idempotent with event deduplication.
   */
  static async processWebhook(
    rawBody: string | Buffer,
    signature: string,
    eventPayload: any
  ): Promise<{ processed: boolean; event: string; isDuplicate?: boolean }> {
    if (!signature) {
      throw AppError.badRequest('Missing Razorpay webhook signature header');
    }

    const isValid = this.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      throw AppError.badRequest('Invalid webhook signature');
    }

    const eventId = eventPayload.event_id || eventPayload.id || `evt_${eventPayload.event}_${Date.now()}`;
    const eventType = eventPayload.event;

    // Check for duplicate webhook event (Event Deduplication)
    const existingEvent = await ProcessedWebhookEvent.findOne({ eventId });
    if (existingEvent) {
      logger.info(`Duplicate webhook event ${eventId} received and ignored.`);
      return { processed: true, event: eventType, isDuplicate: true };
    }

    // Store processed event
    await ProcessedWebhookEvent.create({
      eventId,
      eventType,
      processedAt: new Date(),
    });

    // Reconcile according to event type
    const paymentEntity = eventPayload?.payload?.payment?.entity;
    if (paymentEntity) {
      const rzpOrderId = paymentEntity.order_id;
      const rzpPaymentId = paymentEntity.id;
      const paymentMethod = paymentEntity.method || 'unknown';

      if (rzpOrderId) {
        const payment = await Payment.findOne({ razorpayOrderId: rzpOrderId });
        if (payment) {
          if (eventType === 'payment.captured' || eventType === 'order.paid') {
            payment.status = 'captured';
            payment.razorpayPaymentId = rzpPaymentId;
            payment.paymentMethod = paymentMethod;
            payment.verifiedAt = new Date();
            await payment.save();

            await Order.updateOne(
              { _id: payment.parentOrderId },
              { $set: { paymentStatus: 'paid' } }
            );
            logger.info(`Webhook reconciled payment.captured for order ${payment.parentOrderId}`);
          } else if (eventType === 'payment.failed') {
            payment.status = 'failed';
            payment.razorpayPaymentId = rzpPaymentId;
            payment.paymentMethod = paymentMethod;
            payment.failureReason = paymentEntity.error_description || 'Payment failed';
            await payment.save();

            await Order.updateOne(
              { _id: payment.parentOrderId },
              { $set: { paymentStatus: 'failed' } }
            );
            logger.warn(`Webhook reconciled payment.failed for order ${payment.parentOrderId}`);
          }
        }
      }
    }

    return { processed: true, event: eventType, isDuplicate: false };
  }

  /**
   * Retrieves payment details by order ID
   */
  static async getPaymentByOrderId(customerId: string, orderId: string): Promise<IPayment | null> {
    const payment = await Payment.findOne({
      parentOrderId: new Types.ObjectId(orderId),
      customerId: new Types.ObjectId(customerId),
    }).sort({ createdAt: -1 });

    return payment;
  }

  /**
   * Admin: List all payments with filtering
   */
  static async getAdminPayments(filters: {
    status?: string;
    customerId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ payments: IPayment[]; total: number; page: number; totalPages: number }> {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {};
    if (filters.status) query.status = filters.status;
    if (filters.customerId && Types.ObjectId.isValid(filters.customerId)) {
      query.customerId = new Types.ObjectId(filters.customerId);
    }

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate('parentOrderId', 'orderNumber totalAmount paymentStatus')
        .populate('customerId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Payment.countDocuments(query),
    ]);

    return {
      payments,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}
