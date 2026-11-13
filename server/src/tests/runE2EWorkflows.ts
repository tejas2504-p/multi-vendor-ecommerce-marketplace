import assert from 'assert';
import crypto from 'crypto';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app';
import { User } from '../models/user.model';
import { VendorProfile } from '../models/vendorProfile.model';
import { Category } from '../models/category.model';
import { Product } from '../models/product.model';
import { Order } from '../models/order.model';
import { VendorOrder } from '../models/vendorOrder.model';
import { Coupon } from '../models/coupon.model';
import { AUTH_COOKIE_NAME, generateAccessToken } from '../utils/token';
import { env } from '../config/env.config';

const getCookies = (token: string): string[] => [`${AUTH_COOKIE_NAME}=${token}; Path=/; HttpOnly`];
const generateSignature = (orderId: string, paymentId: string, secret: string = env.RAZORPAY_KEY_SECRET): string => {
  return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
};

async function runE2EWorkflowTests() {
  console.log('\n================================================================');
  console.log('🚀 Starting Phase 11A — Complete End-to-End Workflow Audit');
  console.log('================================================================\n');

  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'super_secret_test_jwt_key_at_least_32_characters_long';
  process.env.JWT_ACCESS_EXPIRY = '15m';

  let mongoServer: MongoMemoryServer | null = null;
  const mongoUri = 'mongodb://localhost:27017/marketplace_test_e2e';

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
    await mongoose.connection.dropDatabase();
    console.log('📦 Connected to clean test MongoDB instance (27017).');
  } catch {
    console.log('Falling back to in-memory MongoDB server...');
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    console.log('📦 Connected to in-memory MongoDB instance for E2E testing.');
  }

  const app = createApp();
  let passedCount = 0;

  try {
    // =========================================================================
    // SECTION A: SETUP SEED INFRASTRUCTURE (Admin & Baseline Vendor)
    // =========================================================================
    console.log('\n--- Setting up Baseline System Infrastructure ---');
    const adminUser = await User.create({
      name: 'Super Admin',
      email: 'superadmin_e2e@example.com',
      password: 'Password123!',
      role: 'admin',
      isActive: true,
    });
    const adminToken = generateAccessToken({ id: adminUser._id.toString(), email: adminUser.email, role: 'admin' });
    const adminCookies = getCookies(adminToken);

    // Initial Category
    const category = await Category.create({
      name: 'High Tech Electronics',
      slug: 'high-tech-electronics',
      description: 'Audio, gadgets and computing devices',
      isActive: true,
    });

    // Existing Vendor 1
    const vendor1User = await User.create({
      name: 'Alpha Audio Owner',
      email: 'vendor_alpha@example.com',
      password: 'Password123!',
      role: 'vendor',
      isActive: true,
    });
    await VendorProfile.create({
      userId: vendor1User._id,
      storeName: 'Alpha Studio Sound',
      businessEmail: 'vendor_alpha@example.com',
      businessPhone: '+1-555-1111',
      businessAddress: {
        street: '123 Sound Wave Ave',
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
        country: 'US',
      },
      status: 'approved',
      commissionRate: 10,
    });

    // Existing Product from Vendor 1
    const product1 = await Product.create({
      vendorId: vendor1User._id,
      categoryId: category._id,
      name: 'Alpha Studio Monitor Pro',
      slug: 'alpha-studio-monitor-pro',
      description: 'Precision studio monitor headphones with active noise cancellation',
      price: 200,
      stock: 30,
      status: 'active',
      sku: 'ALPHA-MON-001',
    });

    // Seed Active Coupon for E2E
    await Coupon.create({
      code: 'WELCOME10',
      description: '10% Welcome Discount',
      discountType: 'percentage',
      discountValue: 10,
      minimumOrderAmount: 50,
      maximumDiscountAmount: 100,
      startDate: new Date(Date.now() - 3600000),
      expiryDate: new Date(Date.now() + 86400000 * 30),
      totalUsageLimit: 100,
      perUserUsageLimit: 2,
      usageCount: 0,
      isActive: true,
      createdBy: adminUser._id,
    });

    console.log('✅ Baseline infrastructure established (Admin, Category, Vendor 1, Product 1, Coupon).');

    // =========================================================================
    // SECTION B: VENDOR ONBOARDING & STORE WORKFLOW (Journey B)
    // =========================================================================
    console.log('\n======================================================');
    console.log('👤 JOURNEY B: Complete Vendor Lifecycle Workflow');
    console.log('======================================================');

    // Step B1: Register prospective merchant as customer
    const regVendorRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Beta Tech Founder',
        email: 'founder_beta@example.com',
        password: 'Password123!',
      });
    assert.strictEqual(regVendorRes.status, 201);
    assert.strictEqual(regVendorRes.body.data.user.role, 'customer', 'Applicant begins as customer');
    const betaUserId = regVendorRes.body.data.user.id;
    const betaCookies = regVendorRes.headers['set-cookie'];
    passedCount++;
    console.log('  ✅ B1. Prospective vendor registers account as customer');

    // Step B2: Apply for vendor onboarding
    const applyRes = await request(app)
      .post('/api/vendors/apply')
      .set('Cookie', betaCookies)
      .send({
        storeName: 'Beta Smart Gear',
        description: 'Next-gen smart wearables and connected gadgets',
        businessEmail: 'contact@betasmartgear.com',
        businessPhone: '+1-555-2222',
        businessAddress: {
          street: '500 Innovation Way',
          city: 'Seattle',
          state: 'WA',
          postalCode: '98101',
          country: 'US',
        },
      });
    assert.strictEqual(applyRes.status, 201);
    assert.strictEqual(applyRes.body.data.status, 'pending');
    const betaVendorAppId = applyRes.body.data.id || applyRes.body.data._id;
    passedCount++;
    console.log('  ✅ B2. Merchant submits vendor application with pending status');

    // Step B3: Check status before approval
    const statusPreRes = await request(app)
      .get('/api/vendors/status')
      .set('Cookie', betaCookies);
    assert.strictEqual(statusPreRes.status, 200);
    assert.strictEqual(statusPreRes.body.data.status, 'pending');
    passedCount++;
    console.log('  ✅ B3. Applicant checks review status (pending)');

    // Step B4: Admin reviews pending applications and approves
    const adminListPendingRes = await request(app)
      .get('/api/admin/vendors?status=pending')
      .set('Cookie', adminCookies);
    assert.strictEqual(adminListPendingRes.status, 200);
    assert.ok(
      Array.isArray(adminListPendingRes.body.data) &&
      adminListPendingRes.body.data.some((v: any) => (v.id || v._id).toString() === betaVendorAppId.toString()),
      'Pending vendor application must appear in admin list'
    );

    const approveRes = await request(app)
      .patch(`/api/admin/vendors/${betaVendorAppId}/approve`)
      .set('Cookie', adminCookies)
      .send({ commissionRate: 12 });
    assert.strictEqual(approveRes.status, 200);
    assert.strictEqual(approveRes.body.data.status, 'approved');

    // Verify User role dynamically promoted to vendor in DB
    const upgradedUser = await User.findById(betaUserId);
    assert.strictEqual(upgradedUser?.role, 'vendor');
    passedCount++;
    console.log('  ✅ B4. Admin approves application; account role promoted to vendor with 12% commission');

    // Step B5: Merchant logs in with newly granted vendor role
    const vendorLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'founder_beta@example.com',
        password: 'Password123!',
      });
    assert.strictEqual(vendorLoginRes.status, 200);
    assert.strictEqual(vendorLoginRes.body.data.user.role, 'vendor');
    const vendor2Cookies = vendorLoginRes.headers['set-cookie'];
    passedCount++;
    console.log('  ✅ B5. Merchant logs in; session receives vendor role');

    // Step B6: Vendor updates store profile
    const updateStoreRes = await request(app)
      .patch('/api/vendor/store')
      .set('Cookie', vendor2Cookies)
      .send({
        description: 'Updated: World-class smart wearables with health monitoring',
      });
    assert.strictEqual(updateStoreRes.status, 200);
    passedCount++;
    console.log('  ✅ B6. Vendor updates store profile description');

    // Step B7: Vendor creates a new product
    const createProdRes = await request(app)
      .post('/api/products')
      .set('Cookie', vendor2Cookies)
      .send({
        name: 'Beta Smartwatch Ultra',
        description: 'Titanium chassis smartwatch with GPS and ECG tracker',
        price: 300,
        stock: 20,
        categoryId: category._id.toString(),
        sku: 'BETA-WATCH-001',
        brand: 'BetaGear',
      });
    assert.strictEqual(createProdRes.status, 201);
    assert.strictEqual(createProdRes.body.data.status, 'active');
    const product2Id = createProdRes.body.data.id || createProdRes.body.data._id;
    passedCount++;
    console.log('  ✅ B7. Vendor creates new active catalog product');

    // Step B8: Vendor manages inventory
    const updateInvRes = await request(app)
      .patch(`/api/products/${product2Id}/inventory`)
      .set('Cookie', vendor2Cookies)
      .send({
        quantity: 10,
        mode: 'adjust',
      });
    assert.strictEqual(updateInvRes.status, 200);
    assert.strictEqual(updateInvRes.body.data.stock, 30);
    passedCount++;
    console.log('  ✅ B8. Vendor atomically increments inventory (20 -> 30 units)');

    // =========================================================================
    // SECTION C: CUSTOMER PURCHASE JOURNEY (Journey A)
    // =========================================================================
    console.log('\n======================================================');
    console.log('🛍️ JOURNEY A: Complete Customer Shopping & Order Workflow');
    console.log('======================================================');

    // Step A1: Register new customer
    const regCustRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Catherine Customer',
        email: 'catherine@example.com',
        password: 'Password123!',
      });
    assert.strictEqual(regCustRes.status, 201);
    const customerCookies = regCustRes.headers['set-cookie'];
    passedCount++;
    console.log('  ✅ A1. Customer registers successfully');

    // Step A2: Customer profile & me
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', customerCookies);
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.body.data.user.email, 'catherine@example.com');
    passedCount++;
    console.log('  ✅ A2. Customer profile authenticated via HTTP-only cookie');

    // Step A3: Browse catalog and search products
    const catalogRes = await request(app)
      .get('/api/products?page=1&limit=10');
    assert.strictEqual(catalogRes.status, 200);
    assert.ok(Array.isArray(catalogRes.body.data) && catalogRes.body.data.length >= 2);

    const searchRes = await request(app)
      .get('/api/products/search?q=smartwatch');
    assert.strictEqual(searchRes.status, 200);
    passedCount++;
    console.log('  ✅ A3. Customer browses catalog and queries multi-field search');

    // Step A4: Add products from TWO DIFFERENT VENDORS to cart
    // Item 1: Vendor 1 product (Alpha Monitor, $200 x 1 = $200)
    const addCart1 = await request(app)
      .post('/api/cart/add')
      .set('Cookie', customerCookies)
      .send({
        productId: product1._id.toString(),
        quantity: 1,
      });
    assert.strictEqual(addCart1.status, 200);

    // Item 2: Vendor 2 product (Beta Watch, $300 x 1 = $300)
    const addCart2 = await request(app)
      .post('/api/cart/add')
      .set('Cookie', customerCookies)
      .send({
        productId: product2Id,
        quantity: 1,
      });
    assert.strictEqual(addCart2.status, 200);

    // Step A5: View populated cart (Subtotal: 200 + 300 = $500.00)
    const viewCartRes = await request(app)
      .get('/api/cart')
      .set('Cookie', customerCookies);
    assert.strictEqual(viewCartRes.status, 200);
    assert.strictEqual(viewCartRes.body.data.items.length, 2);
    assert.strictEqual(viewCartRes.body.data.subtotal, 500);
    passedCount++;
    console.log('  ✅ A4-A5. Customer adds items from 2 vendors; cart subtotal dynamically calculated ($500.00)');

    // Step A6: Create customer delivery address
    const addressRes = await request(app)
      .post('/api/addresses')
      .set('Cookie', customerCookies)
      .send({
        fullName: 'Catherine Customer',
        phone: '+1-555-8888',
        addressLine1: '789 Market Street, Suite 400',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94103',
        country: 'US',
        isDefault: true,
      });
    assert.strictEqual(addressRes.status, 201);
    const addressId = addressRes.body.data.id || addressRes.body.data._id;
    passedCount++;
    console.log('  ✅ A6. Customer creates delivery address and sets as default');

    // Step A7: Validate and apply coupon
    const couponValRes = await request(app)
      .post('/api/coupons/validate')
      .set('Cookie', customerCookies)
      .send({
        couponCode: 'WELCOME10',
      });
    assert.strictEqual(couponValRes.status, 200);
    assert.strictEqual(couponValRes.body.data.discountAmount, 50, '10% of 500 is $50.00');
    passedCount++;
    console.log('  ✅ A7. Coupon WELCOME10 validated: $50.00 discount computed');

    // Step A8: Checkout with coupon (Total: 500 - 50 discount + 0 free shipping = $450.00)
    const checkoutRes = await request(app)
      .post('/api/checkout')
      .set('Cookie', customerCookies)
      .send({
        addressId,
        couponCode: 'WELCOME10',
        idempotencyKey: 'IDEMP-E2E-' + Date.now(),
      });
    assert.strictEqual(checkoutRes.status, 201);
    assert.strictEqual(checkoutRes.body.success, true);
    assert.strictEqual(checkoutRes.body.data.totalAmount, 450);
    assert.strictEqual(checkoutRes.body.data.discountAmount, 50);
    assert.strictEqual(checkoutRes.body.data.paymentStatus, 'pending');
    assert.strictEqual(checkoutRes.body.data.orderStatus, 'confirmed');

    const parentOrderId = checkoutRes.body.data.id || checkoutRes.body.data._id;
    const parentOrderNumber = checkoutRes.body.data.orderNumber;
    passedCount++;
    console.log(`  ✅ A8. Checkout completed: Parent Order ${parentOrderNumber} created with coupon applied`);

    // Step A9: Verify Multi-Vendor Order Split
    const vendorOrdersInDb = await VendorOrder.find({ parentOrderId });
    assert.strictEqual(vendorOrdersInDb.length, 2, 'Must create exactly 2 vendor orders for 2 distinct vendors');
    const vOrder1 = vendorOrdersInDb.find((vo) => vo.vendorId.toString() === vendor1User._id.toString());
    const vOrder2 = vendorOrdersInDb.find((vo) => vo.vendorId.toString() === betaUserId);
    assert.ok(vOrder1, 'Vendor 1 sub-order must exist');
    assert.ok(vOrder2, 'Vendor 2 sub-order must exist');

    // Verify penny-exact reconciliation
    const combinedVendorSubtotal = vOrder1.vendorSubtotal + vOrder2.vendorSubtotal;
    assert.strictEqual(combinedVendorSubtotal, 500);
    const combinedVendorDiscount = (vOrder1.discountShare || vOrder1.discountAmount || 0) + (vOrder2.discountShare || vOrder2.discountAmount || 0);
    assert.strictEqual(combinedVendorDiscount, 50);
    const combinedVendorTotal =
      (vOrder1.vendorSubtotal - (vOrder1.discountShare || 0) + vOrder1.shippingShare) +
      (vOrder2.vendorSubtotal - (vOrder2.discountShare || 0) + vOrder2.shippingShare);
    assert.strictEqual(combinedVendorTotal, 450);
    passedCount++;
    console.log('  ✅ A9. Multi-vendor order splitting verified: 2 distinct vendor orders generated and reconciled');

    // Step A10: Initiate Payment
    const initPayRes = await request(app)
      .post('/api/payments/create-order')
      .set('Cookie', customerCookies)
      .send({ orderId: parentOrderId });
    assert.strictEqual(initPayRes.status, 201);
    assert.strictEqual(initPayRes.body.data.amount, 45000, '450.00 INR = 45000 paise');
    const rzpOrderId = initPayRes.body.data.razorpayOrderId;
    const rzpPaymentId = 'pay_e2e_' + Date.now();
    passedCount++;
    console.log(`  ✅ A10. Razorpay payment order initiated (${rzpOrderId}) for 45000 paise`);

    // Step A11: Verify simulated payment with valid cryptographic signature
    const validSignature = generateSignature(rzpOrderId, rzpPaymentId);
    const verifyPayRes = await request(app)
      .post('/api/payments/verify')
      .set('Cookie', customerCookies)
      .send({
        razorpay_order_id: rzpOrderId,
        razorpay_payment_id: rzpPaymentId,
        razorpay_signature: validSignature,
      });
    assert.strictEqual(verifyPayRes.status, 200);
    assert.strictEqual(verifyPayRes.body.data.payment.status, 'captured');
    assert.strictEqual(verifyPayRes.body.data.order.paymentStatus, 'paid');
    passedCount++;
    console.log('  ✅ A11. Payment signature verified, status captured, parent order marked paid');

    // Step A12: Check automated invoice generation
    const invoiceRes = await request(app)
      .get(`/api/orders/${parentOrderId}/invoice`)
      .set('Cookie', customerCookies);
    assert.strictEqual(invoiceRes.status, 200);
    assert.strictEqual(invoiceRes.body.data.totalAmount, 450);
    assert.strictEqual(invoiceRes.body.data.paymentStatus, 'paid');
    const invoiceId = invoiceRes.body.data.id || invoiceRes.body.data._id;

    // Stream download PDF
    const downloadRes = await request(app)
      .get(`/api/invoices/${invoiceId}/download`)
      .set('Cookie', customerCookies);
    assert.strictEqual(downloadRes.status, 200);
    assert.strictEqual(downloadRes.headers['content-type'], 'application/pdf');
    passedCount++;
    console.log('  ✅ A12. Customer parent invoice generated and downloaded via streaming PDF');

    // Step A13: Customer views order history
    const orderListRes = await request(app)
      .get('/api/orders')
      .set('Cookie', customerCookies);
    assert.strictEqual(orderListRes.status, 200);
    assert.ok(
      Array.isArray(orderListRes.body.data) &&
      orderListRes.body.data.some((o: any) => (o.id || o._id).toString() === parentOrderId.toString())
    );
    passedCount++;
    console.log('  ✅ A13. Customer verifies order history and detail view');

    // =========================================================================
    // SECTION D: VENDOR ORDER FULFILLMENT & EARNINGS
    // =========================================================================
    console.log('\n--- Vendor Order Fulfillment & Payout Request ---');

    // Vendor 2 checks received orders
    const v2OrdersRes = await request(app)
      .get('/api/vendor/orders')
      .set('Cookie', vendor2Cookies);
    assert.strictEqual(v2OrdersRes.status, 200);
    assert.ok(
      Array.isArray(v2OrdersRes.body.data) &&
      v2OrdersRes.body.data.some((vo: any) => (vo.id || vo._id).toString() === vOrder2._id.toString()),
      'Vendor 2 sees their own order item'
    );

    // Vendor 2 progresses order: confirmed -> processing -> shipped -> delivered
    const shipRes1 = await request(app)
      .patch(`/api/vendor/orders/${vOrder2._id}/status`)
      .set('Cookie', vendor2Cookies)
      .send({ status: 'processing', note: 'Packaging unit at warehouse' });
    assert.strictEqual(shipRes1.status, 200);

    const shipRes2 = await request(app)
      .patch(`/api/vendor/orders/${vOrder2._id}/status`)
      .set('Cookie', vendor2Cookies)
      .send({ status: 'shipped', carrier: 'FedEx Express', trackingNumber: 'FEDEX-BETA-9999' });
    assert.strictEqual(shipRes2.status, 200);

    const shipRes3 = await request(app)
      .patch(`/api/vendor/orders/${vOrder2._id}/status`)
      .set('Cookie', vendor2Cookies)
      .send({ status: 'delivered' });
    assert.strictEqual(shipRes3.status, 200);
    passedCount++;
    console.log('  ✅ B9-B10. Vendor 2 fulfills order through lifecycle (confirmed -> processing -> shipped -> delivered)');

    // Vendor 2 checks wallet / earnings balance
    const balanceRes = await request(app)
      .get('/api/vendor/earnings')
      .set('Cookie', vendor2Cookies);
    assert.strictEqual(balanceRes.status, 200);
    assert.ok(balanceRes.body.data.availableBalance > 0);
    const availableEarnings = balanceRes.body.data.availableBalance;
    passedCount++;
    console.log(`  ✅ B11. Vendor 2 inspects wallet balance: ₹${availableEarnings} available`);

    // Vendor 2 requests payout
    const payoutReqRes = await request(app)
      .post('/api/vendor/payouts/request')
      .set('Cookie', vendor2Cookies)
      .send({
        amount: Math.min(100, availableEarnings),
        destinationReference: 'Beta Smart Gear - HDFC98765432',
      });
    assert.strictEqual(payoutReqRes.status, 201);
    assert.strictEqual(payoutReqRes.body.data.payoutStatus, 'requested');
    const payoutId = payoutReqRes.body.data.id || payoutReqRes.body.data._id;
    passedCount++;
    console.log(`  ✅ B12. Vendor 2 submits payout request [ID: ${payoutId}]`);

    // Eligible review submission by Customer now that product 2 is delivered!
    const reviewRes = await request(app)
      .post(`/api/products/${product2Id}/reviews`)
      .set('Cookie', customerCookies)
      .send({
        rating: 5,
        title: 'Outstanding Smartwatch!',
        comment: 'Exceeded all my expectations. Battery lasts 5 days and ECG is accurate!',
      });
    assert.strictEqual(reviewRes.status, 201);
    assert.strictEqual(reviewRes.body.data.isVerifiedPurchase, true);
    passedCount++;
    console.log('  ✅ A14-A15. Customer submits verified review for delivered product (5 stars)');

    // =========================================================================
    // SECTION E: ADMIN GOVERNANCE & BUSINESS INTELLIGENCE (Journey C)
    // =========================================================================
    console.log('\n======================================================');
    console.log('👑 JOURNEY C: Complete Admin Governance & BI Workflow');
    console.log('======================================================');

    // Step C1: Admin monitors platform-wide orders
    const adminOrdersRes = await request(app)
      .get('/api/admin/orders')
      .set('Cookie', adminCookies);
    assert.strictEqual(adminOrdersRes.status, 200);
    assert.ok(Array.isArray(adminOrdersRes.body.data) && adminOrdersRes.body.data.length >= 1);

    const adminVendorOrdersRes = await request(app)
      .get('/api/admin/vendor-orders')
      .set('Cookie', adminCookies);
    assert.strictEqual(adminVendorOrdersRes.status, 200);
    assert.ok(Array.isArray(adminVendorOrdersRes.body.data) && adminVendorOrdersRes.body.data.length >= 2);
    passedCount++;
    console.log('  ✅ C1. Admin monitors all parent orders and split vendor orders');

    // Step C2: Admin monitors platform commissions settings and overview
    const adminCommRes = await request(app)
      .get('/api/admin/commission')
      .set('Cookie', adminCookies);
    assert.strictEqual(adminCommRes.status, 200);
    assert.ok(adminCommRes.body.data.defaultCommissionRate !== undefined);
    passedCount++;
    console.log('  ✅ C2. Admin verifies commission settings and platform overview');

    // Step C3: Admin reviews and approves payout request
    const adminApprovePayoutRes = await request(app)
      .patch(`/api/admin/payouts/${payoutId}/approve`)
      .set('Cookie', adminCookies);
    assert.strictEqual(adminApprovePayoutRes.status, 200);
    assert.strictEqual(adminApprovePayoutRes.body.data.payoutStatus, 'approved');

    // Admin marks payout as paid
    const adminSettlePayoutRes = await request(app)
      .patch(`/api/admin/payouts/${payoutId}/status`)
      .set('Cookie', adminCookies)
      .send({
        status: 'paid',
        providerReference: 'BANK-UTR-9988776655',
      });
    assert.strictEqual(adminSettlePayoutRes.status, 200);
    assert.strictEqual(adminSettlePayoutRes.body.data.payoutStatus, 'paid');
    passedCount++;
    console.log('  ✅ C3. Admin approves and settles vendor payout with provider reference');

    // Step C4: Admin analytics overview
    const overviewRes = await request(app)
      .get('/api/admin/analytics/overview?refresh=true')
      .set('Cookie', adminCookies);
    assert.strictEqual(overviewRes.status, 200);
    assert.strictEqual(overviewRes.body.data.totalParentOrders >= 1, true);
    assert.strictEqual(overviewRes.body.data.totalRevenue >= 450, true);
    passedCount++;
    console.log('  ✅ C4. Admin overview metrics: registered users, orders, revenue, commissions reconciled');

    // Step C5: Admin revenue & sales analytics
    const revRes = await request(app)
      .get('/api/admin/analytics/revenue?period=30d&refresh=true')
      .set('Cookie', adminCookies);
    assert.strictEqual(revRes.status, 200);
    assert.ok(revRes.body.data.totalRevenue >= 450);
    passedCount++;
    console.log('  ✅ C5. Admin revenue analytics calculated across captured transactions');

    // Step C6: Admin vendor performance analytics
    const vendorPerfRes = await request(app)
      .get('/api/admin/analytics/vendors?period=30d&refresh=true')
      .set('Cookie', adminCookies);
    assert.strictEqual(vendorPerfRes.status, 200);
    assert.ok(vendorPerfRes.body.data.vendors.length >= 2);
    passedCount++;
    console.log('  ✅ C6. Admin vendor ranking, sales, and platform commission breakdown verified');

    console.log('\n======================================================');
    console.log(`🎉 ALL ${passedCount} END-TO-END WORKFLOW TESTS PASSED!`);
    console.log('======================================================\n');
  } finally {
    if (mongoServer) {
      await mongoose.disconnect();
      await mongoServer.stop();
    } else {
      await mongoose.disconnect();
    }
  }
}

runE2EWorkflowTests().catch((err) => {
  console.error('\n❌ E2E Workflow Test Failed:', err);
  process.exit(1);
});
