import assert from 'assert';
import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app';
import {
  User,
  VendorProfile,
  Category,
  Product,
  Order,
  VendorOrder,
  Payment,
  VendorEarnings,
  VendorPayout,
} from '../models';
import { AnalyticsService } from '../services/analytics.service';
import { AnalyticsCacheService } from '../services/analyticsCache.service';
import { generateAccessToken, AUTH_COOKIE_NAME } from '../utils/token';

const getCookies = (token: string): string[] => [`${AUTH_COOKIE_NAME}=${token}; Path=/; HttpOnly`];

async function runAnalyticsTestSuite() {
  console.log('\n================================================================');
  console.log('🧪 Starting Phase 10B — Admin Analytics & BI Integration Tests');
  console.log('================================================================\n');

  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'super_secret_test_jwt_key_at_least_32_characters_long';
  process.env.JWT_ACCESS_EXPIRY = '15m';

  let mongoServer: MongoMemoryServer | null = null;
  let mongoUri = 'mongodb://localhost:27017/marketplace_test_analytics';

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
    // Drop test database first to ensure clean state
    await mongoose.connection.dropDatabase();
    console.log('📦 Connected to clean test MongoDB instance (27017).');
  } catch {
    console.log('Falling back to in-memory MongoDB server...');
    mongoServer = await MongoMemoryServer.create();
    mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    console.log('📦 Connected to in-memory MongoDB instance for Analytics testing.');
  }

  const app = createApp();

  let passed = 0;
  let failed = 0;

  const testCase = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      console.log(`  ✅ Passed: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ Failed: ${name}`);
      console.error(`     Error: ${err.message}`);
      if (err.stack) {
        console.error(`     Stack: ${err.stack.split('\n').slice(1, 3).join('\n')}`);
      }
      failed++;
    }
  };

  try {
    console.log('\n🌱 Provisioning seed users, vendors, products, orders, payments, and payouts...');

    // 1. Admin User
    const adminUser = await User.create({
      name: 'Super Admin',
      email: 'admin@nexusmarket.com',
      password: 'Password123!',
      role: 'admin',
    });
    const adminToken = generateAccessToken({
      id: adminUser._id.toString(),
      email: adminUser.email,
      role: adminUser.role,
    });

    // 2. Customer 1 (Alice)
    const customer1 = await User.create({
      name: 'Alice Customer',
      email: 'alice@example.com',
      password: 'Password123!',
      role: 'customer',
    });
    const customer1Token = generateAccessToken({
      id: customer1._id.toString(),
      email: customer1.email,
      role: customer1.role,
    });

    // 3. Customer 2 (Bob)
    const customer2 = await User.create({
      name: 'Bob Buyer',
      email: 'bob@example.com',
      password: 'Password123!',
      role: 'customer',
    });

    // 4. Vendor 1 (Apex Electronics)
    const vendor1User = await User.create({
      name: 'Apex Merchant',
      email: 'apex@vendor.com',
      password: 'Password123!',
      role: 'vendor',
    });
    const vendor1Profile = await VendorProfile.create({
      userId: vendor1User._id,
      storeName: 'Apex Electronics',
      slug: 'apex-electronics',
      description: 'Audio and tech gadgets',
      businessEmail: 'contact@apex.com',
      businessPhone: '+91 98765 00001',
      businessAddress: {
        street: '10 Tech Blvd',
        city: 'Bangalore',
        state: 'Karnataka',
        postalCode: '560001',
        country: 'India',
      },
      status: 'approved',
    });

    // 5. Vendor 2 (Zen Fashion)
    const vendor2User = await User.create({
      name: 'Zen Merchant',
      email: 'zen@vendor.com',
      password: 'Password123!',
      role: 'vendor',
    });
    const vendor2Profile = await VendorProfile.create({
      userId: vendor2User._id,
      storeName: 'Zen Fashion',
      slug: 'zen-fashion',
      description: 'Apparel & eco-wear',
      businessEmail: 'contact@zen.com',
      businessPhone: '+91 98765 00002',
      businessAddress: {
        street: '25 Linen St',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001',
        country: 'India',
      },
      status: 'approved',
    });

    // 6. Category
    const category = await Category.create({
      name: 'Consumer Electronics',
      slug: 'consumer-electronics',
      description: 'Gadgets and accessories',
    });

    // 7. Products (In Stock, Low Stock, Out of Stock)
    const productA = await Product.create({
      name: 'Wireless Noise-Cancelling Headphones',
      description: 'Over-ear premium headphones',
      price: 200,
      stock: 45, // in stock
      categoryId: category._id,
      vendorId: vendor1User._id,
      sku: 'SKU-HEADPHONE-ANC',
      status: 'active',
      isDeleted: false,
      averageRating: 4.8,
    });

    const productB = await Product.create({
      name: 'USB-C Fast Charging Hub',
      description: 'Multi-port charging dock',
      price: 50,
      stock: 5, // low stock (<= 10)
      categoryId: category._id,
      vendorId: vendor1User._id,
      sku: 'SKU-HUB-USBC',
      status: 'active',
      isDeleted: false,
      averageRating: 4.5,
    });

    const productC = await Product.create({
      name: 'Smart Organic Cotton Hoodie',
      description: 'Comfortable thermal hoodie',
      price: 80,
      stock: 0, // out of stock (=== 0)
      categoryId: category._id,
      vendorId: vendor2User._id,
      sku: 'SKU-HOODIE-ORG',
      status: 'active',
      isDeleted: false,
      averageRating: 4.2,
    });

    // 8. Orders & Vendor Orders
    const deliveryAddress = {
      fullName: 'Alice Customer',
      phone: '+91 99999 88888',
      addressLine1: '402 Sunshine Apts',
      city: 'Bangalore',
      state: 'Karnataka',
      postalCode: '560037',
      country: 'India',
    };

    // Order 1: Delivered & Paid ($250)
    const order1 = await Order.create({
      orderNumber: 'ORD-TEST-001',
      userId: customer1._id,
      customerId: customer1._id,
      deliveryAddress,
      items: [
        {
          productId: productA._id,
          vendorId: vendor1User._id,
          productName: productA.name,
          quantity: 1,
          unitPrice: 200,
          itemSubtotal: 200,
        },
        {
          productId: productB._id,
          vendorId: vendor1User._id,
          productName: productB.name,
          quantity: 1,
          unitPrice: 50,
          itemSubtotal: 50,
        },
      ],
      subtotal: 250,
      shippingAmount: 0,
      discountAmount: 0,
      totalAmount: 250,
      paymentStatus: 'paid',
      orderStatus: 'delivered',
      createdAt: new Date(),
    });

    const vendorOrder1A = await VendorOrder.create({
      parentOrderId: order1._id,
      vendorId: vendor1User._id,
      vendorOrderNumber: 'VO-TEST-001A',
      items: order1.items,
      vendorSubtotal: 250,
      shippingShare: 0,
      discountShare: 0,
      orderStatus: 'delivered',
      commission: {
        grossAmount: 250,
        commissionRate: 10,
        platformFee: 25,
        vendorEarnings: 225,
        calculatedAt: new Date(),
      },
      createdAt: new Date(),
    });

    // Order 2: Shipped & Paid ($160)
    const order2 = await Order.create({
      orderNumber: 'ORD-TEST-002',
      userId: customer2._id,
      customerId: customer2._id,
      deliveryAddress,
      items: [
        {
          productId: productC._id,
          vendorId: vendor2User._id,
          productName: productC.name,
          quantity: 2,
          unitPrice: 80,
          itemSubtotal: 160,
        },
      ],
      subtotal: 160,
      shippingAmount: 0,
      discountAmount: 0,
      totalAmount: 160,
      paymentStatus: 'paid',
      orderStatus: 'shipped',
      createdAt: new Date(),
    });

    const vendorOrder2A = await VendorOrder.create({
      parentOrderId: order2._id,
      vendorId: vendor2User._id,
      vendorOrderNumber: 'VO-TEST-002A',
      items: order2.items,
      vendorSubtotal: 160,
      shippingShare: 0,
      discountShare: 0,
      orderStatus: 'shipped',
      commission: {
        grossAmount: 160,
        commissionRate: 15,
        platformFee: 24,
        vendorEarnings: 136,
        calculatedAt: new Date(),
      },
      createdAt: new Date(),
    });

    // Order 3: Cancelled ($50)
    const order3 = await Order.create({
      orderNumber: 'ORD-TEST-003',
      userId: customer1._id,
      customerId: customer1._id,
      deliveryAddress,
      items: [
        {
          productId: productB._id,
          vendorId: vendor1User._id,
          productName: productB.name,
          quantity: 1,
          unitPrice: 50,
          itemSubtotal: 50,
        },
      ],
      subtotal: 50,
      shippingAmount: 10,
      discountAmount: 0,
      totalAmount: 60,
      paymentStatus: 'pending',
      orderStatus: 'cancelled',
      createdAt: new Date(),
    });

    // 9. Payment Records (Verified Captured vs Failed)
    // Captured Payment 1: $250
    await Payment.create({
      customerId: customer1._id,
      parentOrderId: order1._id,
      razorpayOrderId: 'order_rzp_test_001',
      razorpayPaymentId: 'pay_rzp_test_001',
      amount: 250,
      currency: 'INR',
      status: 'captured',
      verifiedAt: new Date(),
      createdAt: new Date(),
    });

    // Captured Payment 2: $160
    await Payment.create({
      customerId: customer2._id,
      parentOrderId: order2._id,
      razorpayOrderId: 'order_rzp_test_002',
      razorpayPaymentId: 'pay_rzp_test_002',
      amount: 160,
      currency: 'INR',
      status: 'captured',
      verifiedAt: new Date(),
      createdAt: new Date(),
    });

    // Failed Payment: $60 (MUST NOT BE COUNTED AS REVENUE)
    await Payment.create({
      customerId: customer1._id,
      parentOrderId: order3._id,
      razorpayOrderId: 'order_rzp_test_003',
      amount: 60,
      currency: 'INR',
      status: 'failed',
      failureReason: 'Customer card declined',
      createdAt: new Date(),
    });

    // 10. Vendor Earnings Records
    await VendorEarnings.create({
      vendorId: vendor1User._id,
      totalGrossSales: 250,
      totalCommission: 25,
      availableBalance: 200,
      pendingBalance: 25,
      paidOutAmount: 50,
    });

    await VendorEarnings.create({
      vendorId: vendor2User._id,
      totalGrossSales: 160,
      totalCommission: 24,
      availableBalance: 110,
      pendingBalance: 26,
      paidOutAmount: 0,
    });

    // 11. Vendor Payout Records
    await VendorPayout.create({
      vendorId: vendor1User._id,
      payoutNumber: 'PO-2026-001',
      requestedAmount: 50,
      approvedAmount: 50,
      payoutStatus: 'paid',
      destinationReference: 'BANK-HDFC-9911',
      requestedAt: new Date(),
      processedAt: new Date(),
    });

    await VendorPayout.create({
      vendorId: vendor2User._id,
      payoutNumber: 'PO-2026-002',
      requestedAmount: 70,
      payoutStatus: 'requested',
      destinationReference: 'BANK-ICICI-4422',
      requestedAt: new Date(),
    });

    console.log('✅ Seed data provisioned successfully.\n');

    // =================================================================
    // 🧪 TEST 1: Admin-only access to analytics endpoints
    // =================================================================
    await testCase('1. Admin authorization check on /api/admin/analytics/overview', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/overview')
        .set('Cookie', getCookies(adminToken))
        .expect(200);

      assert(res.body.success, 'Response should succeed for admin');
      assert(res.body.data.totalCustomers !== undefined, 'Overview data should be populated');
    });

    // =================================================================
    // 🧪 TEST 2: Customer receives 403 Forbidden
    // =================================================================
    await testCase('2. Customer RBAC rejection (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/overview')
        .set('Cookie', getCookies(customer1Token))
        .expect(403);

      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'FORBIDDEN');
    });

    // =================================================================
    // 🧪 TEST 3: Unauthenticated access rejected (401 Unauthorized)
    // =================================================================
    await testCase('3. Unauthenticated request rejected (401 Unauthorized)', async () => {
      const res = await request(app).get('/api/admin/analytics/overview').expect(401);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
    });

    // =================================================================
    // 🧪 TEST 4: Overview metrics aggregation accuracy
    // =================================================================
    await testCase('4. Overview metrics aggregation accuracy', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/overview?refresh=true')
        .set('Cookie', getCookies(adminToken))
        .expect(200);

      const d = res.body.data;
      assert.strictEqual(d.totalCustomers, 2, 'Should count 2 registered customers');
      assert.strictEqual(d.totalVendors, 2, 'Should count 2 approved vendors');
      assert.strictEqual(d.totalActiveProducts, 3, 'Should count 3 active non-deleted products');
      assert.strictEqual(d.totalParentOrders, 3, 'Should count 3 total parent orders');
      assert.strictEqual(d.totalVendorOrders, 2, 'Should count 2 child vendor orders');
      assert.strictEqual(d.totalRevenue, 410, 'Total revenue should be $250 + $160 = $410');
      assert.strictEqual(d.totalCommissionEarned, 49, 'Total platform commission should be $25 + $24 = $49');
      assert.strictEqual(d.pendingPayoutAmount, 70, 'Pending payout amount should be $70');
      assert.strictEqual(d.completedPayoutAmount, 50, 'Completed payout amount should be $50');
    });

    // =================================================================
    // 🧪 TEST 5: Revenue aggregation strictly excludes failed payments
    // =================================================================
    await testCase('5. Revenue analytics aggregation strictly counts captured payments only', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/revenue?period=30d&refresh=true')
        .set('Cookie', getCookies(adminToken))
        .expect(200);

      const d = res.body.data;
      assert.strictEqual(d.totalRevenue, 410, 'Revenue must be 410 (excluding 60 failed payment)');
      assert.strictEqual(d.successfulOrdersCount, 2, 'Successful orders count must be 2');
      assert.strictEqual(d.averageOrderValue, 205, 'AOV must be 410 / 2 = 205');
      assert(Array.isArray(d.timeline), 'Timeline should be an array');
      assert(d.timeline.length >= 1, 'Timeline should contain interval data');
    });

    // =================================================================
    // 🧪 TEST 6: Revenue timeline grouping (daily, weekly, monthly)
    // =================================================================
    await testCase('6. Revenue timeline grouping parameter validation', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/revenue?period=90d&groupBy=weekly&refresh=true')
        .set('Cookie', getCookies(adminToken))
        .expect(200);

      assert(res.body.success);
      assert.strictEqual(res.body.data.period.groupBy, 'weekly');
    });

    // =================================================================
    // 🧪 TEST 7: Order analytics and fulfillment status distribution
    // =================================================================
    await testCase('7. Order analytics status counts and percentages', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/orders?period=30d&refresh=true')
        .set('Cookie', getCookies(adminToken))
        .expect(200);

      const d = res.body.data;
      assert.strictEqual(d.totalOrders, 3, 'Total orders should be 3');
      assert.strictEqual(d.delivered, 1, 'Delivered orders should be 1');
      assert.strictEqual(d.shipped, 1, 'Shipped orders should be 1');
      assert.strictEqual(d.cancelled, 1, 'Cancelled orders should be 1');
      assert.strictEqual(d.statusDistribution.length, 6, 'Should have 6 statuses in distribution');
    });

    // =================================================================
    // 🧪 TEST 8: Vendor-wise analytics & top vendors ranking
    // =================================================================
    await testCase('8. Vendor-wise sales, commission, and earnings aggregation', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/vendors?period=30d&refresh=true')
        .set('Cookie', getCookies(adminToken))
        .expect(200);

      const d = res.body.data;
      assert(d.vendors.length >= 2, 'Should list both vendors');

      const apex = d.vendors.find((v: any) => v.vendorId === vendor1User._id.toString());
      assert(apex, 'Apex Electronics should be present in vendor analytics');
      assert.strictEqual(apex.totalSales, 250, 'Apex gross sales should be 250');
      assert.strictEqual(apex.platformCommission, 25, 'Apex commission should be 25');
      assert.strictEqual(apex.netEarnings, 225, 'Apex net earnings should be 225');
      assert.strictEqual(apex.availableBalance, 200, 'Apex available balance should be 200');

      assert.strictEqual(d.topVendors[0].vendorId, vendor1User._id.toString(), 'Top vendor should be Apex with highest sales');
    });

    // =================================================================
    // 🧪 TEST 9: Best-selling products from paid orders
    // =================================================================
    await testCase('9. Best-selling products ranking by units sold & revenue', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/products?period=30d&refresh=true')
        .set('Cookie', getCookies(adminToken))
        .expect(200);

      const d = res.body.data;
      assert(d.bestSellingProducts.length >= 1, 'Should list best-selling products');

      // Product C had 2 units sold ($160)
      const topProduct = d.bestSellingProducts[0];
      assert.strictEqual(topProduct.productId, productC._id.toString());
      assert.strictEqual(topProduct.unitsSold, 2);
      assert.strictEqual(topProduct.totalRevenue, 160);
    });

    // =================================================================
    // 🧪 TEST 10: Inventory health alerts (low-stock and out-of-stock)
    // =================================================================
    await testCase('10. Inventory stock threshold alerts', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/products?period=30d&refresh=true')
        .set('Cookie', getCookies(adminToken))
        .expect(200);

      const d = res.body.data;
      assert.strictEqual(d.lowStockProducts.length, 1, 'Should identify 1 low stock product');
      assert.strictEqual(d.lowStockProducts[0].productId, productB._id.toString(), 'Product B should be low stock');

      assert.strictEqual(d.outOfStockProducts.length, 1, 'Should identify 1 out of stock product');
      assert.strictEqual(d.outOfStockProducts[0].productId, productC._id.toString(), 'Product C should be out of stock');
    });

    // =================================================================
    // 🧪 TEST 11: Commission analytics and effective rate
    // =================================================================
    await testCase('11. Commission analytics calculations and effective rate', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/commissions?period=30d&refresh=true')
        .set('Cookie', getCookies(adminToken))
        .expect(200);

      const d = res.body.data;
      assert.strictEqual(d.totalCommission, 49, 'Total commission in period should be $49');
      assert.strictEqual(d.allTimeCommission, 49, 'All-time commission should be $49');
      assert(d.effectiveCommissionRate > 0, 'Effective commission rate should be calculated');
      assert(d.commissionByVendor.length >= 2, 'Should list commission breakdown by vendor');
    });

    // =================================================================
    // 🧪 TEST 12: Payout analytics & treasury balance reconciliation
    // =================================================================
    await testCase('12. Treasury payout analytics and reconciliation', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/payouts?refresh=true')
        .set('Cookie', getCookies(adminToken))
        .expect(200);

      const d = res.body.data;
      assert.strictEqual(d.availableVendorBalances, 310, 'Available balances: 200 + 110 = 310');
      assert.strictEqual(d.pendingBalances, 51, 'Pending balances: 25 + 26 = 51');
      assert.strictEqual(d.paidPayouts.count, 1, 'Paid payouts count should be 1');
      assert.strictEqual(d.paidPayouts.amount, 50, 'Paid payouts amount should be 50');
      assert.strictEqual(d.pendingPayouts.count, 1, 'Pending payouts count should be 1');
      assert.strictEqual(d.pendingPayouts.amount, 70, 'Pending payouts amount should be 70');
      assert(d.recentPayouts.length >= 2, 'Should display recent payouts');
    });

    // =================================================================
    // 🧪 TEST 13: Pagination and limit parameters on vendor analytics
    // =================================================================
    await testCase('13. Pagination enforcement on vendor analytics', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/vendors?page=1&limit=1&refresh=true')
        .set('Cookie', getCookies(adminToken))
        .expect(200);

      const d = res.body.data;
      assert.strictEqual(d.vendors.length, 1, 'Page limit of 1 should return exactly 1 item');
      assert.strictEqual(d.pagination.total, 2, 'Total should be 2');
      assert.strictEqual(d.pagination.totalPages, 2, 'Total pages should be 2');
    });

    // =================================================================
    // 🧪 TEST 14: Cache invalidation on fresh data / refresh query
    // =================================================================
    await testCase('14. Redis cache behavior and manual refresh bypass', async () => {
      // 1. Initial cached fetch
      const resInitial = await request(app)
        .get('/api/admin/analytics/overview')
        .set('Cookie', getCookies(adminToken))
        .expect(200);

      // 2. Refresh bypass
      const resRefresh = await request(app)
        .get('/api/admin/analytics/overview?refresh=true')
        .set('Cookie', getCookies(adminToken))
        .expect(200);

      assert.strictEqual(resRefresh.body.data.totalRevenue, resInitial.body.data.totalRevenue);
    });

    // =================================================================
    // 🧪 TEST 15: Empty database handling without crashing or NaN
    // =================================================================
    await testCase('15. Graceful empty query response without divide-by-zero or NaN', async () => {
      // Query with date range far in the future
      const futureStart = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();
      const futureEnd = new Date(Date.now() + 1000 * 60 * 60 * 24 * 370).toISOString();

      const res = await request(app)
        .get(`/api/admin/analytics/revenue?startDate=${futureStart}&endDate=${futureEnd}&refresh=true`)
        .set('Cookie', getCookies(adminToken))
        .expect(200);

      const d = res.body.data;
      assert.strictEqual(d.totalRevenue, 0, 'Revenue should be 0');
      assert.strictEqual(d.successfulOrdersCount, 0, 'Order count should be 0');
      assert.strictEqual(d.averageOrderValue, 0, 'AOV should be 0 without NaN error');
      assert.strictEqual(d.timeline.length, 0, 'Timeline should be empty array');
    });

  } finally {
    try {
      await mongoose.connection.dropDatabase();
    } catch {}
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  }

  console.log('\n================================================================');
  console.log(`🏁 Phase 10B Analytics Tests Finished: ${passed} passed, ${failed} failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAnalyticsTestSuite().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
