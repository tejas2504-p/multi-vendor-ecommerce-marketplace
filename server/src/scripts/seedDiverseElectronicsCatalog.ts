import mongoose from 'mongoose';
import '../models';
import { User } from '../models/user.model';
import { VendorProfile } from '../models/vendorProfile.model';
import { Category } from '../models/category.model';
import { Product } from '../models/product.model';
import { ProductIndexingService } from '../services/productIndexing.service';
import { env } from '../config/env.config';
import { connectRedis, disconnectRedis } from '../config/redis.config';
import { logger } from '../utils/logger';

async function seedDiverseElectronics() {
  await mongoose.connect(env.MONGO_URI);
  await connectRedis();
  logger.info('Connected to MongoDB and Redis');

  // 1. Get or create demo vendor
  let vendor = await User.findOne({ email: 'vendor@example.com' });
  if (!vendor) {
    vendor = await User.create({
      name: 'Alpha Tech Store',
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
      storeName: 'Alpha Tech Store',
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

  const vendorId = vendor._id;

  // 2. Define clean categories
  const categoryDefs = [
    { name: 'Smart Wearables', slug: 'smart-wearables', description: 'Smartwatches, fitness bands, and wearable tech' },
    { name: 'Audio & Headphones', slug: 'audio-headphones', description: 'Studio monitors, wireless headphones, and earbuds' },
    { name: 'Laptops & Computers', slug: 'laptops-computers', description: 'High-performance laptops, ultrabooks, and workstations' },
    { name: 'Smartphones & Tablets', slug: 'smartphones-tablets', description: 'Flagship mobile phones and high-res tablets' },
    { name: 'PC & Gaming Gear', slug: 'gaming-accessories', description: 'Mechanical keyboards, gaming mice, and streaming peripherals' },
    { name: 'Smart Home & IoT', slug: 'smart-home-iot', description: 'Smart speakers, IoT hubs, and connected home gadgets' },
  ];

  const categoryMap = new Map<string, mongoose.Types.ObjectId>();

  for (const cat of categoryDefs) {
    let existing = await Category.findOne({ slug: cat.slug });
    if (!existing) {
      existing = await Category.create({
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        isActive: true,
      });
      logger.info(`Created category: ${cat.name}`);
    } else {
      existing.name = cat.name;
      existing.description = cat.description;
      existing.isActive = true;
      await existing.save();
      logger.info(`Updated category: ${cat.name}`);
    }
    categoryMap.set(cat.slug, existing._id as mongoose.Types.ObjectId);
  }

  // 3. Clean up old test products in MongoDB
  await Product.deleteMany({});
  logger.info('Cleared old test products from MongoDB');

  // 4. Create 12 unique, distinct electronic devices
  const productsData = [
    {
      name: 'Beta Smartwatch Ultra',
      description: 'Titanium chassis smartwatch with GPS, ECG heart monitoring, and rugged outdoor battery life.',
      brand: 'BetaGear',
      price: 299.99,
      stock: 45,
      sku: 'ELEC-WATCH-001',
      categorySlug: 'smart-wearables',
      image: '/images/products/beta-smartwatch-ultra.jpg',
      rating: 4.8,
      reviewCount: 38,
    },
    {
      name: 'Alpha Studio Monitor Pro',
      description: 'Precision over-ear studio monitor headphones with active noise cancellation and neutral acoustic response.',
      brand: 'AudioTechnica',
      price: 199.99,
      stock: 30,
      sku: 'ELEC-HEAD-002',
      categorySlug: 'audio-headphones',
      image: '/images/products/alpha-studio-monitor-pro.jpg',
      rating: 4.9,
      reviewCount: 52,
    },
    {
      name: 'NovaBook Pro 16 M3 Max',
      description: 'Next-gen 16-inch high-performance ultrabook featuring Liquid Retina XDR display and 32GB unified memory.',
      brand: 'NovaTech',
      price: 1499.0,
      stock: 18,
      sku: 'ELEC-LAPTOP-003',
      categorySlug: 'laptops-computers',
      image: '/images/products/novabook-pro-16.jpg',
      rating: 4.9,
      reviewCount: 24,
    },
    {
      name: 'Apex Phone 15 Pro Titanium',
      description: 'Flagship smartphone with forged aerospace titanium frame, 48MP triple optical camera, and 120Hz OLED screen.',
      brand: 'ApexMobile',
      price: 999.0,
      stock: 25,
      sku: 'ELEC-PHONE-004',
      categorySlug: 'smartphones-tablets',
      image: '/images/products/apex-phone-15-pro.jpg',
      rating: 4.7,
      reviewCount: 65,
    },
    {
      name: 'Vortex RGB Mechanical Keyboard',
      description: 'Aircraft-grade brushed aluminum mechanical gaming keyboard with hot-swappable switches and per-key RGB backlighting.',
      brand: 'VortexKey',
      price: 129.99,
      stock: 60,
      sku: 'ELEC-KEYB-005',
      categorySlug: 'gaming-accessories',
      image: '/images/products/vortex-mechanical-keyboard.jpg',
      rating: 4.8,
      reviewCount: 41,
    },
    {
      name: 'PulseBuds ANC Wireless Earbuds',
      description: 'True wireless earbuds with hybrid 40dB active noise cancellation, transparency mode, and 36-hour charging case.',
      brand: 'PulseSound',
      price: 149.0,
      stock: 75,
      sku: 'ELEC-EAR-006',
      categorySlug: 'audio-headphones',
      image: '/images/products/pulsebuds-anc.jpg',
      rating: 4.6,
      reviewCount: 89,
    },
    {
      name: 'Spectra Precision Wireless Mouse',
      description: 'Ultra-lightweight ergonomic wireless mouse with 26,000 DPI optical sensor, PTFE feet, and 90-hour battery.',
      brand: 'LogiPrecision',
      price: 79.99,
      stock: 55,
      sku: 'ELEC-MOUSE-007',
      categorySlug: 'gaming-accessories',
      image: '/images/products/vortex-mechanical-keyboard.jpg',
      rating: 4.7,
      reviewCount: 32,
    },
    {
      name: 'Titan 34" Curved 4K OLED Monitor',
      description: 'Ultrawide 34-inch curved QD-OLED gaming display with 175Hz refresh rate, 0.03ms response time, and HDR True Black.',
      brand: 'VisionMax',
      price: 799.0,
      stock: 12,
      sku: 'ELEC-MON-008',
      categorySlug: 'laptops-computers',
      image: '/images/products/novabook-pro-16.jpg',
      rating: 4.9,
      reviewCount: 19,
    },
    {
      name: 'CyberPad Pro 12.9" Retina Tablet',
      description: 'All-screen 12.9-inch tablet with ProMotion 120Hz display, pencil stylus support, and all-day battery life.',
      brand: 'NovaTech',
      price: 649.0,
      stock: 22,
      sku: 'ELEC-TAB-009',
      categorySlug: 'smartphones-tablets',
      image: '/images/products/apex-phone-15-pro.jpg',
      rating: 4.6,
      reviewCount: 27,
    },
    {
      name: 'EchoSphere Smart Home Hub & Speaker',
      description: 'Centralized smart home controller with 360-degree room-filling acoustic sound and built-in Zigbee hub.',
      brand: 'AmbientIoT',
      price: 119.0,
      stock: 40,
      sku: 'ELEC-HUB-010',
      categorySlug: 'smart-home-iot',
      image: '/images/products/pulsebuds-anc.jpg',
      rating: 4.5,
      reviewCount: 44,
    },
    {
      name: 'Chronos Fitness Band Sport',
      description: 'Slim lightweight fitness tracker with SpO2 blood oxygen sensor, continuous sleep analysis, and 14-day battery life.',
      brand: 'BetaGear',
      price: 89.99,
      stock: 50,
      sku: 'ELEC-BAND-011',
      categorySlug: 'smart-wearables',
      image: '/images/products/beta-smartwatch-ultra.jpg',
      rating: 4.4,
      reviewCount: 35,
    },
    {
      name: 'AcousticWave Hi-Res Desktop DAC',
      description: 'Audiophile USB desktop digital-to-analog converter and headphone amplifier with dual ESS Sabre chips.',
      brand: 'AudioTechnica',
      price: 249.0,
      stock: 15,
      sku: 'ELEC-DAC-012',
      categorySlug: 'audio-headphones',
      image: '/images/products/alpha-studio-monitor-pro.jpg',
      rating: 4.9,
      reviewCount: 16,
    },
  ];

  for (const item of productsData) {
    const catId = categoryMap.get(item.categorySlug);
    if (!catId) continue;

    const created = await Product.create({
      name: item.name,
      description: item.description,
      brand: item.brand,
      price: item.price,
      stock: item.stock,
      sku: item.sku,
      categoryId: catId,
      vendorId,
      status: 'active',
      isDeleted: false,
      averageRating: item.rating,
      reviewCount: item.reviewCount,
      images: [
        {
          _id: new mongoose.Types.ObjectId(),
          key: item.image,
          originalName: item.image.split('/').pop() || 'product.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 500000,
          uploadedAt: new Date(),
        },
      ],
    });
    logger.info(`✅ Created product: '${created.name}' [$${created.price}]`);
  }

  // 5. Re-initialize and Re-index Elasticsearch completely
  logger.info('🔄 Re-initializing Elasticsearch index to wipe old test duplicates...');
  await ProductIndexingService.initProductIndex(true);

  logger.info('🚀 Indexing all new unique electronic products into Elasticsearch...');
  const report = await ProductIndexingService.reindexAllProducts(false);
  logger.info(`Done! Indexed ${report.indexed} products, ${report.failed} failed.`);

  await disconnectRedis();
  await mongoose.disconnect();
  logger.info('🎉 Diverse electronics catalog successfully seeded!');
}

seedDiverseElectronics().catch((err) => {
  logger.error('Error seeding electronics catalog:', err);
  process.exit(1);
});
