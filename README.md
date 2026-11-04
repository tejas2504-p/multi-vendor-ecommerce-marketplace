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

## 🧪 Automated Testing

Both Phase 2A and Phase 2B include fully automated integration test suites executed with `mongodb-memory-server` and `supertest`:

```bash
# Run both Auth and RBAC test suites:
npm run test

# Or run individually:
npm run test:auth    # Phase 2A: Registration, Login, Token, Cookies (10 tests)
npm run test:rbac    # Phase 2B: RBAC, Route Guards, Ownership (11 tests)
```

### Verified RBAC Test Suite (11 Tests)
1. `GET /api/customer/dashboard` $\rightarrow$ Allowed for `customer` role (`200 OK`).
2. `GET /api/vendor/dashboard` $\rightarrow$ Blocked for `customer` role (`403 Forbidden`).
3. `GET /api/admin/dashboard` $\rightarrow$ Blocked for `customer` role (`403 Forbidden`).
4. `GET /api/vendor/dashboard` $\rightarrow$ Allowed for `vendor` role (`200 OK`).
5. `GET /api/admin/dashboard` $\rightarrow$ Blocked for `vendor` role (`403 Forbidden`).
6. `GET /api/admin/dashboard` $\rightarrow$ Allowed for `admin` role (`200 OK`).
7. `GET /api/{customer,vendor,admin}/dashboard` $\rightarrow$ Blocked for unauthenticated users (`401 Unauthorized`).
8. `POST /api/auth/register` with `role: "admin"` or `role: "vendor"` $\rightarrow$ Rejected (`422 Validation Error`).
9. `GET /api/vendor/resources/:otherVendorId` $\rightarrow$ Blocked cross-vendor access (`403 Forbidden`).
10. `GET /api/vendor/resources/:ownVendorId` $\rightarrow$ Allowed for authorized owner (`200 OK`).
11. `GET /api/vendor/resources/:vendorId` $\rightarrow$ Allowed for platform admin via governance override (`200 OK`).

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
