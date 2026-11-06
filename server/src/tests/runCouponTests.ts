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
  Cart,
  Address,
  Order,
  VendorOrder,
  Coupon,
  CouponUsage,
} from '../models';
import { PaymentService } from '../services/payment.service';
import { generateAccessToken, AUTH_COOKIE_NAME } from '../utils/token';

const getCookies = (token: string): string[] => [`${AUTH_COOKIE_NAME}=${token}; Path=/; HttpOnly`];

async function runCouponTestSuite() {
  console.log('\n================================================================');
  console.log('🧪 Starting Phase 9B — Coupon & Discount Management Integration Tests');
  console.log('================================================================\n');

  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'super_secret_test_jwt_key_at_least_32_characters_long';
  process.env.JWT_ACCESS_EXPIRY = '15m';

  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
  console.log('📦 Connected to in-memory MongoDB instance for Coupon testing.');

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
    console.log('\n🌱 Provisioning seed users, products, categories, and addresses...');

    // 1. Admin
    const adminUser = await User.create({
      name: 'Super Admin',
      email: 'admin@marketplace.com',
      password: 'Password123!',
      role: 'admin',
    });
    const adminToken = generateAccessToken({
      id: adminUser._id.toString(),
      email: adminUser.email,
      role: adminUser.role,
    });

    // 2. Vendors & Categories
    const categoryElectronics = await Category.create({
      name: 'Consumer Electronics',
      slug: 'electronics',
      description: 'Gadgets & Audio',
      isActive: true,
    });

    const categoryBooks = await Category.create({
      name: 'Books & Literature',
      slug: 'books',
      description: 'Physical & digital books',
      isActive: true,
    });

    const vendor1 = await User.create({
      name: 'Apex Audio Merchant',
      email: 'apex@audio.com',
      password: 'Password123!',
      role: 'vendor',
    });
    await VendorProfile.create({
      userId: vendor1._id,
      storeName: 'Apex Audio Store',
      slug: 'apex-audio-store',
      description: 'High-end audio equipment',
      businessEmail: 'contact@apex.com',
      businessPhone: '+919876543211',
      businessAddress: {
        street: '12 Sound St',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001',
        country: 'India',
      },
      status: 'approved',
    });

    const vendor2 = await User.create({
      name: 'BookWorld Merchant',
      email: 'book@world.com',
      password: 'Password123!',
      role: 'vendor',
    });
    await VendorProfile.create({
      userId: vendor2._id,
      storeName: 'BookWorld Store',
      slug: 'bookworld-store',
      description: 'Books of all genres',
      businessEmail: 'contact@bookworld.com',
      businessPhone: '+919876543212',
      businessAddress: {
        street: '45 Page Rd',
        city: 'Delhi',
        state: 'Delhi',
        postalCode: '110001',
        country: 'India',
      },
      status: 'approved',
    });

    // 3. Products
    const product1 = await Product.create({
      name: 'Apex Studio Headset',
      description: 'High fidelity audio headset',
      price: 100.0,
      categoryId: categoryElectronics._id,
      vendorId: vendor1._id,
      stock: 50,
      sku: 'APX-HD-001',
      status: 'active',
      isDeleted: false,
    });

    const product2 = await Product.create({
      name: 'Apex Audio Cable',
      description: 'Gold-plated 3.5mm audio cable',
      price: 50.0,
      categoryId: categoryElectronics._id,
      vendorId: vendor1._id,
      stock: 50,
      sku: 'APX-CB-002',
      status: 'active',
      isDeleted: false,
    });

    const product3 = await Product.create({
      name: 'TypeScript Mastery Book',
      description: 'Comprehensive guide to TypeScript',
      price: 80.0,
      categoryId: categoryBooks._id,
      vendorId: vendor2._id,
      stock: 50,
      sku: 'BK-TS-003',
      status: 'active',
      isDeleted: false,
    });

    // 4. Customers
    const customer1 = await User.create({
      name: 'Alice Johnson',
      email: 'alice@customer.com',
      password: 'Password123!',
      role: 'customer',
    });
    const customer1Token = generateAccessToken({
      id: customer1._id.toString(),
      email: customer1.email,
      role: customer1.role,
    });

    const customer2 = await User.create({
      name: 'Bob Smith',
      email: 'bob@customer.com',
      password: 'Password123!',
      role: 'customer',
    });
    const customer2Token = generateAccessToken({
      id: customer2._id.toString(),
      email: customer2.email,
      role: customer2.role,
    });

    // 5. Addresses
    const address1 = await Address.create({
      userId: customer1._id,
      fullName: 'Alice Johnson',
      phone: '+919876543210',
      addressLine1: '100 Sunset Blvd',
      city: 'Bangalore',
      state: 'Karnataka',
      postalCode: '560001',
      country: 'India',
      isDefault: true,
    });

    const address2 = await Address.create({
      userId: customer2._id,
      fullName: 'Bob Smith',
      phone: '+919876543220',
      addressLine1: '200 Ocean Dr',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400001',
      country: 'India',
      isDefault: true,
    });

    const setCart = async (
      cust: any,
      items: Array<{ product: any; quantity: number }>
    ) => {
      await Cart.findOneAndUpdate(
        { userId: cust._id },
        {
          userId: cust._id,
          items: items.map((it) => ({
            productId: it.product._id,
            quantity: it.quantity,
          })),
        },
        { upsert: true, new: true }
      );
    };

    console.log('✅ Base seeding successfully initialized.\n');

    // ==========================================================================
    // Test Case 1: Create percentage coupon
    // ==========================================================================
    await testCase('1. Create percentage coupon (Admin API)', async () => {
      const res = await request(app)
        .post('/api/admin/coupons')
        .set('Cookie', getCookies(adminToken))
        .send({
          code: 'SUMMER20',
          description: '20% off with max cap of $50',
          discountType: 'percentage',
          discountValue: 20,
          maximumDiscountAmount: 50,
          minimumOrderAmount: 100,
          startDate: new Date(Date.now() - 3600000).toISOString(),
          expiryDate: new Date(Date.now() + 30 * 24 * 3600000).toISOString(),
          totalUsageLimit: 500,
          perUserUsageLimit: 2,
          isActive: true,
        });

      assert.strictEqual(res.status, 201, `Expected 201 Created but got ${res.status}`);
      assert.strictEqual(res.body.data.code, 'SUMMER20');
      assert.strictEqual(res.body.data.discountType, 'percentage');
      assert.strictEqual(res.body.data.discountValue, 20);
      assert.strictEqual(res.body.data.maximumDiscountAmount, 50);
    });

    // ==========================================================================
    // Test Case 2: Create fixed discount coupon
    // ==========================================================================
    await testCase('2. Create fixed discount coupon (Admin API)', async () => {
      const res = await request(app)
        .post('/api/admin/coupons')
        .set('Cookie', getCookies(adminToken))
        .send({
          code: 'FLAT30',
          description: '$30 flat discount on orders over $80',
          discountType: 'fixed',
          discountValue: 30,
          minimumOrderAmount: 80,
          startDate: new Date(Date.now() - 3600000).toISOString(),
          expiryDate: new Date(Date.now() + 30 * 24 * 3600000).toISOString(),
          totalUsageLimit: 100,
          perUserUsageLimit: 1,
          isActive: true,
        });

      assert.strictEqual(res.status, 201, `Expected 201 Created but got ${res.status}`);
      assert.strictEqual(res.body.data.code, 'FLAT30');
      assert.strictEqual(res.body.data.discountType, 'fixed');
      assert.strictEqual(res.body.data.discountValue, 30);
    });

    // ==========================================================================
    // Test Case 3: Apply valid coupon
    // ==========================================================================
    await testCase('3. Apply valid coupon (validation API calculations)', async () => {
      // Customer 1 cart: Product 1 (qty 2 = $200)
      await setCart(customer1, [{ product: product1, quantity: 2 }]);

      const res = await request(app)
        .post('/api/coupons/validate')
        .set('Cookie', getCookies(customer1Token))
        .send({ couponCode: 'SUMMER20' });

      assert.strictEqual(res.status, 200, `Expected 200 OK but got ${res.status}`);
      assert.strictEqual(res.body.data.valid, true);
      assert.strictEqual(res.body.data.cartSubtotal, 200);
      assert.strictEqual(res.body.data.eligibleSubtotal, 200);
      // 20% of 200 is 40
      assert.strictEqual(res.body.data.discountAmount, 40);
      assert.strictEqual(res.body.data.shippingAmount, 0); // subtotal >= 100
      assert.strictEqual(res.body.data.finalPayable, 160);
    });

    // ==========================================================================
    // Test Case 4: Apply expired coupon
    // ==========================================================================
    await testCase('4. Apply expired coupon (rejection check)', async () => {
      await Coupon.create({
        code: 'EXPIRED50',
        description: 'Expired promo',
        discountType: 'percentage',
        discountValue: 50,
        minimumOrderAmount: 0,
        startDate: new Date(Date.now() - 10000000),
        expiryDate: new Date(Date.now() - 1000),
        createdBy: adminUser._id,
        isActive: true,
      });

      const res = await request(app)
        .post('/api/coupons/validate')
        .set('Cookie', getCookies(customer1Token))
        .send({ couponCode: 'EXPIRED50' });

      assert.strictEqual(res.status, 400, `Expected 400 Bad Request but got ${res.status}`);
      assert(
        res.body.error?.message?.toLowerCase().includes('expired'),
        'Error must state coupon has expired'
      );
    });

    // ==========================================================================
    // Test Case 5: Apply inactive coupon
    // ==========================================================================
    await testCase('5. Apply inactive coupon (rejection check)', async () => {
      await Coupon.create({
        code: 'INACTIVE10',
        description: 'Inactive promo',
        discountType: 'percentage',
        discountValue: 10,
        minimumOrderAmount: 0,
        startDate: new Date(Date.now() - 3600000),
        expiryDate: new Date(Date.now() + 30 * 24 * 3600000),
        createdBy: adminUser._id,
        isActive: false,
      });

      const res = await request(app)
        .post('/api/coupons/validate')
        .set('Cookie', getCookies(customer1Token))
        .send({ couponCode: 'INACTIVE10' });

      assert.strictEqual(res.status, 400, `Expected 400 Bad Request but got ${res.status}`);
      assert(
        res.body.error?.message?.toLowerCase().includes('inactive'),
        'Error must state coupon is inactive'
      );
    });

    // ==========================================================================
    // Test Case 6: Apply coupon before start date
    // ==========================================================================
    await testCase('6. Apply coupon before start date (rejection check)', async () => {
      await Coupon.create({
        code: 'FUTURE25',
        description: 'Future promo',
        discountType: 'percentage',
        discountValue: 25,
        minimumOrderAmount: 0,
        startDate: new Date(Date.now() + 7 * 24 * 3600000),
        expiryDate: new Date(Date.now() + 30 * 24 * 3600000),
        createdBy: adminUser._id,
        isActive: true,
      });

      const res = await request(app)
        .post('/api/coupons/validate')
        .set('Cookie', getCookies(customer1Token))
        .send({ couponCode: 'FUTURE25' });

      assert.strictEqual(res.status, 400, `Expected 400 Bad Request but got ${res.status}`);
      assert(
        res.body.error?.message?.toLowerCase().includes('not active yet'),
        'Error must state coupon is not active yet'
      );
    });

    // ==========================================================================
    // Test Case 7: Test minimum order amount
    // ==========================================================================
    await testCase('7. Test minimum order amount (under-minimum cart rejected)', async () => {
      // Customer 1 cart: Product 2 (qty 1 = $50). Minimum order for SUMMER20 is $100.
      await setCart(customer1, [{ product: product2, quantity: 1 }]);

      const res = await request(app)
        .post('/api/coupons/validate')
        .set('Cookie', getCookies(customer1Token))
        .send({ couponCode: 'SUMMER20' });

      assert.strictEqual(res.status, 400, `Expected 400 Bad Request but got ${res.status}`);
      assert(
        res.body.error?.message?.toLowerCase().includes('minimum order amount'),
        'Error must state minimum order amount required'
      );
    });

    // ==========================================================================
    // Test Case 8: Test maximum discount cap
    // ==========================================================================
    await testCase('8. Test maximum discount cap (discount capped at limit)', async () => {
      // Customer 1 cart: Product 1 (qty 5 = $500).
      // 20% of $500 is $100, but SUMMER20 has maximumDiscountAmount = 50.
      await setCart(customer1, [{ product: product1, quantity: 5 }]);

      const res = await request(app)
        .post('/api/coupons/validate')
        .set('Cookie', getCookies(customer1Token))
        .send({ couponCode: 'SUMMER20' });

      assert.strictEqual(res.status, 200, `Expected 200 OK but got ${res.status}`);
      assert.strictEqual(res.body.data.cartSubtotal, 500);
      assert.strictEqual(res.body.data.discountAmount, 50); // capped at $50
      assert.strictEqual(res.body.data.finalPayable, 450); // 500 - 50 = 450
    });

    // ==========================================================================
    // Test Case 9: Test global usage limit
    // ==========================================================================
    await testCase('9. Test global usage limit (exhausted coupon rejected)', async () => {
      await Coupon.create({
        code: 'GLOBALONE',
        description: 'Single global redemption',
        discountType: 'fixed',
        discountValue: 15,
        minimumOrderAmount: 0,
        startDate: new Date(Date.now() - 3600000),
        expiryDate: new Date(Date.now() + 30 * 24 * 3600000),
        totalUsageLimit: 1,
        usageCount: 1, // already exhausted
        createdBy: adminUser._id,
        isActive: true,
      });

      await setCart(customer1, [{ product: product1, quantity: 1 }]);

      const res = await request(app)
        .post('/api/coupons/validate')
        .set('Cookie', getCookies(customer1Token))
        .send({ couponCode: 'GLOBALONE' });

      assert.strictEqual(res.status, 400, `Expected 400 Bad Request but got ${res.status}`);
      assert(
        res.body.error?.message?.toLowerCase().includes('global usage limit'),
        'Error must state global usage limit has been reached'
      );
    });

    // ==========================================================================
    // Test Case 10: Test per-user usage limit
    // ==========================================================================
    await testCase('10. Test per-user usage limit (customer who used coupon rejected)', async () => {
      const couponPerUser = await Coupon.create({
        code: 'USERLIMIT1',
        description: 'Only once per customer',
        discountType: 'fixed',
        discountValue: 10,
        minimumOrderAmount: 0,
        startDate: new Date(Date.now() - 3600000),
        expiryDate: new Date(Date.now() + 30 * 24 * 3600000),
        perUserUsageLimit: 1,
        createdBy: adminUser._id,
        isActive: true,
      });

      // Simulate prior redemption by Customer 1
      await CouponUsage.create({
        couponId: couponPerUser._id,
        customerId: customer1._id,
        orderId: new Types.ObjectId(),
        discountAmount: 10,
        status: 'applied',
      });

      // Customer 1 validates again -> rejected
      const resC1 = await request(app)
        .post('/api/coupons/validate')
        .set('Cookie', getCookies(customer1Token))
        .send({ couponCode: 'USERLIMIT1' });

      assert.strictEqual(resC1.status, 400);
      assert(
        resC1.body.error?.message?.toLowerCase().includes('maximum redemption limit'),
        'Error must state user reached maximum redemption limit'
      );

      // Customer 2 validates for the first time -> accepted!
      await setCart(customer2, [{ product: product1, quantity: 1 }]);
      const resC2 = await request(app)
        .post('/api/coupons/validate')
        .set('Cookie', getCookies(customer2Token))
        .send({ couponCode: 'USERLIMIT1' });

      assert.strictEqual(resC2.status, 200, 'Different customer should be able to redeem coupon');
    });

    // ==========================================================================
    // Test Case 11: Test vendor-specific coupon
    // ==========================================================================
    await testCase('11. Test vendor-specific coupon (applies only to vendor items)', async () => {
      const vendorCoupon = await Coupon.create({
        code: 'APEXONLY20',
        description: '20% off Apex Audio products only',
        discountType: 'percentage',
        discountValue: 20,
        minimumOrderAmount: 0,
        startDate: new Date(Date.now() - 3600000),
        expiryDate: new Date(Date.now() + 30 * 24 * 3600000),
        applicableVendors: [vendor1._id],
        createdBy: adminUser._id,
        isActive: true,
      });

      // Customer 1 cart: Product 1 (Apex, $100) + Product 3 (BookWorld, $80) = $180 subtotal
      await setCart(customer1, [
        { product: product1, quantity: 1 },
        { product: product3, quantity: 1 },
      ]);

      const res = await request(app)
        .post('/api/coupons/validate')
        .set('Cookie', getCookies(customer1Token))
        .send({ couponCode: 'APEXONLY20' });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.cartSubtotal, 180);
      assert.strictEqual(res.body.data.eligibleSubtotal, 100); // only Apex product
      assert.strictEqual(res.body.data.discountAmount, 20); // 20% of 100 = 20 (NOT 20% of 180)
      assert.strictEqual(res.body.data.finalPayable, 160); // 180 - 20 = 160
    });

    // ==========================================================================
    // Test Case 12: Test invalid coupon code
    // ==========================================================================
    await testCase('12. Test invalid coupon code (non-existent code returns 404)', async () => {
      const res = await request(app)
        .post('/api/coupons/validate')
        .set('Cookie', getCookies(customer1Token))
        .send({ couponCode: 'NOT_A_REAL_COUPON_123' });

      assert.strictEqual(res.status, 404, `Expected 404 Not Found but got ${res.status}`);
      assert(
        res.body.error?.message?.toLowerCase().includes('does not exist'),
        'Error must state coupon does not exist'
      );
    });

    // ==========================================================================
    // Test Case 13: Test simultaneous coupon redemption (concurrency guard)
    // ==========================================================================
    await testCase('13. Test simultaneous coupon redemption (atomic usage cap guard)', async () => {
      // Create a coupon with totalUsageLimit: 1
      const scarceCoupon = await Coupon.create({
        code: 'RACECOUPON1',
        description: 'Only 1 user in the entire system can use this',
        discountType: 'fixed',
        discountValue: 20,
        minimumOrderAmount: 0,
        startDate: new Date(Date.now() - 3600000),
        expiryDate: new Date(Date.now() + 30 * 24 * 3600000),
        totalUsageLimit: 1,
        usageCount: 0,
        createdBy: adminUser._id,
        isActive: true,
      });

      // Prepare carts for both customers
      await setCart(customer1, [{ product: product1, quantity: 1 }]);
      await setCart(customer2, [{ product: product1, quantity: 1 }]);

      // Fire checkouts simultaneously
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/checkout')
          .set('Cookie', getCookies(customer1Token))
          .send({
            addressId: address1._id.toString(),
            couponCode: 'RACECOUPON1',
            idempotencyKey: `sim-c1-${Date.now()}`,
          }),
        request(app)
          .post('/api/checkout')
          .set('Cookie', getCookies(customer2Token))
          .send({
            addressId: address2._id.toString(),
            couponCode: 'RACECOUPON1',
            idempotencyKey: `sim-c2-${Date.now()}`,
          }),
      ]);

      const statuses = [res1.status, res2.status];
      // Exactly one must succeed (201) and the other must fail (400)
      assert(
        statuses.includes(201),
        `At least one checkout must succeed, got statuses: ${statuses.join(', ')}`
      );
      assert(
        statuses.includes(400),
        `Second simultaneous checkout must fail with 400, got statuses: ${statuses.join(', ')}`
      );

      // Verify DB usageCount is exactly 1
      const updatedCoupon = await Coupon.findById(scarceCoupon._id);
      assert.strictEqual(updatedCoupon?.usageCount, 1, 'Coupon usageCount must strictly equal 1');

      // Verify CouponUsage collection has exactly 1 entry
      const usageRecords = await CouponUsage.countDocuments({ couponId: scarceCoupon._id });
      assert.strictEqual(usageRecords, 1, 'Exactly one CouponUsage record must exist');
    });

    // ==========================================================================
    // Test Case 14: Test duplicate checkout submission (Idempotency)
    // ==========================================================================
    await testCase('14. Test duplicate checkout submission (idempotency prevents double usage)', async () => {
      const idempCoupon = await Coupon.create({
        code: 'IDEMPTEST',
        description: 'Test idempotency',
        discountType: 'fixed',
        discountValue: 10,
        minimumOrderAmount: 0,
        startDate: new Date(Date.now() - 3600000),
        expiryDate: new Date(Date.now() + 30 * 24 * 3600000),
        totalUsageLimit: 10,
        createdBy: adminUser._id,
        isActive: true,
      });

      await setCart(customer1, [{ product: product1, quantity: 1 }]);
      const idempotencyKey = `idemp-test-${Date.now()}-${Math.random()}`;

      // First submission
      const resFirst = await request(app)
        .post('/api/checkout')
        .set('Cookie', getCookies(customer1Token))
        .send({
          addressId: address1._id.toString(),
          couponCode: 'IDEMPTEST',
          idempotencyKey,
        });

      assert.strictEqual(resFirst.status, 201, `First checkout expected 201 Created but got ${resFirst.status}`);
      const orderId1 = resFirst.body.data.id;

      // Second duplicate submission with identical idempotencyKey
      const resSecond = await request(app)
        .post('/api/checkout')
        .set('Cookie', getCookies(customer1Token))
        .send({
          addressId: address1._id.toString(),
          couponCode: 'IDEMPTEST',
          idempotencyKey,
        });

      assert([200, 201].includes(resSecond.status), `Idempotent request must return 200/201, got ${resSecond.status}`);
      assert.strictEqual(resSecond.body.data.id, orderId1, 'Must return identical order');

      // Verify coupon usage was not incremented twice
      const couponRecord = await Coupon.findById(idempCoupon._id);
      assert.strictEqual(couponRecord?.usageCount, 1, 'Coupon usageCount must not double increment on retry');
    });

    // ==========================================================================
    // Test Case 15: Verify Razorpay amount matches final payable amount
    // ==========================================================================
    await testCase('15. Verify Razorpay amount matches final payable amount', async () => {
      // Customer 1 cart: Product 1 (qty 2 = $200). Use SUMMER20 (20% = $40 off). Total = $160.
      await setCart(customer1, [{ product: product1, quantity: 2 }]);

      const checkoutRes = await request(app)
        .post('/api/checkout')
        .set('Cookie', getCookies(customer1Token))
        .send({
          addressId: address1._id.toString(),
          couponCode: 'SUMMER20',
        });

      assert.strictEqual(checkoutRes.status, 201);
      const order = checkoutRes.body.data;
      assert.strictEqual(order.subtotal, 200);
      assert.strictEqual(order.discountAmount, 40);
      assert.strictEqual(order.totalAmount, 160);

      // Initiate payment order via PaymentService
      const rzpPaymentOrder = await PaymentService.createPaymentOrder(customer1._id.toString(), order.id);

      // Amount in Razorpay must be in paise (160 * 100 = 16000)
      assert.strictEqual(
        rzpPaymentOrder.amount,
        16000,
        `Razorpay order amount must be 16000 paise ($160.00), got ${rzpPaymentOrder.amount}`
      );
    });

    // ==========================================================================
    // Test Case 16: Verify order and vendor order totals reconcile
    // ==========================================================================
    await testCase('16. Verify order and vendor order totals reconcile (exact penny allocation)', async () => {
      // Customer cart: Product 1 (Vendor 1, $100) + Product 3 (Vendor 2, $80) = $180 subtotal
      await setCart(customer1, [
        { product: product1, quantity: 1 },
        { product: product3, quantity: 1 },
      ]);

      // Create a store-wide fixed discount coupon of $25
      await Coupon.create({
        code: 'STORE25',
        description: '$25 off storewide',
        discountType: 'fixed',
        discountValue: 25,
        minimumOrderAmount: 0,
        startDate: new Date(Date.now() - 3600000),
        expiryDate: new Date(Date.now() + 30 * 24 * 3600000),
        createdBy: adminUser._id,
        isActive: true,
      });

      const checkoutRes = await request(app)
        .post('/api/checkout')
        .set('Cookie', getCookies(customer1Token))
        .send({
          addressId: address1._id.toString(),
          couponCode: 'STORE25',
        });

      assert.strictEqual(checkoutRes.status, 201);
      const parentOrder = checkoutRes.body.data;

      // Subtotal = 180, Discount = 25, Shipping = 0, Total = 155
      assert.strictEqual(parentOrder.subtotal, 180);
      assert.strictEqual(parentOrder.discountAmount, 25);
      assert.strictEqual(parentOrder.totalAmount, 155);

      // Retrieve persisted child vendor orders from DB
      const vendorOrders = await VendorOrder.find({ parentOrderId: parentOrder.id });
      assert.strictEqual(vendorOrders.length, 2, 'Must have 2 vendor orders');

      // Verify sum of vendor subtotals
      const sumVendorSubtotals = vendorOrders.reduce((sum, vo) => sum + vo.vendorSubtotal, 0);
      assert.strictEqual(
        sumVendorSubtotals,
        parentOrder.subtotal,
        `Sum of vendor subtotals (${sumVendorSubtotals}) must match parent subtotal (${parentOrder.subtotal})`
      );

      // Verify sum of vendor discount shares
      const sumVendorDiscounts = vendorOrders.reduce(
        (sum, vo) => sum + (vo.discountShare || vo.discountAmount || 0),
        0
      );
      assert.strictEqual(
        Math.round(sumVendorDiscounts * 100) / 100,
        parentOrder.discountAmount,
        `Sum of vendor discounts (${sumVendorDiscounts}) must equal parent discount (${parentOrder.discountAmount})`
      );

      // Verify sum of vendor order net totals (subtotal - discount + shipping)
      const sumVendorNetTotals = vendorOrders.reduce(
        (sum, vo) => sum + (vo.vendorSubtotal - (vo.discountShare || 0) + vo.shippingShare),
        0
      );
      assert.strictEqual(
        Math.round(sumVendorNetTotals * 100) / 100,
        parentOrder.totalAmount,
        `Sum of vendor net totals (${sumVendorNetTotals}) must reconcile with parent totalAmount (${parentOrder.totalAmount})`
      );
    });

  } catch (error: any) {
    console.error('Fatal Test Suite Error:', error);
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
    console.log('\n🧹 Database cleaned up & in-memory MongoDB stopped.');

    console.log('\n================================================================');
    console.log('📊 Phase 9B Coupon & Discount Management Test Suite Completed:');
    console.log(`   Passed: ${passed} / 16`);
    console.log(`   Failed: ${failed} / 16`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  }
}

runCouponTestSuite();

