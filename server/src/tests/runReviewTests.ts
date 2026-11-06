import assert from 'assert';
import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app';
import {
  User,
  VendorProfile,
  Category,
  Product,
  Order,
  VendorOrder,
  Review,
  ReviewVote,
} from '../models';
import { ReviewService } from '../services/review.service';
import { generateAccessToken, AUTH_COOKIE_NAME } from '../utils/token';

const getCookies = (token: string): string[] => [`${AUTH_COOKIE_NAME}=${token}; Path=/; HttpOnly`];

async function runReviewTestSuite() {
  console.log('\n================================================================');
  console.log('🧪 Starting Phase 9A — Product Reviews & Ratings Integration Tests');
  console.log('================================================================\n');

  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'super_secret_test_jwt_key_at_least_32_characters_long';
  process.env.JWT_ACCESS_EXPIRY = '15m';

  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
  console.log('📦 Connected to in-memory MongoDB instance for Review testing.');

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
    // Seed Base Test Infrastructure
    // --------------------------------------------------------------------------
    console.log('\n🌱 Provisioning seed users, products, and delivered orders...');

    // 1. Category
    const category = await Category.create({
      name: 'Audio & Acoustics',
      slug: 'audio-acoustics',
      description: 'Headphones and speakers',
      isActive: true,
    });

    // 2. Vendor
    const vendorUser = await User.create({
      name: 'Sonic Sound Merchant',
      email: 'vendor@sonicsound.com',
      password: 'Password123!',
      role: 'vendor',
    });
    await VendorProfile.create({
      userId: vendorUser._id,
      storeName: 'Sonic Sound Store',
      slug: 'sonic-sound-store',
      description: 'Premium audio gear',
      businessEmail: 'contact@sonicsound.com',
      businessPhone: '+919876543210',
      businessAddress: {
        street: '777 Audio Lane',
        city: 'Bangalore',
        state: 'Karnataka',
        postalCode: '560001',
        country: 'India',
      },
      status: 'approved',
    });

    // 3. Products
    const productA = await Product.create({
      name: 'Studio Wireless Headphones',
      description: 'Noise cancelling over-ear headphones with 40hr battery life',
      price: 199.99,
      categoryId: category._id,
      vendorId: vendorUser._id,
      stock: 50,
      sku: 'HEADPHONE-PRO-01',
      status: 'active',
      isDeleted: false,
      averageRating: 0,
      reviewCount: 0,
    });

    const productB = await Product.create({
      name: 'Bluetooth Mini Speaker',
      description: 'Compact waterproof travel speaker',
      price: 49.99,
      categoryId: category._id,
      vendorId: vendorUser._id,
      stock: 100,
      sku: 'SPEAKER-MINI-02',
      status: 'active',
      isDeleted: false,
      averageRating: 0,
      reviewCount: 0,
    });

    const productC = await Product.create({
      name: 'Studio Condenser Microphone',
      description: 'Cardioid USB microphone for podcasting and streaming',
      price: 129.99,
      categoryId: category._id,
      vendorId: vendorUser._id,
      stock: 25,
      sku: 'MIC-USB-03',
      status: 'active',
      isDeleted: false,
      averageRating: 0,
      reviewCount: 0,
    });

    // 4. Customers
    const customer1 = await User.create({
      name: 'Alice Buyer',
      email: 'alice@example.com',
      password: 'Password123!',
      role: 'customer',
    });
    const customer1Token = generateAccessToken({
      id: customer1._id.toString(),
      email: customer1.email,
      role: customer1.role,
    });

    const customer2 = await User.create({
      name: 'Bob Shopper',
      email: 'bob@example.com',
      password: 'Password123!',
      role: 'customer',
    });
    const customer2Token = generateAccessToken({
      id: customer2._id.toString(),
      email: customer2.email,
      role: customer2.role,
    });

    const customer3 = await User.create({
      name: 'Charlie Reviewer',
      email: 'charlie@example.com',
      password: 'Password123!',
      role: 'customer',
    });
    const customer3Token = generateAccessToken({
      id: customer3._id.toString(),
      email: customer3.email,
      role: customer3.role,
    });

    // 5. Admin
    const admin = await User.create({
      name: 'Super Moderator',
      email: 'admin@marketplace.com',
      password: 'Password123!',
      role: 'admin',
    });
    const adminToken = generateAccessToken({
      id: admin._id.toString(),
      email: admin.email,
      role: admin.role,
    });

    // Helper: Create an Order with delivered status for a customer
    const createDeliveredOrder = async (
      cust: typeof customer1,
      prod: typeof productA,
      status: 'delivered' | 'processing' | 'shipped' = 'delivered'
    ) => {
      const orderNumber = `ORD-REV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const parentOrder = await Order.create({
        orderNumber,
        userId: cust._id,
        customerId: cust._id,
        deliveryAddress: {
          fullName: cust.name,
          phone: '+919876543210',
          addressLine1: '42 Baker Street',
          city: 'Bangalore',
          state: 'Karnataka',
          postalCode: '560001',
          country: 'India',
        },
        items: [
          {
            productId: prod._id,
            vendorId: prod.vendorId,
            productName: prod.name,
            quantity: 1,
            unitPrice: prod.price,
            itemSubtotal: prod.price,
          },
        ],
        subtotal: prod.price,
        shippingAmount: 10,
        discountAmount: 0,
        totalAmount: prod.price + 10,
        paymentStatus: 'paid',
        orderStatus: status,
      });

      const vendorOrder = await VendorOrder.create({
        parentOrderId: parentOrder._id,
        vendorId: prod.vendorId,
        vendorOrderNumber: `VO-${orderNumber}`,
        items: [
          {
            productId: prod._id,
            vendorId: prod.vendorId,
            productName: prod.name,
            quantity: 1,
            unitPrice: prod.price,
            itemSubtotal: prod.price,
          },
        ],
        vendorSubtotal: prod.price,
        shippingShare: 10,
        orderStatus: status,
        statusHistory: [{ status, changedAt: new Date() }],
      });

      parentOrder.vendorOrders = [vendorOrder._id];
      await parentOrder.save();

      return { parentOrder, vendorOrder };
    };

    // Seed delivered purchase: Customer 1 bought Product A (Delivered)
    await createDeliveredOrder(customer1, productA, 'delivered');

    // Seed non-delivered purchase: Customer 2 bought Product A (Still Processing)
    await createDeliveredOrder(customer2, productA, 'processing');

    // Seed delivered purchase: Customer 2 bought Product B (Delivered)
    await createDeliveredOrder(customer2, productB, 'delivered');

    // Seed delivered purchase: Customer 3 bought Product A (Delivered)
    await createDeliveredOrder(customer3, productA, 'delivered');

    console.log('✅ Base seeding successfully initialized.\n');

    let createdReviewId: string;

    // ==========================================================================
    // Test Case 1: Eligible customer creates review
    // ==========================================================================
    await testCase('1. Eligible customer creates review for delivered product', async () => {
      const res = await request(app)
        .post(`/api/products/${productA._id}/reviews`)
        .set('Cookie', getCookies(customer1Token))
        .send({
          rating: 5,
          title: 'Amazing sound quality and battery life!',
          comment: 'The noise cancellation is phenomenal, and it lasted 3 days without a recharge.',
        });

      assert.strictEqual(res.status, 201, `Expected 201 Created but got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.data.rating, 5);
      assert.strictEqual(res.body.data.title, 'Amazing sound quality and battery life!');
      assert.strictEqual(res.body.data.isVerifiedPurchase, true);
      assert.strictEqual(res.body.data.moderationStatus, 'approved');

      createdReviewId = res.body.data.id || res.body.data._id;
      assert(createdReviewId, 'Created review must have an ID');
    });

    // ==========================================================================
    // Test Case 2: Customer without a delivered purchase is rejected
    // ==========================================================================
    await testCase('2. Customer without a delivered purchase is rejected', async () => {
      // Customer 2 bought Product A, but orderStatus is 'processing' (not 'delivered')
      const res = await request(app)
        .post(`/api/products/${productA._id}/reviews`)
        .set('Cookie', getCookies(customer2Token))
        .send({
          rating: 4,
          title: 'Can I review before delivery?',
          comment: 'I ordered this but have not received it yet.',
        });

      assert.strictEqual(res.status, 403, `Expected 403 Forbidden but got ${res.status}`);
      assert(
        res.body.error?.message?.toLowerCase().includes('delivered') ||
          res.body.error?.message?.toLowerCase().includes('eligible'),
        'Error message must indicate delivered order is required'
      );
    });

    // ==========================================================================
    // Test Case 3: Customer reviews a product not in their order
    // ==========================================================================
    await testCase('3. Customer reviews a product not in their order is rejected', async () => {
      // Customer 1 bought Product A, but attempts to review Product C (which they never ordered)
      const res = await request(app)
        .post(`/api/products/${productC._id}/reviews`)
        .set('Cookie', getCookies(customer1Token))
        .send({
          rating: 5,
          title: 'Looks nice online',
          comment: 'I never purchased this microphone but want to review it anyway.',
        });

      assert.strictEqual(res.status, 403, `Expected 403 Forbidden but got ${res.status}`);
      assert(
        res.body.error?.message?.toLowerCase().includes('purchased') ||
          res.body.error?.message?.toLowerCase().includes('eligible'),
        'Error must state customer has not purchased this product'
      );
    });

    // ==========================================================================
    // Test Case 4: Duplicate review prevention
    // ==========================================================================
    await testCase('4. Duplicate review prevention (second review for same product rejected)', async () => {
      // Customer 1 already reviewed Product A in Test 1
      const res = await request(app)
        .post(`/api/products/${productA._id}/reviews`)
        .set('Cookie', getCookies(customer1Token))
        .send({
          rating: 4,
          title: 'Second review attempt',
          comment: 'Trying to review this product a second time.',
        });

      assert.strictEqual(res.status, 409, `Expected 409 Conflict but got ${res.status}`);
      assert(
        res.body.error?.message?.toLowerCase().includes('already reviewed'),
        'Error message must indicate customer has already reviewed this product'
      );
    });

    // ==========================================================================
    // Test Case 5: Invalid rating rejection
    // ==========================================================================
    await testCase('5. Invalid rating rejection (0, 6, decimal, negative)', async () => {
      // Create delivered order for Product C for Customer 3
      await createDeliveredOrder(customer3, productC, 'delivered');

      // Rating = 6
      const res1 = await request(app)
        .post(`/api/products/${productC._id}/reviews`)
        .set('Cookie', getCookies(customer3Token))
        .send({
          rating: 6,
          title: '6 stars!',
          comment: 'Beyond the scale',
        });
      assert(
        [400, 422].includes(res1.status),
        `Rating 6 must return 400 or 422 (validation error) but got ${res1.status}`
      );

      // Rating = 0
      const res2 = await request(app)
        .post(`/api/products/${productC._id}/reviews`)
        .set('Cookie', getCookies(customer3Token))
        .send({
          rating: 0,
          title: '0 stars',
          comment: 'Zero rating',
        });
      assert(
        [400, 422].includes(res2.status),
        `Rating 0 must return 400 or 422 (validation error) but got ${res2.status}`
      );

      // Rating = 4.5 (non-integer)
      const res3 = await request(app)
        .post(`/api/products/${productC._id}/reviews`)
        .set('Cookie', getCookies(customer3Token))
        .send({
          rating: 4.5,
          title: '4.5 stars',
          comment: 'Fractional rating',
        });
      assert(
        [400, 422].includes(res3.status),
        `Rating 4.5 must return 400 or 422 (validation error) but got ${res3.status}`
      );
    });

    // ==========================================================================
    // Test Case 6: Review editing ownership
    // ==========================================================================
    await testCase('6. Review editing ownership (author edits; other customer blocked)', async () => {
      // Customer 2 attempts to edit Customer 1's review
      const resBlocked = await request(app)
        .patch(`/api/reviews/${createdReviewId}`)
        .set('Cookie', getCookies(customer2Token))
        .send({
          title: 'Hacked Title',
          rating: 1,
        });
      assert.strictEqual(resBlocked.status, 403, 'Cross-user edit must return 403 Forbidden');

      // Customer 1 (author) edits their review
      const resOwner = await request(app)
        .patch(`/api/reviews/${createdReviewId}`)
        .set('Cookie', getCookies(customer1Token))
        .send({
          title: 'Updated: Still amazing after 2 weeks!',
          rating: 5,
          comment: 'Used it on long flights and the ANC is simply brilliant.',
        });
      assert.strictEqual(resOwner.status, 200, 'Author edit must return 200 OK');
      assert.strictEqual(resOwner.body.data.title, 'Updated: Still amazing after 2 weeks!');
    });

    // ==========================================================================
    // Test Case 7: Review deletion ownership
    // ==========================================================================
    await testCase('7. Review deletion ownership (non-owner blocked, author or admin allowed)', async () => {
      // Create a temporary review by Customer 3 for deletion testing
      const tempReviewRes = await request(app)
        .post(`/api/products/${productC._id}/reviews`)
        .set('Cookie', getCookies(customer3Token))
        .send({
          rating: 4,
          title: 'Microphone test review',
          comment: 'Crisp audio recording and very sturdy mount.',
        });
      assert.strictEqual(tempReviewRes.status, 201);
      const tempReviewId = tempReviewRes.body.data.id || tempReviewRes.body.data._id;

      // Customer 1 attempts to delete Customer 3's review -> 403
      const resBlocked = await request(app)
        .delete(`/api/reviews/${tempReviewId}`)
        .set('Cookie', getCookies(customer1Token));
      assert.strictEqual(resBlocked.status, 403, 'Non-owner must be blocked from deleting');

      // Admin deletes Customer 3's review -> 200 OK
      const resAdmin = await request(app)
        .delete(`/api/reviews/${tempReviewId}`)
        .set('Cookie', getCookies(adminToken));
      assert.strictEqual(resAdmin.status, 200, 'Admin must be permitted to delete');

      const deletedCheck = await Review.findById(tempReviewId);
      assert.strictEqual(deletedCheck, null, 'Review document must be removed from DB');
    });

    // ==========================================================================
    // Test Case 8: Review moderation (Admin hides review; excluded from public endpoint)
    // ==========================================================================
    await testCase('8. Review moderation (admin hides review; excluded from public list)', async () => {
      // Customer 3 reviews Product A (Customer 3 has delivered purchase)
      const c3RevRes = await request(app)
        .post(`/api/products/${productA._id}/reviews`)
        .set('Cookie', getCookies(customer3Token))
        .send({
          rating: 2,
          title: 'Mediocre padding and clamping force',
          comment: 'Hurts my ears after an hour of wearing.',
        });
      assert.strictEqual(c3RevRes.status, 201);
      const c3RevId = c3RevRes.body.data.id || c3RevRes.body.data._id;

      // Admin hides the review
      const hideRes = await request(app)
        .patch(`/api/admin/reviews/${c3RevId}/status`)
        .set('Cookie', getCookies(adminToken))
        .send({
          status: 'hidden',
          moderationReason: 'Contains subjective discomfort dispute under investigation',
        });
      assert.strictEqual(hideRes.status, 200);
      assert.strictEqual(hideRes.body.data.moderationStatus, 'hidden');

      // Query public reviews endpoint for Product A
      const publicRes = await request(app).get(`/api/products/${productA._id}/reviews`);
      assert.strictEqual(publicRes.status, 200);
      const reviewIds = publicRes.body.data.reviews.map((r: any) => r.id || r._id);
      assert(!reviewIds.includes(c3RevId), 'Hidden review must NOT be present in public reviews');
    });

    // ==========================================================================
    // Test Case 9 & 10: Average rating and Rating distribution calculation
    // ==========================================================================
    await testCase('9. Average rating calculation (calculated accurately across approved reviews)', async () => {
      // Re-approve Customer 3's 2-star review so we have:
      // Customer 1: 5 stars
      // Customer 3: 2 stars
      // Average = (5 + 2) / 2 = 3.5
      const c3Rev = await Review.findOne({ userId: customer3._id, productId: productA._id });
      await ReviewService.adminUpdateModerationStatus(c3Rev!._id.toString(), admin._id.toString(), 'approved');

      const refreshedProduct = await Product.findById(productA._id);
      assert.strictEqual(refreshedProduct?.reviewCount, 2);
      assert.strictEqual(refreshedProduct?.averageRating, 3.5);
    });

    await testCase('10. Rating distribution breakdown (1 to 5 stars counts match exact distribution)', async () => {
      const stats = await ReviewService.calculateRatingDistribution(productA._id);

      assert.strictEqual(stats.reviewCount, 2);
      assert.strictEqual(stats.ratingDistribution[5], 1, '5-star tier must have 1 review');
      assert.strictEqual(stats.ratingDistribution[2], 1, '2-star tier must have 1 review');
      assert.strictEqual(stats.ratingDistribution[1], 0);
      assert.strictEqual(stats.ratingDistribution[3], 0);
      assert.strictEqual(stats.ratingDistribution[4], 0);
    });

    // ==========================================================================
    // Test Case 11: Helpful review voting
    // ==========================================================================
    await testCase('11. Helpful vote duplication (author cannot self-vote; voting toggles on/off)', async () => {
      // Customer 1 (author) tries to vote helpful on their own review -> 400
      const selfVoteRes = await request(app)
        .post(`/api/reviews/${createdReviewId}/helpful`)
        .set('Cookie', getCookies(customer1Token));
      assert.strictEqual(selfVoteRes.status, 400, 'Author self-voting must return 400 Bad Request');

      // Customer 2 votes helpful -> helpfulCount becomes 1
      const vote1Res = await request(app)
        .post(`/api/reviews/${createdReviewId}/helpful`)
        .set('Cookie', getCookies(customer2Token));
      assert.strictEqual(vote1Res.status, 200);
      assert.strictEqual(vote1Res.body.data.voted, true);
      assert.strictEqual(vote1Res.body.data.helpfulCount, 1);

      // Customer 2 votes helpful again -> toggles off (helpfulCount becomes 0)
      const vote2Res = await request(app)
        .post(`/api/reviews/${createdReviewId}/helpful`)
        .set('Cookie', getCookies(customer2Token));
      assert.strictEqual(vote2Res.status, 200);
      assert.strictEqual(vote2Res.body.data.voted, false);
      assert.strictEqual(vote2Res.body.data.helpfulCount, 0);
    });

    // ==========================================================================
    // Test Case 12: Hidden reviews excluded from public ratings
    // ==========================================================================
    await testCase('12. Hidden reviews excluded from public ratings and calculations', async () => {
      // Product A currently has Customer 1 (5 stars) and Customer 3 (2 stars) -> Avg 3.5
      const c3Rev = await Review.findOne({ userId: customer3._id, productId: productA._id });

      // Admin hides Customer 3's 2-star review
      await ReviewService.adminUpdateModerationStatus(c3Rev!._id.toString(), admin._id.toString(), 'hidden');

      // Check product rating: only Customer 1's 5-star review should count
      const refreshedProduct = await Product.findById(productA._id);
      assert.strictEqual(refreshedProduct?.reviewCount, 1, 'Review count must be 1 when 2nd review is hidden');
      assert.strictEqual(refreshedProduct?.averageRating, 5.0, 'Average rating must be 5.0');
    });

    // ==========================================================================
    // Test Case 13: Pagination and Filtering
    // ==========================================================================
    await testCase('13. Pagination and rating filtering (query by star rating & pagination limits)', async () => {
      // Create 3 reviews for Product B
      // Customer 2 has delivered purchase for Product B
      const c2RevRes = await request(app)
        .post(`/api/products/${productB._id}/reviews`)
        .set('Cookie', getCookies(customer2Token))
        .send({
          rating: 5,
          title: 'Amazing compact speaker',
          comment: 'Very loud for its size and completely waterproof!',
        });
      assert.strictEqual(c2RevRes.status, 201);

      // Customer 1 delivers purchase for Product B
      await createDeliveredOrder(customer1, productB, 'delivered');
      const c1RevRes = await request(app)
        .post(`/api/products/${productB._id}/reviews`)
        .set('Cookie', getCookies(customer1Token))
        .send({
          rating: 4,
          title: 'Solid little speaker',
          comment: 'Good sound quality, wishes it had a bit more bass.',
        });
      assert.strictEqual(c1RevRes.status, 201);

      // Query reviews for Product B filtering by rating=5
      const filter5Res = await request(app).get(`/api/products/${productB._id}/reviews?rating=5`);
      assert.strictEqual(filter5Res.status, 200);
      assert.strictEqual(filter5Res.body.data.reviews.length, 1);
      assert.strictEqual(filter5Res.body.data.reviews[0].rating, 5);

      // Query reviews for Product B with limit=1
      const pageRes = await request(app).get(`/api/products/${productB._id}/reviews?limit=1&page=1`);
      assert.strictEqual(pageRes.status, 200);
      assert.strictEqual(pageRes.body.data.reviews.length, 1);
      assert.strictEqual(pageRes.body.data.pagination.pages, 2);
      assert.strictEqual(pageRes.body.data.pagination.total, 2);
    });

  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
    console.log('\n🧹 Database cleaned up & in-memory MongoDB stopped.');
  }

  console.log('\n================================================================');
  console.log(`📊 Phase 9A Reviews & Ratings Test Suite Completed:`);
  console.log(`   Passed: ${passed} / 13`);
  console.log(`   Failed: ${failed} / 13`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runReviewTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
