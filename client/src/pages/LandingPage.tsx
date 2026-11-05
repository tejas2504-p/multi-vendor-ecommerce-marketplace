import React from 'react';
import { 
  ShoppingBag, 
  Store, 
  ShieldCheck, 
  Server, 
  Database, 
  Activity, 
  Construction, 
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

export const LandingPage: React.FC = () => {
  const { activeRole, setActiveRole } = useApp();
  const { data: health, isLoading, isError, refetch, isFetching } = useHealth();

  return (
    <div className="space-y-8">
      {/* Development In-Progress Alert Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 flex items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 bg-amber-500/20 text-amber-700 rounded-xl shrink-0">
            <Construction className="w-5 h-5 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-amber-900 text-sm sm:text-base">
                Marketplace Platform Under Active Development
              </span>
              <Badge variant="amber">Phase 1B Foundation</Badge>
            </div>
            <p className="text-xs sm:text-sm text-amber-800/80 mt-0.5">
              The core monorepo, Express REST API, React SPA, and database architecture are operational. Business features will roll out in upcoming phases.
            </p>
          </div>
        </div>
        <div className="hidden lg:block text-right shrink-0">
          <span className="text-xs font-semibold text-amber-800">Version 1.0.0</span>
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-8 sm:p-12 shadow-2xl border border-slate-800">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-3xl space-y-5 relative z-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/10 backdrop-blur rounded-full text-xs font-medium text-indigo-200 border border-white/10">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Multi-Vendor Architecture Initialized</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Amazon-Style Multi-Vendor <br />
            <span className="bg-gradient-to-r from-indigo-400 via-sky-300 to-emerald-300 bg-clip-text text-transparent">
              E-Commerce Marketplace
            </span>
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl">
            Engineered from scratch using a production monorepo layout. Built with TypeScript end-to-end,
            Express.js RESTful API, MongoDB document store, and decoupled modular portals for Customers, Sellers, and Platform Admins.
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            {['React 18', 'TypeScript', 'Node.js Express', 'MongoDB', 'Tailwind CSS', 'Redis', 'Elasticsearch', 'AWS S3'].map((tech) => (
              <span
                key={tech}
                className="px-2.5 py-1 text-xs font-medium bg-slate-800/80 text-slate-300 rounded-lg border border-slate-700/60"
              >
                {tech}
              </span>
            ))}
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

      {/* Phase 5B: Advanced Elasticsearch Catalog Search & Discovery */}
      <ProductSearchExperience />

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

