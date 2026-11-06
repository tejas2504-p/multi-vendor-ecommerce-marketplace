/**
 * Schema and Model Registry for Multi-Vendor Marketplace
 */

export * from './user.model';
export * from './vendorProfile.model';
export * from './category.model';
export * from './product.model';
export * from './productSyncOutbox.model';
export * from './cart.model';
export * from './address.model';
export * from './order.model';
export * from './vendorOrder.model';
export * from './payment.model';
export * from './webhookEvent.model';
export * from './platformSetting.model';
export * from './vendorEarnings.model';
export * from './vendorLedger.model';
export * from './vendorPayout.model';
export * from './review.model';
export * from './reviewVote.model';
export * from './coupon.model';
export * from './couponUsage.model';

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
