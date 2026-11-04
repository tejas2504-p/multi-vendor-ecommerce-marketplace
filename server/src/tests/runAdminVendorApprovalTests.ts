import assert from 'assert';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app';
import { User } from '../models/user.model';
import { VendorProfile } from '../models/vendorProfile.model';
import { generateAccessToken, AUTH_COOKIE_NAME } from '../utils/token';

async function runAdminVendorApprovalTestSuite() {
  console.log('\n======================================================');
  console.log('🧪 Starting Phase 3B Admin Vendor Approval Integration Tests');
  console.log('======================================================\n');

  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'super_secret_test_jwt_key_at_least_32_characters_long';
  process.env.JWT_ACCESS_EXPIRY = '15m';

  // 1. Initialize In-Memory MongoDB Server
  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
  console.log('📦 Connected to in-memory MongoDB instance for Phase 3B testing.\n');

  const app = createApp();

  try {
    // --------------------------------------------------------------------------
    // Setup Test Users
    // --------------------------------------------------------------------------
    console.log('🌱 Provisioning test users and vendor applications...');

    // 1. Platform Super Admin
    const adminUser = await User.create({
      name: 'Super Admin',
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

    // 2. Regular Customer (Non-Vendor)
    const customerUser = await User.create({
      name: 'Regular Customer',
      email: 'customer@buyer.com',
      password: 'Password123!',
      role: 'customer',
      isActive: true,
    });
    const customerToken = generateAccessToken({
      id: customerUser._id.toString(),
      email: customerUser.email,
      role: 'customer',
    });

    // 3. Applicant 1 (To be approved)
    const applicant1 = await User.create({
      name: 'Applicant One',
      email: 'applicant1@store.com',
      password: 'Password123!',
      role: 'customer',
      isActive: true,
    });
    const applicant1Token = generateAccessToken({
      id: applicant1._id.toString(),
      email: applicant1.email,
      role: 'customer',
    });

    const profile1 = await VendorProfile.create({
      userId: applicant1._id,
      storeName: 'AeroSound Electronics',
      description: 'Audio devices and studio monitors',
      businessEmail: 'contact@aerosound.com',
      businessPhone: '+1-555-0101',
      businessAddress: {
        street: '100 Audio Way',
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
        country: 'USA',
      },
      status: 'pending',
    });

    // 4. Applicant 2 (To be rejected)
    const applicant2 = await User.create({
      name: 'Applicant Two',
      email: 'applicant2@store.com',
      password: 'Password123!',
      role: 'customer',
      isActive: true,
    });
    const applicant2Token = generateAccessToken({
      id: applicant2._id.toString(),
      email: applicant2.email,
      role: 'customer',
    });

    const profile2 = await VendorProfile.create({
      userId: applicant2._id,
      storeName: 'QuickDrop Imports',
      description: 'Generic drop-shipped goods',
      businessEmail: 'info@quickdrop.com',
      businessPhone: '+1-555-0102',
      businessAddress: {
        street: '200 Logistics Blvd',
        city: 'Miami',
        state: 'FL',
        postalCode: '33101',
        country: 'USA',
      },
      status: 'pending',
    });

    console.log('✅ Seed complete: Admin, Customer, and 2 Pending Applications.\n');

    // --------------------------------------------------------------------------
    // Test 1: Admin lists pending applications
    // --------------------------------------------------------------------------
    console.log('⏳ Test 1: Admin lists pending applications...');
    const test1Res = await request(app)
      .get('/api/admin/vendors?status=pending')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${adminToken}`]);

    assert.strictEqual(test1Res.status, 200, `Expected 200, got ${test1Res.status}`);
    assert.strictEqual(test1Res.body.success, true);
    assert.strictEqual(test1Res.body.data.length, 2, 'Should return 2 pending applications');
    assert.strictEqual(test1Res.body.meta.total, 2);
    assert.ok(test1Res.body.data[0].userId.name, 'Should populate safe applicant name');
    assert.strictEqual(test1Res.body.data[0].userId.password, undefined, 'Password must never be exposed');
    console.log('✅ Test 1 Passed: Admin successfully retrieved filtered vendor applications.\n');

    // --------------------------------------------------------------------------
    // Test 2: Customer cannot list vendor applications -> 403 Forbidden
    // --------------------------------------------------------------------------
    console.log('⏳ Test 2: Customer attempting to list vendor applications...');
    const test2Res = await request(app)
      .get('/api/admin/vendors')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customerToken}`]);

    assert.strictEqual(test2Res.status, 403, `Expected 403, got ${test2Res.status}`);
    assert.strictEqual(test2Res.body.error.code, 'FORBIDDEN');
    console.log('✅ Test 2 Passed: Customer blocked from admin vendor list with 403 Forbidden.\n');

    // --------------------------------------------------------------------------
    // Test 3: Unapproved / pending vendor cannot approve applications -> 403 Forbidden
    // --------------------------------------------------------------------------
    console.log('⏳ Test 3: Non-admin attempting to approve applications...');
    const test3Res = await request(app)
      .patch(`/api/admin/vendors/${profile1._id.toString()}/approve`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${applicant1Token}`]);

    assert.strictEqual(test3Res.status, 403, `Expected 403, got ${test3Res.status}`);
    assert.strictEqual(test3Res.body.error.code, 'FORBIDDEN');
    console.log('✅ Test 3 Passed: Non-admin blocked from approval with 403 Forbidden.\n');

    // --------------------------------------------------------------------------
    // Test 4: Admin successfully approves a pending vendor -> 200 OK
    // --------------------------------------------------------------------------
    console.log('⏳ Test 4: Admin approving pending vendor 1...');
    const test4Res = await request(app)
      .patch(`/api/admin/vendors/${profile1._id.toString()}/approve`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${adminToken}`]);

    assert.strictEqual(test4Res.status, 200, `Expected 200, got ${test4Res.status}`);
    assert.strictEqual(test4Res.body.success, true);
    assert.strictEqual(test4Res.body.data.status, 'approved', 'Profile status must be approved');
    assert.ok(test4Res.body.data.reviewedAt, 'ReviewedAt timestamp must be set');
    console.log('✅ Test 4 Passed: Admin successfully approved vendor 1 application.\n');

    // --------------------------------------------------------------------------
    // Test 5: Approved user gains vendor role in database
    // --------------------------------------------------------------------------
    console.log('⏳ Test 5: Verifying User role was atomically updated to vendor in DB...');
    const updatedApplicantUser = await User.findById(applicant1._id);
    assert.strictEqual(updatedApplicantUser?.role, 'vendor', 'User role must be updated to vendor');
    console.log('✅ Test 5 Passed: Applicant account promoted from customer to vendor role in database.\n');

    // --------------------------------------------------------------------------
    // Test 6: Admin cannot approve the same application twice -> 409 Conflict
    // --------------------------------------------------------------------------
    console.log('⏳ Test 6: Admin attempting duplicate approval on already approved vendor...');
    const test6Res = await request(app)
      .patch(`/api/admin/vendors/${profile1._id.toString()}/approve`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${adminToken}`]);

    assert.strictEqual(test6Res.status, 409, `Expected 409, got ${test6Res.status}`);
    assert.strictEqual(test6Res.body.error.code, 'CONFLICT');
    console.log('✅ Test 6 Passed: Duplicate approval blocked with 409 Conflict.\n');

    // --------------------------------------------------------------------------
    // Test 7: Admin rejects a pending application with reason -> 200 OK
    // --------------------------------------------------------------------------
    console.log('⏳ Test 7: Admin rejecting pending vendor 2 with valid reason...');
    const test7Res = await request(app)
      .patch(`/api/admin/vendors/${profile2._id.toString()}/reject`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${adminToken}`])
      .send({
        rejectionReason: 'Incomplete business registration documentation and unverified address.',
      });

    assert.strictEqual(test7Res.status, 200, `Expected 200, got ${test7Res.status}`);
    assert.strictEqual(test7Res.body.success, true);
    assert.strictEqual(test7Res.body.data.status, 'rejected');
    assert.strictEqual(
      test7Res.body.data.rejectionReason,
      'Incomplete business registration documentation and unverified address.'
    );
    console.log('✅ Test 7 Passed: Application successfully rejected with feedback.\n');

    // --------------------------------------------------------------------------
    // Test 8: Rejected applicant remains a customer in database
    // --------------------------------------------------------------------------
    console.log('⏳ Test 8: Verifying rejected applicant remains customer in DB...');
    const updatedApplicant2User = await User.findById(applicant2._id);
    assert.strictEqual(updatedApplicant2User?.role, 'customer', 'Role must remain customer');
    console.log('✅ Test 8 Passed: Rejected applicant preserved with customer role.\n');

    // --------------------------------------------------------------------------
    // Test 9: Approved vendor accesses their vendor dashboard -> 200 OK
    // --------------------------------------------------------------------------
    console.log('⏳ Test 9: Approved vendor accessing GET /api/vendor/dashboard...');
    // Since applicant 1 is now vendor, issue token with vendor role
    const approvedVendorToken = generateAccessToken({
      id: applicant1._id.toString(),
      email: applicant1.email,
      role: 'vendor',
    });

    const test9Res = await request(app)
      .get('/api/vendor/dashboard')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${approvedVendorToken}`]);

    assert.strictEqual(test9Res.status, 200, `Expected 200, got ${test9Res.status}`);
    assert.strictEqual(test9Res.body.success, true);
    assert.strictEqual(test9Res.body.data.store.storeName, 'AeroSound Electronics');
    assert.strictEqual(test9Res.body.data.store.status, 'approved');
    assert.strictEqual(test9Res.body.data.metrics.productsCount, 0, 'Placeholder product count must be 0');
    assert.strictEqual(test9Res.body.data.metrics.totalSales, 0, 'Placeholder sales must be 0');
    console.log('✅ Test 9 Passed: Approved vendor accessed dashboard with store data and 0 metrics.\n');

    // --------------------------------------------------------------------------
    // Test 10: Pending / unapproved applicant cannot access vendor dashboard -> 403 Forbidden
    // --------------------------------------------------------------------------
    console.log('⏳ Test 10: Pending applicant attempting to access vendor dashboard...');
    const test10Res = await request(app)
      .get('/api/vendor/dashboard')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${applicant2Token}`]);

    assert.strictEqual(test10Res.status, 403, `Expected 403, got ${test10Res.status}`);
    assert.strictEqual(test10Res.body.error.code, 'FORBIDDEN');
    console.log('✅ Test 10 Passed: Non-approved applicant blocked from dashboard with 403 Forbidden.\n');

    // --------------------------------------------------------------------------
    // Test 11: Approved vendor updates their store details via /api/vendor/store -> 200 OK
    // --------------------------------------------------------------------------
    console.log('⏳ Test 11: Approved vendor updating store profile via PATCH /api/vendor/store...');
    const test11Res = await request(app)
      .patch('/api/vendor/store')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${approvedVendorToken}`])
      .send({
        description: 'Updated premium sound equipment catalog',
        businessPhone: '+1-555-9988',
      });

    assert.strictEqual(test11Res.status, 200, `Expected 200, got ${test11Res.status}`);
    assert.strictEqual(test11Res.body.success, true);
    assert.strictEqual(test11Res.body.data.description, 'Updated premium sound equipment catalog');
    assert.strictEqual(test11Res.body.data.businessPhone, '+1-555-9988');
    assert.strictEqual(test11Res.body.data.status, 'approved', 'Status must remain approved');
    console.log('✅ Test 11 Passed: Vendor store settings successfully updated.\n');

    // --------------------------------------------------------------------------
    // Test 12: Unauthenticated requests return 401 Unauthorized
    // --------------------------------------------------------------------------
    console.log('⏳ Test 12: Unauthenticated requests to admin and vendor endpoints...');
    const unauthAdmin = await request(app).get('/api/admin/vendors');
    assert.strictEqual(unauthAdmin.status, 401);
    assert.strictEqual(unauthAdmin.body.error.code, 'UNAUTHORIZED');

    const unauthVendor = await request(app).get('/api/vendor/store');
    assert.strictEqual(unauthVendor.status, 401);
    assert.strictEqual(unauthVendor.body.error.code, 'UNAUTHORIZED');
    console.log('✅ Test 12 Passed: Unauthenticated requests rejected with 401 Unauthorized.\n');

    // --------------------------------------------------------------------------
    // Test 13: Unauthorized role requests return 403 Forbidden
    // --------------------------------------------------------------------------
    console.log('⏳ Test 13: Customer accessing admin application endpoint...');
    const unauthRole = await request(app)
      .get(`/api/admin/vendors/${profile1._id.toString()}`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${customerToken}`]);

    assert.strictEqual(unauthRole.status, 403);
    assert.strictEqual(unauthRole.body.error.code, 'FORBIDDEN');
    console.log('✅ Test 13 Passed: Non-admin access to admin endpoint returned 403 Forbidden.\n');

    // --------------------------------------------------------------------------
    // Test 14: Invalid application ID returns 400 Bad Request
    // --------------------------------------------------------------------------
    console.log('⏳ Test 14: Malformed application ID query...');
    const invalidIdRes = await request(app)
      .get('/api/admin/vendors/invalid-mongodb-id')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${adminToken}`]);

    assert.strictEqual(invalidIdRes.status, 400, `Expected 400, got ${invalidIdRes.status}`);
    assert.strictEqual(invalidIdRes.body.error.code, 'BAD_REQUEST');
    console.log('✅ Test 14 Passed: Malformed ID safely rejected with 400 Bad Request.\n');

    // --------------------------------------------------------------------------
    // Test 15: Invalid state transitions blocked
    // --------------------------------------------------------------------------
    console.log('⏳ Test 15: Attempting to reject an already approved vendor...');
    const invalidTransitionRes = await request(app)
      .patch(`/api/admin/vendors/${profile1._id.toString()}/reject`)
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${adminToken}`])
      .send({
        rejectionReason: 'Invalid post-approval attempt',
      });

    assert.strictEqual(invalidTransitionRes.status, 400, `Expected 400, got ${invalidTransitionRes.status}`);
    assert.strictEqual(invalidTransitionRes.body.error.code, 'BAD_REQUEST');
    console.log('✅ Test 15 Passed: Illegal state transition (rejecting approved vendor) blocked with 400.\n');

    console.log('======================================================');
    console.log('🎉 ALL 15 ADMIN VENDOR APPROVAL TESTS PASSED!');
    console.log('======================================================\n');
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

runAdminVendorApprovalTestSuite().catch((err) => {
  console.error('❌ Test Suite Failed:', err);
  process.exit(1);
});

