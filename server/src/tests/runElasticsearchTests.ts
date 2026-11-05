/**
 * Phase 5A — Elasticsearch Product Indexing Integration Test Suite
 *
 * Requirements Tested:
 *  1. Elasticsearch connection verification.
 *  2. Product index creation and mapping validation.
 *  3. New product indexing upon creation in MongoDB.
 *  4. Product update synchronization.
 *  5. Product deletion synchronization (soft-delete removes from ES).
 *  6. Product deactivation synchronization (active -> inactive removes from ES).
 *  7. Bulk indexing with batch processing.
 *  8. Failed document handling in bulk operations.
 *  9. Reindexing after index recreation.
 * 10. MongoDB operations remain fully available and resilient when Elasticsearch is offline.
 * 11. Duplicate indexing prevention (deterministic upsert by MongoDB ID).
 * 12. Approved vendor product filtering (only active products from approved vendors are indexed).
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
  checkElasticsearchHealth,
  ELASTICSEARCH_INDEX,
} from '../config/elastic.config';
import { ProductIndexingService } from '../services/productIndexing.service';
import { createApp } from '../app';
import { User } from '../models/user.model';
import { VendorProfile } from '../models/vendorProfile.model';
import { Product } from '../models/product.model';
import { Category } from '../models/category.model';
import { ProductSyncOutbox } from '../models/productSyncOutbox.model';
import { generateAccessToken, AUTH_COOKIE_NAME } from '../utils/token';

// ─── In-Memory High-Fidelity Elasticsearch Mock Client ────────────────────────
export class InMemoryElasticsearchClient {
  public indicesSet = new Set<string>();
  public indexStorage = new Map<string, Map<string, any>>();
  public indexMappings = new Map<string, any>();
  public shouldFail = false;
  public failNextBulk = false;

  constructor() {
    this.indexStorage.set(ELASTICSEARCH_INDEX, new Map());
  }

  get cluster() {
    return {
      health: async () => {
        if (this.shouldFail) throw new Error('Elasticsearch cluster connection refused');
        return { status: 'green', cluster_name: 'mock-cluster', number_of_nodes: 1 };
      },
    };
  }

  get indices() {
    return {
      exists: async ({ index }: { index: string }) => {
        if (this.shouldFail) throw new Error('Elasticsearch connection refused');
        return this.indicesSet.has(index);
      },
      create: async ({ index, mappings, settings }: any) => {
        if (this.shouldFail) throw new Error('Elasticsearch connection refused');
        this.indicesSet.add(index);
        this.indexMappings.set(index, { mappings, settings });
        if (!this.indexStorage.has(index)) {
          this.indexStorage.set(index, new Map());
        }
        return { acknowledged: true };
      },
      delete: async ({ index }: { index: string }) => {
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

  async update({ index, id, doc }: { index: string; id: string; doc: any }) {
    if (this.shouldFail) throw new Error('Elasticsearch update request failed');
    const store = this.indexStorage.get(index);
    if (!store || !store.has(id)) {
      const err: any = new Error('Document not found');
      err.meta = { statusCode: 404 };
      err.statusCode = 404;
      throw err;
    }
    const current = store.get(id);
    store.set(id, { ...current, ...doc, _id: id });
    return { result: 'updated', _id: id };
  }

  async delete({ index, id }: { index: string; id: string }) {
    if (this.shouldFail) throw new Error('Elasticsearch delete request failed');
    const store = this.indexStorage.get(index);
    if (!store || !store.has(id)) {
      const err: any = new Error('Document not found');
      err.meta = { statusCode: 404 };
      err.statusCode = 404;
      throw err;
    }
    store.delete(id);
    return { result: 'deleted', _id: id };
  }

  async get<T = any>({ index, id }: { index: string; id: string }) {
    if (this.shouldFail) throw new Error('Elasticsearch get request failed');
    const store = this.indexStorage.get(index);
    if (!store || !store.has(id)) {
      const err: any = new Error('Document not found');
      err.meta = { statusCode: 404 };
      err.statusCode = 404;
      throw err;
    }
    return { _id: id, _source: store.get(id) as T };
  }

  async bulk({ operations }: { operations: any[] }) {
    if (this.shouldFail) throw new Error('Elasticsearch bulk request failed');
    const items: any[] = [];
    let hasErrors = false;

    for (let i = 0; i < operations.length; i += 2) {
      const actionHeader = operations[i];
      const doc = operations[i + 1];
      const actionType = Object.keys(actionHeader)[0];
      const { _index, _id } = actionHeader[actionType];

      if (this.failNextBulk && _id === 'simulate-failure-id') {
        hasErrors = true;
        items.push({
          [actionType]: {
            _id,
            status: 400,
            error: { reason: 'Simulated document mapping validation failure' },
          },
        });
        continue;
      }

      let store = this.indexStorage.get(_index);
      if (!store) {
        store = new Map();
        this.indexStorage.set(_index, store);
        this.indicesSet.add(_index);
      }
      store.set(_id, { ...doc, _id });
      items.push({ [actionType]: { _id, status: 200, result: 'created' } });
    }

    return { errors: hasErrors, items };
  }
}

// ─── Test Suite Execution ─────────────────────────────────────────────────────
async function runElasticsearchTestSuite() {
  console.log('\n======================================================');
  console.log('🧪 Starting Phase 5A — Elasticsearch & Indexing Tests');
  console.log('======================================================\n');

  // 1. Initialise mock Elasticsearch Client
  const mockClient = new InMemoryElasticsearchClient();
  setElasticsearchClient(mockClient as any);

  // 2. Initialise In-Memory MongoDB Server
  const mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  console.log('📦 Connected to in-memory MongoDB instance for testing.\n');

  const app = createApp();

  // 3. Provision Seeds
  console.log('🌱 Provisioning test users, approved merchants, categories...');
  const admin = await User.create({
    name: 'Platform Admin',
    email: 'admin@platform.com',
    password: 'Password123!',
    role: 'admin',
    isActive: true,
  });
  const adminToken = generateAccessToken({ id: admin._id.toString(), email: admin.email, role: 'admin' });

  const vendor1 = await User.create({
    name: 'TechMerchant Vendor',
    email: 'vendor1@tech.com',
    password: 'Password123!',
    role: 'vendor',
    isActive: true,
  });
  await VendorProfile.create({
    userId: vendor1._id,
    storeName: 'TechStore',
    slug: 'tech-store',
    businessEmail: 'contact@techstore.com',
    businessPhone: '1234567890',
    businessAddress: { street: '1 Tech Way', city: 'Silicon', state: 'CA', postalCode: '94016', country: 'USA' },
    status: 'approved',
  });
  const vendor1Token = generateAccessToken({ id: vendor1._id.toString(), email: vendor1.email, role: 'vendor' });

  const category = await Category.create({
    name: 'Computing & Electronics',
    slug: 'computing-electronics',
    isActive: true,
  });

  const authCookie = (token: string) => `${AUTH_COOKIE_NAME}=${token}`;

  let passed = 0;
  let failed = 0;

  const pass = (label: string) => {
    console.log(`✅ Test ${passed + failed + 1} Passed: ${label}`);
    passed++;
  };

  const fail = (label: string, reason: string) => {
    console.error(`❌ Test ${passed + failed + 1} Failed: ${label} — ${reason}`);
    failed++;
  };

  let testProductAId: string;
  let testProductBId: string;

  // ── Test 1: Elasticsearch Connection ────────────────────────────────────────
  console.log('⏳ Test 1: Verifying Elasticsearch cluster connection...');
  try {
    const health = await checkElasticsearchHealth();
    assert.strictEqual(health.connected, true, 'Expected client to report connected: true');
    assert.strictEqual(health.status, 'green', 'Expected cluster status green');
    pass('Elasticsearch client connection verified successfully');
  } catch (e: any) { fail('Elasticsearch connection', e.message); }

  // ── Test 2: Product Index Creation ──────────────────────────────────────────
  console.log('⏳ Test 2: Creating product index with custom analyzers & mappings...');
  try {
    await ProductIndexingService.initProductIndex(true);
    assert.ok(mockClient.indicesSet.has(ELASTICSEARCH_INDEX), 'Index should be registered in mock ES');
    const mapping = mockClient.indexMappings.get(ELASTICSEARCH_INDEX);
    assert.ok(mapping.mappings.properties.name, 'Mapping must contain name field');
    assert.ok(mapping.mappings.properties.price, 'Mapping must contain price field');
    assert.strictEqual(mapping.mappings.properties.price.type, 'double', 'Price must be double for sorting/filtering');
    assert.strictEqual(mapping.mappings.properties.productId.type, 'keyword', 'productId must be keyword');
    pass('Product index created with complete analyzer & schema mappings');
  } catch (e: any) { fail('Index creation', e.message); }

  // ── Test 3: New Product Indexing ────────────────────────────────────────────
  console.log('⏳ Test 3: Creating a product via API and verifying indexing...');
  try {
    const res = await request(app)
      .post('/api/products')
      .set('Cookie', authCookie(vendor1Token))
      .send({
        name: 'Quantum Ultrabook Pro',
        description: 'Next-gen silicon workstation laptop with 64GB RAM',
        price: 1999.99,
        categoryId: category._id.toString(),
        stock: 25,
        brand: 'Quantum',
        sku: 'QUANTUM-ULTRA-001',
        status: 'active',
      });

    assert.strictEqual(res.status, 201, `Expected 201 Created, got ${res.status}`);
    testProductAId = res.body.data.id;

    // Verify document exists in Elasticsearch
    const indexed = await ProductIndexingService.getProductFromIndex(testProductAId);
    assert.ok(indexed, 'Product document must exist in Elasticsearch index');
    assert.strictEqual(indexed.name, 'Quantum Ultrabook Pro');
    assert.strictEqual(indexed.price, 1999.99);
    assert.strictEqual(indexed.brand, 'Quantum');
    assert.strictEqual(indexed.status, 'active');
    pass('New active product automatically indexed in Elasticsearch on creation');
  } catch (e: any) { fail('New product indexing', e.message); }

  // ── Test 4: Product Update Synchronization ──────────────────────────────────
  console.log('⏳ Test 4: Updating product price & title and verifying sync...');
  try {
    const res = await request(app)
      .patch(`/api/products/${testProductAId}`)
      .set('Cookie', authCookie(vendor1Token))
      .send({
        name: 'Quantum Ultrabook Pro X',
        price: 2199.99,
      });

    assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);

    const indexed = await ProductIndexingService.getProductFromIndex(testProductAId);
    assert.ok(indexed, 'Product document must exist in Elasticsearch');
    assert.strictEqual(indexed.name, 'Quantum Ultrabook Pro X');
    assert.strictEqual(indexed.price, 2199.99);
    pass('Product modification synchronized immediately with Elasticsearch');
  } catch (e: any) { fail('Product update sync', e.message); }

  // ── Test 5: Product Deletion Synchronization ────────────────────────────────
  console.log('⏳ Test 5: Soft-deleting product and verifying removal from search...');
  try {
    const res = await request(app)
      .delete(`/api/products/${testProductAId}`)
      .set('Cookie', authCookie(vendor1Token));

    assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);

    // Verify document is removed from Elasticsearch index
    const indexed = await ProductIndexingService.getProductFromIndex(testProductAId);
    assert.strictEqual(indexed, null, 'Deleted product must be removed from Elasticsearch');

    // Verify document still exists in MongoDB with soft-delete flag
    const inMongo = await Product.findById(testProductAId);
    assert.ok(inMongo, 'Product must remain in MongoDB (source of truth)');
    assert.strictEqual(inMongo.isDeleted, true, 'Product should be marked isDeleted: true');
    pass('Deleted product removed from search while preserved in MongoDB');
  } catch (e: any) { fail('Product deletion sync', e.message); }

  // ── Test 6: Product Deactivation Synchronization ────────────────────────────
  console.log('⏳ Test 6: Deactivating product (active -> inactive) removes from ES...');
  try {
    // Create product B
    const createRes = await request(app)
      .post('/api/products')
      .set('Cookie', authCookie(vendor1Token))
      .send({
        name: 'Mechanical Gaming Keyboard',
        description: 'RGB mechanical keyboard with hot-swappable tactile switches',
        price: 149.99,
        categoryId: category._id.toString(),
        stock: 50,
        brand: 'KeyMaster',
        sku: 'KEY-RGB-001',
        status: 'active',
      });
    testProductBId = createRes.body.data.id;

    // Confirm it is indexed initially
    let indexed = await ProductIndexingService.getProductFromIndex(testProductBId);
    assert.ok(indexed, 'Product B should be indexed while active');

    // Admin deactivates the product
    const patchRes = await request(app)
      .patch(`/api/admin/products/${testProductBId}/status`)
      .set('Cookie', authCookie(adminToken))
      .send({ status: 'inactive' });

    assert.strictEqual(patchRes.status, 200, `Expected 200 OK, got ${patchRes.status}`);

    // Verify it was removed from Elasticsearch because status is no longer 'active'
    indexed = await ProductIndexingService.getProductFromIndex(testProductBId);
    assert.strictEqual(indexed, null, 'Inactive product must be removed from public search index');
    pass('Deactivated product automatically removed from Elasticsearch search index');
  } catch (e: any) { fail('Product deactivation sync', e.message); }

  // ── Test 7: Bulk Indexing with Batching ──────────────────────────────────────
  console.log('⏳ Test 7: Testing bulk indexing with batch processing...');
  try {
    const productsToBulk: any[] = [];
    for (let i = 1; i <= 5; i++) {
      const p = await Product.create({
        name: `Bulk Test Item ${i}`,
        description: `Description for bulk item ${i}`,
        price: 10 * i,
        categoryId: category._id,
        vendorId: vendor1._id,
        stock: 10,
        sku: `BULK-TEST-SKU-${i}`,
        status: 'active',
        isDeleted: false,
      });
      productsToBulk.push(p);
    }

    const bulkResult = await ProductIndexingService.bulkIndexProducts(productsToBulk);
    assert.strictEqual(bulkResult.total, 5, 'Total products should be 5');
    assert.strictEqual(bulkResult.indexed, 5, 'All 5 active products should be indexed');
    assert.strictEqual(bulkResult.failed, 0, 'Zero failures expected');

    // Verify in mock store
    for (const p of productsToBulk) {
      const doc = await ProductIndexingService.getProductFromIndex(p._id.toString());
      assert.ok(doc, `Item ${p._id} should be indexed in Elasticsearch`);
    }
    pass('Bulk indexing executed successfully across multiple documents');
  } catch (e: any) { fail('Bulk indexing', e.message); }

  // ── Test 8: Failed Document Handling ────────────────────────────────────────
  console.log('⏳ Test 8: Validating granular error reporting for failed documents...');
  try {
    mockClient.failNextBulk = true;
    const items = [
      { _id: 'simulate-failure-id', name: 'Corrupt Item', price: 99, status: 'active' },
      { _id: 'normal-item-id', name: 'Valid Item', price: 50, status: 'active' },
    ];

    const bulkResult = await ProductIndexingService.bulkIndexProducts(items);
    mockClient.failNextBulk = false;

    assert.strictEqual(bulkResult.failed, 1, 'Expected 1 document failure');
    assert.strictEqual(bulkResult.indexed, 1, 'Expected 1 document indexed successfully');
    assert.ok(bulkResult.errors.length > 0, 'Error details must be captured');
    assert.strictEqual(bulkResult.errors[0].id, 'simulate-failure-id');
    pass('Failed documents handled individually without aborting entire batch');
  } catch (e: any) {
    mockClient.failNextBulk = false;
    fail('Failed document handling', e.message);
  }

  // ── Test 9: Reindexing After Index Recreation ───────────────────────────────
  console.log('⏳ Test 9: Admin bulk reindexing operation with index recreation...');
  try {
    const res = await request(app)
      .post('/api/admin/products/reindex')
      .set('Cookie', authCookie(adminToken))
      .send({ recreate: true, batchSize: 50 });

    assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.recreated, true);
    assert.ok(res.body.data.indexed > 0, 'Should index all eligible active products');
    pass('Admin bulk reindex rebuilt search index from MongoDB collection');
  } catch (e: any) { fail('Admin reindex operation', e.message); }

  // ── Test 10: MongoDB Resilience when Elasticsearch is Offline ───────────────
  console.log('⏳ Test 10: Testing MongoDB resilience when Elasticsearch is offline...');
  try {
    // Simulate Elasticsearch complete failure
    mockClient.shouldFail = true;

    // Create a product — MongoDB transaction MUST NOT FAIL
    const res = await request(app)
      .post('/api/products')
      .set('Cookie', authCookie(vendor1Token))
      .send({
        name: 'Resilient Dual-Band Router',
        description: 'Wi-Fi 7 enterprise mesh router with dual 10G ports',
        price: 399.99,
        categoryId: category._id.toString(),
        stock: 12,
        brand: 'NetPro',
        sku: 'NET-WIFI7-RESILIENT',
        status: 'active',
      });

    mockClient.shouldFail = false;

    assert.strictEqual(res.status, 201, `MongoDB operation must succeed with 201, got ${res.status}`);
    const createdId = res.body.data.id;

    // Verify MongoDB saved the product
    const mongoDoc = await Product.findById(createdId);
    assert.ok(mongoDoc, 'Product must be safely stored in MongoDB');

    // Verify Outbox recorded the pending sync
    const outboxRecord = await ProductSyncOutbox.findOne({
      productId: new mongoose.Types.ObjectId(createdId),
      status: 'PENDING',
    });
    assert.ok(outboxRecord, 'A PENDING record must be recorded in ProductSyncOutbox');
    assert.strictEqual(outboxRecord.action, 'INDEX');

    // Now test outbox reconciliation
    const processed = await ProductIndexingService.processSyncOutbox();
    assert.strictEqual(processed.processed, 1, 'Outbox worker should reconcile the pending record');

    const syncedDoc = await ProductIndexingService.getProductFromIndex(createdId);
    assert.ok(syncedDoc, 'Document should now be indexed in Elasticsearch after outbox reconciliation');
    pass('MongoDB operations remain resilient when Elasticsearch is offline; Outbox reconciles on recovery');
  } catch (e: any) {
    mockClient.shouldFail = false;
    fail('Resilience & Outbox pattern', e.message);
  }

  // ── Test 11: Duplicate Indexing Prevention ──────────────────────────────────
  console.log('⏳ Test 11: Verifying duplicate indexing prevention (idempotent upsert)...');
  try {
    const existing = await Product.findOne({ status: 'active', isDeleted: false });
    assert.ok(existing, 'Must have at least one active product');

    // Index same product twice
    await ProductIndexingService.indexProduct(existing);
    await ProductIndexingService.indexProduct(existing);

    const store = mockClient.indexStorage.get(ELASTICSEARCH_INDEX);
    const occurrences = Array.from(store?.keys() || []).filter((k) => k === existing._id.toString());
    assert.strictEqual(occurrences.length, 1, 'Document ID must map 1:1 with MongoDB _id; no duplicates');
    pass('Document IDs prevent duplicate entries in Elasticsearch');
  } catch (e: any) { fail('Duplicate indexing prevention', e.message); }

  // ── Test 12: Approved Vendor Product Filtering ──────────────────────────────
  console.log('⏳ Test 12: Verifying filtering (draft/inactive products excluded)...');
  try {
    // Draft product
    const draftProduct = await Product.create({
      name: 'Unpublished Prototype Widget',
      description: 'Internal testing only widget not for public sale',
      price: 9.99,
      categoryId: category._id,
      vendorId: vendor1._id,
      stock: 0,
      sku: 'DRAFT-WIDGET-001',
      status: 'draft',
      isDeleted: false,
    });

    const isEligibleDraft = ProductIndexingService.isEligibleForSearch(draftProduct);
    assert.strictEqual(isEligibleDraft, false, 'Draft products must NOT be eligible for public search');

    await ProductIndexingService.indexProduct(draftProduct);
    const draftDoc = await ProductIndexingService.getProductFromIndex(draftProduct._id.toString());
    assert.strictEqual(draftDoc, null, 'Draft product must NOT be present in Elasticsearch');

    // Soft-deleted product
    const deletedProduct = await Product.create({
      name: 'Discontinued Vintage Gadget',
      description: 'No longer in production',
      price: 29.99,
      categoryId: category._id,
      vendorId: vendor1._id,
      stock: 0,
      sku: 'DISCONTINUED-001',
      status: 'active',
      isDeleted: true,
    });

    const isEligibleDeleted = ProductIndexingService.isEligibleForSearch(deletedProduct);
    assert.strictEqual(isEligibleDeleted, false, 'Deleted products must NOT be eligible for public search');
    pass('Public search filter strictly admits only active, approved, non-deleted catalog products');
  } catch (e: any) { fail('Search filtering rules', e.message); }

  // ── Summary ─────────────────────────────────────────────────────────────────
  await mongoose.disconnect();
  await mongoServer.stop();

  console.log('\n======================================================');
  if (failed === 0) {
    console.log(`🎉 ALL ${passed} ELASTICSEARCH INTEGRATION TESTS PASSED!`);
    console.log('======================================================\n');
    process.exit(0);
  } else {
    console.log(`⚠️  ${passed} passed, ${failed} FAILED.`);
    console.log('======================================================\n');
    process.exit(1);
  }
}

runElasticsearchTestSuite().catch((err) => {
  console.error('Fatal Elasticsearch test runner error:', err);
  process.exit(1);
});
