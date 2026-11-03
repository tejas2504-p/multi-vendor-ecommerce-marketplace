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
│   │   ├── controllers/           # HTTP Request & Response handlers
│   │   ├── middleware/            # Centralized error, not-found & auth middleware
│   │   ├── models/                # Mongoose schema definitions (Phase 2+)
│   │   ├── routes/                # Versioned Express routers (/api/health, /api/v1)
│   │   ├── services/              # Domain business logic & data operations
│   │   ├── utils/                 # Structured Winston logger, ApiResponse, AppError
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
- **Docker & Docker Compose** (Optional for local container services)

### 2. Installation
Clone the repository and install all monorepo dependencies:
```bash
git clone <repository-url>
cd multi-vendor-marketplace
npm install
```

### 3. Environment Configuration
Copy the template `.env.example` to `.env`:
```bash
cp .env.example .env
```

Ensure default ports are available:
- Backend: `PORT=5000`
- Frontend: `http://localhost:5173`
- MongoDB: `mongodb://localhost:27017/marketplace`

### 4. Running the Development Servers

#### Option A: Run Both Client & Server Concurrently
```bash
npm run dev
```

#### Option B: Run Services Individually
```bash
# In Terminal 1 (Backend API):
npm run dev:server

# In Terminal 2 (Frontend Client):
npm run dev:client
```

### 5. Running Local Storage Containers (Optional)
```bash
npm run docker:up    # Starts MongoDB, Redis, and Elasticsearch containers
npm run docker:down  # Stops local containers
```

---

## 📡 API Verification Endpoints

Verify that the backend is responding by opening the health check endpoints:
- **Server Health**: `GET http://localhost:5000/api/health`
- **Versioned Health**: `GET http://localhost:5000/api/v1/health`
- **API Root**: `GET http://localhost:5000/`

Example response:
```json
{
  "success": true,
  "message": "Server status retrieved successfully",
  "data": {
    "status": "healthy",
    "message": "Multi-Vendor Marketplace API is running smoothly",
    "uptimeSeconds": 14,
    "timestamp": "2026-11-04T00:30:00.000Z",
    "environment": "development",
    "version": "1.0.0",
    "database": { "mongodb": "connected" },
    "memoryUsageMB": { "rss": "95.20", "heapUsed": "28.40" }
  }
}
```

---

## 🗺️ Future Integrations & Dependency Plan

External service integrations are planned for subsequent phases and will be introduced modularly:

| Service | Target Phase | Integration Strategy |
| :--- | :--- | :--- |
| **Redis** | Phase 2A & 6B | Session blacklist, sliding-window rate limiting, and distributed checkout mutexes using `ioredis`. |
| **Elasticsearch** | Phase 6A | Full-text catalog search and faceted aggregations synched via MongoDB Change Streams. |
| **AWS S3** | Phase 5A | Pre-signed client direct image uploads (`@aws-sdk/s3-request-presigner`) to avoid server memory spikes. |
| **Stripe / Razorpay** | Phase 8B & 10B | Multi-party split checkout, escrow holding, and automated seller payouts via official SDKs. |

---

## 📖 Architectural Documentation
- Detailed system design, entity relationships, security architecture, and multi-vendor commission math are documented in **[`docs/architecture.md`](docs/architecture.md)**.
- Complete REST API route specifications and payload formats are detailed in **[`docs/api-planning.md`](docs/api-planning.md)**.
