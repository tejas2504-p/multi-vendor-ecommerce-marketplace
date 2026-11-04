import assert from 'assert';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app';
import { User } from '../models/user.model';
import { generateAccessToken, AUTH_COOKIE_NAME } from '../utils/token';

async function runRbacTestSuite() {
  console.log('\n======================================================');
  console.log('🧪 Starting Phase 2B Role-Based Access Control (RBAC) Tests');
  console.log('======================================================\n');

  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'super_secret_test_jwt_key_at_least_32_characters_long';
  process.env.JWT_ACCESS_EXPIRY = '15m';

  // 1. Initialize In-Memory MongoDB Server
  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
  console.log('📦 Connected to in-memory MongoDB instance for RBAC testing.\n');

  const app = createApp();

  try {
    // --------------------------------------------------------------------------
    // Setup Test Users: Customer, Vendor 1, Vendor 2, Admin
    // --------------------------------------------------------------------------
    console.log('🌱 Provisioning test users across roles...');

    // Customer
    const customer = await User.create({
      name: 'Alice Customer',
      email: 'customer@example.com',
      password: 'Password123!',
      role: 'customer',
      isActive: true,
    });
    const customerToken = generateAccessToken({
      id: customer._id.toString(),
      email: customer.email,
      role: 'customer',
    });

    // Vendor 1
    const vendor1 = await User.create({
      name: 'Bob Vendor 1',
      email: 'vendor1@example.com',
      password: 'Password123!',
      role: 'vendor',
      isActive: true,
    });
    const vendor1Token = generateAccessToken({
      id: vendor1._id.toString(),
      email: vendor1.email,
      role: 'vendor',
    });

    // Vendor 2
    const vendor2 = await User.create({
      name: 'Charlie Vendor 2',
      email: 'vendor2@example.com',
      password: 'Password123!',
      role: 'vendor',
      isActive: true,
    });
    const vendor2Token = generateAccessToken({
      id: vendor2._id.toString(),
      email: vendor2.email,
      role: 'vendor',
    });

    // Admin
    const admin = await User.create({
      name: 'Diana Admin',
      email: 'admin@example.com',
      password: 'Password123!',
      role: 'admin',
      isActive: true,
    });
    const adminToken = generateAccessToken({
      id: admin._id.toString(),
      email: admin.email,
      role: 'admin',
    });

    console.log('✅ Users provisioned: Customer, Vendor 1, Vendor 2, Admin.\n');

    // --------------------------------------------------------------------------
    // Test 1: Customer accessing Customer Dashboard -> 200 OK
    // --------------------------------------------------------------------------
    console.log('⏳ Test 1: Customer accessing /api/customer/dashboard...');
    const test1Res = await request(app)
      .get('/api/customer/dashboard')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customerToken}`]);

    assert.strictEqual(test1Res.status, 200, `Expected status 200, got ${test1Res.status}`);
    assert.strictEqual(test1Res.body.success, true);
    assert.strictEqual(test1Res.body.data.user.role, 'customer');
    assert.strictEqual(test1Res.body.data.portal, 'Customer Storefront & Account Portal');
    console.log('✅ Test 1 Passed: Customer successfully accessed Customer Dashboard.\n');

    // --------------------------------------------------------------------------
    // Test 2: Customer accessing Vendor Dashboard -> 403 Forbidden
    // --------------------------------------------------------------------------
    console.log('⏳ Test 2: Customer accessing /api/vendor/dashboard...');
    const test2Res = await request(app)
      .get('/api/vendor/dashboard')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customerToken}`]);

    assert.strictEqual(test2Res.status, 403, `Expected status 403, got ${test2Res.status}`);
    assert.strictEqual(test2Res.body.success, false);
    assert.strictEqual(test2Res.body.error.code, 'FORBIDDEN');
    console.log('✅ Test 2 Passed: Customer blocked from Vendor Dashboard with 403 Forbidden.\n');

    // --------------------------------------------------------------------------
    // Test 3: Customer accessing Admin Dashboard -> 403 Forbidden
    // --------------------------------------------------------------------------
    console.log('⏳ Test 3: Customer accessing /api/admin/dashboard...');
    const test3Res = await request(app)
      .get('/api/admin/dashboard')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customerToken}`]);

    assert.strictEqual(test3Res.status, 403, `Expected status 403, got ${test3Res.status}`);
    assert.strictEqual(test3Res.body.success, false);
    assert.strictEqual(test3Res.body.error.code, 'FORBIDDEN');
    console.log('✅ Test 3 Passed: Customer blocked from Admin Dashboard with 403 Forbidden.\n');

    // --------------------------------------------------------------------------
    // Test 4: Vendor accessing Vendor Dashboard -> 200 OK
    // --------------------------------------------------------------------------
    console.log('⏳ Test 4: Vendor accessing /api/vendor/dashboard...');
    const test4Res = await request(app)
      .get('/api/vendor/dashboard')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${vendor1Token}`]);

    assert.strictEqual(test4Res.status, 200, `Expected status 200, got ${test4Res.status}`);
    assert.strictEqual(test4Res.body.success, true);
    assert.strictEqual(test4Res.body.data.user.role, 'vendor');
    assert.strictEqual(test4Res.body.data.portal, 'Vendor Management Hub');
    console.log('✅ Test 4 Passed: Vendor successfully accessed Vendor Dashboard.\n');

    // --------------------------------------------------------------------------
    // Test 5: Vendor accessing Admin Dashboard -> 403 Forbidden
    // --------------------------------------------------------------------------
    console.log('⏳ Test 5: Vendor accessing /api/admin/dashboard...');
    const test5Res = await request(app)
      .get('/api/admin/dashboard')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${vendor1Token}`]);

    assert.strictEqual(test5Res.status, 403, `Expected status 403, got ${test5Res.status}`);
    assert.strictEqual(test5Res.body.success, false);
    assert.strictEqual(test5Res.body.error.code, 'FORBIDDEN');
    console.log('✅ Test 5 Passed: Vendor blocked from Admin Dashboard with 403 Forbidden.\n');

    // --------------------------------------------------------------------------
    // Test 6: Admin accessing Admin Dashboard -> 200 OK
    // --------------------------------------------------------------------------
    console.log('⏳ Test 6: Admin accessing /api/admin/dashboard...');
    const test6Res = await request(app)
      .get('/api/admin/dashboard')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${adminToken}`]);

    assert.strictEqual(test6Res.status, 200, `Expected status 200, got ${test6Res.status}`);
    assert.strictEqual(test6Res.body.success, true);
    assert.strictEqual(test6Res.body.data.user.role, 'admin');
    assert.strictEqual(test6Res.body.data.portal, 'Super-Admin Governance Console');
    console.log('✅ Test 6 Passed: Admin successfully accessed Super-Admin Dashboard.\n');

    // --------------------------------------------------------------------------
    // Test 7: Unauthenticated access -> 401 Unauthorized
    // --------------------------------------------------------------------------
    console.log('⏳ Test 7: Unauthenticated requests to protected dashboards...');
    const unauthCust = await request(app).get('/api/customer/dashboard');
    assert.strictEqual(unauthCust.status, 401, `Expected status 401, got ${unauthCust.status}`);
    assert.strictEqual(unauthCust.body.error.code, 'UNAUTHORIZED');

    const unauthVendor = await request(app).get('/api/vendor/dashboard');
    assert.strictEqual(unauthVendor.status, 401, `Expected status 401, got ${unauthVendor.status}`);
    assert.strictEqual(unauthVendor.body.error.code, 'UNAUTHORIZED');

    const unauthAdmin = await request(app).get('/api/admin/dashboard');
    assert.strictEqual(unauthAdmin.status, 401, `Expected status 401, got ${unauthAdmin.status}`);
    assert.strictEqual(unauthAdmin.body.error.code, 'UNAUTHORIZED');
    console.log('✅ Test 7 Passed: Unauthenticated requests rejected with 401 Unauthorized.\n');

    // --------------------------------------------------------------------------
    // Test 8: Public self-escalation attempt (role: "admin" or "vendor") -> 422 Validation Error
    // --------------------------------------------------------------------------
    console.log('⏳ Test 8: User attempting to register with role: "admin" or "vendor"...');
    const attackAdminRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Hacker Joe',
        email: 'hacker@example.com',
        password: 'Password123!',
        role: 'admin',
      });

    assert.strictEqual(attackAdminRes.status, 422, `Expected status 422, got ${attackAdminRes.status}`);
    assert.strictEqual(attackAdminRes.body.success, false);
    assert.strictEqual(attackAdminRes.body.error.code, 'VALIDATION_ERROR');

    const attackVendorRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Sneaky Vendor',
        email: 'sneaky@example.com',
        password: 'Password123!',
        role: 'vendor',
      });

    assert.strictEqual(attackVendorRes.status, 422, `Expected status 422, got ${attackVendorRes.status}`);
    assert.strictEqual(attackVendorRes.body.success, false);
    assert.strictEqual(attackVendorRes.body.error.code, 'VALIDATION_ERROR');
    console.log('✅ Test 8 Passed: Privilege escalation attempts blocked with 422 Validation Error.\n');

    // --------------------------------------------------------------------------
    // Test 9: Vendor attempting to access another Vendor's resource -> 403 Forbidden
    // --------------------------------------------------------------------------
    console.log("⏳ Test 9: Vendor 1 attempting to access Vendor 2's resource...");
    const test9Res = await request(app)
      .get(`/api/vendor/resources/${vendor2._id.toString()}`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${vendor1Token}`]);

    assert.strictEqual(test9Res.status, 403, `Expected status 403, got ${test9Res.status}`);
    assert.strictEqual(test9Res.body.success, false);
    assert.strictEqual(test9Res.body.error.code, 'FORBIDDEN');
    console.log("✅ Test 9 Passed: Cross-vendor resource tampering blocked with 403 Forbidden.\n");

    // --------------------------------------------------------------------------
    // Test 10: Vendor accessing their own resource -> 200 OK
    // --------------------------------------------------------------------------
    console.log('⏳ Test 10: Vendor 1 accessing their own resource...');
    const test10Res = await request(app)
      .get(`/api/vendor/resources/${vendor1._id.toString()}`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${vendor1Token}`]);

    assert.strictEqual(test10Res.status, 200, `Expected status 200, got ${test10Res.status}`);
    assert.strictEqual(test10Res.body.success, true);
    assert.strictEqual(test10Res.body.data.resourceOwnerId, vendor1._id.toString());
    console.log('✅ Test 10 Passed: Authorized resource owner granted 200 OK.\n');

    // --------------------------------------------------------------------------
    // Test 11: Admin accessing Vendor 2's resource (Admin override) -> 200 OK
    // --------------------------------------------------------------------------
    console.log("⏳ Test 11: Admin accessing Vendor 2's resource (platform governance override)...");
    const test11Res = await request(app)
      .get(`/api/vendor/resources/${vendor2._id.toString()}`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${adminToken}`]);

    assert.strictEqual(test11Res.status, 200, `Expected status 200, got ${test11Res.status}`);
    assert.strictEqual(test11Res.body.success, true);
    console.log('✅ Test 11 Passed: Platform Admin granted governance override access.\n');

    console.log('======================================================');
    console.log('🎉 ALL 11 RBAC INTEGRATION TESTS PASSED SUCCESSFULLY! ');
    console.log('======================================================\n');
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

runRbacTestSuite().catch((err) => {
  console.error('❌ Test Suite Failed:', err);
  process.exit(1);
});

