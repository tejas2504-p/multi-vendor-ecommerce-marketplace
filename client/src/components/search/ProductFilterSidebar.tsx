import React, { useState, useEffect } from 'react';
import {
  Filter,
  RotateCcw,
  Tag,
  Boxes,
  DollarSign,
  Star,
  CheckCircle2,
} from 'lucide-react';
import { SearchAvailableFilters, SearchAppliedFilters } from '../../types';

interface ProductFilterSidebarProps {
  availableFilters: SearchAvailableFilters;
  appliedFilters: SearchAppliedFilters;
  onFilterChange: (newFilters: Partial<SearchAppliedFilters>) => void;
  onClearAll: () => void;
}

export const ProductFilterSidebar: React.FC<ProductFilterSidebarProps> = ({
  availableFilters,
  appliedFilters,
  onFilterChange,
  onClearAll,
}) => {
  const [minPriceInput, setMinPriceInput] = useState<string>(
    appliedFilters.minPrice !== undefined ? String(appliedFilters.minPrice) : ''
  );
  const [maxPriceInput, setMaxPriceInput] = useState<string>(
    appliedFilters.maxPrice !== undefined ? String(appliedFilters.maxPrice) : ''
  );
  const [priceError, setPriceError] = useState<string | null>(null);

  useEffect(() => {
    setMinPriceInput(appliedFilters.minPrice !== undefined ? String(appliedFilters.minPrice) : '');
    setMaxPriceInput(appliedFilters.maxPrice !== undefined ? String(appliedFilters.maxPrice) : '');
    setPriceError(null);
  }, [appliedFilters.minPrice, appliedFilters.maxPrice]);

  const handleApplyPrice = (e: React.FormEvent) => {
    e.preventDefault();
    setPriceError(null);

    const min = minPriceInput ? parseFloat(minPriceInput) : undefined;
    const max = maxPriceInput ? parseFloat(maxPriceInput) : undefined;

    if (min !== undefined && min < 0) {
      setPriceError('Min price cannot be negative');
      return;
    }
    if (max !== undefined && max < 0) {
      setPriceError('Max price cannot be negative');
      return;
    }
    if (min !== undefined && max !== undefined && min > max) {
      setPriceError('Min price cannot exceed Max price');
      return;
    }

    onFilterChange({
      minPrice: min,
      maxPrice: max,
      page: 1,
    });
  };

  const handleResetPrice = () => {
    setMinPriceInput('');
    setMaxPriceInput('');
    setPriceError(null);
    onFilterChange({
      minPrice: undefined,
      maxPrice: undefined,
      page: 1,
    });
  };

  const hasActiveFilters = Boolean(
    appliedFilters.category ||
    appliedFilters.brand ||
    appliedFilters.minPrice !== undefined ||
    appliedFilters.maxPrice !== undefined ||
    appliedFilters.inStock !== undefined ||
    (appliedFilters.minRating !== undefined && appliedFilters.minRating > 0)
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center space-x-2 text-slate-900 font-bold text-base">
          <Filter className="w-4 h-4 text-indigo-600" />
          <span>Filters</span>
        </div>

        {hasActiveFilters && (
          <button
            onClick={onClearAll}
            className="flex items-center space-x-1 text-xs font-semibold text-rose-600 hover:text-rose-700 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All</span>
          </button>
        )}
      </div>

      {/* Stock Availability Filter */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
          <Boxes className="w-3.5 h-3.5 text-slate-400" />
          <span>Availability</span>
        </h4>
        <label className="flex items-center space-x-2.5 cursor-pointer select-none text-sm text-slate-700 hover:text-slate-900">
          <input
            type="checkbox"
            checked={appliedFilters.inStock === true}
            onChange={(e) =>
              onFilterChange({
                inStock: e.target.checked ? true : undefined,
                page: 1,
              })
            }
            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 transition"
          />
          <span className="font-medium">In Stock Only</span>
        </label>
      </div>

      {/* Category Filter */}
      {availableFilters.categories.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
            <Tag className="w-3.5 h-3.5 text-slate-400" />
            <span>Categories</span>
          </h4>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            <button
              onClick={() => onFilterChange({ category: undefined, page: 1 })}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                !appliedFilters.category
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>All Categories</span>
            </button>

            {availableFilters.categories.map((cat) => {
              const isSelected =
                appliedFilters.category === cat.id ||
                appliedFilters.category?.toLowerCase() === cat.name.toLowerCase();
              return (
                <button
                  key={cat.id}
                  onClick={() =>
                    onFilterChange({
                      category: isSelected ? undefined : cat.id,
                      page: 1,
                    })
                  }
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                    isSelected
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{cat.name}</span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 ml-2">
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Brand Filter */}
      {availableFilters.brands.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Brands</span>
          </h4>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {availableFilters.brands.map((b) => {
              const isSelected = appliedFilters.brand === b.name;
              return (
                <label
                  key={b.name}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer select-none transition ${
                    isSelected ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() =>
                        onFilterChange({
                          brand: isSelected ? undefined : b.name,
                          page: 1,
                        })
                      }
                      className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <span className="truncate">{b.name}</span>
                  </div>
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 ml-2">
                    {b.count}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Price Range Filter */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
          <DollarSign className="w-3.5 h-3.5 text-slate-400" />
          <span>Price Range ($)</span>
        </h4>

        <form onSubmit={handleApplyPrice} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-0.5">Min</label>
              <input
                type="number"
                min="0"
                step="any"
                value={minPriceInput}
                onChange={(e) => setMinPriceInput(e.target.value)}
                placeholder={String(availableFilters.priceRange.min || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-0.5">Max</label>
              <input
                type="number"
                min="0"
                step="any"
                value={maxPriceInput}
                onChange={(e) => setMaxPriceInput(e.target.value)}
                placeholder={String(availableFilters.priceRange.max || 1000)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {priceError && (
            <p className="text-[11px] text-rose-600 font-medium">{priceError}</p>
          )}

          <div className="flex items-center space-x-2 pt-1">
            <button
              type="submit"
              className="flex-1 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition"
            >
              Apply
            </button>
            {(appliedFilters.minPrice !== undefined || appliedFilters.maxPrice !== undefined) && (
              <button
                type="button"
                onClick={handleResetPrice}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition"
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Rating Filter */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          <span>Customer Rating</span>
        </h4>

        <div className="space-y-1">
          {[4, 3, 2].map((rating) => {
            const isSelected = appliedFilters.minRating === rating;
            return (
              <button
                key={rating}
                onClick={() =>
                  onFilterChange({
                    minRating: isSelected ? undefined : rating,
                    page: 1,
                  })
                }
                className={`w-full flex items-center justify-between px-2.5 py-1 rounded-lg text-xs transition ${
                  isSelected ? 'bg-amber-50 text-amber-800 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <div className="flex items-center text-amber-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3 h-3 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                      />
                    ))}
                  </div>
                  <span>& Up</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

