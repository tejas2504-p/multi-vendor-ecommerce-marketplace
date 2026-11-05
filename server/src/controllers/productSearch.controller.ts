import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ProductSearchService } from '../services/productSearch.service';
import { SearchProductsQuery, SearchSuggestionsQuery } from '../validators/productSearch.validator';

export class ProductSearchController {
  /**
   * GET /api/products/search
   * Advanced product search endpoint with multi-field scoring,
   * faceted filters, price bounds, sorting, and aggregations.
   */
  static async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const queryParams = req.query as unknown as SearchProductsQuery;
      const searchResult = await ProductSearchService.searchProducts(queryParams);

      const message =
        searchResult.totalResults === 0
          ? 'No products matched your search criteria'
          : `Found ${searchResult.totalResults} product${searchResult.totalResults === 1 ? '' : 's'}`;

      res.status(StatusCodes.OK).json({
        success: true,
        message,
        products: searchResult.products,
        totalResults: searchResult.totalResults,
        currentPage: searchResult.currentPage,
        totalPages: searchResult.totalPages,
        appliedFilters: searchResult.appliedFilters,
        availableFilters: searchResult.availableFilters,
        data: {
          products: searchResult.products,
          totalResults: searchResult.totalResults,
          currentPage: searchResult.currentPage,
          totalPages: searchResult.totalPages,
          appliedFilters: searchResult.appliedFilters,
          availableFilters: searchResult.availableFilters,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/products/search/suggestions?q=wire
   * Fast autocomplete suggestions for live search inputs.
   */
  static async suggestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q, limit } = req.query as unknown as SearchSuggestionsQuery;
      const result = await ProductSearchService.getSuggestions(q, limit);

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Suggestions retrieved successfully',
        suggestions: result.suggestions,
        items: result.items,
        query: result.query,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

