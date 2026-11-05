import { getElasticsearchClient, ELASTICSEARCH_INDEX } from '../config/elastic.config';
import { IndexedProductDocument } from './productIndexing.service';
import { SearchProductsQuery } from '../validators/productSearch.validator';
import { AppError } from '../utils/apiError';
import { logger } from '../utils/logger';

export interface SearchFilterCategory {
  id: string;
  name: string;
  count: number;
}

export interface SearchFilterBrand {
  name: string;
  count: number;
}

export interface SearchAvailableFilters {
  categories: SearchFilterCategory[];
  brands: SearchFilterBrand[];
  priceRange: {
    min: number;
    max: number;
  };
}

export interface ProductSearchResult {
  products: IndexedProductDocument[];
  totalResults: number;
  currentPage: number;
  totalPages: number;
  appliedFilters: SearchProductsQuery;
  availableFilters: SearchAvailableFilters;
}

export interface SearchSuggestionItem {
  id: string;
  name: string;
  brand?: string;
  categoryName?: string;
  price?: number;
}

export interface SearchSuggestionsResult {
  query: string;
  suggestions: string[];
  items: SearchSuggestionItem[];
}

export class ProductSearchService {
  /**
   * Executes multi-field product search with fuzzy matching, relevance boosting,
   * faceted filtering, sorting, and aggregations against the Elasticsearch index.
   */
  static async searchProducts(params: SearchProductsQuery): Promise<ProductSearchResult> {
    const client = getElasticsearchClient();

    // Verify index existence and cluster health first
    try {
      const exists = await client.indices.exists({ index: ELASTICSEARCH_INDEX });
      if (!exists) {
        logger.warn(`Search requested but index '${ELASTICSEARCH_INDEX}' does not exist yet.`);
        return {
          products: [],
          totalResults: 0,
          currentPage: params.page,
          totalPages: 0,
          appliedFilters: params,
          availableFilters: {
            categories: [],
            brands: [],
            priceRange: { min: 0, max: 0 },
          },
        };
      }
    } catch (error: any) {
      logger.error(`❌ Elasticsearch unavailable during search verification: ${error.message}`);
      throw AppError.serviceUnavailable('Search service is temporarily unavailable. Please try again later.');
    }

    // 1. Construct Must Queries (keyword search with relevance boosting & typo tolerance)
    const mustQueries: any[] = [];
    if (params.q && params.q.trim()) {
      const sanitizedQ = params.q.trim();
      mustQueries.push({
        bool: {
          should: [
            {
              multi_match: {
                query: sanitizedQ,
                fields: [
                  'name^4',
                  'name.keyword^6',
                  'brand^2',
                  'brand.text^2',
                  'description^1',
                  'categoryName^1.5',
                ],
                type: 'best_fields',
                fuzziness: 'AUTO',
                prefix_length: 2,
                operator: 'and',
              },
            },
            {
              match_phrase: {
                name: {
                  query: sanitizedQ,
                  boost: 5,
                },
              },
            },
          ],
          minimum_should_match: 1,
        },
      });
    } else {
      mustQueries.push({ match_all: {} });
    }

    // 2. Construct Filter Queries (strictly enforce public visibility + applied filters)
    const filterQueries: any[] = [
      { term: { status: 'active' } },
    ];

    // Category filter (supports either ObjectId or exact Category Name)
    if (params.category && params.category.trim()) {
      const cat = params.category.trim();
      filterQueries.push({
        bool: {
          should: [
            { term: { categoryId: cat } },
            { term: { 'categoryName.keyword': cat } },
          ],
          minimum_should_match: 1,
        },
      });
    }

    // Brand filter (exact keyword match)
    if (params.brand && params.brand.trim()) {
      filterQueries.push({
        term: { brand: params.brand.trim() },
      });
    }

    // Price range filter
    if (params.minPrice !== undefined || params.maxPrice !== undefined) {
      const priceRange: Record<string, number> = {};
      if (params.minPrice !== undefined) priceRange.gte = params.minPrice;
      if (params.maxPrice !== undefined) priceRange.lte = params.maxPrice;
      filterQueries.push({ range: { price: priceRange } });
    }

    // In-stock availability filter
    if (params.inStock === true) {
      filterQueries.push({ range: { stock: { gt: 0 } } });
    } else if (params.inStock === false) {
      filterQueries.push({ term: { stock: 0 } });
    }

    // Minimum rating filter (if rating is indexed)
    if (params.minRating !== undefined && params.minRating > 0) {
      filterQueries.push({ range: { rating: { gte: params.minRating } } });
    }

    // 3. Construct Sorting
    const sortQueries: any[] = [];
    switch (params.sort) {
      case 'price_asc':
        sortQueries.push({ price: { order: 'asc' } }, { _score: { order: 'desc' } });
        break;
      case 'price_desc':
        sortQueries.push({ price: { order: 'desc' } }, { _score: { order: 'desc' } });
        break;
      case 'newest':
        sortQueries.push({ createdAt: { order: 'desc' } });
        break;
      case 'rating':
        sortQueries.push({ rating: { order: 'desc' } }, { _score: { order: 'desc' } });
        break;
      case 'relevance':
      default:
        if (params.q) {
          sortQueries.push({ _score: { order: 'desc' } }, { createdAt: { order: 'desc' } });
        } else {
          sortQueries.push({ createdAt: { order: 'desc' } });
        }
        break;
    }

    // 4. Construct Pagination
    const from = (params.page - 1) * params.limit;
    const size = params.limit;

    // 5. Construct Faceted Aggregations
    const aggs = {
      categories: {
        terms: {
          field: 'categoryId',
          size: 50,
        },
        aggs: {
          category_name: {
            terms: {
              field: 'categoryName.keyword',
              size: 1,
            },
          },
        },
      },
      brands: {
        terms: {
          field: 'brand',
          size: 50,
        },
      },
      price_stats: {
        stats: {
          field: 'price',
        },
      },
    };

    // 6. Execute Elasticsearch Query
    try {
      const response: any = await client.search({
        index: ELASTICSEARCH_INDEX,
        from,
        size,
        query: {
          bool: {
            must: mustQueries,
            filter: filterQueries,
          },
        },
        sort: sortQueries,
        aggs,
      });

      const totalHits =
        typeof response.hits?.total === 'number'
          ? response.hits.total
          : response.hits?.total?.value || 0;

      const totalPages = Math.ceil(totalHits / params.limit) || 0;

      const products: IndexedProductDocument[] = (response.hits?.hits || []).map((hit: any) => {
        const source = hit._source as IndexedProductDocument;
        return {
          productId: source.productId || hit._id,
          name: source.name,
          description: source.description,
          brand: source.brand || '',
          categoryId: source.categoryId,
          categoryName: source.categoryName || '',
          vendorId: source.vendorId,
          price: source.price,
          stock: source.stock,
          rating: source.rating,
          status: source.status,
          images: source.images || [],
          sku: source.sku,
          createdAt: source.createdAt,
          updatedAt: source.updatedAt,
        };
      });

      // Parse aggregations
      const categoryBuckets = response.aggregations?.categories?.buckets || [];
      const categories: SearchFilterCategory[] = categoryBuckets
        .map((bucket: any) => ({
          id: bucket.key,
          name: bucket.category_name?.buckets?.[0]?.key || bucket.key,
          count: bucket.doc_count,
        }))
        .filter((c: SearchFilterCategory) => Boolean(c.id));

      const brandBuckets = response.aggregations?.brands?.buckets || [];
      const brands: SearchFilterBrand[] = brandBuckets
        .map((bucket: any) => ({
          name: bucket.key,
          count: bucket.doc_count,
        }))
        .filter((b: SearchFilterBrand) => Boolean(b.name && b.name.trim()));

      const priceStats = response.aggregations?.price_stats;
      const priceRange = {
        min: priceStats?.min !== null && priceStats?.min !== undefined ? Math.floor(priceStats.min) : 0,
        max: priceStats?.max !== null && priceStats?.max !== undefined ? Math.ceil(priceStats.max) : 0,
      };

      return {
        products,
        totalResults: totalHits,
        currentPage: params.page,
        totalPages,
        appliedFilters: params,
        availableFilters: {
          categories,
          brands,
          priceRange,
        },
      };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      logger.error(`❌ Elasticsearch search execution failed: ${error.message}`);
      throw AppError.serviceUnavailable('Search service is temporarily unavailable. Please try again later.');
    }
  }

  /**
   * Provides rapid product suggestions for autocomplete search.
   * Returns matching product names and minimal preview metadata.
   */
  static async getSuggestions(query: string, limit: number = 8): Promise<SearchSuggestionsResult> {
    const client = getElasticsearchClient();
    const sanitized = query.trim();

    if (!sanitized) {
      return {
        query: '',
        suggestions: [],
        items: [],
      };
    }

    try {
      const exists = await client.indices.exists({ index: ELASTICSEARCH_INDEX });
      if (!exists) {
        return {
          query: sanitized,
          suggestions: [],
          items: [],
        };
      }

      const response: any = await client.search({
        index: ELASTICSEARCH_INDEX,
        size: limit,
        _source: ['productId', 'name', 'brand', 'categoryName', 'price'],
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query: sanitized,
                  fields: ['name^3', 'name.keyword^4', 'brand.text^2'],
                  type: 'phrase_prefix',
                },
              },
            ],
            filter: [
              { term: { status: 'active' } },
            ],
          },
        },
      });

      const hits = response.hits?.hits || [];
      const seenNames = new Set<string>();
      const suggestions: string[] = [];
      const items: SearchSuggestionItem[] = [];

      for (const hit of hits) {
        const source = hit._source;
        if (source && source.name && !seenNames.has(source.name.toLowerCase())) {
          seenNames.add(source.name.toLowerCase());
          suggestions.push(source.name);
          items.push({
            id: source.productId || hit._id,
            name: source.name,
            brand: source.brand,
            categoryName: source.categoryName,
            price: source.price,
          });
        }
      }

      return {
        query: sanitized,
        suggestions,
        items,
      };
    } catch (error: any) {
      logger.error(`❌ Elasticsearch suggestions query failed: ${error.message}`);
      throw AppError.serviceUnavailable('Search suggestions are temporarily unavailable.');
    }
  }
}

