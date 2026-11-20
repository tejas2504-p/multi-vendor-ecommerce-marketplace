# NexusMarket — Comprehensive REST API Reference Documentation

**Project**: NexusMarket Multi-Vendor E-Commerce Marketplace  
**Base URL**: `http://localhost:5000/api` (Production: `https://nexusmarket-api.onrender.com/api`)  
**API Version**: v1 (available at both `/api/*` and `/api/v1/*`)  
**Data Format**: JSON (`application/json`)  
**Authentication Scheme**: Dual-token JWT (HttpOnly Cookie with `Authorization: Bearer <token>` fallback)  

---

## 1. Global API Conventions

### 1.1 Standard Success Envelope
All successful API responses return HTTP 200 or 201 with the following JSON schema:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Operation completed successfully",
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "totalPages": 5
  }
}
```

### 1.2 Standard Error Envelope
Error responses return standard HTTP 4xx or 5xx status codes with sanitized error descriptors:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "path": "email", "message": "Please provide a valid email address" }
    ]
  }
}
```

---

## 2. Authentication & Session APIs (`/api/auth`)

### 2.1 Register New Account
- **Method**: `POST`
- **Path**: `/api/auth/register` (and `/auth/register`, `/api/v1/auth/register`)
- **Purpose**: Creates a new user account (defaults to `customer` role).
- **Auth**: Public (`authLimiter`: 30 req / 15 min)
- **Request Body**:
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "Password123!"
}
```
- **Success (201 Created)**:
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": "6aff5d81fcc0a5c3cdb2be9f",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "role": "customer"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```
- **Errors**: `409 Conflict` (Email already registered), `422 Unprocessable Entity` (Weak password, invalid email, or role self-assignment attempt).

---

### 2.2 Login User
- **Method**: `POST`
- **Path**: `/api/auth/login`
- **Purpose**: Authenticates credentials, issues JWT access token and refresh token in HttpOnly cookies and response payload.
- **Auth**: Public (`authLimiter`: 30 req / 15 min)
- **Request Body**:
```json
{
  "email": "jane@example.com",
  "password": "Password123!"
}
```
- **Success (200 OK)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "6aff5d81fcc0a5c3cdb2be9f",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "role": "customer"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```
- **Errors**: `401 Unauthorized` (Invalid email or password).

---

### 2.3 Rotate & Refresh Access Token
- **Method**: `POST`
- **Path**: `/api/auth/refresh`
- **Purpose**: Rotates expired access tokens using the 7-day refresh token.
- **Auth**: Public (Requires `refresh_token` cookie or `{ "refreshToken": "..." }` body)
- **Success (200 OK)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Token refreshed successfully",
  "data": {
    "user": { "id": "6aff5d81fcc0a5c3cdb2be9f", "email": "jane@example.com", "role": "customer" },
    "token": "eyJhbGciOiJIUzI1Ni...",
    "refreshToken": "eyJhbGciOiJIUzI1Ni..."
  }
}
```
- **Errors**: `401 Unauthorized` (Refresh token expired or invalid).

---

### 2.4 Logout Session
- **Method**: `POST`
- **Path**: `/api/auth/logout`
- **Purpose**: Clears access and refresh token cookies from the browser.
- **Auth**: Public
- **Success (200 OK)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Logged out successfully"
}
```

---

### 2.5 Get Authenticated User Profile
- **Method**: `GET`
- **Path**: `/api/auth/me`
- **Purpose**: Retrieves the profile of the current active session.
- **Auth**: Authenticated (`customer`, `vendor`, `admin`)
- **Success (200 OK)**:
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "user": {
      "id": "6aff5d81fcc0a5c3cdb2be9f",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "role": "customer",
      "isActive": true
    }
  }
}
```
- **Errors**: `401 Unauthorized`.

---

## 3. Customer & Address APIs (`/api/addresses`)

### 3.1 List Customer Addresses
- **Method**: `GET`
- **Path**: `/api/addresses`
- **Purpose**: Returns all shipping addresses registered to the authenticated customer.
- **Auth**: Authenticated (`customer`, `admin`)
- **Success (200 OK)**: Array of address documents with default status.

---

### 3.2 Create Delivery Address
- **Method**: `POST`
- **Path**: `/api/addresses`
- **Purpose**: Adds a new delivery address to the customer's address book.
- **Auth**: Authenticated (`customer`, `admin`)
- **Request Body**:
```json
{
  "fullName": "Jane Doe",
  "phone": "+1-555-0199",
  "addressLine1": "742 Evergreen Terrace",
  "addressLine2": "Apt 4B",
  "city": "Springfield",
  "state": "IL",
  "postalCode": "62704",
  "country": "United States",
  "isDefault": true
}
```
- **Success (201 Created)**: Returns created address document.

---

### 3.3 Set Default Address
- **Method**: `PATCH`
- **Path**: `/api/addresses/:id/default`
- **Purpose**: Marks specified address as default and unsets previous defaults.
- **Auth**: Authenticated (`customer`, `admin`)

---

## 4. Vendor Onboarding & Store APIs (`/api/vendors`, `/api/vendor`)

### 4.1 Apply for Vendor Status
- **Method**: `POST`
- **Path**: `/api/vendors/apply`
- **Purpose**: Submits KYC and business details to open a new store.
- **Auth**: Authenticated (`customer`)
- **Request Body**:
```json
{
  "storeName": "Apex Audio",
  "description": "High-fidelity studio headphones and DACs",
  "businessEmail": "contact@apexaudio.com",
  "businessPhone": "+1-555-8822",
  "businessAddress": {
    "street": "1200 Innovation Way",
    "city": "Austin",
    "state": "TX",
    "postalCode": "78701",
    "country": "United States"
  }
}
```
- **Success (201 Created)**: Returns vendor profile with `status: "pending"`.

---

### 4.2 Check Vendor Application Status
- **Method**: `GET`
- **Path**: `/api/vendors/status`
- **Purpose**: Checks whether the applicant's store is pending, approved, or rejected.
- **Auth**: Authenticated

---

### 4.3 Get Merchant Store Dashboard
- **Method**: `GET`
- **Path**: `/api/vendor/dashboard`
- **Purpose**: Returns sales metrics, fulfillment counters, and inventory health for the vendor.
- **Auth**: Authenticated (`vendor` with approved profile)

---

### 4.4 Get Vendor Earnings & Wallet
- **Method**: `GET`
- **Path**: `/api/vendor/earnings`
- **Purpose**: Retrieves merchant's gross sales, platform fees deducted, available balance, and pending balance.
- **Auth**: Authenticated (`vendor`)
- **Success (200 OK)**:
```json
{
  "success": true,
  "data": {
    "totalGrossSales": 1499.00,
    "totalCommission": 149.90,
    "availableBalance": 1349.10,
    "pendingBalance": 0.00,
    "paidOutAmount": 0.00
  }
}
```

---

### 4.5 Request Payout Withdrawal
- **Method**: `POST`
- **Path**: `/api/vendor/payouts/request`
- **Purpose**: Requests withdrawal of available earnings balance to bank or UPI.
- **Auth**: Authenticated (`vendor`)
- **Request Body**:
```json
{
  "amount": 500.00,
  "payoutMethod": "upi",
  "payoutDetails": {
    "upiId": "vendor@oksbi"
  }
}
```
- **Success (201 Created)**: Returns created payout document with `status: "pending"`.

---

## 5. Catalog, Product & Media APIs (`/api/products`, `/api/categories`)

### 5.1 Public Product Catalog List
- **Method**: `GET`
- **Path**: `/api/products`
- **Purpose**: Lists all active, non-deleted marketplace products with pagination.
- **Auth**: Public
- **Query Params**: `page` (default: 1), `limit` (default: 12), `category`, `sort` (`price_asc`, `price_desc`, `newest`)
- **Success (200 OK)**: Returns list of products with pagination metadata.

---

### 5.2 Get Product Detail by ID
- **Method**: `GET`
- **Path**: `/api/products/:id`
- **Purpose**: Retrieves full product document with image gallery, category, and seller rating.
- **Auth**: Public

---

### 5.3 Create Product
- **Method**: `POST`
- **Path**: `/api/products`
- **Purpose**: Creates a new product under the authenticated vendor's store.
- **Auth**: Authenticated (`vendor` - requires approved status, or `admin`)
- **Request Body**:
```json
{
  "name": "PulseBuds ANC Wireless Earbuds",
  "description": "Active noise cancelling with 40-hour battery life",
  "price": 149.00,
  "stock": 50,
  "sku": "ELEC-EAR-006",
  "brand": "PulseSound",
  "categoryId": "6aff5d81fcc0a5c3cdb2be91",
  "status": "active"
}
```
- **Success (201 Created)**: Product created in MongoDB and automatically queued for Elasticsearch indexing.

---

### 5.4 Update Product Inventory
- **Method**: `PATCH`
- **Path**: `/api/products/:id/inventory`
- **Purpose**: Atomically increases or decreases available product stock.
- **Auth**: Authenticated (Product Owner `vendor`, or `admin`)
- **Request Body**:
```json
{
  "delta": 25
}
```
- **Success (200 OK)**: Returns updated stock count.

---

### 5.5 Upload Product Image (AWS S3)
- **Method**: `POST`
- **Path**: `/api/products/:id/images`
- **Purpose**: Multi-part image upload to AWS S3 private storage.
- **Auth**: Authenticated (Product Owner `vendor`, or `admin`)
- **Content-Type**: `multipart/form-data` (Field: `images`, max 5 files, 5MB limit each)
- **Success (201 Created)**: Returns array of uploaded image keys and presigned access URLs.

---

## 6. Search & Autocomplete APIs (`/api/products/search`)

### 6.1 Multi-Field Faceted Search
- **Method**: `GET`
- **Path**: `/api/products/search`
- **Purpose**: High-speed full-text product search via Elasticsearch with automatic fallback to MongoDB regex.
- **Auth**: Public
- **Query Params**:
  - `q`: Search terms (e.g. `smartwatch`)
  - `category`: Category ID filter
  - `brand`: Brand name filter
  - `minPrice`, `maxPrice`: Numeric price range
  - `sort`: `price_asc`, `price_desc`, `rating`, `newest`
  - `page`: Page index
  - `limit`: Items per page
- **Success (200 OK)**:
```json
{
  "success": true,
  "data": {
    "products": [ ... ],
    "totalResults": 24,
    "currentPage": 1,
    "totalPages": 2,
    "availableFilters": {
      "categories": [{ "id": "...", "name": "Electronics", "count": 14 }],
      "brands": [{ "name": "AudioTechnica", "count": 6 }],
      "priceRange": { "min": 29.99, "max": 799.00 }
    }
  }
}
```

---

### 6.2 Search Autocomplete Suggestions
- **Method**: `GET`
- **Path**: `/api/products/suggestions`
- **Purpose**: Delivers instant typeahead keyword suggestions as the shopper types.
- **Auth**: Public
- **Query Params**: `q` (e.g. `head`)

---

## 7. Shopping Cart APIs (`/api/cart`)

### 7.1 Get Customer Cart
- **Method**: `GET`
- **Path**: `/api/cart`
- **Purpose**: Retrieves items in the customer's cart, enriched with live stock and multi-vendor subtotal breakdown.
- **Auth**: Authenticated (`customer`)

---

### 7.2 Add Item to Cart
- **Method**: `POST`
- **Path**: `/api/cart/add` (also `/api/cart/items`)
- **Purpose**: Adds a product quantity to the user's cart (cached in Redis, persisted to MongoDB).
- **Auth**: Authenticated (`customer`)
- **Request Body**:
```json
{
  "productId": "6aff5d81fcc0a5c3cdb2be99",
  "quantity": 2
}
```

---

### 7.3 Update Cart Item Quantity
- **Method**: `PATCH`
- **Path**: `/api/cart/items/:productId`
- **Purpose**: Updates the quantity of a specific product in the cart.
- **Auth**: Authenticated (`customer`)

---

### 7.4 Clear Cart
- **Method**: `DELETE`
- **Path**: `/api/cart/clear` (also `DELETE /api/cart`)
- **Purpose**: Empties all items from the customer's cart.
- **Auth**: Authenticated (`customer`)

---

## 8. Checkout & Order APIs (`/api/checkout`, `/api/orders`)

### 8.1 Execute Checkout & Multi-Vendor Split
- **Method**: `POST`
- **Path**: `/api/checkout`
- **Purpose**: Atomically validates stock, applies optional coupon, creates 1 Parent Order, and splits items into $k$ distinct `VendorOrder` records.
- **Auth**: Authenticated (`customer`, `admin`) (`checkoutLimiter`: 40 req / 15 min)
- **Request Body**:
```json
{
  "addressId": "6aff5d81fcc0a5c3cdb2be95",
  "couponCode": "WELCOME10",
  "paymentMethod": "upi"
}
```
- **Success (201 Created)**:
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Checkout completed successfully",
  "data": {
    "parentOrder": {
      "id": "6aff5d86fcc0a5c3cdb2bf80",
      "orderNumber": "ORD-MWO0EOZ2-1QZ",
      "subtotal": 500.00,
      "discountAmount": 50.00,
      "totalAmount": 450.00,
      "paymentStatus": "pending",
      "orderStatus": "confirmed"
    },
    "vendorOrders": [
      { "id": "6aff5d86fcc0a5c3cdb2bf87", "vendorOrderNumber": "ORD-MWO0EOZ2-1QZ-V1", "vendorTotal": 180.00 },
      { "id": "6aff5d86fcc0a5c3cdb2bf88", "vendorOrderNumber": "ORD-MWO0EOZ2-1QZ-V2", "vendorTotal": 270.00 }
    ]
  }
}
```

---

### 8.2 Get Customer Past Orders
- **Method**: `GET`
- **Path**: `/api/orders` (also `/api/checkout/orders`)
- **Purpose**: Lists past orders placed by the authenticated customer.
- **Auth**: Authenticated (`customer`, `admin`)

---

### 8.3 Vendor: List Assigned Fulfillment Orders
- **Method**: `GET`
- **Path**: `/api/vendor/orders`
- **Purpose**: Lists only `VendorOrder` sub-orders belonging to the authenticated merchant.
- **Auth**: Authenticated (`vendor`)

---

### 8.4 Vendor: Update Shipment Status & Tracking
- **Method**: `PATCH`
- **Path**: `/api/vendor/orders/:id/status`
- **Purpose**: Advances fulfillment status (`processing` ➔ `shipped` ➔ `delivered`) with carrier tracking details.
- **Auth**: Authenticated (Owner `vendor`, or `admin`)
- **Request Body**:
```json
{
  "orderStatus": "shipped",
  "carrier": "FedEx Express",
  "trackingNumber": "TRK-9948201",
  "trackingUrl": "https://fedex.com/track/TRK-9948201",
  "note": "Package dispatched from Austin warehouse"
}
```

---

## 9. Payments & UPI QR APIs (`/api/payments`)

### 9.1 Create Gateway Payment Order
- **Method**: `POST`
- **Path**: `/api/payments/create-order`
- **Purpose**: Generates a verified Razorpay payment order for a pending customer order.
- **Auth**: Authenticated (`customer`) (`paymentLimiter`: 40 req / 15 min)
- **Request Body**:
```json
{
  "orderId": "6aff5d86fcc0a5c3cdb2bf80",
  "paymentMethod": "card"
}
```
- **Success (201 Created)**: Returns Razorpay Order ID (`order_test_...`), amount in paise, and currency.

---

### 9.2 Verify Razorpay Signature
- **Method**: `POST`
- **Path**: `/api/payments/verify`
- **Purpose**: Cryptographically verifies HMAC-SHA256 signature, captures payment, flags parent order as `paid`, triggers commission splitting, and generates customer invoice.
- **Auth**: Authenticated (`customer`)
- **Request Body**:
```json
{
  "orderId": "6aff5d86fcc0a5c3cdb2bf80",
  "razorpayOrderId": "order_test_1795120518750_smc99",
  "razorpayPaymentId": "pay_test_992144810",
  "razorpaySignature": "3d508e9fa01c34a2e87c0d29...",
  "paymentMethod": "card"
}
```
- **Success (200 OK)**: Confirms payment captured and returns reconciled order.

---

### 9.3 Create Dynamic UPI Payment QR Code
- **Method**: `POST`
- **Path**: `/api/payments/create-qr-code`
- **Purpose**: Generates a dynamic NPCI-compliant UPI QR code tied to the order number.
- **Auth**: Authenticated (`customer`)
- **Request Body**:
```json
{
  "orderId": "6aff5d86fcc0a5c3cdb2bf80"
}
```
- **Success (201 Created)**:
```json
{
  "success": true,
  "data": {
    "qrId": "qr_MWO0E7J8",
    "qrImageUrl": "data:image/png;base64,iVBORw0KGgoAAAANSU...",
    "qrString": "upi://pay?pa=tejasprajapati2504@oksbi&pn=NexusMarket&am=450.00&tr=ORD-MWO0EOZ2-1QZ",
    "expiresAt": "2026-11-20T16:15:00.000Z",
    "status": "waiting"
  }
}
```

---

### 9.4 Poll Dynamic UPI QR Status
- **Method**: `GET`
- **Path**: `/api/payments/qr-status/:orderId`
- **Purpose**: Lightweight polling endpoint queried by client checkout screen until payment is captured or expired.
- **Auth**: Authenticated (`customer`)

---

### 9.5 Razorpay Webhook Ingestion
- **Method**: `POST`
- **Path**: `/api/payments/webhook`
- **Purpose**: Ingests asynchronous payment events (`payment.captured`, `payment.failed`, `order.paid`, `qr_code.credited`).
- **Auth**: Public (Signature-verified via `X-Razorpay-Signature` against raw body buffer)

---

## 10. Reviews & Ratings APIs (`/api/reviews`, `/api/products/:id/reviews`)

### 10.1 List Product Reviews
- **Method**: `GET`
- **Path**: `/api/products/:id/reviews`
- **Purpose**: Returns approved customer reviews, rating distribution, and average star score.
- **Auth**: Public

---

### 10.2 Submit Verified Product Review
- **Method**: `POST`
- **Path**: `/api/products/:id/reviews`
- **Purpose**: Submits a review. Automatically checks whether the user owns a delivered order to award the `Verified Buyer` badge.
- **Auth**: Authenticated (`customer`)
- **Request Body**:
```json
{
  "rating": 5,
  "title": "Exceptional Studio Sound",
  "comment": "The DAC clarity exceeded all my studio recording expectations."
}
```

---

### 10.3 Vote Review as Helpful / Unhelpful
- **Method**: `POST`
- **Path**: `/api/reviews/:id/vote`
- **Purpose**: Casts an upvote or downvote on a review.
- **Auth**: Authenticated (`customer`)

---

## 11. Promotional Coupons APIs (`/api/coupons`)

### 11.1 Validate Coupon Code
- **Method**: `POST`
- **Path**: `/api/coupons/validate`
- **Purpose**: Validates a coupon code against current cart items, checks user usage limit, and computes discount.
- **Auth**: Authenticated (`customer`)
- **Request Body**:
```json
{
  "code": "WELCOME10",
  "orderAmount": 500.00
}
```
- **Success (200 OK)**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "code": "WELCOME10",
    "discountType": "percentage",
    "discountValue": 10,
    "discountAmount": 50.00
  }
}
```

---

## 12. Invoices & Order Documents (`/api/invoices`)

### 12.1 Download PDF Invoice
- **Method**: `GET`
- **Path**: `/api/invoices/:invoiceId/download`
- **Purpose**: Streams a legally formatted PDF invoice with company details, order breakdown, and tax compliance data.
- **Auth**: Authenticated (Order Owner `customer`, Merchant `vendor`, or `admin`)
- **Response**: `Content-Type: application/pdf` with `Content-Disposition: attachment`.

---

## 13. Platform Governance & Admin APIs (`/api/admin`)

All administrative routes require authentication with `role: "admin"`.

### 13.1 Vendor Application Review Desk
- **`GET /api/admin/vendors`**: Lists vendor applications filtered by `?status=pending|approved|rejected`.
- **`PATCH /api/admin/vendors/:id/approve`**: Approves merchant store, assigns commission rate (e.g. 10%), and promotes user role to `vendor`.
- **`PATCH /api/admin/vendors/:id/reject`**: Rejects application with audit note.

### 13.2 Treasury & Payout Management
- **`GET /api/admin/payouts`**: Lists all merchant withdrawal requests.
- **`PATCH /api/admin/payouts/:id/approve`**: Approves withdrawal and locks funds.
- **`PATCH /api/admin/payouts/:id/status`**: Settles payout with bank transaction reference and marks `paid`.

### 13.3 Real-Time Business Intelligence & Analytics
- **`GET /api/admin/analytics/overview`**: Returns total registered shoppers, active merchants, gross merchandise value (GMV), net revenue, and platform commissions.
- **`GET /api/admin/analytics/revenue?period=30d`**: Aggregates daily sales and commission earnings.
- **`GET /api/admin/analytics/vendors?period=30d`**: Ranks top-performing marketplace merchants by sales volume.

---

## 14. System Health Probes (`/api/health`)

- **`GET /api/health`**: Public probe returning system status, environment mode, and uptime.
- **`GET /api/health/redis`**: Validates Redis cluster connectivity and round-trip latency.
- **`GET /api/health/elasticsearch`**: Validates Elasticsearch cluster state, active index, and document count.
