import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import { InvoiceService } from '../services/invoice.service';
import { ApiResponse } from '../utils/apiResponse';
import { AppError } from '../utils/apiError';
import {
  listInvoicesQuerySchema,
  invoiceIdParamSchema,
  orderInvoiceQuerySchema,
} from '../validators/invoice.validator';

export class InvoiceController {
  /**
   * GET /api/invoices
   * List invoices based on user role and query parameters.
   */
  static async listInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedQuery = listInvoicesQuerySchema.parse(req.query);
      const userId = req.user!.id;
      const role = req.user!.role;

      const result = await InvoiceService.getInvoices(parsedQuery, userId, role);
      ApiResponse.success(res, result, 'Invoices fetched successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/invoices/:invoiceId
   * Retrieve invoice metadata by ID.
   */
  static async getInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { invoiceId } = invoiceIdParamSchema.parse(req.params);
      const userId = req.user!.id;
      const role = req.user!.role;

      const invoice = await InvoiceService.getInvoiceById(invoiceId, userId, role);
      ApiResponse.success(res, invoice, 'Invoice details fetched successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/invoices/:invoiceId/download
   * Securely stream/download the PDF invoice file.
   */
  static async downloadInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { invoiceId } = invoiceIdParamSchema.parse(req.params);
      const userId = req.user!.id;
      const role = req.user!.role;

      const { filePath, fileName } = await InvoiceService.getInvoicePdfForDownload(invoiceId, userId, role);

      if (!fs.existsSync(filePath)) {
        throw AppError.notFound('Invoice PDF file not found on disk');
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      const fileStream = fs.createReadStream(filePath);
      fileStream.on('error', (err) => {
        next(err);
      });
      fileStream.pipe(res);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/orders/:orderId/invoice
   * Retrieve or on-demand generate the invoice for an order.
   */
  static async getOrderInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orderId } = req.params;
      if (!orderId || !/^[0-9a-fA-F]{24}$/.test(orderId)) {
        throw AppError.badRequest('Invalid order ID format');
      }

      const parsedQuery = orderInvoiceQuerySchema.parse(req.query);
      const userId = req.user!.id;
      const role = req.user!.role;

      const invoice = await InvoiceService.getInvoiceForOrder(orderId, userId, role, {
        type: parsedQuery.type,
        vendorOrderId: parsedQuery.vendorOrderId,
      });

      ApiResponse.success(res, invoice, 'Order invoice retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }
}

