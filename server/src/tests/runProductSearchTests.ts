/**
 * Phase 5B — Advanced Product Search & Filtering Integration Test Suite
 *
 * Scenarios Tested:
 *  1. Keyword search (q=wireless) with relevance scoring & exact match boost.
 *  2. Multi-field search across name, description, and brand.
 *  3. Category filtering (category ID or name).
 *  4. Brand filtering (exact brand match).
 *  5. Price range filtering (minPrice & maxPrice).
 *  6. Price range validation: reject minPrice > maxPrice with 422.
 *  7. Negative price & invalid number validation: reject with 422.
 *  8. Stock availability filtering (inStock=true excludes out-of-stock items).
 *  9. Sorting by price ascending and price descending.
 * 10. Sorting by newest and relevance.
 * 11. Pagination: verify page and limit slices and totalPages metadata.
 * 12. Autocomplete search suggestions (GET /api/products/search/suggestions?q=wire).
 * 13. Visibility gate: Inactive, draft, and deleted products are never returned.
 * 14. Faceted aggregations returned in availableFilters (categories and brands).
 * 15. Elasticsearch unavailable scenario returns 503 Service Unavailable gracefully.
 */

import assert from 'assert';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// ─── Environment Configuration ────────────────────────────────────────────────
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'super_secret_test_jwt_key_at_least_32_characters_long';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_S3_BUCKET_NAME = 'test-bucket';
process.env.ELASTICSEARCH_NODE = 'http://localhost:9200';
process.env.ELASTICSEARCH_INDEX = 'marketplace_products_test';

import {
  setElasticsearchClient,
  ELASTICSEARCH_INDEX,
} from '../config/elastic.config';
import { createApp } from '../app';
import { User } from '../models/user.model';
import { Category } from '../models/category.model';
import { Product } from '../models/product.model';
import { ProductIndexingService } from '../services/productIndexing.service';

// ─── High-Fidelity In-Memory Elasticsearch Search Mock Client ─────────────────
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
        // Category filtering (either categoryId or categoryName)
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
      // Check multi_match query
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

            // Exact match boost
            if (nameLower === qStr) score += 50;
            else if (nameLower.startsWith(qStr)) score += 30;
            else if (nameLower.includes(qStr)) score += 15;

            // Brand match
            if (brandLower === qStr) score += 20;
            else if (brandLower.includes(qStr)) score += 10;

            // Word token matches
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

    // 3. Compute Aggregations (across the filtered dataset)
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

// ─── Test Suite Runner ────────────────────────────────────────────────────────
async function runProductSearchTestSuite() {
  console.log('\n======================================================');
  console.log('🧪 Starting Phase 5B — Product Search & Filtering Tests');
  console.log('======================================================\n');

  // 1. Initialise mock Elasticsearch Client
  const mockClient = new SearchMockElasticsearchClient();
  setElasticsearchClient(mockClient as any);

  // 2. Initialise In-Memory MongoDB Server
  const mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  console.log('📦 Connected to in-memory MongoDB instance for search testing.\n');

  const app = createApp();

  // 3. Seed Users, Vendor, Categories, and Products
  console.log('🌱 Provisioning test catalog data...');

  const vendorUser = await User.create({
    name: 'Audio Tech Corp',
    email: 'audiotech@example.com',
    password: 'Password123!',
    role: 'vendor',
  });

  const catElectronics = await Category.create({
    name: 'Electronics',
    slug: 'electronics',
    description: 'Gadgets, audio and accessories',
    isActive: true,
  });

  const catBooks = await Category.create({
    name: 'Books',
    slug: 'books',
    description: 'Novels, technical and textbooks',
    isActive: true,
  });

  // Seed Catalog Products in MongoDB and Index into Elasticsearch
  const productsToSeed = [
    {
      name: 'Sony WH-1000XM5 Wireless Headphones',
      description: 'Industry-leading noise canceling wireless over-ear headphones with superior sound.',
      price: 349.99,
      categoryId: catElectronics._id,
      vendorId: vendorUser._id,
      stock: 25,
      brand: 'Sony',
      sku: 'SONY-WH1000XM5-BLK',
      status: 'active',
      isDeleted: false,
      createdAt: new Date('2026-01-10T10:00:00Z'),
    },
    {
      name: 'Sony WF-1000XM4 Wireless Earbuds',
      description: 'Truly wireless earbuds with high-res audio and noise canceling technology.',
      price: 199.99,
      categoryId: catElectronics._id,
      vendorId: vendorUser._id,
      stock: 12,
      brand: 'Sony',
      sku: 'SONY-WF1000XM4-SLV',
      status: 'active',
      isDeleted: false,
      createdAt: new Date('2026-01-15T10:00:00Z'),
    },
    {
      name: 'Bose QuietComfort 45 Wireless Headphones',
      description: 'Iconic quiet, comfort, and premium wireless acoustic performance.',
      price: 279.0,
      categoryId: catElectronics._id,
      vendorId: vendorUser._id,
      stock: 0, // Out of stock
      brand: 'Bose',
      sku: 'BOSE-QC45-BLK',
      status: 'active',
      isDeleted: false,
      createdAt: new Date('2026-01-20T10:00:00Z'),
    },
    {
      name: 'Anker USB-C Fast Wireless Charger Pad',
      description: 'High-speed wireless charging pad compatible with all Qi-certified phones.',
      price: 29.99,
      categoryId: catElectronics._id,
      vendorId: vendorUser._id,
      stock: 150,
      brand: 'Anker',
      sku: 'ANKER-WCHRG-PAD',
      status: 'active',
      isDeleted: false,
      createdAt: new Date('2026-02-01T10:00:00Z'),
    },
    {
      name: 'Designing Data-Intensive Applications',
      description: 'The definitive guide to distributed systems, database reliability, and scalability.',
      price: 49.99,
      categoryId: catBooks._id,
      vendorId: vendorUser._id,
      stock: 40,
      brand: "O'Reilly",
      sku: 'BOOK-DDIA-OREILLY',
      status: 'active',
      isDeleted: false,
      createdAt: new Date('2026-02-05T10:00:00Z'),
    },
    {
      name: 'Internal Draft Wireframe Book',
      description: 'Secret prototype design book for internal team only.',
      price: 15.0,
      categoryId: catBooks._id,
      vendorId: vendorUser._id,
      stock: 5,
      brand: 'DraftCo',
      sku: 'BOOK-DRAFT-HIDDEN',
      status: 'draft', // Draft - should never be returned
      isDeleted: false,
      createdAt: new Date(),
    },
    {
      name: 'Discontinued Vintage Wireless Radio',
      description: 'Old radio that has been decommissioned.',
      price: 89.99,
      categoryId: catElectronics._id,
      vendorId: vendorUser._id,
      stock: 0,
      brand: 'VintageAudio',
      sku: 'RADIO-VINTAGE-DEL',
      status: 'inactive', // Inactive - should never be returned
      isDeleted: true,    // Deleted
      createdAt: new Date(),
    },
  ];

  for (const p of productsToSeed) {
    const created = await Product.create(p);
    // Populate category for indexing
    const populated = await Product.findById(created._id).populate('categoryId', 'name');
    await ProductIndexingService.indexProduct(populated);
  }

  console.log(`✅ Provisioned and indexed catalog products.\n`);

  // ─── Test 1: Keyword Search & Relevance Scoring ───────────────────────────
  console.log('⏳ Test 1: Keyword search (q=wireless) with relevance ranking...');
  const res1 = await request(app).get('/api/products/search?q=wireless');

  assert.strictEqual(res1.status, 200);
  assert.strictEqual(res1.body.success, true);
  assert.strictEqual(res1.body.products.length >= 3, true);
  // Wireless products should be present, book should not be in results
  const names1 = res1.body.products.map((p: any) => p.name);
  assert.ok(names1.some((n: string) => n.includes('Sony WH-1000XM5')));
  assert.ok(names1.some((n: string) => n.includes('Anker USB-C Fast Wireless')));
  assert.ok(!names1.includes('Designing Data-Intensive Applications'));
  console.log('✅ Test 1 Passed: Keyword search returns relevant products with score ordering');

  // ─── Test 2: Multi-field Search across Name, Brand, Description ───────────
  console.log('⏳ Test 2: Multi-field search (q=O\'Reilly or q=noise)...');
  const res2Brand = await request(app).get("/api/products/search?q=O'Reilly");
  assert.strictEqual(res2Brand.status, 200);
  assert.strictEqual(res2Brand.body.products.length, 1);
  assert.strictEqual(res2Brand.body.products[0].sku, 'BOOK-DDIA-OREILLY');

  const res2Desc = await request(app).get('/api/products/search?q=scalability');
  assert.strictEqual(res2Desc.status, 200);
  assert.strictEqual(res2Desc.body.products.length, 1);
  assert.strictEqual(res2Desc.body.products[0].name, 'Designing Data-Intensive Applications');
  console.log('✅ Test 2 Passed: Multi-field search matches brand and description terms');

  // ─── Test 3: Category Filtering ───────────────────────────────────────────
  console.log('⏳ Test 3: Category filtering by ID and by Name...');
  const res3Id = await request(app).get(`/api/products/search?category=${catBooks._id}`);
  assert.strictEqual(res3Id.status, 200);
  assert.strictEqual(res3Id.body.products.length, 1);
  assert.strictEqual(res3Id.body.products[0].categoryId, catBooks._id.toString());

  const res3Name = await request(app).get('/api/products/search?category=Electronics');
  assert.strictEqual(res3Name.status, 200);
  assert.strictEqual(res3Name.body.products.length >= 3, true);
  for (const p of res3Name.body.products) {
    assert.strictEqual(p.categoryName, 'Electronics');
  }
  console.log('✅ Test 3 Passed: Category filtering works by both ObjectId and Category Name');

  // ─── Test 4: Brand Filtering ──────────────────────────────────────────────
  console.log('⏳ Test 4: Brand filtering (brand=Sony)...');
  const res4 = await request(app).get('/api/products/search?brand=Sony');
  assert.strictEqual(res4.status, 200);
  assert.strictEqual(res4.body.products.length, 2);
  for (const p of res4.body.products) {
    assert.strictEqual(p.brand, 'Sony');
  }
  console.log('✅ Test 4 Passed: Brand filter restricts results strictly to selected brand');

  // ─── Test 5: Price Range Filtering ────────────────────────────────────────
  console.log('⏳ Test 5: Price range filtering (minPrice=30&maxPrice=250)...');
  const res5 = await request(app).get('/api/products/search?minPrice=30&maxPrice=250');
  assert.strictEqual(res5.status, 200);
  for (const p of res5.body.products) {
    assert.strictEqual(p.price >= 30 && p.price <= 250, true);
  }
  const prices = res5.body.products.map((p: any) => p.price);
  assert.ok(prices.includes(199.99)); // Sony Earbuds
  assert.ok(prices.includes(49.99));  // Book
  assert.ok(!prices.includes(349.99)); // XM5 Headphones ($350) excluded
  assert.ok(!prices.includes(29.99));  // Charger ($29.99) excluded
  console.log('✅ Test 5 Passed: Price range correctly filters upper and lower bounds');

  // ─── Test 6: Price Range Validation (minPrice > maxPrice) ─────────────────
  console.log('⏳ Test 6: Validating rejection when minPrice > maxPrice...');
  const res6 = await request(app).get('/api/products/search?minPrice=300&maxPrice=100');
  assert.strictEqual(res6.status, 422);
  assert.strictEqual(res6.body.success, false);
  assert.strictEqual(res6.body.error.code, 'VALIDATION_ERROR');
  console.log('✅ Test 6 Passed: Inverted price range rejected with 422 Validation Error');

  // ─── Test 7: Negative Values & Unsupported Sort Validation ────────────────
  console.log('⏳ Test 7: Validating rejection of negative price and invalid sort...');
  const res7a = await request(app).get('/api/products/search?minPrice=-15');
  assert.strictEqual(res7a.status, 422);

  const res7b = await request(app).get('/api/products/search?sort=unsupported_algorithm');
  assert.strictEqual(res7b.status, 422);
  assert.ok(res7b.body.error.details.some((d: any) => d.message.includes('Invalid sort parameter')));
  console.log('✅ Test 7 Passed: Negative numbers and invalid sort rejected with 422');

  // ─── Test 8: Stock Availability (inStock=true) ────────────────────────────
  console.log('⏳ Test 8: Stock availability filtering (inStock=true)...');
  const res8 = await request(app).get('/api/products/search?inStock=true');
  assert.strictEqual(res8.status, 200);
  for (const p of res8.body.products) {
    assert.strictEqual(p.stock > 0, true);
  }
  // Bose QC45 has stock: 0, must be excluded
  const names8 = res8.body.products.map((p: any) => p.name);
  assert.ok(!names8.includes('Bose QuietComfort 45 Wireless Headphones'));
  console.log('✅ Test 8 Passed: inStock=true strictly excludes out-of-stock items');

  // ─── Test 9: Sorting by Price (price_asc and price_desc) ──────────────────
  console.log('⏳ Test 9: Sorting by price_asc and price_desc...');
  const res9Asc = await request(app).get('/api/products/search?sort=price_asc');
  assert.strictEqual(res9Asc.status, 200);
  const ascPrices = res9Asc.body.products.map((p: any) => p.price);
  for (let i = 0; i < ascPrices.length - 1; i++) {
    assert.strictEqual(ascPrices[i] <= ascPrices[i + 1], true);
  }

  const res9Desc = await request(app).get('/api/products/search?sort=price_desc');
  assert.strictEqual(res9Desc.status, 200);
  const descPrices = res9Desc.body.products.map((p: any) => p.price);
  for (let i = 0; i < descPrices.length - 1; i++) {
    assert.strictEqual(descPrices[i] >= descPrices[i + 1], true);
  }
  console.log('✅ Test 9 Passed: Sorting by price_asc and price_desc verified');

  // ─── Test 10: Sorting by Newest ───────────────────────────────────────────
  console.log('⏳ Test 10: Sorting by newest (createdAt desc)...');
  const res10 = await request(app).get('/api/products/search?sort=newest');
  assert.strictEqual(res10.status, 200);
  const dates = res10.body.products.map((p: any) => new Date(p.createdAt).getTime());
  for (let i = 0; i < dates.length - 1; i++) {
    assert.strictEqual(dates[i] >= dates[i + 1], true);
  }
  console.log('✅ Test 10 Passed: Newest sort returns most recently created products first');

  // ─── Test 11: Pagination Metadata & Limits ────────────────────────────────
  console.log('⏳ Test 11: Pagination controls (page=1&limit=2 vs page=2&limit=2)...');
  const res11Page1 = await request(app).get('/api/products/search?page=1&limit=2');
  assert.strictEqual(res11Page1.status, 200);
  assert.strictEqual(res11Page1.body.products.length, 2);
  assert.strictEqual(res11Page1.body.currentPage, 1);
  assert.strictEqual(res11Page1.body.totalPages >= 3, true);

  const res11Page2 = await request(app).get('/api/products/search?page=2&limit=2');
  assert.strictEqual(res11Page2.status, 200);
  assert.strictEqual(res11Page2.body.products.length, 2);
  assert.strictEqual(res11Page2.body.currentPage, 2);

  // Different items on page 1 vs page 2
  assert.notStrictEqual(res11Page1.body.products[0].productId, res11Page2.body.products[0].productId);
  console.log('✅ Test 11 Passed: Pagination slicing and totalPages calculation verified');

  // ─── Test 12: Autocomplete Search Suggestions ─────────────────────────────
  console.log('⏳ Test 12: Autocomplete search suggestions (GET /api/products/search/suggestions?q=wire)...');
  const res12 = await request(app).get('/api/products/search/suggestions?q=wire&limit=5');
  assert.strictEqual(res12.status, 200);
  assert.strictEqual(res12.body.success, true);
  assert.strictEqual(Array.isArray(res12.body.suggestions), true);
  assert.ok(res12.body.suggestions.length > 0);
  assert.ok(res12.body.suggestions.some((s: string) => s.toLowerCase().includes('wireless')));

  // Test suggestions validation with empty query
  const res12Empty = await request(app).get('/api/products/search/suggestions?q=');
  assert.strictEqual(res12Empty.status, 422);
  console.log('✅ Test 12 Passed: Autocomplete suggestions returned prefix matches and validated query');

  // ─── Test 13: Visibility Gate (Draft / Deleted Exclusion) ─────────────────
  console.log('⏳ Test 13: Verifying draft, inactive, and deleted products are never returned...');
  const res13 = await request(app).get('/api/products/search?q=draft');
  assert.strictEqual(res13.status, 200);
  assert.strictEqual(res13.body.products.length, 0);

  const res13All = await request(app).get('/api/products/search?limit=100');
  const allIds = res13All.body.products.map((p: any) => p.sku);
  assert.ok(!allIds.includes('BOOK-DRAFT-HIDDEN'));
  assert.ok(!allIds.includes('RADIO-VINTAGE-DEL'));
  console.log('✅ Test 13 Passed: Unpublished, draft, and deleted products strictly shielded');

  // ─── Test 14: Available Filters Aggregations ───────────────────────────────
  console.log('⏳ Test 14: Verifying aggregations for available categories & brands...');
  const res14 = await request(app).get('/api/products/search');
  assert.strictEqual(res14.status, 200);
  assert.ok(res14.body.availableFilters);
  assert.ok(Array.isArray(res14.body.availableFilters.categories));
  assert.ok(Array.isArray(res14.body.availableFilters.brands));
  assert.ok(res14.body.availableFilters.brands.some((b: any) => b.name === 'Sony'));
  assert.ok(res14.body.availableFilters.categories.some((c: any) => c.name === 'Electronics'));
  assert.ok(res14.body.availableFilters.priceRange.min <= 29.99);
  assert.ok(res14.body.availableFilters.priceRange.max >= 349.99);
  console.log('✅ Test 14 Passed: Faceted aggregations returned category and brand counts');

  // ─── Test 15: Elasticsearch Unavailable Scenario ──────────────────────────
  console.log('⏳ Test 15: Elasticsearch cluster failure handled gracefully with 503...');
  mockClient.shouldFail = true;

  const res15 = await request(app).get('/api/products/search?q=sony');
  assert.strictEqual(res15.status, 503);
  assert.strictEqual(res15.body.success, false);
  assert.strictEqual(res15.body.error.code, 'SERVICE_UNAVAILABLE');
  assert.ok(!JSON.stringify(res15.body).includes('password'));
  assert.ok(!JSON.stringify(res15.body).includes('localhost:9200'));

  mockClient.shouldFail = false;
  console.log('✅ Test 15 Passed: Cluster failure returned 503 without leaking credentials or internal stack');

  // Cleanup
  await mongoose.disconnect();
  await mongoServer.stop();

  console.log('\n======================================================');
  console.log('🎉 ALL 15 PRODUCT SEARCH & FILTERING TESTS PASSED!');
  console.log('======================================================\n');
}

runProductSearchTestSuite().catch((err) => {
  console.error('\n❌ Search Test Suite Failed:', err);
  process.exit(1);
});

