/**
 * Phase 4B — AWS S3 Image Upload Integration Test Suite
 *
 * Uses:
 * - mongodb-memory-server for a clean isolated MongoDB instance
 * - supertest for HTTP assertions
 * - generateAccessToken for JWT cookie setup (same pattern as Phase 4A tests)
 *
 * S3 is NOT called in tests — productImage.service functions are replaced via
 * process-level module registry patching BEFORE the app is instantiated,
 * ensuring no real AWS calls are made.
 *
 * Tests:
 *  1.  Approved vendor uploads one image
 *  2.  Approved vendor uploads multiple images
 *  3.  Customer attempts image upload → 403
 *  4.  Pending applicant attempts image upload → 403
 *  5.  Vendor B attempts to upload to Vendor A's product → 403
 *  6.  Invalid file type rejected → 400
 *  7.  Oversized image rejected → 400 / 413
 *  8.  Empty/no-file upload rejected → 400
 *  9.  Image limit (5 max) enforced → 400
 * 10.  Image replacement works
 * 11.  Image deletion works
 * 12.  MongoDB image references correct after upload
 * 13.  Presigned URL generation called (GET /images)
 * 14.  AWS S3 upload failure handled safely → 500
 * 15.  DB failure triggers S3 cleanup
 * 16.  Unauthorized image deletion blocked → 403
 */

import assert from 'assert';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// ─── Environment must be set BEFORE importing app ─────────────────────────────
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'super_secret_test_jwt_key_at_least_32_characters_long';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_S3_BUCKET_NAME = 'test-bucket';

import { ImageStorageService } from '../services/image.service';

// ─── S3 / Image Service Mocks ─────────────────────────────────────────────────
let s3ShouldFail = false;
const s3DeleteCalled: string[] = [];

ImageStorageService.uploadImageToS3 = async (
  buffer: Buffer,
  mimeType: string,
  originalName: string,
  vendorId: string,
  productId: string
) => {
  if (s3ShouldFail) throw new Error('Simulated S3 failure');
  return {
    key: `products/${vendorId}/${productId}/mock-${Date.now()}.jpg`,
    originalName,
    mimeType,
    sizeBytes: buffer.length,
    uploadedAt: new Date().toISOString(),
  };
};

ImageStorageService.deleteImageFromS3 = async (key: string) => {
  s3DeleteCalled.push(key);
};

ImageStorageService.deleteImagesFromS3 = async (keys: string[]) => {
  s3DeleteCalled.push(...keys);
};

ImageStorageService.generatePresignedGetUrl = async (key: string) =>
  `https://test-bucket.s3.amazonaws.com/${key}?X-Amz-Signature=mock`;

ImageStorageService.generatePresignedGetUrls = async (keys: string[]) =>
  keys.map((k: string) => `https://test-bucket.s3.amazonaws.com/${k}?X-Amz-Signature=mock`);

// ─── Now import app and models ────────────────────────────────────────────────
import { createApp } from '../app';
import { User } from '../models/user.model';
import { VendorProfile } from '../models/vendorProfile.model';
import { Product } from '../models/product.model';
import { Category } from '../models/category.model';
import { generateAccessToken, AUTH_COOKIE_NAME } from '../utils/token';

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Build a fake JPEG buffer (3-byte magic) */
const fakeJpeg = (size = 200): Buffer => {
  const buf = Buffer.alloc(size);
  buf[0] = 0xff; buf[1] = 0xd8; buf[2] = 0xff;
  return buf;
};
const fakePng = (size = 200): Buffer => {
  const buf = Buffer.alloc(size);
  buf[0] = 0x89; buf[1] = 0x50; buf[2] = 0x4e; buf[3] = 0x47;
  return buf;
};

// ─── Main Runner ──────────────────────────────────────────────────────────────
async function runImageUploadTestSuite() {
  console.log('\n======================================================');
  console.log('🧪 Starting Phase 4B — Image Upload Integration Tests');
  console.log('======================================================\n');

  const mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  console.log('📦 Connected to in-memory MongoDB instance for testing.\n');

  const app = createApp();

  // ── Seed ──────────────────────────────────────────────────────────────────
  console.log('🌱 Provisioning test users, vendor profiles, and product...');

  // Admin
  const admin = await User.create({ name: 'Admin', email: 'admin@test.com', password: 'Password123!', role: 'admin', isActive: true });
  const adminToken = generateAccessToken({ id: admin._id.toString(), email: admin.email, role: 'admin' });

  // Approved Vendor 1
  const v1 = await User.create({ name: 'Vendor1', email: 'v1@test.com', password: 'Password123!', role: 'vendor', isActive: true });
  await VendorProfile.create({
    userId: v1._id, storeName: 'Store V1', slug: 'store-v1',
    businessEmail: 'v1@biz.com', businessPhone: '1234567890',
    businessAddress: { street: '1 Main St', city: 'City', state: 'ST', postalCode: '10001', country: 'US' },
    status: 'approved',
  });
  const v1Token = generateAccessToken({ id: v1._id.toString(), email: v1.email, role: 'vendor' });

  // Approved Vendor 2
  const v2 = await User.create({ name: 'Vendor2', email: 'v2@test.com', password: 'Password123!', role: 'vendor', isActive: true });
  await VendorProfile.create({
    userId: v2._id, storeName: 'Store V2', slug: 'store-v2',
    businessEmail: 'v2@biz.com', businessPhone: '0987654321',
    businessAddress: { street: '2 Main St', city: 'City', state: 'ST', postalCode: '10001', country: 'US' },
    status: 'approved',
  });
  const v2Token = generateAccessToken({ id: v2._id.toString(), email: v2.email, role: 'vendor' });

  // Customer
  const customer = await User.create({ name: 'Cust', email: 'cust@test.com', password: 'Password123!', role: 'customer', isActive: true });
  const customerToken = generateAccessToken({ id: customer._id.toString(), email: customer.email, role: 'customer' });

  // Pending vendor (role=customer, profile=pending)
  const pending = await User.create({ name: 'Pending', email: 'pending@test.com', password: 'Password123!', role: 'customer', isActive: true });
  await VendorProfile.create({
    userId: pending._id, storeName: 'Pending Store', slug: 'pending-store',
    businessEmail: 'pending@biz.com', businessPhone: '1111111111',
    businessAddress: { street: '3 St', city: 'City', state: 'ST', postalCode: '10001', country: 'US' },
    status: 'pending',
  });
  const pendingToken = generateAccessToken({ id: pending._id.toString(), email: pending.email, role: 'customer' });

  // Category & Product (owned by Vendor 1)
  const cat = await Category.create({ name: 'Electronics', slug: 'electronics', isActive: true });
  const prod = await Product.create({
    name: 'Test Product', description: 'Product used for image upload testing scenarios',
    price: 49.99, categoryId: cat._id, vendorId: v1._id,
    stock: 5, images: [], brand: 'MockBrand', sku: 'MOCK-TEST-001', status: 'active', isDeleted: false,
  });
  const productId = prod._id.toString();

  console.log('✅ Seed complete: Admin, 2 Approved Vendors, Customer, Pending, Category, Product\n');

  // ── Helper ─────────────────────────────────────────────────────────────────
  const authCookie = (token: string) => `${AUTH_COOKIE_NAME}=${token}`;

  let passed = 0;
  let failed = 0;

  const pass = (label: string) => {
    console.log(`✅ Test ${passed + failed + 1} Passed: ${label}`);
    passed++;
  };
  const fail = (label: string, reason: string) => {
    console.error(`❌ Test ${passed + failed + 1} Failed: ${label} — ${reason}`);
    failed++;
  };

  // ── Test 1: Approved vendor uploads one image ──────────────────────────────
  console.log('⏳ Test 1: Approved vendor uploads one image...');
  try {
    const res = await request(app)
      .post(`/api/products/${productId}/images`)
      .set('Cookie', authCookie(v1Token))
      .attach('images', fakeJpeg(), { filename: 'photo.jpg', contentType: 'image/jpeg' });

    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.ok(res.body.data.images?.length === 1, 'Expected 1 image in response');
    assert.ok(res.body.data.images[0].key, 'Image key missing');
    pass('Approved vendor uploads one image, metadata returned');
  } catch (e: any) { fail('Single image upload', e.message); }

  // ── Test 2: Approved vendor uploads multiple images ────────────────────────
  console.log('⏳ Test 2: Approved vendor uploads multiple images...');
  try {
    await Product.updateOne({ _id: productId }, { $set: { images: [] } });
    const res = await request(app)
      .post(`/api/products/${productId}/images`)
      .set('Cookie', authCookie(v1Token))
      .attach('images', fakeJpeg(), { filename: 'a.jpg', contentType: 'image/jpeg' })
      .attach('images', fakePng(), { filename: 'b.png', contentType: 'image/png' });

    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.body.data.images.length, 2, `Expected 2 images, got ${res.body.data.images.length}`);
    pass('Multiple images uploaded, all metadata returned');
  } catch (e: any) { fail('Multiple image upload', e.message); }

  // ── Test 3: Customer blocked ───────────────────────────────────────────────
  console.log('⏳ Test 3: Customer attempting image upload...');
  try {
    const res = await request(app)
      .post(`/api/products/${productId}/images`)
      .set('Cookie', authCookie(customerToken))
      .attach('images', fakeJpeg(), { filename: 'photo.jpg', contentType: 'image/jpeg' });
    assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
    pass('Customer blocked from image upload with 403 Forbidden');
  } catch (e: any) { fail('Customer image upload blocked', e.message); }

  // ── Test 4: Pending vendor blocked ────────────────────────────────────────
  console.log('⏳ Test 4: Pending vendor attempting image upload...');
  try {
    const res = await request(app)
      .post(`/api/products/${productId}/images`)
      .set('Cookie', authCookie(pendingToken))
      .attach('images', fakeJpeg(), { filename: 'photo.jpg', contentType: 'image/jpeg' });
    assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
    pass('Pending vendor blocked from image upload with 403 Forbidden');
  } catch (e: any) { fail('Pending vendor blocked', e.message); }

  // ── Test 5: Vendor B blocked from Vendor A's product ──────────────────────
  console.log('⏳ Test 5: Vendor B attempting upload to Vendor A product...');
  try {
    const res = await request(app)
      .post(`/api/products/${productId}/images`)
      .set('Cookie', authCookie(v2Token))
      .attach('images', fakeJpeg(), { filename: 'photo.jpg', contentType: 'image/jpeg' });
    assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
    pass('Cross-vendor product image tampering blocked with 403 Forbidden');
  } catch (e: any) { fail('Cross-vendor upload blocked', e.message); }

  // ── Test 6: Invalid file type rejected ────────────────────────────────────
  console.log('⏳ Test 6: Invalid file type rejected...');
  try {
    const textBuf = Buffer.from('this is not an image at all');
    const res = await request(app)
      .post(`/api/products/${productId}/images`)
      .set('Cookie', authCookie(v1Token))
      .attach('images', textBuf, { filename: 'malware.exe', contentType: 'application/octet-stream' });
    assert.ok(res.status === 400 || res.status === 422, `Expected 400/422, got ${res.status}`);
    pass('Invalid file type (non-image MIME) rejected');
  } catch (e: any) { fail('Invalid file type rejected', e.message); }

  // ── Test 7: Oversized image rejected ──────────────────────────────────────
  console.log('⏳ Test 7: Oversized image (>5 MB) rejected...');
  try {
    const bigBuf = Buffer.alloc(6 * 1024 * 1024); // 6 MB
    bigBuf[0] = 0xff; bigBuf[1] = 0xd8; bigBuf[2] = 0xff;
    const res = await request(app)
      .post(`/api/products/${productId}/images`)
      .set('Cookie', authCookie(v1Token))
      .attach('images', bigBuf, { filename: 'huge.jpg', contentType: 'image/jpeg' });
    assert.ok(res.status === 400 || res.status === 413, `Expected 400 or 413, got ${res.status}`);
    pass('Oversized image (>5 MB) rejected with 400/413');
  } catch (e: any) { fail('Oversized image rejected', e.message); }

  // ── Test 8: Empty file / no files rejected → 400 ─────────────────────────
  console.log('⏳ Test 8: Empty file & missing files rejected...');
  try {
    // 8a. Empty (0-byte) image file
    const resEmpty = await request(app)
      .post(`/api/products/${productId}/images`)
      .set('Cookie', authCookie(v1Token))
      .attach('images', Buffer.alloc(0), { filename: 'empty.jpg', contentType: 'image/jpeg' });
    assert.strictEqual(resEmpty.status, 400, `Expected 400 for empty file, got ${resEmpty.status}`);

    // 8b. Form submitted without any files attached
    const resNoFiles = await request(app)
      .post(`/api/products/${productId}/images`)
      .set('Cookie', authCookie(v1Token))
      .field('dummy', 'no-file');
    assert.strictEqual(resNoFiles.status, 400, `Expected 400 for missing files, got ${resNoFiles.status}`);

    pass('Empty (0-byte) image and missing files rejected with 400 Bad Request');
  } catch (e: any) { fail('Empty file rejected', e.message); }

  // ── Test 9: Image limit enforced ──────────────────────────────────────────
  console.log('⏳ Test 9: Image limit (5 max) enforced...');
  try {
    const fakeImages = Array.from({ length: 5 }, (_, i) => ({
      _id: new mongoose.Types.ObjectId(),
      key: `products/mock/key-${i}.jpg`,
      originalName: `img${i}.jpg`,
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
      uploadedAt: new Date(),
    }));
    await Product.updateOne({ _id: productId }, { $set: { images: fakeImages } });

    const res = await request(app)
      .post(`/api/products/${productId}/images`)
      .set('Cookie', authCookie(v1Token))
      .attach('images', fakeJpeg(), { filename: 'extra.jpg', contentType: 'image/jpeg' });

    assert.strictEqual(res.status, 400, `Expected 400, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.ok(
      res.body?.error?.message?.toLowerCase().includes('maximum'),
      `Expected max limit message, got: ${res.body?.error?.message}`
    );
    pass('Image limit (5 max) enforced with 400 Bad Request');
  } catch (e: any) { fail('Image limit enforced', e.message); }

  // ── Test 10: Image replacement ────────────────────────────────────────────
  console.log('⏳ Test 10: Image replacement...');
  try {
    const initImg = {
      _id: new mongoose.Types.ObjectId(),
      key: 'products/oldvendor/oldprod/old.jpg',
      originalName: 'old.jpg', mimeType: 'image/jpeg', sizeBytes: 500, uploadedAt: new Date(),
    };
    await Product.updateOne({ _id: productId }, { $set: { images: [initImg] } });
    s3DeleteCalled.length = 0;

    const res = await request(app)
      .put(`/api/products/${productId}/images/${initImg._id}`)
      .set('Cookie', authCookie(v1Token))
      .attach('image', fakeJpeg(), { filename: 'new.jpg', contentType: 'image/jpeg' });

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.ok(s3DeleteCalled.includes('products/oldvendor/oldprod/old.jpg'), 'Old S3 key not deleted');
    assert.ok(res.body.data.image?.key, 'New image key missing from response');
    pass('Image replacement: new image uploaded, old S3 object deleted');
  } catch (e: any) { fail('Image replacement', e.message); }

  // ── Test 11: Image deletion ───────────────────────────────────────────────
  console.log('⏳ Test 11: Image deletion...');
  try {
    const target = {
      _id: new mongoose.Types.ObjectId(),
      key: 'products/vendor1/prod/delete-me.jpg',
      originalName: 'deleteme.jpg', mimeType: 'image/jpeg', sizeBytes: 300, uploadedAt: new Date(),
    };
    await Product.updateOne({ _id: productId }, { $push: { images: target } });
    s3DeleteCalled.length = 0;

    const res = await request(app)
      .delete(`/api/products/${productId}/images/${target._id}`)
      .set('Cookie', authCookie(v1Token));

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);

    const updated = await Product.findById(productId);
    assert.ok(!updated!.images.find((i) => i._id.toString() === target._id.toString()), 'Image not removed from MongoDB');
    assert.ok(s3DeleteCalled.includes('products/vendor1/prod/delete-me.jpg'), 'S3 object not deleted');
    pass('Image deletion: MongoDB reference removed, S3 object deleted');
  } catch (e: any) { fail('Image deletion', e.message); }

  // ── Test 12: MongoDB references correct ───────────────────────────────────
  console.log('⏳ Test 12: MongoDB image references correct after upload...');
  try {
    await Product.updateOne({ _id: productId }, { $set: { images: [] } });

    const res = await request(app)
      .post(`/api/products/${productId}/images`)
      .set('Cookie', authCookie(v1Token))
      .attach('images', fakeJpeg(), { filename: 'ref.jpg', contentType: 'image/jpeg' });

    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}`);

    const dbProd = await Product.findById(productId);
    assert.ok(dbProd!.images.length > 0, 'No images in MongoDB');
    const img = dbProd!.images[0];
    assert.ok(img.key?.startsWith('products/'), `Key should start with 'products/', got: ${img.key}`);
    assert.ok(img.originalName, 'originalName missing');
    assert.ok(img.mimeType, 'mimeType missing');
    assert.ok(img.sizeBytes > 0, 'sizeBytes missing');
    assert.ok(img.uploadedAt, 'uploadedAt missing');
    pass('MongoDB image subdocument contains all required metadata fields');
  } catch (e: any) { fail('MongoDB image references', e.message); }

  // ── Test 13: Presigned URL generation ────────────────────────────────────
  console.log('⏳ Test 13: Presigned URL generation...');
  try {
    const res = await request(app).get(`/api/products/${productId}/images`);
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert.ok(Array.isArray(res.body.data.images), 'images not array');

    if (res.body.data.images.length > 0) {
      const img = res.body.data.images[0];
      assert.ok(img.url, 'Presigned URL missing from response');
      assert.ok(img.url.includes('X-Amz-Signature'), 'URL not in expected presigned format');
    }
    pass('GET /images returns presigned URLs for each stored image');
  } catch (e: any) { fail('Presigned URL generation', e.message); }

  // ── Test 14: S3 failure handled safely ────────────────────────────────────
  console.log('⏳ Test 14: AWS S3 upload failure handled...');
  try {
    s3ShouldFail = true;
    await Product.updateOne({ _id: productId }, { $set: { images: [] } });

    const res = await request(app)
      .post(`/api/products/${productId}/images`)
      .set('Cookie', authCookie(v1Token))
      .attach('images', fakeJpeg(), { filename: 'fail.jpg', contentType: 'image/jpeg' });

    s3ShouldFail = false;
    assert.strictEqual(res.status, 500, `Expected 500 on S3 failure, got ${res.status}`);
    pass('S3 upload failure returns 500 and does not corrupt product data');
  } catch (e: any) {
    s3ShouldFail = false;
    fail('S3 failure handled', e.message);
  }

  // ── Test 15: DB failure triggers S3 cleanup ───────────────────────────────
  console.log('⏳ Test 15: DB failure triggers S3 cleanup...');
  try {
    s3ShouldFail = false;
    s3DeleteCalled.length = 0;

    // Monkey-patch Product.prototype.save to throw once
    const origSave = mongoose.Model.prototype.save;
    let patchFired = false;
    mongoose.Model.prototype.save = async function (...args: any[]) {
      if (!patchFired && this.constructor.modelName === 'Product') {
        patchFired = true;
        throw new Error('Simulated MongoDB write failure');
      }
      return origSave.apply(this, args);
    };

    await Product.updateOne({ _id: productId }, { $set: { images: [] } });
    const res = await request(app)
      .post(`/api/products/${productId}/images`)
      .set('Cookie', authCookie(v1Token))
      .attach('images', fakeJpeg(), { filename: 'rollback.jpg', contentType: 'image/jpeg' });

    mongoose.Model.prototype.save = origSave;

    assert.strictEqual(res.status, 500, `Expected 500 on DB failure, got ${res.status}`);
    assert.ok(s3DeleteCalled.length > 0, 'Expected S3 cleanup on DB failure, but deleteImagesFromS3 not called');
    pass('MongoDB write failure triggers S3 object cleanup (rollback)');
  } catch (e: any) { fail('DB failure S3 cleanup', e.message); }

  // ── Test 16: Unauthorized image deletion blocked ──────────────────────────
  console.log('⏳ Test 16: Unauthorized image deletion blocked...');
  try {
    const target = {
      _id: new mongoose.Types.ObjectId(),
      key: 'products/vendor1/prod/not-yours.jpg',
      originalName: 'not-yours.jpg', mimeType: 'image/jpeg', sizeBytes: 300, uploadedAt: new Date(),
    };
    await Product.updateOne({ _id: productId }, { $push: { images: target } });

    const res = await request(app)
      .delete(`/api/products/${productId}/images/${target._id}`)
      .set('Cookie', authCookie(v2Token)); // Vendor 2 trying to delete Vendor 1's image

    assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
    pass('Unauthorized image deletion (wrong vendor) blocked with 403 Forbidden');
  } catch (e: any) { fail('Unauthorized deletion blocked', e.message); }

  // ── Summary ───────────────────────────────────────────────────────────────
  await mongoose.connection.close();
  await mongoServer.stop();

  console.log('\n======================================================');
  if (failed === 0) {
    console.log(`🎉 ALL ${passed} IMAGE UPLOAD TESTS PASSED!`);
  } else {
    console.log(`⚠️  ${passed} passed, ${failed} FAILED.`);
    process.exit(1);
  }
  console.log('======================================================\n');
}

runImageUploadTestSuite().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
