import assert from 'assert';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app';
import { User } from '../models/user.model';
import { VendorProfile } from '../models/vendorProfile.model';
import { Category } from '../models/category.model';
import { Product } from '../models/product.model';
import { generateAccessToken, AUTH_COOKIE_NAME } from '../utils/token';

async function runProductTestSuite() {
  console.log('\n======================================================');
  console.log('🧪 Starting Phase 4A Product & Inventory Integration Tests');
  console.log('======================================================\n');

  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'super_secret_test_jwt_key_at_least_32_characters_long';
  process.env.JWT_ACCESS_EXPIRY = '15m';

  // 1. Initialize In-Memory MongoDB Server
  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
  console.log('📦 Connected to in-memory MongoDB instance for Phase 4A testing.\n');

  const app = createApp();

  try {
    // --------------------------------------------------------------------------
    // Setup Test Data
    // --------------------------------------------------------------------------
    console.log('🌱 Provisioning test categories, users, and merchant profiles...');

    // Categories
    const activeCategory = await Category.create({
      name: 'Electronics & Gadgets',
      slug: 'electronics-gadgets',
      description: 'Consumer audio, computing, and accessories',
      isActive: true,
    });

    const inactiveCategory = await Category.create({
      name: 'Archived Seasonal',
      slug: 'archived-seasonal',
      description: 'Discontinued product line',
      isActive: false,
    });

    // Admin User
    const adminUser = await User.create({
      name: 'Platform Admin',
      email: 'admin@platform.com',
      password: 'Password123!',
      role: 'admin',
      isActive: true,
    });
    const adminToken = generateAccessToken({
      id: adminUser._id.toString(),
      email: adminUser.email,
      role: 'admin',
    });

    // Approved Vendor 1
    const vendorUser1 = await User.create({
      name: 'Apex Audio Vendor',
      email: 'vendor1@apex.com',
      password: 'Password123!',
      role: 'vendor',
      isActive: true,
    });
    await VendorProfile.create({
      userId: vendorUser1._id,
      storeName: 'Apex Audio Store',
      businessEmail: 'contact@apexaudio.com',
      businessPhone: '+1-555-0101',
      businessAddress: {
        street: '101 Sound Ave',
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
        country: 'USA',
      },
      status: 'approved',
    });
    const vendor1Token = generateAccessToken({
      id: vendorUser1._id.toString(),
      email: vendorUser1.email,
      role: 'vendor',
    });

    // Approved Vendor 2
    const vendorUser2 = await User.create({
      name: 'ByteTech Vendor',
      email: 'vendor2@bytetech.com',
      password: 'Password123!',
      role: 'vendor',
      isActive: true,
    });
    await VendorProfile.create({
      userId: vendorUser2._id,
      storeName: 'ByteTech Store',
      businessEmail: 'contact@bytetech.com',
      businessPhone: '+1-555-0102',
      businessAddress: {
        street: '202 Chip Lane',
        city: 'San Jose',
        state: 'CA',
        postalCode: '95112',
        country: 'USA',
      },
      status: 'approved',
    });
    const vendor2Token = generateAccessToken({
      id: vendorUser2._id.toString(),
      email: vendorUser2.email,
      role: 'vendor',
    });

    // Customer
    const customerUser = await User.create({
      name: 'John Buyer',
      email: 'buyer@example.com',
      password: 'Password123!',
      role: 'customer',
      isActive: true,
    });
    const customerToken = generateAccessToken({
      id: customerUser._id.toString(),
      email: customerUser.email,
      role: 'customer',
    });

    // Pending Vendor (Customer with pending application)
    const pendingVendorUser = await User.create({
      name: 'Pending Applicant',
      email: 'pending@applicant.com',
      password: 'Password123!',
      role: 'customer',
      isActive: true,
    });
    await VendorProfile.create({
      userId: pendingVendorUser._id,
      storeName: 'Pending Store',
      businessEmail: 'pending@store.com',
      businessPhone: '+1-555-0103',
      businessAddress: {
        street: '303 Wait St',
        city: 'Seattle',
        state: 'WA',
        postalCode: '98101',
        country: 'USA',
      },
      status: 'pending',
    });
    const pendingVendorToken = generateAccessToken({
      id: pendingVendorUser._id.toString(),
      email: pendingVendorUser.email,
      role: 'customer',
    });

    console.log('✅ Seed completed: Categories, Admin, 2 Approved Vendors, Customer, Pending Applicant.\n');

    let createdProduct1Id = '';

    // --------------------------------------------------------------------------
    // Test 1: Approved vendor creates a product -> 201 Created
    // --------------------------------------------------------------------------
    console.log('⏳ Test 1: Approved vendor creates a product...');
    const test1Res = await request(app)
      .post('/api/products')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${vendor1Token}`])
      .send({
        name: 'Apex ANC Wireless Headphones',
        description: 'Industry-leading active noise cancelling over-ear headphones with 40-hour battery life.',
        price: 249.99,
        categoryId: activeCategory._id.toString(),
        stock: 50,
        brand: 'ApexAudio',
        images: ['https://example.com/headphones-main.jpg'],
      });

    assert.strictEqual(test1Res.status, 201, `Expected 201, got ${test1Res.status}`);
    assert.strictEqual(test1Res.body.success, true);
    assert.strictEqual(test1Res.body.data.name, 'Apex ANC Wireless Headphones');
    assert.strictEqual(test1Res.body.data.price, 249.99);
    assert.strictEqual(test1Res.body.data.stock, 50);
    assert.strictEqual(test1Res.body.data.vendorId.id || test1Res.body.data.vendorId._id, vendorUser1._id.toString());
    assert.ok(test1Res.body.data.sku, 'Product SKU must be auto-generated');
    createdProduct1Id = test1Res.body.data.id || test1Res.body.data._id;
    console.log(`✅ Test 1 Passed: Product created with SKU '${test1Res.body.data.sku}' assigned to Vendor 1.\n`);

    // --------------------------------------------------------------------------
    // Test 2: Customer cannot create a product -> 403 Forbidden
    // --------------------------------------------------------------------------
    console.log('⏳ Test 2: Customer attempting to create a product...');
    const test2Res = await request(app)
      .post('/api/products')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customerToken}`])
      .send({
        name: 'Unauthorized Product Listing',
        description: 'This attempt should be blocked by role authorization.',
        price: 99.99,
        categoryId: activeCategory._id.toString(),
        stock: 10,
      });

    assert.strictEqual(test2Res.status, 403, `Expected 403, got ${test2Res.status}`);
    assert.strictEqual(test2Res.body.error.code, 'FORBIDDEN');
    console.log('✅ Test 2 Passed: Customer blocked from product creation with 403 Forbidden.\n');

    // --------------------------------------------------------------------------
    // Test 3: Pending vendor cannot create a product -> 403 Forbidden
    // --------------------------------------------------------------------------
    console.log('⏳ Test 3: Pending applicant attempting to create a product...');
    const test3Res = await request(app)
      .post('/api/products')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${pendingVendorToken}`])
      .send({
        name: 'Pending Vendor Product Listing',
        description: 'Unapproved store owner trying to publish product.',
        price: 49.99,
        categoryId: activeCategory._id.toString(),
        stock: 5,
      });

    assert.strictEqual(test3Res.status, 403, `Expected 403, got ${test3Res.status}`);
    assert.strictEqual(test3Res.body.error.code, 'FORBIDDEN');
    console.log('✅ Test 3 Passed: Pending applicant blocked with 403 Forbidden.\n');

    // --------------------------------------------------------------------------
    // Test 4: Public user can view active products -> 200 OK
    // --------------------------------------------------------------------------
    console.log('⏳ Test 4: Public user browsing active products catalog...');
    const test4Res = await request(app).get('/api/products');

    assert.strictEqual(test4Res.status, 200, `Expected 200, got ${test4Res.status}`);
    assert.strictEqual(test4Res.body.success, true);
    assert.ok(Array.isArray(test4Res.body.data));
    assert.strictEqual(test4Res.body.data.length, 1);
    assert.strictEqual(test4Res.body.data[0].name, 'Apex ANC Wireless Headphones');
    assert.strictEqual(test4Res.body.meta.total, 1);
    console.log('✅ Test 4 Passed: Public visitor successfully browsed active product catalog.\n');

    // --------------------------------------------------------------------------
    // Test 5: Vendor can view their own products -> 200 OK
    // --------------------------------------------------------------------------
    console.log('⏳ Test 5: Vendor 1 listing their owned products...');
    const test5Res = await request(app)
      .get('/api/vendor/products')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${vendor1Token}`]);

    assert.strictEqual(test5Res.status, 200, `Expected 200, got ${test5Res.status}`);
    assert.strictEqual(test5Res.body.success, true);
    assert.strictEqual(test5Res.body.data.length, 1);
    assert.strictEqual(test5Res.body.data[0].id || test5Res.body.data[0]._id, createdProduct1Id);
    console.log('✅ Test 5 Passed: Vendor 1 retrieved their owned product listings.\n');

    // --------------------------------------------------------------------------
    // Test 6: Vendor cannot view another vendor's private / draft product
    // --------------------------------------------------------------------------
    console.log("⏳ Test 6: Vendor 2 attempting to view Vendor 1's draft product...");
    // Create draft product for Vendor 1
    const draftProduct = await Product.create({
      name: 'Apex Studio Prototype (Draft)',
      description: 'Internal testing prototype not ready for public release.',
      price: 999.0,
      categoryId: activeCategory._id,
      vendorId: vendorUser1._id,
      stock: 1,
      sku: 'APEX-DRAFT-001',
      status: 'draft',
      isDeleted: false,
    });

    const test6Res = await request(app)
      .get(`/api/products/${draftProduct._id.toString()}`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${vendor2Token}`]);

    assert.strictEqual(test6Res.status, 404, `Expected 404, got ${test6Res.status}`);
    assert.strictEqual(test6Res.body.error.code, 'NOT_FOUND');

    // Confirm Vendor 1 (owner) CAN view the draft product
    const ownerDraftRes = await request(app)
      .get(`/api/products/${draftProduct._id.toString()}`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${vendor1Token}`]);
    assert.strictEqual(ownerDraftRes.status, 200);
    console.log("✅ Test 6 Passed: Private draft products shielded from competing vendors.\n");

    // --------------------------------------------------------------------------
    // Test 7: Vendor updates their own product -> 200 OK
    // --------------------------------------------------------------------------
    console.log('⏳ Test 7: Vendor 1 updating their own product details...');
    const test7Res = await request(app)
      .patch(`/api/products/${createdProduct1Id}`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${vendor1Token}`])
      .send({
        price: 229.99,
        name: 'Apex ANC Wireless Headphones (V2)',
      });

    assert.strictEqual(test7Res.status, 200, `Expected 200, got ${test7Res.status}`);
    assert.strictEqual(test7Res.body.success, true);
    assert.strictEqual(test7Res.body.data.price, 229.99);
    assert.strictEqual(test7Res.body.data.name, 'Apex ANC Wireless Headphones (V2)');
    console.log('✅ Test 7 Passed: Product successfully updated by authorized owner.\n');

    // --------------------------------------------------------------------------
    // Test 8: Vendor cannot update another vendor's product -> 403 Forbidden
    // --------------------------------------------------------------------------
    console.log("⏳ Test 8: Vendor 2 attempting to modify Vendor 1's product...");
    const test8Res = await request(app)
      .patch(`/api/products/${createdProduct1Id}`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${vendor2Token}`])
      .send({
        price: 1.99, // Sabotage price
      });

    assert.strictEqual(test8Res.status, 403, `Expected 403, got ${test8Res.status}`);
    assert.strictEqual(test8Res.body.error.code, 'FORBIDDEN');
    console.log('✅ Test 8 Passed: Cross-vendor product tampering blocked with 403 Forbidden.\n');

    // --------------------------------------------------------------------------
    // Test 9: Vendor cannot delete another vendor's product -> 403 Forbidden
    // --------------------------------------------------------------------------
    console.log("⏳ Test 9: Vendor 2 attempting to delete Vendor 1's product...");
    const test9Res = await request(app)
      .delete(`/api/products/${createdProduct1Id}`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${vendor2Token}`]);

    assert.strictEqual(test9Res.status, 403, `Expected 403, got ${test9Res.status}`);
    assert.strictEqual(test9Res.body.error.code, 'FORBIDDEN');
    console.log('✅ Test 9 Passed: Cross-vendor product deletion blocked with 403 Forbidden.\n');

    // --------------------------------------------------------------------------
    // Test 10: Invalid price (<= 0) is rejected -> 422 Validation Error
    // --------------------------------------------------------------------------
    console.log('⏳ Test 10: Validating rejection of negative/zero price...');
    const test10Res = await request(app)
      .post('/api/products')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${vendor1Token}`])
      .send({
        name: 'Invalid Price Item',
        description: 'Should fail because price is negative.',
        price: -15.0,
        categoryId: activeCategory._id.toString(),
        stock: 10,
      });

    assert.strictEqual(test10Res.status, 422, `Expected 422, got ${test10Res.status}`);
    assert.strictEqual(test10Res.body.error.code, 'VALIDATION_ERROR');
    console.log('✅ Test 10 Passed: Negative price rejected with 422 Validation Error.\n');

    // --------------------------------------------------------------------------
    // Test 11: Negative stock is rejected -> 422 Validation Error
    // --------------------------------------------------------------------------
    console.log('⏳ Test 11: Validating rejection of negative stock count...');
    const test11Res = await request(app)
      .post('/api/products')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${vendor1Token}`])
      .send({
        name: 'Invalid Stock Item',
        description: 'Should fail because stock is negative.',
        price: 25.0,
        categoryId: activeCategory._id.toString(),
        stock: -10,
      });

    assert.strictEqual(test11Res.status, 422, `Expected 422, got ${test11Res.status}`);
    assert.strictEqual(test11Res.body.error.code, 'VALIDATION_ERROR');
    console.log('✅ Test 11 Passed: Negative stock rejected with 422 Validation Error.\n');

    // --------------------------------------------------------------------------
    // Test 12: Inactive category is rejected -> 400 Bad Request
    // --------------------------------------------------------------------------
    console.log('⏳ Test 12: Creating product under an inactive/discontinued category...');
    const test12Res = await request(app)
      .post('/api/products')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${vendor1Token}`])
      .send({
        name: 'Discontinued Category Item',
        description: 'Trying to add product into an archived category.',
        price: 39.99,
        categoryId: inactiveCategory._id.toString(),
        stock: 5,
      });

    assert.strictEqual(test12Res.status, 400, `Expected 400, got ${test12Res.status}`);
    assert.strictEqual(test12Res.body.error.code, 'BAD_REQUEST');
    console.log('✅ Test 12 Passed: Inactive category rejected with 400 Bad Request.\n');

    // --------------------------------------------------------------------------
    // Test 13: Admin can deactivate a product -> 200 OK
    // --------------------------------------------------------------------------
    console.log('⏳ Test 13: Admin deactivating a product via moderation API...');
    const test13Res = await request(app)
      .patch(`/api/admin/products/${createdProduct1Id}/status`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${adminToken}`])
      .send({ status: 'inactive' });

    assert.strictEqual(test13Res.status, 200, `Expected 200, got ${test13Res.status}`);
    assert.strictEqual(test13Res.body.data.status, 'inactive');

    // Verify it no longer appears in public catalog
    const publicAfterDeactivation = await request(app).get('/api/products');
    assert.strictEqual(publicAfterDeactivation.body.data.length, 0);
    console.log('✅ Test 13 Passed: Admin deactivated product; removed from public catalog.\n');

    // Reactivate product for remaining tests
    await Product.findByIdAndUpdate(createdProduct1Id, { status: 'active' });

    // --------------------------------------------------------------------------
    // Test 14: Pagination and sorting work correctly
    // --------------------------------------------------------------------------
    console.log('⏳ Test 14: Testing pagination and price sorting...');
    // Create 2 additional products with distinct prices
    await Product.create({
      name: 'Budget USB Cable',
      description: 'Durable nylon braided high-speed cable.',
      price: 9.99,
      categoryId: activeCategory._id,
      vendorId: vendorUser1._id,
      stock: 200,
      sku: 'CBL-001',
      status: 'active',
      isDeleted: false,
    });

    await Product.create({
      name: 'Flagship Studio Monitor Speakers',
      description: 'Professional near-field reference monitors.',
      price: 599.99,
      categoryId: activeCategory._id,
      vendorId: vendorUser1._id,
      stock: 15,
      sku: 'SPK-001',
      status: 'active',
      isDeleted: false,
    });

    const pageRes = await request(app)
      .get('/api/products?page=1&limit=2&sortBy=price&sortOrder=asc');

    assert.strictEqual(pageRes.status, 200);
    assert.strictEqual(pageRes.body.data.length, 2, 'Should paginate to exactly 2 items');
    assert.strictEqual(pageRes.body.meta.total, 3, 'Total active items should be 3');
    assert.ok(pageRes.body.data[0].price <= pageRes.body.data[1].price, 'Items must be sorted by price ascending');
    console.log('✅ Test 14 Passed: Pagination limit and price ascending sort verified.\n');

    // --------------------------------------------------------------------------
    // Test 15: Atomic inventory protection against negative stock
    // --------------------------------------------------------------------------
    console.log('⏳ Test 15: Testing atomic stock update & negative inventory protection...');
    // createdProduct1Id currently has stock: 50
    // Attempting to decrement by 100 should fail because 50 - 100 < 0
    const overdrawRes = await request(app)
      .patch(`/api/products/${createdProduct1Id}/inventory`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${vendor1Token}`])
      .send({
        quantity: -100,
        mode: 'adjust',
      });

    assert.strictEqual(overdrawRes.status, 400, `Expected 400, got ${overdrawRes.status}`);
    assert.strictEqual(overdrawRes.body.error.code, 'BAD_REQUEST');

    // Confirm DB stock remains untouched at 50
    const checkDbProduct = await Product.findById(createdProduct1Id);
    assert.strictEqual(checkDbProduct?.stock, 50, 'Stock must remain 50 after failed decrement');

    // Perform valid adjustment: decrement 15 units (50 - 15 = 35)
    const validAdjustRes = await request(app)
      .patch(`/api/products/${createdProduct1Id}/inventory`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${vendor1Token}`])
      .send({
        quantity: -15,
        mode: 'adjust',
      });

    assert.strictEqual(validAdjustRes.status, 200);
    assert.strictEqual(validAdjustRes.body.data.stock, 35, 'Stock should be 35');
    console.log('✅ Test 15 Passed: Negative stock prevention and atomic inventory updates verified.\n');

    console.log('======================================================');
    console.log('🎉 ALL 15 PRODUCT & INVENTORY TESTS PASSED!');
    console.log('======================================================\n');
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

runProductTestSuite().catch((err) => {
  console.error('❌ Test Suite Failed:', err);
  process.exit(1);
});

