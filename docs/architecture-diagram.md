# NexusMarket — System Architecture Diagrams

**Project**: NexusMarket Multi-Vendor E-Commerce Marketplace  
**Document**: Architecture Diagrams & Visual Workflows  
**Target Evaluation**: Engineering Internship & Architecture Review  

---

## 1. High-Level Platform Architecture

The diagram below illustrates the end-to-end platform design: the single-page client application communicating through a hardened API gateway layer to domain services, with dedicated persistence, caching, search, file storage, and payment providers.

```mermaid
flowchart TD
    subgraph ClientLayer["Frontend Client Layer (Vite + React 18 + TS)"]
        CustomerPortal["Customer Marketplace Portal\n- Catalog Browsing & Cart\n- Checkout & UPI QR / Cards\n- Order History & PDF Invoices"]
        VendorPortal["Merchant Operations Center\n- KYC Store Onboarding\n- Catalog & Inventory CRUD\n- Shipment Fulfillment & Payouts"]
        AdminPortal["Platform Operations Console\n- Vendor Verification & KYC\n- Commission Treasury & Disputes\n- BI Analytics & Review Moderation"]
    end

    subgraph SecurityGateway["API Security & Middleware Pipeline"]
        CORS["CORS & Origin Verification"]
        Helmet["Helmet CSP & Security Headers"]
        RateLimiters["Tiered Rate Limiters\n(apiLimiter, authLimiter, paymentLimiter)"]
        Sanitizer["NoSQL Injection Sanitizer\n(mongoSanitizeMiddleware)"]
        AuthLayer["JWT Authenticator & RBAC Guard\n(authenticate, authorize, requireApprovedVendor)"]
        ZodValidator["Zod Schema Request Validators"]
    end

    subgraph ServiceLayer["Backend Application Services (Node.js + Express + TS)"]
        AuthSvc["AuthService"]
        ProductSvc["ProductService"]
        SearchSvc["ProductSearchService"]
        CartSvc["CartService"]
        CheckoutSvc["CheckoutService"]
        PaymentSvc["PaymentService"]
        CommissionSvc["CommissionService"]
        InvoiceSvc["InvoiceService"]
        AnalyticsSvc["AnalyticsService"]
    end

    subgraph DataTier["Data Persistence & Caching Tier"]
        MongoDB[("MongoDB 7.0 Cluster\n(Mongoose 8.x Document Store)\n20 Collections & Compound Indexes")]
        RedisCache[("Redis 7.2 In-Memory Cache\n- Active Shopping Carts\n- BI Analytics Cache (5-min TTL)")]
        Elasticsearch[("Elasticsearch 8.x Cluster\n- Fuzzy Search & Autocomplete\n- Outbox Sync & Filter Facets")]
    end

    subgraph ExternalServices["External Cloud Integrations"]
        AWSS3["AWS S3 Bucket\n- Product Image Presigned Uploads\n- Streamed Order PDF Invoices"]
        RazorpayGateway["Razorpay Payment Gateway\n- HMAC-SHA256 Signatures\n- Webhook Deduplication Engine\n- Dynamic UPI QR Payments"]
    end

    CustomerPortal --> CORS
    VendorPortal --> CORS
    AdminPortal --> CORS

    CORS --> Helmet --> RateLimiters --> Sanitizer --> AuthLayer --> ZodValidator

    ZodValidator --> AuthSvc
    ZodValidator --> ProductSvc
    ZodValidator --> SearchSvc
    ZodValidator --> CartSvc
    ZodValidator --> CheckoutSvc
    ZodValidator --> PaymentSvc
    ZodValidator --> CommissionSvc
    ZodValidator --> InvoiceSvc
    ZodValidator --> AnalyticsSvc

    AuthSvc --> MongoDB
    ProductSvc --> MongoDB
    ProductSvc --> Elasticsearch
    SearchSvc --> Elasticsearch
    SearchSvc -.->|"Fallback on Outage"| MongoDB
    CartSvc --> RedisCache
    CartSvc --> MongoDB
    CheckoutSvc --> MongoDB
    CheckoutSvc --> RedisCache
    PaymentSvc --> RazorpayGateway
    PaymentSvc --> MongoDB
    PaymentSvc --> RedisCache
    CommissionSvc --> MongoDB
    InvoiceSvc --> AWSS3
    InvoiceSvc --> MongoDB
    ProductSvc --> AWSS3
    AnalyticsSvc --> RedisCache
    AnalyticsSvc --> MongoDB
```

---

## 2. Portal & Role-Based Access Control (RBAC) Architecture

NexusMarket implements strict role-based separation and resource ownership verification across three operational domains:

```mermaid
flowchart LR
    User([User Request]) --> Auth{"Authentication Status"}

    Auth -->|"Unauthenticated"| PublicScope["Public Scope\n- Browse Active Products\n- Search & Filter Catalog\n- Register / Login"]

    Auth -->|"Authenticated"| TokenCheck{"Role Extraction"}

    TokenCheck -->|"role: customer"| CustScope["Customer Domain\n- Manage Cart & Delivery Addresses\n- Consolidated Checkout\n- Pay via Razorpay / UPI QR\n- Download Order Invoices\n- Submit Verified Reviews"]

    TokenCheck -->|"role: vendor"| VendorCheck{"Vendor Status"}
    VendorCheck -->|"status: pending / rejected"| PendingVendor["Onboarding Scope\n- Submit Store KYC\n- Check Application Status"]
    VendorCheck -->|"status: approved"| ApprovedVendor["Merchant Scope\n- Manage Product Catalog & Stock\n- Upload Product Images to S3\n- Fulfill Split Vendor Orders\n- Track Revenue & Request Payouts"]

    TokenCheck -->|"role: admin"| AdminScope["Super-Admin Domain\n- Approve / Reject Vendor Applications\n- Set Global & Custom Commission Rates\n- Moderate Customer Reviews\n- Approve & Disburse Vendor Payouts\n- Real-Time Executive BI Analytics"]
```

---

## 3. Dual-Token Authentication & Refresh Lifecycle

To deliver seamless session continuity without compromising security, NexusMarket utilizes a dual-token JWT architecture:

```mermaid
sequenceDiagram
    autonumber
    actor User as Client Browser
    participant API as Express API Server
    participant DB as MongoDB (User Model)

    User->>API: POST /api/auth/login { email, password }
    API->>DB: Query user with select('+password')
    DB-->>API: Return user record
    API->>API: Verify bcrypt hash (cost factor 12)
    API->>API: Generate Access Token (15m) & Refresh Token (7d)
    API-->>User: 200 OK + Set-Cookie (access_token, refresh_token HttpOnly) + JSON payload

    Note over User,API: Normal authenticated traffic with Access Token
    User->>API: GET /api/orders (with access_token)
    API-->>User: 200 OK (Orders List)

    Note over User,API: 15 minutes elapse (Access Token expires)
    User->>API: GET /api/cart (expired access_token)
    API-->>User: 401 Unauthorized ("Authentication token has expired")

    Note over User,API: Transparent Axios Interceptor Auto-Refresh
    User->>API: POST /api/auth/refresh (with refresh_token cookie or body)
    API->>API: Verify Refresh Token signature against JWT_REFRESH_SECRET
    API->>DB: Verify user exists and isActive === true
    DB-->>API: User valid
    API->>API: Mint new Access Token (15m) & rotated Refresh Token (7d)
    API-->>User: 200 OK + Updated HttpOnly Cookies + new token in JSON
    User->>API: Replay original request GET /api/cart (with new token)
    API-->>User: 200 OK (Cart Data returned seamlessly)
```

---

## 4. Multi-Vendor Order Splitting & Payment Flow

When a customer purchases items from multiple distinct merchants in a single shopping cart, the system enforces transactional order splitting:

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer
    participant Checkout as CheckoutService
    participant DB as MongoDB
    participant Razorpay as Razorpay API
    participant Commission as CommissionService
    participant Invoice as InvoiceService
    actor Vendor as Vendor(s)

    Customer->>Checkout: POST /api/checkout { addressId, couponCode }
    Checkout->>DB: Atomic stock reservation & validation
    Checkout->>DB: Group cart items by vendorId
    Checkout->>DB: Create Master Parent Order (ORD-XXXXX)
    Checkout->>DB: Create child VendorOrder records (ORD-XXXXX-V1, ORD-XXXXX-V2)
    Checkout->>DB: Clear Customer Cart
    Checkout-->>Customer: 201 Created (Parent Order & Vendor Orders)

    Customer->>Razorpay: POST /api/payments/create-order (or /create-qr-code)
    Razorpay-->>Customer: Razorpay Order ID / Dynamic UPI QR URI
    Customer->>Razorpay: Complete Payment (Card, Netbanking, UPI, or QR)
    Customer->>Razorpay: Submit Signature to POST /api/payments/verify
    Razorpay->>Razorpay: Verify HMAC-SHA256 Signature on Backend
    Razorpay->>DB: Update Payment (status: captured)
    Razorpay->>DB: Update Parent Order (paymentStatus: paid)
    
    par Async Platform Commission & Accounting
        Razorpay->>Commission: CommissionService.calculateAndRecordCommission()
        Commission->>DB: Query vendor commission rate (default 10% or custom)
        Commission->>DB: Record Platform Fee & credit VendorEarnings wallet
        Commission->>DB: Append transaction to VendorLedger
    and Async Invoice Generation
        Razorpay->>Invoice: InvoiceService.generateInvoiceForOrder()
        Invoice->>DB: Save Invoice record (INV-XXXXX)
        Invoice->>Invoice: Stream PDF invoice buffer
    end

    Razorpay-->>Customer: 200 OK (Payment Verified, Receipt & Invoices Ready)
    Vendor->>DB: GET /api/vendor/orders (Sees only their own VendorOrder)
    Vendor->>DB: PATCH /api/vendor/orders/:id/status (processing -> shipped -> delivered)
```

---

## 5. Resilient Search & Elasticsearch Outbox Synchronization

Product updates maintain database consistency through an outbox pattern with automatic MongoDB fallback in case of Elasticsearch cluster disruptions:

```mermaid
flowchart TD
    Vendor["Vendor Client"] -->|"POST /products or PATCH /inventory"| ProductSvc["ProductService"]

    ProductSvc -->|"1. Save Document"| MongoDB[("MongoDB 'products' Collection")]
    ProductSvc -->|"2. Record Outbox Event"| Outbox[("MongoDB 'product_sync_outbox'")]

    ProductSvc -->|"3. Real-time Index"| ES["Elasticsearch Cluster\n('marketplace_products')"]
    
    ES -.->|"If ES succeeds"| OutboxDone["Mark Outbox Event: 'processed'"]
    ES -.->|"If ES fails"| OutboxPending["Outbox Event: 'pending' (Retried by worker)"]

    SearchUser["Customer Search Query"] --> SearchSvc["ProductSearchService"]
    SearchSvc --> ESTry{"Query Elasticsearch?"}

    ESTry -->|"Online (200)"| ESResult["Elasticsearch Full-Text Results\n- Autocomplete edge n-grams\n- Multi-match (name, brand, desc)\n- Facets (categories, brands, price)"]
    
    ESTry -->|"Unavailable / Network Error"| MongoFallback["MongoDB Fallback Search\n- Case-insensitive regex query\n- Price & Category filtering\n- Zero 503 errors returned to customer"]
    
    ESResult --> ReturnUser["Return Unified Search Results"]
    MongoFallback --> ReturnUser
```

---

## 6. Cloud Deployment Topology

The diagram below reflects the production cloud deployment configuration established in Phase 12A:

```mermaid
flowchart TD
    subgraph Users["End Users"]
        WebClients["Web Browsers\n(Mobile & Desktop)"]
    end

    subgraph VercelEdge["Vercel Cloud (Frontend Hosting)"]
        VercelCDN["Vercel Edge Network / CDN"]
        SPABundle["Vite React Single Page App\n- Index.html & Assets\n- Code-Split Vendor Chunks\n- SPA Rewrites via vercel.json"]
    end

    subgraph RenderPlatform["Render Cloud (Backend Web Service)"]
        RenderLB["Render Managed Load Balancer (HTTPS)"]
        NodeServer["Docker/Node Web Service\n(npm run start --workspace=server)\n- Express REST API\n- Helmet & CORS Handshake\n- Port 10000 (auto-assigned)"]
    end

    subgraph ManagedDatabases["Managed Database & Cache Services"]
        AtlasDB[("MongoDB Atlas M0/M10 Cluster\n(mongodb+srv://...)\n- Replica Set & Automated Backups\n- 0.0.0.0/0 IP Whitelist")]
        UpstashRedis[("Upstash Redis (Serverless)\n(rediss://... TLS)\n- Cart Sessions & Rate Limiting\n- Invalidation Hooks")]
        ElasticCloud[("Elastic Cloud / Bonsai\n(https://...:443)\n- Multi-field analyzers")]
    end

    subgraph CloudIntegrations["External Cloud APIs"]
        S3Bucket["AWS S3 Bucket\n(us-east-1)\n- Product Media\n- PDF Invoice Downloads"]
        RazorpayAPI["Razorpay Payment Gateway\n- Live/Test Checkout\n- Webhooks via Render Endpoint"]
    end

    WebClients -->|"HTTPS (Static Content)"| VercelCDN --> SPABundle
    WebClients -->|"HTTPS REST (CORS Credentials)"| RenderLB --> NodeServer

    NodeServer -->|"Replica Connection"| AtlasDB
    NodeServer -->|"TLS ioredis"| UpstashRedis
    NodeServer -->|"REST API / Key"| ElasticCloud
    NodeServer -->|"AWS SDK Presigned URLs"| S3Bucket
    NodeServer -->|"HMAC Orders & Webhooks"| RazorpayAPI
```
