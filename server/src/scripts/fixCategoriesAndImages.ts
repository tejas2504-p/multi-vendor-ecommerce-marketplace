import mongoose from 'mongoose';
import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env.config';
import { logger } from '../utils/logger';

async function fixCategoriesAndImages() {
  logger.info('Connecting to MongoDB & Elasticsearch...');
  await mongoose.connect(env.MONGO_URI);
  const es = new Client({ node: env.ELASTICSEARCH_NODE });
  const db = mongoose.connection;

  // 1. Locate categories
  const allCats = await db.collection('categories').find({}).toArray();
  const catMap = new Map(allCats.map((c) => [c._id.toString(), c.name]));
  const catSlugMap = new Map(allCats.map((c) => [c.slug, c._id]));

  const audioCatId = catSlugMap.get('audio-headphones') || allCats.find((c) => c.name.toLowerCase().includes('audio'))?._id;
  const laptopCatId = catSlugMap.get('laptops-computers') || allCats.find((c) => c.name.toLowerCase().includes('laptop'))?._id;
  const vendor = await db.collection('users').findOne({ email: 'vendor@example.com' });
  const vendorId = vendor?._id || new mongoose.Types.ObjectId();

  // 2. Fix 'laptop' in MongoDB with proper image and category
  await db.collection('products').updateOne(
    { name: 'laptop' },
    {
      $set: {
        images: [
          {
            key: '/images/products/novabook-pro-16.jpg',
            originalName: 'novabook-pro-16.jpg',
            mimeType: 'image/jpeg',
            sizeBytes: 596258,
            uploadedAt: new Date(),
          },
        ],
        categoryId: laptopCatId,
        brand: 'Asus',
        description: 'ASUS High-Performance Core i9 Ultra Thin Laptop',
      },
    }
  );
  logger.info('✅ Updated laptop product in MongoDB');

  // 3. Ensure Sennheiser, Bose, and Sony headphones are properly saved in MongoDB
  const productsToUpsert = [
    {
      name: 'Sennheiser Momentum 4',
      description: 'Sennheiser 60-Hour Battery Adaptive ANC Headphones',
      price: 250,
      stock: 20,
      brand: 'Sennheiser',
      sku: 'SENN-M4',
      status: 'active',
      isDeleted: false,
      categoryId: audioCatId,
      vendorId: vendorId,
      images: [
        {
          key: '/images/products/alpha-studio-monitor-pro.jpg',
          originalName: 'sennheiser-m4.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 528132,
          uploadedAt: new Date(),
        },
      ],
    },
    {
      name: 'Bose QuietComfort Ultra',
      description: 'Bose Spatial Audio Noise Cancelling Wireless Headphones',
      price: 300,
      stock: 20,
      brand: 'Bose',
      sku: 'BOSE-QC-ULTRA',
      status: 'active',
      isDeleted: false,
      categoryId: audioCatId,
      vendorId: vendorId,
      images: [
        {
          key: '/images/products/pulsebuds-anc.jpg',
          originalName: 'bose-qc-ultra.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 557952,
          uploadedAt: new Date(),
        },
      ],
    },
    {
      name: 'Sony WH-1000XM5',
      description: 'Sony Flagship Industry Leading Noise Cancelling Wireless Headphones',
      price: 400,
      stock: 20,
      brand: 'Sony',
      sku: 'SONY-XM5',
      status: 'active',
      isDeleted: false,
      categoryId: audioCatId,
      vendorId: vendorId,
      images: [
        {
          key: '/images/products/alpha-studio-monitor-pro.jpg',
          originalName: 'sony-wh1000xm5.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 528132,
          uploadedAt: new Date(),
        },
      ],
    },
  ];

  for (const p of productsToUpsert) {
    const existing = await db.collection('products').findOne({ name: p.name });
    if (!existing) {
      await db.collection('products').insertOne({
        ...p,
        slug: p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      logger.info(`✅ Created ${p.name} in MongoDB`);
    } else {
      await db.collection('products').updateOne({ _id: existing._id }, { $set: p });
      logger.info(`✅ Updated ${p.name} in MongoDB`);
    }
  }

  // 4. Recreate Elasticsearch index with fresh mappings
  logger.info('Refreshing Elasticsearch marketplace_products index...');
  try {
    await es.indices.delete({ index: env.ELASTICSEARCH_INDEX });
  } catch {
    // Index might not exist yet
  }

  await es.indices.create({
    index: env.ELASTICSEARCH_INDEX,
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
          fields: { keyword: { type: 'keyword', ignore_above: 256 } },
        },
        description: { type: 'text', analyzer: 'product_search_analyzer' },
        brand: {
          type: 'keyword',
          fields: {
            text: { type: 'text', analyzer: 'product_search_analyzer' },
            keyword: { type: 'keyword', ignore_above: 256 },
          },
        },
        categoryId: {
          type: 'keyword',
          fields: { keyword: { type: 'keyword', ignore_above: 256 } },
        },
        categoryName: {
          type: 'text',
          fields: { keyword: { type: 'keyword', ignore_above: 256 } },
        },
        vendorId: { type: 'keyword' },
        price: { type: 'float' },
        stock: { type: 'integer' },
        rating: { type: 'float' },
        status: { type: 'keyword' },
        images: { type: 'keyword' },
        sku: { type: 'keyword' },
        createdAt: { type: 'date' },
        updatedAt: { type: 'date' },
      },
    },
  });

  // 5. Index every product from MongoDB into Elasticsearch
  const allProds = await db.collection('products').find({ isDeleted: false, status: 'active' }).toArray();
  logger.info(`Indexing ${allProds.length} products with populated category names and valid images...`);

  for (const prod of allProds) {
    const catId = prod.categoryId ? prod.categoryId.toString() : '';
    const catName = catMap.get(catId) || 'General Category';

    // Extract valid image key
    let imgs = Array.isArray(prod.images)
      ? prod.images
          .map((img: any) => (typeof img === 'string' ? img : img.key || img.url || ''))
          .filter(Boolean)
      : [];

    if (imgs.length === 0) {
      const nameLower = prod.name.toLowerCase();
      if (nameLower.includes('laptop') || nameLower.includes('book')) imgs = ['/images/products/novabook-pro-16.jpg'];
      else if (nameLower.includes('phone') || nameLower.includes('pad')) imgs = ['/images/products/apex-phone-15-pro.jpg'];
      else if (nameLower.includes('watch') || nameLower.includes('band')) imgs = ['/images/products/beta-smartwatch-ultra.jpg'];
      else if (nameLower.includes('keyboard') || nameLower.includes('mouse')) imgs = ['/images/products/vortex-mechanical-keyboard.jpg'];
      else imgs = ['/images/products/alpha-studio-monitor-pro.jpg'];
    }

    await es.index({
      index: env.ELASTICSEARCH_INDEX,
      id: prod._id.toString(),
      document: {
        productId: prod._id.toString(),
        name: prod.name,
        description: prod.description || '',
        brand: prod.brand || '',
        categoryId: catId,
        categoryName: catName,
        vendorId: prod.vendorId ? prod.vendorId.toString() : '',
        price: Number(prod.price),
        stock: Number(prod.stock || prod.inventoryStock || 0),
        rating: Number(prod.rating || prod.averageRating || 0),
        status: prod.status || 'active',
        images: imgs,
        sku: prod.sku || '',
        createdAt: prod.createdAt ? new Date(prod.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: prod.updatedAt ? new Date(prod.updatedAt).toISOString() : new Date().toISOString(),
      },
    });
  }

  await es.indices.refresh({ index: env.ELASTICSEARCH_INDEX });
  logger.info(`🎉 Successfully indexed ${allProds.length} products into Elasticsearch! All categories & images resolved.`);
  await mongoose.disconnect();
  process.exit(0);
}

fixCategoriesAndImages().catch((err) => {
  logger.error('Error fixing categories and images:', err);
  process.exit(1);
});
