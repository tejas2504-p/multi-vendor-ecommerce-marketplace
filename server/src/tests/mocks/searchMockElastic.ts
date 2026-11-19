import { ELASTICSEARCH_INDEX } from '../../config/elastic.config';

export class SearchMockElasticsearchClient {
  public indicesSet = new Set<string>();
  public indexStorage = new Map<string, Map<string, any>>();
  public shouldFail = false;

  constructor() {
    this.indicesSet.add(ELASTICSEARCH_INDEX);
    this.indexStorage.set(ELASTICSEARCH_INDEX, new Map());
  }

  get indices() {
    return {
      exists: async ({ index }: { index: string }) => {
        if (this.shouldFail) throw new Error('Elasticsearch connection refused');
        return this.indicesSet.has(index);
      },
      create: async ({ index }: any) => {
        if (this.shouldFail) throw new Error('Elasticsearch connection refused');
        this.indicesSet.add(index);
        if (!this.indexStorage.has(index)) {
          this.indexStorage.set(index, new Map());
        }
        return { acknowledged: true };
      },
      delete: async ({ index }: any) => {
        if (this.shouldFail) throw new Error('Elasticsearch connection refused');
        this.indicesSet.delete(index);
        this.indexStorage.delete(index);
        return { acknowledged: true };
      },
    };
  }

  async count({ index }: { index: string }) {
    if (this.shouldFail) throw new Error('Elasticsearch connection refused');
    const store = this.indexStorage.get(index);
    return { count: store ? store.size : 0 };
  }

  async index({ index, id, document }: { index: string; id: string; document: any }) {
    if (this.shouldFail) throw new Error('Elasticsearch index request failed');
    let store = this.indexStorage.get(index);
    if (!store) {
      store = new Map();
      this.indexStorage.set(index, store);
      this.indicesSet.add(index);
    }
    store.set(id, { ...document, _id: id });
    return { result: 'created', _id: id };
  }

  async delete({ index, id }: { index: string; id: string }) {
    if (this.shouldFail) throw new Error('Elasticsearch delete request failed');
    const store = this.indexStorage.get(index);
    if (store) store.delete(id);
    return { result: 'deleted', _id: id };
  }

  async search({ index, from = 0, size = 20, query, sort, aggs }: any) {
    if (this.shouldFail) {
      throw new Error('Elasticsearch connection refused');
    }

    const store = this.indexStorage.get(index) || new Map();
    let docs = Array.from(store.values());

    // 1. Evaluate Filters
    const boolFilter = query?.bool?.filter || [];
    for (const f of boolFilter) {
      if (f.term?.status) {
        docs = docs.filter((d) => d.status === f.term.status);
      }
      if (f.term?.brand) {
        docs = docs.filter((d) => d.brand?.toLowerCase() === f.term.brand.toLowerCase());
      }
      if (f.term?.stock !== undefined) {
        docs = docs.filter((d) => d.stock === f.term.stock);
      }
      if (f.range?.stock?.gt !== undefined) {
        docs = docs.filter((d) => d.stock > f.range.stock.gt);
      }
      if (f.range?.price) {
        const { gte, lte } = f.range.price;
        if (gte !== undefined) docs = docs.filter((d) => d.price >= gte);
        if (lte !== undefined) docs = docs.filter((d) => d.price <= lte);
      }
      if (f.range?.rating) {
        const { gte } = f.range.rating;
        if (gte !== undefined) docs = docs.filter((d) => (d.rating || 0) >= gte);
      }
      if (f.bool?.should) {
        const shouldTerms = f.bool.should;
        docs = docs.filter((d) => {
          return shouldTerms.some((st: any) => {
            if (st.term?.categoryId) return d.categoryId === st.term.categoryId;
            if (st.term?.['categoryName.keyword']) {
              return d.categoryName?.toLowerCase() === st.term['categoryName.keyword']?.toLowerCase();
            }
            return false;
          });
        });
      }
    }

    // 2. Evaluate Must Query (Keyword search with scoring)
    const mustList = query?.bool?.must || [];
    let scoredDocs = docs.map((d) => ({ ...d, _score: 1.0 }));

    for (const m of mustList) {
      const mm = m.bool?.should?.[0]?.multi_match || m.multi_match;
      if (mm && mm.query) {
        const qStr = String(mm.query).toLowerCase().trim();
        const qWords = qStr.split(/\s+/).filter(Boolean);

        scoredDocs = scoredDocs
          .map((d) => {
            let score = 0;
            const nameLower = (d.name || '').toLowerCase();
            const brandLower = (d.brand || '').toLowerCase();
            const descLower = (d.description || '').toLowerCase();
            const catLower = (d.categoryName || '').toLowerCase();

            if (nameLower === qStr) score += 50;
            else if (nameLower.startsWith(qStr)) score += 30;
            else if (nameLower.includes(qStr)) score += 15;

            if (brandLower === qStr) score += 20;
            else if (brandLower.includes(qStr)) score += 10;

            for (const w of qWords) {
              if (nameLower.includes(w)) score += 8;
              if (brandLower.includes(w)) score += 5;
              if (catLower.includes(w)) score += 4;
              if (descLower.includes(w)) score += 2;
            }

            return { ...d, _score: score };
          })
          .filter((d) => d._score > 0);
      }
    }

    // 3. Compute Aggregations
    const aggregations: any = {};
    if (aggs) {
      if (aggs.categories) {
        const catMap = new Map<string, { count: number; name: string }>();
        for (const d of scoredDocs) {
          if (d.categoryId) {
            const entry = catMap.get(d.categoryId) || { count: 0, name: d.categoryName || d.categoryId };
            entry.count += 1;
            catMap.set(d.categoryId, entry);
          }
        }
        aggregations.categories = {
          buckets: Array.from(catMap.entries()).map(([key, val]) => ({
            key,
            doc_count: val.count,
            category_name: { buckets: [{ key: val.name }] },
          })),
        };
      }

      if (aggs.brands) {
        const brandMap = new Map<string, number>();
        for (const d of scoredDocs) {
          if (d.brand && d.brand.trim()) {
            brandMap.set(d.brand, (brandMap.get(d.brand) || 0) + 1);
          }
        }
        aggregations.brands = {
          buckets: Array.from(brandMap.entries()).map(([key, doc_count]) => ({
            key,
            doc_count,
          })),
        };
      }

      if (aggs.price_stats) {
        const prices = scoredDocs.map((d) => d.price).filter((p) => typeof p === 'number');
        aggregations.price_stats = {
          min: prices.length ? Math.min(...prices) : 0,
          max: prices.length ? Math.max(...prices) : 0,
          count: prices.length,
        };
      }
    }

    // 4. Sorting
    if (Array.isArray(sort) && sort.length > 0) {
      const primarySort = sort[0];
      if (primarySort.price) {
        const order = primarySort.price.order === 'desc' ? -1 : 1;
        scoredDocs.sort((a, b) => (a.price - b.price) * order);
      } else if (primarySort.createdAt) {
        const order = primarySort.createdAt.order === 'asc' ? 1 : -1;
        scoredDocs.sort(
          (a, b) =>
            (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * order
        );
      } else if (primarySort.rating) {
        const order = primarySort.rating.order === 'asc' ? 1 : -1;
        scoredDocs.sort((a, b) => ((a.rating || 0) - (b.rating || 0)) * order);
      } else if (primarySort._score) {
        scoredDocs.sort((a, b) => (b._score || 0) - (a._score || 0));
      }
    }

    const totalResults = scoredDocs.length;
    const pagedHits = scoredDocs.slice(from, from + size);

    return {
      took: 5,
      timed_out: false,
      hits: {
        total: { value: totalResults, relation: 'eq' },
        max_score: pagedHits[0]?._score || 1.0,
        hits: pagedHits.map((d) => ({
          _index: index,
          _id: d.productId || d._id,
          _score: d._score,
          _source: d,
        })),
      },
      aggregations,
    };
  }
}
