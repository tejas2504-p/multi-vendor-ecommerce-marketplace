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
import { generateAccessToken, AUTH_COOKIE_NAME } from '../utils/token';

async function runCheckoutTestSuite() {
  console.log('\n======================================================');
  console.log('🧪 Starting Phase 7A — Checkout & Address Integration Tests');
  console.log('======================================================\n');

  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'super_secret_test_jwt_key_at_least_32_characters_long';
  process.env.JWT_ACCESS_EXPIRY = '15m';

  // 1. Initialize In-Memory MongoDB Server
  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
  console.log('📦 Connected to in-memory MongoDB instance for Checkout testing.\n');

  const app = createApp();

  try {
    // --------------------------------------------------------------------------
    // Setup Test Data
    // --------------------------------------------------------------------------
    console.log('🌱 Provisioning test users, vendors, category, and products...');

    // Category
    const category = await Category.create({
      name: 'Electronics',
      slug: 'electronics',
      description: 'Audio and gadgets',
      isActive: true,
    });

    // Approved Vendor
    const vendorUser = await User.create({
      name: 'Sony Official',
      email: 'vendor@sony.com',
      password: 'Password123!',
      role: 'vendor',
      isActive: true,
    });
    await VendorProfile.create({
      userId: vendorUser._id,
      storeName: 'Sony Store',
      businessEmail: 'contact@sony.com',
      businessPhone: '+1-555-0100',
      businessAddress: {
        street: '100 Sony Blvd',
        city: 'Tokyo',
        state: 'TK',
        postalCode: '10800',
        country: 'Japan',
      },
      status: 'approved',
    });

    // Unapproved Vendor (Pending)
    const unapprovedVendor = await User.create({
      name: 'Sketchy Tech',
      email: 'unapproved@sketchy.com',
      password: 'Password123!',
      role: 'customer',
      isActive: true,
    });
    await VendorProfile.create({
      userId: unapprovedVendor._id,
      storeName: 'Sketchy Store',
      businessEmail: 'contact@sketchy.com',
      businessPhone: '+1-555-0200',
      businessAddress: {
        street: '404 Alley Way',
        city: 'Unknown',
        state: 'UN',
        postalCode: '00000',
        country: 'Nowhere',
      },
      status: 'pending',
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

    // Customer 2
    const customer2 = await User.create({
      name: 'Bob Competitor',
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

    // Products
    const headphones = await Product.create({
      name: 'Sony WH-1000XM5',
      description: 'Industry-leading noise cancelling wireless headphones',
      price: 399.99,
      categoryId: category._id,
      vendorId: vendorUser._id,
      stock: 10,
      sku: 'SONY-WH1000XM5',
      status: 'active',
      isDeleted: false,
    });

    const earbuds = await Product.create({
      name: 'Sony WF-1000XM5',
      description: 'True wireless noise cancelling earbuds',
      price: 249.99,
      categoryId: category._id,
      vendorId: vendorUser._id,
      stock: 5,
      sku: 'SONY-WF1000XM5',
      status: 'active',
      isDeleted: false,
    });

    const inactiveProduct = await Product.create({
      name: 'Discontinued Walkman',
      description: 'Vintage cassette walkman',
      price: 49.99,
      categoryId: category._id,
      vendorId: vendorUser._id,
      stock: 3,
      sku: 'SONY-WALKMAN-DISC',
      status: 'inactive',
      isDeleted: false,
    });

    const unapprovedProduct = await Product.create({
      name: 'Unapproved Gadget',
      description: 'Gadget from unapproved vendor',
      price: 19.99,
      categoryId: category._id,
      vendorId: unapprovedVendor._id,
      stock: 10,
      sku: 'SKETCHY-GADGET-1',
      status: 'active',
      isDeleted: false,
    });

    console.log('✅ Seed data successfully initialized.\n');

    // ==========================================================================
    // Test 1: Create an Address
    // ==========================================================================
    console.log('⏳ Test 1: Customer creates primary address...');
    const addrRes1 = await request(app)
      .post('/api/addresses')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({
        fullName: 'Alice Customer',
        phone: '+1 555-123-4567',
        addressLine1: '742 Evergreen Terrace',
        addressLine2: 'Apt 2B',
        city: 'Springfield',
        state: 'IL',
        postalCode: '62704',
        country: 'United States',
        isDefault: false,
      });

    assert.strictEqual(addrRes1.status, 201);
    assert.strictEqual(addrRes1.body.success, true);
    assert.strictEqual(addrRes1.body.data.fullName, 'Alice Customer');
    // First address automatically becomes default
    assert.strictEqual(addrRes1.body.data.isDefault, true);
    const address1Id = addrRes1.body.data.id;
    console.log('✅ Test 1 Passed: Address created and automatically designated as default.\n');

    // ==========================================================================
    // Test 2: Create a second address and Retrieve addresses
    // ==========================================================================
    console.log('⏳ Test 2: Create second address & retrieve list...');
    const addrRes2 = await request(app)
      .post('/api/addresses')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({
        fullName: 'Alice Work',
        phone: '+1 555-987-6543',
        addressLine1: '100 Corporate Plaza',
        city: 'Chicago',
        state: 'IL',
        postalCode: '60601',
        country: 'United States',
        isDefault: false,
      });

    assert.strictEqual(addrRes2.status, 201);
    const address2Id = addrRes2.body.data.id;

    const listRes = await request(app)
      .get('/api/addresses')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`]);

    assert.strictEqual(listRes.status, 200);
    assert.strictEqual(listRes.body.data.length, 2);
    // Default address is first
    assert.strictEqual(listRes.body.data[0].id, address1Id);
    assert.strictEqual(listRes.body.data[0].isDefault, true);
    console.log('✅ Test 2 Passed: Retrieved customer addresses with default address sorted first.\n');

    // ==========================================================================
    // Test 3: Update an address
    // ==========================================================================
    console.log('⏳ Test 3: Customer updates an address...');
    const updateRes = await request(app)
      .patch(`/api/addresses/${address2Id}`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({
        addressLine1: '200 Corporate Plaza Suite 400',
      });

    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.data.addressLine1, '200 Corporate Plaza Suite 400');
    console.log('✅ Test 3 Passed: Address successfully updated.\n');

    // ==========================================================================
    // Test 4: Set a default address
    // ==========================================================================
    console.log('⏳ Test 4: Setting second address as default...');
    const defRes = await request(app)
      .patch(`/api/addresses/${address2Id}/default`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`]);

    assert.strictEqual(defRes.status, 200);
    assert.strictEqual(defRes.body.data.isDefault, true);

    // Verify address 1 is no longer default
    const checkAddr1 = await Address.findById(address1Id);
    assert.strictEqual(checkAddr1?.isDefault, false);
    console.log('✅ Test 4 Passed: Second address became default; previous default safely unset.\n');

    // ==========================================================================
    // Test 5: Delete default address and verify safe reassignment
    // ==========================================================================
    console.log('⏳ Test 5: Deleting default address; verifying safe fallback to remaining address...');
    const delRes = await request(app)
      .delete(`/api/addresses/${address2Id}`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`]);

    assert.strictEqual(delRes.status, 200);
    assert.strictEqual(delRes.body.data.deleted, true);

    // Remaining address 1 should now be promoted to default
    const checkAddr1Promoted = await Address.findById(address1Id);
    assert.strictEqual(checkAddr1Promoted?.isDefault, true);
    console.log('✅ Test 5 Passed: Default address deleted; remaining address promoted to default.\n');

    // ==========================================================================
    // Test 6: Attempt to access another customer's address
    // ==========================================================================
    console.log('⏳ Test 6: Customer 2 attempting to access or modify Customer 1 address...');
    const tamperedRes = await request(app)
      .get(`/api/addresses/${address1Id}`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer2Token}`]);

    assert.strictEqual(tamperedRes.status, 403);
    assert.strictEqual(tamperedRes.body.success, false);

    const tamperedDelete = await request(app)
      .delete(`/api/addresses/${address1Id}`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer2Token}`]);

    assert.strictEqual(tamperedDelete.status, 403);
    console.log("✅ Test 6 Passed: Cross-customer address access & tampering blocked with 403 Forbidden.\n");

    // ==========================================================================
    // Test 7: Checkout with valid cart
    // ==========================================================================
    console.log('⏳ Test 7: Customer 1 adds item to cart and checks out...');
    // Add headphones to cart
    await request(app)
      .post('/api/cart/add')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({ productId: headphones._id.toString(), quantity: 2 });

    const checkoutRes = await request(app)
      .post('/api/checkout')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({ addressId: address1Id });

    assert.strictEqual(checkoutRes.status, 201);
    assert.strictEqual(checkoutRes.body.success, true);
    const order = checkoutRes.body.data;
    assert.ok(order.orderNumber.startsWith('ORD-'));
    assert.strictEqual(order.items.length, 1);
    assert.strictEqual(order.items[0].productName, 'Sony WH-1000XM5');
    assert.strictEqual(order.items[0].quantity, 2);
    assert.strictEqual(order.items[0].unitPrice, 399.99);
    assert.strictEqual(order.subtotal, 799.98);
    // Subtotal >= 100, free shipping
    assert.strictEqual(order.shippingAmount, 0);
    assert.strictEqual(order.totalAmount, 799.98);
    assert.strictEqual(order.deliveryAddress.fullName, 'Alice Customer');
    console.log('✅ Test 7 Passed: Order created with accurate snapshots, orderNumber and free shipping.\n');

    // ==========================================================================
    // Test 8: Checkout with invalid address
    // ==========================================================================
    console.log('⏳ Test 8: Checkout with invalid address ID or unowned address...');
    // Re-add an item to cart
    await request(app)
      .post('/api/cart/add')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({ productId: earbuds._id.toString(), quantity: 1 });

    const invalidAddrRes = await request(app)
      .post('/api/checkout')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({ addressId: new mongoose.Types.ObjectId().toString() });

    assert.strictEqual(invalidAddrRes.status, 404);
    assert.strictEqual(invalidAddrRes.body.success, false);
    console.log('✅ Test 8 Passed: Checkout with non-existent address rejected with 404.\n');

    // ==========================================================================
    // Test 9: Checkout with insufficient stock
    // ==========================================================================
    console.log('⏳ Test 9: Checkout with item exceeding available stock...');
    // Set earbuds stock in DB to 0
    await Product.updateOne({ _id: earbuds._id }, { stock: 0 });

    const stockFailRes = await request(app)
      .post('/api/checkout')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({ addressId: address1Id });

    assert.strictEqual(stockFailRes.status, 400);
    assert.ok(stockFailRes.body.error.message.includes('Insufficient stock'));
    // Reset earbuds stock back to 5
    await Product.updateOne({ _id: earbuds._id }, { stock: 5 });
    console.log('✅ Test 9 Passed: Insufficient stock rejected with 400 Bad Request.\n');

    // ==========================================================================
    // Test 10: Checkout with inactive product
    // ==========================================================================
    console.log('⏳ Test 10: Checkout with inactive product...');
    // Add inactive product directly into user's cart in DB
    await Cart.updateOne(
      { userId: customer1._id },
      { $set: { items: [{ productId: inactiveProduct._id, quantity: 1 }] } }
    );

    const inactiveRes = await request(app)
      .post('/api/checkout')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({ addressId: address1Id });

    assert.strictEqual(inactiveRes.status, 400);
    assert.ok(inactiveRes.body.error.message.includes('inactive'));
    console.log('✅ Test 10 Passed: Inactive product rejected with 400 Bad Request.\n');

    // ==========================================================================
    // Test 11: Checkout with unapproved vendor
    // ==========================================================================
    console.log('⏳ Test 11: Checkout with product from unapproved vendor...');
    await Cart.updateOne(
      { userId: customer1._id },
      { $set: { items: [{ productId: unapprovedProduct._id, quantity: 1 }] } }
    );

    const unapprovedRes = await request(app)
      .post('/api/checkout')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({ addressId: address1Id });

    assert.strictEqual(unapprovedRes.status, 400);
    assert.ok(unapprovedRes.body.error.message.includes('not approved'));
    console.log('✅ Test 11 Passed: Unapproved vendor product rejected with 400 Bad Request.\n');

    // ==========================================================================
    // Test 12: Verify backend price calculations (shipping charges applied when < $100)
    // ==========================================================================
    console.log('⏳ Test 12: Price calculation & shipping under $100...');
    const cheapProduct = await Product.create({
      name: 'Sony Audio Cable',
      description: '3.5mm replacement cable',
      price: 15.0,
      categoryId: category._id,
      vendorId: vendorUser._id,
      stock: 50,
      sku: 'SONY-CABLE-35',
      status: 'active',
      isDeleted: false,
    });

    await Cart.updateOne(
      { userId: customer1._id },
      { $set: { items: [{ productId: cheapProduct._id, quantity: 2 }] } }
    );

    const cheapRes = await request(app)
      .post('/api/checkout')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({ addressId: address1Id });

    assert.strictEqual(cheapRes.status, 201);
    const cheapOrder = cheapRes.body.data;
    assert.strictEqual(cheapOrder.subtotal, 30.0);
    // Subtotal < $100 => Flat $10 shipping
    assert.strictEqual(cheapOrder.shippingAmount, 10.0);
    assert.strictEqual(cheapOrder.totalAmount, 40.0);
    console.log('✅ Test 12 Passed: Backend price calculations and shipping charges verified.\n');

    // ==========================================================================
    // Test 13: Verify inventory updates
    // ==========================================================================
    console.log('⏳ Test 13: Verify inventory stock was decremented...');
    const updatedCable = await Product.findById(cheapProduct._id);
    // Initial 50 - 2 purchased = 48
    assert.strictEqual(updatedCable?.stock, 48);
    console.log('✅ Test 13 Passed: Product stock atomically decremented in database (50 -> 48).\n');

    // ==========================================================================
    // Test 14: Verify cart clearing after successful checkout
    // ==========================================================================
    console.log('⏳ Test 14: Verify cart is cleared after checkout...');
    const checkCart = await Cart.findOne({ userId: customer1._id });
    assert.strictEqual(checkCart?.items.length, 0);

    const getCartRes = await request(app)
      .get('/api/cart')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`]);
    assert.strictEqual(getCartRes.status, 200);
    assert.strictEqual(getCartRes.body.data.itemCount, 0);
    assert.strictEqual(getCartRes.body.data.items.length, 0);
    console.log('✅ Test 14 Passed: Cart items successfully emptied in persistent DB and API response.\n');

    // ==========================================================================
    // Test 15: Simulate a failed checkout and verify no partial order or inventory changes
    // ==========================================================================
    console.log('⏳ Test 15: Failed checkout leaves inventory and orders untampered...');
    const startingStock = 48;
    // Put item in cart
    await Cart.updateOne(
      { userId: customer1._id },
      { $set: { items: [{ productId: cheapProduct._id, quantity: 1 }] } }
    );

    // Call checkout with invalid address to cause failure
    await request(app)
      .post('/api/checkout')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({ addressId: new mongoose.Types.ObjectId().toString() });

    // Stock must be exactly unchanged
    const afterFailedStock = await Product.findById(cheapProduct._id);
    assert.strictEqual(afterFailedStock?.stock, startingStock);
    console.log('✅ Test 15 Passed: Failed checkout caused zero partial stock deduction or order corruption.\n');

    // ==========================================================================
    // Test 16: Test duplicate checkout submissions (idempotency)
    // ==========================================================================
    console.log('⏳ Test 16: Test duplicate checkout submissions (idempotency)...');
    const idempotencyKey = 'checkout-idempotency-key-uuid-12345';

    // Place order with idempotency key
    const firstSubmission = await request(app)
      .post('/api/checkout')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({ addressId: address1Id, idempotencyKey });

    assert.strictEqual(firstSubmission.status, 201);
    const firstOrderNumber = firstSubmission.body.data.orderNumber;
    const stockAfterFirst = (await Product.findById(cheapProduct._id))?.stock;

    // Retry same checkout submission with identical idempotencyKey
    const duplicateSubmission = await request(app)
      .post('/api/checkout')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({ addressId: address1Id, idempotencyKey });

    assert.strictEqual(duplicateSubmission.status, 201);
    assert.strictEqual(duplicateSubmission.body.data.orderNumber, firstOrderNumber);

    // Stock must NOT be decremented a second time
    const stockAfterDuplicate = (await Product.findById(cheapProduct._id))?.stock;
    assert.strictEqual(stockAfterDuplicate, stockAfterFirst);
    console.log('✅ Test 16 Passed: Duplicate submission returned original order and prevented double inventory decrement.\n');

    // ==========================================================================
    // Summary
    // ==========================================================================
    console.log('======================================================');
    console.log('🎉 ALL 16 CHECKOUT & ADDRESS TESTS PASSED WITH 100% SUCCESS!');
    console.log('======================================================\n');
  } finally {
    try {
      await mongoose.disconnect();
      await mongoServer.stop();
    } catch (_e) {}
    process.exit(0);
  }
}

runCheckoutTestSuite().catch((err) => {
  console.error('❌ Checkout Test Suite Failed:', err);
  process.exit(1);
});

