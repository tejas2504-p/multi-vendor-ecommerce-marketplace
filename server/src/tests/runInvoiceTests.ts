import assert from 'assert';
import fs from 'fs';
import path from 'path';
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
  Invoice,
  IInvoice,
} from '../models';
import { InvoiceService } from '../services/invoice.service';
import { PdfGeneratorService } from '../services/pdfGenerator.service';
import { generateAccessToken, AUTH_COOKIE_NAME } from '../utils/token';

const getCookies = (token: string): string[] => [`${AUTH_COOKIE_NAME}=${token}; Path=/; HttpOnly`];

async function runInvoiceTestSuite() {
  console.log('\n================================================================');
  console.log('🧪 Starting Phase 10A — PDF Invoice Generation Integration Tests');
  console.log('================================================================\n');

  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'super_secret_test_jwt_key_at_least_32_characters_long';
  process.env.JWT_ACCESS_EXPIRY = '15m';

  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
  console.log('📦 Connected to in-memory MongoDB instance for Invoice testing.');

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
    console.log('\n🌱 Provisioning seed users, vendors, products, and multi-vendor orders...');

    // 1. Admin
    const adminUser = await User.create({
      name: 'Platform Admin',
      email: 'admin@nexusmarket.com',
      password: 'Password123!',
      role: 'admin',
    });
    const adminToken = generateAccessToken({
      id: adminUser._id.toString(),
      email: adminUser.email,
      role: adminUser.role,
    });

    // 2. Customer 1 (Alice)
    const customer1 = await User.create({
      name: 'Alice Customer',
      email: 'alice@example.com',
      password: 'Password123!',
      role: 'customer',
    });
    const customer1Token = generateAccessToken({
      id: customer1._id.toString(),
      email: customer1.email,
      role: customer1.role,
    });

    // 3. Customer 2 (Bob - Unrelated)
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

    // 4. Vendor 1 (Apex Electronics)
    const vendor1User = await User.create({
      name: 'Apex Merchant',
      email: 'apex@vendor.com',
      password: 'Password123!',
      role: 'vendor',
    });
    const vendor1Token = generateAccessToken({
      id: vendor1User._id.toString(),
      email: vendor1User.email,
      role: vendor1User.role,
    });
    const vendor1Profile = await VendorProfile.create({
      userId: vendor1User._id,
      storeName: 'Apex Electronics Hub',
      slug: 'apex-electronics-hub',
      description: 'Top notch gadgets',
      businessEmail: 'support@apexelectronics.com',
      businessPhone: '+91 98765 43210',
      businessAddress: {
        street: '42 Silicon Highway',
        city: 'Bangalore',
        state: 'Karnataka',
        postalCode: '560100',
        country: 'India',
      },
      status: 'approved',
    });

    // 5. Vendor 2 (Zen Fashion)
    const vendor2User = await User.create({
      name: 'Zen Merchant',
      email: 'zen@vendor.com',
      password: 'Password123!',
      role: 'vendor',
    });
    const vendor2Token = generateAccessToken({
      id: vendor2User._id.toString(),
      email: vendor2User.email,
      role: vendor2User.role,
    });
    const vendor2Profile = await VendorProfile.create({
      userId: vendor2User._id,
      storeName: 'Zen Apparel Studio',
      slug: 'zen-apparel-studio',
      description: 'Premium organic fashion',
      businessEmail: 'contact@zenapparel.com',
      businessPhone: '+91 98765 12345',
      businessAddress: {
        street: '15 Linen Road',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001',
        country: 'India',
      },
      status: 'approved',
    });

    // 6. Category
    const category = await Category.create({
      name: 'Electronics & Fashion',
      slug: 'electronics-fashion',
      description: 'Test category',
    });

    // 7. Products
    const productA = await Product.create({
      name: 'Noise Cancelling Headphones',
      description: 'High-end wireless audio',
      price: 150,
      stock: 50,
      categoryId: category._id,
      vendorId: vendor1User._id,
      sku: 'SKU-HEADPHONE-01',
      status: 'active',
      isDeleted: false,
    });

    const productB = await Product.create({
      name: 'Classic Cotton Shirt',
      description: '100% organic cotton',
      price: 50,
      stock: 100,
      categoryId: category._id,
      vendorId: vendor2User._id,
      sku: 'SKU-SHIRT-01',
      status: 'active',
      isDeleted: false,
    });

    // 8. Delivery address snapshot
    const deliveryAddress = {
      fullName: 'Alice Customer',
      phone: '+91 99999 88888',
      addressLine1: 'Flat 402, Sunshine Residency',
      addressLine2: 'Outer Ring Road',
      city: 'Bangalore',
      state: 'Karnataka',
      postalCode: '560037',
      country: 'India',
    };

    // 9. Create Parent Multi-Vendor Order (Subtotal: 200, Shipping: 10, Discount: 20, Total: 190)
    const orderItems = [
      {
        productId: productA._id,
        vendorId: vendor1User._id,
        productName: productA.name,
        quantity: 1,
        unitPrice: 150,
        itemSubtotal: 150,
      },
      {
        productId: productB._id,
        vendorId: vendor2User._id,
        productName: productB.name,
        quantity: 1,
        unitPrice: 50,
        itemSubtotal: 50,
      },
    ];

    const parentOrder = await Order.create({
      orderNumber: 'ORD-2026-TEST-PARENT',
      userId: customer1._id,
      customerId: customer1._id,
      deliveryAddress,
      items: orderItems,
      subtotal: 200,
      shippingAmount: 10,
      discountAmount: 20,
      totalAmount: 190,
      couponCode: 'SAVE20',
      couponSnapshot: {
        couponId: new Types.ObjectId(),
        code: 'SAVE20',
        discountType: 'fixed',
        discountValue: 20,
        discountAmount: 20,
      },
      paymentStatus: 'paid',
      orderStatus: 'confirmed',
    });

    // 10. Create Child Vendor Orders
    const vendorOrder1 = await VendorOrder.create({
      parentOrderId: parentOrder._id,
      vendorId: vendor1User._id,
      vendorOrderNumber: 'VO-2026-V1-001',
      items: [orderItems[0]],
      vendorSubtotal: 150,
      shippingShare: 7.5,
      discountShare: 15,
      orderStatus: 'confirmed',
      statusHistory: [{ status: 'confirmed', changedAt: new Date() }],
    });

    const vendorOrder2 = await VendorOrder.create({
      parentOrderId: parentOrder._id,
      vendorId: vendor2User._id,
      vendorOrderNumber: 'VO-2026-V2-002',
      items: [orderItems[1]],
      vendorSubtotal: 50,
      shippingShare: 2.5,
      discountShare: 5,
      orderStatus: 'confirmed',
      statusHistory: [{ status: 'confirmed', changedAt: new Date() }],
    });

    parentOrder.vendorOrders = [vendorOrder1._id, vendorOrder2._id];
    await parentOrder.save();

    console.log('✅ Seed data provisioned successfully.\n');

    // =================================================================
    // 🧪 TEST 1: Invoice Model schema validation
    // =================================================================
    await testCase('1. Invoice Model schema validation and indexes', async () => {
      const indexes = await Invoice.collection.indexes();
      const indexKeys = indexes.map((idx) => Object.keys(idx.key)[0]);

      assert(indexKeys.includes('invoiceNumber'), 'invoiceNumber should be indexed');
      assert(indexKeys.includes('parentOrderId'), 'parentOrderId should be indexed');
      assert(indexKeys.includes('customerId'), 'customerId should be indexed');

      const invoiceInstance = new Invoice({
        invoiceNumber: 'INV-TEST-SCHEMA',
        parentOrderId: parentOrder._id,
        customerId: customer1._id,
        invoiceType: 'customer_parent',
        issuerDetails: {
          name: 'NexusMarket',
          address: 'Bangalore',
        },
        customerDetails: {
          name: 'Alice',
          email: 'alice@example.com',
        },
        billingAddress: deliveryAddress,
        shippingAddress: deliveryAddress,
        items: [
          {
            productId: productA._id,
            productName: 'Sample',
            quantity: 1,
            unitPrice: 100,
            itemSubtotal: 100,
          },
        ],
        subtotal: 100,
        discountAmount: 0,
        shippingAmount: 0,
        taxBreakdown: { totalTax: 0 },
        totalAmount: 100,
        pdfStorageKey: '/dummy/path.pdf',
      });

      const validationError = invoiceInstance.validateSync();
      assert(!validationError, `Schema validation should pass cleanly: ${validationError}`);
    });

    // =================================================================
    // 🧪 TEST 2: Unique invoice number format and monotonicity
    // =================================================================
    await testCase('2. Unique invoice number format and collision avoidance', async () => {
      const generatedNumbers = new Set<string>();
      const currentYear = new Date().getFullYear();

      for (let i = 0; i < 50; i++) {
        const num = InvoiceService.generateInvoiceNumber();
        assert(num.startsWith(`INV-${currentYear}-`), `Invoice number ${num} must start with INV-${currentYear}-`);
        assert(!generatedNumbers.has(num), `Invoice number ${num} must be globally unique`);
        generatedNumbers.add(num);
      }
      assert.strictEqual(generatedNumbers.size, 50, 'All 50 invoice numbers must be unique');
    });

    // =================================================================
    // 🧪 TEST 3: Customer parent invoice generation
    // =================================================================
    let parentInvoice: any;
    await testCase('3. Customer parent invoice generation for an eligible paid order', async () => {
      parentInvoice = await InvoiceService.generateInvoiceForOrder(parentOrder._id, {
        type: 'customer_parent',
      });

      assert(parentInvoice, 'Invoice should be generated');
      assert.strictEqual(parentInvoice.invoiceType, 'customer_parent');
      assert.strictEqual(parentInvoice.parentOrderId.toString(), parentOrder._id.toString());
      assert.strictEqual(parentInvoice.customerId.toString(), customer1._id.toString());
      assert.strictEqual(parentInvoice.issuerDetails.name, 'NexusMarket Platform Ltd');
      assert(parentInvoice.invoiceNumber.startsWith('INV-'), 'Should have valid invoice number');
      assert(fs.existsSync(parentInvoice.pdfStorageKey), 'PDF file must exist on disk at storage path');
    });

    // =================================================================
    // 🧪 TEST 4: Financial reconciliation invariant
    // =================================================================
    await testCase('4. Financial reconciliation invariant', async () => {
      const calculatedExpected =
        parentInvoice.subtotal - parentInvoice.discountAmount + parentInvoice.shippingAmount + parentInvoice.taxBreakdown.totalTax;
      assert.strictEqual(
        parentInvoice.totalAmount,
        calculatedExpected,
        `Invoice totalAmount (${parentInvoice.totalAmount}) must exactly match subtotal - discount + shipping + tax (${calculatedExpected})`
      );
      assert.strictEqual(parentInvoice.totalAmount, parentOrder.totalAmount, 'Invoice total must equal parent order total');
      assert.strictEqual(parentInvoice.subtotal, parentOrder.subtotal, 'Invoice subtotal must equal parent order subtotal');
    });

    // =================================================================
    // 🧪 TEST 5: Product and pricing snapshots
    // =================================================================
    await testCase('5. Line items snapshot accuracy from order and products', async () => {
      assert.strictEqual(parentInvoice.items.length, 2, 'Invoice should contain all 2 line items across vendors');
      const item1 = parentInvoice.items.find((i: any) => i.productName === productA.name);
      assert(item1, 'Product A item should be found in invoice items');
      assert.strictEqual(item1.unitPrice, 150);
      assert.strictEqual(item1.quantity, 1);
      assert.strictEqual(item1.itemSubtotal, 150);

      const item2 = parentInvoice.items.find((i: any) => i.productName === productB.name);
      assert(item2, 'Product B item should be found in invoice items');
      assert.strictEqual(item2.unitPrice, 50);
      assert.strictEqual(item2.quantity, 1);
      assert.strictEqual(item2.itemSubtotal, 50);
    });

    // =================================================================
    // 🧪 TEST 6: Tax breakdown snapshot integrity
    // =================================================================
    await testCase('6. Tax breakdown snapshot verification (no invented GST)', async () => {
      assert(parentInvoice.taxBreakdown, 'Invoice should include taxBreakdown');
      assert.strictEqual(parentInvoice.taxBreakdown.totalTax, 0, 'totalTax should be 0 matching configured order data');
      assert.strictEqual(parentInvoice.taxBreakdown.cgst, 0);
      assert.strictEqual(parentInvoice.taxBreakdown.sgst, 0);
      assert.strictEqual(parentInvoice.taxBreakdown.igst, 0);
    });

    // =================================================================
    // 🧪 TEST 7: Coupon discount allocation snapshot
    // =================================================================
    await testCase('7. Coupon discount allocation snapshot verification', async () => {
      assert.strictEqual(parentInvoice.discountAmount, 20, 'Invoice discountAmount should match order discountAmount');
    });

    // =================================================================
    // 🧪 TEST 8: Vendor sub-order invoice generation
    // =================================================================
    let vendor1Invoice: any;
    await testCase('8. Vendor sub-order invoice generation', async () => {
      vendor1Invoice = await InvoiceService.generateInvoiceForOrder(parentOrder._id, {
        type: 'vendor_order',
        vendorOrderId: vendorOrder1._id,
      });

      assert(vendor1Invoice, 'Vendor invoice should be created');
      assert.strictEqual(vendor1Invoice.invoiceType, 'vendor_order');
      assert.strictEqual(vendor1Invoice.vendorOrderId.toString(), vendorOrder1._id.toString());
      assert.strictEqual(vendor1Invoice.vendorId.toString(), vendor1User._id.toString());
      assert.strictEqual(vendor1Invoice.items.length, 1, 'Vendor invoice should contain ONLY that vendor items');
      assert.strictEqual(vendor1Invoice.items[0].productName, productA.name);
      assert.strictEqual(vendor1Invoice.subtotal, 150);
      assert.strictEqual(vendor1Invoice.shippingAmount, 7.5);
      assert.strictEqual(vendor1Invoice.discountAmount, 15);
      assert.strictEqual(vendor1Invoice.totalAmount, 142.5); // 150 + 7.5 - 15 = 142.5
      assert(fs.existsSync(vendor1Invoice.pdfStorageKey), 'Vendor invoice PDF must exist on disk');
    });

    // =================================================================
    // 🧪 TEST 9: Vendor invoice issuer details snapshot
    // =================================================================
    await testCase('9. Vendor invoice issuer details snapshot contains merchant data', async () => {
      assert.strictEqual(vendor1Invoice.issuerDetails.name, vendor1Profile.storeName);
      assert(vendor1Invoice.issuerDetails.address.includes('42 Silicon Highway'));
      assert.strictEqual(vendor1Invoice.issuerDetails.email, vendor1Profile.businessEmail);
      assert.strictEqual(vendor1Invoice.issuerDetails.phone, vendor1Profile.businessPhone);
    });

    // =================================================================
    // 🧪 TEST 10: Idempotency guarantee
    // =================================================================
    await testCase('10. Idempotency: repeated generation returns identical invoice', async () => {
      const repeatedParentInvoice = await InvoiceService.generateInvoiceForOrder(parentOrder._id, {
        type: 'customer_parent',
      });

      assert.strictEqual(
        repeatedParentInvoice._id.toString(),
        parentInvoice._id.toString(),
        'Must return existing invoice ID'
      );
      assert.strictEqual(
        repeatedParentInvoice.invoiceNumber,
        parentInvoice.invoiceNumber,
        'Invoice number must never change or regenerate'
      );

      const totalCount = await Invoice.countDocuments({
        parentOrderId: parentOrder._id,
        invoiceType: 'customer_parent',
      });
      assert.strictEqual(totalCount, 1, 'There must remain exactly one customer_parent invoice record');
    });

    // =================================================================
    // 🧪 TEST 11: GET /api/invoices role-based list filtering
    // =================================================================
    await testCase('11. GET /api/invoices role-based listing and customer isolation', async () => {
      // Customer 1 request
      const res1 = await request(app)
        .get('/api/invoices')
        .set('Cookie', getCookies(customer1Token))
        .expect(200);

      assert(res1.body.success, 'Response should succeed');
      assert(res1.body.data.invoices.length >= 1, 'Customer 1 should see their invoice');
      assert.strictEqual(res1.body.data.invoices[0].customerId, customer1._id.toString());

      // Customer 2 request (Unrelated)
      const res2 = await request(app)
        .get('/api/invoices')
        .set('Cookie', getCookies(customer2Token))
        .expect(200);

      assert(res2.body.success, 'Response should succeed');
      assert.strictEqual(res2.body.data.invoices.length, 0, 'Customer 2 should see 0 invoices');

      // Admin request
      const resAdmin = await request(app)
        .get('/api/invoices')
        .set('Cookie', getCookies(adminToken))
        .expect(200);

      assert(resAdmin.body.success, 'Admin request should succeed');
      assert(resAdmin.body.data.invoices.length >= 2, 'Admin should see both customer and vendor invoices');
    });

    // =================================================================
    // 🧪 TEST 12: GET /api/invoices/:invoiceId ownership validation
    // =================================================================
    await testCase('12. GET /api/invoices/:invoiceId authorization enforcement', async () => {
      // Alice (Owner) -> 200
      const ownerRes = await request(app)
        .get(`/api/invoices/${parentInvoice._id}`)
        .set('Cookie', getCookies(customer1Token))
        .expect(200);

      assert.strictEqual(ownerRes.body.data.invoiceNumber, parentInvoice.invoiceNumber);

      // Bob (Non-owner) -> 403 Forbidden
      const forbiddenRes = await request(app)
        .get(`/api/invoices/${parentInvoice._id}`)
        .set('Cookie', getCookies(customer2Token))
        .expect(403);

      assert(forbiddenRes.body.error, 'Should receive 403 error for unauthorized customer');

      // Admin -> 200
      await request(app)
        .get(`/api/invoices/${parentInvoice._id}`)
        .set('Cookie', getCookies(adminToken))
        .expect(200);
    });

    // =================================================================
    // 🧪 TEST 13: GET /api/invoices/:invoiceId/download PDF streaming
    // =================================================================
    await testCase('13. GET /api/invoices/:invoiceId/download streams PDF file', async () => {
      const res = await request(app)
        .get(`/api/invoices/${parentInvoice._id}/download`)
        .set('Cookie', getCookies(customer1Token))
        .expect(200);

      assert.strictEqual(res.headers['content-type'], 'application/pdf');
      assert(res.headers['content-disposition'].includes('attachment'));
      assert(res.headers['content-disposition'].includes(`Invoice-${parentInvoice.invoiceNumber}.pdf`));
      assert(res.body.length > 500 || Buffer.isBuffer(res.body), 'Downloaded PDF content must have valid byte stream');
    });

    // =================================================================
    // 🧪 TEST 14: GET /api/orders/:orderId/invoice on-demand endpoint
    // =================================================================
    await testCase('14. GET /api/orders/:orderId/invoice retrieves/generates invoice', async () => {
      const res = await request(app)
        .get(`/api/orders/${parentOrder._id}/invoice`)
        .set('Cookie', getCookies(customer1Token))
        .expect(200);

      assert(res.body.success);
      assert.strictEqual(res.body.data.invoiceNumber, parentInvoice.invoiceNumber);
      assert.strictEqual(res.body.data.totalAmount, parentOrder.totalAmount);
    });

    // =================================================================
    // 🧪 TEST 15: PDF physical file regeneration
    // =================================================================
    await testCase('15. Automatic regeneration if physical PDF file is deleted', async () => {
      const pdfPath = parentInvoice.pdfStorageKey;
      assert(fs.existsSync(pdfPath), 'PDF file must exist initially');

      // Simulate accidental file loss or cleanup
      fs.unlinkSync(pdfPath);
      assert(!fs.existsSync(pdfPath), 'PDF file should now be deleted');

      // Request download again
      const res = await request(app)
        .get(`/api/invoices/${parentInvoice._id}/download`)
        .set('Cookie', getCookies(customer1Token))
        .expect(200);

      assert.strictEqual(res.headers['content-type'], 'application/pdf');
      assert(fs.existsSync(pdfPath), 'Physical PDF file should be transparently regenerated on disk');

      const recheckedDoc = await Invoice.findById(parentInvoice._id);
      assert.strictEqual(
        recheckedDoc?.invoiceNumber,
        parentInvoice.invoiceNumber,
        'Invoice number must remain completely unchanged'
      );
    });

  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }

  console.log('\n================================================================');
  console.log(`🏁 Phase 10A Invoice Tests Finished: ${passed} passed, ${failed} failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runInvoiceTestSuite().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
