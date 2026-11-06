# Multi-Vendor E-Commerce Marketplace

An enterprise-grade, Amazon-style multi-vendor e-commerce platform built with **React**, **TypeScript**, **Node.js**, **Express**, and **MongoDB**. The platform enables multiple third-party vendors to showcase and fulfill products, while customers purchase goods from multiple vendors in a single unified checkout, and the platform retains automated transaction commissions.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite | Modern single-page application with modular role portals |
| **Styling** | Tailwind CSS, Lucide React | Utility-first responsive design tokens and iconography |
| **Backend** | Node.js, Express.js, TypeScript | Layered RESTful API, validation, and error pipeline |
| **Database** | MongoDB 7.0 + Mongoose 8.x | Primary document store for catalogs, orders, and users |
| **Search Engine** | Elasticsearch 8.x (`@elastic/elasticsearch`) | Dedicated product search engine, edge n-gram analyzers & outbox sync |
| **Media Storage**| AWS S3 (`@aws-sdk/client-s3`) + Multer | Private bucket asset management, pre-signed URLs, atomic rollback |
| **Caching (Future Phase)** | Redis 7.2 | Distributed stock locks, session blacklist, rate limiting |
| **Payments (Future Phase)** | Stripe Connect / Razorpay Route | Multi-party split payments and escrow payout engine |

---

## 📁 Monorepo Project Structure

```
multi-vendor-marketplace/
├── docs/                          # Architectural specifications & API contracts
│   ├── architecture.md            # Complete system design & database schemas
│   └── api-planning.md            # REST API endpoint planning document
├── client/                        # Frontend application (React + Vite + Tailwind)
│   ├── src/
│   │   ├── components/            # Reusable UI primitives (Button, Card, Badge)
│   │   ├── context/               # Global state contexts (AppContext)
│   │   ├── hooks/                 # Custom React hooks (useHealth)
│   │   ├── layouts/               # Layout shells (MainLayout)
│   │   ├── pages/                 # Page views (LandingPage)
│   │   ├── services/              # API clients & Axios interceptors
│   │   ├── types/                 # Shared TypeScript models
│   │   ├── App.tsx                # Root component wrapper
│   │   └── main.tsx               # Application entry point
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── server/                        # Backend REST API (Node.js + Express + TS)
│   ├── src/
│   │   ├── config/                # Environment, database & client configurations
│   │   ├── controllers/           # HTTP Request & Response handlers (Auth, Health)
│   │   ├── middleware/            # Centralized error, not-found, auth & rate limiter
│   │   ├── models/                # Mongoose schema definitions (User, etc.)
│   │   ├── routes/                # Versioned Express routers (/api/auth, /api/health)
│   │   ├── services/              # Domain business logic & data operations
│   │   ├── utils/                 # Structured Winston logger, token utils, ApiResponse
│   │   ├── validators/            # Zod runtime request validation schemas
│   │   ├── tests/                 # Integration test suite (MongoDB in-memory + Supertest)
│   │   ├── app.ts                 # Express application middleware pipeline
│   │   └── server.ts              # Server lifecycle & graceful shutdown
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── docker-compose.yml             # Local MongoDB, Redis & Elasticsearch services
├── package.json                   # Root monorepo workspace configuration
├── tsconfig.base.json             # Shared TypeScript configuration
├── .editorconfig
├── .gitignore
└── .env.example                   # Root environment template
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v20.x or v22.x LTS
- **npm**: v10.x or higher
- **MongoDB**: Local server, Docker container, or MongoDB Atlas

### 2. Installation
Clone the repository and install all monorepo dependencies:
```bash
git clone <repository-url>
cd multi-vendor-marketplace
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env` in both the root and server directory:
```bash
cp .env.example .env
cp server/.env.example server/.env
```

#### Required Environment Variables
| Variable | Description | Default |
| :--- | :--- | :--- |
| `NODE_ENV` | Application environment mode (`development`, `production`, `test`) | `development` |
| `PORT` | Backend server port | `5000` |
| `CLIENT_URL` | Frontend origin for CORS and cookie delivery | `http://localhost:5173` |
| `MONGO_URI` | MongoDB connection connection string | `mongodb://localhost:27017/marketplace` |
| `JWT_ACCESS_SECRET`| Cryptographic secret for signing JWT access tokens (min 16 chars) | Required |
| `JWT_ACCESS_EXPIRY`| Expiration window for JWT access tokens | `15m` |
| `JWT_REFRESH_SECRET`| Cryptographic secret for signing JWT refresh tokens (min 16 chars)| Required |
| `JWT_REFRESH_EXPIRY`| Expiration window for JWT refresh tokens | `7d` |

### 4. Running the Development Servers

```bash
# Run both Frontend & Backend concurrently:
npm run dev

# Or run individually:
npm run dev:server   # Starts Express API at http://localhost:5000
npm run dev:client   # Starts Vite SPA at http://localhost:5173
```

---

## 🔐 Phase 2A: Authentication API Endpoints

All authentication routes are mounted under both `/api/auth` and `/api/v1/auth`.

| Method | Endpoint | Access | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/auth/register` | Public | Register customer or vendor account. Sets HTTP-only JWT cookie. |
| `POST` | `/api/auth/login` | Public | Authenticates credentials and sets HTTP-only JWT cookie. |
| `POST` | `/api/auth/logout` | Authenticated | Clears the `access_token` HTTP-only cookie. |
| `GET` | `/api/auth/me` | Authenticated | Retrieves the safe profile of the currently logged-in user. |
| `GET` | `/api/health` | Public | Server telemetry, uptime, and database connectivity. |

### Security Measures Implemented
- **Password Protection**: Passwords are hashed with **bcrypt** (12 salt rounds) in a Mongoose pre-save hook and excluded from query projections (`select: false`).
- **Token Delivery**: JWT access tokens are delivered strictly in **HTTP-only, SameSite cookies** (inaccessible to browser JavaScript), eliminating XSS token theft.
- **Role Elevation Defense**: Public registration accepts only `customer` (default) or `vendor`. Self-assigning `admin` privileges is blocked and returns `422 Unprocessable Entity`.
- **Brute-Force Rate Limiting**: Auth endpoints (`/register`, `/login`) are guarded by a sliding window rate limiter (max 20 attempts per 15 minutes per IP).
- **Zod Validation**: Every payload undergoes schema validation before reaching controller handlers.

---

## 🛡️ Phase 2B: Role-Based Access Control (RBAC) & Ownership Security

Phase 2B enforces multi-layered authorization across the platform, strictly isolating permissions between `customer`, `vendor`, and `admin` roles, and preventing horizontal privilege escalation between vendors.

### 1. Role System & Business Rules
- **Supported Roles**: `customer`, `vendor`, `admin`.
- **Default Public Registration**: Public registration exclusively creates `customer` accounts. Attempts to pass `role: "vendor"` or `role: "admin"` are intercepted at the Zod schema boundary with `422 Unprocessable Entity`.
- **Vendor Onboarding Security**: Vendor accounts cannot be self-assigned; vendor onboarding and approval workflows are isolated to Phase 3.
- **Admin Provisioning**: Admin accounts cannot be created via public APIs; they are provisioned exclusively through secure internal seeding or CLI operations.

### 2. Authorization Middlewares
- **`authorize(...allowedRoles: UserRole[])`**: Validates authenticated user role against required permission list. Unauthenticated requests are rejected with `401 Unauthorized`; authenticated users with insufficient privileges are rejected with `403 Forbidden`.
- **`authorizeOwnership(resolveOwnerId)`**: Protects vendor resources (catalogs, orders, payouts) from cross-vendor tampering. Verifies that `req.user.id === resourceOwnerId`. Platform admins possess governance override privileges.

### 3. Role Permission Matrix

| Feature / Operation | Customer | Vendor | Admin |
| :--- | :---: | :---: | :---: |
| Browse Catalog & Reviews | ✅ | ✅ | ✅ |
| Customer Dashboard (`GET /api/customer/dashboard`) | ✅ | ❌ | ❌ |
| Manage Cart & Place Orders | ✅ | ❌ | ❌ |
| Vendor Dashboard (`GET /api/vendor/dashboard`) | ❌ | ✅ | ❌ |
| Manage Own Products & Orders (`/api/vendor/resources/:id`)| ❌ | ✅ (Own Only) | ✅ (Override) |
| Super-Admin Dashboard (`GET /api/admin/dashboard`) | ❌ | ❌ | ✅ |
| Vendor KYC Approval & Commission Config | ❌ | ❌ | ✅ |
| Platform-Wide Financial & User Governance | ❌ | ❌ | ✅ |

### 4. Protected Endpoints Implemented

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/customer/dashboard` | `customer` | Customer storefront and account management portal. |
| `GET` | `/api/vendor/dashboard` | `vendor` | Vendor catalog, fulfillment, and payout hub. |
| `GET` | `/api/admin/dashboard` | `admin` | Super-admin KYC, commission, and governance console. |
| `GET` | `/api/vendor/resources/:ownerId` | `vendor`, `admin` | Vendor resource access verified with ownership middleware. |

---

## 🏬 Phase 3A: Vendor Registration & Store Onboarding

Phase 3A implements merchant registration and onboarding applications, enabling customer accounts to apply to become store sellers while keeping privileges safely governed until administrator approval.

### 1. VendorProfile Schema Design
Each merchant store is backed by a `VendorProfile` document linked 1:1 to their primary `User` account:

| Field Name | Type | Rules | Description |
| :--- | :--- | :--- | :--- |
| `userId` | `ObjectId` | Required, Unique, Ref: `User` | Link to primary customer account |
| `storeName` | `String` | Required, Unique, Trim, 2–100 chars | Public display name of store |
| `slug` | `String` | Unique, Lowercase, URL-safe | Auto-generated URL slug |
| `description` | `String` | Optional, Max 1000 chars | Store description / biography |
| `businessEmail` | `String` | Required, Valid Email, Lowercase | Merchant commercial email |
| `businessPhone` | `String` | Required, 5–25 chars | Merchant support / contact phone |
| `businessAddress` | `Object` | Required `{ street, city, state, postalCode, country }` | Verified merchant physical address |
| `status` | `String` | Enum: `['pending', 'approved', 'rejected']`, Default: `'pending'` | KYC review status |
| `rejectionReason`| `String` | Optional | Administrative feedback if rejected |
| `createdAt` / `updatedAt` | `Date` | Timestamps | Audit timestamps |

### 2. Onboarding Workflow & Business Rules
1. **Customer Exclusivity**: Only authenticated users with role `customer` can apply. Admins or already-approved vendors cannot submit duplicate applications (`400 Bad Request`).
2. **Pending by Default**: Newly submitted applications are strictly set to `status: 'pending'`.
3. **No Automatic Escalation**: The applicant's role in the `User` model remains `customer` throughout the pending and review stages.
4. **Defense Against Self-Approval**: Strict Zod validation and controller guards disallow submitting or patching `status`, `rejectionReason`, `userId`, or `role` (`422 Validation Error`).
5. **Store Name Uniqueness**: Duplicate store names (case-insensitive) are prevented (`409 Conflict`).
6. **One Application per Account**: Customers are limited to a single vendor profile application (`409 Conflict`).

### 3. Vendor Application Endpoints

| Method | Endpoint | Access Role | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/vendors/apply` | Authenticated (`customer`) | Submit vendor onboarding application with store & address details. |
| `GET` | `/api/vendors/me` | Authenticated | Retrieve authenticated user's vendor profile. Returns `404` if unapplied. |
| `PATCH` | `/api/vendors/me` | Authenticated | Update permitted store details (`storeName`, `description`, `businessEmail`, `businessPhone`, `businessAddress`). |
| `GET` | `/api/vendors/status` | Authenticated | Retrieve application status (`pending`, `approved`, `rejected`) and rejection reason if applicable. |

---

## 🏛️ Phase 3B: Admin Vendor Approval & Vendor Dashboard

Phase 3B provides full administrative governance over vendor onboarding applications, atomic promotion of customer accounts to vendors, and dedicated dashboards for approved store owners.

### 1. Administrative Approval Workflow & Finite State Machine
- **Application Queue**: Platform administrators inspect pending, approved, and rejected applications with filtering, sorting, and pagination.
- **Approval (`PATCH /api/admin/vendors/:id/approve`)**:
  - Can only transition applications from `pending` to `approved`.
  - Atomically updates `VendorProfile.status = 'approved'` and `User.role = 'vendor'` via MongoDB transactions (with safe two-phase compensation on standalone deployments).
  - Records `reviewedBy` (admin user ID) and `reviewedAt` timestamp.
  - Prevents repeated approval attempts (`409 Conflict`).
- **Rejection (`PATCH /api/admin/vendors/:id/reject`)**:
  - Transitions `pending` applications to `rejected`.
  - Requires a validated `rejectionReason` (5–500 chars).
  - Preserves applicant's user role as `customer`.
  - Prevents illegal state transitions (e.g. rejecting an approved vendor returns `400 Bad Request`).

### 2. Vendor Dashboard & Store Management
- **Guarded Access (`requireApprovedVendor`)**: Verified server-side on every request. Stale JWT tokens cannot bypass database status checks:
  - Role must be `'vendor'`.
  - `VendorProfile.status` must be `'approved'`.
- **Dashboard Telemetry (`GET /api/vendor/dashboard`)**:
  - Returns authenticated store identity and verified contact details.
  - Returns placeholder metrics initialized to zero (`productsCount`, `totalOrders`, `totalSales`, `netEarnings`, etc.) ready for Phase 4 and 5 real-time query aggregation.
- **Store Profile Management (`GET /api/vendor/store`, `PATCH /api/vendor/store`)**:
  - Allows approved merchants to update their public brand description, contact phone, and fulfillment address while strictly preventing modifications to approval status, roles, or commission rates.

### 3. Endpoints Implemented in Phase 3B

| Method | Endpoint | Access Role | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/admin/vendors` | `admin` | List vendor applications with status filtering, pagination, and sorting. |
| `GET` | `/api/admin/vendors/:id` | `admin` | Retrieve detailed vendor application and applicant information. |
| `PATCH` | `/api/admin/vendors/:id/approve` | `admin` | Atomically approve vendor application and activate merchant account. |
| `PATCH` | `/api/admin/vendors/:id/reject` | `admin` | Reject pending application with required feedback reason. |
| `GET` | `/api/vendor/dashboard` | `vendor` (Approved) | Retrieve vendor dashboard with store profile and metric placeholders. |
| `GET` | `/api/vendor/store` | `vendor` (Approved) | Retrieve approved vendor's own store settings. |
| `PATCH` | `/api/vendor/store` | `vendor` (Approved) | Update approved vendor store information. |

---

## 📦 Phase 4A: Product Management (CRUD) & Inventory System

Phase 4A implements the complete product catalog, taxonomy management, vendor product lifecycle, and atomic inventory controls with zero negative-stock race conditions.

### 1. Data Models & Schemas

#### Category Schema (`Category`)
- `name`: Category name (e.g., `"Electronics"`, trimmed, 2–100 chars).
- `slug`: URL-friendly identifier, unique and indexed.
- `description`: Optional category description.
- `parentCategory`: Optional self-referencing `ObjectId` for hierarchical taxonomy.
- `isActive`: Boolean flag (default `true`) allowing admins to disable entire product trees.
- `timestamps`: Automatic `createdAt` and `updatedAt`.

#### Product Schema (`Product`)
- `name`: Required string (2–200 chars).
- `description`: Required rich text description (10–10,000 chars).
- `price`: Positive number strictly `> 0`.
- `categoryId`: Reference to an active `Category` document.
- `vendorId`: Reference to the product's owning `User` (strictly bound from JWT session; client input rejected).
- `stock`: Non-negative integer `≥ 0`.
- `images`: Array of image URL strings (Phase 4B will handle direct AWS S3 uploads).
- `brand`: Optional brand string.
- `sku`: Unique stock keeping unit. Auto-generated if not supplied by vendor (`BRAND-TIMESTAMP-RANDOM`).
- `status`: Enum `['draft', 'active', 'inactive']` (default `'active'`).
- `isDeleted`: Boolean soft-delete flag (default `false`) preserving database integrity for future orders.
- **Indexes**: Compound index on `{ vendorId: 1, status: 1 }`, `{ categoryId: 1, status: 1 }`, text index on `{ name: "text", description: "text", brand: "text" }`, and unique sparse index on `sku`.

### 2. Business Logic & Security Controls
1. **Approved Vendor Guard**: Only accounts with `role: "vendor"` and `VendorProfile.status: "approved"` can create or modify products.
2. **Server-Side Ownership Enforcement**: `vendorId` is extracted directly from the authenticated request (`req.user.id`). Any attempt by the client to specify or change `vendorId` is discarded.
3. **Cross-Vendor Isolation**: Competing vendors attempting to update or delete another merchant's product are blocked with `403 Forbidden`.
4. **Active Category Verification**: Products cannot be created under inactive or non-existent categories (`400 Bad Request`).
5. **Atomic Inventory Protection**: Inventory decrements use conditional atomic updates:
   ```typescript
   Product.findOneAndUpdate(
     { _id: productId, isDeleted: false, stock: { $gte: quantity } },
     { $inc: { stock: -quantity } },
     { new: true }
   );
   ```
   If current stock is lower than the requested decrement, MongoDB matches zero documents, rejecting the request with `400 Bad Request` and mathematically preventing negative stock.
6. **Soft Deletion**: `DELETE /api/products/:id` sets `isDeleted = true` and `status = 'inactive'`, preventing orphaned references in future shopping carts or completed orders.
7. **Draft Visibility Rules**: Draft products are hidden from the public storefront (`GET /api/products`) and competing vendors, but remain accessible to their owning vendor and platform admins.

### 3. API Endpoints Implemented

| Method | Endpoint | Access Role | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/products` | `vendor` (Approved) | Create product with auto-generated SKU & category check. |
| `GET` | `/api/products` | Public | Browse active products (category, price range, search, pagination). |
| `GET` | `/api/products/:id` | Public / Owner | View single product details (drafts shielded from non-owners). |
| `PATCH` | `/api/products/:id` | Owner / Admin | Update product information (cannot reassign ownership). |
| `DELETE`| `/api/products/:id` | Owner / Admin | Soft-delete product (`isDeleted: true`, `status: 'inactive'`). |
| `PATCH` | `/api/products/:id/inventory` | Owner / Admin | Atomically increment, decrement, or set absolute stock. |
| `GET` | `/api/vendor/products` | `vendor` (Approved) | Vendor views their own catalog with all status states & pagination. |
| `PATCH` | `/api/vendor/products/:id/inventory` | `vendor` (Approved) | Vendor updates their product inventory. |
| `GET` | `/api/admin/products` | `admin` | Admin audits all products across all vendors and states. |
| `PATCH` | `/api/admin/products/:id/status` | `admin` | Admin moderation status update (`active`, `inactive`, `draft`). |
| `GET` | `/api/categories` | Public | List all active product categories. |
| `POST` | `/api/categories` | `admin` | Create new product category. |

---

## 🖼️ Phase 4B: AWS S3 Image Upload & Product Media Management

Phase 4B introduces enterprise cloud media storage powered by **AWS S3** and the **AWS SDK for JavaScript v3** (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`). It supports secure multipart uploads, in-memory buffer inspection, magic-byte validation, atomicity rollbacks, and private presigned URL delivery.

### 1. Storage Architecture & Privacy
- **Private S3 Bucket**: The S3 bucket is completely private with no public ACLs or public read/write permissions.
- **Hierarchical Key Organization**: S3 object keys follow a strict vendor and product namespace to prevent collisions and simplify bucket lifecycle policies:
  ```
  products/<vendorId>/<productId>/<uuidv4>.<ext>
  ```
- **Path Traversal Defense**: All URL parameters (`vendorId`, `productId`, filenames) are sanitised before key construction (`buildObjectKey`).
- **No Binary in Database**: MongoDB stores only lightweight subdocument metadata (`key`, `originalName`, `mimeType`, `sizeBytes`, `uploadedAt`). Raw binaries and permanent presigned URLs are never written to MongoDB.

### 2. Image Validation & Security Rules
- **Allowed MIME Types**: `image/jpeg`, `image/png`, `image/webp`.
- **Maximum File Size**: 5 MB per image (enforced at both Multer middleware and service layer).
- **Maximum Images per Product**: 5 images maximum. Attempts to exceed 5 images return `400 Bad Request`.
- **Deep Content Inspection (Magic Bytes)**: Validates actual file bytes (`0xFFD8FF` for JPEG, `0x89504E47` for PNG, `RIFF...WEBP` for WebP), blocking executable payloads disguised with image file extensions.
- **Zero Disk Footprint**: Uses Multer `memoryStorage` so buffers are held in memory during validation and uploaded directly to S3 without writing temporary files to local disks.

### 3. Media API Endpoints Implemented

| Method | Endpoint | Access Role | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/products/:id/images` | `vendor` (Approved Owner) | Upload up to 5 images (field: `images`, `multipart/form-data`). |
| `PUT` | `/api/products/:id/images/:imageId` | Owner / Admin | Replace an existing product image with a new upload (field: `image`). |
| `DELETE`| `/api/products/:id/images/:imageId` | Owner / Admin | Delete product image from both MongoDB and AWS S3 storage. |
| `GET` | `/api/products/:id/images` | Public | Retrieve freshly generated presigned GET URLs (1-hour expiration). |

### 4. Failure Recovery & Atomic Rollback
- **Database Failure Rollback**: If MongoDB fails to persist image references after successful S3 uploads, the system initiates an immediate compensation cleanup (`ImageStorageService.deleteImagesFromS3`), preventing orphaned files in S3.
- **Replacement Atomicity**: During image replacement (`PUT /api/products/:id/images/:imageId`), the new image is uploaded to S3 first. If the MongoDB update succeeds, the old S3 object is deleted; if the database update fails, the new S3 upload is rolled back.

### 5. Frontend Media Uploader Component
- Reusable React component: [`ProductImageUploader.tsx`](client/src/components/ui/ProductImageUploader.tsx).
- Features: Instant browser previews with `URL.createObjectURL`, upload progress tracking, client-side validation, badge deletion controls, and zero AWS credentials in the frontend bundle.

---

## 🔍 Phase 5A: Elasticsearch Setup & Product Indexing

Phase 5A establishes Elasticsearch as a dedicated, high-performance product search engine while maintaining MongoDB as the single authoritative source of truth.

### 1. Architectural Philosophy & Source of Truth
- **MongoDB**: Primary transactional database managing ACIDs, constraints, references, order history, inventory transactions, and vendor relations.
- **Elasticsearch**: Read-optimized search discovery index holding denormalized product documents with text analyzers and filtering facets.
- **Decoupled Resilience**: A failure in Elasticsearch or network partitions will **never** block or fail a MongoDB product CRUD operation. If Elasticsearch is unreachable, operations succeed in MongoDB and queue a retry entry in the Outbox.

### 2. Elasticsearch Index Design (`marketplace_products`)
The `marketplace_products` index uses custom tokenizers and filters optimized for e-commerce search:
- **Analyzers**:
  - `product_search_analyzer`: Standard tokenizer + `lowercase` + `asciifolding` + `product_edge_ngram_filter` (min 2, max 15 chars) + `stop` + `english_stemmer`. Enables instant partial matching as users type.
  - `product_search_query_analyzer`: Standard tokenizer + `lowercase` + `asciifolding` + `stop` + `english_stemmer` (no ngram splitting at query time).
- **Field Mappings**:
  - `productId`: `keyword` (exact MongoDB ObjectId document ID).
  - `name`: `text` (analyzed with `product_search_analyzer`, subfield `keyword` for exact sort/aggregations).
  - `description`: `text` (analyzed with standard full-text analyzer).
  - `brand`: `keyword` (faceted filtering and brand aggregation).
  - `categoryId` & `categoryName`: `keyword` (multi-category filtering).
  - `vendorId`: `keyword` (merchant filtering).
  - `price`: `double` (range queries and sorting).
  - `stock`: `integer` (in-stock availability filters).
  - `status`: `keyword` (lifecycle status).
  - `createdAt` & `updatedAt`: `date` (chronological sorting).

### 3. Outbox Pattern & Zero Data Loss (`ProductSyncOutbox`)
To avoid distributed transaction anomalies, every product lifecycle event uses the transactional Outbox pattern:
1. Product CRUD succeeds in MongoDB.
2. Synchronous indexing is attempted against Elasticsearch via `ProductIndexingService.syncProduct`.
3. If Elasticsearch is unavailable or returns an error:
   - The user operation **succeeds immediately** with HTTP 200/201.
   - An entry is logged in `ProductSyncOutbox` with status `PENDING` and failure reason.
4. Background worker `processSyncOutbox()` reconciles pending outbox records with exponential backoff once the cluster recovers.

### 4. Search Eligibility & Privacy Gate
To prevent leaking unmoderated, discontinued, or draft products:
- Only products with `status === 'active' && !isDeleted` from approved vendors are indexed.
- Transitioning a product to `draft`, `inactive`, or soft-deleting it automatically dispatches `deleteProductFromIndex()`, immediately evicting it from search results.

### 5. Stream-Based Bulk Reindexing (`POST /api/admin/products/reindex`)
- Protected by `authenticate` and `requireRole(['admin'])`.
- Streams millions of MongoDB products using Mongoose cursors with configurable batching (`batchSize: 100`) to avoid memory bloat.
- Supports atomic index recreation (`recreate: true`) with zero downtime using index mapping bootstrap.

---

## 🔎 Phase 5B: Advanced Product Search & Faceted Filtering

Phase 5B delivers production-grade product search, real-time autocomplete suggestions, and faceted filtering powered by Elasticsearch.

### 1. Endpoints
- **Product Search**: `GET /api/products/search`
- **Autocomplete Suggestions**: `GET /api/products/search/suggestions`

### 2. Supported Query Parameters (`GET /api/products/search`)
| Parameter | Type | Constraints / Validation | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `q` | `string` | Max 200 chars, trimmed | — | Keyword query matching name, brand, description |
| `category` | `string` | Valid Category ID or exact name | — | Category filter |
| `brand` | `string` | Max 100 chars | — | Exact brand filter |
| `minPrice` | `number` | $\ge 0$, must be $\le$ maxPrice | — | Minimum price lower bound |
| `maxPrice` | `number` | $\ge 0$, must be $\ge$ minPrice | — | Maximum price upper bound |
| `minRating` | `number` | 0.0 to 5.0 | — | Minimum rating filter |
| `inStock` | `boolean` | `true` or `false` | — | In-stock availability (`stock > 0`) |
| `sort` | `string` | `relevance`, `price_asc`, `price_desc`, `newest`, `rating` | `relevance` | Ordering algorithm |
| `page` | `integer`| $\ge 1$ | `1` | Pagination page number |
| `limit` | `integer`| $\ge 1$ and $\le 100$ | `20` | Results per page |

### 3. Autocomplete Suggestions (`GET /api/products/search/suggestions`)
| Parameter | Type | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `q` | `string` | Required, min 1 char, max 100 chars | — | Prefix text query |
| `limit` | `integer`| Min 1, Max 20 | `8` | Maximum suggestions |

### 4. Elasticsearch Query Architecture & Relevance Scoring
- **Multi-Field Boosting**: `name.keyword^6`, `name^4`, `match_phrase^5`, `brand^2`, `categoryName^1.5`, `description^1`.
- **Typo Tolerance**: `fuzziness: "AUTO"` with `prefix_length: 2` handles user spelling errors without noisy false positives.
- **Strict Privacy Gate**: Query filters enforce `{ term: { status: 'active' } }`. Draft, inactive, and deleted items are completely excluded.
- **Faceted Aggregations**: Real-time category terms, brand terms, and price min/max calculations are computed dynamically.
- **Resilient Fallback**: Cluster connection errors return a clean HTTP 503 (`SERVICE_UNAVAILABLE`) without leaking credentials or internal stack traces.

### 5. Frontend Search Experience
- **Debounced Live Search**: Real-time query execution with 280ms debounce and `AbortController` cancellation for outdated requests.
- **Interactive Suggestions**: Autocomplete dropdown with item previews, prices, and keyboard navigation (`ArrowDown`, `ArrowUp`, `Enter`, `Escape`).
- **Dynamic Facets Sidebar**: Category counts, brand checkboxes, min/max price bounds with validation, rating filter, and in-stock toggle.
- **URL Synchronization**: Deep-linking support via `window.history.replaceState` preserving search state across refreshes.
- **State States**: Loading skeleton placeholders, empty results box with reset button, and error state with retry.

---

## 🛒 Phase 6A: Shopping Cart Backend

Phase 6A implements a production-grade shopping cart backend featuring dynamic price evaluation, customer-isolated carts, live stock validation, and strict role guards.

### 1. Cart API Endpoints

| Method | Endpoint | Access / Role | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/cart/add` | Authenticated Customer / Admin | Add a product to the cart (or increment quantity if already in cart). |
| `GET` | `/api/cart` | Authenticated Customer / Admin | Retrieve the authenticated user's cart with live prices, subtotal, and total. |
| `PATCH` | `/api/cart/update/:productId` | Authenticated Customer / Admin | Update item quantity in cart (rejects $< 1$ or exceeding available stock). |
| `DELETE` | `/api/cart/remove/:productId` | Authenticated Customer / Admin | Remove a specific product line item from the cart. |
| `DELETE` | `/api/cart/clear` | Authenticated Customer / Admin | Remove all items and empty the customer's cart. |

> **RESTful Aliases**: For maximum compatibility, the API also supports `/api/cart/items` (POST), `/api/cart/items/:productId` (PATCH / DELETE), and `DELETE /api/cart`.

### 2. Authentication & Authorization Requirements
- **Authentication**: Requires a valid JWT token passed via HTTP-only cookie (`accessToken`) or `Authorization: Bearer <token>` header.
- **Allowed Roles**: `customer` and `admin`.
- **Blocked Roles**: `vendor` accounts are strictly forbidden from modifying or accessing customer carts (`403 Forbidden`).
- **Cart Isolation**: Customers can never access or mutate another customer's cart; the user identity is extracted strictly from the verified JWT payload (`req.user.id`).

### 3. Core Cart Business Rules
1. **Dynamic Live Pricing (No Stale Prices)**: Product prices are **never** stored permanently in the MongoDB `Cart` model. Unit prices and subtotals are dynamically resolved from the authoritative `Product` collection at calculation time. If a merchant changes their product price, the customer's cart immediately reflects the updated price on the next view or operation.
2. **Availability & Approval Gate**: Only products that are `status: 'active'`, `isDeleted: false`, and belong to an officially approved vendor (`VendorProfile.status === 'approved'`) can be added to a cart.
3. **Stock & Quantity Limits**:
   - Quantities must be positive integers ($\ge 1$).
   - Adding or updating items cannot exceed current available `product.stock`.
   - If requested quantity exceeds stock, the server rejects the request with HTTP 400 Bad Request indicating the remaining stock.
4. **Deactivated / Deleted Product Handling**:
   - If a product is soft-deleted or removed from MongoDB after being placed in a cart, it is automatically purged on retrieval.
   - If a product is deactivated or its vendor application is suspended, the item is flagged with `isAvailable: false` and excluded from `subtotal` and `total` calculations.

### 4. Request & Response Examples

#### Add Product to Cart (`POST /api/cart/add`)
**Request Body**:
```json
{
  "productId": "6aecb063abbabdeb7f90565f",
  "quantity": 2
}
```
**Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Product added to cart successfully",
  "data": {
    "id": "6aecc300ab5678cd90123456",
    "userId": "6aecc15c17648cce570fa051",
    "items": [
      {
        "id": "6aecc300ab5678cd90123457",
        "productId": "6aecb063abbabdeb7f90565f",
        "name": "Mechanical Gaming Keyboard",
        "sku": "KEY-MECH-4921",
        "brand": "KeyTech",
        "images": [],
        "unitPrice": 89.99,
        "quantity": 2,
        "itemTotal": 179.98,
        "stock": 15,
        "isAvailable": true
      }
    ],
    "itemCount": 2,
    "uniqueItemCount": 1,
    "subtotal": 179.98,
    "total": 179.98,
    "createdAt": "2026-11-05T17:45:00.000Z",
    "updatedAt": "2026-11-05T17:45:00.000Z"
  }
}
```

#### Update Item Quantity (`PATCH /api/cart/update/:productId`)
**Request Body**:
```json
{
  "quantity": 4
}
```
**Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Cart updated successfully",
  "data": {
    "id": "6aecc300ab5678cd90123456",
    "userId": "6aecc15c17648cce570fa051",
    "items": [
      {
        "productId": "6aecb063abbabdeb7f90565f",
        "name": "Mechanical Gaming Keyboard",
        "unitPrice": 89.99,
        "quantity": 4,
        "itemTotal": 359.96,
        "stock": 15,
        "isAvailable": true
      }
    ],
    "itemCount": 4,
    "uniqueItemCount": 1,
    "subtotal": 359.96,
    "total": 359.96
  }
}
```

#### View Cart (`GET /api/cart`)
**Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Cart retrieved successfully",
  "data": {
    "id": "6aecc300ab5678cd90123456",
    "userId": "6aecc15c17648cce570fa051",
    "items": [
      {
        "productId": "6aecb063abbabdeb7f90565f",
        "name": "Mechanical Gaming Keyboard",
        "unitPrice": 89.99,
        "quantity": 4,
        "itemTotal": 359.96,
        "stock": 15,
        "isAvailable": true
      }
    ],
    "itemCount": 4,
    "uniqueItemCount": 1,
    "subtotal": 359.96,
    "total": 359.96
  }
}
```

#### Remove Item (`DELETE /api/cart/remove/:productId`)
**Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Product removed from cart successfully",
  "data": {
    "id": "6aecc300ab5678cd90123456",
    "userId": "6aecc15c17648cce570fa051",
    "items": [],
    "itemCount": 0,
    "uniqueItemCount": 0,
    "subtotal": 0,
    "total": 0
  }
}
```

---

## 🧪 Automated Testing

Phases 2A through 6A include comprehensive automated integration test suites executed with `mongodb-memory-server` and `supertest` (**126 total tests, 100% pass rate**):

```bash
# Run all 126 tests across the entire platform:
npm run test

# Or run individual test suites:
npm run test:auth      # Phase 2A: Authentication, Tokens, Cookies (10 tests)
npm run test:rbac      # Phase 2B: RBAC, Route Guards, Ownership (11 tests)
npm run test:vendor    # Phase 3A: Vendor Onboarding, Status, Application Guards (14 tests)
npm run test:approval  # Phase 3B: Admin Approval, Dashboard, State Transitions (15 tests)
npm run test:product   # Phase 4A: Product CRUD, Inventory, SKU, Moderation (15 tests)
npm run test:images    # Phase 4B: S3 Uploads, Previews, Replacements, Deletions (16 tests)
npm run test:elastic   # Phase 5A: Elasticsearch Setup & Product Indexing (12 tests)
npm run test:search    # Phase 5B: Advanced Search, Autocomplete & Faceted Filters (15 tests)
npm run test:cart      # Phase 6A: Shopping Cart Backend & Dynamic Pricing (18 tests)
```

### Verified Phase 6A Shopping Cart Test Suite (18 Tests)
1. **Unauthenticated Cart Access**: Unauthenticated requests to `/api/cart` blocked with HTTP 401 Unauthorized.
2. **Vendor Access Guard**: Vendor role accounts blocked from managing customer carts with HTTP 403 Forbidden.
3. **Empty Cart Initial State**: New customers receive an empty cart structure with 0 items and \$0.00 subtotal.
4. **Add Product to Cart**: Adding an active product returns populated item information and calculated subtotal.
5. **Quantity Increment on Repeat Add**: Adding the same product increases quantity seamlessly without creating duplicate rows.
6. **Populated Cart Details**: `GET /api/cart` populates product title, SKU, images, stock, and live unit price.
7. **Stock Overflow Prevention on Add**: Attempting to add units exceeding available merchant stock rejected with HTTP 400 Bad Request.
8. **Inactive Product Rejection**: Inactive or draft products cannot be added to a cart (HTTP 400 Bad Request).
9. **Update Cart Quantity**: Updating quantity recalculates item total and overall cart subtotal.
10. **Quantity Zero / Negative Validation**: Setting quantity $< 1$ rejected with validation error (HTTP 400/422).
11. **Update Stock Limit Enforcement**: Updating quantity beyond inventory count rejected with HTTP 400 Bad Request.
12. **Multiple Products Handling**: Adding multiple distinct products accurately combines subtotal and total.
13. **Dynamic Current Pricing Proof**: Verifies that updating a product's price in MongoDB immediately recalculates the cart total on retrieval without storing stale price snapshots.
14. **Customer Cart Isolation**: Customer A cannot see or mutate Customer B's cart; each user has a strictly isolated cart.
15. **Remove Line Item**: `DELETE /api/cart/remove/:productId` removes the item and updates totals.
16. **Remove Non-Existent Item**: Removing an item not in cart returns HTTP 404 Not Found.
17. **Clear Entire Cart**: `DELETE /api/cart/clear` empties all items and resets totals to zero.
18. **Malformed Product ID Protection**: Invalid MongoDB ObjectIds in parameters or payload safely rejected with HTTP 400/422.

### Verified Phase 5B Search & Filtering Test Suite (15 Tests)
1. **Keyword Search**: `q=wireless` returns matching products sorted by relevance score.
2. **Multi-Field Matching**: Searches across product name, brand, and description simultaneously.
3. **Category Filtering**: Filters catalog by category ObjectId or exact category name.
4. **Brand Filtering**: `brand=Sony` strictly restricts results to selected merchant brand.
5. **Price Range Filtering**: Bounds catalog products within `minPrice` and `maxPrice`.
6. **Price Inversion Validation**: Inverted price range (`minPrice > maxPrice`) safely rejected with HTTP 422.
7. **Negative & Invalid Param Validation**: Negative numbers and unsupported sort options rejected with HTTP 422.
8. **In-Stock Availability**: `inStock=true` excludes zero-stock items.
9. **Price Sorting**: `sort=price_asc` and `sort=price_desc` verified.
10. **Newest Sorting**: `sort=newest` returns most recently created items first.
11. **Pagination**: Verifies page slicing, limit constraints, and `totalPages` calculation.
12. **Autocomplete Suggestions**: `GET /api/products/search/suggestions?q=wire` returns prefix matches and rejects empty query.
13. **Visibility Gate**: Unpublished, draft, and soft-deleted items strictly excluded from search results.
14. **Faceted Aggregations**: Aggregations return dynamic counts for categories, brands, and price min/max stats.
15. **Elasticsearch Unavailable Resilience**: Cluster connection failures return HTTP 503 Service Unavailable without crashing or leaking sensitive info.

### Verified Phase 5A Elasticsearch Test Suite (12 Tests)
1. **Cluster Verification**: Verifies Elasticsearch client connection via ping (`GET /api/health/elasticsearch`).
2. **Index Initialization**: Verifies creation of `marketplace_products` with custom n-gram analyzers and schema mappings.
3. **Real-time Create Sync**: Creating an active product via `POST /api/products` automatically indexes the document in Elasticsearch.
4. **Real-time Update Sync**: Modifying price or title updates the document in Elasticsearch immediately.
5. **Soft-Delete Sync**: Deleting a product removes the document from Elasticsearch search results while preserving it in MongoDB.
6. **Deactivation Eviction**: Changing status from `active` to `inactive` automatically evicts the product from Elasticsearch.
7. **Bulk Indexing**: Bulk index processing batches multiple documents with memory safety.
8. **Granular Error Handling**: Document-level failures in bulk batches are captured individually without failing the entire batch.
9. **Admin Bulk Reindexing**: `POST /api/admin/products/reindex` reconstructs the entire search catalog from MongoDB with cursor streaming.
10. **Offline ES Resilience (Outbox)**: MongoDB writes succeed even when Elasticsearch is unreachable; failed operations are written to `ProductSyncOutbox` and reconciled on reconnection.
11. **Idempotent Upsert**: Document IDs match MongoDB `_id`, preventing duplicate search results.
12. **Search Eligibility Gate**: Inactive and draft products are strictly excluded from public search indexing.

### Verified Phase 4B Image Upload Test Suite (16 Tests)
1. Approved vendor uploads one image $\rightarrow$ S3 key generated, metadata returned (`201 Created`).
2. Approved vendor uploads multiple images $\rightarrow$ Batch upload saved, all metadata returned (`201 Created`).
3. Customer attempting image upload $\rightarrow$ Blocked with `403 Forbidden`.
4. Pending applicant attempting image upload $\rightarrow$ Blocked with `403 Forbidden`.
5. Vendor B attempting upload to Vendor A's product $\rightarrow$ Tampering blocked with `403 Forbidden`.
6. Invalid file type (executable/text) rejected $\rightarrow$ Blocked with `400 Bad Request`.
7. Oversized image (>5 MB) rejected $\rightarrow$ Blocked with `400 Bad Request`.
8. Empty (0-byte) image and missing files rejected $\rightarrow$ Blocked with `400 Bad Request`.
9. Image limit (5 max) enforced $\rightarrow$ Extra images rejected with `400 Bad Request`.
10. Image replacement works $\rightarrow$ New image uploaded, old S3 object deleted (`200 OK`).
11. Image deletion works $\rightarrow$ MongoDB reference removed, S3 object deleted (`200 OK`).
12. MongoDB image references correct $\rightarrow$ Verified `key`, `mimeType`, `sizeBytes`, `uploadedAt`.
13. Presigned URL generation works $\rightarrow$ Fresh presigned GET URLs generated with signatures (`200 OK`).
14. AWS S3 upload failure handled safely $\rightarrow$ Returns `500 Internal Server Error`, zero DB corruption.
15. DB failure triggers S3 cleanup $\rightarrow$ Newly uploaded S3 objects rolled back immediately.
16. Unauthorized image deletion blocked $\rightarrow$ Cross-vendor deletion blocked with `403 Forbidden`.

### Verified Phase 4A Product & Inventory Test Suite (15 Tests)
1. Approved vendor creates a product $\rightarrow$ Assigned SKU, category validated, HTTP `201 Created`.
2. Customer attempting to create a product $\rightarrow$ Blocked with `403 Forbidden`.
3. Pending applicant attempting to create a product $\rightarrow$ Blocked with `403 Forbidden`.
4. Public visitor browsing active product catalog $\rightarrow$ Successfully returned with pagination (`200 OK`).
5. Vendor retrieving their own product listings $\rightarrow$ Only owned products returned (`200 OK`).
6. Vendor attempting to view another vendor's draft product $\rightarrow$ Shielded with `404 Not Found`.
7. Vendor updating their own product details $\rightarrow$ Successfully updated (`200 OK`).
8. Cross-vendor product update tampering $\rightarrow$ Blocked with `403 Forbidden`.
9. Cross-vendor product deletion tampering $\rightarrow$ Blocked with `403 Forbidden`.
10. Validating rejection of negative/zero price $\rightarrow$ Blocked with `422 Validation Error`.
11. Validating rejection of negative stock count $\rightarrow$ Blocked with `422 Validation Error`.
12. Creating product under inactive/discontinued category $\rightarrow$ Blocked with `400 Bad Request`.
13. Admin moderating and deactivating a product $\rightarrow$ Successfully deactivated and removed from public catalog.
14. Testing pagination limits and price ascending sort $\rightarrow$ Verified (`200 OK`).
15. Testing atomic inventory reduction & negative stock prevention $\rightarrow$ Blocked with `400 Bad Request` when stock is insufficient; successfully reduced when stock is available.

---

## 🗺️ Roadmap & Integration Status

| Service | Target Phase | Status | Integration Strategy |
| :--- | :--- | :--- | :--- |
| **AWS S3** | Phase 4B | ✅ **Completed** | Private bucket storage, image validation, pre-signed GET URLs, atomic DB failure rollback. |
| **Elasticsearch** | Phase 5A | ✅ **Completed** | Dedicated search engine (`marketplace_products`), custom analyzers, outbox sync, cursor reindex. |
| **Search API (ES)** | Phase 5B | ✅ **Completed** | Full-text search endpoint, fuzzy queries, auto-suggestions, faceted price/category filters. |
| **Shopping Cart Backend** | Phase 6A | ✅ **Completed** | Isolated customer carts, live dynamic pricing, stock limit validation, and role protection. |
| **Redis Cache** | Phase 6B | ✅ **Completed** | Redis cluster caching, live price invalidation, graceful fallback to MongoDB, health checks. |
| **Checkout & Addresses** | Phase 7A | ✅ **Completed** | Customer address CRUD, default fallback, atomic stock deduction, snapshot immutability, idempotency. |
| **Stripe / Razorpay** | Phase 8 & 10 | 📅 Planned | Multi-party split checkout, escrow holding, and automated seller payouts via official SDKs. |

---

## 📦 Phase 7A – Checkout and Address Management

### 1. Delivery Address API Endpoints

All address endpoints require authenticated Customer or Admin credentials (`authenticate`, `authorize('customer', 'admin')`).

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/addresses` | Add a new delivery address (auto-default if first address) |
| `GET` | `/api/addresses` | Retrieve customer addresses (default address returned first) |
| `GET` | `/api/addresses/:id` | Retrieve specific address (verifies customer ownership) |
| `PATCH`| `/api/addresses/:id` | Update address fields (verifies customer ownership) |
| `PATCH`| `/api/addresses/:id/default` | Set address as primary default (unsets previous default) |
| `DELETE`| `/api/addresses/:id` | Delete address (safely promotes remaining address to default) |

#### Address Creation Example (`POST /api/addresses`)
```json
// Request Body
{
  "fullName": "Alice Customer",
  "phone": "+1 555-123-4567",
  "addressLine1": "742 Evergreen Terrace",
  "addressLine2": "Apt 2B",
  "city": "Springfield",
  "state": "IL",
  "postalCode": "62704",
  "country": "United States",
  "isDefault": true
}

// Response (201 Created)
{
  "success": true,
  "message": "Delivery address added successfully",
  "data": {
    "id": "6aecd95bce255c4ab079762a",
    "userId": "6aecd95ace255c4ab079761e",
    "fullName": "Alice Customer",
    "phone": "+1 555-123-4567",
    "addressLine1": "742 Evergreen Terrace",
    "addressLine2": "Apt 2B",
    "city": "Springfield",
    "state": "IL",
    "postalCode": "62704",
    "country": "United States",
    "isDefault": true,
    "createdAt": "2026-11-06T00:50:00.000Z",
    "updatedAt": "2026-11-06T00:50:00.000Z"
  }
}
```

### 2. Checkout & Order API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/checkout` | Convert cart into an order, deduct stock atomically, clear cart |
| `GET` | `/api/checkout/orders` | Retrieve authenticated customer's past orders |
| `GET` | `/api/checkout/orders/:id` | Retrieve specific order snapshot details |

#### Checkout Request Example (`POST /api/checkout`)
```json
// Request Body
{
  "addressId": "6aecd95bce255c4ab079762a",
  "idempotencyKey": "chk-9876543210-abcdef"
}

// Response (201 Created)
{
  "success": true,
  "message": "Order placed successfully",
  "data": {
    "id": "6aecd95cce255c4ab0797632",
    "orderNumber": "ORD-MW3XXKSY-7AA",
    "userId": "6aecd95ace255c4ab079761e",
    "deliveryAddress": {
      "fullName": "Alice Customer",
      "phone": "+1 555-123-4567",
      "addressLine1": "742 Evergreen Terrace",
      "addressLine2": "Apt 2B",
      "city": "Springfield",
      "state": "IL",
      "postalCode": "62704",
      "country": "United States"
    },
    "items": [
      {
        "productId": "6aecd95ace255c4ab0797620",
        "vendorId": "6aecd95ace255c4ab0797618",
        "productName": "Sony WH-1000XM5",
        "productImage": "products/vendor1/headphones.jpg",
        "quantity": 2,
        "unitPrice": 399.99,
        "itemSubtotal": 799.98
      }
    ],
    "subtotal": 799.98,
    "shippingAmount": 0,
    "discountAmount": 0,
    "totalAmount": 799.98,
    "paymentStatus": "pending",
    "orderStatus": "confirmed",
    "createdAt": "2026-11-06T00:50:00.000Z",
    "updatedAt": "2026-11-06T00:50:00.000Z"
  }
}
```

### 3. Key Business Rules & Reliability
1. **Never Trust Frontend Values**: Price calculations, vendor IDs, address contents, and totals are computed strictly on the backend from primary MongoDB data.
2. **Snapshot Immutability**: Historical orders freeze both delivery address and product metadata (name, SKU, unit price, image) so future vendor edits never alter completed transactions.
3. **Atomic Stock & Concurrency**: Inventory updates use conditional atomic decrements (`{ stock: { $gte: quantity } }`) with automatic compensation rollback on failures, guaranteeing zero stock leakage and zero negative inventories.
4. **Idempotency Protection**: Repeated submissions with the same `idempotencyKey` return the original order without double-charging or deducting inventory twice.
5. **Safe Default Address Reassignment**: When a customer deletes their default address, the system automatically promotes their most recent remaining address to default.

---

### Verified Phase 7A Checkout & Address Test Suite (16 Tests)
Run using `npm run test:checkout`:
1. Customer creates primary address $\rightarrow$ Successfully created & auto-assigned default (`201 Created`).
2. Create second address & retrieve list $\rightarrow$ Retrieved with default address sorted first (`200 OK`).
3. Customer updates an address $\rightarrow$ Fields successfully updated (`200 OK`).
4. Set a default address $\rightarrow$ Target address marked default; previous default safely unset (`200 OK`).
5. Delete default address $\rightarrow$ Deleted safely; remaining address promoted to default (`200 OK`).
6. Cross-customer address tampering $\rightarrow$ Access and deletion blocked with `403 Forbidden`.
7. Checkout with valid cart $\rightarrow$ Order created with accurate snapshots, orderNumber and free shipping (`201 Created`).
8. Checkout with invalid address ID $\rightarrow$ Blocked with `404 Not Found`.
9. Checkout with insufficient stock $\rightarrow$ Blocked with `400 Bad Request`.
10. Checkout with inactive product $\rightarrow$ Blocked with `400 Bad Request`.
11. Checkout with unapproved vendor $\rightarrow$ Blocked with `400 Bad Request`.
12. Backend price calculations & flat shipping (< $100) $\rightarrow$ Verified accurate totals (`201 Created`).
13. Inventory stock decrement $\rightarrow$ Stock atomically decremented in database (50 $\rightarrow$ 48).
14. Cart clearing after checkout $\rightarrow$ Persistent cart and Redis cache emptied (`itemCount: 0`).
15. Failed checkout leaves zero partial state $\rightarrow$ Inventory and orders completely untouched.
16. Duplicate checkout submissions (idempotency) $\rightarrow$ Returns original order and prevents double inventory decrement.

---

## 📦 Phase 7B – Multi-Vendor Order Management

### 1. Multi-Vendor Order Splitting Architecture
Every checkout creates a **Parent Order** (`Order`) representing the customer transaction, and splits items into $N$ **Child Vendor Orders** (`VendorOrder`), one for each distinct merchant.

- **Parent Order**: Tracks `customerId`, `orderNumber`, `deliveryAddress` snapshot, `vendorOrders` references, `subtotal`, `shippingAmount`, `totalAmount`, `paymentStatus`, and composite `orderStatus`.
- **Vendor Order**: Tracks `parentOrderId`, `vendorId`, `vendorOrderNumber`, items snapshot, `vendorSubtotal`, `shippingShare`, `orderStatus`, `shipmentTracking` (carrier, trackingNumber, dates), and `statusHistory`.

### 2. Status Aggregation Rule
The parent order composite status is dynamically derived from its child vendor orders:
1. **Cancelled**: If every vendor order is cancelled $\rightarrow$ parent order is `cancelled`.
2. **Delivered**: If all non-cancelled vendor orders are delivered $\rightarrow$ `delivered`.
3. **Partially Delivered**: If at least one active vendor order is delivered $\rightarrow$ `partially_delivered`.
4. **Shipped**: If all non-cancelled vendor orders are shipped $\rightarrow$ `shipped`.
5. **Partially Shipped**: If at least one active vendor order is shipped $\rightarrow$ `partially_shipped`.
6. **Processing**: If any active vendor order is processing $\rightarrow$ `processing`.
7. **Confirmed**: Initial state upon successful checkout.

### 3. Multi-Vendor Order API Endpoints
- **Customer**:
  - `GET /api/orders`: List customer parent orders.
  - `GET /api/orders/:orderId`: Retrieve parent order details.
  - `GET /api/orders/:orderId/vendor-orders`: Retrieve breakdown of vendor packages and tracking numbers.
- **Vendor**:
  - `GET /api/vendor/orders`: List orders belonging exclusively to the merchant.
  - `GET /api/vendor/orders/:vendorOrderId`: Retrieve merchant order details.
  - `PATCH /api/vendor/orders/:vendorOrderId/status`: Advance fulfillment lifecycle (`processing` $\rightarrow$ `shipped` $\rightarrow$ `delivered` or `cancelled`). Requires `carrier` and `trackingNumber` when status is marked `shipped`. Restores inventory exactly once upon cancellation.
- **Admin**:
  - `GET /api/admin/orders`: Platform-wide order oversight with customer/status filtering.
  - `GET /api/admin/vendor-orders`: Platform-wide vendor orders listing.
  - `PATCH /api/admin/orders/:orderId/status`: Administrative status override.

---

## 💳 Phase 8A – Razorpay Payment Gateway Integration

### 1. Architecture & Security
- **Official SDK**: Official `razorpay` Node.js client initialized with `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
- **Backend-Authoritative Pricing**: Payable amounts are calculated strictly on the backend using stored order data converted to paise ($1\text{ INR} = 100\text{ paise}$). Frontend amounts are never trusted.
- **Cryptographic Verification**: Signatures are validated using HMAC-SHA256 (`crypto.createHmac('sha256', secret).update(orderId + "|" + paymentId).digest('hex')`) in timing-safe manner.
- **Webhook Raw-Body Preservation**: `express.json` captures `req.rawBody` buffer so webhook HMAC signatures match byte-for-byte without breaking normal JSON request parsing.
- **Deduplication & Replay Protection**:
  - Processed webhook event IDs are saved in `ProcessedWebhookEvent` to safely handle webhook retries.
  - Verification API checks existing payment status and returns idempotently for duplicate requests.

### 2. Environment Configuration
Add the following to your `.env`:
```env
RAZORPAY_KEY_ID=rzp_test_YourKeyIdHere
RAZORPAY_KEY_SECRET=YourKeySecretHere
RAZORPAY_WEBHOOK_SECRET=YourWebhookSecretHere
```

### 3. Payment API Endpoints

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/payments/create-order` | Customer | Initiate Razorpay order for an eligible marketplace order |
| `POST` | `/api/payments/verify` | Customer | Cryptographically verify signature and mark payment captured |
| `POST` | `/api/payments/webhook` | Public | Signature-verified webhook handler for `payment.captured` and `payment.failed` |
| `GET` | `/api/payments/order/:orderId` | Customer | Retrieve payment history and transaction metadata for an order |
| `GET` | `/api/payments/admin` | Admin | Platform-wide payment auditing and transaction records |

#### Postman Examples

##### 1. Initiate Payment Order (`POST /api/payments/create-order`)
```json
// Headers: Cookie: access_token=<JWT_TOKEN>
// Request Body
{
  "orderId": "6aecd95cce255c4ab0797632"
}

// Response (201 Created)
{
  "success": true,
  "message": "Razorpay order created successfully",
  "data": {
    "keyId": "rzp_test_placeholder",
    "razorpayOrderId": "order_test_1793910888921_1r91q",
    "amount": 25000,
    "currency": "INR",
    "orderId": "6aecd95cce255c4ab0797632",
    "orderNumber": "ORD-TEST-001",
    "customer": {
      "name": "Alice Customer",
      "phone": "+1 555-123-4567"
    }
  }
}
```

##### 2. Verify Payment (`POST /api/payments/verify`)
```json
// Headers: Cookie: access_token=<JWT_TOKEN>
// Request Body
{
  "razorpay_order_id": "order_test_1793910888921_1r91q",
  "razorpay_payment_id": "pay_test_9876543210",
  "razorpay_signature": "e5c26b856b3e7bc2100868f0...<HMAC_SHA256>"
}

// Response (200 OK)
{
  "success": true,
  "message": "Payment verified and captured successfully",
  "data": {
    "payment": {
      "id": "6aece007963d4aefaa1531c8",
      "customerId": "6aecd95ace255c4ab079761e",
      "parentOrderId": "6aecd95cce255c4ab0797632",
      "razorpayOrderId": "order_test_1793910888921_1r91q",
      "razorpayPaymentId": "pay_test_9876543210",
      "amount": 250,
      "currency": "INR",
      "status": "captured",
      "verifiedAt": "2026-11-06T01:54:48.000Z"
    },
    "order": {
      "id": "6aecd95cce255c4ab0797632",
      "orderNumber": "ORD-TEST-001",
      "paymentStatus": "paid",
      "orderStatus": "confirmed"
    },
    "isDuplicate": false
  }
}
```

##### 3. Razorpay Webhook (`POST /api/payments/webhook`)
```json
// Headers: x-razorpay-signature: <HMAC_SHA256_OF_RAW_BODY>
// Request Body (Raw JSON)
{
  "event": "payment.captured",
  "event_id": "evt_capture_123456",
  "payload": {
    "payment": {
      "entity": {
        "id": "pay_test_9876543210",
        "order_id": "order_test_1793910888921_1r91q",
        "amount": 25000,
        "currency": "INR",
        "status": "captured",
        "method": "upi"
      }
    }
  }
}

// Response (200 OK)
{
  "success": true,
  "message": "Razorpay webhook processed successfully",
  "data": {
    "processed": true,
    "event": "payment.captured",
    "isDuplicate": false
  }
}
```

---

### Verified Phase 8A Razorpay Payment Test Suite (12 Tests)
Run using `npm run test:payment`:
1. **Create Razorpay Order**: Customer initiates payment $\rightarrow$ creates Razorpay order in paise, records pending payment in MongoDB (`201 Created`).
2. **Complete Test Payment**: Valid HMAC-SHA256 signature accepted $\rightarrow$ payment marked `captured` and parent order marked `paid` (`200 OK`).
3. **Signature Immutability**: Cryptographic signature and verification timestamp accurately stored in MongoDB.
4. **Invalid Signature Rejection**: Tampered or forged signatures rejected $\rightarrow$ marked `failed` with failure reason recorded (`400 Bad Request`).
5. **Failed Payment Webhook**: `payment.failed` webhook reconciled with payment and order records (`200 OK`).
6. **Webhook Signature Validation**: Forged or unsigned webhook payloads blocked with `400 Bad Request`.
7. **Webhook Event Deduplication**: Duplicate webhook event with identical `event_id` acknowledged safely without double-processing (`isDuplicate: true`).
8. **Duplicate Verification (Replay Protection)**: Repeated verification requests return existing captured payment idempotently without errors (`isDuplicate: true`).
9. **Payment Amount Mismatch Protection**: Verification rejected if payment amount differs from order total amount (`400 Bad Request`).
10. **Tenant Isolation Guard**: Customer 2 cannot initiate or verify payments for Customer 1's orders (`403 Forbidden`).
11. **Payment Retry & Cancellation Safeguards**: Retry permitted on eligible unpaid orders; blocked on cancelled orders (`400 Bad Request`) or already paid orders (`400 Bad Request`).
12. **Payment History in MongoDB**: `GET /api/payments/order/:orderId` retrieves full transaction metadata, timestamps, and payment statuses (`200 OK`).

---

## 💰 Phase 8B: Platform Commission & Vendor Payout Management

Phase 8B introduces automated marketplace commission calculation, merchant balance tracking, double-entry financial audit ledgers, and end-to-end administrative payout treasury controls.

### 📐 Financial Architecture & Principles
1. **Commissionable Base**: Commission is strictly assessed on line-item subtotals (`vendorOrder.vendorSubtotal`). Non-commissionable amounts such as shipping shares (`shippingShare`) and sales taxes are excluded from platform fee shares.
2. **Decimal-Safe Integer Minor Units (Paise) Math**: All financial computations convert amounts to integer minor units (paise) to eliminate floating-point drift:
   $$\text{grossPaise} = \text{round}(\text{grossAmount} \times 100)$$
   $$\text{platformFeePaise} = \text{round}\left(\frac{\text{grossPaise} \times \text{rate}}{100}\right)$$
   $$\text{vendorEarningsPaise} = \text{grossPaise} - \text{platformFeePaise}$$
3. **Exact Reconciliation Invariant**: The gross order amount strictly equals platform commission fee plus net vendor earnings:
   $$\text{grossAmount} \equiv \text{platformFee} + \text{vendorEarnings}$$
4. **Commission Rate Precedence**:
   $$\text{VendorProfile.commissionRate} \longrightarrow \text{PlatformSetting (default\_commission\_rate)} \longrightarrow 10.0\%$$
5. **Atomic Balance Reservation**: When a vendor requests a payout withdrawal, funds are atomically reserved from `availableBalance` to `pendingBalance`:
   $$\text{availableBalance} \geq \text{requestedAmount}$$
   If approved and settled (`paid`), funds move from `pendingBalance` to `paidOutAmount`. If rejected or failed, funds are atomically restored from `pendingBalance` back to `availableBalance`.
6. **Immutable Double-Entry Ledger**: Every balance transition writes an immutable `VendorLedger` record with direction (`credit` | `debit`), amount, balance after, reference, and audit metadata.

---

### 📡 Phase 8B API Endpoints

#### Vendor Console Endpoints
- `GET /api/vendor/earnings` — Real-time earnings summary, available/pending balances, and effective commission rate.
- `GET /api/vendor/transactions` — Paginated immutable financial ledger entries (`order_earning`, `payout_requested`, `payout_rejected`, `payout_processed`, `payout_failed`).
- `GET /api/vendor/payouts` — Paginated history of withdrawal requests with provider references and status badges.
- `POST /api/vendor/payouts/request` — Submit withdrawal request with balance reservation (enforces available balance and minimum payout threshold).

#### Super-Admin Treasury Endpoints
- `GET /api/admin/payouts` — Filterable payout queue with overall platform gross sales, total commission retained, and merchant balances.
- `GET /api/admin/payouts/:payoutId` — Payout detail with merchant KYC profile, current earnings, and recent ledger history.
- `PATCH /api/admin/payouts/:payoutId/approve` — Approve pending payout request (`requested` $\rightarrow$ `approved`).
- `PATCH /api/admin/payouts/:payoutId/reject` — Reject payout request with required reason; atomically restores reserved balance to merchant and logs reversal credit.
- `PATCH /api/admin/payouts/:payoutId/status` — Advance payout status (`processing`, `paid` with settlement provider reference, `failed` with balance restoration).
- `GET /api/admin/commission` — Platform default rate, minimum payout threshold, and active vendor rate overrides.
- `PUT /api/admin/commission/platform` — Update global marketplace default commission percentage.
- `PUT /api/admin/commission/vendors/:vendorId` — Set or update custom commission rate override for a specific merchant.

---

### Verified Phase 8B Commission & Payout Test Suite (14 Tests)
Run using `npm run test:commission`:
1. **Default Platform Commission Rate**: 10.0% default rate resolved when no override exists (`200 OK`).
2. **Vendor-Specific Commission Override**: Custom 15.0% rate in `VendorProfile` correctly supersedes global default rate.
3. **Non-Commissionable Exclusions**: Platform commission calculated strictly on product subtotals, excluding shipping amounts.
4. **Decimal-Safe Paise Math**: Fractions (e.g. ₹99.99 with 10% rate) calculate in integer minor units without cent/paise drift.
5. **Exact Reconciliation Invariant**: Verified `grossAmount == platformFee + vendorEarnings` across all odd and fractional orders.
6. **Automatic Verification Trigger**: Verified captured payment (`PaymentService.verifyPayment`) automatically snapshots commission on `VendorOrder` and credits `VendorEarnings`.
7. **Idempotency Safeguard**: Re-invoking commission calculation on an already-processed vendor order skips without duplicate balance credits.
8. **Atomic Ledger Credit**: Crediting earnings creates an immutable `order_earning` ledger transaction with balance after matching.
9. **Payout Request & Balance Reservation**: Vendor requests payout with sufficient balance $\rightarrow$ atomically reserves funds (`availableBalance` $\rightarrow$ `pendingBalance`) and creates debit ledger entry (`201 Created`).
10. **Insufficient Balance Guard**: Payout requests exceeding available balance rejected with `400 Bad Request`.
11. **Minimum Withdrawal Threshold**: Payout requests below configurable minimum threshold (₹50) rejected with `400 Bad Request`.
12. **Admin Payout Approval**: Admin approves payout $\rightarrow$ transitions status to `approved` (`200 OK`).
13. **Admin Payout Rejection & Balance Restoration**: Admin rejects payout with required reason $\rightarrow$ atomically restores reserved funds (`pendingBalance` $\rightarrow$ `availableBalance`) and records credit reversal ledger entry (`200 OK`).
14. **Settlement & Disbursal Audit**: Admin marks payout as `paid` with provider transaction reference $\rightarrow$ transitions `pendingBalance` to `paidOutAmount`, logs settlement transaction, and verifies zero financial drift (`200 OK`).

---

### Verified Phase 7B Multi-Vendor Order Test Suite (14 Tests)
Run using `npm run test:multivendor`:
1. Checkout with 1 vendor $\rightarrow$ Creates 1 parent order and 1 child vendor order (`201 Created`).
2. Checkout with 2 distinct vendors $\rightarrow$ Creates 1 parent order and 2 distinct vendor orders (`201 Created`).
3. Checkout with 3 distinct vendors $\rightarrow$ Creates 1 parent order and 3 distinct vendor orders (`201 Created`).
4. Verified exactly 1 parent order exists for multi-vendor transaction.
5. Items accurately partitioned and grouped strictly by merchant.
6. Reconciled totals: parent subtotal matches sum of vendor subtotals ($1200.00).
7. Customer ownership isolation: customer cannot view other customers' parent or vendor orders (`403 Forbidden`).
8. Vendor tenant isolation: vendor cannot view or update another vendor's order (`403 Forbidden`).
9. Platform admin access: administrator has full visibility across all parent and vendor orders.
10. Valid fulfillment transitions verified; carrier/tracking number required when shipped; illegal transitions blocked.
11. Composite status aggregation: partial delivery accurately derives parent status as `partially_delivered`.
12. Vendor order cancellation restores product inventory count exactly once in MongoDB and Elasticsearch.
13. Checkout idempotency prevents duplicate parent and vendor order creation.
14. Order snapshot immutability: subsequent product price and name edits do not modify completed order records.

---

## ⭐ Phase 9A: Product Reviews and Ratings

Phase 9A introduces an Amazon-style product rating and review subsystem featuring verified purchase verification, automated aggregate score calculations, helpful review voting, and administrative content moderation.

### 📐 Review Architecture & Security Invariants
1. **Verified Purchase Validation**: Customers can only review a product if they purchased it in an order that has been fully paid (`paymentStatus: 'paid'`) and the specific vendor order containing the product has reached the `delivered` status. Unverified customers or customers with pending/shipped orders are blocked server-side (`403 Forbidden`).
2. **Review Uniqueness Policy**: A customer may write at most one review per product (`{ userId: 1, productId: 1 }` compound unique index). Subsequent submissions are rejected (`409 Conflict`), and users must update (`PATCH`) their existing review instead.
3. **Server-Side Trust Boundary**: The `isVerifiedPurchase` flag and order linkage (`orderId`, `vendorOrderId`) are resolved and validated strictly on the server against persisted orders; client-provided overrides are ignored.
4. **Rating Scale & Strict Validation**: Ratings are integers strictly between 1 and 5. Out-of-bounds ratings, decimals, and empty titles or comments are rejected with validation errors (`422 Unprocessable Entity`).
5. **Real-time Rating Synchronization**: Every review creation, update, deletion, or moderation change triggers recalculation of the product's `averageRating` (rounded to one decimal place) and `reviewCount` using MongoDB aggregation, updating the `Product` document. Only `approved` reviews count toward public ratings.
6. **Helpful Review Voting**: Community voting uses a dedicated `ReviewVote` model with compound index `{ reviewId: 1, userId: 1 }`. Customers can toggle helpful votes on/off. Review authors are strictly prevented from upvoting their own reviews (`400 Bad Request`).
7. **Multi-Role Moderation Pipeline**: Reviews default to `approved` status, but platform administrators can query all reviews across the platform, filter by moderation status (`approved`, `hidden`, `rejected`), update moderation status with mandatory rejection reasons, or permanently delete abusive content.

---

### 📡 Phase 9A API Endpoints

#### Customer & Public Review Endpoints
- `GET /api/products/:productId/reviews` — Retrieve approved reviews with pagination, star-rating filtering, author data, and aggregate summary (`averageRating`, `totalReviews`, and 1–5 star distribution).
- `GET /api/products/:productId/reviews/eligibility` — Authenticated endpoint checking whether the caller can review the product (`isEligible`, `hasReviewed`, `existingReviewId`).
- `POST /api/products/:productId/reviews` — Submit verified review (`rating`, `title`, `comment`). Validates delivered purchase ownership.
- `PATCH /api/reviews/:reviewId` — Update existing review title, rating, or comment (restricted strictly to author).
- `DELETE /api/reviews/:reviewId` — Delete review (permitted for author or platform administrator).
- `POST /api/reviews/:reviewId/helpful` — Toggle helpful vote on a review (enforces single vote per user and blocks author self-votes).

#### Platform Admin Moderation Endpoints
- `GET /api/admin/reviews` — Paginated list of all marketplace reviews with status filtering (`all`, `approved`, `hidden`, `rejected`), populated customer, product, and moderator details.
- `PATCH /api/admin/reviews/:reviewId/status` — Moderate review status (`approved`, `hidden`, `rejected` with rejection reason and audit tracking).
- `DELETE /api/admin/reviews/:reviewId` — Administrative hard deletion of abusive review content.

---

### 🖥️ Frontend Review UI & Experiences
- **`ProductReviewsSection.tsx`**: Amazon-style rating breakdown, interactive star distribution meters, verified purchase badges, review author cards, write/edit review dialog with interactive star rating picker, and helpful vote button.
- **`ProductDetailModal.tsx`**: Full product detail modal overlay with image carousel, specifications, add-to-cart controls, and the embedded `ProductReviewsSection`.
- **`AdminReviewsModerator.tsx`**: Dedicated admin portal tab for monitoring marketplace feedback, filtering by moderation state, reviewing flagged comments, approving, hiding, or rejecting with custom feedback reasons.

---

### Verified Phase 9A Product Reviews & Ratings Test Suite (13 Tests)
Run using `npm run test:reviews`:
1. **Eligible Customer Review**: Customer with paid & delivered vendor order creates verified review (`201 Created`).
2. **Undelivered Order Rejection**: Customer with processing/shipped order blocked with `403 Forbidden`.
3. **Unpurchased Product Rejection**: Customer attempting to review product they never ordered blocked with `403 Forbidden`.
4. **Duplicate Review Prevention**: Second review submission for identical product rejected with `409 Conflict`.
5. **Invalid Rating Rejection**: Out-of-bounds (0, 6) or fractional (4.5) ratings rejected with validation error (`422 Unprocessable Entity`).
6. **Review Editing Ownership**: Author successfully updates title/comment; cross-customer edit rejected (`403 Forbidden`).
7. **Review Deletion Ownership**: Non-owner blocked (`403 Forbidden`); author and super-admin can delete review (`200 OK`).
8. **Review Moderation Visibility**: Admin hides review $\rightarrow$ review excluded from public listing.
9. **Average Rating Calculation**: Product aggregate average rating accurately computed across approved reviews.
10. **Rating Distribution Breakdown**: Star counts (1 to 5) accurately match exact review distribution.
11. **Helpful Voting Safeguards**: Author cannot self-vote (`400 Bad Request`); customer voting toggles on/off idempotently.
12. **Hidden Review Rating Exclusion**: Hidden or rejected reviews immediately excluded from product rating calculation.
13. **Pagination & Star Filtering**: Querying reviews by star rating (e.g. `rating=5`) and pagination limit/page behaves correctly.

---

## 🎟️ Phase 9B: Coupon and Discount Management

Phase 9B implements a coupon and promotion system supporting percentage and fixed discounts, minimum order constraints, maximum discount caps, per-customer and global usage limits, product/category/vendor targeting, atomic checkout reservations, and multi-vendor discount reconciliation.

### 📐 Coupon Architecture & Financial Invariants
1. **Server-Authoritative Calculations**: All discount amounts, cart subtotals, and net payables are computed strictly on the backend using trusted MongoDB data. Client-submitted prices, discounts, or payables are ignored.
2. **Discount Types & Caps**:
   - **Percentage Discount**: Discount = $\min\left(\frac{\text{eligibleSubtotal} \times \text{discountValue}}{100}, \text{maximumDiscountAmount}\right)$.
   - **Fixed Amount Discount**: Discount = $\min(\text{discountValue}, \text{eligibleSubtotal})$.
3. **Targeting & Restrictions**:
   - Storewide (no restrictions): All cart items qualify.
   - Product-specific: Only items where `item.productId` is in `coupon.applicableProducts` qualify.
   - Category-specific: Only items where `product.categoryId` is in `coupon.applicableCategories` qualify.
   - Vendor-specific: Only items where `product.vendorId` is in `coupon.applicableVendors` qualify.
4. **Multi-Vendor Discount Allocation**:
   Discounts are distributed across child vendor orders proportionally to each merchant's eligible subtotal share:
   $$\text{discountShare}_v = \text{round}\left(\frac{\text{eligibleSubtotal}_v}{\text{totalEligibleSubtotal}} \times \text{discountAmount}\right)$$
   The final vendor absorbs penny rounding differences so that $\sum_v \text{discountShare}_v \equiv \text{discountAmount}$.
   Parent and vendor order totals reconcile:
   $$\text{parentTotal} \equiv \sum_v (\text{vendorSubtotal}_v - \text{discountShare}_v + \text{shippingShare}_v)$$
5. **Atomic Usage Accounting & Concurrency Guard**:
   Coupon redemptions are atomically incremented during checkout using conditional query:
   `{ _id: couponId, isActive: true, usageCount: { $lt: totalUsageLimit } }`
   ensuring that concurrent checkout requests cannot exceed global or per-customer limits.
   Failed or rolled back checkouts immediately decrement the reservation.
6. **Payment Gateway Reconciliation**:
   Razorpay order amount is initialized with `Math.round(order.totalAmount * 100)` in paise, guaranteeing the customer pays the exact discounted total.
7. **Audit Trail**: Every redemption writes an immutable `CouponUsage` record linking `couponId`, `customerId`, `orderId`, and `discountAmount`.

---

### 📡 Phase 9B API Endpoints

#### Admin Coupon Management Endpoints
- `POST /api/admin/coupons` — Create new promotional coupon (Admin only).
- `GET /api/admin/coupons` — List marketplace coupons with search, status filtering, and pagination.
- `GET /api/admin/coupons/:id` — Retrieve coupon detail with total redemption count.
- `PATCH /api/admin/coupons/:id` — Update coupon configuration, date ranges, or active state.
- `DELETE /api/admin/coupons/:id` — Delete unused coupon or deactivate if historical redemptions exist.

#### Customer Coupon Endpoints
- `POST /api/coupons/validate` — Validate a coupon code against the customer's active cart and return real-time discount preview and payable total without consuming usage.
- `POST /api/checkout` — Checkout accepting optional `couponCode`. Re-evaluates coupon against live cart, consumes usage atomically, records snapshot on parent and vendor orders.

---

### 🖥️ Frontend UI Deliverables
- **`CheckoutModal.tsx`**: Interactive coupon input with real-time validation, discount breakdown pill, removable coupon badge, and automatic recalculation of final payable total.
- **`AdminCouponsManager.tsx`**: Administrative console with create/edit coupon dialogs, status filters, validity dates, global/user usage caps, and activation/deactivation controls. Mounted in Admin Governance portal (`LandingPage.tsx`).

---

### Verified Phase 9B Coupon & Discount Management Test Suite (16 Tests)
Run using `npm run test:coupons`:
1. **Create percentage coupon**: Admin creates percentage coupon with max cap and min order (`201 Created`).
2. **Create fixed discount coupon**: Admin creates fixed amount coupon (`201 Created`).
3. **Apply valid coupon**: Customer validates coupon against cart; discount and payable amounts calculated correctly (`200 OK`).
4. **Apply expired coupon**: Expired coupon rejected with `400 Bad Request`.
5. **Apply inactive coupon**: Inactive coupon rejected with `400 Bad Request`.
6. **Apply coupon before start date**: Scheduled future coupon rejected with `400 Bad Request`.
7. **Test minimum order amount**: Cart below required minimum subtotal rejected with `400 Bad Request`.
8. **Test maximum discount cap**: Percentage discount accurately capped at `maximumDiscountAmount`.
9. **Test global usage limit**: Coupon that has reached `totalUsageLimit` rejected with `400 Bad Request`.
10. **Test per-user usage limit**: Customer who redeemed `perUserUsageLimit` rejected; other customers can still redeem.
11. **Test vendor-specific coupon**: Discount calculated strictly on items belonging to the target vendor.
12. **Test invalid coupon code**: Non-existent coupon code rejected with `404 Not Found`.
13. **Test simultaneous coupon redemption**: Concurrent checkouts on last remaining coupon slot result in exactly 1 success and 1 rejection without race condition.
14. **Test duplicate checkout submission**: Idempotency key prevents duplicate coupon incrementation and duplicate order creation.
15. **Verify Razorpay amount matches final payable amount**: Razorpay order amount strictly matches discounted total in paise.
16. **Verify order and vendor order totals reconcile**: Sum of vendor subtotals, vendor discounts, shipping shares, and net totals match parent order totals to the penny.

---

---

---

## 📖 Architectural Documentation
- Detailed system design, entity relationships, security architecture, and multi-vendor commission math are documented in **[`docs/architecture.md`](docs/architecture.md)**.
- Complete REST API route specifications and payload formats are detailed in **[`docs/api-planning.md`](docs/api-planning.md)**.
