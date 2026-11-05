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
