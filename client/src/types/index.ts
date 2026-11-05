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
