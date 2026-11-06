import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  PackageSearch,
  AlertCircle,
  RotateCcw,
  X,
} from 'lucide-react';
import { ProductSearchBar } from './ProductSearchBar';
import { ProductFilterSidebar } from './ProductFilterSidebar';
import { ProductGridCard } from './ProductGridCard';
import { ProductDetailModal } from '../reviews/ProductDetailModal';
import { productSearchApi } from '../../services/productSearch.api';
import {
  ProductSearchResponse,
  SearchAppliedFilters,
  SearchAvailableFilters,
  IndexedProduct,
} from '../../types';

export const ProductSearchExperience: React.FC = () => {
  // Read initial filters from URL search params
  const getInitialFilters = (): SearchAppliedFilters => {
    if (typeof window === 'undefined') return { page: 1, limit: 12, sort: 'relevance' };
    const params = new URLSearchParams(window.location.search);
    return {
      q: params.get('q') || undefined,
      category: params.get('category') || undefined,
      brand: params.get('brand') || undefined,
      minPrice: params.get('minPrice') ? Number(params.get('minPrice')) : undefined,
      maxPrice: params.get('maxPrice') ? Number(params.get('maxPrice')) : undefined,
      minRating: params.get('minRating') ? Number(params.get('minRating')) : undefined,
      inStock: params.get('inStock') === 'true' ? true : undefined,
      sort: (params.get('sort') as any) || 'relevance',
      page: params.get('page') ? Number(params.get('page')) : 1,
      limit: 12,
    };
  };

  const [filters, setFilters] = useState<SearchAppliedFilters>(getInitialFilters);
  const [products, setProducts] = useState<IndexedProduct[]>([]);
  const [totalResults, setTotalResults] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [availableFilters, setAvailableFilters] = useState<SearchAvailableFilters>({
    categories: [],
    brands: [],
    priceRange: { min: 0, max: 0 },
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<IndexedProduct | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync state changes with URL query parameters
  const updateUrl = useCallback((newFilters: SearchAppliedFilters) => {
    const params = new URLSearchParams();
    if (newFilters.q) params.set('q', newFilters.q);
    if (newFilters.category) params.set('category', newFilters.category);
    if (newFilters.brand) params.set('brand', newFilters.brand);
    if (newFilters.minPrice !== undefined) params.set('minPrice', String(newFilters.minPrice));
    if (newFilters.maxPrice !== undefined) params.set('maxPrice', String(newFilters.maxPrice));
    if (newFilters.minRating !== undefined) params.set('minRating', String(newFilters.minRating));
    if (newFilters.inStock !== undefined) params.set('inStock', 'true');
    if (newFilters.sort && newFilters.sort !== 'relevance') params.set('sort', newFilters.sort);
    if (newFilters.page && newFilters.page > 1) params.set('page', String(newFilters.page));

    const newQuery = params.toString();
    const newUrl = newQuery ? `${window.location.pathname}?${newQuery}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }, []);

  // Fetch search results from Elasticsearch API
  const fetchSearchResults = useCallback(async (currentFilters: SearchAppliedFilters) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res: ProductSearchResponse = await productSearchApi.search(
        currentFilters,
        controller.signal
      );
      setProducts(res.products || []);
      setTotalResults(res.totalResults || 0);
      setCurrentPage(res.currentPage || 1);
      setTotalPages(res.totalPages || 1);
      if (res.availableFilters) {
        setAvailableFilters(res.availableFilters);
      }
      updateUrl(currentFilters);
    } catch (err: any) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        const message =
          err.response?.data?.error?.message ||
          err.response?.data?.message ||
          'Search service is temporarily unavailable. Please try again later.';
        setErrorMessage(message);
        setProducts([]);
        setTotalResults(0);
      }
    } finally {
      setIsLoading(false);
    }
  }, [updateUrl]);

  // Execute search when filters change
  useEffect(() => {
    fetchSearchResults(filters);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [filters, fetchSearchResults]);

  // Filter modification handler
  const handleFilterChange = (newPartial: Partial<SearchAppliedFilters>) => {
    setFilters((prev) => ({
      ...prev,
      ...newPartial,
    }));
  };

  // Search keyword submission handler
  const handleSearchSubmit = (newQuery: string) => {
    setFilters((prev) => ({
      ...prev,
      q: newQuery || undefined,
      page: 1,
    }));
  };

  // Reset all active filters
  const handleClearAll = () => {
    setFilters({
      page: 1,
      limit: 12,
      sort: 'relevance',
    });
  };

  // Remove individual filter pill
  const handleRemoveFilter = (filterKey: keyof SearchAppliedFilters) => {
    setFilters((prev) => {
      const updated = { ...prev, page: 1 };
      delete updated[filterKey];
      return updated;
    });
  };

  return (
    <div className="space-y-6">
      {/* Search Header Bar */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Catalog Search & Discovery
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Powered by Elasticsearch with full-text search, fuzzy matching, and instant facets.
            </p>
          </div>

          <div className="w-full sm:w-auto flex items-center space-x-2">
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="lg:hidden flex-1 sm:flex-none flex items-center justify-center space-x-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
            >
              <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
              <span>Filters</span>
            </button>
          </div>
        </div>

        {/* Search Bar with live autocomplete suggestions */}
        <ProductSearchBar
          initialQuery={filters.q || ''}
          onSearch={handleSearchSubmit}
        />

        {/* Active Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          {filters.q && (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-medium border border-indigo-100">
              <span>Keyword: &quot;{filters.q}&quot;</span>
              <button
                onClick={() => handleRemoveFilter('q')}
                className="hover:text-indigo-900"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}

          {filters.category && (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-medium border border-indigo-100">
              <span>Category Filter</span>
              <button
                onClick={() => handleRemoveFilter('category')}
                className="hover:text-indigo-900"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}

          {filters.brand && (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-medium border border-indigo-100">
              <span>Brand: {filters.brand}</span>
              <button
                onClick={() => handleRemoveFilter('brand')}
                className="hover:text-indigo-900"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}

          {(filters.minPrice !== undefined || filters.maxPrice !== undefined) && (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-medium border border-indigo-100">
              <span>
                Price: ${filters.minPrice ?? 0} – ${filters.maxPrice ?? '∞'}
              </span>
              <button
                onClick={() => {
                  setFilters((prev) => ({
                    ...prev,
                    minPrice: undefined,
                    maxPrice: undefined,
                    page: 1,
                  }));
                }}
                className="hover:text-indigo-900"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}

          {filters.inStock && (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-100">
              <span>In Stock Only</span>
              <button
                onClick={() => handleRemoveFilter('inStock')}
                className="hover:text-emerald-900"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}

          {filters.minRating && (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 font-medium border border-amber-100">
              <span>{filters.minRating}★ & Up</span>
              <button
                onClick={() => handleRemoveFilter('minRating')}
                className="hover:text-amber-900"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}
        </div>
      </div>

      {/* Main Content Layout (Sidebar + Results Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Desktop Filter Sidebar */}
        <div className="hidden lg:block lg:col-span-1 sticky top-24">
          <ProductFilterSidebar
            availableFilters={availableFilters}
            appliedFilters={filters}
            onFilterChange={handleFilterChange}
            onClearAll={handleClearAll}
          />
        </div>

        {/* Mobile Filter Drawer */}
        {showMobileFilters && (
          <div className="lg:hidden col-span-1">
            <ProductFilterSidebar
              availableFilters={availableFilters}
              appliedFilters={filters}
              onFilterChange={(newF) => {
                handleFilterChange(newF);
                setShowMobileFilters(false);
              }}
              onClearAll={() => {
                handleClearAll();
                setShowMobileFilters(false);
              }}
            />
          </div>
        )}

        {/* Product Grid Area */}
        <div className="lg:col-span-3 space-y-5">
          {/* Controls Bar (Results Count & Sort Dropdown) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-5 py-3.5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-xs sm:text-sm text-slate-600 font-medium">
              {isLoading ? (
                <span>Searching catalog...</span>
              ) : (
                <span>
                  Showing <strong className="text-slate-900">{products.length}</strong> of{' '}
                  <strong className="text-slate-900">{totalResults}</strong> products
                  {filters.q ? ` for "${filters.q}"` : ''}
                </span>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-400 font-medium">Sort by:</span>
              <select
                value={filters.sort || 'relevance'}
                onChange={(e) =>
                  handleFilterChange({
                    sort: e.target.value as any,
                    page: 1,
                  })
                }
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-medium text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="relevance">Most Relevant</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="newest">Newest Arrivals</option>
                <option value="rating">Customer Rating</option>
              </select>
            </div>
          </div>

          {/* Loading Skeleton State */}
          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 animate-pulse"
                >
                  <div className="aspect-square bg-slate-100 rounded-xl w-full" />
                  <div className="h-4 bg-slate-100 rounded w-1/3" />
                  <div className="h-5 bg-slate-100 rounded w-3/4" />
                  <div className="h-4 bg-slate-100 rounded w-1/2" />
                  <div className="pt-2 flex justify-between items-center">
                    <div className="h-6 bg-slate-100 rounded w-1/4" />
                    <div className="h-8 bg-slate-100 rounded w-16" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {!isLoading && errorMessage && (
            <div className="bg-rose-50 border border-rose-200 rounded-3xl p-8 text-center space-y-3">
              <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Search Unavailable</h3>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
                {errorMessage}
              </p>
              <button
                onClick={() => fetchSearchResults(filters)}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !errorMessage && products.length === 0 && (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
              <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mx-auto">
                <PackageSearch className="w-8 h-8 stroke-[1.5]" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-lg">No Products Found</h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
                  We couldn&apos;t find any products matching your current query and filters. Try adjusting your search term or resetting filters.
                </p>
              </div>
              <button
                onClick={handleClearAll}
                className="inline-flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Clear All Filters</span>
              </button>
            </div>
          )}

          {/* Product Grid Results */}
          {!isLoading && !errorMessage && products.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {products.map((p) => (
                <ProductGridCard
                  key={p.productId}
                  product={p}
                  onSelect={setSelectedProduct}
                />
              ))}
            </div>
          )}

          {/* Product Detail & Reviews Modal */}
          <ProductDetailModal
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
          />

          {/* Pagination Controls */}
          {!isLoading && totalPages > 1 && (
            <div className="flex items-center justify-between bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-sm text-xs">
              <button
                disabled={currentPage <= 1}
                onClick={() => handleFilterChange({ page: currentPage - 1 })}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <span className="font-semibold text-slate-700">
                Page {currentPage} of {totalPages}
              </span>

              <button
                disabled={currentPage >= totalPages}
                onClick={() => handleFilterChange({ page: currentPage + 1 })}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

