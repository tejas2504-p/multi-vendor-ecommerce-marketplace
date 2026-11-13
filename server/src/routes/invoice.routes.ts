import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { InvoiceController } from '../controllers/invoice.controller';

const router = Router();

// Invoices require authenticated user (customer, vendor, or admin)
router.use(authenticate, authorize('customer', 'vendor', 'admin'));

/**
 * GET /api/invoices
 * List invoices with role-based filtering and pagination
 */
router.get('/', InvoiceController.listInvoices);

/**
 * GET /api/invoices/:invoiceId
 * Retrieve invoice details and metadata
 */
router.get('/:invoiceId', InvoiceController.getInvoice);

/**
 * GET /api/invoices/:invoiceId/download
 * Download the generated PDF invoice file
 */
router.get('/:invoiceId/download', InvoiceController.downloadInvoice);

export const invoiceRoutes = router;

