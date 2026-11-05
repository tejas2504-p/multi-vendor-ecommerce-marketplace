import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, Sparkles, Tag } from 'lucide-react';
import { productSearchApi } from '../../services/productSearch.api';
import { SearchSuggestionItem } from '../../types';

interface ProductSearchBarProps {
  initialQuery?: string;
  onSearch: (query: string) => void;
  placeholder?: string;
}

export const ProductSearchBar: React.FC<ProductSearchBarProps> = ({
  initialQuery = '',
  onSearch,
  placeholder = 'Search products by name, brand, or description...',
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [items, setItems] = useState<SearchSuggestionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync internal query with prop when parent clears or changes it
  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  // Debounced autocomplete suggestions query
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setItems([]);
      setIsOpen(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        setIsLoading(true);
        const data = await productSearchApi.getSuggestions(trimmed, 6, controller.signal);
        setSuggestions(data.suggestions || []);
        setItems(data.items || []);
        setIsOpen(data.suggestions.length > 0 || data.items.length > 0);
      } catch (err: any) {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
          setSuggestions([]);
          setItems([]);
        }
      } finally {
        setIsLoading(false);
      }
    }, 280);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Handle outside clicks to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsOpen(false);
    onSearch(query.trim());
  };

  const handleSelectSuggestion = (selectedText: string) => {
    setQuery(selectedText);
    setIsOpen(false);
    onSearch(selectedText);
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setItems([]);
    setIsOpen(false);
    onSearch('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const totalItems = items.length > 0 ? items.length : suggestions.length;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0) {
        e.preventDefault();
        const selectedText = items[selectedIndex]?.name || suggestions[selectedIndex];
        if (selectedText) {
          handleSelectSuggestion(selectedText);
        }
      } else {
        handleSubmit();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
          <Search className="w-5 h-5" />
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(-1);
          }}
          onFocus={() => {
            if (suggestions.length > 0 || items.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-11 pr-24 py-3 bg-white border border-slate-300 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-sm transition-all text-sm sm:text-base"
        />

        <div className="absolute inset-y-0 right-0 pr-3 flex items-center space-x-2">
          {isLoading && <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />}

          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            type="submit"
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition"
          >
            Search
          </button>
        </div>
      </form>

      {/* Autocomplete Suggestions Dropdown */}
      {isOpen && (suggestions.length > 0 || items.length > 0) && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50">
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span className="flex items-center space-x-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Suggested Matches</span>
            </span>
            <span className="text-[11px] text-slate-400">Press Enter to select</span>
          </div>

          <ul className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {items.map((item, idx) => {
              const isSelected = selectedIndex === idx;
              return (
                <li
                  key={item.id || idx}
                  onClick={() => handleSelectSuggestion(item.name)}
                  className={`px-4 py-2.5 cursor-pointer flex items-center justify-between transition-colors ${
                    isSelected ? 'bg-indigo-50 text-indigo-900 font-medium' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <Search className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span className="truncate text-sm">{item.name}</span>
                    {item.brand && (
                      <span className="shrink-0 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium">
                        {item.brand}
                      </span>
                    )}
                  </div>
                  {item.price !== undefined && (
                    <span className="shrink-0 text-xs font-semibold text-emerald-600 ml-2">
                      ${Number(item.price).toFixed(2)}
                    </span>
                  )}
                </li>
              );
            })}

            {items.length === 0 &&
              suggestions.map((sug, idx) => {
                const isSelected = selectedIndex === idx;
                return (
                  <li
                    key={idx}
                    onClick={() => handleSelectSuggestion(sug)}
                    className={`px-4 py-2.5 cursor-pointer flex items-center space-x-2.5 text-sm transition-colors ${
                      isSelected ? 'bg-indigo-50 text-indigo-900 font-medium' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Tag className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{sug}</span>
                  </li>
                );
              })}
          </ul>
        </div>
      )}
    </div>
  );
};

