import { Types } from 'mongoose';
import { getElasticsearchClient, ELASTICSEARCH_INDEX } from '../config/elastic.config';
import { Product, IProduct } from '../models/product.model';
import { ProductSyncOutbox } from '../models/productSyncOutbox.model';
import { logger } from '../utils/logger';

export interface IndexedProductDocument {
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

export interface BulkIndexResult {
  total: number;
  indexed: number;
  skipped: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

export interface ReindexReport {
  success: boolean;
  index: string;
  recreated: boolean;
  totalProcessed: number;
  indexed: number;
  skipped: number;
  failed: number;
  durationMs: number;
  errors: Array<{ id: string; error: string }>;
}

export class ProductIndexingService {
  /**
   * Product Search Index Mapping & Settings Definition
   */
  static readonly INDEX_MAPPING = {
    settings: {
      number_of_shards: 1,
      number_of_replicas: 0,
      analysis: {
        analyzer: {
          product_search_analyzer: {
            type: 'custom',
            tokenizer: 'standard',
            filter: ['lowercase', 'asciifolding'],
          },
        },
      },
    },
    mappings: {
      properties: {
        productId: { type: 'keyword' },
        name: {
          type: 'text',
          analyzer: 'product_search_analyzer',
          fields: {
            keyword: { type: 'keyword', ignore_above: 256 },
          },
        },
        description: {
          type: 'text',
          analyzer: 'product_search_analyzer',
        },
        brand: {
          type: 'keyword',
          fields: {
            text: { type: 'text', analyzer: 'product_search_analyzer' },
          },
        },
        categoryId: { type: 'keyword' },
        categoryName: {
          type: 'text',
          fields: {
            keyword: { type: 'keyword', ignore_above: 256 },
          },
        },
        vendorId: { type: 'keyword' },
        price: { type: 'double' },
        stock: { type: 'integer' },
        rating: { type: 'double' },
        status: { type: 'keyword' },
        images: { type: 'keyword' },
        sku: { type: 'keyword' },
        createdAt: { type: 'date' },
        updatedAt: { type: 'date' },
      },
    },
  };

  /**
   * Initializes or recreates the product search index in Elasticsearch.
   */
  static async initProductIndex(recreate: boolean = false): Promise<boolean> {
    const client = getElasticsearchClient();
    try {
      const exists = await client.indices.exists({ index: ELASTICSEARCH_INDEX });

      if (exists) {
        if (!recreate) {
          logger.info(`ℹ️ Elasticsearch index '${ELASTICSEARCH_INDEX}' already exists`);
          return true;
        }
        logger.info(`🔄 Deleting existing Elasticsearch index '${ELASTICSEARCH_INDEX}' for recreation...`);
        await client.indices.delete({ index: ELASTICSEARCH_INDEX });
      }

      logger.info(`🔨 Creating Elasticsearch index '${ELASTICSEARCH_INDEX}' with custom analyzer mappings...`);
      await client.indices.create({
        index: ELASTICSEARCH_INDEX,
        ...this.INDEX_MAPPING,
      });

      logger.info(`✅ Elasticsearch index '${ELASTICSEARCH_INDEX}' created successfully`);
      return true;
    } catch (error: any) {
      logger.error(`❌ Failed to initialize Elasticsearch index '${ELASTICSEARCH_INDEX}': ${error.message}`);
      throw error;
    }
  }

  /**
   * Determines if a product document is eligible for public marketplace search.
   * Requirement: Active products only, non-deleted, and having required search fields.
   */
  static isEligibleForSearch(product: any): boolean {
    if (!product) return false;
    if (product.isDeleted === true) return false;
    if (product.status !== 'active') return false;
    if (!product.name || !product.price) return false;
    return true;
  }

  /**
   * Transforms a Mongoose Product document into an Elasticsearch document.
   */
  static toSearchDocument(product: any): IndexedProductDocument {
    const id = product._id?.toString() || product.id || product.productId;
    const categoryName = product.categoryId?.name || '';
    const categoryId = product.categoryId?._id?.toString() || product.categoryId?.toString() || '';
    const vendorId = product.vendorId?._id?.toString() || product.vendorId?.toString() || '';

    const imageKeys = Array.isArray(product.images)
      ? product.images.map((img: any) => (typeof img === 'string' ? img : img.key || '')).filter(Boolean)
      : [];

    return {
      productId: id,
      name: product.name,
      description: product.description || '',
      brand: product.brand || '',
      categoryId,
      categoryName,
      vendorId,
      price: Number(product.price),
      stock: Number(product.stock || 0),
      rating: Number(product.rating || product.averageRating || 0),
      status: product.status || 'active',
      images: imageKeys,
      sku: product.sku || '',
      createdAt: product.createdAt ? new Date(product.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: product.updatedAt ? new Date(product.updatedAt).toISOString() : new Date().toISOString(),
    };
  }

  /**
   * Indexes a single product into Elasticsearch.
   * If the product is not eligible (inactive or deleted), it removes it from the index.
   */
  static async indexProduct(product: any): Promise<boolean> {
    const productId = product._id?.toString() || product.id;
    if (!productId) {
      throw new Error('Product document must have a valid identifier');
    }

    // Task 6: Filter eligibility
    if (!this.isEligibleForSearch(product)) {
      logger.info(`Product ${productId} is not eligible for public search (status: ${product.status}, isDeleted: ${product.isDeleted}). Removing from index.`);
      await this.deleteProductFromIndex(productId);
      return false;
    }

    const client = getElasticsearchClient();
    const doc = this.toSearchDocument(product);

    await client.index({
      index: ELASTICSEARCH_INDEX,
      id: productId,
      document: doc,
      refresh: 'wait_for',
    });

    logger.info(`✅ Indexed product '${productId}' into Elasticsearch index '${ELASTICSEARCH_INDEX}'`);
    return true;
  }

  /**
   * Updates an existing indexed product with partial fields.
   */
  static async updateProductIndex(
    productId: string,
    partialDoc: Partial<IndexedProductDocument>
  ): Promise<boolean> {
    const client = getElasticsearchClient();
    try {
      await client.update({
        index: ELASTICSEARCH_INDEX,
        id: productId,
        doc: {
          ...partialDoc,
          updatedAt: new Date().toISOString(),
        },
        refresh: 'wait_for',
      });
      logger.info(`✅ Updated product index '${productId}'`);
      return true;
    } catch (error: any) {
      if (error?.meta?.statusCode === 404 || error?.statusCode === 404) {
        // Document didn't exist in index; try full index if possible
        logger.warn(`Product '${productId}' not found in index during partial update.`);
        return false;
      }
      throw error;
    }
  }

  /**
   * Deletes a product from the Elasticsearch index.
   * Idempotent: 404 Not Found is treated as success.
   */
  static async deleteProductFromIndex(productId: string): Promise<boolean> {
    const client = getElasticsearchClient();
    try {
      await client.delete({
        index: ELASTICSEARCH_INDEX,
        id: productId,
        refresh: 'wait_for',
      });
      logger.info(`🗑️ Deleted product '${productId}' from Elasticsearch index`);
      return true;
    } catch (error: any) {
      if (error?.meta?.statusCode === 404 || error?.statusCode === 404) {
        logger.info(`ℹ️ Product '${productId}' was not in Elasticsearch index (already deleted)`);
        return true;
      }
      logger.error(`❌ Failed to delete product '${productId}' from index: ${error.message}`);
      throw error;
    }
  }

  /**
   * Retrieves an indexed product document by its MongoDB ID.
   */
  static async getProductFromIndex(productId: string): Promise<IndexedProductDocument | null> {
    const client = getElasticsearchClient();
    try {
      const response = await client.get<IndexedProductDocument>({
        index: ELASTICSEARCH_INDEX,
        id: productId,
      });
      return response._source || null;
    } catch (error: any) {
      if (error?.meta?.statusCode === 404 || error?.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Bulk indexes a batch of products into Elasticsearch.
   */
  static async bulkIndexProducts(products: any[]): Promise<BulkIndexResult> {
    const result: BulkIndexResult = {
      total: products.length,
      indexed: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    if (!products || products.length === 0) {
      return result;
    }

    const operations: any[] = [];
    const eligibleIds: string[] = [];

    for (const product of products) {
      const id = product._id?.toString() || product.id;
      if (!this.isEligibleForSearch(product)) {
        result.skipped++;
        continue;
      }

      operations.push({ index: { _index: ELASTICSEARCH_INDEX, _id: id } });
      operations.push(this.toSearchDocument(product));
      eligibleIds.push(id);
    }

    if (operations.length === 0) {
      return result;
    }

    const client = getElasticsearchClient();
    const bulkResponse = await client.bulk({
      operations,
      refresh: 'wait_for',
    });

    if (bulkResponse.errors) {
      bulkResponse.items.forEach((item: any, idx: number) => {
        const action = item.index || item.create || item.update;
        if (action?.error) {
          result.failed++;
          result.errors.push({
            id: action._id || eligibleIds[idx] || 'unknown',
            error: action.error.reason || JSON.stringify(action.error),
          });
        } else {
          result.indexed++;
        }
      });
    } else {
      result.indexed = eligibleIds.length;
    }

    return result;
  }

  /**
   * Synchronizes product state with Elasticsearch safely.
   * If Elasticsearch is offline or indexing fails, writes a pending record to
   * ProductSyncOutbox so MongoDB remains the source of truth with ZERO data loss.
   */
  static async syncProduct(product: any): Promise<void> {
    const productId = product._id?.toString() || product.id;
    if (!productId) return;

    const action = this.isEligibleForSearch(product) ? 'INDEX' : 'DELETE';

    try {
      if (action === 'INDEX') {
        await this.indexProduct(product);
      } else {
        await this.deleteProductFromIndex(productId);
      }

      // Mark any prior pending outbox task as PROCESSED
      await ProductSyncOutbox.updateMany(
        { productId: new Types.ObjectId(productId), status: 'PENDING' },
        { status: 'PROCESSED' }
      ).catch(() => {});
    } catch (error: any) {
      logger.warn(`⚠️ Real-time Elasticsearch sync failed for product '${productId}'. Recording to Outbox: ${error.message}`);

      // Record to Outbox for asynchronous background reconciliation
      await ProductSyncOutbox.findOneAndUpdate(
        { productId: new Types.ObjectId(productId), status: 'PENDING' },
        {
          productId: new Types.ObjectId(productId),
          action,
          status: 'PENDING',
          $inc: { attempts: 1 },
          lastError: error.message,
          nextRetryAt: new Date(), // Eligible for immediate reconciliation
          payload: action === 'INDEX' ? this.toSearchDocument(product) : undefined,
        },
        { upsert: true, new: true }
      ).catch((outboxErr) => {
        logger.error(`❌ Critical: Failed to write to ProductSyncOutbox: ${outboxErr.message}`);
      });
    }
  }

  /**
   * Processes pending records from ProductSyncOutbox.
   */
  static async processSyncOutbox(
    limit: number = 50,
    forceImmediate: boolean = false
  ): Promise<{ processed: number; failed: number }> {
    const query: any = { status: 'PENDING' };
    if (!forceImmediate) {
      query.nextRetryAt = { $lte: new Date() };
    }

    const pendingItems = await ProductSyncOutbox.find(query).limit(limit);

    let processed = 0;
    let failed = 0;

    for (const item of pendingItems) {
      try {
        if (item.action === 'INDEX') {
          const product = await Product.findById(item.productId).populate('categoryId', 'name');
          if (product && this.isEligibleForSearch(product)) {
            await this.indexProduct(product);
          } else {
            await this.deleteProductFromIndex(item.productId.toString());
          }
        } else {
          await this.deleteProductFromIndex(item.productId.toString());
        }

        item.status = 'PROCESSED';
        await item.save();
        processed++;
      } catch (err: any) {
        failed++;
        item.attempts += 1;
        item.lastError = err.message;
        item.nextRetryAt = new Date(Date.now() + Math.min(60 * 60 * 1000, Math.pow(2, item.attempts) * 60 * 1000));
        if (item.attempts >= 10) {
          item.status = 'FAILED';
        }
        await item.save();
      }
    }

    return { processed, failed };
  }

  /**
   * Bulk Reindexing: Streams all products from MongoDB in batches and rebuilds the index.
   * Avoids loading entire collection into memory.
   */
  static async reindexAllProducts(recreate: boolean = false, batchSize: number = 100): Promise<ReindexReport> {
    const startTime = Date.now();
    logger.info(`🚀 Starting product reindex operation [recreate=${recreate}, batchSize=${batchSize}]...`);

    if (recreate) {
      await this.initProductIndex(true);
    } else {
      const client = getElasticsearchClient();
      const exists = await client.indices.exists({ index: ELASTICSEARCH_INDEX });
      if (!exists) {
        await this.initProductIndex(false);
      }
    }

    let totalProcessed = 0;
    let indexed = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    let currentBatch: any[] = [];

    // Stream from MongoDB via cursor with population
    const cursor = Product.find({ isDeleted: false })
      .populate('categoryId', 'name')
      .cursor({ batchSize });

    for await (const product of cursor) {
      totalProcessed++;
      currentBatch.push(product);

      if (currentBatch.length >= batchSize) {
        const batchRes = await this.bulkIndexProducts(currentBatch);
        indexed += batchRes.indexed;
        skipped += batchRes.skipped;
        failed += batchRes.failed;
        errors.push(...batchRes.errors);
        currentBatch = [];
      }
    }

    // Flush remaining items
    if (currentBatch.length > 0) {
      const batchRes = await this.bulkIndexProducts(currentBatch);
      indexed += batchRes.indexed;
      skipped += batchRes.skipped;
      failed += batchRes.failed;
      errors.push(...batchRes.errors);
    }

    const durationMs = Date.now() - startTime;
    logger.info(`🏁 Reindex completed in ${durationMs}ms: ${indexed} indexed, ${skipped} skipped, ${failed} failed.`);

    return {
      success: failed === 0,
      index: ELASTICSEARCH_INDEX,
      recreated: Boolean(recreate),
      totalProcessed,
      indexed,
      skipped,
      failed,
      durationMs,
      errors,
    };
  }
}
