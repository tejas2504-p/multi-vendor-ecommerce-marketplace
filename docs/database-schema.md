# NexusMarket — Database Schema Specification

**Project**: NexusMarket Multi-Vendor E-Commerce Marketplace  
**Document**: Mongoose Database Schema & Data Dictionary  
**Target Evaluation**: Engineering Internship & Architecture Review  
**Database**: MongoDB 7.0 (Mongoose 8.x ODM)  

---

## 1. Overview & Data Modeling Strategy

NexusMarket uses MongoDB 7.0 as its primary persistence store. The schema design combines normalized relational references (for accounts, categories, and audit logs) with embedded subdocument snapshots (for orders, delivery addresses, and invoices). 

This hybrid pattern satisfies two essential marketplace invariants:
1. **Historical Immutability**: Changes to a merchant's product title, price, or description never retroactively alter historical orders, invoices, or customer receipts.
2. **Multi-Vendor Order Partitioning**: A single checkout generates one master `Order` for the customer and atomically spawns isolated child `VendorOrder` documents for each merchant whose items were purchased.

---

## 2. Collections Summary

The database defines **20 distinct Mongoose collections**:

| # | Collection Name | Mongoose Model | Purpose |
| :-: | :--- | :--- | :--- |
| 1 | `users` | `User` | Customer, Vendor, and Administrator account records |
| 2 | `vendorprofiles` | `VendorProfile` | Merchant KYC verification, store bio, address, and commission rate |
| 3 | `categories` | `Category` | Hierarchical product taxonomy and slug identifiers |
| 4 | `products` | `Product` | Merchant catalog items, pricing, inventory stock, and S3 images |
| 5 | `productsyncoutboxes` | `ProductSyncOutbox` | Outbox table for atomic MongoDB-to-Elasticsearch synchronization |
| 6 | `addresses` | `Address` | Customer shipping and billing address book |
| 7 | `carts` | `Cart` | Customer shopping cart items and quantities |
| 8 | `orders` | `Order` | Master parent order capturing multi-vendor purchases and payment state |
| 9 | `vendororders` | `VendorOrder` | Merchant-specific partitioned order for independent fulfillment |
| 10 | `payments` | `Payment` | Razorpay transactions, HMAC signatures, and UPI dynamic QR sessions |
| 11 | `processedwebhookevents` | `ProcessedWebhookEvent` | Deduplication store preventing duplicate Razorpay webhook execution |
| 12 | `platformsettings` | `PlatformSetting` | Marketplace governance defaults (default commission rate: 10%) |
| 13 | `vendorearnings` | `VendorEarnings` | Merchant balances: total gross, commission paid, available, and pending |
| 14 | `vendorledgers` | `VendorLedger` | Double-entry immutable accounting ledger of merchant debits/credits |
| 15 | `vendorpayouts` | `VendorPayout` | Merchant payout withdrawal requests and bank settlement statuses |
| 16 | `reviews` | `Review` | Customer product reviews (1–5 stars) with verified purchase badge |
| 17 | `reviewvotes` | `ReviewVote` | Helpful / unhelpful voting audit log per customer review |
| 18 | `coupons` | `Coupon` | Platform promotional coupon codes (percentage and fixed discounts) |
| 19 | `couponusages` | `CouponUsage` | Audit collection tracking per-user coupon redemption history |
| 20 | `invoices` | `Invoice` | Legally compliant parent order and vendor tax invoices with S3 keys |

---

## 3. Detailed Data Dictionary

### 3.1 `users` Collection (`User` Model)
Primary identity store supporting role-based access control.

| Field | Type | Required | Constraints / Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `_id` | `ObjectId` | Auto | Primary Key | Unique user identifier |
| `name` | `String` | Yes | min: 2, max: 60, trim | User full name |
| `email` | `String` | Yes | unique, lowercase, regex | Registered email address |
| `password` | `String` | Yes | min: 8, `select: false` | Bcrypt password hash (cost factor 12) |
| `role` | `String` | Yes | enum: `['customer', 'vendor', 'admin']`, default: `'customer'` | User authorization role |
| `isActive` | `Boolean` | Yes | default: `true` | Account active state |
| `createdAt` | `Date` | Auto | timestamps: true | Account creation timestamp |
| `updatedAt` | `Date` | Auto | timestamps: true | Last profile update timestamp |

- **Indexes**: `{ email: 1 }` (unique).

---

### 3.2 `vendorprofiles` Collection (`VendorProfile` Model)
Merchant KYC application and storefront profile.

| Field | Type | Required | Constraints / Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `_id` | `ObjectId` | Auto | Primary Key | Unique vendor profile ID |
| `userId` | `ObjectId` | Yes | ref: `User`, unique, index | Associated vendor account |
| `storeName` | `String` | Yes | min: 2, max: 80, trim | Public merchant store name |
| `slug` | `String` | Yes | unique, lowercase, trim | Auto-generated URL slug |
| `description` | `String` | No | max: 500, trim | Merchant store description |
| `businessEmail` | `String` | Yes | lowercase, trim | Official merchant email |
| `businessPhone` | `String` | Yes | trim | Merchant contact phone number |
| `businessAddress`| `Object` | Yes | Subdocument (street, city, state, postalCode, country) | Registered merchant address |
| `status` | `String` | Yes | enum: `['pending', 'approved', 'rejected']`, default: `'pending'` | KYC approval status |
| `commissionRate`| `Number` | No | min: 0, max: 100 | Custom commission rate override (e.g. 8%) |
| `rejectionReason`| `String`| No | trim | Reason logged if application is rejected |
| `reviewedBy` | `ObjectId` | No | ref: `User` | Administrator who reviewed application |
| `reviewedAt` | `Date` | No | - | Application review timestamp |

- **Indexes**: `{ userId: 1 }` (unique), `{ slug: 1 }` (unique), `{ status: 1, createdAt: -1 }`.

---

### 3.3 `categories` Collection (`Category` Model)
Hierarchical product categories.

| Field | Type | Required | Constraints / Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `_id` | `ObjectId` | Auto | Primary Key | Category identifier |
| `name` | `String` | Yes | min: 2, max: 60, trim, unique | Category display name |
| `slug` | `String` | Yes | unique, lowercase, trim | URL identifier slug |
| `description` | `String` | No | max: 300, trim | Category description |
| `parentId` | `ObjectId` | No | ref: `Category`, index | Parent category for hierarchy |
| `isActive` | `Boolean` | Yes | default: `true`, index | Category visibility status |

- **Indexes**: `{ slug: 1 }` (unique), `{ name: 1 }` (unique), `{ parentId: 1 }`.

---

### 3.4 `products` Collection (`Product` Model)
Merchant catalog products.

| Field | Type | Required | Constraints / Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `_id` | `ObjectId` | Auto | Primary Key | Product identifier |
| `name` | `String` | Yes | min: 3, max: 150, trim | Product title |
| `description` | `String` | Yes | min: 10, max: 5000, trim | Full product description |
| `price` | `Number` | Yes | min: 0.01 | Product selling price (USD) |
| `categoryId` | `ObjectId` | Yes | ref: `Category`, index | Assigned category |
| `vendorId` | `ObjectId` | Yes | ref: `User`, index | Merchant owner |
| `stock` | `Number` | Yes | min: 0, integer, default: 0 | Available inventory units |
| `images` | `Array` | No | Subdocument array: `[{ key, originalName, mimeType, sizeBytes, uploadedAt }]` | S3 asset metadata |
| `brand` | `String` | No | max: 60, trim | Manufacturer or brand name |
| `sku` | `String` | Yes | uppercase, trim, unique | Stock Keeping Unit |
| `status` | `String` | Yes | enum: `['draft', 'active', 'inactive']`, default: `'draft'` | Public catalog visibility |
| `isDeleted` | `Boolean` | Yes | default: `false`, index | Soft-delete flag |
| `averageRating`| `Number` | Yes | min: 0, max: 5, default: 0 | Aggregate review rating |
| `reviewCount` | `Number` | Yes | min: 0, default: 0 | Total verified reviews count |

- **Indexes**: `{ sku: 1 }` (unique), `{ vendorId: 1, createdAt: -1 }`, `{ categoryId: 1, status: 1 }`, `{ status: 1, isDeleted: 1 }`.

---

### 3.5 `orders` Collection (`Order` Model)
Master parent order representing the customer's consolidated purchase.

| Field | Type | Required | Constraints / Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `_id` | `ObjectId` | Auto | Primary Key | Master order identifier |
| `orderNumber` | `String` | Yes | unique, trim, index | Human-readable ID (e.g. `ORD-MWNIYS84-2GH`) |
| `userId` | `ObjectId` | Yes | ref: `User`, index | Customer who placed order |
| `deliveryAddress`| `Object`| Yes | Subdocument (fullName, phone, addressLine1, addressLine2, city, state, postalCode, country) | Immutable address snapshot |
| `vendorOrders` | `Array` | No | Array of `ObjectId` (ref: `VendorOrder`) | Child split vendor orders |
| `items` | `Array` | Yes | Array of subdocuments: `[{ productId, vendorId, productName, productImage, quantity, unitPrice, itemSubtotal }]` | Consolidated purchased items snapshot |
| `subtotal` | `Number` | Yes | min: 0 | Sum of all item subtotals |
| `shippingAmount`| `Number` | Yes | min: 0, default: 0 | Platform shipping charge |
| `discountAmount`| `Number` | Yes | min: 0, default: 0 | Applied discount from coupon |
| `totalAmount` | `Number` | Yes | min: 0 | Final payable total amount |
| `couponCode` | `String` | No | uppercase, trim | Applied coupon code |
| `couponSnapshot`| `Object` | No | Subdocument (couponId, code, discountType, discountValue, discountAmount) | Immutable coupon audit record |
| `paymentMethod` | `String` | Yes | enum: `['upi', 'upi_qr', 'card', 'netbanking', 'wallet', 'cod', 'razorpay']`, default: `'card'` | Selected payment channel |
| `paymentStatus` | `String` | Yes | enum: `['pending', 'paid', 'failed', 'refunded']`, default: `'pending'` | Payment reconciliation status |
| `orderStatus` | `String` | Yes | enum: `['pending', 'confirmed', 'processing', 'shipped', 'partially_shipped', 'partially_delivered', 'delivered', 'cancelled']`, default: `'confirmed'` | Master order composite status |
| `idempotencyKey`| `String` | No | trim, sparse, index | Idempotent checkout token |

- **Indexes**: `{ orderNumber: 1 }` (unique), `{ userId: 1, createdAt: -1 }`, `{ 'items.vendorId': 1, createdAt: -1 }`, `{ 'items.productId': 1 }`.

---

### 3.6 `vendororders` Collection (`VendorOrder` Model)
Partitioned fulfillment sub-order assigned to an individual merchant.

| Field | Type | Required | Constraints / Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `_id` | `ObjectId` | Auto | Primary Key | Vendor order identifier |
| `parentOrderId` | `ObjectId` | Yes | ref: `Order`, index | Reference to master parent order |
| `vendorId` | `ObjectId` | Yes | ref: `User`, index | Merchant responsible for fulfillment |
| `vendorOrderNumber`| `String`| Yes | unique, trim, index | Sub-order ID (e.g. `ORD-XXXX-V1`) |
| `items` | `Array` | Yes | Array of subdocuments: `[{ productId, productName, productImage, quantity, unitPrice, itemSubtotal }]` | Items belonging strictly to this vendor |
| `vendorSubtotal`| `Number` | Yes | min: 0 | Vendor gross sale subtotal |
| `vendorShipping`| `Number` | Yes | min: 0, default: 0 | Vendor portion of shipping |
| `vendorDiscount`| `Number` | Yes | min: 0, default: 0 | Vendor portion of coupon discount |
| `vendorTotal` | `Number` | Yes | min: 0 | Net order total for this vendor |
| `orderStatus` | `String` | Yes | enum: `['confirmed', 'processing', 'shipped', 'delivered', 'cancelled']`, default: `'confirmed'` | Merchant fulfillment status |
| `shipmentTracking`| `Object`| No | Subdocument: `[{ carrier, trackingNumber, dispatchedAt, estimatedDelivery, trackingUrl }]` | Shipping and carrier updates |
| `statusHistory` | `Array` | Yes | Array: `[{ status, changedAt, changedBy, note }]` | Audit trail of lifecycle transitions |

- **Indexes**: `{ vendorOrderNumber: 1 }` (unique), `{ vendorId: 1, createdAt: -1 }`, `{ parentOrderId: 1, vendorId: 1 }` (compound unique), `{ orderStatus: 1 }`.

---

### 3.7 `payments` Collection (`Payment` Model)
Payment gateway records, Razorpay order bindings, and UPI QR sessions.

| Field | Type | Required | Constraints / Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `_id` | `ObjectId` | Auto | Primary Key | Payment identifier |
| `customerId` | `ObjectId` | Yes | ref: `User`, index | Payer user reference |
| `parentOrderId` | `ObjectId` | Yes | ref: `Order`, index | Associated master order |
| `razorpayOrderId`| `String` | Yes | unique, trim, index | Razorpay gateway order identifier |
| `razorpayPaymentId`| `String`| No | trim, sparse, index | Captured gateway transaction ID |
| `razorpaySignature`| `String`| No | trim | Cryptographic HMAC SHA-256 signature |
| `razorpayQrId` | `String` | No | trim, sparse, index | Razorpay QR Code resource ID |
| `qrImageUrl` | `String` | No | - | Base64 data URI of generated UPI QR |
| `qrString` | `String` | No | - | Raw NPCI UPI URI string |
| `qrExpiresAt` | `Date` | No | - | Expiration timestamp for dynamic QR |
| `amount` | `Number` | Yes | min: 0 | Transaction amount in USD |
| `currency` | `String` | Yes | default: `'USD'` | Transaction currency code |
| `paymentMethod` | `String` | No | trim | Method: `upi`, `upi_qr`, `card`, `netbanking` |
| `status` | `String` | Yes | enum: `['pending', 'authorized', 'captured', 'failed', 'refunded', 'expired']`, default: `'pending'` | Gateway payment lifecycle status |
| `failureReason` | `String` | No | trim | Decline code or error explanation |
| `verifiedAt` | `Date` | No | - | Timestamp when signature was verified |

- **Indexes**: `{ razorpayOrderId: 1 }` (unique), `{ parentOrderId: 1 }`, `{ customerId: 1 }`.

---

### 3.8 `vendorearnings` Collection (`VendorEarnings` Model)
Merchant treasury account ledger and real-time wallet balances.

| Field | Type | Required | Constraints / Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `_id` | `ObjectId` | Auto | Primary Key | Earnings account identifier |
| `vendorId` | `ObjectId` | Yes | ref: `User`, unique, index | Merchant wallet owner |
| `totalGrossSales`| `Number` | Yes | min: 0, default: 0 | Cumulative gross product sales |
| `totalCommission`| `Number` | Yes | min: 0, default: 0 | Cumulative platform commission deducted |
| `availableBalance`| `Number`| Yes | min: 0, default: 0 | Funds available for immediate withdrawal |
| `pendingBalance` | `Number`| Yes | min: 0, default: 0 | Funds locked in active payout requests |
| `paidOutAmount` | `Number`| Yes | min: 0, default: 0 | Cumulative funds settled to bank/UPI |

- **Indexes**: `{ vendorId: 1 }` (unique).

---

### 3.9 `vendorledgers` Collection (`VendorLedger` Model)
Double-entry immutable accounting journal.

| Field | Type | Required | Constraints / Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `_id` | `ObjectId` | Auto | Primary Key | Ledger entry identifier |
| `vendorId` | `ObjectId` | Yes | ref: `User`, index | Affected merchant account |
| `eventType` | `String` | Yes | enum: `['order_credited', 'commission_deducted', 'payout_requested', 'payout_settled', 'payout_rejected', 'refund_debited']` | Transaction category |
| `referenceId` | `String` | Yes | trim, index | Related order or payout reference ID |
| `description` | `String` | Yes | trim | Human-readable explanation of transaction |
| `amount` | `Number` | Yes | - | Signed amount (positive credit, negative debit) |
| `balanceAfter` | `Number` | Yes | min: 0 | Vendor available balance after entry |

- **Indexes**: `{ vendorId: 1, createdAt: -1 }`, `{ referenceId: 1 }`.

---

### 3.10 `vendorpayouts` Collection (`VendorPayout` Model)
Merchant withdrawal requests and administrative settlement desk.

| Field | Type | Required | Constraints / Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `_id` | `ObjectId` | Auto | Primary Key | Payout request identifier |
| `vendorId` | `ObjectId` | Yes | ref: `User`, index | Requesting merchant |
| `payoutNumber` | `String` | Yes | unique, trim, index | Payout tracking ID (e.g. `PO-1795121856339-3679`) |
| `amount` | `Number` | Yes | min: 10 | Withdrawal amount requested |
| `status` | `String` | Yes | enum: `['pending', 'approved', 'processing', 'paid', 'rejected']`, default: `'pending'` | Payout approval and settlement state |
| `payoutMethod` | `String` | Yes | enum: `['bank_transfer', 'upi']`, default: `'bank_transfer'` | Requested payout channel |
| `payoutDetails`| `Object` | Yes | Subdocument (accountNumber, ifscCode, bankName, upiId) | Payout destination credentials |
| `adminNote` | `String` | No | trim | Internal notes logged by admin |
| `processedBy` | `ObjectId` | No | ref: `User` | Administrator who approved/settled |
| `processedAt` | `Date` | No | - | Settlement completion timestamp |

- **Indexes**: `{ payoutNumber: 1 }` (unique), `{ vendorId: 1, createdAt: -1 }`, `{ status: 1 }`.

---

### 3.11 `invoices` Collection (`Invoice` Model)
Legally compliant tax invoices and customer receipts.

| Field | Type | Required | Constraints / Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `_id` | `ObjectId` | Auto | Primary Key | Invoice identifier |
| `invoiceNumber` | `String` | Yes | unique, trim, index | Invoice tracking number (e.g. `INV-2026-MWO17C5S-6SS`) |
| `parentOrderId` | `ObjectId` | Yes | ref: `Order`, index | Associated master order |
| `vendorOrderId` | `ObjectId` | No | ref: `VendorOrder`, index | Associated vendor order (for merchant invoices) |
| `customerId` | `ObjectId` | Yes | ref: `User`, index | Customer recipient |
| `vendorId` | `ObjectId` | No | ref: `User`, index | Issuing merchant (if vendor-specific) |
| `invoiceType` | `String` | Yes | enum: `['customer_parent', 'vendor_order']` | Master receipt vs vendor tax invoice |
| `subtotal` | `Number` | Yes | min: 0 | Invoice subtotal |
| `taxAmount` | `Number` | Yes | min: 0, default: 0 | Calculated GST/VAT tax amount |
| `discountAmount`| `Number`| Yes | min: 0, default: 0 | Applied promotional discount |
| `totalAmount` | `Number` | Yes | min: 0 | Final invoiced total |
| `pdfFileKey` | `String` | No | trim | S3 object key or relative file path |

- **Indexes**: `{ invoiceNumber: 1 }` (unique), `{ parentOrderId: 1 }`, `{ customerId: 1 }`.
