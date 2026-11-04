import assert from 'assert';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app';
import { User } from '../models/user.model';
import { VendorProfile } from '../models/vendorProfile.model';
import { generateAccessToken, AUTH_COOKIE_NAME } from '../utils/token';

async function runVendorOnboardingTestSuite() {
  console.log('\n======================================================');
  console.log('🧪 Starting Phase 3A Vendor Onboarding Integration Tests');
  console.log('======================================================\n');

  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'super_secret_test_jwt_key_at_least_32_characters_long';
  process.env.JWT_ACCESS_EXPIRY = '15m';

  // 1. In-Memory MongoDB Server
  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
  console.log('📦 Connected to in-memory MongoDB instance for Vendor Onboarding testing.\n');

  const app = createApp();

  try {
    // --------------------------------------------------------------------------
    // Setup Test Users
    // --------------------------------------------------------------------------
    console.log('🌱 Provisioning test users...');

    // Applicant Customer 1
    const customer1 = await User.create({
      name: 'Alice Applicant',
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

    // Applicant Customer 2
    const customer2 = await User.create({
      name: 'Bob Candidate',
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

    // Non-Applicant Customer 3
    const customer3 = await User.create({
      name: 'Charlie NonApplicant',
      email: 'charlie@example.com',
      password: 'Password123!',
      role: 'customer',
      isActive: true,
    });
    const customer3Token = generateAccessToken({
      id: customer3._id.toString(),
      email: customer3.email,
      role: 'customer',
    });

    // Admin User
    const adminUser = await User.create({
      name: 'Admin Governance',
      email: 'admin@marketplace.com',
      password: 'Password123!',
      role: 'admin',
      isActive: true,
    });
    const adminToken = generateAccessToken({
      id: adminUser._id.toString(),
      email: adminUser.email,
      role: 'admin',
    });

    console.log('✅ Users provisioned successfully.\n');

    const validApplicationPayload = {
      storeName: 'ElectroTech Direct',
      description: 'Authorized retailer of consumer electronics and accessories.',
      businessEmail: 'contact@electrotech.com',
      businessPhone: '+1-555-0199',
      businessAddress: {
        street: '456 Tech Boulevard, Suite 100',
        city: 'Silicon Valley',
        state: 'CA',
        postalCode: '94025',
        country: 'United States',
      },
    };

    // --------------------------------------------------------------------------
    // Test 1: Customer successfully applying for vendor status -> 201 Created
    // --------------------------------------------------------------------------
    console.log('⏳ Test 1: Customer successfully applying for vendor status...');
    const test1Res = await request(app)
      .post('/api/vendors/apply')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send(validApplicationPayload);

    assert.strictEqual(test1Res.status, 201, `Expected status 201, got ${test1Res.status}`);
    assert.strictEqual(test1Res.body.success, true);
    assert.strictEqual(test1Res.body.data.storeName, 'ElectroTech Direct');
    assert.strictEqual(test1Res.body.data.slug, 'electrotech-direct');
    assert.strictEqual(test1Res.body.data.status, 'pending', 'Newly created application must be pending');
    assert.strictEqual(test1Res.body.data.businessEmail, 'contact@electrotech.com');

    // Verify user role is STILL customer in database
    const dbUser = await User.findById(customer1._id);
    assert.strictEqual(dbUser?.role, 'customer', 'Applicant role must remain customer while pending');
    console.log('✅ Test 1 Passed: Vendor application created with pending status; applicant role remains customer.\n');

    // --------------------------------------------------------------------------
    // Test 2: Unauthenticated application attempt -> 401 Unauthorized
    // --------------------------------------------------------------------------
    console.log('⏳ Test 2: Unauthenticated application attempt...');
    const test2Res = await request(app)
      .post('/api/vendors/apply')
      .send(validApplicationPayload);

    assert.strictEqual(test2Res.status, 401, `Expected status 401, got ${test2Res.status}`);
    assert.strictEqual(test2Res.body.error.code, 'UNAUTHORIZED');
    console.log('✅ Test 2 Passed: Unauthenticated application rejected with 401 Unauthorized.\n');

    // --------------------------------------------------------------------------
    // Test 3: Duplicate application by the same user -> 409 Conflict
    // --------------------------------------------------------------------------
    console.log('⏳ Test 3: Duplicate vendor application attempt by same user...');
    const test3Res = await request(app)
      .post('/api/vendors/apply')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({
        ...validApplicationPayload,
        storeName: 'ElectroTech Secondary',
      });

    assert.strictEqual(test3Res.status, 409, `Expected status 409, got ${test3Res.status}`);
    assert.strictEqual(test3Res.body.error.code, 'CONFLICT');
    console.log('✅ Test 3 Passed: Duplicate vendor application blocked with 409 Conflict.\n');

    // --------------------------------------------------------------------------
    // Test 4: Duplicate store name by a different customer -> 409 Conflict
    // --------------------------------------------------------------------------
    console.log('⏳ Test 4: Duplicate store name attempt by different customer...');
    const test4Res = await request(app)
      .post('/api/vendors/apply')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer2Token}`])
      .send({
        ...validApplicationPayload,
        storeName: 'electrotech direct', // Case-insensitive duplicate
        businessEmail: 'candidate@different.com',
      });

    assert.strictEqual(test4Res.status, 409, `Expected status 409, got ${test4Res.status}`);
    assert.strictEqual(test4Res.body.error.code, 'CONFLICT');
    console.log('✅ Test 4 Passed: Duplicate store name blocked with 409 Conflict.\n');

    // --------------------------------------------------------------------------
    // Test 5: Invalid business email format -> 422 Validation Error
    // --------------------------------------------------------------------------
    console.log('⏳ Test 5: Invalid business email validation...');
    const test5Res = await request(app)
      .post('/api/vendors/apply')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer2Token}`])
      .send({
        ...validApplicationPayload,
        storeName: 'Gadget Grove',
        businessEmail: 'not-a-valid-email-string',
      });

    assert.strictEqual(test5Res.status, 422, `Expected status 422, got ${test5Res.status}`);
    assert.strictEqual(test5Res.body.error.code, 'VALIDATION_ERROR');
    console.log('✅ Test 5 Passed: Malformed email rejected with 422 Validation Error.\n');

    // --------------------------------------------------------------------------
    // Test 6: Missing required fields -> 422 Validation Error
    // --------------------------------------------------------------------------
    console.log('⏳ Test 6: Missing required fields...');
    const test6Res = await request(app)
      .post('/api/vendors/apply')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer2Token}`])
      .send({
        storeName: 'Incomplete Store',
        // Missing businessEmail, businessPhone, businessAddress
      });

    assert.strictEqual(test6Res.status, 422, `Expected status 422, got ${test6Res.status}`);
    assert.strictEqual(test6Res.body.error.code, 'VALIDATION_ERROR');
    console.log('✅ Test 6 Passed: Missing fields rejected with 422 Validation Error.\n');

    // --------------------------------------------------------------------------
    // Test 7: Customer retrieving own vendor profile -> 200 OK
    // --------------------------------------------------------------------------
    console.log('⏳ Test 7: Customer retrieving own vendor profile...');
    const test7Res = await request(app)
      .get('/api/vendors/me')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`]);

    assert.strictEqual(test7Res.status, 200, `Expected status 200, got ${test7Res.status}`);
    assert.strictEqual(test7Res.body.success, true);
    assert.strictEqual(test7Res.body.data.storeName, 'ElectroTech Direct');
    assert.strictEqual(test7Res.body.data.status, 'pending');
    console.log('✅ Test 7 Passed: Successfully retrieved applicant vendor profile.\n');

    // --------------------------------------------------------------------------
    // Test 8: Customer retrieving application status -> 200 OK
    // --------------------------------------------------------------------------
    console.log('⏳ Test 8: Customer retrieving application status...');
    const test8Res = await request(app)
      .get('/api/vendors/status')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`]);

    assert.strictEqual(test8Res.status, 200, `Expected status 200, got ${test8Res.status}`);
    assert.strictEqual(test8Res.body.success, true);
    assert.strictEqual(test8Res.body.data.status, 'pending');
    assert.strictEqual(test8Res.body.data.storeName, 'ElectroTech Direct');
    assert.ok(test8Res.body.data.createdAt, 'Creation timestamp must be present');
    console.log('✅ Test 8 Passed: Successfully retrieved application review status.\n');

    // --------------------------------------------------------------------------
    // Test 9: Customer attempting to self-modify approval status via PATCH -> 422 Validation Error
    // --------------------------------------------------------------------------
    console.log('⏳ Test 9: Customer attempting to modify approval status via PATCH...');
    const test9Res = await request(app)
      .patch('/api/vendors/me')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({
        status: 'approved',
      });

    assert.strictEqual(test9Res.status, 422, `Expected status 422, got ${test9Res.status}`);
    assert.strictEqual(test9Res.body.error.code, 'VALIDATION_ERROR');

    // Double check DB to ensure status remained pending
    const dbProfile = await VendorProfile.findOne({ userId: customer1._id });
    assert.strictEqual(dbProfile?.status, 'pending', 'Status in database must remain pending');
    console.log('✅ Test 9 Passed: Status modification attempt strictly rejected with 422.\n');

    // --------------------------------------------------------------------------
    // Test 10: Customer attempting to modify their role via PATCH -> 422 Validation Error
    // --------------------------------------------------------------------------
    console.log('⏳ Test 10: Customer attempting to change their role via PATCH...');
    const test10Res = await request(app)
      .patch('/api/vendors/me')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({
        role: 'vendor',
      });

    assert.strictEqual(test10Res.status, 422, `Expected status 422, got ${test10Res.status}`);
    assert.strictEqual(test10Res.body.error.code, 'VALIDATION_ERROR');

    const dbUserRoleCheck = await User.findById(customer1._id);
    assert.strictEqual(dbUserRoleCheck?.role, 'customer', 'User role must remain customer');
    console.log('✅ Test 10 Passed: Role escalation attempt strictly rejected with 422.\n');

    // --------------------------------------------------------------------------
    // Test 11: User without application accessing vendor profile -> 404 Not Found
    // --------------------------------------------------------------------------
    console.log('⏳ Test 11: Non-applicant accessing GET /api/vendors/me...');
    const test11Res = await request(app)
      .get('/api/vendors/me')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer3Token}`]);

    assert.strictEqual(test11Res.status, 404, `Expected status 404, got ${test11Res.status}`);
    assert.strictEqual(test11Res.body.error.code, 'NOT_FOUND');
    console.log('✅ Test 11 Passed: Non-applicant profile request returned 404 Not Found.\n');

    // --------------------------------------------------------------------------
    // Test 12: User without application accessing status -> 404 Not Found
    // --------------------------------------------------------------------------
    console.log('⏳ Test 12: Non-applicant accessing GET /api/vendors/status...');
    const test12Res = await request(app)
      .get('/api/vendors/status')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer3Token}`]);

    assert.strictEqual(test12Res.status, 404, `Expected status 404, got ${test12Res.status}`);
    assert.strictEqual(test12Res.body.error.code, 'NOT_FOUND');
    console.log('✅ Test 12 Passed: Non-applicant status request returned 404 Not Found.\n');

    // --------------------------------------------------------------------------
    // Test 13: Updating permitted store information -> 200 OK
    // --------------------------------------------------------------------------
    console.log('⏳ Test 13: Updating permitted store fields via PATCH /api/vendors/me...');
    const test13Res = await request(app)
      .patch('/api/vendors/me')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customer1Token}`])
      .send({
        description: 'New verified business description',
        businessPhone: '+1-555-7788',
      });

    assert.strictEqual(test13Res.status, 200, `Expected status 200, got ${test13Res.status}`);
    assert.strictEqual(test13Res.body.success, true);
    assert.strictEqual(test13Res.body.data.description, 'New verified business description');
    assert.strictEqual(test13Res.body.data.businessPhone, '+1-555-7788');
    assert.strictEqual(test13Res.body.data.status, 'pending', 'Status must remain pending');
    console.log('✅ Test 13 Passed: Permitted store information successfully updated.\n');

    // --------------------------------------------------------------------------
    // Test 14: Non-customer (Admin) attempting to apply -> 400 Bad Request
    // --------------------------------------------------------------------------
    console.log('⏳ Test 14: Admin account attempting to apply as vendor...');
    const test14Res = await request(app)
      .post('/api/vendors/apply')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${adminToken}`])
      .send({
        ...validApplicationPayload,
        storeName: 'Admin Store',
      });

    assert.strictEqual(test14Res.status, 400, `Expected status 400, got ${test14Res.status}`);
    assert.strictEqual(test14Res.body.error.code, 'BAD_REQUEST');
    console.log('✅ Test 14 Passed: Non-customer application attempt rejected with 400 Bad Request.\n');

    console.log('======================================================');
    console.log('🎉 ALL 14 VENDOR ONBOARDING TESTS PASSED SUCCESSFULLY!');
    console.log('======================================================\n');
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

runVendorOnboardingTestSuite().catch((err) => {
  console.error('❌ Test Suite Failed:', err);
  process.exit(1);
});

