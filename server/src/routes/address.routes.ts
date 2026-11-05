import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validateBody, validateParams } from '../middlewares/validate.middleware';
import {
  createAddressSchema,
  updateAddressSchema,
  addressParamSchema,
} from '../validators/address.validator';
import { AddressController } from '../controllers/address.controller';

const router = Router();

// Protect all address routes: Requires authenticated customer or admin
router.use(authenticate, authorize('customer', 'admin'));

/**
 * POST /api/addresses
 * Add a new delivery address
 */
router.post('/', validateBody(createAddressSchema), AddressController.create);

/**
 * GET /api/addresses
 * List all saved delivery addresses for authenticated customer
 */
router.get('/', AddressController.list);

/**
 * GET /api/addresses/:id
 * Retrieve a specific address
 */
router.get('/:id', validateParams(addressParamSchema), AddressController.getById);

/**
 * PATCH /api/addresses/:id
 * Update address fields
 */
router.patch(
  '/:id',
  validateParams(addressParamSchema),
  validateBody(updateAddressSchema),
  AddressController.update
);

/**
 * PATCH /api/addresses/:id/default
 * Set address as primary default
 */
router.patch('/:id/default', validateParams(addressParamSchema), AddressController.setDefault);

/**
 * DELETE /api/addresses/:id
 * Delete an address
 */
router.delete('/:id', validateParams(addressParamSchema), AddressController.remove);

export const addressRoutes = router;

