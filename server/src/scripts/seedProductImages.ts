import mongoose from 'mongoose';
import '../models'; // register all Mongoose models
import { Product } from '../models/product.model';
import { getElasticsearchClient, ELASTICSEARCH_INDEX } from '../config/elastic.config';
import { env } from '../config/env.config';
import { connectRedis, disconnectRedis } from '../config/redis.config';
import { logger } from '../utils/logger';

async function updateProductImages() {
  await mongoose.connect(env.MONGO_URI);
  await connectRedis();
  logger.info('Connected to MongoDB and Redis');

  // 1. Update MongoDB Products
  const mongoProducts = await Product.find({});
  logger.info(`Found ${mongoProducts.length} products in MongoDB to inspect`);

  for (const product of mongoProducts) {
    const nameLower = product.name.toLowerCase();
    let imageKey = '/images/products/beta-smartwatch-ultra.jpg';
    let originalName = 'beta-smartwatch-ultra.jpg';
    let sizeBytes = 485422;

    if (nameLower.includes('monitor') || nameLower.includes('alpha') || nameLower.includes('headphone')) {
      imageKey = '/images/products/alpha-studio-monitor-pro.jpg';
      originalName = 'alpha-studio-monitor-pro.jpg';
      sizeBytes = 528132;
    }

    product.images = [
      {
        _id: new mongoose.Types.ObjectId(),
        key: imageKey,
        originalName,
        mimeType: 'image/jpeg',
        sizeBytes,
        uploadedAt: new Date(),
      },
    ];

    await product.save();
    logger.info(`Updated MongoDB product '${product.name}' with image: ${imageKey}`);
  }

  // 2. Update Elasticsearch Documents
  const esClient = getElasticsearchClient();
  const esResponse = await esClient.search({
    index: ELASTICSEARCH_INDEX,
    query: { match_all: {} },
    size: 200,
  });

  const hits = esResponse.hits.hits;
  logger.info(`Found ${hits.length} documents in Elasticsearch index '${ELASTICSEARCH_INDEX}'`);

  for (const hit of hits) {
    const source: any = hit._source;
    const nameLower = (source?.name || '').toLowerCase();
    let imageKey = '/images/products/beta-smartwatch-ultra.jpg';

    if (nameLower.includes('monitor') || nameLower.includes('alpha') || nameLower.includes('headphone')) {
      imageKey = '/images/products/alpha-studio-monitor-pro.jpg';
    }

    if (!hit._id) continue;

    await esClient.update({
      index: ELASTICSEARCH_INDEX,
      id: hit._id,
      doc: {
        images: [imageKey],
      },
      refresh: true,
    });

    logger.info(`Updated ES doc ${hit._id} ('${source?.name}') with image: ${imageKey}`);
  }

  await disconnectRedis();
  await mongoose.disconnect();
  logger.info('🎉 Successfully updated all product images across MongoDB and Elasticsearch!');
}

updateProductImages().catch((err) => {
  logger.error('Error updating product images:', err);
  process.exit(1);
});
