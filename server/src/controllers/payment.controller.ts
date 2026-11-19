import { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../services/payment.service';
import { ApiResponse } from '../utils/apiResponse';

export class PaymentController {
  /**
   * POST /api/payments/create-order
   */
  static async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = req.user!.id;
      const { orderId, paymentMethod } = req.body;

      const data = await PaymentService.createPaymentOrder(customerId, orderId, paymentMethod);
      ApiResponse.success(res, data, 'Razorpay order created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/payments/verify
   */
  static async verifyPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = req.user!.id;
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, paymentMethod } = req.body;

      const result = await PaymentService.verifyPayment(customerId, {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        paymentMethod,
      });

      ApiResponse.success(
        res,
        result,
        result.isDuplicate ? 'Payment was already verified and captured' : 'Payment verified and captured successfully',
        200
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/payments/webhook
   */
  static async handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);
      const signature = (req.headers['x-razorpay-signature'] as string) || '';

      const result = await PaymentService.processWebhook(rawBody, signature, req.body);
      ApiResponse.success(res, result, 'Razorpay webhook processed successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/payments/order/:orderId
   */
  static async getPaymentByOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = req.user!.id;
      const { orderId } = req.params;

      const payment = await PaymentService.getPaymentByOrderId(customerId, orderId);
      ApiResponse.success(res, payment, 'Payment details retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/payments/admin
   */
  static async getAdminPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await PaymentService.getAdminPayments(req.query as any);
      ApiResponse.success(
        res,
        result.payments,
        'Admin payments list retrieved successfully',
        200,
        {
          page: result.page,
          limit: Math.max(1, Math.min(100, Number(req.query.limit) || 20)),
          total: result.total,
          totalPages: result.totalPages,
        }
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/payments/create-qr-code
   */
  static async createQrCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = req.user!.id;
      const { orderId } = req.body;

      const data = await PaymentService.createUpiQrPayment(customerId, orderId);
      ApiResponse.success(res, data, 'UPI QR Code generated successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/payments/qr-status/:orderId
   */
  static async getQrStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = req.user!.id;
      const { orderId } = req.params;

      const result = await PaymentService.getUpiQrStatus(customerId, orderId);
      ApiResponse.success(res, result, 'UPI QR status retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/payments/cancel-qr
   */
  static async cancelQrCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = req.user!.id;
      const { orderId } = req.body;

      const result = await PaymentService.cancelUpiQrPayment(customerId, orderId);
      ApiResponse.success(res, result, 'UPI QR payment session cancelled successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/payments/simulate-qr
   */
  static async simulateQrPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = req.user!.id;
      const { orderId, outcome } = req.body;

      const result = await PaymentService.simulateUpiQrPayment(customerId, orderId, outcome);
      ApiResponse.success(res, result, 'UPI QR payment simulation executed successfully', 200);
    } catch (error) {
      next(error);
    }
  }
}
