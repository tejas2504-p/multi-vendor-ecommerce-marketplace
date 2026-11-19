import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Truck,
  CheckCircle2,
  Loader2,
  AlertCircle,
  RefreshCw,
  Search,
  Clock,
  CheckCircle,
  ArrowRight,
  Copy,
  Check,
  Boxes,
} from 'lucide-react';
import { VendorOrder } from '../../types';
import { orderApi } from '../../services/order.api';
import { useApp } from '../../context/AppContext';

export const VendorOrdersManager: React.FC = () => {
  const { user, isAuthenticated } = useApp();
  const [vendorOrders, setVendorOrders] = useState<VendorOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filtering State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [copiedTrackingId, setCopiedTrackingId] = useState<string | null>(null);

  // Modal updating form state
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [targetStatus, setTargetStatus] = useState<string>('processing');
  const [carrier, setCarrier] = useState<string>('FedEx Express');
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [statusNote, setStatusNote] = useState<string>('');
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const isVendor = isAuthenticated && (user?.role === 'vendor' || user?.role === 'admin');

  const loadVendorOrders = useCallback(async () => {
    if (!isVendor) return;
    try {
      setIsLoading(true);
      setError(null);
      const data = await orderApi.getVendorOrders();
      setVendorOrders(data);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to load merchant orders');
    } finally {
      setIsLoading(false);
    }
  }, [isVendor]);

  useEffect(() => {
    loadVendorOrders();
  }, [loadVendorOrders]);

  // Handle direct 1-click quick advance
  const handleDirectStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      setIsUpdating(true);
      setError(null);
      setSuccessMsg(null);

      await orderApi.updateVendorOrderStatus(orderId, {
        status: newStatus,
        note: `Order advanced to ${newStatus} by vendor`,
      });

      setSuccessMsg(`Order updated to "${newStatus}" successfully`);
      await loadVendorOrders();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to update order status');
    } finally {
      setIsUpdating(false);
    }
  };

  // Open modal with pre-configured target status
  const handleOpenStatusModal = (orderId: string, initialStatus: string) => {
    setSelectedOrderId(orderId);
    setTargetStatus(initialStatus);
    setCarrier('FedEx Express');
    setTrackingNumber(`TRK-${Date.now().toString().slice(-8)}`);
    setStatusNote('');
    setCancellationReason('');
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) return;

    try {
      setIsUpdating(true);
      setError(null);
      setSuccessMsg(null);

      await orderApi.updateVendorOrderStatus(selectedOrderId, {
        status: targetStatus,
        carrier: targetStatus === 'shipped' ? carrier : undefined,
        trackingNumber: targetStatus === 'shipped' ? trackingNumber : undefined,
        note: statusNote || undefined,
        cancellationReason: targetStatus === 'cancelled' ? cancellationReason : undefined,
      });

      setSuccessMsg(`Vendor order updated to "${targetStatus}" successfully`);
      setSelectedOrderId(null);
      await loadVendorOrders();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to update order status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCopyTracking = (trackNum: string) => {
    navigator.clipboard.writeText(trackNum);
    setCopiedTrackingId(trackNum);
    setTimeout(() => setCopiedTrackingId(null), 2000);
  };

  if (!isVendor) {
    return (
      <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-500">
        Sign in with an approved Vendor or Admin account to manage merchant order fulfillment.
      </div>
    );
  }

  // Filtered orders
  const filteredOrders = vendorOrders.filter((vo) => {
    const matchesSearch =
      vo.vendorOrderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vo.items.some((it) => it.productName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (vo.shipmentTracking?.trackingNumber &&
        vo.shipmentTracking.trackingNumber.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      selectedStatusFilter === 'all' ||
      (selectedStatusFilter === 'pending_action' && (vo.orderStatus === 'confirmed' || vo.orderStatus === 'processing')) ||
      vo.orderStatus === selectedStatusFilter;

    return matchesSearch && matchesStatus;
  });

  // KPI Counts
  const countConfirmed = vendorOrders.filter((vo) => vo.orderStatus === 'confirmed').length;
  const countProcessing = vendorOrders.filter((vo) => vo.orderStatus === 'processing').length;
  const countShipped = vendorOrders.filter((vo) => vo.orderStatus === 'shipped').length;
  const countDelivered = vendorOrders.filter((vo) => vo.orderStatus === 'delivered').length;
  const countNeedsAction = countConfirmed + countProcessing;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'shipped':
        return 'bg-blue-50 text-blue-700 border-blue-200';
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
    <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Order Fulfillment & Shipment Dispatch</h2>
            <p className="text-xs text-slate-500">
              Manage your customer shipments, assign tracking numbers, and advance orders to delivery.
            </p>
          </div>
        </div>

        <button
          onClick={loadVendorOrders}
          disabled={isLoading}
          className="flex items-center space-x-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition"
          title="Refresh orders list"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Orders</span>
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Orders</span>
          <div className="text-xl font-black text-slate-900">{vendorOrders.length}</div>
          <span className="text-[10px] text-slate-400">All customer packages</span>
        </div>

        <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-1">
          <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">Needs Dispatch</span>
          <div className="text-xl font-black text-amber-900">{countNeedsAction}</div>
          <span className="text-[10px] text-amber-700">Awaiting packaging / carrier</span>
        </div>

        <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-1">
          <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">In Transit</span>
          <div className="text-xl font-black text-blue-900">{countShipped}</div>
          <span className="text-[10px] text-blue-700">Shipped with tracking</span>
        </div>

        <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-1">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Delivered</span>
          <div className="text-xl font-black text-emerald-900">{countDelivered}</div>
          <span className="text-[10px] text-emerald-700">Completed shipments</span>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start space-x-2.5 text-rose-700 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start space-x-2.5 text-emerald-700 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Search & Status Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by order #, product, or tracking..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
          {[
            { id: 'all', label: 'All', count: vendorOrders.length },
            { id: 'pending_action', label: 'Action Required', count: countNeedsAction },
            { id: 'confirmed', label: 'Confirmed', count: countConfirmed },
            { id: 'processing', label: 'Processing', count: countProcessing },
            { id: 'shipped', label: 'Shipped', count: countShipped },
            { id: 'delivered', label: 'Delivered', count: countDelivered },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setSelectedStatusFilter(st.id)}
              className={`px-3 py-1 rounded-lg font-semibold transition flex items-center space-x-1 ${
                selectedStatusFilter === st.id
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>{st.label}</span>
              <span className="text-[10px] opacity-75 font-mono">({st.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      {isLoading && vendorOrders.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-400 space-y-2">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <span className="text-xs font-medium">Loading merchant shipments...</span>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="py-16 border-2 border-dashed border-slate-200 rounded-2xl text-center space-y-2 bg-slate-50/50">
          <Boxes className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-xs text-slate-700 font-bold">No orders found</p>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            {searchQuery
              ? 'No customer orders match your search criteria. Try a different query.'
              : 'When customers place orders with your products, their shipments will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((vo) => (
            <div
              key={vo.id}
              className="rounded-2xl border border-slate-200 p-5 space-y-3.5 bg-white hover:border-slate-300 transition shadow-xs"
            >
              {/* Order Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2.5">
                    <span className="text-sm font-black text-slate-900">#{vo.vendorOrderNumber}</span>
                    <span
                      className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-wider ${getStatusBadge(
                        vo.orderStatus
                      )}`}
                    >
                      {vo.orderStatus}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Received on {new Date(vo.createdAt).toLocaleDateString()} at {new Date(vo.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Package Value</span>
                    <span className="text-sm font-black text-emerald-700">${vo.vendorSubtotal.toFixed(2)}</span>
                  </div>

                  {/* Contextual Action Buttons */}
                  <div className="flex items-center space-x-1.5">
                    {vo.orderStatus === 'confirmed' && (
                      <>
                        <button
                          onClick={() => handleDirectStatusUpdate(vo.id, 'processing')}
                          disabled={isUpdating}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center space-x-1"
                        >
                          <Package className="w-3.5 h-3.5" />
                          <span>Pack Order</span>
                        </button>
                        <button
                          onClick={() => handleOpenStatusModal(vo.id, 'shipped')}
                          disabled={isUpdating}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center space-x-1"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Dispatch</span>
                        </button>
                      </>
                    )}

                    {vo.orderStatus === 'processing' && (
                      <button
                        onClick={() => handleOpenStatusModal(vo.id, 'shipped')}
                        disabled={isUpdating}
                        className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center space-x-1"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Add Tracking & Ship</span>
                      </button>
                    )}

                    {vo.orderStatus === 'shipped' && (
                      <button
                        onClick={() => handleDirectStatusUpdate(vo.id, 'delivered')}
                        disabled={isUpdating}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center space-x-1"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Mark Delivered</span>
                      </button>
                    )}

                    {vo.orderStatus !== 'delivered' && vo.orderStatus !== 'cancelled' && (
                      <button
                        onClick={() => handleOpenStatusModal(vo.id, vo.orderStatus)}
                        className="p-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition"
                        title="More Fulfillment Options"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="bg-slate-50/70 rounded-xl border border-slate-200/80 p-3 space-y-1.5 text-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Ordered Items ({vo.items.length}):
                </span>
                {vo.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between items-center text-slate-700">
                    <span className="font-medium">
                      {it.productName} <span className="text-slate-400 font-mono">× {it.quantity}</span>
                    </span>
                    <span className="font-semibold">${it.itemSubtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Carrier & Tracking Display */}
              {vo.shipmentTracking?.trackingNumber ? (
                <div className="flex items-center justify-between text-xs text-blue-800 bg-blue-50/70 px-3.5 py-2 rounded-xl border border-blue-200/80">
                  <div className="flex items-center space-x-2">
                    <Truck className="w-4 h-4 text-blue-600" />
                    <span>
                      Carrier: <strong>{vo.shipmentTracking.carrier || 'Standard Express'}</strong> — Tracking:{' '}
                      <span className="font-mono font-bold">{vo.shipmentTracking.trackingNumber}</span>
                    </span>
                  </div>
                  <button
                    onClick={() => vo.shipmentTracking?.trackingNumber && handleCopyTracking(vo.shipmentTracking.trackingNumber)}
                    className="flex items-center space-x-1 text-[11px] text-blue-700 hover:text-blue-900 font-semibold"
                  >
                    {copiedTrackingId === vo.shipmentTracking.trackingNumber ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                vo.orderStatus === 'confirmed' && (
                  <div className="text-[11px] text-amber-700 bg-amber-50/50 px-3 py-1.5 rounded-xl border border-amber-200/70 flex items-center space-x-2">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Package awaits seller packaging. Advance status when ready to dispatch.</span>
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal for updating vendor order status */}
      {selectedOrderId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Truck className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Update Fulfillment & Tracking</h3>
              </div>
              <button
                onClick={() => setSelectedOrderId(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateStatus} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">New Order Status *</label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  <option value="confirmed">Confirmed</option>
                  <option value="processing">Processing (Packaging in warehouse)</option>
                  <option value="shipped">Shipped (Dispatched with tracking)</option>
                  <option value="delivered">Delivered (Handed to customer)</option>
                  <option value="cancelled">Cancelled (Restore inventory stock)</option>
                </select>
              </div>

              {targetStatus === 'shipped' && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Shipping Carrier *</label>
                    <input
                      type="text"
                      required
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value)}
                      placeholder="e.g. FedEx Express, DHL, BlueDart, UPS"
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tracking Number *</label>
                    <input
                      type="text"
                      required
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="e.g. FDX-9988776655"
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </>
              )}

              {targetStatus === 'cancelled' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cancellation Reason *</label>
                  <input
                    type="text"
                    required
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                    placeholder="e.g. Damaged inventory, customer cancellation"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Internal Note (Optional)</label>
                <input
                  type="text"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="e.g. Packaged in bubble wrap with fragile label"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedOrderId(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex items-center space-x-1.5 px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition shadow-sm disabled:opacity-50"
                >
                  {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Status</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
