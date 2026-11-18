import mongoose from 'mongoose';
import '../models';
import { Product } from '../models/product.model';
import { Category } from '../models/category.model';
import { env } from '../config/env.config';
import { getElasticsearchClient, ELASTICSEARCH_INDEX } from '../config/elastic.config';

async function inspect() {
  await mongoose.connect(env.MONGO_URI);
  const categories = await Category.find({}).lean();
  const products = await Product.find({}).lean();
  console.log(`Categories in DB: ${categories.length}`);
  console.log(categories.map((c) => ({ id: c._id.toString(), name: c.name, slug: c.slug })));
  console.log(`Products in DB: ${products.length}`);
  console.log(
    products.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      brand: p.brand,
      status: p.status,
      isDeleted: p.isDeleted,
      images: p.images?.map((i) => i.key),
    }))
  );

  const es = getElasticsearchClient();
  const esRes = await es.search({ index: ELASTICSEARCH_INDEX, query: { match_all: {} }, size: 50 });
  console.log(`Elasticsearch docs: ${esRes.hits.hits.length}`);
  console.log(
    esRes.hits.hits.map((h: any) => ({
      id: h._id,
      name: h._source?.name,
      brand: h._source?.brand,
      categoryName: h._source?.categoryName,
      images: h._source?.images,
    }))
  );

  await mongoose.disconnect();
}

inspect().catch(console.error);
