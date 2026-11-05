import assert from 'assert';
import crypto from 'crypto';
import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app';
import { User } from '../models/user.model';
import { VendorProfile } from '../models/vendorProfile.model';
import { Category } from '../models/category.model';
import { Product } from '../models/product.model';
import { Address } from '../models/address.model';
import { Order } from '../models/order.model';
import { Payment } from '../models/payment.model';
import { ProcessedWebhookEvent } from '../models/webhookEvent.model';
import { generateAccessToken, AUTH_COOKIE_NAME } from '../utils/token';
import { env } from '../config/env.config';

const getCookies = (token: string): string[] => [`${AUTH_COOKIE_NAME}=${token}; Path=/; HttpOnly`];

const generateSignature = (orderId: string, paymentId: string, secret: string = env.RAZORPAY_KEY_SECRET): string => {
  return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
};

const generateWebhookSignature = (rawBody: string, secret: string = env.RAZORPAY_WEBHOOK_SECRET): string => {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
};

async function runPaymentTestSuite() {
  console.log('\n======================================================');
  console.log('🧪 Starting Phase 8A — Razorpay Payment Gateway Integration Tests');
  console.log('======================================================\n');

  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'super_secret_test_jwt_key_at_least_32_characters_long';
  process.env.JWT_ACCESS_EXPIRY = '15m';

  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
  console.log('📦 Connected to in-memory MongoDB instance for Payment testing.');

  const app = createApp();

  try {
    // --------------------------------------------------------------------------
    // Seed test users & orders
    // --------------------------------------------------------------------------
    console.log('\n🌱 Provisioning seed users, products, addresses, and orders...');

    // 1. Customer 1 & Customer 2
    const customer1 = await User.create({
      name: 'Alice Shopper',
      email: 'alice@example.com',
      password: 'Password123!',
      role: 'customer',
    });
    const customer1Token = generateAccessToken({
      id: customer1._id.toString(),
      email: customer1.email,
      role: customer1.role,
    });
    const customer1Cookies = getCookies(customer1Token);

    const customer2 = await User.create({
      name: 'Bob Buyer',
      email: 'bob@example.com',
      password: 'Password123!',
      role: 'customer',
    });
    const customer2Token = generateAccessToken({
      id: customer2._id.toString(),
      email: customer2.email,
      role: customer2.role,
    });
    const customer2Cookies = getCookies(customer2Token);

    // 2. Vendor
    const vendorUser = await User.create({
      name: 'Tech Depot',
      email: 'tech@example.com',
      password: 'Password123!',
      role: 'vendor',
    });

    await VendorProfile.create({
      userId: vendorUser._id,
      storeName: 'Tech Depot Store',
      businessEmail: 'tech@example.com',
      businessPhone: '+1234567890',
      businessAddress: {
        street: '100 Silicon Blvd',
        city: 'San Jose',
        state: 'CA',
        postalCode: '95113',
        country: 'US',
      },
      status: 'approved',
    });

    // 3. Category & Product
    const category = await Category.create({
      name: 'Electronics',
      slug: 'electronics',
      isActive: true,
    });

    const product = await Product.create({
      vendorId: vendorUser._id,
      categoryId: category._id,
      name: 'Pro Wireless Headphones',
      slug: 'pro-wireless-headphones',
      description: 'High performance studio wireless audio headphones with ANC',
      price: 250,
      stock: 50,
      status: 'active',
      sku: 'TECH-PH-001',
    });

    // 4. Delivery Address for Customer 1
    const address = await Address.create({
      userId: customer1._id,
      fullName: 'Alice Shopper',
      phone: '+15551234567',
      addressLine1: '742 Evergreen Terrace',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62704',
      country: 'US',
      isDefault: true,
    });

    // 5. Order 1 for Customer 1 ($250 subtotal + free shipping = $250.00 total)
    const order1 = await Order.create({
      orderNumber: 'ORD-TEST-001',
      userId: customer1._id,
      customerId: customer1._id,
      deliveryAddress: {
        fullName: address.fullName,
        phone: address.phone,
        addressLine1: address.addressLine1,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
      },
      items: [
        {
          productId: product._id,
          vendorId: vendorUser._id,
          productName: product.name,
          quantity: 1,
          unitPrice: 250,
          itemSubtotal: 250,
        },
      ],
      subtotal: 250,
      shippingAmount: 0,
      discountAmount: 0,
      totalAmount: 250,
      paymentStatus: 'pending',
      orderStatus: 'confirmed',
    });

    // 6. Order 2 for Customer 1 (Cancelled order for edge case testing)
    const orderCancelled = await Order.create({
      orderNumber: 'ORD-TEST-CAN',
      userId: customer1._id,
      customerId: customer1._id,
      deliveryAddress: {
        fullName: address.fullName,
        phone: address.phone,
        addressLine1: address.addressLine1,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
      },
      items: [
        {
          productId: product._id,
          vendorId: vendorUser._id,
          productName: product.name,
          quantity: 1,
          unitPrice: 250,
          itemSubtotal: 250,
        },
      ],
      subtotal: 250,
      shippingAmount: 0,
      discountAmount: 0,
      totalAmount: 250,
      paymentStatus: 'pending',
      orderStatus: 'cancelled',
    });

    console.log('✅ Seed data successfully initialized.');

    let razorpayOrderId = '';
    let razorpayPaymentId = 'pay_test_' + Date.now();

    // --------------------------------------------------------------------------
    // Test 1: Create Razorpay Order
    // --------------------------------------------------------------------------
    console.log('\n⏳ Test 1: Customer initiates payment via POST /api/payments/create-order...');
    const createRes = await request(app)
      .post('/api/payments/create-order')
      .set('Cookie', customer1Cookies)
      .send({ orderId: order1._id.toString() });

    assert.strictEqual(createRes.status, 201, `Expected 201, got ${createRes.status}`);
    assert.strictEqual(createRes.body.success, true);
    assert.strictEqual(createRes.body.data.amount, 25000, 'Payable amount must be 25000 paise (250 * 100)');
    assert.strictEqual(createRes.body.data.currency, 'INR');
    assert.strictEqual(createRes.body.data.orderNumber, 'ORD-TEST-001');
    assert.ok(createRes.body.data.razorpayOrderId.startsWith('order_'));

    razorpayOrderId = createRes.body.data.razorpayOrderId;

    // Verify Payment model record in MongoDB
    const paymentInDb = await Payment.findOne({ razorpayOrderId });
    assert.ok(paymentInDb, 'Payment document must exist in MongoDB');
    assert.strictEqual(paymentInDb.status, 'pending');
    assert.strictEqual(paymentInDb.amount, 250);
    assert.strictEqual(paymentInDb.currency, 'INR');
    console.log(`✅ Test 1 Passed: Razorpay order created [ID: ${razorpayOrderId}] with pending status.`);

    // --------------------------------------------------------------------------
    // Test 2: Complete a Test Payment & Signature Verification
    // --------------------------------------------------------------------------
    console.log('\n⏳ Test 2: Customer submits valid payment signature via POST /api/payments/verify...');
    const validSignature = generateSignature(razorpayOrderId, razorpayPaymentId);

    const verifyRes = await request(app)
      .post('/api/payments/verify')
      .set('Cookie', customer1Cookies)
      .send({
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: validSignature,
      });

    assert.strictEqual(verifyRes.status, 200, `Expected 200, got ${verifyRes.status}`);
    assert.strictEqual(verifyRes.body.success, true);
    assert.strictEqual(verifyRes.body.data.payment.status, 'captured');
    assert.strictEqual(verifyRes.body.data.order.paymentStatus, 'paid');
    assert.strictEqual(verifyRes.body.data.isDuplicate, false);

    // Verify DB update
    const updatedOrder = await Order.findById(order1._id);
    assert.strictEqual(updatedOrder?.paymentStatus, 'paid');
    const updatedPayment = await Payment.findOne({ razorpayOrderId });
    assert.strictEqual(updatedPayment?.status, 'captured');
    assert.strictEqual(updatedPayment?.razorpayPaymentId, razorpayPaymentId);
    assert.ok(updatedPayment?.verifiedAt);
    console.log('✅ Test 2 Passed: Valid signature accepted; payment captured and order marked paid.');

    // --------------------------------------------------------------------------
    // Test 3: Verify Successful Payment Signature Immutability
    // --------------------------------------------------------------------------
    console.log('\n⏳ Test 3: Verifying verified signature and timestamps in DB...');
    assert.strictEqual(updatedPayment.razorpaySignature, validSignature);
    assert.ok(updatedPayment.verifiedAt instanceof Date);
    console.log('✅ Test 3 Passed: Verified signature matches and timestamp is recorded.');

    // --------------------------------------------------------------------------
    // Test 4: Test Invalid Signature
    // --------------------------------------------------------------------------
    console.log('\n⏳ Test 4: Testing invalid signature rejection...');
    // Create an order and payment for invalid signature test
    const orderBadSig = await Order.create({
      orderNumber: 'ORD-TEST-BADSIG',
      userId: customer1._id,
      customerId: customer1._id,
      deliveryAddress: order1.deliveryAddress,
      items: order1.items,
      subtotal: 250,
      shippingAmount: 0,
      discountAmount: 0,
      totalAmount: 250,
      paymentStatus: 'pending',
      orderStatus: 'confirmed',
    });

    const createBadRes = await request(app)
      .post('/api/payments/create-order')
      .set('Cookie', customer1Cookies)
      .send({ orderId: orderBadSig._id.toString() });

    const badRzpOrderId = createBadRes.body.data.razorpayOrderId;

    const badSigRes = await request(app)
      .post('/api/payments/verify')
      .set('Cookie', customer1Cookies)
      .send({
        razorpay_order_id: badRzpOrderId,
        razorpay_payment_id: 'pay_bad_001',
        razorpay_signature: 'invalid_forged_signature_hex_digest_9999999999',
      });

    assert.strictEqual(badSigRes.status, 400, `Expected 400, got ${badSigRes.status}`);
    assert.strictEqual(badSigRes.body.success, false);

    const badPaymentInDb = await Payment.findOne({ razorpayOrderId: badRzpOrderId });
    assert.strictEqual(badPaymentInDb?.status, 'failed');
    assert.ok(badPaymentInDb?.failureReason?.includes('Invalid'));
    console.log('✅ Test 4 Passed: Invalid payment signature rejected and marked failed.');

    // --------------------------------------------------------------------------
    // Test 5: Test Failed Payment Webhook Event
    // --------------------------------------------------------------------------
    console.log('\n⏳ Test 5: Simulating payment.failed webhook event...');
    const failedPayload = {
      event: 'payment.failed',
      event_id: 'evt_failed_' + Date.now(),
      payload: {
        payment: {
          entity: {
            id: 'pay_failed_123',
            order_id: badRzpOrderId,
            amount: 25000,
            currency: 'INR',
            status: 'failed',
            method: 'card',
            error_description: 'Card declined by issuing bank',
          },
        },
      },
    };
    const failedRawBody = JSON.stringify(failedPayload);
    const failedSignature = generateWebhookSignature(failedRawBody);

    const webhookFailedRes = await request(app)
      .post('/api/payments/webhook')
      .set('x-razorpay-signature', failedSignature)
      .set('Content-Type', 'application/json')
      .send(failedRawBody);

    assert.strictEqual(webhookFailedRes.status, 200);
    const postWebhookPayment = await Payment.findOne({ razorpayOrderId: badRzpOrderId });
    assert.strictEqual(postWebhookPayment?.status, 'failed');
    assert.strictEqual(postWebhookPayment?.failureReason, 'Card declined by issuing bank');
    console.log('✅ Test 5 Passed: payment.failed webhook successfully processed and reconciled.');

    // --------------------------------------------------------------------------
    // Test 6: Test Webhook Signature Validation (Valid & Invalid)
    // --------------------------------------------------------------------------
    console.log('\n⏳ Test 6: Testing webhook signature validation...');
    const badWebhookRes = await request(app)
      .post('/api/payments/webhook')
      .set('x-razorpay-signature', 'forged_webhook_signature')
      .set('Content-Type', 'application/json')
      .send(failedRawBody);

    assert.strictEqual(badWebhookRes.status, 400, 'Forged webhook signature must return 400');
    console.log('✅ Test 6 Passed: Forged webhook signature safely rejected with 400 Bad Request.');

    // --------------------------------------------------------------------------
    // Test 7: Test Duplicate Webhook Events (Deduplication)
    // --------------------------------------------------------------------------
    console.log('\n⏳ Test 7: Testing duplicate webhook events (event deduplication)...');
    const duplicateWebhookRes = await request(app)
      .post('/api/payments/webhook')
      .set('x-razorpay-signature', failedSignature)
      .set('Content-Type', 'application/json')
      .send(failedRawBody);

    assert.strictEqual(duplicateWebhookRes.status, 200);
    assert.strictEqual(duplicateWebhookRes.body.data.isDuplicate, true);
    console.log('✅ Test 7 Passed: Duplicate webhook event recognized and safely acknowledged.');

    // --------------------------------------------------------------------------
    // Test 8: Test Duplicate Verification Requests (Replay Protection)
    // --------------------------------------------------------------------------
    console.log('\n⏳ Test 8: Testing duplicate verification replay protection...');
    const replayRes = await request(app)
      .post('/api/payments/verify')
      .set('Cookie', customer1Cookies)
      .send({
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: validSignature,
      });

    assert.strictEqual(replayRes.status, 200);
    assert.strictEqual(replayRes.body.data.isDuplicate, true);
    assert.strictEqual(replayRes.body.data.payment.status, 'captured');
    console.log('✅ Test 8 Passed: Idempotent verification replay handled safely.');

    // --------------------------------------------------------------------------
    // Test 9: Test Payment Amount Mismatch
    // --------------------------------------------------------------------------
    console.log('\n⏳ Test 9: Testing payment amount mismatch tamper protection...');
    // Create a dedicated order and payment with mismatched amount
    const orderMismatch = await Order.create({
      orderNumber: 'ORD-TEST-MISMATCH',
      userId: customer1._id,
      customerId: customer1._id,
      deliveryAddress: order1.deliveryAddress,
      items: order1.items,
      subtotal: 250,
      shippingAmount: 0,
      discountAmount: 0,
      totalAmount: 250,
      paymentStatus: 'pending',
      orderStatus: 'confirmed',
    });

    const mismatchPayment = await Payment.create({
      customerId: customer1._id,
      parentOrderId: orderMismatch._id,
      razorpayOrderId: 'order_mismatch_test_999',
      amount: 9999, // Mismatched vs order total of 250
      currency: 'INR',
      status: 'pending',
    });

    const mismatchSig = generateSignature(mismatchPayment.razorpayOrderId, 'pay_mismatch_123');
    const mismatchRes = await request(app)
      .post('/api/payments/verify')
      .set('Cookie', customer1Cookies)
      .send({
        razorpay_order_id: mismatchPayment.razorpayOrderId,
        razorpay_payment_id: 'pay_mismatch_123',
        razorpay_signature: mismatchSig,
      });

    assert.strictEqual(mismatchRes.status, 400);
    assert.ok(mismatchRes.body.error.message.includes('mismatch'));
    console.log('✅ Test 9 Passed: Payment amount mismatch blocked with 400 Bad Request.');

    // --------------------------------------------------------------------------
    // Test 10: Test Another Customer's Order Access (Tenant Isolation)
    // --------------------------------------------------------------------------
    console.log('\n⏳ Test 10: Customer 2 attempting to initiate or verify payment for Customer 1 order...');
    // Customer 2 attempts to create payment for Customer 1's order
    const crossCreateRes = await request(app)
      .post('/api/payments/create-order')
      .set('Cookie', customer2Cookies)
      .send({ orderId: order1._id.toString() });

    assert.strictEqual(crossCreateRes.status, 403, 'Cross-customer initiation must be 403');

    // Customer 2 attempts to verify payment for Customer 1's order
    const crossVerifyRes = await request(app)
      .post('/api/payments/verify')
      .set('Cookie', customer2Cookies)
      .send({
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: validSignature,
      });

    assert.strictEqual(crossVerifyRes.status, 403, 'Cross-customer verification must be 403');
    console.log('✅ Test 10 Passed: Cross-customer payment tampering strictly blocked with 403 Forbidden.');

    // --------------------------------------------------------------------------
    // Test 11: Test Payment Retry & Cancelled Order Prevention
    // --------------------------------------------------------------------------
    console.log('\n⏳ Test 11: Testing payment retry for unpaid order and blocking cancelled order...');
    // 1. Cancelled order payment creation must be rejected
    const cancelledPayRes = await request(app)
      .post('/api/payments/create-order')
      .set('Cookie', customer1Cookies)
      .send({ orderId: orderCancelled._id.toString() });

    assert.strictEqual(cancelledPayRes.status, 400);
    assert.ok(cancelledPayRes.body.error.message.includes('cancelled'));

    // 2. Already paid order creation must be rejected
    const alreadyPaidRes = await request(app)
      .post('/api/payments/create-order')
      .set('Cookie', customer1Cookies)
      .send({ orderId: order1._id.toString() });

    assert.strictEqual(alreadyPaidRes.status, 400);
    assert.ok(alreadyPaidRes.body.error.message.includes('already paid'));

    // 3. Retry on eligible pending order succeeds
    const orderRetry = await Order.create({
      orderNumber: 'ORD-TEST-RETRY',
      userId: customer1._id,
      customerId: customer1._id,
      deliveryAddress: order1.deliveryAddress,
      items: order1.items,
      subtotal: 250,
      shippingAmount: 0,
      discountAmount: 0,
      totalAmount: 250,
      paymentStatus: 'pending',
      orderStatus: 'confirmed',
    });

    const retryRes = await request(app)
      .post('/api/payments/create-order')
      .set('Cookie', customer1Cookies)
      .send({ orderId: orderRetry._id.toString() });

    assert.strictEqual(retryRes.status, 201);
    assert.strictEqual(retryRes.body.data.orderNumber, 'ORD-TEST-RETRY');
    console.log('✅ Test 11 Passed: Payment retry allowed on eligible order; blocked on cancelled/paid orders.');

    // --------------------------------------------------------------------------
    // Test 12: Verify Payment History in MongoDB
    // --------------------------------------------------------------------------
    console.log('\n⏳ Test 12: Retrieving payment history for order...');
    const historyRes = await request(app)
      .get(`/api/payments/order/${order1._id.toString()}`)
      .set('Cookie', customer1Cookies);

    assert.strictEqual(historyRes.status, 200);
    assert.strictEqual(historyRes.body.success, true);
    assert.strictEqual(historyRes.body.data.razorpayOrderId, razorpayOrderId);
    assert.strictEqual(historyRes.body.data.status, 'captured');
    assert.strictEqual(historyRes.body.data.amount, 250);
    assert.strictEqual(historyRes.body.data.currency, 'INR');
    console.log('✅ Test 12 Passed: Payment history accurately retrieved from MongoDB.');

    console.log('\n======================================================');
    console.log('🎉 ALL 12 RAZORPAY PAYMENT TESTS PASSED WITH 100% SUCCESS!');
    console.log('======================================================\n');
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

runPaymentTestSuite().catch((err) => {
  console.error('\n❌ Payment Test Suite encountered an error:', err);
  process.exit(1);
});
