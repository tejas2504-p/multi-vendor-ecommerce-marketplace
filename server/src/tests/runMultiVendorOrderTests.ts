import assert from 'assert';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app';
import { User } from '../models/user.model';
import { VendorProfile } from '../models/vendorProfile.model';
import { Category } from '../models/category.model';
import { Product } from '../models/product.model';
import { Cart } from '../models/cart.model';
import { Address } from '../models/address.model';
import { Order } from '../models/order.model';
import { VendorOrder } from '../models/vendorOrder.model';
import { generateAccessToken, AUTH_COOKIE_NAME } from '../utils/token';

async function runMultiVendorTestSuite() {
  console.log('\n======================================================');
  console.log('🧪 Starting Phase 7B — Multi-Vendor Order Management Integration Tests');
  console.log('======================================================\n');

  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'super_secret_test_jwt_key_at_least_32_characters_long';
  process.env.JWT_ACCESS_EXPIRY = '15m';

  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
  console.log('📦 Connected to in-memory MongoDB instance for Multi-Vendor testing.\n');

  const app = createApp();

  try {
    // --------------------------------------------------------------------------
    // Provision 3 Distinct Approved Vendors, 2 Customers, 1 Admin, and Products
    // --------------------------------------------------------------------------
    console.log('🌱 Provisioning test users, 3 distinct approved vendors, products, and categories...');

    const category = await Category.create({
      name: 'Technology',
      slug: 'technology',
      description: 'Electronics and smart gear',
      isActive: true,
    });

    // Admin
    const adminUser = await User.create({
      name: 'Platform Admin',
      email: 'admin@nexusmarket.com',
      password: 'AdminPassword123!',
      role: 'admin',
      isActive: true,
    });
    const adminToken = generateAccessToken({
      id: adminUser._id.toString(),
      email: adminUser.email,
      role: 'admin',
    });

    // Vendor 1: Sony
    const vendor1User = await User.create({
      name: 'Sony Merchant',
      email: 'sony@vendor.com',
      password: 'Password123!',
      role: 'vendor',
      isActive: true,
    });
    await VendorProfile.create({
      userId: vendor1User._id,
      storeName: 'Sony Flagship',
      businessEmail: 'contact@sony.com',
      businessPhone: '+1-555-0101',
      businessAddress: { street: '1 Sony St', city: 'Tokyo', state: 'TK', postalCode: '10001', country: 'Japan' },
      status: 'approved',
    });
    const vendor1Token = generateAccessToken({ id: vendor1User._id.toString(), email: vendor1User.email, role: 'vendor' });

    // Vendor 2: Bose
    const vendor2User = await User.create({
      name: 'Bose Merchant',
      email: 'bose@vendor.com',
      password: 'Password123!',
      role: 'vendor',
      isActive: true,
    });
    await VendorProfile.create({
      userId: vendor2User._id,
      storeName: 'Bose Official',
      businessEmail: 'contact@bose.com',
      businessPhone: '+1-555-0102',
      businessAddress: { street: '2 Bose Way', city: 'Framingham', state: 'MA', postalCode: '01701', country: 'USA' },
      status: 'approved',
    });
    const vendor2Token = generateAccessToken({ id: vendor2User._id.toString(), email: vendor2User.email, role: 'vendor' });

    // Vendor 3: Sennheiser
    const vendor3User = await User.create({
      name: 'Sennheiser Merchant',
      email: 'sennheiser@vendor.com',
      password: 'Password123!',
      role: 'vendor',
      isActive: true,
    });
    await VendorProfile.create({
      userId: vendor3User._id,
      storeName: 'Sennheiser Audio',
      businessEmail: 'contact@sennheiser.com',
      businessPhone: '+1-555-0103',
      businessAddress: { street: '3 Sound Blvd', city: 'Wedemark', state: 'NI', postalCode: '30900', country: 'Germany' },
      status: 'approved',
    });
    const vendor3Token = generateAccessToken({ id: vendor3User._id.toString(), email: vendor3User.email, role: 'vendor' });

    // Customer 1: Alice
    const customer1 = await User.create({
      name: 'Alice Shopper',
      email: 'alice@shopper.com',
      password: 'Password123!',
      role: 'customer',
      isActive: true,
    });
    const customer1Token = generateAccessToken({ id: customer1._id.toString(), email: customer1.email, role: 'customer' });

    // Customer 2: Bob (for isolation test)
    const customer2 = await User.create({
      name: 'Bob Competitor',
      email: 'bob@shopper.com',
      password: 'Password123!',
      role: 'customer',
      isActive: true,
    });
    const customer2Token = generateAccessToken({ id: customer2._id.toString(), email: customer2.email, role: 'customer' });

    // Customer 1 Address
    const address1 = await Address.create({
      userId: customer1._id,
      fullName: 'Alice Shopper',
      phone: '+1 555-111-2222',
      addressLine1: '742 Evergreen Terrace',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62704',
      country: 'United States',
      isDefault: true,
    });

    // Products from 3 distinct vendors
    const prodV1 = await Product.create({
      name: 'Sony WH-1000XM5',
      description: 'Sony Flagship Noise Cancelling Headphones',
      price: 400.0,
      categoryId: category._id,
      vendorId: vendor1User._id,
      stock: 20,
      sku: 'SONY-XM5',
      status: 'active',
      isDeleted: false,
    });

    const prodV2 = await Product.create({
      name: 'Bose QuietComfort Ultra',
      description: 'Bose Spatial Audio Headphones',
      price: 300.0,
      categoryId: category._id,
      vendorId: vendor2User._id,
      stock: 20,
      sku: 'BOSE-QC-ULTRA',
      status: 'active',
      isDeleted: false,
    });

    const prodV3 = await Product.create({
      name: 'Sennheiser Momentum 4',
      description: 'Sennheiser 60-Hour Battery Headphones',
      price: 250.0,
      categoryId: category._id,
      vendorId: vendor3User._id,
      stock: 20,
      sku: 'SENN-M4',
      status: 'active',
      isDeleted: false,
    });

    console.log('✅ Seed data successfully initialized.\n');

    // ==========================================================================
    // Test 1: Checkout with products from 1 vendor
    // ==========================================================================
    console.log('⏳ Test 1: Checkout with products from 1 vendor...');
    await Cart.updateOne(
      { userId: customer1._id },
      { $set: { items: [{ productId: prodV1._id, quantity: 1 }] } },
      { upsert: true }
    );

    const check1Res = await request(app)
      .post('/api/checkout')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({ addressId: address1._id.toString() });

    assert.strictEqual(check1Res.status, 201);
    const parent1 = check1Res.body.data;
    assert.strictEqual(parent1.vendorOrders.length, 1);
    const vo1 = await VendorOrder.findOne({ parentOrderId: parent1.id });
    assert.ok(vo1);
    assert.strictEqual(vo1.vendorId.toString(), vendor1User._id.toString());
    assert.strictEqual(vo1.vendorSubtotal, 400.0);
    console.log('✅ Test 1 Passed: 1 vendor checkout created 1 parent order and 1 vendor order.\n');

    // ==========================================================================
    // Test 2: Checkout with products from 2 vendors
    // ==========================================================================
    console.log('⏳ Test 2: Checkout with products from 2 vendors...');
    await Cart.updateOne(
      { userId: customer1._id },
      {
        $set: {
          items: [
            { productId: prodV1._id, quantity: 1 },
            { productId: prodV2._id, quantity: 2 },
          ],
        },
      }
    );

    const check2Res = await request(app)
      .post('/api/checkout')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({ addressId: address1._id.toString() });

    assert.strictEqual(check2Res.status, 201);
    const parent2 = check2Res.body.data;
    assert.strictEqual(parent2.vendorOrders.length, 2);
    const vOrders2 = await VendorOrder.find({ parentOrderId: parent2.id });
    assert.strictEqual(vOrders2.length, 2);
    console.log('✅ Test 2 Passed: 2-vendor checkout created exactly 2 distinct vendor orders.\n');

    // ==========================================================================
    // Test 3: Checkout with products from 3 vendors
    // ==========================================================================
    console.log('⏳ Test 3: Checkout with products from 3 distinct vendors...');
    await Cart.updateOne(
      { userId: customer1._id },
      {
        $set: {
          items: [
            { productId: prodV1._id, quantity: 1 }, // 400
            { productId: prodV2._id, quantity: 1 }, // 300
            { productId: prodV3._id, quantity: 2 }, // 500
          ],
        },
      }
    );

    const check3Res = await request(app)
      .post('/api/checkout')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({ addressId: address1._id.toString() });

    assert.strictEqual(check3Res.status, 201);
    const parent3 = check3Res.body.data;
    const parent3Id = parent3.id;
    assert.strictEqual(parent3.vendorOrders.length, 3);
    console.log('✅ Test 3 Passed: 3-vendor checkout created 3 distinct vendor orders.\n');

    // ==========================================================================
    // Test 4: Verify 1 parent order is created
    // ==========================================================================
    console.log('⏳ Test 4: Verifying exactly 1 parent order exists for checkout 3...');
    const parentOrderCount = await Order.countDocuments({ _id: parent3Id });
    assert.strictEqual(parentOrderCount, 1);
    console.log('✅ Test 4 Passed: Exactly 1 parent order represents the multi-vendor transaction.\n');

    // ==========================================================================
    // Test 5: Verify correct vendor order grouping & items attribution
    // ==========================================================================
    console.log('⏳ Test 5: Verifying items are grouped strictly by vendor...');
    const vOrders3 = await VendorOrder.find({ parentOrderId: parent3Id }).sort({ vendorOrderNumber: 1 });
    assert.strictEqual(vOrders3.length, 3);

    // Find vendor 1 order
    const vOrderSony = vOrders3.find((vo) => vo.vendorId.toString() === vendor1User._id.toString());
    assert.ok(vOrderSony);
    assert.strictEqual(vOrderSony.items.length, 1);
    assert.strictEqual(vOrderSony.items[0].productName, 'Sony WH-1000XM5');
    assert.strictEqual(vOrderSony.vendorSubtotal, 400.0);

    // Find vendor 2 order
    const vOrderBose = vOrders3.find((vo) => vo.vendorId.toString() === vendor2User._id.toString());
    assert.ok(vOrderBose);
    assert.strictEqual(vOrderBose.items.length, 1);
    assert.strictEqual(vOrderBose.items[0].productName, 'Bose QuietComfort Ultra');
    assert.strictEqual(vOrderBose.vendorSubtotal, 300.0);

    // Find vendor 3 order
    const vOrderSenn = vOrders3.find((vo) => vo.vendorId.toString() === vendor3User._id.toString());
    assert.ok(vOrderSenn);
    assert.strictEqual(vOrderSenn.items.length, 1);
    assert.strictEqual(vOrderSenn.items[0].productName, 'Sennheiser Momentum 4');
    assert.strictEqual(vOrderSenn.vendorSubtotal, 500.0);
    console.log('✅ Test 5 Passed: Items accurately grouped and attributed to their respective merchants.\n');

    // ==========================================================================
    // Test 6: Verify all order totals reconcile
    // ==========================================================================
    console.log('⏳ Test 6: Reconciling parent order totals with sum of vendor subtotals...');
    const sumVendorSubtotals = vOrders3.reduce((sum, vo) => sum + vo.vendorSubtotal, 0);
    assert.strictEqual(parent3.subtotal, sumVendorSubtotals); // 400 + 300 + 500 = 1200
    assert.strictEqual(parent3.subtotal, 1200.0);
    assert.strictEqual(parent3.shippingAmount, 0); // Free shipping >= 100
    assert.strictEqual(parent3.totalAmount, 1200.0);
    console.log('✅ Test 6 Passed: Parent subtotal exactly matches sum of vendor subtotals (1200.00).\n');

    // ==========================================================================
    // Test 7: Verify customer ownership restrictions
    // ==========================================================================
    console.log('⏳ Test 7: Customer 2 attempting to view Customer 1 parent and vendor orders...');
    const custTamperParent = await request(app)
      .get(`/api/orders/${parent3Id}`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer2Token}`]);
    assert.strictEqual(custTamperParent.status, 403);

    const custTamperVendorOrders = await request(app)
      .get(`/api/orders/${parent3Id}/vendor-orders`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer2Token}`]);
    assert.strictEqual(custTamperVendorOrders.status, 403);

    // Customer 1 legitimate access
    const cust1Parent = await request(app)
      .get(`/api/orders/${parent3Id}`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`]);
    assert.strictEqual(cust1Parent.status, 200);

    const cust1VendorOrders = await request(app)
      .get(`/api/orders/${parent3Id}/vendor-orders`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`]);
    assert.strictEqual(cust1VendorOrders.status, 200);
    assert.strictEqual(cust1VendorOrders.body.data.length, 3);
    console.log('✅ Test 7 Passed: Customer ownership strictly enforced with 403 Forbidden.\n');

    // ==========================================================================
    // Test 8: Verify vendor isolation
    // ==========================================================================
    console.log('⏳ Test 8: Vendor 2 (Bose) attempting to view or update Vendor 1 (Sony) order...');
    const sonyOrderId = vOrderSony!._id.toString();

    const vendorTamperGet = await request(app)
      .get(`/api/vendor/orders/${sonyOrderId}`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${vendor2Token}`]);
    assert.strictEqual(vendorTamperGet.status, 403);

    const vendorTamperPatch = await request(app)
      .patch(`/api/vendor/orders/${sonyOrderId}/status`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${vendor2Token}`])
      .send({ status: 'shipped', trackingNumber: 'FAKE-1234' });
    assert.strictEqual(vendorTamperPatch.status, 403);

    // Legitimate Vendor 1 access
    const vendor1Get = await request(app)
      .get(`/api/vendor/orders/${sonyOrderId}`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${vendor1Token}`]);
    assert.strictEqual(vendor1Get.status, 200);
    assert.strictEqual(vendor1Get.body.data.id, sonyOrderId);
    console.log('✅ Test 8 Passed: Cross-vendor tampering strictly blocked with 403 Forbidden.\n');

    // ==========================================================================
    // Test 9: Verify admin access
    // ==========================================================================
    console.log('⏳ Test 9: Platform administrator accessing all parent and vendor orders...');
    const adminOrdersRes = await request(app)
      .get('/api/admin/orders')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${adminToken}`]);
    assert.strictEqual(adminOrdersRes.status, 200);
    assert.ok(adminOrdersRes.body.data.length >= 3);

    const adminVendorOrdersRes = await request(app)
      .get('/api/admin/vendor-orders')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${adminToken}`]);
    assert.strictEqual(adminVendorOrdersRes.status, 200);
    assert.ok(adminVendorOrdersRes.body.data.length >= 6);

    const adminOrderSingle = await request(app)
      .get(`/api/admin/orders/${parent3Id}`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${adminToken}`]);
    assert.strictEqual(adminOrderSingle.status, 200);
    assert.strictEqual(adminOrderSingle.body.data.id, parent3Id);
    console.log('✅ Test 9 Passed: Platform administrator has full oversight across all vendor orders.\n');

    // ==========================================================================
    // Test 10: Test valid and invalid status transitions
    // ==========================================================================
    console.log('⏳ Test 10: Testing status transition lifecycle...');
    // Illegal transition: confirmed -> delivered (must go through shipped first)
    const illegalTransition = await request(app)
      .patch(`/api/vendor/orders/${sonyOrderId}/status`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${vendor1Token}`])
      .send({ status: 'delivered' });
    assert.strictEqual(illegalTransition.status, 400);

    // Valid: confirmed -> processing
    const toProcessing = await request(app)
      .patch(`/api/vendor/orders/${sonyOrderId}/status`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${vendor1Token}`])
      .send({ status: 'processing', note: 'Packaging unit at warehouse' });
    assert.strictEqual(toProcessing.status, 200);
    assert.strictEqual(toProcessing.body.data.orderStatus, 'processing');

    // Shipped requires tracking info
    const missingTracking = await request(app)
      .patch(`/api/vendor/orders/${sonyOrderId}/status`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${vendor1Token}`])
      .send({ status: 'shipped' });
    assert.strictEqual(missingTracking.status, 422); // Zod refine rejected

    // Valid: processing -> shipped with tracking
    const toShipped = await request(app)
      .patch(`/api/vendor/orders/${sonyOrderId}/status`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${vendor1Token}`])
      .send({ status: 'shipped', carrier: 'FedEx Express', trackingNumber: 'FDX-99887766' });
    assert.strictEqual(toShipped.status, 200);
    assert.strictEqual(toShipped.body.data.orderStatus, 'shipped');
    assert.strictEqual(toShipped.body.data.shipmentTracking.trackingNumber, 'FDX-99887766');

    // Valid: shipped -> delivered
    const toDelivered = await request(app)
      .patch(`/api/vendor/orders/${sonyOrderId}/status`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${vendor1Token}`])
      .send({ status: 'delivered' });
    assert.strictEqual(toDelivered.status, 200);
    assert.strictEqual(toDelivered.body.data.orderStatus, 'delivered');

    // Once delivered, cannot cancel
    const cancelDelivered = await request(app)
      .patch(`/api/vendor/orders/${sonyOrderId}/status`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${vendor1Token}`])
      .send({ status: 'cancelled' });
    assert.strictEqual(cancelDelivered.status, 400);
    console.log('✅ Test 10 Passed: Valid lifecycle transitions and illegal state blockers verified.\n');

    // ==========================================================================
    // Test 11: Test partial delivery aggregation
    // ==========================================================================
    console.log('⏳ Test 11: Testing composite parent order status when 1 vendor order is delivered...');
    // Sony is delivered, Bose and Sennheiser are still confirmed
    const parent3AfterPartial = await Order.findById(parent3Id);
    assert.strictEqual(parent3AfterPartial?.orderStatus, 'partially_delivered');
    console.log('✅ Test 11 Passed: Parent order composite status derived as "partially_delivered".\n');

    // ==========================================================================
    // Test 12: Test cancellation and inventory restoration
    // ==========================================================================
    console.log('⏳ Test 12: Vendor 3 (Sennheiser) cancels order; verifying exact inventory restoration...');
    const sennOrderId = vOrderSenn!._id.toString();
    const stockBeforeCancel = (await Product.findById(prodV3._id))?.stock || 0; // Sennheiser product

    const cancelRes = await request(app)
      .patch(`/api/vendor/orders/${sennOrderId}/status`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${vendor3Token}`])
      .send({ status: 'cancelled', cancellationReason: 'Out of stock at supplier warehouse' });

    assert.strictEqual(cancelRes.status, 200);
    assert.strictEqual(cancelRes.body.data.orderStatus, 'cancelled');

    // Quantity was 2, so stock must be exactly restored by +2
    const stockAfterCancel = (await Product.findById(prodV3._id))?.stock || 0;
    assert.strictEqual(stockAfterCancel, stockBeforeCancel + 2);

    // Cancelled is final; cannot transition again
    const retransition = await request(app)
      .patch(`/api/vendor/orders/${sennOrderId}/status`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${vendor3Token}`])
      .send({ status: 'confirmed' });
    assert.strictEqual(retransition.status, 400);

    // Verify inventory wasn't restored a second time
    const stockAfterRetransfer = (await Product.findById(prodV3._id))?.stock || 0;
    assert.strictEqual(stockAfterRetransfer, stockAfterCancel);
    console.log('✅ Test 12 Passed: Inventory restored exactly once upon cancellation.\n');

    // ==========================================================================
    // Test 13: Test duplicate requests / idempotency
    // ==========================================================================
    console.log('⏳ Test 13: Testing idempotency and prevention of duplicate vendor orders...');
    const idempotencyKey = 'idempotent-multivendor-chk-999';
    await Cart.updateOne(
      { userId: customer1._id },
      { $set: { items: [{ productId: prodV1._id, quantity: 1 }] } }
    );

    const firstChk = await request(app)
      .post('/api/checkout')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({ addressId: address1._id.toString(), idempotencyKey });
    assert.strictEqual(firstChk.status, 201);
    const firstOrderNumber = firstChk.body.data.orderNumber;
    const vendorOrderCountBefore = await VendorOrder.countDocuments();

    // Duplicate checkout attempt
    const secondChk = await request(app)
      .post('/api/checkout')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({ addressId: address1._id.toString(), idempotencyKey });
    assert.strictEqual(secondChk.status, 201);
    assert.strictEqual(secondChk.body.data.orderNumber, firstOrderNumber);

    const vendorOrderCountAfter = await VendorOrder.countDocuments();
    assert.strictEqual(vendorOrderCountAfter, vendorOrderCountBefore);
    console.log('✅ Test 13 Passed: Idempotency prevents duplicate parent and vendor order creation.\n');

    // ==========================================================================
    // Test 14: Historical order snapshots remain unchanged after product edits
    // ==========================================================================
    console.log('⏳ Test 14: Vendor updates product price and title; historical order snapshot immutable...');
    // Sony edits prodV1 price from 400 to 999 and changes name
    await Product.updateOne(
      { _id: prodV1._id },
      { $set: { name: 'Sony WH-1000XM5 Luxury Gold Edition', price: 999.0 } }
    );

    // Fetch the previously placed vendor order
    const sonyOrderAfterEdit = await VendorOrder.findById(sonyOrderId);
    assert.strictEqual(sonyOrderAfterEdit?.items[0].productName, 'Sony WH-1000XM5');
    assert.strictEqual(sonyOrderAfterEdit?.items[0].unitPrice, 400.0);
    assert.strictEqual(sonyOrderAfterEdit?.vendorSubtotal, 400.0);

    // Fetch parent order snapshot
    const parent3AfterEdit = await Order.findById(parent3Id);
    assert.strictEqual(parent3AfterEdit?.items[0].productName, 'Sony WH-1000XM5');
    assert.strictEqual(parent3AfterEdit?.items[0].unitPrice, 400.0);
    assert.strictEqual(parent3AfterEdit?.subtotal, 1200.0);
    console.log('✅ Test 14 Passed: Historical parent and vendor order snapshots remain completely immutable.\n');

    // ==========================================================================
    // Summary
    // ==========================================================================
    console.log('======================================================');
    console.log('🎉 ALL 14 MULTI-VENDOR ORDER TESTS PASSED WITH 100% SUCCESS!');
    console.log('======================================================\n');
  } finally {
    try {
      await mongoose.disconnect();
      await mongoServer.stop();
    } catch (_e) {}
    process.exit(0);
  }
}

runMultiVendorTestSuite().catch((err) => {
  console.error('❌ Multi-Vendor Test Suite Failed:', err);
  process.exit(1);
});

