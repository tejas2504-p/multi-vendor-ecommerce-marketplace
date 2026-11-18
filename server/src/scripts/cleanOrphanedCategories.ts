import mongoose from 'mongoose';
import '../models';
import { Category } from '../models/category.model';
import { env } from '../config/env.config';

async function clean() {
  await mongoose.connect(env.MONGO_URI);
  await Category.deleteMany({ slug: /^category-/ });
  console.log('Cleaned orphaned test categories');
  await mongoose.disconnect();
}

clean().catch(console.error);
