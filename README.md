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
| **Caching (Future Phase)** | Redis 7.2 | Distributed stock locks, session blacklist, rate limiting |
| **Search (Future Phase)** | Elasticsearch 8.13 | High-speed full-text search, fuzzy matching & faceted filters |
| **Media Storage (Future Phase)**| AWS S3 + CloudFront | Direct-to-S3 pre-signed media uploads & CDN delivery |
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

## 🧪 Automated Testing

Phase 2A, Phase 2B, Phase 3A, and Phase 3B include fully automated integration test suites executed with `mongodb-memory-server` and `supertest` (**50 total tests, 100% pass rate**):

```bash
# Run all test suites across the monorepo:
npm run test

# Or run individual test suites:
npm run test:auth      # Phase 2A: Authentication, Tokens, Cookies (10 tests)
npm run test:rbac      # Phase 2B: RBAC, Route Guards, Ownership (11 tests)
npm run test:vendor    # Phase 3A: Vendor Onboarding, Status, Application Guards (14 tests)
npm run test:approval  # Phase 3B: Admin Approval, Dashboard, State Transitions (15 tests)
```

### Verified Admin Approval Test Suite (15 Tests)
1. `GET /api/admin/vendors?status=pending` $\rightarrow$ Admin successfully lists filtered applications (`200 OK`).
2. `GET /api/admin/vendors` $\rightarrow$ Customer blocked from listing applications (`403 Forbidden`).
3. `PATCH /api/admin/vendors/:id/approve` $\rightarrow$ Non-admin blocked from approval (`403 Forbidden`).
4. `PATCH /api/admin/vendors/:id/approve` $\rightarrow$ Admin successfully approves pending vendor (`200 OK`).
5. Role promotion verification $\rightarrow$ User role atomically upgraded to `'vendor'` in MongoDB.
6. `PATCH /api/admin/vendors/:id/approve` $\rightarrow$ Duplicate approval blocked (`409 Conflict`).
7. `PATCH /api/admin/vendors/:id/reject` $\rightarrow$ Admin rejects application with reason (`200 OK`).
8. Role preservation verification $\rightarrow$ Rejected applicant remains a `'customer'`.
9. `GET /api/vendor/dashboard` $\rightarrow$ Approved vendor retrieves store data and initial zero metrics (`200 OK`).
10. `GET /api/vendor/dashboard` $\rightarrow$ Pending / unapproved applicant blocked (`403 Forbidden`).
11. `PATCH /api/vendor/store` $\rightarrow$ Approved vendor updates store description & contact (`200 OK`).
12. Unauthenticated requests $\rightarrow$ Blocked with `401 Unauthorized`.
13. Unauthorized role requests $\rightarrow$ Blocked with `403 Forbidden`.
14. Malformed application IDs $\rightarrow$ Safely rejected (`400 Bad Request`).
15. Illegal state transitions $\rightarrow$ Rejecting an approved vendor blocked (`400 Bad Request`).

---

## 🗺️ Future Integrations & Dependency Plan

External service integrations are planned for subsequent phases and will be introduced modularly:

| Service | Target Phase | Integration Strategy |
| :--- | :--- | :--- |
| **Redis** | Phase 2B & 6B | Session blacklist, sliding-window rate limiting, and distributed checkout mutexes using `ioredis`. |
| **Elasticsearch** | Phase 6A | Full-text catalog search and faceted aggregations synched via MongoDB Change Streams. |
| **AWS S3** | Phase 5A | Pre-signed client direct image uploads (`@aws-sdk/s3-request-presigner`) to avoid server memory spikes. |
| **Stripe / Razorpay** | Phase 8B & 10B | Multi-party split checkout, escrow holding, and automated seller payouts via official SDKs. |

---

## 📖 Architectural Documentation
- Detailed system design, entity relationships, security architecture, and multi-vendor commission math are documented in **[`docs/architecture.md`](docs/architecture.md)**.
- Complete REST API route specifications and payload formats are detailed in **[`docs/api-planning.md`](docs/api-planning.md)**.
