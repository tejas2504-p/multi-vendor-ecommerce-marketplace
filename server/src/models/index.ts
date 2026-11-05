/**
 * Schema and Model Registry for Multi-Vendor Marketplace
 */

export * from './user.model';
export * from './vendorProfile.model';
export * from './category.model';
export * from './product.model';
export * from './productSyncOutbox.model';

export const registeredModels = [
  'User',
  'VendorProfile',
  'Category',
  'Product',
  'Cart',
  'Coupon',
  'Order',
  'OrderItem',
  'Payment',
  'Review',
  'Address',
] as const;
