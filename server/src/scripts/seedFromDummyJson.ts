import mongoose from 'mongoose';
import '../models';
import { User } from '../models/user.model';
import { VendorProfile } from '../models/vendorProfile.model';
import { Category } from '../models/category.model';
import { Product } from '../models/product.model';
import { Order } from '../models/order.model';
import { VendorOrder } from '../models/vendorOrder.model';
import { Review } from '../models/review.model';
import { ProductIndexingService } from '../services/productIndexing.service';
import { env } from '../config/env.config';
import { logger } from '../utils/logger';

interface DummyProduct {
  id: number;
  title: string;
  description: string;
  category: string;
  price: number;
  discountPercentage: number;
  rating: number;
  stock: number;
  brand?: string;
  sku?: string;
  images: string[];
  thumbnail: string;
  reviews?: Array<{
    rating: number;
    comment: string;
    date: string;
    reviewerName: string;
    reviewerEmail: string;
  }>;
}

export async function seedFromDummyJson(limit: number = 10) {
  logger.info(`Fetching ${limit} products from DummyJSON API...`);

  // Fetch electronics, laptops, and smartphones from DummyJSON
  const res = await fetch(`https://dummyjson.com/products?limit=${limit}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch DummyJSON data: ${res.statusText}`);
  }

  const json: any = await res.json();
  const dummyProducts: DummyProduct[] = json.products || [];
  logger.info(`Retrieved ${dummyProducts.length} products from DummyJSON.`);

  // 1. Locate or create active vendor
  let vendor = await User.findOne({ email: 'vendor@example.com' });
  if (!vendor) {
    vendor = await User.create({
      name: 'Premier Tech Store',
      email: 'vendor@example.com',
      password: 'Password123!',
      role: 'vendor',
      isActive: true,
    });
  }

  let vp = await VendorProfile.findOne({ userId: vendor._id });
  if (!vp) {
    vp = await VendorProfile.create({
      userId: vendor._id,
      storeName: 'Premier Store',
      description: 'Official Premier Electronics Vendor',
      businessEmail: 'vendor@example.com',
      businessPhone: '+1-555-0199',
      businessAddress: {
        street: '456 Market St',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94105',
        country: 'USA',
      },
      status: 'approved',
      approvedAt: new Date(),
    });
  }

  // 2. Locate or create a customer account for reviews
  let reviewerCustomer = await User.findOne({ email: 'customer@example.com' });
  if (!reviewerCustomer) {
    reviewerCustomer = await User.create({
      name: 'Jane Customer',
      email: 'customer@example.com',
      password: 'Password123!',
      role: 'customer',
      isActive: true,
    });
  }

  let importedCount = 0;
  let reviewsCount = 0;

  for (const dp of dummyProducts) {
    // 3. Category matching or creation
    const categoryName = dp.category
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    const categorySlug = dp.category.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    let cat = await Category.findOne({ slug: categorySlug });
    if (!cat) {
      cat = await Category.create({
        name: categoryName,
        slug: categorySlug,
        description: `Curated ${categoryName} gear and accessories`,
        isActive: true,
      });
    }

    // 4. Create or update product
    const productSlug = dp.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    let product = await Product.findOne({ $or: [{ slug: productSlug }, { sku: dp.sku }] });

    const imageObjs = (dp.images && dp.images.length > 0 ? dp.images : [dp.thumbnail]).slice(0, 5).map((url, i) => ({
      key: url,
      originalName: `dummy_${dp.id}_${i + 1}.webp`,
      mimeType: 'image/webp',
      sizeBytes: 150000,
      uploadedAt: new Date(),
    }));

    if (!product) {
      product = await Product.create({
        vendorId: vendor._id,
        categoryId: cat._id,
        name: dp.title,
        slug: `${productSlug}-${Date.now().toString().slice(-4)}`,
        description: dp.description,
        price: Math.max(1, Math.round(dp.price)),
        stock: dp.stock || 25,
        brand: dp.brand || 'NexusBrand',
        sku: dp.sku ? `${dp.sku}-${Date.now().toString().slice(-4)}` : `SKU-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`,
        status: 'active',
        images: imageObjs,
        rating: dp.rating || 4.5,
        reviewCount: dp.reviews?.length || 0,
      });
      importedCount++;
    }

    // 5. Optionally seed reviews
    if (dp.reviews && dp.reviews.length > 0) {
      // Create a delivered parent and vendor order snapshot so review is a verified purchase
      const ordNum = `ORD-SEED-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
      const mockOrder = await Order.create({
        orderNumber: ordNum,
        userId: reviewerCustomer._id,
        items: [
          {
            productId: product._id,
            vendorId: vendor._id,
            productName: product.name,
            quantity: 1,
            unitPrice: product.price,
            itemSubtotal: product.price,
          },
        ],
        subtotal: product.price,
        shippingAmount: 0,
        discountAmount: 0,
        totalAmount: product.price,
        deliveryAddress: {
          fullName: 'Jane Customer',
          phone: '+1-555-0100',
          addressLine1: '123 Market St',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94105',
          country: 'United States',
        },
        orderStatus: 'delivered',
        paymentStatus: 'paid',
        paymentMethod: 'card',
      });

      const mockVendorOrder = await VendorOrder.create({
        parentOrderId: mockOrder._id,
        vendorId: vendor._id,
        vendorOrderNumber: `${ordNum}-V1`,
        items: [
          {
            productId: product._id,
            vendorId: vendor._id,
            productName: product.name,
            quantity: 1,
            unitPrice: product.price,
            itemSubtotal: product.price,
          },
        ],
        vendorSubtotal: product.price,
        shippingShare: 0,
        orderStatus: 'delivered',
        statusHistory: [
          {
            status: 'confirmed',
            changedAt: new Date(Date.now() - 86400000 * 2),
            note: 'Order placed',
          },
          {
            status: 'delivered',
            changedAt: new Date(),
            note: 'Delivered',
          },
        ],
      });

      for (const rev of dp.reviews) {
        // Find or create customer account for each distinct reviewer
        const reviewerEmail = (rev.reviewerEmail || `reviewer_${Math.random().toString(36).substring(7)}@example.com`).toLowerCase();
        let customer = await User.findOne({ email: reviewerEmail });
        if (!customer) {
          customer = await User.create({
            name: rev.reviewerName || 'Marketplace Reviewer',
            email: reviewerEmail,
            password: 'Password123!',
            role: 'customer',
            isActive: true,
          });
        }

        const existingRev = await Review.findOne({
          userId: customer._id,
          productId: product._id,
        });

        if (!existingRev) {
          await Review.create({
            userId: customer._id,
            productId: product._id,
            orderId: mockOrder._id,
            vendorOrderId: mockVendorOrder._id,
            rating: Math.max(1, Math.min(5, Math.round(rev.rating))),
            title: rev.comment.slice(0, 30) + '...',
            comment: rev.comment,
            isVerifiedPurchase: true,
            moderationStatus: 'approved',
            helpfulCount: Math.floor(Math.random() * 10),
            createdAt: new Date(rev.date || Date.now()),
          });
          reviewsCount++;
        }
      }
    }

    // Try indexing product to Elasticsearch
    await ProductIndexingService.indexProduct(product).catch(() => {});
  }

  logger.info(`✅ Seeded ${importedCount} new products and ${reviewsCount} verified reviews from DummyJSON.`);
}

async function run() {
  await mongoose.connect(env.MONGO_URI);
  await seedFromDummyJson(10);
  await mongoose.disconnect();
  process.exit(0);
}

if (require.main === module) {
  run().catch((err) => {
    logger.error('Failed to seed from DummyJSON:', err);
    process.exit(1);
  });
}
