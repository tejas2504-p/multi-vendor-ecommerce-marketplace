# Multi-Vendor E-Commerce Marketplace
## RESTful API Endpoint Planning Specification (Phase 1A)

---

## 1. REST API Architectural Standards & Conventions

### 1.1 Base URL & API Versioning
All marketplace endpoints are versioned and mounted under the `/api/v1` namespace:
```
https://api.nexusmarket.com/api/v1
```

### 1.2 HTTP Method Semantics
- `GET`: Safe, idempotent retrieval of resource representations.
- `POST`: Non-idempotent creation of new subordinate resources.
- `PUT`: Complete replacement of an existing resource.
- `PATCH`: Partial update of specific fields within a resource.
- `DELETE`: Removal or soft-deletion/archival of a resource.

---

### 1.3 Standard Response Envelopes

#### Standard Success Response (`HTTP 200 OK` / `HTTP 201 Created`)
```json
{
  "success": true,
  "message": "Resource retrieved successfully",
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 84,
    "totalPages": 5
  }
}
```

#### Standard Error Response (`HTTP 4xx` / `HTTP 5xx`)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The submitted payload contains validation issues",
    "details": [
      {
        "field": "email",
        "message": "Must be a valid email format"
      }
    ]
  }
}
```

---

## 2. API Endpoint Matrix by Domain

### 2.1 Authentication & Session Management (`/api/v1/auth`)

| Method | Endpoint | Purpose | Access Role | Key Request Params / Body | Success Code |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `POST` | `/auth/register` | Register a new customer or vendor user account | Public | `{ firstName, lastName, email, password, role }` | `201` |
| `POST` | `/auth/login` | Authenticate credentials; issue `httpOnly` JWT tokens | Public | `{ email, password }` | `200` |
| `POST` | `/auth/refresh` | Rotate refresh token and issue a fresh 15-minute access token | Public (Cookie) | None (Reads refresh token from secure cookie) | `200` |
| `POST` | `/auth/logout` | Revoke tokens and invalidate session in Redis | Authenticated | None (Clears auth cookies & adds to Redis blacklist) | `200` |
| `POST` | `/auth/forgot-password` | Generate cryptographically signed password reset token | Public | `{ email }` | `200` |
| `POST` | `/auth/reset-password` | Reset account password using token | Public | `{ token, newPassword }` | `200` |
| `GET` | `/auth/me` | Fetch authenticated session profile and role status | Authenticated | None (Reads JWT cookie) | `200` |

---

### 2.2 Users & Address Book (`/api/v1/users`)

| Method | Endpoint | Purpose | Access Role | Key Request Params / Body | Success Code |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `GET` | `/users/profile` | Retrieve personal profile details | Authenticated | None | `200` |
| `PATCH` | `/users/profile` | Update personal details (name, phone, avatar) | Authenticated | `{ firstName, lastName, phoneNumber, avatarUrl }` | `200` |
| `PATCH` | `/users/change-password` | Update account password | Authenticated | `{ currentPassword, newPassword }` | `200` |
| `GET` | `/users/addresses` | List all saved delivery addresses for the user | Customer | None | `200` |
| `POST` | `/users/addresses` | Add a new shipping/billing address | Customer | `{ fullName, phone, street, city, state, postalCode, country, isDefault }` | `201` |
| `PUT` | `/users/addresses/:id` | Update an existing address | Customer | `{ fullName, street, city, state, postalCode, ... }` | `200` |
| `DELETE` | `/users/addresses/:id` | Delete a saved address | Customer | None | `200` |
| `PATCH` | `/users/addresses/:id/default`| Set an address as the default delivery destination | Customer | None | `200` |

---

### 2.3 Vendor Operations & Store Management (`/api/v1/vendors`)

| Method | Endpoint | Purpose | Access Role | Key Request Params / Body | Success Code |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `POST` | `/vendors/onboarding` | Submit business details and KYC verification documents | Vendor | `{ storeName, slug, companyName, taxId, documentUrl, payoutSettings }` | `201` |
| `GET` | `/vendors/profile/me` | Fetch vendor's own store profile and onboarding status | Vendor | None | `200` |
| `PATCH` | `/vendors/profile/me` | Update store branding (logo, banner, description, bio) | Vendor | `{ storeName, description, logoUrl, bannerUrl }` | `200` |
| `GET` | `/vendors/public/:slug` | Public storefront view with merchant catalog | Public | None | `200` |
| `GET` | `/vendors/products` | Paginated list of vendor's owned products | Vendor | `?page=1&limit=20&status=active` | `200` |
| `POST` | `/vendors/products` | Create a new product with optional variant combinations | Vendor | `{ title, description, categoryId, basePrice, totalStock, variants: [...] }` | `201` |
| `PUT` | `/vendors/products/:id` | Update an existing vendor-owned product | Vendor | Full product payload update | `200` |
| `DELETE` | `/vendors/products/:id` | Soft delete / archive product listing | Vendor | None | `200` |
| `GET` | `/vendors/orders` | List sub-orders assigned exclusively to this vendor | Vendor | `?page=1&limit=20&fulfillmentStatus=pending` | `200` |
| `GET` | `/vendors/orders/:id` | Retrieve specific sub-order details and buyer shipping address | Vendor | None | `200` |
| `PATCH` | `/vendors/orders/:id/status`| Update shipment status and enter courier tracking data | Vendor | `{ fulfillmentStatus: 'shipped', carrier: 'FedEx', trackingCode: '123456' }` | `200` |
| `GET` | `/vendors/payouts` | Retrieve historical payouts and escrow balances | Vendor | `?page=1&limit=20` | `200` |
| `GET` | `/vendors/analytics` | Fetch sales charts, top products, and revenue summaries | Vendor | `?range=30d` | `200` |

---

### 2.4 Categories & Taxonomy (`/api/v1/categories`)

| Method | Endpoint | Purpose | Access Role | Key Request Params / Body | Success Code |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `GET` | `/categories` | Retrieve hierarchical tree of active categories | Public | `?includeAncestors=true` | `200` |
| `GET` | `/categories/:slug` | Retrieve detailed category info by slug | Public | None | `200` |
| `POST` | `/categories` | Create a category node (Root or Sub-category) | Admin | `{ name, slug, description, parentId, commissionRate, imageUrl }` | `201` |
| `PUT` | `/categories/:id` | Update category attributes or change default commission | Admin | `{ name, commissionRate, isActive, ... }` | `200` |
| `DELETE` | `/categories/:id` | Delete category (only if no products are assigned) | Admin | None | `200` |

---

### 2.5 Public Product Catalog (`/api/v1/products`)

| Method | Endpoint | Purpose | Access Role | Key Request Params / Body | Success Code |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `GET` | `/products` | Browse active catalog with pagination and sorting | Public | `?page=1&limit=20&sort=price_asc&category=slug` | `200` |
| `GET` | `/products/:slug` | Retrieve complete product details, variants, and reviews | Public | None | `200` |
| `GET` | `/products/:id/related` | Retrieve recommended or related category products | Public | `?limit=8` | `200` |

---

### 2.6 Elasticsearch Search & Discovery (`/api/v1/search`)

| Method | Endpoint | Purpose | Access Role | Key Request Params / Body | Success Code |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `GET` | `/search` | Full-text query with typo-tolerance & faceted filters | Public | `?q=laptop&category=tech&minPrice=500&maxPrice=1500&rating=4&brand=dell` | `200` |
| `GET` | `/search/autocomplete` | Fast autocomplete suggestions as the user types | Public | `?q=lap` (Returns matching titles & categories) | `200` |
| `GET` | `/search/filters` | Dynamic aggregations (available brands, price ranges) | Public | `?category=electronics` | `200` |

---

### 2.7 Shopping Cart (`/api/v1/cart`)

| Method | Endpoint | Purpose | Access Role | Key Request Params / Body | Success Code |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `GET` | `/cart` | Fetch active cart with verified live prices & stock | Public / Customer | Header `X-Guest-Token` (if guest) | `200` |
| `POST` | `/cart/items` | Add item or variant to shopping cart | Public / Customer | `{ productId, vendorId, variantSku, quantity }` | `200` |
| `PATCH` | `/cart/items/:itemId` | Update quantity of a specific item | Public / Customer | `{ quantity: 3 }` | `200` |
| `DELETE` | `/cart/items/:itemId` | Remove an item from the cart | Public / Customer | None | `200` |
| `DELETE` | `/cart` | Empty all items from the cart | Public / Customer | None | `200` |
| `POST` | `/cart/merge` | Merge guest session cart into user cart after login | Customer | `{ guestToken: 'uuid-v4-string' }` | `200` |

---

### 2.8 Coupons & Promotions (`/api/v1/coupons`)

| Method | Endpoint | Purpose | Access Role | Key Request Params / Body | Success Code |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `POST` | `/coupons/apply` | Validate and preview coupon discount against cart | Customer | `{ code: 'SUMMER20' }` | `200` |
| `DELETE` | `/coupons/remove` | Remove applied coupon from active checkout | Customer | None | `200` |
| `GET` | `/coupons` | List accessible coupons | Admin / Vendor | `?page=1&limit=20` | `200` |
| `POST` | `/coupons` | Create platform-wide or vendor-specific coupon | Admin / Vendor | `{ code, discountType, discountValue, minOrderValue, maxDiscount, startDate, endDate, usageLimit }` | `201` |
| `PATCH` | `/coupons/:id` | Toggle active status or edit coupon details | Admin / Vendor | `{ isActive: false }` | `200` |
| `DELETE` | `/coupons/:id` | Delete promo coupon | Admin / Vendor | None | `200` |

---

### 2.9 Orders & Checkout (`/api/v1/orders`)

| Method | Endpoint | Purpose | Access Role | Key Request Params / Body | Success Code |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `POST` | `/orders/checkout` | Create checkout session, validate inventory, reserve stock, and return gateway PaymentIntent | Customer | `{ shippingAddressId, billingAddressId, couponCode }` | `201` |
| `GET` | `/orders` | Paginated customer order history (Master Orders) | Customer | `?page=1&limit=10` | `200` |
| `GET` | `/orders/:orderNumber` | Detailed view of master order and vendor item groups | Customer | None | `200` |
| `POST` | `/orders/:orderNumber/cancel`| Request cancellation of unfulfilled order items | Customer | `{ reason: 'Found better price', itemIds: ['item1_id'] }` | `200` |

---

### 2.10 Payments & Webhooks (`/api/v1/payments` & `/api/v1/webhooks`)

| Method | Endpoint | Purpose | Access Role | Key Request Params / Body | Success Code |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `POST` | `/payments/intent` | Create or update gateway PaymentIntent for cart | Customer | `{ masterOrderId: '...' }` | `200` |
| `POST` | `/webhooks/stripe` | Process asynchronous Stripe events (`payment_intent.succeeded`, etc.) | Public (Signed) | Raw payload with `stripe-signature` header | `200` |
| `POST` | `/webhooks/razorpay` | Process asynchronous Razorpay events (`payment.captured`, etc.) | Public (Signed) | Raw payload with `x-razorpay-signature` header | `200` |

---

### 2.11 Ratings & Reviews (`/api/v1/reviews`)

| Method | Endpoint | Purpose | Access Role | Key Request Params / Body | Success Code |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `GET` | `/reviews/product/:productId`| List verified reviews with star breakdown | Public | `?page=1&limit=10&rating=5` | `200` |
| `POST` | `/reviews` | Submit product review (requires verified purchase) | Customer | `{ productId, orderItemId, rating: 5, title, comment, images: [...] }` | `201` |
| `PATCH` | `/reviews/:id` | Update customer's own review | Customer | `{ rating: 4, comment: 'Updated text' }` | `200` |
| `POST` | `/reviews/:id/reply` | Vendor reply to customer review | Vendor | `{ text: 'Thank you for your feedback!' }` | `200` |
| `DELETE` | `/reviews/:id` | Moderate / remove abusive review | Admin | None | `200` |

---

### 2.12 Platform Governance & Admin Oversight (`/api/v1/admin`)

| Method | Endpoint | Purpose | Access Role | Key Request Params / Body | Success Code |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `GET` | `/admin/vendors/pending` | List vendor applications awaiting KYC review | Admin | `?page=1&limit=20` | `200` |
| `PATCH` | `/admin/vendors/:id/status`| Approve, reject, or request revisions for a vendor | Admin | `{ status: 'approved' | 'rejected', rejectionReason }` | `200` |
| `PATCH` | `/admin/vendors/:id/suspend`| Suspend a fraudulent or low-rated seller | Admin | `{ suspended: true, reason: 'High return rate' }` | `200` |
| `PUT` | `/admin/commissions` | Configure global default or category-specific rates | Admin | `{ globalRate: 10, categoryRates: [{ categoryId, rate: 8 }] }` | `200` |
| `GET` | `/admin/orders` | Global master order oversight across all sellers | Admin | `?page=1&limit=25&paymentStatus=paid` | `200` |
| `POST` | `/admin/orders/:id/refund` | Force issue administrative partial or full refund | Admin | `{ amount: 45.00, reason: 'Defective item dispute' }` | `200` |
| `GET` | `/admin/analytics/overview`| Marketplace Gross Merchandise Value, platform revenue | Admin | `?range=30d` | `200` |

---

### 2.13 Media & S3 Direct Upload (`/api/v1/media`)

| Method | Endpoint | Purpose | Access Role | Key Request Params / Body | Success Code |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `POST` | `/media/presigned-url` | Generate secure direct AWS S3 `PUT` upload URL | Authenticated | `{ folder: 'products' | 'kyc' | 'reviews', fileType: 'image/jpeg', fileSize: 1048576 }` | `200` |

---

## 3. Detailed Request and Response Schemas (Examples)

### 3.1 Vendor Onboarding Submission
**`POST /api/v1/vendors/onboarding`**
- **Authorization**: `Bearer <token>` (User must have `role: 'vendor'`)
- **Request Body**:
```json
{
  "storeName": "ElectroTech Direct",
  "slug": "electrotech-direct",
  "description": "Authorized dealer of premium consumer electronics and accessories.",
  "companyName": "ElectroTech Solutions Private Limited",
  "taxId": "27AAACE1234F1Z5",
  "documentUrl": "https://marketplace-assets.s3.amazonaws.com/kyc/proof-document-9182.pdf",
  "payoutSettings": {
    "provider": "stripe_connect",
    "accountId": "acct_1OuXyZ4AbcDefGhi"
  }
}
```
- **Success Response (`HTTP 201 Created`)**:
```json
{
  "success": true,
  "message": "Vendor onboarding application submitted successfully. Verification pending.",
  "data": {
    "vendorId": "6631ad02e4b0123456789abc",
    "storeName": "ElectroTech Direct",
    "slug": "electrotech-direct",
    "approvalStatus": "pending",
    "submittedAt": "2026-11-04T00:30:00.000Z"
  }
}
```

---

### 3.2 Multi-Vendor Checkout Creation
**`POST /api/v1/orders/checkout`**
- **Authorization**: `Bearer <token>` (Customer)
- **Request Body**:
```json
{
  "shippingAddressId": "6631be11e4b0123456789def",
  "billingAddressId": "6631be11e4b0123456789def",
  "couponCode": "WELCOME10"
}
```
- **Success Response (`HTTP 201 Created`)**:
```json
{
  "success": true,
  "message": "Order checkout session created. Complete payment to confirm.",
  "data": {
    "orderNumber": "ORD-20261104-9182",
    "pricing": {
      "itemsSubtotal": 150.00,
      "shippingFeeTotal": 15.00,
      "taxTotal": 12.00,
      "discountTotal": 15.00,
      "grandTotal": 162.00
    },
    "vendorSplits": [
      {
        "vendorId": "6631ad02e4b0123456789abc",
        "subOrderNumber": "ORD-20261104-9182-V01",
        "itemsCount": 1,
        "vendorSubtotal": 100.00
      },
      {
        "vendorId": "6631ad02e4b0987654321fed",
        "subOrderNumber": "ORD-20261104-9182-V02",
        "itemsCount": 2,
        "vendorSubtotal": 50.00
      }
    ],
    "payment": {
      "provider": "stripe",
      "clientSecret": "pi_3MtwxAEomhciTrY21m2kZ6_secret_4A1bC2dE",
      "publishableKey": "pk_test_TYoo61EEYqSAsCWgha2JxUb1"
    }
  }
}
```

---

### 3.3 Full-Text Faceted Search
**`GET /api/v1/search?q=wireless+headphones&category=audio&minPrice=50&maxPrice=300&rating=4&sort=rating_desc`**
- **Authorization**: Public
- **Success Response (`HTTP 200 OK`)**:
```json
{
  "success": true,
  "message": "Search results retrieved",
  "data": {
    "results": [
      {
        "id": "6631ff23e4b0456789abcdef",
        "title": "AeroSound Pro Wireless Active Noise Cancelling Headphones",
        "slug": "aerosound-pro-wireless-anc-headphones",
        "brand": "AeroSound",
        "basePrice": 199.99,
        "discountPrice": 149.99,
        "ratingAverage": 4.8,
        "ratingCount": 124,
        "primaryImage": "https://marketplace-assets.s3.amazonaws.com/products/aerosound-1.jpg",
        "vendor": {
          "id": "6631ad02e4b0123456789abc",
          "storeName": "ElectroTech Direct"
        }
      }
    ],
    "facets": {
      "brands": [
        { "name": "AeroSound", "count": 14 },
        { "name": "Sony", "count": 8 },
        { "name": "Bose", "count": 5 }
      ],
      "priceRanges": [
        { "range": "50-100", "count": 6 },
        { "range": "100-200", "count": 18 },
        { "range": "200-300", "count": 3 }
      ]
    }
  },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 27,
    "totalPages": 2
  }
}
```

---

### 3.4 S3 Direct Upload Pre-Signed URL Request
**`POST /api/v1/media/presigned-url`**
- **Authorization**: `Bearer <token>` (Authenticated)
- **Request Body**:
```json
{
  "folder": "products",
  "fileName": "headphone-side-angle.jpg",
  "fileType": "image/jpeg",
  "fileSize": 2048576
}
```
- **Success Response (`HTTP 200 OK`)**:
```json
{
  "success": true,
  "message": "Direct upload URL generated successfully",
  "data": {
    "uploadUrl": "https://marketplace-assets.s3.amazonaws.com/products/6631ad02e4b0_1714567890.jpg?AWSAccessKeyId=AKIAIOSFODNN7EXAMPLE&Signature=vjbyPxybdZaNmGa%2ByT272YEAiv4%3D&Expires=1714568790",
    "publicUrl": "https://cdn.nexusmarket.com/products/6631ad02e4b0_1714567890.jpg",
    "expiresInSeconds": 900
  }
}
```

---

## 4. HTTP Status Code Guidelines

| Status Code | Meaning | Trigger Condition |
| :---: | :--- | :--- |
| `200 OK` | Standard Success | Resource fetched, updated, or action completed successfully. |
| `201 Created` | Creation Success | Resource created (e.g., product, order, user registered). |
| `204 No Content` | Void Success | Deletion action completed without returning a body. |
| `400 Bad Request` | Client Logic Error | Malformed JSON, missing query parameters, or business violation. |
| `401 Unauthorized` | Auth Failure | Missing, invalid, or expired JWT access token. |
| `403 Forbidden` | Authorization Failure | Insufficient permissions (e.g. Customer accessing Admin route). |
| `404 Not Found` | Entity Absence | Requested URL endpoint or database document ID does not exist. |
| `409 Conflict` | State Conflict | Duplicate unique field (e.g. email already exists, SKU duplicate). |
| `422 Unprocessable`| Validation Failure | Payload failed Zod schema checks (bad email format, password too short). |
| `429 Too Many Req` | Rate Limit Exceeded | Exceeded allowed requests in the Redis sliding window. |
| `500 Server Error` | Internal Failure | Unhandled backend exception or database downtime. |

