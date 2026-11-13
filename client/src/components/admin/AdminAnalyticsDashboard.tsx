import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Store,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Calendar,
  AlertCircle,
  AlertTriangle,
  Award,
  Percent,
} from 'lucide-react';
import {
  AnalyticsOverview,
  RevenueAnalytics,
  OrderAnalytics,
  VendorAnalytics,
  ProductAnalytics,
  CommissionAnalytics,
  PayoutAnalytics,
} from '../../types';
import { analyticsApi, AnalyticsFilterParams } from '../../services/analytics.api';

export const AdminAnalyticsDashboard: React.FC = () => {
  // Preset filter state
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | '12m'>('30d');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [isCustomDate, setIsCustomDate] = useState<boolean>(false);

  // Data states
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [revenue, setRevenue] = useState<RevenueAnalytics | null>(null);
  const [orders, setOrders] = useState<OrderAnalytics | null>(null);
  const [vendors, setVendors] = useState<VendorAnalytics | null>(null);
  const [products, setProducts] = useState<ProductAnalytics | null>(null);
  const [commissions, setCommissions] = useState<CommissionAnalytics | null>(null);
  const [payouts, setPayouts] = useState<PayoutAnalytics | null>(null);

  // UI status
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{
    date: string;
    revenue: number;
    ordersCount: number;
    x: number;
    y: number;
  } | null>(null);

  const loadAllAnalytics = useCallback(async (bypassCache: boolean = false) => {
    try {
      if (bypassCache) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const params: AnalyticsFilterParams = {
        refresh: bypassCache,
      };

      if (isCustomDate && customStart && customEnd) {
        params.startDate = new Date(customStart).toISOString();
        params.endDate = new Date(customEnd).toISOString();
      } else {
        params.period = period;
      }

      const [
        overviewData,
        revenueData,
        ordersData,
        vendorsData,
        productsData,
        commissionsData,
        payoutsData,
      ] = await Promise.all([
        analyticsApi.getOverview(bypassCache),
        analyticsApi.getRevenue(params),
        analyticsApi.getOrders(params),
        analyticsApi.getVendors(params),
        analyticsApi.getProducts(params),
        analyticsApi.getCommissions(params),
        analyticsApi.getPayouts(params),
      ]);

      setOverview(overviewData);
      setRevenue(revenueData);
      setOrders(ordersData);
      setVendors(vendorsData);
      setProducts(productsData);
      setCommissions(commissionsData);
      setPayouts(payoutsData);
    } catch (err: any) {
      console.error('Failed to load admin analytics', err);
      setError(err?.response?.data?.error?.message || 'Failed to load business intelligence metrics');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [period, isCustomDate, customStart, customEnd]);

  useEffect(() => {
    loadAllAnalytics();
  }, [loadAllAnalytics]);

  const handlePresetChange = (preset: '7d' | '30d' | '90d' | '12m') => {
    setIsCustomDate(false);
    setPeriod(preset);
  };

  const handleApplyCustomDate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customStart || !customEnd) return;
    setIsCustomDate(true);
    loadAllAnalytics();
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // -------------------------------------------------------------
  // Render: SVG Line Chart Helper
  // -------------------------------------------------------------
  const renderRevenueChart = () => {
    if (!revenue || !revenue.timeline || revenue.timeline.length === 0) {
      return (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
          <Calendar className="w-8 h-8 stroke-1 mb-2 text-slate-300" />
          <p className="text-xs font-medium">No sales recorded during this selected date range.</p>
        </div>
      );
    }

    const data = revenue.timeline;
    const width = 760;
    const height = 240;
    const paddingX = 45;
    const paddingY = 30;

    const maxRev = Math.max(...data.map((d) => d.revenue), 100);
    const minRev = 0;

    const getX = (index: number) => {
      if (data.length <= 1) return width / 2;
      return paddingX + (index / (data.length - 1)) * (width - paddingX * 2);
    };

    const getY = (val: number) => {
      return height - paddingY - ((val - minRev) / (maxRev - minRev)) * (height - paddingY * 2);
    };

    const points = data.map((d, i) => `${getX(i)},${getY(d.revenue)}`).join(' ');
    const areaPoints = `${getX(0)},${height - paddingY} ${points} ${getX(data.length - 1)},${height - paddingY}`;

    return (
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-64 overflow-visible"
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const val = minRev + (maxRev - minRev) * (1 - ratio);
            const y = paddingY + ratio * (height - paddingY * 2);
            return (
              <g key={idx}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingX - 8}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill="#94a3b8"
                  className="font-mono"
                >
                  ₹{Math.round(val)}
                </text>
              </g>
            );
          })}

          {/* Shaded Area */}
          <polygon points={areaPoints} fill="url(#revenueGradient)" />

          {/* Main Trend Line */}
          <polyline
            fill="none"
            stroke="#4f46e5"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />

          {/* Interactive Data Points */}
          {data.map((d, i) => {
            const cx = getX(i);
            const cy = getY(d.revenue);
            const isHovered = hoveredPoint?.date === d.date;

            return (
              <g key={d.date}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 6 : 3.5}
                  fill={isHovered ? '#4338ca' : '#ffffff'}
                  stroke="#4f46e5"
                  strokeWidth={isHovered ? 2.5 : 2}
                  className="cursor-pointer transition-all duration-150"
                  onMouseEnter={() =>
                    setHoveredPoint({
                      date: d.date,
                      revenue: d.revenue,
                      ordersCount: d.ordersCount,
                      x: cx,
                      y: cy,
                    })
                  }
                />
              </g>
            );
          })}

          {/* Date Axis Labels */}
          {data.map((d, i) => {
            // Display label for first, middle, last, or every N points
            const shouldDisplay =
              i === 0 ||
              i === data.length - 1 ||
              (data.length > 5 && i % Math.ceil(data.length / 5) === 0);

            if (!shouldDisplay) return null;
            const x = getX(i);
            return (
              <text
                key={`lbl-${d.date}`}
                x={x}
                y={height - 8}
                textAnchor="middle"
                fontSize="9"
                fill="#64748b"
                className="font-medium"
              >
                {d.date.length > 10 ? d.date.substring(5) : d.date}
              </text>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && (
          <div
            className="absolute pointer-events-none z-10 px-3 py-2 bg-slate-900 text-white rounded-xl shadow-xl text-xs space-y-0.5 transform -translate-x-1/2 -translate-y-full mb-2 animate-in fade-in zoom-in-95 duration-100"
            style={{
              left: `${(hoveredPoint.x / width) * 100}%`,
              top: `${(hoveredPoint.y / height) * 100}%`,
            }}
          >
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {hoveredPoint.date}
            </p>
            <p className="font-extrabold text-sm text-indigo-300">
              {formatCurrency(hoveredPoint.revenue)}
            </p>
            <p className="text-[11px] text-slate-300">
              {hoveredPoint.ordersCount} {hoveredPoint.ordersCount === 1 ? 'order' : 'orders'}
            </p>
          </div>
        )}
      </div>
    );
  };

  // -------------------------------------------------------------
  // Render: Order Status Progress Bar
  // -------------------------------------------------------------
  const renderOrderStatusDistribution = () => {
    if (!orders || orders.totalOrders === 0) {
      return (
        <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
          No order records available for this window.
        </div>
      );
    }

    const statusColors: Record<string, { bg: string; dot: string; text: string }> = {
      delivered: { bg: 'bg-emerald-500', dot: 'bg-emerald-500', text: 'text-emerald-700' },
      shipped: { bg: 'bg-blue-500', dot: 'bg-blue-500', text: 'text-blue-700' },
      processing: { bg: 'bg-amber-500', dot: 'bg-amber-500', text: 'text-amber-700' },
      confirmed: { bg: 'bg-indigo-500', dot: 'bg-indigo-500', text: 'text-indigo-700' },
      pending: { bg: 'bg-slate-400', dot: 'bg-slate-400', text: 'text-slate-700' },
      cancelled: { bg: 'bg-rose-500', dot: 'bg-rose-500', text: 'text-rose-700' },
    };

    return (
      <div className="space-y-4">
        {/* Multi-segment stacked progress bar */}
        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
          {orders.statusDistribution.map((item) => {
            if (item.count === 0) return null;
            const style = statusColors[item.status] || { bg: 'bg-slate-400' };
            return (
              <div
                key={item.status}
                style={{ width: `${item.percentage}%` }}
                className={`${style.bg} transition-all duration-300 hover:opacity-90`}
                title={`${item.status}: ${item.count} (${item.percentage}%)`}
              />
            );
          })}
        </div>

        {/* Legend pills */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          {orders.statusDistribution.map((item) => {
            const style = statusColors[item.status] || {
              dot: 'bg-slate-400',
              text: 'text-slate-700',
            };
            return (
              <div
                key={item.status}
                className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                  <span className="font-semibold text-slate-700 capitalize">
                    {item.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-900 block">{item.count}</span>
                  <span className="text-[10px] text-slate-400">{item.percentage}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* -------------------------------------------------------------
          Header Bar with Quick Presets & Refresh
      ------------------------------------------------------------- */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <TrendingUp className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Executive Business Intelligence & Analytics
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time multi-vendor metrics, revenue trends, commission auditing, and fulfillment analytics.
          </p>
        </div>

        {/* Controls: Preset Pills & Refresh */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            {(['7d', '30d', '90d', '12m'] as const).map((p) => (
              <button
                key={p}
                onClick={() => handlePresetChange(p)}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  !isCustomDate && period === p
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : p === '90d' ? '90 Days' : '12 Months'}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => loadAllAnalytics(true)}
            disabled={isLoading || isRefreshing}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center space-x-1.5 transition disabled:opacity-50 shadow-sm"
            title="Bypass Redis cache and pull live metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Custom Date Filter Drawer */}
      <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2 text-slate-600 font-semibold">
          <Calendar className="w-4 h-4 text-indigo-600" />
          <span>Custom Reporting Range:</span>
        </div>
        <form onSubmit={handleApplyCustomDate} className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <button
            type="submit"
            disabled={!customStart || !customEnd}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition disabled:opacity-40"
          >
            Apply Range
          </button>
        </form>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start space-x-3 text-rose-700 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">Error Loading Analytics</p>
            <p>{error}</p>
          </div>
          <button
            onClick={() => loadAllAnalytics(true)}
            className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold rounded-lg text-[11px]"
          >
            Retry
          </button>
        </div>
      )}

      {/* -------------------------------------------------------------
          1. TOP KPI SUMMARY METRIC CARDS
      ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Captured Platform Revenue */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Captured Revenue
            </span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">
              {revenue ? formatCurrency(revenue.totalRevenue) : '...'}
            </span>
            {revenue?.previousPeriod && revenue.previousPeriod.revenueGrowthPercentage !== undefined && (
              <span
                className={`text-[11px] font-bold flex items-center ${
                  revenue.previousPeriod.revenueGrowthPercentage >= 0
                    ? 'text-emerald-600'
                    : 'text-rose-600'
                }`}
              >
                {revenue.previousPeriod.revenueGrowthPercentage >= 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                )}
                {Math.abs(revenue.previousPeriod.revenueGrowthPercentage)}%
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            All-Time Revenue: {overview ? formatCurrency(overview.totalRevenue) : '...'}
          </p>
        </div>

        {/* KPI 2: Successful Orders & AOV */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Paid Orders
            </span>
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <ShoppingCart className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">
              {revenue ? revenue.successfulOrdersCount : '...'}
            </span>
            <span className="text-[11px] font-bold text-slate-600">
              AOV: {revenue ? formatCurrency(revenue.averageOrderValue) : '...'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Total Parent Orders: {overview ? overview.totalParentOrders : '...'}
          </p>
        </div>

        {/* KPI 3: Platform Commission Earned */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Platform Commission
            </span>
            <span className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Percent className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-purple-600">
              {commissions ? formatCurrency(commissions.totalCommission) : '...'}
            </span>
            <span className="text-[11px] font-bold text-slate-500">
              Rate: {commissions ? `${commissions.effectiveCommissionRate}%` : '...'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            All-Time Fee: {commissions ? formatCurrency(commissions.allTimeCommission) : '...'}
          </p>
        </div>

        {/* KPI 4: Vendor Ecosystem & Treasury */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Treasury Payouts
            </span>
            <span className="p-2 bg-teal-50 text-teal-600 rounded-xl">
              <Store className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">
              {payouts ? formatCurrency(payouts.paidPayouts.amount) : '...'}
            </span>
            <span className="text-[11px] font-bold text-amber-600">
              Pending: {payouts ? formatCurrency(payouts.pendingPayouts.amount) : '...'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            {overview?.totalVendors || 0} Approved Vendors • {overview?.totalCustomers || 0} Customers
          </p>
        </div>
      </div>

      {/* -------------------------------------------------------------
          2. CHARTS SECTION: REVENUE TIMELINE & ORDER STATUS
      ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Revenue Timeline Chart (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Revenue & Sales Trajectory</h2>
              <p className="text-xs text-slate-400">
                Verified payment capture timeline grouped by {revenue?.period.groupBy || 'day'}
              </p>
            </div>
            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-100">
              {revenue?.timeline.length || 0} intervals
            </span>
          </div>

          {/* Line Chart */}
          {isLoading ? (
            <div className="h-64 flex items-center justify-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
          ) : (
            renderRevenueChart()
          )}
        </div>

        {/* Right: Order Status Distribution (1 Col) */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Order Fulfillment Health</h2>
            <p className="text-xs text-slate-400">Distribution across fulfillment stages</p>
          </div>

          {isLoading ? (
            <div className="h-48 flex items-center justify-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
          ) : (
            renderOrderStatusDistribution()
          )}
        </div>
      </div>

      {/* -------------------------------------------------------------
          3. TABLES SECTION: TOP VENDORS & BEST-SELLING PRODUCTS
      ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performing Vendors Table */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                <Award className="w-4 h-4" />
              </span>
              <h2 className="text-base font-bold text-slate-900">Top-Performing Merchants</h2>
            </div>
            <span className="text-xs text-slate-400">Ranked by gross sales</span>
          </div>

          {isLoading ? (
            <div className="py-12 flex justify-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
          ) : !vendors || vendors.vendors.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
              No vendor activity recorded in this period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="pb-3">Merchant / Store</th>
                    <th className="pb-3 text-center">Orders</th>
                    <th className="pb-3 text-right">Gross Sales</th>
                    <th className="pb-3 text-right">Commission</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vendors.vendors.slice(0, 6).map((v, idx) => (
                    <tr key={v.vendorId} className="hover:bg-slate-50/50 transition">
                      <td className="py-3">
                        <div className="flex items-center space-x-2">
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="font-bold text-slate-900">{v.storeName}</p>
                            <p className="text-[10px] text-slate-400">{v.businessEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-center font-bold text-slate-700">
                        {v.totalOrders}
                      </td>
                      <td className="py-3 text-right font-black text-slate-900">
                        {formatCurrency(v.totalSales)}
                      </td>
                      <td className="py-3 text-right font-bold text-purple-600">
                        {formatCurrency(v.platformCommission)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Best-Selling Products Table */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <Package className="w-4 h-4" />
              </span>
              <h2 className="text-base font-bold text-slate-900">Best-Selling Catalog Items</h2>
            </div>
            <span className="text-xs text-slate-400">Ranked by volume sold</span>
          </div>

          {isLoading ? (
            <div className="py-12 flex justify-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
          ) : !products || products.bestSellingProducts.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
              No product purchase activity recorded in this period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="pb-3">Product Name</th>
                    <th className="pb-3 text-center">Qty Sold</th>
                    <th className="pb-3 text-right">Revenue</th>
                    <th className="pb-3 text-center">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.bestSellingProducts.slice(0, 6).map((p, idx) => (
                    <tr key={p.productId} className="hover:bg-slate-50/50 transition">
                      <td className="py-3">
                        <div className="flex items-center space-x-2">
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="font-bold text-slate-900 max-w-[180px] truncate">
                              {p.productName}
                            </p>
                            <p className="text-[10px] text-slate-400">SKU: {p.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-center font-bold text-slate-700">
                        {p.unitsSold}
                      </td>
                      <td className="py-3 text-right font-black text-slate-900">
                        {formatCurrency(p.totalRevenue)}
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.stockStatus === 'in_stock'
                              ? 'bg-emerald-50 text-emerald-700'
                              : p.stockStatus === 'low_stock'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {p.currentStock} left
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* -------------------------------------------------------------
          4. INVENTORY HEALTH ALERTS & TREASURY SUMMARY
      ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inventory Stock Alerts */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-3">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 className="text-base font-bold text-slate-900">Inventory Stock Alerts</h2>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-2xl flex items-center justify-between">
              <div>
                <p className="font-bold text-amber-900">Low Stock Products (≤ 10)</p>
                <p className="text-[11px] text-amber-700">Items nearing replenishment threshold</p>
              </div>
              <span className="text-lg font-black text-amber-900">
                {products?.lowStockProducts.length || 0}
              </span>
            </div>

            <div className="p-3 bg-rose-50/70 border border-rose-200/60 rounded-2xl flex items-center justify-between">
              <div>
                <p className="font-bold text-rose-900">Out of Stock Products</p>
                <p className="text-[11px] text-rose-700">Depleted inventory requiring restocking</p>
              </div>
              <span className="text-lg font-black text-rose-900">
                {products?.outOfStockProducts.length || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Treasury Payouts Summary (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Store className="w-4 h-4 text-teal-600" />
              <h2 className="text-base font-bold text-slate-900">Treasury Balances & Payout Activity</h2>
            </div>
            <span className="text-xs text-slate-400">Reconciled against merchant ledgers</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-4 bg-teal-50/50 border border-teal-100 rounded-2xl">
              <p className="text-[10px] font-bold uppercase tracking-wider text-teal-600">
                Available Merchant Balance
              </p>
              <p className="text-xl font-black text-teal-900 mt-1">
                {payouts ? formatCurrency(payouts.availableVendorBalances) : '...'}
              </p>
              <p className="text-[10px] text-teal-700 mt-0.5">Eligible for instant withdrawal</p>
            </div>

            <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-2xl">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                Pending Escrow Balance
              </p>
              <p className="text-xl font-black text-amber-900 mt-1">
                {payouts ? formatCurrency(payouts.pendingBalances) : '...'}
              </p>
              <p className="text-[10px] text-amber-700 mt-0.5">Awaiting delivery settlement</p>
            </div>

            <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                Completed Disbursements
              </p>
              <p className="text-xl font-black text-indigo-900 mt-1">
                {payouts ? formatCurrency(payouts.paidPayouts.amount) : '...'}
              </p>
              <p className="text-[10px] text-indigo-700 mt-0.5">
                {payouts?.paidPayouts.count || 0} successfully settled transfers
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
