import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Filter,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Edit2,
} from 'lucide-react';
import { Order, VendorOrder } from '../../types';
import { orderApi } from '../../services/order.api';
import { useApp } from '../../context/AppContext';

export const AdminOrdersManager: React.FC = () => {
  const { user, isAuthenticated } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [vendorOrders, setVendorOrders] = useState<VendorOrder[]>([]);
  const [activeTab, setActiveTab] = useState<'parent' | 'vendor'>('parent');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Status override modal state
  const [overrideOrderId, setOverrideOrderId] = useState<string | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<string>('delivered');
  const [overrideNote, setOverrideNote] = useState<string>('Platform admin delivery confirmation');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const isAdmin = isAuthenticated && user?.role === 'admin';

  const loadData = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setIsLoading(true);
      setError(null);

      if (activeTab === 'parent') {
        const res = await orderApi.getAdminOrders({
          status: statusFilter || undefined,
        });
        setOrders(res.orders);
      } else {
        const res = await orderApi.getAdminVendorOrders({
          status: statusFilter || undefined,
        });
        setVendorOrders(res.vendorOrders);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to load platform orders');
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, activeTab, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAdminOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideOrderId) return;
    try {
      setIsUpdating(true);
      setError(null);
      await orderApi.adminUpdateOrderStatus(overrideOrderId, overrideStatus, overrideNote);
      setSuccessMsg(`Order #${overrideOrderId} status overridden to "${overrideStatus}"`);
      setOverrideOrderId(null);
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to override status');
    } finally {
      setIsUpdating(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-500">
        Admin privileges required to access marketplace governance.
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'shipped':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'partially_delivered':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'partially_shipped':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'processing':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'confirmed':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'cancelled':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Platform Orders Governance</h2>
            <p className="text-xs text-slate-500">
              Audit all customer parent orders and multi-vendor shipment packages across the marketplace
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="flex items-center space-x-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-rose-700 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-2 text-emerald-700 text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tabs and Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('parent')}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              activeTab === 'parent' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Parent Orders ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('vendor')}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              activeTab === 'vendor' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Vendor Orders ({vendorOrders.length})
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-xl bg-white text-slate-700 text-xs"
          >
            <option value="">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="partially_shipped">Partially Shipped</option>
            <option value="partially_delivered">Partially Delivered</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
          <Loader2 className="w-7 h-7 animate-spin text-purple-600" />
          <span className="text-xs">Loading marketplace records...</span>
        </div>
      ) : activeTab === 'parent' ? (
        /* Parent Orders Table/Cards */
        orders.length === 0 ? (
          <div className="py-12 border-2 border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-500">
            No parent orders matching the selected filter.
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((ord) => (
              <div
                key={ord.id}
                className="rounded-2xl border border-slate-200 p-4 space-y-2 bg-slate-50/30 hover:border-slate-300 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-slate-900">#{ord.orderNumber}</span>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-md border capitalize ${getStatusBadge(
                          ord.orderStatus
                        )}`}
                      >
                        {ord.orderStatus.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Customer: {ord.deliveryAddress.fullName} • Placed {new Date(ord.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-black text-slate-900">${ord.totalAmount.toFixed(2)}</span>
                    <button
                      onClick={() => setOverrideOrderId(ord.id)}
                      title="Admin Override"
                      className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg border border-purple-200 transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center space-x-3 text-xs text-slate-600 pt-1">
                  <span>Subtotal: ${ord.subtotal.toFixed(2)}</span>
                  <span>•</span>
                  <span>Shipping: ${ord.shippingAmount.toFixed(2)}</span>
                  <span>•</span>
                  <span>Packages: {ord.vendorOrders?.length || 0}</span>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Vendor Orders Table/Cards */
        vendorOrders.length === 0 ? (
          <div className="py-12 border-2 border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-500">
            No vendor orders matching the selected filter.
          </div>
        ) : (
          <div className="space-y-3">
            {vendorOrders.map((vo) => (
              <div
                key={vo.id}
                className="rounded-2xl border border-slate-200 p-4 space-y-2 bg-slate-50/30 hover:border-slate-300 transition text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">#{vo.vendorOrderNumber}</span>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-md border capitalize ${getStatusBadge(
                      vo.orderStatus
                    )}`}
                  >
                    {vo.orderStatus}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Items: {vo.items.length}</span>
                  <span className="font-bold text-slate-900">${vo.vendorSubtotal.toFixed(2)}</span>
                </div>
                {vo.shipmentTracking?.trackingNumber && (
                  <p className="text-[11px] text-blue-600">
                    Carrier: {vo.shipmentTracking.carrier || 'Standard'} • Tracking: {vo.shipmentTracking.trackingNumber}
                  </p>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* Admin Status Override Modal */}
      {overrideOrderId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Administrative Status Override</h3>
              <button
                onClick={() => setOverrideOrderId(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdminOverride} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Status Override *</label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-800"
                >
                  <option value="confirmed">Confirmed</option>
                  <option value="processing">Processing</option>
                  <option value="partially_shipped">Partially Shipped</option>
                  <option value="shipped">Shipped</option>
                  <option value="partially_delivered">Partially Delivered</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Administrative Note</label>
                <input
                  type="text"
                  value={overrideNote}
                  onChange={(e) => setOverrideNote(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  placeholder="Reason for administrative override"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setOverrideOrderId(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition disabled:opacity-50"
                >
                  {isUpdating ? 'Updating...' : 'Save Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
