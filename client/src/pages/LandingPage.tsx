import React, { useState, Suspense } from 'react';
import { 
  ShoppingBag, 
  Store, 
  ShieldCheck, 
  Truck, 
  Award, 
  CheckCircle2, 
  ArrowRight,
  Lock,
  Zap,
  LogIn,
  Package,
  Wallet,
  LayoutGrid,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ProductSearchExperience } from '../components/search/ProductSearchExperience';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

// Lazy-loaded vendor and admin dashboard components for optimal code splitting
const VendorOnboardingSection = React.lazy(() =>
  import('../components/vendor/VendorOnboardingSection').then((m) => ({ default: m.VendorOnboardingSection }))
);
const VendorOrdersManager = React.lazy(() =>
  import('../components/vendor/VendorOrdersManager').then((m) => ({ default: m.VendorOrdersManager }))
);
const VendorEarningsDashboard = React.lazy(() =>
  import('../components/vendor/VendorEarningsDashboard').then((m) => ({ default: m.VendorEarningsDashboard }))
);
const VendorProductsManager = React.lazy(() =>
  import('../components/vendor/VendorProductsManager').then((m) => ({ default: m.VendorProductsManager }))
);
const AdminVendorApplicationsManager = React.lazy(() =>
  import('../components/admin/AdminVendorApplicationsManager').then((m) => ({ default: m.AdminVendorApplicationsManager }))
);
const AdminOrdersManager = React.lazy(() =>
  import('../components/admin/AdminOrdersManager').then((m) => ({ default: m.AdminOrdersManager }))
);
const AdminPayoutsManager = React.lazy(() =>
  import('../components/admin/AdminPayoutsManager').then((m) => ({ default: m.AdminPayoutsManager }))
);
const AdminReviewsModerator = React.lazy(() =>
  import('../components/admin/AdminReviewsModerator').then((m) => ({ default: m.AdminReviewsModerator }))
);
const AdminCouponsManager = React.lazy(() =>
  import('../components/admin/AdminCouponsManager').then((m) => ({ default: m.AdminCouponsManager }))
);
const AdminAnalyticsDashboard = React.lazy(() =>
  import('../components/admin/AdminAnalyticsDashboard').then((m) => ({ default: m.AdminAnalyticsDashboard }))
);

export const LandingPage: React.FC = () => {
  const { activeRole, setActiveRole, user, openAuthModal } = useApp();
  const [merchantActiveTab, setMerchantActiveTab] = useState<'all' | 'catalog' | 'orders' | 'payouts'>('all');

  return (
    <div className="space-y-10">
      {/* =========================================================================
          CUSTOMER MARKETPLACE EXPERIENCE
          ========================================================================= */}
      {activeRole === 'customer' && (
        <>
          {/* Customer Hero Section */}
          <section className="relative overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-xs p-6 sm:p-10 lg:p-12">
            {/* Ambient Background Glows */}
            <div className="absolute -right-20 -top-20 w-96 h-96 bg-emerald-100/40 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute right-1/4 -bottom-20 w-80 h-80 bg-teal-50/60 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
              {/* Left Column: Customer Value Proposition */}
              <div className="lg:col-span-7 space-y-5">
                {/* Trust Badge */}
                <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/70 text-xs font-semibold shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Curated Multi-Vendor Tech Marketplace</span>
                </div>

                {/* Main Headline */}
                <div className="space-y-1">
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 leading-[1.12]">
                    Discover Next-Generation
                  </h1>
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-emerald-700 leading-[1.12]">
                    Electronics & Tech Gear
                  </h2>
                </div>

                {/* Subtitle */}
                <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-xl font-normal">
                  Explore certified laptops, studio-grade headphones, smart wearables, and smart home hardware directly from verified independent makers with fast tracked shipping and buyer protection.
                </p>

                {/* Customer Trust Badges */}
                <div className="flex flex-wrap gap-2.5 pt-1">
                  <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Verified Independent Brands</span>
                  </div>

                  <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700">
                    <Truck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Express Insured Shipping</span>
                  </div>

                  <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>100% Escrow Protection</span>
                  </div>

                  <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700">
                    <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>256-Bit Encrypted Payments</span>
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
                          Search catalog...
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
                            Direct from certified independent makers
                          </span>
                          <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-700 text-white text-[8px] font-bold mt-1 shadow-xs">
                            <span>Explore Catalog</span>
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
                            { name: 'Audio', color: 'bg-emerald-50 text-emerald-700' },
                            { name: 'Wearables', color: 'bg-teal-50 text-teal-700' },
                            { name: 'Laptops', color: 'bg-sky-50 text-sky-700' },
                            { name: 'Phones', color: 'bg-indigo-50 text-indigo-700' },
                            { name: 'Gaming', color: 'bg-amber-50 text-amber-700' },
                            { name: 'Smart IoT', color: 'bg-slate-100 text-slate-700' },
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
          </section>

          {/* 4 Marketplace Value Pillars */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1">
                <Award className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">100% Genuine Guarantee</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Every item is sourced directly from certified manufacturers and vetted independent hardware brands.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Multi-Vendor Cart Splitting</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Order from multiple distinct sellers in a single checkout with automatic sub-order tracking.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Escrow Buyer Protection</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Payments remain protected until you receive and verify your package. 30-day money-back guarantee.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Fast Tracked Delivery</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                All vendors commit to 48-hour dispatch with active tracking codes provided directly in your account.
              </p>
            </div>
          </section>

          {/* Full Catalog Search, Filter, & Shopping Experience */}
          <section className="space-y-4">
            <ErrorBoundary fallbackTitle="Product Search & Discovery Unavailable">
              <ProductSearchExperience />
            </ErrorBoundary>
          </section>

          {/* Merchant Recruitment Banner */}
          <section className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-8 sm:p-10 text-white shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold">
                <Store className="w-3.5 h-3.5" />
                <span>NexusMarket Seller Program</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Grow Your Brand on NexusMarket
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Join our curated network of certified tech makers. Enjoy low 8% platform commissions, automated next-day payout settlements, and instant discovery via our Elasticsearch engine.
              </p>
            </div>

            <button
              onClick={() => setActiveRole('vendor')}
              className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition shrink-0 flex items-center space-x-2"
            >
              <span>Open a Seller Store</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </section>
        </>
      )}

      {/* =========================================================================
          VENDOR MERCHANT OPERATIONS PORTAL
          ========================================================================= */}
      {activeRole === 'vendor' && (
        <div className="space-y-6">
          {/* Vendor Portal Intro Banner */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Store className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Merchant Operations Center
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage your store verification, product catalog, customer order dispatch, and payout balance.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActiveRole('customer')}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
              >
                View Live Marketplace →
              </button>
            </div>
          </div>

          {/* Quick Sub-Navigation Tab Bar for Merchant */}
          {user && (user.role === 'vendor' || user.role === 'admin') && (
            <div className="flex items-center flex-wrap gap-2 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/90 shadow-xs">
              <button
                onClick={() => setMerchantActiveTab('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                  merchantActiveTab === 'all'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <LayoutGrid className="w-4 h-4 text-slate-500" />
                <span>All Overview</span>
              </button>
              <button
                onClick={() => setMerchantActiveTab('catalog')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                  merchantActiveTab === 'catalog'
                    ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Package className="w-4 h-4 text-indigo-600" />
                <span>Product Catalog</span>
              </button>
              <button
                onClick={() => setMerchantActiveTab('orders')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                  merchantActiveTab === 'orders'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Truck className="w-4 h-4" />
                <span>Orders & Shipments</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    merchantActiveTab === 'orders'
                      ? 'bg-emerald-700 text-emerald-100'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  Fulfill
                </span>
              </button>
              <button
                onClick={() => setMerchantActiveTab('payouts')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                  merchantActiveTab === 'payouts'
                    ? 'bg-white text-teal-700 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Wallet className="w-4 h-4 text-teal-600" />
                <span>Revenue & Payouts</span>
              </button>
            </div>
          )}

          {/* If user is not signed in, show clean merchant authentication gate */}
          {!user ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center max-w-2xl mx-auto space-y-6 shadow-xs">
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <Store className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  Merchant Portal Sign-In Required
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                  Sign into your verified seller account to fulfill customer orders, manage inventory, and withdraw payout balances. Or apply to open a new store on NexusMarket.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2 max-w-md mx-auto text-left">
                <div className="font-bold text-slate-800 flex items-center justify-between">
                  <span>Demo Merchant Account</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">Vendor</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div>Email: <strong>vendor@example.com</strong></div>
                  <div>Password: <strong>Password123!</strong></div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => openAuthModal('login')}
                  className="w-full sm:w-auto px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center justify-center space-x-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In as Merchant</span>
                </button>
                <button
                  onClick={() => openAuthModal('register')}
                  className="w-full sm:w-auto px-5 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  Register New Account
                </button>
              </div>
            </div>
          ) : (
            <Suspense fallback={<div className="p-12 text-center text-slate-400 font-medium animate-pulse">Loading merchant console...</div>}>
              {/* Store Onboarding & Status */}
              {(merchantActiveTab === 'all' || merchantActiveTab === 'catalog') && (
                <VendorOnboardingSection />
              )}

              {/* Product Catalog & Management (for approved vendors or admins) */}
              {(user.role === 'vendor' || user.role === 'admin') && (
                <>
                  {(merchantActiveTab === 'all' || merchantActiveTab === 'catalog') && (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                        <h2 className="text-lg font-bold text-slate-900">Products & Catalog Management</h2>
                      </div>
                      <VendorProductsManager />
                    </div>
                  )}

                  {/* Order Fulfillment & Shipment Dispatch */}
                  {(merchantActiveTab === 'all' || merchantActiveTab === 'orders') && (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        <h2 className="text-lg font-bold text-slate-900">Order Fulfillment & Shipment Dispatch</h2>
                      </div>
                      <VendorOrdersManager />
                    </div>
                  )}

                  {/* Vendor Earnings & Balance Payouts */}
                  {(merchantActiveTab === 'all' || merchantActiveTab === 'payouts') && (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
                        <h2 className="text-lg font-bold text-slate-900">Revenue Ledger & Balance Payouts</h2>
                      </div>
                      <VendorEarningsDashboard />
                    </div>
                  )}
                </>
              )}
            </Suspense>
          )}
        </div>
      )}

      {/* =========================================================================
          ADMIN GOVERNANCE & OPERATIONS SUITE
          ========================================================================= */}
      {activeRole === 'admin' && (
        <div className="space-y-8">
          {/* Admin Header Banner */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Platform Operations & Governance
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Executive overview, merchant verification, multi-vendor order oversight, platform commissions, and content moderation.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActiveRole('customer')}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
              >
                View Live Marketplace →
              </button>
            </div>
          </div>

          {/* Access Control Gate: Check if current session has Admin privileges */}
          {!user || user.role !== 'admin' ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center max-w-2xl mx-auto space-y-6 shadow-xs">
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <ShieldCheck className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  Super-Administrator Access Required
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                  The Platform Operations Console contains confidential marketplace revenue data, seller KYC verification files, and treasury controls. Please sign in with an authorized Administrator account.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2 max-w-md mx-auto text-left">
                <div className="font-bold text-slate-800 flex items-center justify-between">
                  <span>Demo Administrator Credentials</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">Admin</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div>Email: <strong>admin@example.com</strong></div>
                  <div>Password: <strong>Password123!</strong></div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => openAuthModal('login')}
                  className="w-full sm:w-auto px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center justify-center space-x-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In as Admin</span>
                </button>
                <button
                  onClick={() => setActiveRole('customer')}
                  className="w-full sm:w-auto px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  Back to Marketplace
                </button>
              </div>
            </div>
          ) : (
            <Suspense fallback={<div className="p-12 text-center text-slate-400 font-medium animate-pulse">Loading administrative console...</div>}>
              {/* Executive Analytics Dashboard */}
              <div className="space-y-3">
                <ErrorBoundary fallbackTitle="Executive Analytics Dashboard Unavailable">
                  <AdminAnalyticsDashboard />
                </ErrorBoundary>
              </div>

              {/* Merchant KYC & Store Verification Desk */}
              <div className="space-y-3">
                <ErrorBoundary fallbackTitle="Merchant KYC Verification Desk Unavailable">
                  <AdminVendorApplicationsManager />
                </ErrorBoundary>
              </div>

              {/* Order Oversight & Dispute Management */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <h2 className="text-lg font-bold text-slate-900">Platform Order Governance & Oversight</h2>
                </div>
                <ErrorBoundary fallbackTitle="Platform Orders Governance Unavailable">
                  <AdminOrdersManager />
                </ErrorBoundary>
              </div>

              {/* Platform Treasury & Merchant Payout Approvals */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
                  <h2 className="text-lg font-bold text-slate-900">Platform Commission Treasury & Payout Ledger</h2>
                </div>
                <ErrorBoundary fallbackTitle="Treasury & Payouts Console Unavailable">
                  <AdminPayoutsManager />
                </ErrorBoundary>
              </div>

              {/* Review Moderation */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                  <h2 className="text-lg font-bold text-slate-900">Product Review Moderation Console</h2>
                </div>
                <ErrorBoundary fallbackTitle="Product Review Moderation Console Unavailable">
                  <AdminReviewsModerator />
                </ErrorBoundary>
              </div>

              {/* Coupon & Promotional Engine */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <h2 className="text-lg font-bold text-slate-900">Marketplace Promotional & Coupon Engine</h2>
                </div>
                <ErrorBoundary fallbackTitle="Coupon & Promotional Engine Unavailable">
                  <AdminCouponsManager />
                </ErrorBoundary>
              </div>
            </Suspense>
          )}
        </div>
      )}
    </div>
  );
};
