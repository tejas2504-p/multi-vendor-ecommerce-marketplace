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
  paymentMethod?: PaymentMethodType;
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

export type PaymentMethodType = 'upi' | 'upi_qr' | 'card' | 'netbanking' | 'wallet' | 'cod' | 'razorpay';
export type PaymentStatus = 'pending' | 'authorized' | 'captured' | 'failed' | 'refunded' | 'expired';

export interface UpiQrPaymentData {
  qrId: string;
  qrImageUrl: string;
  qrString: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  amountPaise: number;
  currency: string;
  expiresAt: string;
  status: 'waiting' | 'paid' | 'failed' | 'expired';
  isTestMode: boolean;
  merchantVpa: string;
  customer?: {
    name: string;
    phone: string;
  };
}

export interface UpiQrStatusResponse {
  status: 'waiting' | 'paid' | 'failed' | 'expired';
  orderNumber?: string;
  paymentId?: string;
  failureReason?: string;
  expiresAt?: string;
}

export interface Payment {
  id: string;
  customerId: string;
  parentOrderId: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  amount: number;
  currency: string;
  paymentMethod?: PaymentMethodType | string;
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
  paymentMethod?: string;
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

// -------------------------------------------------------------
// Phase 10A: Invoice Models and Types
// -------------------------------------------------------------
export type InvoiceType = 'customer_parent' | 'vendor_order';

export interface DeliveryAddressSnapshot {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface IssuerDetailsSnapshot {
  name: string;
  address: string;
  taxId?: string;
  email?: string;
  phone?: string;
}

export interface CustomerDetailsSnapshot {
  name: string;
  email: string;
  phone?: string;
}

export interface InvoiceItemSnapshot {
  productId: string;
  vendorId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  itemSubtotal: number;
  taxRate?: number;
  taxAmount?: number;
  discountAmount?: number;
}

export interface TaxBreakdown {
  totalTax: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  rate?: number;
  notes?: string;
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  parentOrderId: string;
  vendorOrderId?: string;
  customerId: string;
  vendorId?: string;
  invoiceType: InvoiceType;
  issuerDetails: IssuerDetailsSnapshot;
  customerDetails: CustomerDetailsSnapshot;
  billingAddress: DeliveryAddressSnapshot;
  shippingAddress: DeliveryAddressSnapshot;
  items: InvoiceItemSnapshot[];
  subtotal: number;
  discountAmount: number;
  shippingAmount: number;
  taxBreakdown: TaxBreakdown;
  totalAmount: number;
  currency: string;
  paymentStatus: string;
  invoiceDate: string;
  pdfStorageKey: string;
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// Phase 10B: Analytics & Business Intelligence Types
// -------------------------------------------------------------
export interface AnalyticsOverview {
  totalCustomers: number;
  totalVendors: number;
  totalActiveProducts: number;
  totalParentOrders: number;
  totalVendorOrders: number;
  totalRevenue: number;
  totalCommissionEarned: number;
  pendingPayoutAmount: number;
  completedPayoutAmount: number;
  timestamp: string;
}

export interface RevenueAnalytics {
  totalRevenue: number;
  successfulOrdersCount: number;
  averageOrderValue: number;
  period: {
    startDate: string;
    endDate: string;
    groupBy: string;
  };
  previousPeriod: {
    revenue: number;
    successfulOrdersCount: number;
    revenueGrowthPercentage: number;
    orderGrowthPercentage: number;
  };
  timeline: Array<{
    date: string;
    revenue: number;
    ordersCount: number;
  }>;
}

export interface OrderAnalytics {
  totalOrders: number;
  pending: number;
  confirmed: number;
  processing: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  statusDistribution: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  vendorOrdersSummary: {
    totalVendorOrders: number;
    vendorStatusDistribution: Array<{
      status: string;
      count: number;
    }>;
  };
}

export interface VendorAnalytics {
  vendors: Array<{
    vendorId: string;
    storeName: string;
    businessEmail: string;
    totalSales: number;
    totalOrders: number;
    platformCommission: number;
    netEarnings: number;
    availableBalance: number;
    paidOutAmount: number;
  }>;
  topVendors: Array<{
    vendorId: string;
    storeName: string;
    totalSales: number;
    totalOrders: number;
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ProductAnalytics {
  bestSellingProducts: Array<{
    productId: string;
    productName: string;
    sku: string;
    price: number;
    vendorId: string;
    unitsSold: number;
    totalRevenue: number;
    averageRating: number;
    stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock';
    currentStock: number;
  }>;
  lowStockProducts: Array<{
    productId: string;
    productName: string;
    sku: string;
    stock: number;
    price: number;
  }>;
  outOfStockProducts: Array<{
    productId: string;
    productName: string;
    sku: string;
    price: number;
  }>;
  categorySales: Array<{
    categoryId: string;
    categoryName: string;
    unitsSold: number;
    totalRevenue: number;
  }>;
}

export interface CommissionAnalytics {
  totalCommission: number;
  allTimeCommission: number;
  effectiveCommissionRate: number;
  commissionByPeriod: Array<{
    date: string;
    commissionAmount: number;
  }>;
  commissionByVendor: Array<{
    vendorId: string;
    storeName: string;
    totalCommission: number;
  }>;
}

export interface PayoutAnalytics {
  availableVendorBalances: number;
  pendingBalances: number;
  pendingPayouts: {
    count: number;
    amount: number;
  };
  paidPayouts: {
    count: number;
    amount: number;
  };
  failedPayouts: {
    count: number;
    amount: number;
  };
  recentPayouts: Array<{
    id: string;
    payoutNumber: string;
    vendorId: string;
    storeName: string;
    amount: number;
    status: string;
    destination: string;
    createdAt: string;
  }>;
}
