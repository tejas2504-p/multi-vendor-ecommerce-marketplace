import assert from 'assert';
import crypto from 'crypto';
import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app';
import { env } from '../config/env.config';
import {
  User,
  VendorProfile,
  Category,
  Product,
  Address,
  Order,
  VendorOrder,
  Payment,
  PlatformSetting,
  VendorEarnings,
  VendorLedger,
  VendorPayout,
} from '../models';
import { CommissionService } from '../services/commission.service';
import { PaymentService } from '../services/payment.service';
import { generateAccessToken, AUTH_COOKIE_NAME } from '../utils/token';

const getCookies = (token: string): string[] => [`${AUTH_COOKIE_NAME}=${token}; Path=/; HttpOnly`];

async function runCommissionPayoutTestSuite() {
  console.log('\n================================================================');
  console.log('🧪 Starting Phase 8B — Platform Commission & Payout Management Tests');
  console.log('================================================================\n');

  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'super_secret_test_jwt_key_at_least_32_characters_long';
  process.env.JWT_ACCESS_EXPIRY = '15m';

  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
  console.log('📦 Connected to in-memory MongoDB instance for Commission & Payout tests.');

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
    // --------------------------------------------------------------------------
    // Seed Users, Vendors, and Infrastructure
    // --------------------------------------------------------------------------
    console.log('\n🌱 Provisioning seed test data...');

    // 1. Customer
    const customer = await User.create({
      name: 'Charlie Customer',
      email: 'customer@example.com',
      password: 'Password123!',
      role: 'customer',
    });
    const customerToken = generateAccessToken({
      id: customer._id.toString(),
      email: customer.email,
      role: customer.role,
    });

    // 2. Vendor 1 (uses default commission)
    const vendorUser1 = await User.create({
      name: 'Default Rate Vendor',
      email: 'vendor1@example.com',
      password: 'Password123!',
      role: 'vendor',
    });
    const vendor1Token = generateAccessToken({
      id: vendorUser1._id.toString(),
      email: vendorUser1.email,
      role: vendorUser1.role,
    });
    await VendorProfile.create({
      userId: vendorUser1._id,
      storeName: 'Vendor One Tech Store',
      slug: 'vendor-one-tech-store',
      description: 'High quality electronics',
      businessEmail: 'contact@vendor1.com',
      businessPhone: '+919876543210',
      businessAddress: {
        street: '123 Tech Park',
        city: 'Bangalore',
        state: 'Karnataka',
        postalCode: '560001',
        country: 'India',
      },
      status: 'approved',
    });

    // 3. Vendor 2 (uses custom commission override: 15%)
    const vendorUser2 = await User.create({
      name: 'Custom Override Vendor',
      email: 'vendor2@example.com',
      password: 'Password123!',
      role: 'vendor',
    });
    const vendor2Token = generateAccessToken({
      id: vendorUser2._id.toString(),
      email: vendorUser2.email,
      role: vendorUser2.role,
    });
    await VendorProfile.create({
      userId: vendorUser2._id,
      storeName: 'Vendor Two Fashion House',
      slug: 'vendor-two-fashion-house',
      description: 'Designer fashion',
      businessEmail: 'contact@vendor2.com',
      businessPhone: '+919876543211',
      businessAddress: {
        street: '456 Fashion Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001',
        country: 'India',
      },
      status: 'approved',
      commissionRate: 15.0, // Custom 15% commission override
    });

    // 4. Admin
    const admin = await User.create({
      name: 'Super Admin',
      email: 'admin@example.com',
      password: 'Password123!',
      role: 'admin',
    });
    const adminToken = generateAccessToken({
      id: admin._id.toString(),
      email: admin.email,
      role: admin.role,
    });

    // Set platform default commission rate to 10%
    await PlatformSetting.create({
      key: 'default_commission_rate',
      value: 10.0,
      description: 'Default platform commission rate',
    });
    await PlatformSetting.create({
      key: 'min_payout_amount',
      value: 50.0,
      description: 'Minimum withdrawal payout threshold',
    });

    console.log('✅ Base seeding complete.\n');

    // --------------------------------------------------------------------------
    // Helper to generate a multi-vendor order for testing
    // --------------------------------------------------------------------------
    const createTestOrder = async (grossV1 = 1000, grossV2 = 2000, shippingTotal = 150) => {
      const orderNumber = `ORD-TEST-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const parentOrder = await Order.create({
        orderNumber,
        userId: customer._id,
        customerId: customer._id,
        deliveryAddress: {
          fullName: 'Charlie Customer',
          phone: '+919876543210',
          addressLine1: 'Test Address Line',
          city: 'Bangalore',
          state: 'Karnataka',
          postalCode: '560001',
          country: 'India',
        },
        items: [
          {
            productId: new Types.ObjectId(),
            productName: 'Gadget One',
            quantity: 1,
            unitPrice: grossV1,
            itemSubtotal: grossV1,
            vendorId: vendorUser1._id,
          },
          {
            productId: new Types.ObjectId(),
            productName: 'Apparel Two',
            quantity: 1,
            unitPrice: grossV2,
            itemSubtotal: grossV2,
            vendorId: vendorUser2._id,
          },
        ],
        subtotal: grossV1 + grossV2,
        shippingAmount: shippingTotal,
        discountAmount: 0,
        totalAmount: grossV1 + grossV2 + shippingTotal,
        paymentStatus: 'pending',
        orderStatus: 'pending',
      });

      const vo1 = await VendorOrder.create({
        parentOrderId: parentOrder._id,
        vendorId: vendorUser1._id,
        vendorOrderNumber: `VO-${orderNumber}-1`,
        items: [
          {
            productId: new Types.ObjectId(),
            productName: 'Gadget One',
            quantity: 1,
            unitPrice: grossV1,
            itemSubtotal: grossV1,
            vendorId: vendorUser1._id,
          },
        ],
        vendorSubtotal: grossV1,
        shippingShare: Math.round(shippingTotal / 2),
        orderStatus: 'pending',
        statusHistory: [{ status: 'pending', changedAt: new Date() }],
      });

      const vo2 = await VendorOrder.create({
        parentOrderId: parentOrder._id,
        vendorId: vendorUser2._id,
        vendorOrderNumber: `VO-${orderNumber}-2`,
        items: [
          {
            productId: new Types.ObjectId(),
            productName: 'Apparel Two',
            quantity: 1,
            unitPrice: grossV2,
            itemSubtotal: grossV2,
            vendorId: vendorUser2._id,
          },
        ],
        vendorSubtotal: grossV2,
        shippingShare: Math.round(shippingTotal / 2),
        orderStatus: 'pending',
        statusHistory: [{ status: 'pending', changedAt: new Date() }],
      });

      parentOrder.vendorOrders = [vo1._id, vo2._id];
      await parentOrder.save();

      return { parentOrder, vo1, vo2 };
    };

    // ==========================================================================
    // Test Case 1: Platform default commission rate applied correctly
    // ==========================================================================
    await testCase('1. Platform default commission rate applied correctly (10%)', async () => {
      const rate = await CommissionService.getEffectiveCommissionRate(vendorUser1._id);
      assert.strictEqual(rate, 10.0, 'Default commission rate should be 10%');
    });

    // ==========================================================================
    // Test Case 2: Vendor-specific commission rate overrides default
    // ==========================================================================
    await testCase('2. Vendor-specific commission override applied correctly (15%)', async () => {
      const rate = await CommissionService.getEffectiveCommissionRate(vendorUser2._id);
      assert.strictEqual(rate, 15.0, 'Vendor 2 should have overridden 15% commission rate');
    });

    // ==========================================================================
    // Test Case 3 & 4 & 5: Non-commissionable amounts excluded & Exact Reconciliation
    // ==========================================================================
    await testCase('3. Non-commissionable amounts excluded (grossAmount = vendorSubtotal)', async () => {
      const { parentOrder, vo1 } = await createTestOrder(1250, 2500, 200);

      // Mark paid to enable commission calculation
      parentOrder.paymentStatus = 'paid';
      await parentOrder.save();

      await CommissionService.calculateAndRecordCommission(parentOrder._id);

      const refreshedVo1 = await VendorOrder.findById(vo1._id);
      assert(refreshedVo1?.commission, 'Commission snapshot must exist on vendor order');
      assert.strictEqual(
        refreshedVo1.commission.grossAmount,
        1250,
        'Commissionable grossAmount must match vendorSubtotal exactly (excluding shipping)'
      );
    });

    await testCase('4. Decimal-safe integer minor units (paise) math without drift', async () => {
      // Test odd fractional amounts (e.g. ₹99.99 with 10% commission)
      const { parentOrder, vo1 } = await createTestOrder(99.99, 100, 10);
      parentOrder.paymentStatus = 'paid';
      await parentOrder.save();

      await CommissionService.calculateAndRecordCommission(parentOrder._id);

      const refreshedVo1 = await VendorOrder.findById(vo1._id);
      assert(refreshedVo1?.commission);
      // gross 99.99 -> 9999 paise. 10% = 1000 paise = 10.00. vendorEarnings = 89.99.
      assert.strictEqual(refreshedVo1.commission.platformFee, 10.0);
      assert.strictEqual(refreshedVo1.commission.vendorEarnings, 89.99);
    });

    await testCase('5. Reconciliation invariant holds: grossAmount == platformFee + vendorEarnings', async () => {
      const { parentOrder, vo1, vo2 } = await createTestOrder(1499.5, 3333.33, 100);
      parentOrder.paymentStatus = 'paid';
      await parentOrder.save();

      await CommissionService.calculateAndRecordCommission(parentOrder._id);

      const [rVo1, rVo2] = await Promise.all([
        VendorOrder.findById(vo1._id),
        VendorOrder.findById(vo2._id),
      ]);

      assert(rVo1?.commission && rVo2?.commission);

      const sumVo1 = Math.round((rVo1.commission.platformFee + rVo1.commission.vendorEarnings) * 100) / 100;
      assert.strictEqual(sumVo1, rVo1.commission.grossAmount, 'VO1 fee + earnings must equal gross');

      const sumVo2 = Math.round((rVo2.commission.platformFee + rVo2.commission.vendorEarnings) * 100) / 100;
      assert.strictEqual(sumVo2, rVo2.commission.grossAmount, 'VO2 fee + earnings must equal gross');
    });

    // ==========================================================================
    // Test Case 6: Verified captured payment triggers automatic commission calculation
    // ==========================================================================
    await testCase('6. Verified captured payment triggers automatic commission calculation', async () => {
      const { parentOrder, vo1 } = await createTestOrder(500, 500, 50);

      // Create pending payment record
      await Payment.create({
        customerId: customer._id,
        parentOrderId: parentOrder._id,
        razorpayOrderId: 'rzp_order_auto_comm_test',
        amount: parentOrder.totalAmount,
        currency: 'INR',
        status: 'pending',
      });

      // Verify payment through PaymentService
      const fakePaymentId = 'pay_auto_comm_test_123';
      const fakeSignature = crypto
        .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
        .update(`rzp_order_auto_comm_test|${fakePaymentId}`)
        .digest('hex');

      await PaymentService.verifyPayment(customer._id.toString(), {
        razorpay_order_id: 'rzp_order_auto_comm_test',
        razorpay_payment_id: fakePaymentId,
        razorpay_signature: fakeSignature,
      });

      // Assert that parent order is paid and vendor orders now have commission calculated
      const refreshedVo1 = await VendorOrder.findById(vo1._id);
      assert(refreshedVo1?.commission?.calculatedAt, 'Commission must be snapshotted automatically upon payment');
      assert.strictEqual(refreshedVo1.commission.grossAmount, 500);
      assert.strictEqual(refreshedVo1.commission.platformFee, 50);
      assert.strictEqual(refreshedVo1.commission.vendorEarnings, 450);
    });

    // ==========================================================================
    // Test Case 7: Commission calculation is strictly idempotent
    // ==========================================================================
    await testCase('7. Commission calculation is idempotent: re-invoking does not duplicate earnings', async () => {
      const { parentOrder } = await createTestOrder(1000, 1000, 100);
      parentOrder.paymentStatus = 'paid';
      await parentOrder.save();

      // First run
      await CommissionService.calculateAndRecordCommission(parentOrder._id);
      const earningsAfterRun1 = await VendorEarnings.findOne({ vendorId: vendorUser1._id });
      const balanceRun1 = earningsAfterRun1!.availableBalance;

      // Second run (re-invoking)
      await CommissionService.calculateAndRecordCommission(parentOrder._id);
      const earningsAfterRun2 = await VendorEarnings.findOne({ vendorId: vendorUser1._id });
      const balanceRun2 = earningsAfterRun2!.availableBalance;

      assert.strictEqual(balanceRun1, balanceRun2, 'Balance must remain identical on repeated execution');
    });

    // ==========================================================================
    // Test Case 8: Vendor earnings and ledger credit entry created atomically
    // ==========================================================================
    await testCase('8. Vendor earnings record and ledger credit entry created atomically', async () => {
      const { parentOrder, vo1 } = await createTestOrder(800, 800, 50);
      parentOrder.paymentStatus = 'paid';
      await parentOrder.save();

      const prevEarnings = await VendorEarnings.findOne({ vendorId: vendorUser1._id });
      const prevBal = prevEarnings ? prevEarnings.availableBalance : 0;

      await CommissionService.calculateAndRecordCommission(parentOrder._id);

      const updatedEarnings = await VendorEarnings.findOne({ vendorId: vendorUser1._id });
      const expectedCredit = 720; // 800 - 10%
      assert.strictEqual(
        Math.round((updatedEarnings!.availableBalance - prevBal) * 100) / 100,
        expectedCredit
      );

      const ledger = await VendorLedger.findOne({
        vendorOrderId: vo1._id,
        transactionType: 'order_earning',
      });
      assert(ledger, 'Ledger entry must exist');
      assert.strictEqual(ledger.direction, 'credit');
      assert.strictEqual(ledger.amount, 720);
      assert.strictEqual(ledger.balanceAfter, updatedEarnings!.availableBalance);
    });

    // ==========================================================================
    // Test Case 9: Vendor requests payout with sufficient balance
    // ==========================================================================
    let createdPayoutId: string;
    await testCase('9. Vendor requests payout: reserves balance, creates ledger debit & requested status', async () => {
      const earningsBefore = await VendorEarnings.findOne({ vendorId: vendorUser1._id });
      assert(earningsBefore && earningsBefore.availableBalance >= 100, 'Vendor must have available balance');

      const withdrawAmount = 100;
      const initialAvailable = earningsBefore.availableBalance;
      const initialPending = earningsBefore.pendingBalance;

      const res = await request(app)
        .post('/api/vendor/payouts/request')
        .set('Cookie', getCookies(vendor1Token))
        .send({
          amount: withdrawAmount,
          destinationReference: 'alice@upi',
        });

      assert.strictEqual(res.status, 201, `Expected 201 but got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.data.payoutStatus, 'requested');
      assert.strictEqual(res.body.data.requestedAmount, withdrawAmount);
      createdPayoutId = res.body.data.id || res.body.data._id;

      // Verify balance moved atomically
      const earningsAfter = await VendorEarnings.findOne({ vendorId: vendorUser1._id });
      assert.strictEqual(
        Math.round(earningsAfter!.availableBalance * 100) / 100,
        Math.round((initialAvailable - withdrawAmount) * 100) / 100,
        'availableBalance must be decremented'
      );
      assert.strictEqual(
        Math.round(earningsAfter!.pendingBalance * 100) / 100,
        Math.round((initialPending + withdrawAmount) * 100) / 100,
        'pendingBalance must be incremented'
      );

      // Verify debit ledger entry
      const debitLedger = await VendorLedger.findOne({
        payoutId: new Types.ObjectId(createdPayoutId),
        transactionType: 'payout_requested',
      });
      assert(debitLedger, 'Debit ledger transaction must exist');
      assert.strictEqual(debitLedger.direction, 'debit');
      assert.strictEqual(debitLedger.amount, withdrawAmount);
    });

    // ==========================================================================
    // Test Case 10: Vendor payout request rejected if amount exceeds available balance
    // ==========================================================================
    await testCase('10. Vendor payout request rejected if amount exceeds available balance', async () => {
      const res = await request(app)
        .post('/api/vendor/payouts/request')
        .set('Cookie', getCookies(vendor1Token))
        .send({
          amount: 9999999, // Exceeds balance
          destinationReference: 'alice@upi',
        });

      assert.strictEqual(res.status, 400, 'Must return 400 Bad Request');
      assert(
        res.body.error?.message?.toLowerCase().includes('insufficient') ||
          res.body.error?.message?.toLowerCase().includes('balance'),
        'Error message must indicate insufficient balance'
      );
    });

    // ==========================================================================
    // Test Case 11: Vendor payout request rejected if below minimum payout threshold
    // ==========================================================================
    await testCase('11. Vendor payout request rejected if below minimum payout threshold (₹50)', async () => {
      const res = await request(app)
        .post('/api/vendor/payouts/request')
        .set('Cookie', getCookies(vendor1Token))
        .send({
          amount: 10, // Below min payout of 50
          destinationReference: 'alice@upi',
        });

      assert.strictEqual(res.status, 400, 'Must return 400 Bad Request');
      assert(
        res.body.error?.message?.toLowerCase().includes('minimum'),
        'Error message must state minimum withdrawal threshold'
      );
    });

    // ==========================================================================
    // Test Case 12: Admin approves payout
    // ==========================================================================
    await testCase('12. Admin approves payout: status moves to approved', async () => {
      assert(createdPayoutId, 'Created payout ID must exist');

      const res = await request(app)
        .patch(`/api/admin/payouts/${createdPayoutId}/approve`)
        .set('Cookie', getCookies(adminToken));

      assert.strictEqual(res.status, 200, `Expected 200 but got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.data.payoutStatus, 'approved');
      assert.strictEqual(res.body.data.approvedAmount, 100);
    });

    // ==========================================================================
    // Test Case 13: Admin rejects payout (restores reserved balance & logs reversal)
    // ==========================================================================
    await testCase('13. Admin rejects payout: restores reserved balance and logs reversal credit', async () => {
      // Create a second payout specifically for rejection testing
      const payoutRes = await request(app)
        .post('/api/vendor/payouts/request')
        .set('Cookie', getCookies(vendor1Token))
        .send({
          amount: 60,
          destinationReference: 'alice@upi',
        });
      assert.strictEqual(payoutRes.status, 201);
      const rejectTestPayoutId = payoutRes.body.data.id || payoutRes.body.data._id;

      const earningsBeforeReject = await VendorEarnings.findOne({ vendorId: vendorUser1._id });
      const availBefore = earningsBeforeReject!.availableBalance;
      const pendBefore = earningsBeforeReject!.pendingBalance;

      // Reject as admin
      const rejectRes = await request(app)
        .patch(`/api/admin/payouts/${rejectTestPayoutId}/reject`)
        .set('Cookie', getCookies(adminToken))
        .send({
          rejectionReason: 'Invalid beneficiary KYC documents',
        });

      assert.strictEqual(rejectRes.status, 200);
      assert.strictEqual(rejectRes.body.data.payoutStatus, 'rejected');
      assert.strictEqual(rejectRes.body.data.rejectionReason, 'Invalid beneficiary KYC documents');

      // Assert balance restoration: pending -> available
      const earningsAfterReject = await VendorEarnings.findOne({ vendorId: vendorUser1._id });
      assert.strictEqual(
        Math.round(earningsAfterReject!.availableBalance * 100) / 100,
        Math.round((availBefore + 60) * 100) / 100,
        'availableBalance must be restored'
      );
      assert.strictEqual(
        Math.round(earningsAfterReject!.pendingBalance * 100) / 100,
        Math.round((pendBefore - 60) * 100) / 100,
        'pendingBalance must be restored'
      );

      // Assert credit reversal ledger
      const reversalLedger = await VendorLedger.findOne({
        payoutId: new Types.ObjectId(rejectTestPayoutId),
        transactionType: 'payout_rejected',
      });
      assert(reversalLedger, 'Reversal ledger entry must exist');
      assert.strictEqual(reversalLedger.direction, 'credit');
      assert.strictEqual(reversalLedger.amount, 60);
    });

    // ==========================================================================
    // Test Case 14: Admin marks payout as paid with provider reference
    // ==========================================================================
    await testCase('14. Admin marks payout as paid with provider reference: pending -> paidOutAmount', async () => {
      // createdPayoutId was approved in test 12. Now mark paid.
      const earningsBeforeSettle = await VendorEarnings.findOne({ vendorId: vendorUser1._id });
      const initialPaidOut = earningsBeforeSettle!.paidOutAmount;
      const initialPending = earningsBeforeSettle!.pendingBalance;

      const res = await request(app)
        .patch(`/api/admin/payouts/${createdPayoutId}/status`)
        .set('Cookie', getCookies(adminToken))
        .send({
          status: 'paid',
          providerReference: 'UTR-HDFC-9988776655',
        });

      assert.strictEqual(res.status, 200, `Expected 200 but got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.data.payoutStatus, 'paid');
      assert.strictEqual(res.body.data.providerReference, 'UTR-HDFC-9988776655');

      const earningsAfterSettle = await VendorEarnings.findOne({ vendorId: vendorUser1._id });
      assert.strictEqual(
        Math.round(earningsAfterSettle!.paidOutAmount * 100) / 100,
        Math.round((initialPaidOut + 100) * 100) / 100,
        'paidOutAmount must be incremented'
      );
      assert.strictEqual(
        Math.round(earningsAfterSettle!.pendingBalance * 100) / 100,
        Math.round((initialPending - 100) * 100) / 100,
        'pendingBalance must be decremented'
      );

      // Verify settlement ledger entry
      const settleLedger = await VendorLedger.findOne({
        payoutId: new Types.ObjectId(createdPayoutId),
        transactionType: 'payout_processed',
      });
      assert(settleLedger, 'Settlement ledger entry must exist');
      assert.strictEqual(settleLedger.amount, 100);
    });

  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
    console.log('\n🧹 Database cleaned up & in-memory MongoDB stopped.');
  }

  console.log('\n================================================================');
  console.log(`📊 Phase 8B Commission & Payout Test Suite Completed:`);
  console.log(`   Passed: ${passed} / 14`);
  console.log(`   Failed: ${failed} / 14`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCommissionPayoutTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
