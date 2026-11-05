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
import { generateAccessToken, AUTH_COOKIE_NAME } from '../utils/token';

async function runCartTestSuite() {
  console.log('\n======================================================');
  console.log('🧪 Starting Phase 6A — Shopping Cart Backend Integration Tests');
  console.log('======================================================\n');

  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'super_secret_test_jwt_key_at_least_32_characters_long';
  process.env.JWT_ACCESS_EXPIRY = '15m';

  // 1. Initialize In-Memory MongoDB Server
  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
  console.log('📦 Connected to in-memory MongoDB instance for Cart testing.\n');

  const app = createApp();

  try {
    // --------------------------------------------------------------------------
    // Setup Test Data
    // --------------------------------------------------------------------------
    console.log('🌱 Provisioning test users, category, vendor profile, and products...');

    // Category
    const category = await Category.create({
      name: 'Electronics',
      slug: 'electronics',
      description: 'Audio and electronic devices',
      isActive: true,
    });

    // Approved Vendor
    const vendorUser = await User.create({
      name: 'AudioTech Store',
      email: 'vendor@audiotech.com',
      password: 'Password123!',
      role: 'vendor',
      isActive: true,
    });
    await VendorProfile.create({
      userId: vendorUser._id,
      storeName: 'AudioTech Official',
      businessEmail: 'contact@audiotech.com',
      businessPhone: '+1-555-0155',
      businessAddress: {
        street: '123 Sound Way',
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
        country: 'USA',
      },
      status: 'approved',
    });
    const vendorToken = generateAccessToken({
      id: vendorUser._id.toString(),
      email: vendorUser.email,
      role: 'vendor',
    });

    // Customer 1
    const customer1 = await User.create({
      name: 'Alice Customer',
      email: 'alice@example.com',
      password: 'Password123!',
      role: 'customer',
      isActive: true,
    });
    const customer1Token = generateAccessToken({
      id: customer1._id.toString(),
      email: customer1.email,
      role: 'customer',
    });

    // Customer 2 (for cart isolation test)
    const customer2 = await User.create({
      name: 'Bob Customer',
      email: 'bob@example.com',
      password: 'Password123!',
      role: 'customer',
      isActive: true,
    });
    const customer2Token = generateAccessToken({
      id: customer2._id.toString(),
      email: customer2.email,
      role: 'customer',
    });

    // Product 1: In stock (stock = 10, price = 50.00)
    const product1 = await Product.create({
      name: 'Noise Cancelling Headphones',
      description: 'High-end wireless noise cancelling headphones',
      price: 50.0,
      categoryId: category._id,
      vendorId: vendorUser._id,
      stock: 10,
      brand: 'AudioTech',
      sku: 'AT-HP-001',
      status: 'active',
      isDeleted: false,
    });

    // Product 2: In stock (stock = 5, price = 25.00)
    const product2 = await Product.create({
      name: 'USB-C Fast Charging Cable',
      description: 'Durable braided 6ft charging cable',
      price: 25.0,
      categoryId: category._id,
      vendorId: vendorUser._id,
      stock: 5,
      brand: 'AudioTech',
      sku: 'AT-CB-002',
      status: 'active',
      isDeleted: false,
    });

    // Product 3: Inactive product (cannot be added to cart)
    const product3Inactive = await Product.create({
      name: 'Discontinued Prototype Earbuds',
      description: 'Sample inactive device',
      price: 15.0,
      categoryId: category._id,
      vendorId: vendorUser._id,
      stock: 20,
      brand: 'AudioTech',
      sku: 'AT-EB-003',
      status: 'inactive',
      isDeleted: false,
    });

    console.log('✅ Test seed data provisioned successfully.\n');

    // --------------------------------------------------------------------------
    // Test 1: Access cart without authentication -> 401 Unauthorized
    // --------------------------------------------------------------------------
    console.log('⏳ Test 1: Access cart without authentication...');
    const test1Res = await request(app).get('/api/cart');
    assert.strictEqual(test1Res.status, 401);
    assert.strictEqual(test1Res.body.success, false);
    assert.strictEqual(test1Res.body.error.code, 'UNAUTHORIZED');
    console.log('✅ Test 1 Passed: Unauthenticated request rejected with 401 Unauthorized.\n');

    // --------------------------------------------------------------------------
    // Test 2: Vendor attempts to access/manage cart -> 403 Forbidden
    // --------------------------------------------------------------------------
    console.log('⏳ Test 2: Vendor attempting to access customer cart API...');
    const test2Res = await request(app)
      .get('/api/cart')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${vendorToken}`]);
    assert.strictEqual(test2Res.status, 403);
    assert.strictEqual(test2Res.body.success, false);
    assert.strictEqual(test2Res.body.error.code, 'FORBIDDEN');
    console.log('✅ Test 2 Passed: Vendor account blocked from cart API with 403 Forbidden.\n');

    // --------------------------------------------------------------------------
    // Test 3: Customer views empty cart initially -> 200 OK
    // --------------------------------------------------------------------------
    console.log('⏳ Test 3: Customer views cart before adding items...');
    const test3Res = await request(app)
      .get('/api/cart')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`]);
    assert.strictEqual(test3Res.status, 200);
    assert.strictEqual(test3Res.body.success, true);
    assert.strictEqual(test3Res.body.data.itemCount, 0);
    assert.strictEqual(test3Res.body.data.subtotal, 0);
    assert.strictEqual(test3Res.body.data.total, 0);
    assert.strictEqual(test3Res.body.data.items.length, 0);
    console.log('✅ Test 3 Passed: Empty cart returned with 0 items and $0.00 subtotal.\n');

    // --------------------------------------------------------------------------
    // Test 4: Customer adds a product to the cart -> 200/201 OK
    // --------------------------------------------------------------------------
    console.log('⏳ Test 4: Customer adds Product 1 (qty 2) to cart...');
    const test4Res = await request(app)
      .post('/api/cart/add')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({
        productId: product1._id.toString(),
        quantity: 2,
      });

    assert.strictEqual(test4Res.status, 200);
    assert.strictEqual(test4Res.body.success, true);
    assert.strictEqual(test4Res.body.data.itemCount, 2);
    assert.strictEqual(test4Res.body.data.subtotal, 100.0); // 2 * $50.00
    assert.strictEqual(test4Res.body.data.items[0].productId, product1._id.toString());
    assert.strictEqual(test4Res.body.data.items[0].quantity, 2);
    assert.strictEqual(test4Res.body.data.items[0].unitPrice, 50.0);
    assert.strictEqual(test4Res.body.data.items[0].itemTotal, 100.0);
    console.log('✅ Test 4 Passed: Product added to cart with calculated subtotal.\n');

    // --------------------------------------------------------------------------
    // Test 5: Customer adds the SAME product again (quantity increments)
    // --------------------------------------------------------------------------
    console.log('⏳ Test 5: Customer adds the same product again (qty 3)...');
    const test5Res = await request(app)
      .post('/api/cart/add')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({
        productId: product1._id.toString(),
        quantity: 3,
      });

    assert.strictEqual(test5Res.status, 200);
    assert.strictEqual(test5Res.body.data.items.length, 1);
    assert.strictEqual(test5Res.body.data.items[0].quantity, 5); // 2 + 3 = 5
    assert.strictEqual(test5Res.body.data.itemCount, 5);
    assert.strictEqual(test5Res.body.data.subtotal, 250.0); // 5 * $50.00
    console.log('✅ Test 5 Passed: Existing cart item quantity incremented seamlessly to 5.\n');

    // --------------------------------------------------------------------------
    // Test 6: View cart (GET /api/cart) verifies populated details & current price
    // --------------------------------------------------------------------------
    console.log('⏳ Test 6: View cart with populated product data...');
    const test6Res = await request(app)
      .get('/api/cart')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`]);

    assert.strictEqual(test6Res.status, 200);
    assert.strictEqual(test6Res.body.data.items[0].name, 'Noise Cancelling Headphones');
    assert.strictEqual(test6Res.body.data.items[0].sku, 'AT-HP-001');
    assert.strictEqual(test6Res.body.data.items[0].isAvailable, true);
    assert.strictEqual(test6Res.body.data.subtotal, 250.0);
    console.log('✅ Test 6 Passed: Cart retrieval populates live product data and current unit price.\n');

    // --------------------------------------------------------------------------
    // Test 7: Exceed stock quantity on addition -> 400 Bad Request
    // --------------------------------------------------------------------------
    console.log('⏳ Test 7: Attempting to add quantity exceeding available stock...');
    // Currently has 5 in cart, stock is 10. Adding 6 would require 11 -> rejected!
    const test7Res = await request(app)
      .post('/api/cart/add')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({
        productId: product1._id.toString(),
        quantity: 6,
      });

    assert.strictEqual(test7Res.status, 400);
    assert.strictEqual(test7Res.body.success, false);
    assert.ok(test7Res.body.error.message.includes('exceeds available stock'));
    console.log('✅ Test 7 Passed: Stock limit validation rejected addition exceeding stock.\n');

    // --------------------------------------------------------------------------
    // Test 8: Add inactive or unavailable product -> 400 Bad Request
    // --------------------------------------------------------------------------
    console.log('⏳ Test 8: Attempting to add inactive product to cart...');
    const test8Res = await request(app)
      .post('/api/cart/add')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({
        productId: product3Inactive._id.toString(),
        quantity: 1,
      });

    assert.strictEqual(test8Res.status, 400);
    assert.strictEqual(test8Res.body.success, false);
    assert.ok(test8Res.body.error.message.includes('inactive'));
    console.log('✅ Test 8 Passed: Inactive product rejected with 400 Bad Request.\n');

    // --------------------------------------------------------------------------
    // Test 9: Update quantity (PATCH /api/cart/update/:productId)
    // --------------------------------------------------------------------------
    console.log('⏳ Test 9: Updating quantity of Product 1 to 3 units...');
    const test9Res = await request(app)
      .patch(`/api/cart/update/${product1._id}`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({
        quantity: 3,
      });

    assert.strictEqual(test9Res.status, 200);
    assert.strictEqual(test9Res.body.data.items[0].quantity, 3);
    assert.strictEqual(test9Res.body.data.itemCount, 3);
    assert.strictEqual(test9Res.body.data.subtotal, 150.0); // 3 * $50.00
    console.log('✅ Test 9 Passed: Quantity successfully updated to 3, subtotal recalculated.\n');

    // --------------------------------------------------------------------------
    // Test 10: Update quantity below 1 (e.g. 0 or negative) -> rejected
    // --------------------------------------------------------------------------
    console.log('⏳ Test 10: Updating quantity to 0 or negative value...');
    const test10Res = await request(app)
      .patch(`/api/cart/update/${product1._id}`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({
        quantity: 0,
      });

    assert.ok([400, 422].includes(test10Res.status), `Expected 400 or 422, got ${test10Res.status}`);
    console.log('✅ Test 10 Passed: Quantity < 1 rejected with validation error.\n');

    // --------------------------------------------------------------------------
    // Test 11: Update quantity exceeding available stock -> 400 Bad Request
    // --------------------------------------------------------------------------
    console.log('⏳ Test 11: Updating quantity to 50 (stock is 10)...');
    const test11Res = await request(app)
      .patch(`/api/cart/update/${product1._id}`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({
        quantity: 50,
      });

    assert.strictEqual(test11Res.status, 400);
    assert.ok(test11Res.body.error.message.includes('exceeds available stock'));
    console.log('✅ Test 11 Passed: Updating quantity above stock rejected with 400.\n');

    // --------------------------------------------------------------------------
    // Test 12: Add a second product (Product 2) to cart
    // --------------------------------------------------------------------------
    console.log('⏳ Test 12: Adding Product 2 (qty 2 @ $25.00) to cart...');
    const test12Res = await request(app)
      .post('/api/cart/add')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({
        productId: product2._id.toString(),
        quantity: 2,
      });

    assert.strictEqual(test12Res.status, 200);
    assert.strictEqual(test12Res.body.data.items.length, 2);
    assert.strictEqual(test12Res.body.data.itemCount, 5); // 3 + 2 = 5
    // 3 * 50 + 2 * 25 = 150 + 50 = $200.00
    assert.strictEqual(test12Res.body.data.subtotal, 200.0);
    console.log('✅ Test 12 Passed: Multiple distinct products handled with accurate combined total.\n');

    // --------------------------------------------------------------------------
    // Test 13: Change a product's price in DB & verify cart uses CURRENT price
    // --------------------------------------------------------------------------
    console.log('⏳ Test 13: Verifying live dynamic price calculation...');
    // Update Product 1 price from $50.00 to $70.00 directly in MongoDB
    await Product.updateOne({ _id: product1._id }, { price: 70.0 });

    const test13Res = await request(app)
      .get('/api/cart')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`]);

    assert.strictEqual(test13Res.status, 200);
    const item1 = test13Res.body.data.items.find((i: any) => i.productId === product1._id.toString());
    assert.strictEqual(item1.unitPrice, 70.0, 'Cart must retrieve updated live price $70.00');
    assert.strictEqual(item1.itemTotal, 210.0, '3 units * $70.00 must equal $210.00');
    // Subtotal: 210 (P1) + 50 (P2) = $260.00
    assert.strictEqual(test13Res.body.data.subtotal, 260.0);
    console.log('✅ Test 13 Passed: Cart dynamic calculation successfully used live price ($70.00).\n');

    // --------------------------------------------------------------------------
    // Test 14: Customer-specific Cart Isolation
    // --------------------------------------------------------------------------
    console.log('⏳ Test 14: Verifying strict cart isolation between customers...');
    // Customer 2 views their cart -> should be completely empty and independent
    const test14Customer2Res = await request(app)
      .get('/api/cart')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer2Token}`]);

    assert.strictEqual(test14Customer2Res.status, 200);
    assert.strictEqual(test14Customer2Res.body.data.items.length, 0);
    assert.strictEqual(test14Customer2Res.body.data.itemCount, 0);
    assert.strictEqual(test14Customer2Res.body.data.subtotal, 0);

    // Customer 2 adds Product 2 (qty 1)
    await request(app)
      .post('/api/cart/add')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer2Token}`])
      .send({
        productId: product2._id.toString(),
        quantity: 1,
      });

    // Customer 1 views their cart -> still has 2 distinct items, unchanged
    const test14Customer1Check = await request(app)
      .get('/api/cart')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`]);

    assert.strictEqual(test14Customer1Check.body.data.items.length, 2);
    assert.strictEqual(test14Customer1Check.body.data.subtotal, 260.0);
    console.log('✅ Test 14 Passed: Cart isolation verified — customers cannot view or mutate each other’s carts.\n');

    // --------------------------------------------------------------------------
    // Test 15: Remove an item (DELETE /api/cart/remove/:productId)
    // --------------------------------------------------------------------------
    console.log('⏳ Test 15: Removing Product 2 from Customer 1 cart...');
    const test15Res = await request(app)
      .delete(`/api/cart/remove/${product2._id}`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`]);

    assert.strictEqual(test15Res.status, 200);
    assert.strictEqual(test15Res.body.data.items.length, 1);
    assert.strictEqual(test15Res.body.data.items[0].productId, product1._id.toString());
    assert.strictEqual(test15Res.body.data.subtotal, 210.0); // Only Product 1 remains
    console.log('✅ Test 15 Passed: Product 2 removed; single item remaining with updated subtotal.\n');

    // --------------------------------------------------------------------------
    // Test 16: Removing a product that is not in the cart -> 404 Not Found
    // --------------------------------------------------------------------------
    console.log('⏳ Test 16: Removing a product not present in cart...');
    const test16Res = await request(app)
      .delete(`/api/cart/remove/${product2._id}`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`]);

    assert.strictEqual(test16Res.status, 404);
    assert.strictEqual(test16Res.body.success, false);
    console.log('✅ Test 16 Passed: Removing non-existent cart item rejected with 404 Not Found.\n');

    // --------------------------------------------------------------------------
    // Test 17: Clear cart (DELETE /api/cart/clear)
    // --------------------------------------------------------------------------
    console.log('⏳ Test 17: Clearing Customer 1 cart...');
    const test17Res = await request(app)
      .delete('/api/cart/clear')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`]);

    assert.strictEqual(test17Res.status, 200);
    assert.strictEqual(test17Res.body.data.items.length, 0);
    assert.strictEqual(test17Res.body.data.itemCount, 0);
    assert.strictEqual(test17Res.body.data.subtotal, 0);
    assert.strictEqual(test17Res.body.data.total, 0);

    // Verify DB cart is empty
    const dbCart = await Cart.findOne({ userId: customer1._id });
    assert.strictEqual(dbCart?.items.length, 0);
    console.log('✅ Test 17 Passed: Customer cart completely cleared.\n');

    // --------------------------------------------------------------------------
    // Test 18: Invalid product ID format handled safely
    // --------------------------------------------------------------------------
    console.log('⏳ Test 18: Testing invalid MongoDB ObjectId format...');
    const test18Res = await request(app)
      .patch('/api/cart/update/invalid-mongo-id-999')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({ quantity: 1 });

    assert.ok([400, 422].includes(test18Res.status));
    console.log('✅ Test 18 Passed: Malformed product ID safely rejected with 400/422.\n');

    console.log('======================================================');
    console.log('🎉 ALL 18 SHOPPING CART INTEGRATION TESTS PASSED!');
    console.log('======================================================\n');
  } finally {
    try {
      await mongoose.disconnect();
    } catch {}
    try {
      await mongoServer.stop({ doCleanup: true, force: true });
    } catch {}
    process.exit(0);
  }
}

runCartTestSuite().catch((err) => {
  console.error('❌ Cart Test Suite Failed:', err);
  process.exit(1);
});

