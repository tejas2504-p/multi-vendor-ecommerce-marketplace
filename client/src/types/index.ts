export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field?: string; path?: string; message: string; issue?: string }>;
  };
}

export interface HealthData {
  status: 'healthy' | 'degraded';
  message: string;
  uptimeSeconds: number;
  timestamp: string;
  environment: string;
  version: string;
  database: {
    mongodb: 'connected' | 'disconnected' | 'connecting';
  };
  memoryUsageMB: {
    rss: string;
    heapUsed: string;
  };
}

export type MarketplaceRole = 'customer' | 'vendor' | 'admin';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: MarketplaceRole;
  createdAt?: string;
  updatedAt?: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface IndexedProduct {
  productId: string;
  name: string;
  description: string;
  brand: string;
  categoryId: string;
  categoryName: string;
  vendorId: string;
  price: number;
  stock: number;
  rating?: number;
  status: string;
  images: string[];
  sku: string;
  createdAt: string;
  updatedAt: string;
}

export interface SearchCategoryFacet {
  id: string;
  name: string;
  count: number;
}

export interface SearchBrandFacet {
  name: string;
  count: number;
}

export interface SearchAvailableFilters {
  categories: SearchCategoryFacet[];
  brands: SearchBrandFacet[];
  priceRange: {
    min: number;
    max: number;
  };
}

export interface SearchAppliedFilters {
  q?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  inStock?: boolean;
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'rating';
  page?: number;
  limit?: number;
}

export interface ProductSearchResponse {
  success: boolean;
  message: string;
  products: IndexedProduct[];
  totalResults: number;
  currentPage: number;
  totalPages: number;
  appliedFilters: SearchAppliedFilters;
  availableFilters: SearchAvailableFilters;
}

export interface SearchSuggestionItem {
  id: string;
  name: string;
  brand?: string;
  categoryName?: string;
  price?: number;
}

export interface SearchSuggestionsResponse {
  success: boolean;
  message?: string;
  query: string;
  suggestions: string[];
  items: SearchSuggestionItem[];
}

export interface Address {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateAddressDto {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  sku: string;
  brand?: string;
  images: Array<{ key: string }>;
  unitPrice: number;
  quantity: number;
  itemTotal: number;
  stock: number;
  isAvailable: boolean;
  availabilityMessage?: string;
}

export interface Cart {
  id: string;
  userId: string;
  items: CartItem[];
  itemCount: number;
  uniqueItemCount: number;
  subtotal: number;
  total: number;
}

export interface OrderItem {
  productId: string;
  vendorId: string;
  productName: string;
  productImage?: string;
  quantity: number;
  unitPrice: number;
  itemSubtotal: number;
}

export interface VendorOrder {
  id: string;
  parentOrderId: string;
  vendorId: string;
  vendorOrderNumber: string;
  items: OrderItem[];
  vendorSubtotal: number;
  shippingShare: number;
  orderStatus: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shipmentTracking?: {
    carrier?: string;
    trackingNumber?: string;
    estimatedDeliveryDate?: string;
    shippedAt?: string;
    deliveredAt?: string;
  };
  cancellationReason?: string;
  cancelledAt?: string;
  statusHistory?: Array<{
    status: string;
    changedAt: string;
    note?: string;
  }>;
  createdAt: string;
  updatedAt?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  customerId?: string;
  deliveryAddress: {
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  vendorOrders?: VendorOrder[] | string[];
  items: OrderItem[];
  subtotal: number;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;
  couponCode?: string;
  couponSnapshot?: {
    code: string;
    discountType: string;
    discountValue: number;
    discountAmount: number;
  };
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  orderStatus:
    | 'pending'
    | 'confirmed'
    | 'processing'
    | 'shipped'
    | 'partially_shipped'
    | 'partially_delivered'
    | 'delivered'
    | 'cancelled';
  createdAt: string;
}

export type PaymentStatus = 'pending' | 'authorized' | 'captured' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  customerId: string;
  parentOrderId: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  amount: number;
  currency: string;
  paymentMethod?: string;
  status: PaymentStatus;
  failureReason?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RazorpayOrderData {
  keyId: string;
  razorpayOrderId: string;
  amount: number; // in paise
  currency: string;
  orderId: string;
  orderNumber: string;
  customer: {
    name: string;
    phone: string;
  };
}

// ==========================================
// Phase 8B: Platform Commission & Payout Types
// ==========================================

export interface VendorEarningsSummary {
  vendorId: string;
  totalGrossSales: number;
  totalCommission: number;
  netEarnings: number;
  availableBalance: number;
  pendingBalance: number;
  paidOutAmount: number;
  effectiveCommissionRate: number;
  minPayoutAmount: number;
  pendingPayoutsCount: number;
  updatedAt: string;
}

export type LedgerTransactionType =
  | 'order_earning'
  | 'payout_requested'
  | 'payout_processed'
  | 'payout_rejected'
  | 'payout_failed'
  | 'adjustment';

export interface VendorLedgerEntry {
  _id: string;
  vendorId: string;
  transactionType: LedgerTransactionType;
  direction: 'credit' | 'debit';
  amount: number;
  balanceAfter: number;
  parentOrderId?: string;
  vendorOrderId?: string;
  payoutId?: string;
  reference: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export type PayoutStatus =
  | 'requested'
  | 'approved'
  | 'processing'
  | 'paid'
  | 'rejected'
  | 'failed';

export interface VendorPayoutRecord {
  _id: string;
  vendorId: {
    _id: string;
    fullName?: string;
    email?: string;
  } | string;
  payoutNumber: string;
  requestedAmount: number;
  approvedAmount?: number;
  payoutStatus: PayoutStatus;
  destinationReference: string;
  providerReference?: string;
  failureReason?: string;
  rejectionReason?: string;
  requestedAt: string;
  processedAt?: string;
  processedBy?: {
    _id: string;
    fullName?: string;
    email?: string;
  } | string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCommissionOverview {
  defaultCommissionRate: number;
  minPayoutAmount: number;
  stats: {
    totalGrossSales: number;
    totalPlatformCommission: number;
    totalAvailableBalance: number;
    totalPendingBalance: number;
    totalPaidOutAmount: number;
  };
  vendorOverrides: Array<{
    _id: string;
    vendorId: {
      _id: string;
      fullName?: string;
      email?: string;
    };
    storeName: string;
    commissionRate: number;
  }>;
}

// ==========================================
// Phase 9A: Product Reviews & Ratings Types
// ==========================================

export type ReviewModerationStatus = 'pending' | 'approved' | 'hidden' | 'rejected';

export interface RatingDistribution {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

export interface ProductReviewSummary {
  averageRating: number;
  reviewCount: number;
  ratingDistribution: RatingDistribution;
}

export interface ReviewItem {
  _id: string;
  id: string;
  userId?: string;
  author: {
    id: string;
    name: string;
  };
  productId: string;
  orderId?: string;
  rating: number;
  title: string;
  comment: string;
  isVerifiedPurchase: boolean;
  moderationStatus: ReviewModerationStatus;
  moderationReason?: string;
  helpfulCount: number;
  hasVotedHelpful?: boolean;
  isAuthor?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewEligibility {
  eligible: boolean;
  reason?: string;
  orderId?: string;
  vendorOrderId?: string;
  alreadyReviewed?: boolean;
  existingReviewId?: string;
}

export interface CreateReviewPayload {
  rating: number;
  title: string;
  comment: string;
}

export interface UpdateReviewPayload {
  rating?: number;
  title?: string;
  comment?: string;
}

export interface AdminReviewItem extends ReviewItem {
  product?: {
    _id: string;
    name: string;
    price: number;
    images?: Array<{ key: string; originalName: string }>;
  };
  user?: {
    _id: string;
    name: string;
    email: string;
  };
  moderatedBy?: {
    _id: string;
    name: string;
  };
  moderatedAt?: string;
}

// ============================================================================
// Phase 9B: Coupon and Discount Types
// ============================================================================

export type DiscountType = 'percentage' | 'fixed';

export interface Coupon {
  id: string;
  _id?: string;
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  maximumDiscountAmount?: number;
  minimumOrderAmount: number;
  startDate: string;
  expiryDate: string;
  totalUsageLimit?: number;
  perUserUsageLimit: number;
  usageCount: number;
  applicableProducts?: any[];
  applicableCategories?: any[];
  applicableVendors?: any[];
  isActive: boolean;
  createdBy?: any;
  createdAt: string;
  updatedAt: string;
  totalRedemptions?: number;
}

export interface CouponValidationResponse {
  valid: boolean;
  coupon: {
    id: string;
    code: string;
    description: string;
    discountType: DiscountType;
    discountValue: number;
    maximumDiscountAmount?: number;
    minimumOrderAmount: number;
  };
  cartSubtotal: number;
  eligibleSubtotal: number;
  discountAmount: number;
  shippingAmount: number;
  finalPayable: number;
}

export interface CreateCouponPayload {
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  maximumDiscountAmount?: number;
  minimumOrderAmount?: number;
  startDate: string;
  expiryDate: string;
  totalUsageLimit?: number;
  perUserUsageLimit?: number;
  applicableProducts?: string[];
  applicableCategories?: string[];
  applicableVendors?: string[];
  isActive?: boolean;
}

export interface UpdateCouponPayload {
  code?: string;
  description?: string;
  discountType?: DiscountType;
  discountValue?: number;
  maximumDiscountAmount?: number;
  minimumOrderAmount?: number;
  startDate?: string;
  expiryDate?: string;
  totalUsageLimit?: number;
  perUserUsageLimit?: number;
  applicableProducts?: string[];
  applicableCategories?: string[];
  applicableVendors?: string[];
  isActive?: boolean;
}
