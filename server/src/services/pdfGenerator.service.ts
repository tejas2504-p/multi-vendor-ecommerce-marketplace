import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { IInvoice } from '../models/invoice.model';
import { logger } from '../utils/logger';

export class PdfGeneratorService {
  /**
   * Resolves the absolute directory path where invoices are securely stored.
   */
  static getInvoiceStorageDir(): string {
    const cwd = process.cwd();
    const baseDir = cwd.endsWith('server') ? cwd : path.join(cwd, 'server');
    const storageDir = path.join(baseDir, 'uploads', 'invoices');
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    return storageDir;
  }

  /**
   * Formats numbers to currency string with 2 decimals, e.g. "INR 1,250.00"
   */
  static formatCurrency(amount: number, currency: string = 'INR'): string {
    const num = isNaN(amount) ? 0 : amount;
    return `${currency} ${num.toFixed(2)}`;
  }

  /**
   * Generates a professional, branded PDF invoice file using PDFKit.
   * Returns the absolute path of the generated PDF file.
   */
  static async generateInvoicePdf(invoice: IInvoice): Promise<string> {
    const storageDir = this.getInvoiceStorageDir();
    const fileName = `${invoice.invoiceNumber}.pdf`;
    const filePath = path.join(storageDir, fileName);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
          bufferPages: true,
          info: {
            Title: `Invoice - ${invoice.invoiceNumber}`,
            Author: 'NexusMarket Marketplace',
            Subject: `Invoice for Order #${invoice.parentOrderId}`,
          },
        });

        const writeStream = fs.createWriteStream(filePath);
        doc.pipe(writeStream);

        // Theme colors
        const primaryColor = '#1e293b'; // slate-800
        const accentColor = '#2563eb'; // blue-600
        const textSecondary = '#64748b'; // slate-500
        const borderColor = '#e2e8f0'; // slate-200
        const headerBgColor = '#f8fafc'; // slate-50

        // -------------------------------------------------------------
        // 1. HEADER SECTION
        // -------------------------------------------------------------
        doc
          .rect(0, 0, doc.page.width, 95)
          .fill('#0f172a'); // dark slate banner

        doc
          .fillColor('#ffffff')
          .fontSize(22)
          .font('Helvetica-Bold')
          .text('NexusMarket', 40, 28);

        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor('#94a3b8')
          .text('Multi-Vendor E-Commerce Platform', 40, 54);

        // Invoice Header Title on right
        doc
          .fillColor('#ffffff')
          .fontSize(16)
          .font('Helvetica-Bold')
          .text(
            invoice.invoiceType === 'vendor_order' ? 'VENDOR TAX INVOICE' : 'OFFICIAL TAX INVOICE',
            doc.page.width - 260,
            28,
            { width: 220, align: 'right' }
          );

        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor('#cbd5e1')
          .text(`Invoice #: ${invoice.invoiceNumber}`, doc.page.width - 260, 50, { width: 220, align: 'right' });

        const formattedDate = new Date(invoice.invoiceDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
        doc.text(`Date: ${formattedDate}`, doc.page.width - 260, 64, { width: 220, align: 'right' });

        // -------------------------------------------------------------
        // 2. METADATA CARDS: ISSUER vs BILL TO / SHIP TO
        // -------------------------------------------------------------
        const metaTop = 115;
        const colWidth = (doc.page.width - 100) / 2;

        // Left box: Issuer Details
        doc
          .rect(40, metaTop, colWidth, 110)
          .fillAndStroke(headerBgColor, borderColor);

        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor(accentColor)
          .text('ISSUED BY / SOLD BY', 52, metaTop + 10);

        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor(primaryColor)
          .text(invoice.issuerDetails.name, 52, metaTop + 26);

        doc
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor(textSecondary)
          .text(invoice.issuerDetails.address, 52, metaTop + 40, { width: colWidth - 24 })
          .text(`GSTIN/Tax ID: ${invoice.issuerDetails.taxId || 'N/A'}`, 52, metaTop + 72)
          .text(`Email: ${invoice.issuerDetails.email || 'support@nexusmarket.com'}`, 52, metaTop + 86);

        // Right box: Customer & Delivery Details
        const rightColX = 55 + colWidth;
        doc
          .rect(rightColX, metaTop, colWidth, 110)
          .fillAndStroke(headerBgColor, borderColor);

        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor(accentColor)
          .text('BILLED & SHIPPED TO', rightColX + 12, metaTop + 10);

        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor(primaryColor)
          .text(invoice.shippingAddress.fullName || invoice.customerDetails.name, rightColX + 12, metaTop + 26);

        const addr = `${invoice.shippingAddress.addressLine1}${
          invoice.shippingAddress.addressLine2 ? ', ' + invoice.shippingAddress.addressLine2 : ''
        }, ${invoice.shippingAddress.city}, ${invoice.shippingAddress.state} - ${invoice.shippingAddress.postalCode}, ${invoice.shippingAddress.country}`;

        doc
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor(textSecondary)
          .text(addr, rightColX + 12, metaTop + 40, { width: colWidth - 24 })
          .text(`Phone: ${invoice.shippingAddress.phone || invoice.customerDetails.phone || 'N/A'}`, rightColX + 12, metaTop + 72)
          .text(`Email: ${invoice.customerDetails.email}`, rightColX + 12, metaTop + 86);

        // Order Status & Payment Pill
        const pillTop = metaTop + 125;
        doc
          .fontSize(9)
          .font('Helvetica-Bold')
          .fillColor(primaryColor)
          .text(`Parent Order ID: ${invoice.parentOrderId}`, 40, pillTop)
          .text(
            `Payment Status: ${invoice.paymentStatus.toUpperCase()}`,
            doc.page.width - 240,
            pillTop,
            { width: 200, align: 'right' }
          );

        // -------------------------------------------------------------
        // 3. ITEMS TABLE
        // -------------------------------------------------------------
        let currentY = pillTop + 22;
        const tableX = 40;
        const tableWidth = doc.page.width - 80;

        // Table Header
        doc
          .rect(tableX, currentY, tableWidth, 24)
          .fill('#f1f5f9');

        doc
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .fillColor(primaryColor);

        doc.text('#', tableX + 8, currentY + 7);
        doc.text('Item Description', tableX + 35, currentY + 7);
        doc.text('Qty', tableX + 275, currentY + 7, { width: 40, align: 'center' });
        doc.text('Unit Price', tableX + 325, currentY + 7, { width: 85, align: 'right' });
        doc.text('Amount', tableX + 420, currentY + 7, { width: 95, align: 'right' });

        currentY += 24;

        // Table Rows
        invoice.items.forEach((item, index) => {
          // Check for page break
          if (currentY + 28 > doc.page.height - 140) {
            doc.addPage();
            currentY = 40;
          }

          const isEven = index % 2 === 0;
          if (isEven) {
            doc.rect(tableX, currentY, tableWidth, 24).fill('#ffffff');
          } else {
            doc.rect(tableX, currentY, tableWidth, 24).fill('#fafafa');
          }

          // Subtle bottom border
          doc
            .moveTo(tableX, currentY + 24)
            .lineTo(tableX + tableWidth, currentY + 24)
            .strokeColor('#f1f5f9')
            .stroke();

          doc
            .font('Helvetica')
            .fontSize(8.5)
            .fillColor(primaryColor);

          doc.text((index + 1).toString(), tableX + 8, currentY + 7);
          doc.text(item.productName, tableX + 35, currentY + 7, { width: 235, ellipsis: true });
          doc.text(item.quantity.toString(), tableX + 275, currentY + 7, { width: 40, align: 'center' });
          doc.text(this.formatCurrency(item.unitPrice, invoice.currency), tableX + 325, currentY + 7, {
            width: 85,
            align: 'right',
          });
          doc.text(this.formatCurrency(item.itemSubtotal, invoice.currency), tableX + 420, currentY + 7, {
            width: 95,
            align: 'right',
          });

          currentY += 24;
        });

        // -------------------------------------------------------------
        // 4. FINANCIAL SUMMARY BREAKDOWN
        // -------------------------------------------------------------
        currentY += 15;
        const summaryX = doc.page.width - 260;
        const summaryWidth = 220;

        const summaryRows: Array<{ label: string; value: string; isBold?: boolean; isHighlight?: boolean; isMinus?: boolean }> = [
          { label: 'Subtotal:', value: this.formatCurrency(invoice.subtotal, invoice.currency) },
        ];

        if (invoice.discountAmount > 0) {
          summaryRows.push({
            label: 'Coupon Discount:',
            value: `- ${this.formatCurrency(invoice.discountAmount, invoice.currency)}`,
            isMinus: true,
          });
        }

        summaryRows.push({
          label: 'Shipping & Delivery:',
          value: invoice.shippingAmount > 0 ? this.formatCurrency(invoice.shippingAmount, invoice.currency) : 'FREE',
        });

        if (invoice.taxBreakdown && invoice.taxBreakdown.totalTax > 0) {
          summaryRows.push({
            label: `Taxes (${invoice.taxBreakdown.rate || 0}%):`,
            value: this.formatCurrency(invoice.taxBreakdown.totalTax, invoice.currency),
          });
        } else {
          summaryRows.push({
            label: 'Taxes / GST:',
            value: this.formatCurrency(0, invoice.currency),
          });
        }

        summaryRows.push({
          label: 'Total Paid:',
          value: this.formatCurrency(invoice.totalAmount, invoice.currency),
          isBold: true,
          isHighlight: true,
        });

        summaryRows.forEach((row) => {
          if (row.isHighlight) {
            doc
              .rect(summaryX - 10, currentY - 3, summaryWidth + 10, 22)
              .fill('#e0e7ff'); // light indigo

            doc
              .font('Helvetica-Bold')
              .fontSize(10)
              .fillColor(accentColor)
              .text(row.label, summaryX, currentY + 3, { width: 110, align: 'left' })
              .text(row.value, summaryX + 110, currentY + 3, { width: 100, align: 'right' });

            currentY += 24;
          } else {
            doc
              .font(row.isBold ? 'Helvetica-Bold' : 'Helvetica')
              .fontSize(8.5)
              .fillColor(row.isMinus ? '#dc2626' : textSecondary)
              .text(row.label, summaryX, currentY, { width: 110, align: 'left' })
              .text(row.value, summaryX + 110, currentY, { width: 100, align: 'right' });

            currentY += 16;
          }
        });

        // -------------------------------------------------------------
        // 5. FOOTER & PAGINATION
        // -------------------------------------------------------------
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
          doc.switchToPage(i);

          const footerY = doc.page.height - 45;
          doc
            .moveTo(40, footerY - 5)
            .lineTo(doc.page.width - 40, footerY - 5)
            .strokeColor(borderColor)
            .stroke();

          doc
            .font('Helvetica')
            .fontSize(7.5)
            .fillColor(textSecondary)
            .text(
              'This is a system-generated invoice valid without physical signature. For queries, visit nexusmarket.com/support.',
              40,
              footerY,
              { width: doc.page.width - 80, align: 'left' }
            );

          doc.text(
            `Page ${i + 1} of ${pages.count}`,
            40,
            footerY,
            { width: doc.page.width - 80, align: 'right' }
          );
        }

        doc.end();

        writeStream.on('finish', () => {
          logger.info(`Invoice PDF generated successfully: ${filePath}`);
          resolve(filePath);
        });

        writeStream.on('error', (err) => {
          logger.error(`Error writing PDF file: ${err.message}`);
          reject(err);
        });
      } catch (err) {
        logger.error(`Failed to generate invoice PDF: ${err}`);
        reject(err);
      }
    });
  }
}

