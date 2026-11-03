/**
 * Schema and Model Registry for Multi-Vendor Marketplace
 * Implementation starts in Phase 2 (User & Vendor Models)
 * Full schema designs documented in docs/architecture.md
 */

export interface ModelRegistry {
  users: 'Phase 2A';
  vendorProfiles: 'Phase 2A & 3B';
  categories: 'Phase 4A';
  products: 'Phase 5B';
  carts: 'Phase 7A';
  coupons: 'Phase 7B';
  orders: 'Phase 8A';
  orderItems: 'Phase 8A & 9A';
  payments: 'Phase 8B';
  reviews: 'Phase 11A';
  addresses: 'Phase 3A';
}

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

