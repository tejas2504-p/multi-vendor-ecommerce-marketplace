import React from 'react';
import { 
  ShoppingBag, 
  Store, 
  ShieldCheck, 
  Server, 
  Database, 
  Activity, 
  RefreshCw,
  Layers,
  ArrowRight
} from 'lucide-react';
import { useHealth } from '../hooks/useHealth';
import { useApp } from '../context/AppContext';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ProductSearchExperience } from '../components/search/ProductSearchExperience';
import { AuthRoleTestingPanel } from '../components/auth/AuthRoleTestingPanel';
import { VendorPortalTestingPanel } from '../components/vendor/VendorPortalTestingPanel';
import { VendorOrdersManager } from '../components/vendor/VendorOrdersManager';
import { VendorEarningsDashboard } from '../components/vendor/VendorEarningsDashboard';
import { AdminOrdersManager } from '../components/admin/AdminOrdersManager';
import { AdminPayoutsManager } from '../components/admin/AdminPayoutsManager';
import { AdminReviewsModerator } from '../components/admin/AdminReviewsModerator';
import { AdminCouponsManager } from '../components/admin/AdminCouponsManager';
import { AdminAnalyticsDashboard } from '../components/admin/AdminAnalyticsDashboard';

export const LandingPage: React.FC = () => {
  const { activeRole, setActiveRole } = useApp();
  const { data: health, isLoading, isError, refetch, isFetching } = useHealth();

  return (
    <div className="space-y-8">
      {/* Designed Modern Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200/90 shadow-sm p-6 sm:p-10 lg:p-12">
        {/* Soft Decorative Ambient Background Glows */}
        <div className="absolute -right-20 -top-20 w-96 h-96 bg-emerald-100/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-1/4 -bottom-20 w-80 h-80 bg-teal-50/60 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Left Column: Headings, Descriptions & Tech Badges */}
          <div className="lg:col-span-7 space-y-5">
            {/* Live Status Pill */}
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/70 text-xs font-semibold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Multi-Vendor Architecture Initialized</span>
            </div>

            {/* Main Title */}
            <div className="space-y-1">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 leading-[1.12]">
                Amazon-Style Multi-Vendor
              </h1>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-emerald-700 leading-[1.12]">
                E-Commerce Marketplace
              </h2>
            </div>

            {/* Description */}
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-xl font-normal">
              Engineered from scratch using a production monorepo layout. Built with TypeScript end-to-end,
              Express.js RESTful API, MongoDB document store, and decoupled modular portals for Customers, Sellers, and Platform Admins.
            </p>

            {/* 8 Tech Stack Badges */}
            <div className="flex flex-wrap gap-2 pt-1">
              {/* React 18 */}
              <div className="inline-flex items-center space-x-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-700 shadow-xs transition">
                <svg className="w-4 h-4 text-sky-500 shrink-0" viewBox="-11.5 -10.23 23 20.46">
                  <circle cx="0" cy="0" r="2.05" fill="#0ea5e9"/>
                  <g stroke="#0ea5e9" strokeWidth="1" fill="none">
                    <ellipse rx="11" ry="4.2"/>
                    <ellipse rx="11" ry="4.2" transform="rotate(60)"/>
                    <ellipse rx="11" ry="4.2" transform="rotate(120)"/>
                  </g>
                </svg>
                <span>React 18</span>
              </div>

              {/* TypeScript */}
              <div className="inline-flex items-center space-x-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-700 shadow-xs transition">
                <span className="w-4 h-4 rounded bg-[#3178c6] text-white flex items-center justify-center text-[9px] font-black leading-none shrink-0">
                  TS
                </span>
                <span>TypeScript</span>
              </div>

              {/* Node.js */}
              <div className="inline-flex items-center space-x-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-700 shadow-xs transition">
                <svg className="w-4 h-4 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l9 5.2v10.4l-9 5.2-9-5.2V7.2L12 2zm0 2.3L4.8 8.5v7l7.2 4.2 7.2-4.2v-7L12 4.3z"/>
                </svg>
                <span>Node.js</span>
              </div>

              {/* MongoDB */}
              <div className="inline-flex items-center space-x-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-700 shadow-xs transition">
                <svg className="w-4 h-4 text-emerald-700 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1.5s-6 5.5-6 11.5c0 4.5 3 8 6 9.5 3-1.5 6-5 6-9.5 0-6-6-11.5-6-11.5zm.3 17.5v-7.8c.8 0 1.5.7 1.5 1.5 0 2.2-1.5 6.3-1.5 6.3z"/>
                </svg>
                <span>MongoDB</span>
              </div>

              {/* Tailwind CSS */}
              <div className="inline-flex items-center space-x-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-700 shadow-xs transition">
                <svg className="w-4 h-4 text-sky-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.001,4.8c-3.2,0-5.2,1.6-6,4.8c1.2-1.6,2.6-2.2,4.2-1.8c0.913,0.228,1.565,0.89,2.288,1.624 C13.666,10.618,15.027,12,18.001,12c3.2,0,5.2-1.6,6-4.8c-1.2,1.6-2.6,2.2-4.2,1.8c-0.913-0.228-1.565-0.89-2.288-1.624 C16.337,6.182,14.976,4.8,12.001,4.8z M6.001,12c-3.2,0-5.2,1.6-6,4.8c1.2-1.6,2.6-2.2,4.2-1.8c0.913,0.228,1.565,0.89,2.288,1.624 c1.177,1.194,2.538,2.576,5.512,2.576c3.2,0,5.2-1.6,6-4.8c-1.2,1.6-2.6,2.2-4.2,1.8c-0.913-0.228-1.565-0.89-2.288-1.624 C10.337,13.382,8.976,12,6.001,12z"/>
                </svg>
                <span>Tailwind CSS</span>
              </div>

              {/* Redis */}
              <div className="inline-flex items-center space-x-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-700 shadow-xs transition">
                <svg className="w-4 h-4 text-rose-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.5 7.5L12 2l9.5 5.5v9L12 22l-9.5-5.5v-9zm9.5 7.2l7-4-7-4-7 4 7 4z"/>
                </svg>
                <span>Redis</span>
              </div>

              {/* Elasticsearch */}
              <div className="inline-flex items-center space-x-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-700 shadow-xs transition">
                <svg className="w-4 h-4 text-amber-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <span>Elasticsearch</span>
              </div>

              {/* AWS S3 */}
              <div className="inline-flex items-center space-x-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-700 shadow-xs transition">
                <svg className="w-4 h-4 text-amber-600 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
                </svg>
                <span>AWS S3</span>
              </div>
            </div>
          </div>

          {/* Right Column: Code-Designed Laptop Mockup */}
          <div className="lg:col-span-5 flex items-center justify-center">
            <div className="w-full max-w-sm lg:max-w-md">
              {/* Laptop Screen Frame */}
              <div className="bg-slate-900 rounded-t-2xl p-2.5 sm:p-3 shadow-2xl border border-slate-700/80">
                {/* Camera dot */}
                <div className="w-1.5 h-1.5 rounded-full bg-slate-600 mx-auto mb-2" />
                
                {/* Inner Screen Viewport */}
                <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-200 shadow-inner p-3 space-y-2.5">
                  {/* Miniature Navbar */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                    <div className="flex items-center space-x-1.5">
                      <div className="w-4 h-4 rounded bg-emerald-600 flex items-center justify-center text-white text-[9px] font-black">
                        N
                      </div>
                      <span className="text-[11px] font-extrabold text-slate-900 tracking-tight">NexusMarket</span>
                    </div>
                    <div className="w-28 sm:w-36 h-4 bg-white border border-slate-200 rounded text-[8px] text-slate-400 flex items-center px-2 shadow-xs">
                      Search products...
                    </div>
                    <div className="flex items-center space-x-1.5 text-slate-400">
                      <div className="w-3.5 h-3.5 rounded-full bg-slate-200" />
                      <div className="w-3.5 h-3.5 rounded-full bg-emerald-100 flex items-center justify-center text-[8px] font-bold text-emerald-700">
                        ✓
                      </div>
                    </div>
                  </div>

                  {/* Inner Banner Hero Card */}
                  <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-white rounded-lg p-2.5 flex items-center justify-between border border-emerald-100 shadow-xs">
                    <div className="space-y-1">
                      <span className="text-[11px] font-black text-slate-900 block leading-tight">
                        Discover Top Products
                      </span>
                      <span className="text-[8.5px] text-slate-500 block">
                        From multiple trusted sellers
                      </span>
                      <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-700 text-white text-[8px] font-bold mt-1 shadow-xs">
                        <span>Shop Now</span>
                        <span>→</span>
                      </div>
                    </div>
                    <div className="w-14 h-14 rounded-lg bg-white p-1 shadow-xs border border-slate-100 flex items-center justify-center shrink-0">
                      <img
                        src="/images/products/alpha-studio-monitor-pro.jpg"
                        alt="Product preview"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>

                  {/* Category Pills Row */}
                  <div className="space-y-1 pt-0.5">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Shop by Category</span>
                    <div className="grid grid-cols-6 gap-1 text-center">
                      {[
                        { name: 'Electronics', color: 'bg-indigo-50 text-indigo-700' },
                        { name: 'Audio', color: 'bg-emerald-50 text-emerald-700' },
                        { name: 'Wearables', color: 'bg-amber-50 text-amber-700' },
                        { name: 'Mobile', color: 'bg-sky-50 text-sky-700' },
                        { name: 'Gaming', color: 'bg-rose-50 text-rose-700' },
                        { name: 'More', color: 'bg-slate-100 text-slate-700' },
                      ].map((cat, i) => (
                        <div key={i} className="flex flex-col items-center space-y-0.5">
                          <div className={`w-6 h-6 rounded-md ${cat.color} flex items-center justify-center text-[10px] font-bold shadow-xs border border-slate-200/50`}>
                            {cat.name.charAt(0)}
                          </div>
                          <span className="text-[7.5px] font-semibold text-slate-600 truncate max-w-full">{cat.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Laptop Keyboard Base & Trackpad Notch */}
              <div className="relative mx-auto -mt-0.5 bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 h-2.5 sm:h-3 rounded-b-xl shadow-lg border-t border-slate-200">
                <div className="w-16 h-1 bg-slate-400/80 rounded-b mx-auto" />
              </div>
              <div className="w-4/5 h-2.5 bg-slate-900/15 blur-sm rounded-full mx-auto mt-1" />
            </div>
          </div>
        </div>
      </div>

      {/* Live System Health Section */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Activity className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900">Backend API Status & Health Check</h2>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Poll /api/health</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* API Server */}
          <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/70 flex items-start space-x-3">
            <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Express REST Core</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {isLoading ? 'Connecting...' : isError ? 'Offline' : 'Port 5000 Active'}
              </div>
              <div className="flex items-center space-x-1.5 mt-1">
                <span className={`w-2 h-2 rounded-full ${!isError && health ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <span className="text-xs text-slate-600">
                  {!isError && health ? `Uptime: ${health.uptimeSeconds}s` : 'Server unreachable'}
                </span>
              </div>
            </div>
          </div>

          {/* MongoDB */}
          <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/70 flex items-start space-x-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">MongoDB Storage</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {health?.database.mongodb === 'connected' ? 'Connected' : 'Standby / Container Ready'}
              </div>
              <div className="flex items-center space-x-1.5 mt-1">
                <span className={`w-2 h-2 rounded-full ${health?.database.mongodb === 'connected' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                <span className="text-xs text-slate-600">
                  {health?.database.mongodb === 'connected' ? 'Mongoose v8 Ready' : 'Port 27017 Ready'}
                </span>
              </div>
            </div>
          </div>

          {/* Environment */}
          <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/70 flex items-start space-x-3">
            <div className="p-2.5 bg-sky-100 text-sky-700 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Environment Mode</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5 capitalize">
                {health?.environment || 'development'}
              </div>
              <div className="text-xs text-slate-600 mt-1">
                Node {health?.version ? `v${health.version}` : 'v22.x'}
              </div>
            </div>
          </div>

          {/* Memory Footprint */}
          <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/70 flex items-start space-x-3">
            <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Memory Allocation</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {health ? `${health.memoryUsageMB.heapUsed} MB Heap` : 'Analyzing...'}
              </div>
              <div className="text-xs text-slate-600 mt-1">
                {health ? `RSS: ${health.memoryUsageMB.rss} MB` : 'Monitoring'}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Phase 2: Authentication & Role-Based Access Control Console */}
      <AuthRoleTestingPanel />

      {/* Phase 3: Vendor Onboarding & Store Governance Console */}
      <VendorPortalTestingPanel />

      {/* Phase 5B: Advanced Elasticsearch Catalog Search & Discovery */}
      <ProductSearchExperience />

      {/* Phase 7B: Vendor Order Fulfillment Panel */}
      {(activeRole === 'vendor' || activeRole === 'admin') && (
        <section className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <h2 className="text-lg font-bold text-slate-900">Vendor Fulfillment & Shipment Dispatch</h2>
            </div>
            <VendorOrdersManager />
          </div>

          {/* Phase 8B: Vendor Earnings, Commission & Payout Console */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
              <h2 className="text-lg font-bold text-slate-900">Vendor Earnings & Balance Payouts</h2>
            </div>
            <VendorEarningsDashboard />
          </div>
        </section>
      )}

      {/* Phase 7B - Phase 10B: Admin Multi-Vendor Governance & Business Intelligence Panel */}
      {activeRole === 'admin' && (
        <section className="space-y-6">
          {/* Phase 10B: Admin Analytics & Business Intelligence Dashboard */}
          <div className="space-y-3">
            <AdminAnalyticsDashboard />
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
              <h2 className="text-lg font-bold text-slate-900">Super-Admin Order Governance & Oversight</h2>
            </div>
            <AdminOrdersManager />
          </div>

          {/* Phase 8B: Admin Platform Commission & Payout Treasury */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
              <h2 className="text-lg font-bold text-slate-900">Platform Commission & Payout Treasury</h2>
            </div>
            <AdminPayoutsManager />
          </div>

          {/* Phase 9A: Admin Product Review Moderation Console */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <h2 className="text-lg font-bold text-slate-900">Product Review Moderation Console</h2>
            </div>
            <AdminReviewsModerator />
          </div>

          {/* Phase 9B: Admin Marketplace Coupon & Discount Engine */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <h2 className="text-lg font-bold text-slate-900">Marketplace Coupon & Discount Engine</h2>
            </div>
            <AdminCouponsManager />
          </div>
        </section>
      )}

      {/* Role Architecture Modules */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Explore Platform Modules</h2>
          <p className="text-xs text-slate-500">Three dedicated roles designed with strict tenant isolation and permissions</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Customer Portal */}
          <div
            onClick={() => setActiveRole('customer')}
            className={`cursor-pointer rounded-2xl border p-6 transition-all duration-200 ${
              activeRole === 'customer'
                ? 'bg-white border-indigo-600 ring-2 ring-indigo-500/20 shadow-md'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Customer Storefront</h3>
              <Badge variant="indigo">Shopper</Badge>
            </div>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Unified multi-vendor cart, faceted search with Elasticsearch, one-step checkout, and real-time delivery tracking.
            </p>
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-indigo-600 font-semibold">
              <span>View Module Spec</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Vendor Hub */}
          <div
            onClick={() => setActiveRole('vendor')}
            className={`cursor-pointer rounded-2xl border p-6 transition-all duration-200 ${
              activeRole === 'vendor'
                ? 'bg-white border-emerald-600 ring-2 ring-emerald-500/20 shadow-md'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <Store className="w-6 h-6" />
            </div>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Vendor Dashboard</h3>
              <Badge variant="emerald">Seller</Badge>
            </div>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Merchant KYC onboarding, product catalog with S3 uploads, sub-order fulfillment, and automated payout ledger.
            </p>
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-emerald-600 font-semibold">
              <span>View Module Spec</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Admin Console */}
          <div
            onClick={() => setActiveRole('admin')}
            className={`cursor-pointer rounded-2xl border p-6 transition-all duration-200 ${
              activeRole === 'admin'
                ? 'bg-white border-purple-600 ring-2 ring-purple-500/20 shadow-md'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Admin Console</h3>
              <Badge variant="slate">Super-Admin</Badge>
            </div>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Seller KYC verification, category commissions, marketplace GMV oversight, and dispute mediation console.
            </p>
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-purple-600 font-semibold">
              <span>View Module Spec</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

