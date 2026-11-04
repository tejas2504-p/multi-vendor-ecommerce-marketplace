import assert from 'assert';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app';
import { AUTH_COOKIE_NAME } from '../utils/token';

const getCookiesArray = (header: unknown): string[] => {
  if (Array.isArray(header)) return header;
  if (typeof header === 'string') return [header];
  return [];
};

async function runAuthTestSuite() {
  console.log('\n======================================================');
  console.log('🧪 Starting Phase 2A Authentication Integration Tests');
  console.log('======================================================\n');

  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'super_secret_test_jwt_key_at_least_32_characters_long';
  process.env.JWT_ACCESS_EXPIRY = '15m';

  // 1. Initialize In-Memory MongoDB Server
  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
  console.log('📦 Connected to in-memory MongoDB instance for testing.');

  const app = createApp();
  let savedCookie = '';

  try {
    // --------------------------------------------------------------------------
    // Test 1: Successful Registration
    // --------------------------------------------------------------------------
    console.log('⏳ Running Test 1: Successful registration...');
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123!',
      });

    assert.strictEqual(regRes.status, 201, `Expected status 201, got ${regRes.status}`);
    assert.strictEqual(regRes.body.success, true);
    assert.strictEqual(regRes.body.data.user.name, 'John Doe');
    assert.strictEqual(regRes.body.data.user.email, 'john@example.com');
    assert.strictEqual(regRes.body.data.user.role, 'customer', 'Role must default to customer');
    assert.strictEqual(regRes.body.data.user.password, undefined, 'Password hash must NEVER be exposed');

    const regCookies = getCookiesArray(regRes.headers['set-cookie']);
    assert.ok(regCookies.length > 0, 'Set-Cookie header must be present');
    assert.ok(
      regCookies.some((c) => c.includes(`${AUTH_COOKIE_NAME}=`)),
      'access_token cookie must be set'
    );
    assert.ok(
      regCookies.some((c) => c.toLowerCase().includes('httponly')),
      'Cookie must be HTTP-only'
    );
    console.log('✅ Test 1 Passed: User registered, assigned customer role, password hidden, HTTP-only cookie delivered.\n');

    // --------------------------------------------------------------------------
    // Test 2: Duplicate Email Registration
    // --------------------------------------------------------------------------
    console.log('⏳ Running Test 2: Duplicate email registration...');
    const dupRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'John Duplicate',
        email: 'john@example.com', // Duplicate email
        password: 'Password123!',
      });

    assert.strictEqual(dupRes.status, 409, `Expected status 409, got ${dupRes.status}`);
    assert.strictEqual(dupRes.body.success, false);
    assert.strictEqual(dupRes.body.error.code, 'CONFLICT');
    console.log('✅ Test 2 Passed: Duplicate email rejected with 409 Conflict.\n');

    // --------------------------------------------------------------------------
    // Test 3: Invalid Email Format
    // --------------------------------------------------------------------------
    console.log('⏳ Running Test 3: Invalid email format...');
    const invalidEmailRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Alice',
        email: 'not-a-valid-email',
        password: 'Password123!',
      });

    assert.strictEqual(invalidEmailRes.status, 422, `Expected status 422, got ${invalidEmailRes.status}`);
    assert.strictEqual(invalidEmailRes.body.success, false);
    assert.strictEqual(invalidEmailRes.body.error.code, 'VALIDATION_ERROR');
    console.log('✅ Test 3 Passed: Malformed email rejected with 422 Validation Error.\n');

    // --------------------------------------------------------------------------
    // Test 4: Weak Password
    // --------------------------------------------------------------------------
    console.log('⏳ Running Test 4: Weak password (< 8 chars)...');
    const weakPassRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Bob',
        email: 'bob@example.com',
        password: '123',
      });

    assert.strictEqual(weakPassRes.status, 422, `Expected status 422, got ${weakPassRes.status}`);
    assert.strictEqual(weakPassRes.body.success, false);
    assert.strictEqual(weakPassRes.body.error.code, 'VALIDATION_ERROR');
    console.log('✅ Test 4 Passed: Weak password rejected with 422 Validation Error.\n');

    // --------------------------------------------------------------------------
    // Security Test: Self-Assigning Admin Role Blocked
    // --------------------------------------------------------------------------
    console.log('⏳ Running Security Check: Attempting to self-assign admin role...');
    const adminAttemptRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Malicious User',
        email: 'malicious@example.com',
        password: 'Password123!',
        role: 'admin',
      });

    assert.strictEqual(adminAttemptRes.status, 422, `Expected status 422, got ${adminAttemptRes.status}`);
    assert.strictEqual(adminAttemptRes.body.success, false);
    console.log('✅ Security Check Passed: Self-assigning admin role strictly rejected.\n');

    // --------------------------------------------------------------------------
    // Test 5: Successful Login
    // --------------------------------------------------------------------------
    console.log('⏳ Running Test 5: Successful login with correct credentials...');
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'john@example.com',
        password: 'Password123!',
      });

    assert.strictEqual(loginRes.status, 200, `Expected status 200, got ${loginRes.status}`);
    assert.strictEqual(loginRes.body.success, true);
    assert.strictEqual(loginRes.body.data.user.email, 'john@example.com');
    assert.strictEqual(loginRes.body.data.user.password, undefined);

    const loginCookies = getCookiesArray(loginRes.headers['set-cookie']);
    assert.ok(loginCookies.length > 0, 'Set-Cookie header must be present on login');
    const authCookieStr = loginCookies.find((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`));
    assert.ok(authCookieStr, 'access_token cookie must be set on login');
    savedCookie = authCookieStr.split(';')[0];
    console.log('✅ Test 5 Passed: User logged in, credentials validated, HTTP-only cookie issued.\n');

    // --------------------------------------------------------------------------
    // Test 6: Incorrect Password
    // --------------------------------------------------------------------------
    console.log('⏳ Running Test 6: Login with incorrect password...');
    const wrongPassRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'john@example.com',
        password: 'WrongPassword999!',
      });

    assert.strictEqual(wrongPassRes.status, 401, `Expected status 401, got ${wrongPassRes.status}`);
    assert.strictEqual(wrongPassRes.body.success, false);
    assert.strictEqual(wrongPassRes.body.error.code, 'UNAUTHORIZED');
    console.log('✅ Test 6 Passed: Incorrect password rejected with 401 Unauthorized.\n');

    // --------------------------------------------------------------------------
    // Test 7: Missing Credentials
    // --------------------------------------------------------------------------
    console.log('⏳ Running Test 7: Missing login credentials...');
    const missingCredsRes = await request(app)
      .post('/api/auth/login')
      .send({});

    assert.strictEqual(missingCredsRes.status, 422, `Expected status 422, got ${missingCredsRes.status}`);
    assert.strictEqual(missingCredsRes.body.success, false);
    console.log('✅ Test 7 Passed: Missing credentials rejected with 422 Validation Error.\n');

    // --------------------------------------------------------------------------
    // Test 8: Access Protected Endpoint Without Token
    // --------------------------------------------------------------------------
    console.log('⏳ Running Test 8: Access GET /api/auth/me without token...');
    const unauthMeRes = await request(app).get('/api/auth/me');

    assert.strictEqual(unauthMeRes.status, 401, `Expected status 401, got ${unauthMeRes.status}`);
    assert.strictEqual(unauthMeRes.body.success, false);
    assert.strictEqual(unauthMeRes.body.error.code, 'UNAUTHORIZED');
    console.log('✅ Test 8 Passed: Unauthenticated request rejected with 401 Unauthorized.\n');

    // --------------------------------------------------------------------------
    // Test 9: Access Protected Endpoint With Valid Token
    // --------------------------------------------------------------------------
    console.log('⏳ Running Test 9: Access GET /api/auth/me with valid auth cookie...');
    const authMeRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', savedCookie);

    assert.strictEqual(authMeRes.status, 200, `Expected status 200, got ${authMeRes.status}`);
    assert.strictEqual(authMeRes.body.success, true);
    assert.strictEqual(authMeRes.body.data.user.email, 'john@example.com');
    assert.strictEqual(authMeRes.body.data.user.name, 'John Doe');
    assert.strictEqual(authMeRes.body.data.user.role, 'customer');
    assert.strictEqual(authMeRes.body.data.user.password, undefined);
    console.log('✅ Test 9 Passed: Authenticated user profile retrieved successfully.\n');

    // --------------------------------------------------------------------------
    // Test 10: Logout and Verify Token Cookie Cleared
    // --------------------------------------------------------------------------
    console.log('⏳ Running Test 10: POST /api/auth/logout...');
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', savedCookie);

    assert.strictEqual(logoutRes.status, 200, `Expected status 200, got ${logoutRes.status}`);
    assert.strictEqual(logoutRes.body.success, true);

    const logoutCookies = getCookiesArray(logoutRes.headers['set-cookie']);
    assert.ok(logoutCookies.length > 0, 'Set-Cookie header must be present on logout');
    const clearedCookie = logoutCookies.find((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`));
    assert.ok(clearedCookie, 'Cookie must be targeted on logout');
    assert.ok(
      clearedCookie.includes(`${AUTH_COOKIE_NAME}=;`) ||
      clearedCookie.includes('Expires=Thu, 01 Jan 1970'),
      'Cookie must be expired or emptied'
    );

    // Verify subsequent request to /api/auth/me fails
    const postLogoutRes = await request(app).get('/api/auth/me');
    assert.strictEqual(postLogoutRes.status, 401);
    console.log('✅ Test 10 Passed: Session logged out, cookie cleared, subsequent protected request denied.\n');

    console.log('🎉 ALL 10 AUTHENTICATION TESTS PASSED WITH 100% SUCCESS!\n');
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

runAuthTestSuite().catch((err) => {
  console.error('❌ Test Suite Failed:', err);
  process.exit(1);
});
