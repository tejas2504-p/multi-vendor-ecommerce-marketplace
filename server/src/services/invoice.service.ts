import fs from 'fs';
import { Types } from 'mongoose';
import { Invoice, IInvoice, InvoiceDocument, InvoiceType } from '../models/invoice.model';
import { Order } from '../models/order.model';
import { VendorOrder } from '../models/vendorOrder.model';
import { User } from '../models/user.model';
import { VendorProfile } from '../models/vendorProfile.model';
import { PdfGeneratorService } from './pdfGenerator.service';
import { AppError } from '../utils/apiError';
import { logger } from '../utils/logger';

export interface GenerateInvoiceOptions {
  type?: InvoiceType;
  vendorOrderId?: string | Types.ObjectId;
}

export interface InvoiceListQuery {
  page?: number;
  limit?: number;
  orderId?: string;
  invoiceType?: InvoiceType;
}

export class InvoiceService {
  /**
   * Generates a unique, non-colliding invoice number in monotonic format:
   * e.g. INV-2026-M8K2X-9142
   */
  static generateInvoiceNumber(): string {
    const year = new Date().getFullYear();
    const timestampPart = Date.now().toString(36).toUpperCase();
    const randomPart = Math.floor(1000 + Math.random() * 9000).toString(36).toUpperCase();
    return `INV-${year}-${timestampPart}-${randomPart}`;
  }

  /**
   * Generates or retrieves an existing invoice for an order.
   * Guarantees idempotency: existing invoice numbers are NEVER regenerated.
   */
  static async generateInvoiceForOrder(
    parentOrderId: string | Types.ObjectId,
    options: GenerateInvoiceOptions = {}
  ): Promise<InvoiceDocument> {
    const type: InvoiceType = options.type || 'customer_parent';
    const parentOrderObjectId = new Types.ObjectId(parentOrderId);

    const order = await Order.findById(parentOrderObjectId);
    if (!order) {
      throw AppError.notFound('Order not found for invoice generation');
    }

    // 1. Idempotency Check: Query for existing invoice
    const query: any = {
      parentOrderId: order._id,
      invoiceType: type,
    };
    if (type === 'vendor_order' && options.vendorOrderId) {
      query.vendorOrderId = new Types.ObjectId(options.vendorOrderId);
    }

    const existingInvoice = await Invoice.findOne(query);
    if (existingInvoice) {
      // Check if physical PDF file exists; if missing, regenerate file with identical metadata
      if (!fs.existsSync(existingInvoice.pdfStorageKey)) {
        logger.warn(`Invoice PDF missing on disk for ${existingInvoice.invoiceNumber}. Regenerating...`);
        const newPath = await PdfGeneratorService.generateInvoicePdf(existingInvoice);
        existingInvoice.pdfStorageKey = newPath;
        await existingInvoice.save();
      }
      return existingInvoice;
    }

    // 2. Fetch Customer Details
    const customer = await User.findById(order.userId || order.customerId);
    const customerDetails = {
      name: customer?.name || order.deliveryAddress.fullName || 'Valued Customer',
      email: customer?.email || 'customer@nexusmarket.com',
      phone: order.deliveryAddress.phone || '',
    };

    let invoiceDoc: InvoiceDocument;

    if (type === 'customer_parent') {
      // -----------------------------------------------------------------
      // Customer Parent Marketplace Invoice (Facilitator Model)
      // -----------------------------------------------------------------
      const issuerDetails = {
        name: 'NexusMarket Platform Ltd',
        address: '123 Tech Square, Digital Park, Bangalore, KA, India - 560001',
        taxId: '29ABCDE1234F1Z5',
        email: 'invoicing@nexusmarket.com',
        phone: '+91 80 1234 5678',
      };

      const invoiceItems = order.items.map((item) => ({
        productId: item.productId,
        vendorId: item.vendorId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        itemSubtotal: item.itemSubtotal,
        taxRate: 0,
        taxAmount: 0,
        discountAmount: 0,
      }));

      const subtotal = order.subtotal;
      const discountAmount = order.discountAmount || 0;
      const shippingAmount = order.shippingAmount || 0;
      const totalAmount = order.totalAmount;

      const taxBreakdown = {
        totalTax: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        rate: 0,
        notes: 'Prices are inclusive of standard applicable GST / Platform terms',
      };

      const invoiceNumber = this.generateInvoiceNumber();
      const storageDir = PdfGeneratorService.getInvoiceStorageDir();
      const tempPdfKey = `${storageDir}/${invoiceNumber}.pdf`;

      invoiceDoc = new Invoice({
        invoiceNumber,
        parentOrderId: order._id,
        customerId: order.userId || order.customerId,
        invoiceType: 'customer_parent',
        issuerDetails,
        customerDetails,
        billingAddress: order.deliveryAddress,
        shippingAddress: order.deliveryAddress,
        items: invoiceItems,
        subtotal,
        discountAmount,
        shippingAmount,
        taxBreakdown,
        totalAmount,
        currency: 'INR',
        paymentStatus: order.paymentStatus || 'paid',
        invoiceDate: new Date(),
        pdfStorageKey: tempPdfKey,
      });
    } else {
      // -----------------------------------------------------------------
      // Vendor Sub-Order Invoice (Merchant Model)
      // -----------------------------------------------------------------
      if (!options.vendorOrderId) {
        throw AppError.badRequest('Vendor order ID is required to generate a vendor invoice');
      }

      const vendorOrder = await VendorOrder.findById(options.vendorOrderId);
      if (!vendorOrder) {
        throw AppError.notFound('Vendor order record not found');
      }

      const vendorProfile = await VendorProfile.findOne({ userId: vendorOrder.vendorId });
      const vendorUser = await User.findById(vendorOrder.vendorId);

      const addressStr = vendorProfile?.businessAddress
        ? `${vendorProfile.businessAddress.street}, ${vendorProfile.businessAddress.city}, ${vendorProfile.businessAddress.state} - ${vendorProfile.businessAddress.postalCode}, ${vendorProfile.businessAddress.country || 'India'}`
        : 'Registered Marketplace Merchant Facility';

      const issuerDetails = {
        name:
          vendorProfile?.storeName ||
          vendorUser?.name ||
          'Authorized Marketplace Vendor',
        address: addressStr,
        taxId: (vendorProfile as any)?.taxId || (vendorProfile as any)?.gstin || 'N/A',
        email: vendorProfile?.businessEmail || vendorUser?.email || 'vendor@nexusmarket.com',
        phone: vendorProfile?.businessPhone || 'N/A',
      };

      const invoiceItems = vendorOrder.items.map((item) => ({
        productId: item.productId,
        vendorId: vendorOrder.vendorId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        itemSubtotal: item.itemSubtotal,
        taxRate: 0,
        taxAmount: 0,
        discountAmount: 0,
      }));

      const subtotal = vendorOrder.vendorSubtotal;
      const discountAmount = vendorOrder.discountShare || vendorOrder.discountAmount || 0;
      const shippingAmount = vendorOrder.shippingShare || 0;
      const totalAmount = Math.max(0, Math.round((subtotal + shippingAmount - discountAmount) * 100) / 100);

      const taxBreakdown = {
        totalTax: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        rate: 0,
        notes: 'Vendor item tax included',
      };

      const invoiceNumber = this.generateInvoiceNumber();
      const storageDir = PdfGeneratorService.getInvoiceStorageDir();
      const tempPdfKey = `${storageDir}/${invoiceNumber}.pdf`;

      invoiceDoc = new Invoice({
        invoiceNumber,
        parentOrderId: order._id,
        vendorOrderId: vendorOrder._id,
        customerId: order.userId || order.customerId,
        vendorId: vendorOrder.vendorId,
        invoiceType: 'vendor_order',
        issuerDetails,
        customerDetails,
        billingAddress: order.deliveryAddress,
        shippingAddress: order.deliveryAddress,
        items: invoiceItems,
        subtotal,
        discountAmount,
        shippingAmount,
        taxBreakdown,
        totalAmount,
        currency: 'INR',
        paymentStatus: order.paymentStatus || 'paid',
        invoiceDate: new Date(),
        pdfStorageKey: tempPdfKey,
      });
    }

    // Generate physical PDF document
    const generatedPath = await PdfGeneratorService.generateInvoicePdf(invoiceDoc);
    invoiceDoc.pdfStorageKey = generatedPath;

    await invoiceDoc.save();
    logger.info(`Invoice created and saved to DB: ${invoiceDoc.invoiceNumber} (${invoiceDoc.invoiceType})`);

    return invoiceDoc;
  }

  /**
   * Retrieves an invoice by its ID with strict RBAC:
   * - Admin: full access
   * - Customer: must own the order / invoice
   * - Vendor: must own the vendor sub-order invoice
   */
  static async getInvoiceById(invoiceId: string, userId: string, role: string): Promise<InvoiceDocument> {
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      throw AppError.notFound('Invoice not found');
    }

    if (role === 'admin') {
      return invoice;
    }

    if (role === 'customer') {
      if (invoice.customerId.toString() !== userId) {
        throw AppError.forbidden('Access denied: You do not have permission to view this invoice');
      }
      return invoice;
    }

    if (role === 'vendor') {
      if (!invoice.vendorId || invoice.vendorId.toString() !== userId) {
        throw AppError.forbidden('Access denied: You do not have permission to view this vendor invoice');
      }
      return invoice;
    }

    throw AppError.forbidden('Access denied: Unauthorized role');
  }

  /**
   * Lists invoices with pagination and filters according to user role.
   */
  static async getInvoices(
    query: InvoiceListQuery,
    userId: string,
    role: string
  ): Promise<{ invoices: InvoiceDocument[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (role === 'customer') {
      filter.customerId = new Types.ObjectId(userId);
    } else if (role === 'vendor') {
      filter.vendorId = new Types.ObjectId(userId);
      filter.invoiceType = 'vendor_order';
    } else if (role === 'admin') {
      if (query.orderId) {
        filter.parentOrderId = new Types.ObjectId(query.orderId);
      }
      if (query.invoiceType) {
        filter.invoiceType = query.invoiceType;
      }
    } else {
      throw AppError.forbidden('Access denied: Unauthorized role');
    }

    const [invoices, total] = await Promise.all([
      Invoice.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Invoice.countDocuments(filter),
    ]);

    return {
      invoices,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieves or automatically generates customer invoice for a specific order.
   */
  static async getInvoiceForOrder(
    orderId: string,
    userId: string,
    role: string,
    options: GenerateInvoiceOptions = {}
  ): Promise<InvoiceDocument> {
    const order = await Order.findById(orderId);
    if (!order) {
      throw AppError.notFound('Order not found');
    }

    // Role check
    if (role === 'customer' && order.userId.toString() !== userId && order.customerId?.toString() !== userId) {
      throw AppError.forbidden('Access denied: You do not own this order');
    }

    if (role === 'vendor') {
      options.type = 'vendor_order';
      if (!options.vendorOrderId) {
        // Try to locate vendor's vendorOrder in this parent order
        const vendorOrder = await VendorOrder.findOne({
          parentOrderId: order._id,
          vendorId: new Types.ObjectId(userId),
        });
        if (!vendorOrder) {
          throw AppError.forbidden('Access denied: You have no vendor sub-order in this order');
        }
        options.vendorOrderId = vendorOrder._id;
      }
    }

    return await this.generateInvoiceForOrder(order._id, options);
  }

  /**
   * Retrieves the physical PDF file path for downloading.
   * Enforces security and regenerates file if missing.
   */
  static async getInvoicePdfForDownload(
    invoiceId: string,
    userId: string,
    role: string
  ): Promise<{ filePath: string; invoiceNumber: string; fileName: string }> {
    const invoice = await this.getInvoiceById(invoiceId, userId, role);

    if (!fs.existsSync(invoice.pdfStorageKey)) {
      logger.warn(`Invoice PDF missing on disk for download ${invoice.invoiceNumber}. Regenerating...`);
      const newPath = await PdfGeneratorService.generateInvoicePdf(invoice);
      invoice.pdfStorageKey = newPath;
      await invoice.save();
    }

    return {
      filePath: invoice.pdfStorageKey,
      invoiceNumber: invoice.invoiceNumber,
      fileName: `Invoice-${invoice.invoiceNumber}.pdf`,
    };
  }
}
