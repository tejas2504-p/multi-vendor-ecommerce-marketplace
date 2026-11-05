import { apiClient } from './api';
import {
  ProductSearchResponse,
  SearchAppliedFilters,
  SearchSuggestionsResponse,
} from '../types';

export const productSearchApi = {
  /**
   * Performs advanced product search and faceted filtering via Elasticsearch.
   */
  search: async (
    filters: SearchAppliedFilters,
    signal?: AbortSignal
  ): Promise<ProductSearchResponse> => {
    const params: Record<string, any> = {};

    if (filters.q && filters.q.trim()) params.q = filters.q.trim();
    if (filters.category && filters.category.trim()) params.category = filters.category.trim();
    if (filters.brand && filters.brand.trim()) params.brand = filters.brand.trim();
    if (filters.minPrice !== undefined && filters.minPrice >= 0) params.minPrice = filters.minPrice;
    if (filters.maxPrice !== undefined && filters.maxPrice >= 0) params.maxPrice = filters.maxPrice;
    if (filters.minRating !== undefined && filters.minRating > 0) params.minRating = filters.minRating;
    if (filters.inStock !== undefined) params.inStock = filters.inStock;
    if (filters.sort) params.sort = filters.sort;
    if (filters.page && filters.page >= 1) params.page = filters.page;
    if (filters.limit && filters.limit >= 1) params.limit = filters.limit;

    const response = await apiClient.get<ProductSearchResponse>('/api/products/search', {
      params,
      signal,
    });
    return response.data;
  },

  /**
   * Fetches live autocomplete product suggestions.
   */
  getSuggestions: async (
    query: string,
    limit: number = 6,
    signal?: AbortSignal
  ): Promise<SearchSuggestionsResponse> => {
    const response = await apiClient.get<SearchSuggestionsResponse>(
      '/api/products/search/suggestions',
      {
        params: { q: query.trim(), limit },
        signal,
      }
    );
    return response.data;
  },
};

