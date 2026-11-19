import crypto from 'crypto';
import QRCode from 'qrcode';
import { Types } from 'mongoose';
import { Payment, IPayment, PaymentDocument } from '../models/payment.model';
import { Order, IOrder } from '../models/order.model';
import { ProcessedWebhookEvent } from '../models/webhookEvent.model';
import { razorpayClient } from '../config/razorpay.config';
import { env } from '../config/env.config';
import { AppError } from '../utils/apiError';
import { VerifyPaymentInput } from '../validators/payment.validator';
import { logger } from '../utils/logger';
import { CommissionService } from './commission.service';
import { InvoiceService } from './invoice.service';

export interface RazorpayOrderCheckoutData {
  keyId: string;
  razorpayOrderId: string;
  amount: number; // in paise
  currency: string;
  orderId: string;
  orderNumber: string;
  paymentMethod?: string;
  customer: {
    name: string;
    phone: string;
  };
}

export interface UpiQrResponseData {
  qrId: string;
  qrImageUrl: string;
  qrString: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  amountPaise: number;
  currency: string;
  expiresAt: Date;
  status: 'waiting' | 'paid' | 'failed' | 'expired';
  isTestMode: boolean;
  merchantVpa: string;
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
  static async createPaymentOrder(customerId: string, orderId: string, preferredMethod?: string): Promise<RazorpayOrderCheckoutData> {
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
            preferredMethod: preferredMethod || order.paymentMethod || 'card',
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

    const effectivePaymentMethod = preferredMethod || order.paymentMethod || 'card';

    // Update order paymentMethod if changed
    if (preferredMethod && order.paymentMethod !== preferredMethod) {
      order.paymentMethod = preferredMethod;
      await order.save();
    }

    // Create payment record
    await Payment.create({
      customerId: new Types.ObjectId(customerId),
      parentOrderId: order._id,
      razorpayOrderId: rzpOrderId,
      amount: order.totalAmount,
      currency,
      paymentMethod: effectivePaymentMethod,
      status: 'pending',
    });

    return {
      keyId: env.RAZORPAY_KEY_ID,
      razorpayOrderId: rzpOrderId,
      amount: amountPaise,
      currency,
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      paymentMethod: effectivePaymentMethod,
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
      if (!isValidSignature && (process.env.NODE_ENV === 'test' || env.RAZORPAY_KEY_ID.includes('placeholder'))) {
        if (input.razorpay_signature.startsWith('sim_sig_') || input.razorpay_signature.startsWith('test_sig_')) {
          isValidSignature = true;
        }
      }
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
    if (input.paymentMethod) {
      payment.paymentMethod = input.paymentMethod;
      order.paymentMethod = input.paymentMethod;
    }
    payment.verifiedAt = new Date();
    await payment.save();

    // Mark parent order as paid (Do not alter vendor order status to shipped/delivered)
    order.paymentStatus = 'paid';
    await order.save();

    // Trigger Phase 8B: Platform Commission Calculation & Vendor Earnings recording
    try {
      await CommissionService.calculateAndRecordCommission(order._id);
    } catch (commErr: any) {
      logger.error(`Commission recording failed for order ${order.orderNumber}: ${commErr.message}`);
    }

    // Trigger Phase 10A: Automatic Invoice Generation
    try {
      await InvoiceService.generateInvoiceForOrder(order._id, { type: 'customer_parent' });
    } catch (invErr: any) {
      logger.error(`Automatic invoice generation failed for order ${order.orderNumber}: ${invErr.message}`);
    }

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
    const qrEntity = eventPayload?.payload?.qr_code?.entity;

    if (eventType === 'qr_code.credited' || (qrEntity && eventType === 'payment.captured')) {
      const qrId = qrEntity?.id || paymentEntity?.notes?.qrId;
      const rzpPaymentId = paymentEntity?.id || `pay_qr_${Date.now()}`;

      const payment = await Payment.findOne({
        $or: [
          ...(qrId ? [{ razorpayQrId: qrId }, { razorpayOrderId: qrId }] : []),
          ...(paymentEntity?.notes?.orderId && Types.ObjectId.isValid(paymentEntity.notes.orderId)
            ? [{ parentOrderId: new Types.ObjectId(paymentEntity.notes.orderId) }]
            : []),
        ],
      });

      if (payment && payment.status !== 'captured') {
        payment.status = 'captured';
        payment.razorpayPaymentId = rzpPaymentId;
        payment.paymentMethod = 'upi_qr';
        payment.verifiedAt = new Date();
        await payment.save();

        await Order.updateOne(
          { _id: payment.parentOrderId },
          { $set: { paymentStatus: 'paid', paymentMethod: 'upi_qr' } }
        );
        logger.info(`Webhook reconciled qr_code.credited for order ${payment.parentOrderId}`);

        try {
          await CommissionService.calculateAndRecordCommission(payment.parentOrderId);
        } catch (commErr: any) {
          logger.error(`Commission recording failed for order ${payment.parentOrderId}: ${commErr.message}`);
        }

        try {
          await InvoiceService.generateInvoiceForOrder(payment.parentOrderId, { type: 'customer_parent' });
        } catch (invErr: any) {
          logger.error(`Automatic invoice generation failed for order ${payment.parentOrderId}: ${invErr.message}`);
        }
      }
    } else if (paymentEntity) {
      const rzpOrderId = paymentEntity.order_id;
      const rzpPaymentId = paymentEntity.id;
      const paymentMethod = paymentEntity.method || 'unknown';

      if (rzpOrderId) {
        const payment = await Payment.findOne({
          $or: [{ razorpayOrderId: rzpOrderId }, { razorpayQrId: rzpOrderId }],
        });
        if (payment) {
          if (eventType === 'payment.captured' || eventType === 'order.paid') {
            payment.status = 'captured';
            payment.razorpayPaymentId = rzpPaymentId;
            payment.paymentMethod = paymentMethod;
            payment.verifiedAt = new Date();
            await payment.save();

            await Order.updateOne(
              { _id: payment.parentOrderId },
              { $set: { paymentStatus: 'paid', paymentMethod: paymentMethod } }
            );
            logger.info(`Webhook reconciled payment.captured for order ${payment.parentOrderId}`);

            // Trigger Phase 8B: Platform Commission Calculation & Vendor Earnings recording
            try {
              await CommissionService.calculateAndRecordCommission(payment.parentOrderId);
            } catch (commErr: any) {
              logger.error(`Commission recording failed for order ${payment.parentOrderId}: ${commErr.message}`);
            }

            // Trigger Phase 10A: Automatic Invoice Generation
            try {
              await InvoiceService.generateInvoiceForOrder(payment.parentOrderId, { type: 'customer_parent' });
            } catch (invErr: any) {
              logger.error(`Automatic invoice generation failed for order ${payment.parentOrderId}: ${invErr.message}`);
            }
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

  /**
   * UPI QR-Code Flow:
   * Generates a genuine dynamic UPI QR code linked to order data.
   * If real Razorpay credentials & permissions exist, creates a Razorpay QR;
   * otherwise generates a genuine dynamic NPCI-compliant UPI URI Data URL.
   */
  static async createUpiQrPayment(customerId: string, orderId: string): Promise<UpiQrResponseData> {
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

    const amountPaise = Math.round(order.totalAmount * 100);
    if (amountPaise <= 0) {
      throw AppError.badRequest('Invalid order total amount for payment initiation');
    }

    const now = new Date();
    const payeeVpa = env.MERCHANT_UPI_VPA || 'tejasprajapati2504@oksbi';
    const payeeName = env.MERCHANT_NAME || 'NexusMarket';

    // Check if an active unexpired QR session already exists for this order
    const existingPayment = await Payment.findOne({
      parentOrderId: order._id,
      paymentMethod: 'upi_qr',
      status: 'pending',
      qrExpiresAt: { $gt: now },
    });

    if (existingPayment && existingPayment.qrImageUrl && existingPayment.qrExpiresAt) {
      return {
        qrId: existingPayment.razorpayQrId || existingPayment.razorpayOrderId,
        qrImageUrl: existingPayment.qrImageUrl,
        qrString: existingPayment.qrString || '',
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        amount: order.totalAmount,
        amountPaise,
        currency: 'INR',
        expiresAt: existingPayment.qrExpiresAt,
        status: 'waiting',
        isTestMode: env.RAZORPAY_KEY_ID.includes('placeholder'),
        merchantVpa: payeeVpa,
        customer: {
          name: order.deliveryAddress.fullName,
          phone: order.deliveryAddress.phone,
        },
      };
    }

    // Mark any prior pending QR sessions as expired
    await Payment.updateMany(
      {
        parentOrderId: order._id,
        paymentMethod: 'upi_qr',
        status: 'pending',
      },
      {
        $set: { status: 'expired', failureReason: 'Superseded by new QR code generation' },
      }
    );

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15-minute validity window
    let razorpayQrId = '';
    let qrImageUrl = '';
    let isRealGateway = false;

    // Standard NPCI dynamic UPI URI specification
    const transactionNote = encodeURIComponent(`Order ${order.orderNumber}`);
    const transactionRef = `NXM${order.orderNumber.replace(/[^a-zA-Z0-9]/g, '').slice(-10)}${Date.now().toString().slice(-4)}`;
    const genuineUpiUri = `upi://pay?pa=${payeeVpa}&pn=${encodeURIComponent(payeeName)}&am=${order.totalAmount.toFixed(2)}&cu=INR&tn=${transactionNote}&tr=${transactionRef}`;

    // If configured with real Razorpay credentials, try official Razorpay QR API
    if (process.env.NODE_ENV !== 'test' && !env.RAZORPAY_KEY_ID.includes('placeholder')) {
      try {
        const rzpQrResponse: any = await razorpayClient.qrCode.create({
          type: 'upi_qr',
          name: `NexusMarket Order #${order.orderNumber}`,
          usage: 'single_use',
          fixed_amount: true,
          payment_amount: amountPaise,
          description: `Payment for Order #${order.orderNumber}`,
          close_by: Math.floor(expiresAt.getTime() / 1000),
          notes: {
            orderId: order._id.toString(),
            orderNumber: order.orderNumber,
            customerId,
          },
        });
        razorpayQrId = rzpQrResponse.id;
        qrImageUrl = rzpQrResponse.image_url;
        isRealGateway = true;
      } catch (error: any) {
        logger.warn(
          `Razorpay QR Code API unavailable or not enabled on account (${error?.message || error}). Generating genuine NPCI-compliant UPI QR code.`
        );
      }
    }

    if (!isRealGateway || !qrImageUrl) {
      // Generate genuine dynamic NPCI UPI QR code Data URL
      razorpayQrId = `qr_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      qrImageUrl = await QRCode.toDataURL(genuineUpiUri, {
        width: 340,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      });
    }

    // Update order paymentMethod
    order.paymentMethod = 'upi_qr';
    await order.save();

    // Create Payment record
    await Payment.create({
      customerId: new Types.ObjectId(customerId),
      parentOrderId: order._id,
      razorpayOrderId: razorpayQrId,
      razorpayQrId,
      amount: order.totalAmount,
      currency: 'INR',
      paymentMethod: 'upi_qr',
      status: 'pending',
      qrImageUrl,
      qrString: genuineUpiUri,
      qrExpiresAt: expiresAt,
      notes: {
        orderNumber: order.orderNumber,
        merchantVpa: payeeVpa,
      },
    });

    return {
      qrId: razorpayQrId,
      qrImageUrl,
      qrString: genuineUpiUri,
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      amount: order.totalAmount,
      amountPaise,
      currency: 'INR',
      expiresAt,
      status: 'waiting',
      isTestMode: !isRealGateway,
      merchantVpa: payeeVpa,
      customer: {
        name: order.deliveryAddress.fullName,
        phone: order.deliveryAddress.phone,
      },
    };
  }

  /**
   * UPI QR-Code Flow: Check Status
   * Polls payment verification status and reconciles order.
   */
  static async getUpiQrStatus(
    customerId: string,
    orderId: string
  ): Promise<{
    status: 'waiting' | 'paid' | 'failed' | 'expired';
    orderNumber: string;
    paymentId?: string;
    failureReason?: string;
    expiresAt?: Date;
  }> {
    const order = await Order.findById(orderId);
    if (!order) {
      throw AppError.notFound('Order not found');
    }

    if (order.userId.toString() !== customerId) {
      throw AppError.forbidden('Access forbidden: You do not have permission to check this payment');
    }

    if (order.paymentStatus === 'paid') {
      const capturedPayment = await Payment.findOne({
        parentOrderId: order._id,
        status: 'captured',
      }).sort({ updatedAt: -1 });

      return {
        status: 'paid',
        orderNumber: order.orderNumber,
        paymentId: capturedPayment?.razorpayPaymentId,
      };
    }

    const payment = await Payment.findOne({
      parentOrderId: order._id,
      paymentMethod: 'upi_qr',
    }).sort({ createdAt: -1 });

    if (!payment) {
      return {
        status: 'waiting',
        orderNumber: order.orderNumber,
      };
    }

    if (payment.status === 'captured') {
      return {
        status: 'paid',
        orderNumber: order.orderNumber,
        paymentId: payment.razorpayPaymentId,
      };
    }

    if (payment.status === 'failed') {
      return {
        status: 'failed',
        orderNumber: order.orderNumber,
        failureReason: payment.failureReason || 'Payment failed or declined',
      };
    }

    if (payment.status === 'expired' || (payment.qrExpiresAt && new Date() > payment.qrExpiresAt)) {
      if (payment.status !== 'expired') {
        payment.status = 'expired';
        payment.failureReason = 'Payment session expired';
        await payment.save();
      }
      return {
        status: 'expired',
        orderNumber: order.orderNumber,
        failureReason: 'UPI QR code has expired. Please generate a new QR to complete your payment.',
      };
    }

    // If real gateway is active and not test placeholder, check Razorpay QR payments
    if (
      process.env.NODE_ENV !== 'test' &&
      !env.RAZORPAY_KEY_ID.includes('placeholder') &&
      payment.razorpayQrId &&
      !payment.razorpayQrId.startsWith('qr_test_')
    ) {
      try {
        const qrPayments: any = await razorpayClient.qrCode.fetchAllPayments(payment.razorpayQrId);
        if (qrPayments && qrPayments.items && qrPayments.items.length > 0) {
          const successPayment = qrPayments.items.find((p: any) => p.status === 'captured');
          if (successPayment) {
            payment.status = 'captured';
            payment.razorpayPaymentId = successPayment.id;
            payment.verifiedAt = new Date();
            await payment.save();

            order.paymentStatus = 'paid';
            await order.save();

            try {
              await CommissionService.calculateAndRecordCommission(order._id);
            } catch (err: any) {
              logger.error(`Commission recording failed for order ${order.orderNumber}: ${err.message}`);
            }

            try {
              await InvoiceService.generateInvoiceForOrder(order._id, { type: 'customer_parent' });
            } catch (err: any) {
              logger.error(`Invoice generation failed for order ${order.orderNumber}: ${err.message}`);
            }

            return {
              status: 'paid',
              orderNumber: order.orderNumber,
              paymentId: successPayment.id,
            };
          }
        }
      } catch (err: any) {
        logger.error(`Failed to poll Razorpay for QR payments: ${err.message}`);
      }
    }

    return {
      status: 'waiting',
      orderNumber: order.orderNumber,
      expiresAt: payment.qrExpiresAt,
    };
  }

  /**
   * UPI QR-Code Flow: Cancel QR Session
   */
  static async cancelUpiQrPayment(
    customerId: string,
    orderId: string
  ): Promise<{ success: boolean; message: string }> {
    const order = await Order.findById(orderId);
    if (!order) {
      throw AppError.notFound('Order not found');
    }

    if (order.userId.toString() !== customerId) {
      throw AppError.forbidden('Access forbidden: You do not have permission to modify this order');
    }

    const payment = await Payment.findOne({
      parentOrderId: order._id,
      paymentMethod: 'upi_qr',
      status: 'pending',
    }).sort({ createdAt: -1 });

    if (payment) {
      payment.status = 'failed';
      payment.failureReason = 'Cancelled by customer';
      await payment.save();
    }

    return {
      success: true,
      message: 'QR payment session cancelled successfully',
    };
  }

  /**
   * UPI QR-Code Flow: Sandbox / Test Simulator Action
   * Allows developers and testers to simulate scan & pay success, bank decline, or expiry.
   */
  static async simulateUpiQrPayment(
    customerId: string,
    orderId: string,
    outcome: 'success' | 'failed' | 'expired'
  ): Promise<{ status: string; order?: IOrder; payment?: PaymentDocument; message?: string }> {
    const isTestEnv = process.env.NODE_ENV === 'test' || env.RAZORPAY_KEY_ID.includes('placeholder');
    if (!isTestEnv) {
      throw AppError.forbidden('Payment simulation is only permitted in development and test environments');
    }

    const order = await Order.findById(orderId);
    if (!order) {
      throw AppError.notFound('Order not found');
    }

    if (order.userId.toString() !== customerId) {
      throw AppError.forbidden('Access forbidden: You do not have permission to simulate this payment');
    }

    if (order.paymentStatus === 'paid') {
      return { status: 'paid', order };
    }

    const payment = await Payment.findOne({
      parentOrderId: order._id,
      paymentMethod: 'upi_qr',
      status: 'pending',
    }).sort({ createdAt: -1 });

    if (!payment) {
      throw AppError.badRequest('No active pending UPI QR payment session found to simulate');
    }

    if (outcome === 'failed') {
      payment.status = 'failed';
      payment.failureReason = 'Simulated UPI transaction decline / bank server error';
      await payment.save();
      return { status: 'failed', payment, message: 'Simulated payment failure recorded' };
    }

    if (outcome === 'expired') {
      payment.status = 'expired';
      payment.failureReason = 'Simulated QR expiration';
      payment.qrExpiresAt = new Date(Date.now() - 1000);
      await payment.save();
      return { status: 'expired', payment, message: 'Simulated QR expiry recorded' };
    }

    // Success outcome
    const simPaymentId = `pay_sim_qr_${Date.now()}`;
    const simSignature = `sim_sig_qr_${Date.now()}`;

    payment.status = 'captured';
    payment.razorpayPaymentId = simPaymentId;
    payment.razorpaySignature = simSignature;
    payment.verifiedAt = new Date();
    await payment.save();

    order.paymentStatus = 'paid';
    await order.save();

    try {
      await CommissionService.calculateAndRecordCommission(order._id);
    } catch (commErr: any) {
      logger.error(`Commission recording failed for order ${order.orderNumber}: ${commErr.message}`);
    }

    try {
      await InvoiceService.generateInvoiceForOrder(order._id, { type: 'customer_parent' });
    } catch (invErr: any) {
      logger.error(`Invoice generation failed for order ${order.orderNumber}: ${invErr.message}`);
    }

    return { status: 'paid', order, payment, message: 'Simulated payment verified and order marked paid' };
  }
}
